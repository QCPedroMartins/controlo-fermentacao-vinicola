/**
 * emailReport.ts
 * Gera ficheiros Excel (.xlsx) com leituras, gráficos de linhas e adições
 * para envio por email via Resend.
 */

import ExcelJS from "exceljs";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { getAllCubas, getLeiturasByCuba, getAdicoesByCuba, getMovimentosHoje, getRecepcoesDoDia, getMovimentosByCuba, getAnalisesByCuba } from "./db";
import { fileURLToPath } from "url";
import { join, dirname } from "path";
import { readFileSync } from "fs";

// Registar fontes empacotadas no projecto via Buffer (funciona em produção sem depender do sistema de ficheiros)
try {
  const __dirname_email = dirname(fileURLToPath(import.meta.url));
  // Em produção o ficheiro compilado fica em dist/, as fontes em server/fonts/
  // Tentar múltiplos caminhos para garantir compatibilidade
  const candidates = [
    join(__dirname_email, "fonts"),          // dev: server/fonts/
    join(__dirname_email, "../server/fonts"), // prod: dist/../server/fonts/
    join(process.cwd(), "server/fonts"),      // fallback: cwd/server/fonts/
  ];
  const FONT_DIR_EMAIL = candidates.find(d => {
    try { readFileSync(join(d, "NotoSans-Regular.ttf")); return true; } catch { return false; }
  }) ?? candidates[0];
  const regularBuf = readFileSync(join(FONT_DIR_EMAIL, "NotoSans-Regular.ttf"));
  const boldBuf = readFileSync(join(FONT_DIR_EMAIL, "NotoSans-Bold.ttf"));
  GlobalFonts.register(regularBuf, "Noto Sans");
  GlobalFonts.register(boldBuf, "Noto Sans");
  console.log("[Fonts] Carregadas de:", FONT_DIR_EMAIL);
} catch (_e) {
  // Fallback: tentar caminhos do sistema
  try {
    GlobalFonts.registerFromPath("/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf", "Noto Sans");
    GlobalFonts.registerFromPath("/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf", "Noto Sans");
  } catch (_e2) { /* ignorar */ }
}

// ── Constantes ────────────────────────────────────────────
// Destinatário: geral@castelares.com (verificado no Resend)
const TO_EMAIL = "geral@castelares.com";

const CORES_HEX = {
  densL1: "2e7d32",
  tempL1: "2e7d32",
  o2: "00838f",
  redox: "6a1b9a",
};

// ── Tipos ─────────────────────────────────────────────────
type LeituraRow = {
  id: number;
  dataLeitura: Date | string;
  diaNr: number | null;
  hora: string | null;
  densL1: string | null;
  baumeL1?: string | null;
  tempL1: string | null;
  o2: string | null;
  redox: string | null;
  userName: string | null;
  editedAt: Date | null;
  editedByName: string | null;
};

type AdicaoRow = {
  id: number;
  dataAdicao: Date | string;
  produto: string | null;
  dose: string | null;
  observacoes: string | null;
  userName: string | null;
};

type CubaInfo = {
  id: number;
  codigo: string;
  nomeLote: string | null;
  fermentacaoNum: number;
  estado: string;
  densidadeLimite: string | null;
  tempPretendida: string | null;
  fichaKilos: string | null;
  fichaLitros: string | null;
  fichaPh: string | null;
  fichaAt: string | null;
  fichaAv: string | null;
  fichaNfa: string | null;
  fichaNtu: string | null;
  fichaGluconico: string | null;
  fichaAlcoolProvavel: string | null;
  tipoCuba?: string | null;
  pontoAguardentacao?: string | null;
};

// ── Gerador de gráfico PNG via canvas ─────────────────────
function gerarGraficoLinha(params: {
  titulo: string;
  dados: { x: number; xLabel?: string; series: { label: string; cor: string; valor: number | null }[] }[];
  largura?: number;
  altura?: number;
  unidade?: string;
  marcadores?: { dia: number; label: string; index: number }[];
  linhaRef?: { valor: number; label: string; cor: string }; // linha horizontal de referência (ex: temp pretendida, aguardentação)
}): { buffer: Buffer; height: number } {
  const W = params.largura ?? 900;
  const nSeries = params.dados[0]?.series.length ?? 0;
  // Legenda lateral direita: largura fixa de 180px
  const LEGEND_W = 180;
  const H = (params.altura ?? 320) + 28; // apenas espaço para labels X
  // PAD.bottom: 22px para labels X; PAD.right: área da legenda
  const PAD = { top: 45, right: LEGEND_W + 16, bottom: 28, left: 70 };
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // Fundo branco
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // Título
  ctx.fillStyle = "#5d1a2e";
  ctx.font = "bold 14px Noto Sans, sans-serif";
  ctx.fillText(params.titulo, PAD.left, 24);

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  // Calcular domínio Y
  const allVals = params.dados.flatMap((d) =>
    d.series.map((s) => s.valor).filter((v): v is number => v !== null)
  );
  if (allVals.length === 0) {
    ctx.fillStyle = "#999";
    ctx.font = "12px Noto Sans, sans-serif";
    ctx.fillText("Sem dados", PAD.left + plotW / 2 - 30, PAD.top + plotH / 2);
    return { buffer: canvas.toBuffer("image/png"), height: H };
  }

  const rawMin2 = Math.min(...allVals);
  const rawMax2 = Math.max(...allVals);
  // Garantir escala mínima para que 1 único ponto seja visível
  const rangeMin2 = params.unidade === "°C" ? 2 :
    params.unidade === "mg/L" ? 0.5 :
    params.unidade === "mV" ? 20 :
    params.unidade === "°" ? 0.5 : 0.005;
  const mid2 = (rawMin2 + rawMax2) / 2;
  const halfRange2 = Math.max((rawMax2 - rawMin2) / 2, rangeMin2);
  const yMin = mid2 - halfRange2 * 1.15;
  const yMax = mid2 + halfRange2 * 1.15;
  const xMin = params.dados[0]?.x ?? 0;
  const xMax = params.dados[params.dados.length - 1]?.x ?? 1;

  const toX = (x: number) => PAD.left + ((x - xMin) / Math.max(xMax - xMin, 1)) * plotW;
  const toY = (y: number) => PAD.top + plotH - ((y - yMin) / Math.max(yMax - yMin, 0.001)) * plotH;

  // Grelha horizontal
  ctx.strokeStyle = "#e8e8e8";
  ctx.lineWidth = 1;
  const nLines = 5;
  for (let i = 0; i <= nLines; i++) {
    const y = PAD.top + (i / nLines) * plotH;
    ctx.beginPath();
    ctx.moveTo(PAD.left, y);
    ctx.lineTo(PAD.left + plotW, y);
    ctx.stroke();
    // Label Y
    const val = yMax - (i / nLines) * (yMax - yMin);
    ctx.fillStyle = "#666";
    ctx.font = "10px Noto Sans, sans-serif";
    ctx.textAlign = "right";
    // Formatar com casas decimais adequadas à unidade (densidade sempre com 4 casas)
    const decimais = params.unidade === "mg/L" || params.unidade === "°C" || params.unidade === "mV" || params.unidade === "°" ? 1 : 4;
    ctx.fillText(val.toFixed(decimais), PAD.left - 5, y + 4);
  }

  // Eixo X — labels (hora HH:MM ou dia de fermentação)
  ctx.fillStyle = "#666";
  ctx.font = "10px Noto Sans, sans-serif";
  ctx.textAlign = "center";
  // Mostrar no máximo 14 labels para não sobrepor
  const stepX = Math.max(1, Math.ceil(params.dados.length / 14));
  params.dados.forEach((d, i) => {
    if (i % stepX !== 0 && i !== params.dados.length - 1) return;
    const x = toX(d.x);
    ctx.fillText(d.xLabel ?? String(d.x), x, PAD.top + plotH + 14);
  });

  // Unidade Y
  if (params.unidade) {
    ctx.save();
    ctx.translate(14, PAD.top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.fillStyle = "#444";
    ctx.font = "11px Noto Sans, sans-serif";
    ctx.fillText(params.unidade, 0, 0);
    ctx.restore();
  }

  // Marcadores de adições (linhas verticais roxas)
  if (params.marcadores && params.marcadores.length > 0) {
    params.marcadores.forEach((m) => {
      const mx = toX(m.dia);
      ctx.save();
      ctx.strokeStyle = "#7c3aed";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(mx, PAD.top);
      ctx.lineTo(mx, PAD.top + plotH);
      ctx.stroke();
      ctx.setLineDash([]);
      // Número do marcador (▼N)
      ctx.fillStyle = "#7c3aed";
      ctx.font = "bold 11px Noto Sans, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`\u25BC${m.index}`, mx, PAD.top + 14);
      ctx.restore();
    });
  }

  // Linha de referência horizontal (ex: temperatura pretendida, ponto de aguardentação)
  if (params.linhaRef) {
    const ry = toY(params.linhaRef.valor);
    ctx.save();
    ctx.strokeStyle = params.linhaRef.cor;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(PAD.left, ry);
    ctx.lineTo(PAD.left + plotW, ry);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // Séries
  const seriesLabels = params.dados[0]?.series.map((s) => s.label) ?? [];
  seriesLabels.forEach((label, si) => {
    const cor = params.dados[0]?.series[si]?.cor ?? "#888";
    ctx.strokeStyle = "#" + cor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    let started = false;
    params.dados.forEach((d) => {
      const v = d.series[si]?.valor;
      if (v === null || v === undefined) { started = false; return; }
      const px = toX(d.x);
      const py = toY(v);
      if (!started) { ctx.moveTo(px, py); started = true; }
      else ctx.lineTo(px, py);
    });
    ctx.stroke();

    // Pontos
    params.dados.forEach((d) => {
      const v = d.series[si]?.valor;
      if (v === null || v === undefined) return;
      ctx.fillStyle = "#" + cor;
      ctx.beginPath();
      ctx.arc(toX(d.x), toY(v), 3.5, 0, Math.PI * 2);
      ctx.fill();
    });
  });

  // Legenda das séries — lateral direita
  const legendaX = W - LEGEND_W + 10;
  seriesLabels.forEach((label, si) => {
    const cor = params.dados[0]?.series[si]?.cor ?? "888888";
    const ly = PAD.top + 4 + si * 26;
    // Linha colorida
    ctx.strokeStyle = "#" + cor;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(legendaX, ly);
    ctx.lineTo(legendaX + 22, ly);
    ctx.stroke();
    // Ponto central
    ctx.fillStyle = "#" + cor;
    ctx.beginPath();
    ctx.arc(legendaX + 11, ly, 4, 0, Math.PI * 2);
    ctx.fill();
    // Texto
    ctx.fillStyle = "#222222";
    ctx.font = "bold 12px Noto Sans, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(label, legendaX + 30, ly + 4);
  });

  // Legenda da linha de referência — lateral direita, abaixo das séries
  if (params.linhaRef) {
    const ly = PAD.top + 4 + seriesLabels.length * 26 + 8;
    ctx.save();
    ctx.strokeStyle = params.linhaRef.cor;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(legendaX, ly);
    ctx.lineTo(legendaX + 22, ly);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    // Texto (quebrar em 2 linhas se necessário)
    const refLabel = params.linhaRef.label;
    const maxW = LEGEND_W - 36;
    ctx.fillStyle = "#222222";
    ctx.font = "bold 10px Noto Sans, sans-serif";
    ctx.textAlign = "left";
    const words = refLabel.split(" ");
    let line1 = ""; let line2 = "";
    for (const w of words) {
      const test = line1 ? line1 + " " + w : w;
      if (ctx.measureText(test).width <= maxW) { line1 = test; }
      else { line2 = line2 ? line2 + " " + w : w; }
    }
    ctx.fillText(line1, legendaX + 30, ly + 3);
    if (line2) ctx.fillText(line2, legendaX + 30, ly + 16);
  }

  return { buffer: canvas.toBuffer("image/png"), height: H };
}

// ── Gerador de workbook Excel para uma cuba ───────────────
export async function gerarExcelCuba(cuba: CubaInfo): Promise<ArrayBuffer> {
  const leituras = (await getLeiturasByCuba(cuba.id, cuba.fermentacaoNum)) as LeituraRow[];
  const adicoes = (await getAdicoesByCuba(cuba.id, cuba.fermentacaoNum)) as AdicaoRow[];
  const movimentos = await getMovimentosByCuba(cuba.id);
  const analises = await getAnalisesByCuba(cuba.id);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Controlo de Fermentação Vinícola";
  wb.created = new Date();

  // ── Folha 1: Leituras ──────────────────────────────────
  const wsL = wb.addWorksheet("Leituras");

  // Cabeçalho informativo
  wsL.mergeCells("A1:K1");
  const titleCell = wsL.getCell("A1");
  titleCell.value = `${cuba.codigo.toUpperCase()} — ${cuba.nomeLote ?? "Sem nome"} — Fermentação Nº ${cuba.fermentacaoNum}`;
  titleCell.font = { bold: true, size: 13, color: { argb: "FF5D1A2E" } };
  titleCell.alignment = { horizontal: "center" };
  wsL.getRow(1).height = 22;

  wsL.mergeCells("A2:K2");
  wsL.getCell("A2").value = `Gerado em: ${new Date().toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" })}`;
  wsL.getCell("A2").font = { italic: true, size: 10, color: { argb: "FF888888" } };
  wsL.getCell("A2").alignment = { horizontal: "center" };

  if (cuba.tempPretendida) {
    wsL.mergeCells("A3:K3");
    wsL.getCell("A3").value = `Temperatura pretendida: ${cuba.tempPretendida}°C`;
    wsL.getCell("A3").font = { size: 10, color: { argb: "FF1565C0" } };
    wsL.getCell("A3").alignment = { horizontal: "center" };
  }

  // ── Ficha Inicial ──────────────────────────────────────────────
  const temFicha = cuba.fichaKilos || cuba.fichaLitros || cuba.fichaPh || cuba.fichaAt ||
    cuba.fichaAv || cuba.fichaNfa || cuba.fichaNtu || cuba.fichaGluconico || cuba.fichaAlcoolProvavel;
  if (temFicha) {
    wsL.mergeCells("A4:K4");
    wsL.getCell("A4").value = "FICHA INICIAL";
    wsL.getCell("A4").font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
    wsL.getCell("A4").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF5D1A2E" } };
    wsL.getCell("A4").alignment = { horizontal: "center" };
    wsL.getRow(4).height = 18;

    const fichaFields: [string, string | null][] = [
      ["Kilos", cuba.fichaKilos],
      ["Litros", cuba.fichaLitros],
      ["pH", cuba.fichaPh],
      ["AT (g/L)", cuba.fichaAt],
      ["AV (g/L)", cuba.fichaAv],
      ["NFA (mg/L)", cuba.fichaNfa],
      ["NTU", cuba.fichaNtu],
      ["Glucónico (g/L)", cuba.fichaGluconico],
      ["Alcool Provável (%)", cuba.fichaAlcoolProvavel],
    ];

    const fichaRow = wsL.addRow(fichaFields.map(([label]) => label));
    fichaRow.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDF0F3" } };
      cell.font = { bold: true, size: 9, color: { argb: "FF5D1A2E" } };
      cell.alignment = { horizontal: "center" };
    });

    const fichaValRow = wsL.addRow(fichaFields.map(([, val]) => val ?? "—"));
    fichaValRow.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDF0F3" } };
      cell.font = { size: 10 };
      cell.alignment = { horizontal: "center" };
    });

    wsL.addRow([]);
  }

  // Cabeçalhos da tabela
  const headerRow = wsL.addRow([
    "Data", "Dia Nº",
    "Densidade", "Temperatura (°C)",
    "O₂ (mg/L)", "Redox (mV)",
    "Utilizador",
  ]);
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF5D1A2E" } };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.alignment = { horizontal: "center" };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FFDDDDDD" } },
    };
  });

  // Dados
  leituras.forEach((l, idx) => {
    const row = wsL.addRow([
      new Date(l.dataLeitura).toLocaleDateString("pt-PT"),
      l.diaNr ?? "",
      l.densL1 ? parseFloat(l.densL1) : "",
      l.tempL1 ? parseFloat(l.tempL1) : "",
      l.o2 ? parseFloat(l.o2) : "",
      l.redox ? parseFloat(l.redox) : "",
      l.userName ?? "",
    ]);
    const bg = idx % 2 === 0 ? "FFFFFFFF" : "FFF8F4F6";
    row.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cell.alignment = { horizontal: "center" };
      cell.font = { size: 10 };
    });
    // Nota de edição
    if (l.editedAt && l.editedByName) {
      const lastCell = row.getCell(11);
      lastCell.value = `${l.userName ?? ""} ✏ editado por ${l.editedByName}`;
      lastCell.font = { size: 9, italic: true, color: { argb: "FF888888" } };
    }
  });

  // Larguras das colunas
  wsL.columns = [
    { width: 13 }, { width: 8 },
    { width: 12 }, { width: 14 },
    { width: 10 }, { width: 10 },
    { width: 22 },
  ];

  // ── Folha 2: Gráficos ─────────────────────────────────
  const wsG = wb.addWorksheet("Gráficos");
  wsG.mergeCells("A1:J1");
  wsG.getCell("A1").value = `Gráficos — ${cuba.codigo.toUpperCase()} — ${cuba.nomeLote ?? "Sem nome"}`;
  wsG.getCell("A1").font = { bold: true, size: 13, color: { argb: "FF5D1A2E" } };
  wsG.getCell("A1").alignment = { horizontal: "center" };

  const isPorto = cuba.tipoCuba === "porto";
  // Usar índice sequencial como X para distribuir pontos mesmo quando são do mesmo dia
  const chartData = leituras.map((l, idx) => ({
    x: idx,
    xLabel: l.hora ? l.hora.substring(0, 5) : String(l.diaNr ?? idx), // HH:MM ou dia
    densL1: l.densL1 ? parseFloat(l.densL1) : null,
    baumeL1: l.baumeL1 ? parseFloat(l.baumeL1) : null,
    tempL1: l.tempL1 ? parseFloat(l.tempL1) : null,
    o2: l.o2 ? parseFloat(l.o2) : null,
    redox: l.redox ? parseFloat(l.redox) : null,
  }));

  // Calcular marcadores de adições para os gráficos
  const marcadoresGrafico: { dia: number; label: string; index: number }[] = adicoes.map((a, idx) => {
    const dataAdicao = new Date(a.dataAdicao).getTime();
    let diaProximo = 0;
    let menorDiff = Infinity;
    leituras.forEach((l) => {
      const diff = Math.abs(new Date(l.dataLeitura).getTime() - dataAdicao);
      if (diff < menorDiff) { menorDiff = diff; diaProximo = l.diaNr ?? 0; }
    });
    const label = a.produto ?? a.observacoes ?? "Adição";
    return { dia: diaProximo, label, index: idx + 1 };
  });

  // Altura dos gráficos (com espaço para legendas)
  const CHART_H = 360; // altura do canvas (300 plot + 60 legenda)
  const CHART_ROWS = 22; // linhas Excel por gráfico

  // Gráfico 1: Densidade (cubas normais) ou Baumé (cubas VP)
  const pngDens = isPorto
    ? gerarGraficoLinha({
        titulo: "Baumé (°)",
        unidade: "°",
        largura: 800,
        marcadores: marcadoresGrafico,
        linhaRef: cuba.pontoAguardentacao
          ? { valor: parseFloat(cuba.pontoAguardentacao), label: `Ponto aguardentação (${cuba.pontoAguardentacao}°)`, cor: "#e53935" }
          : undefined,
        dados: chartData.map((d) => ({
          x: d.x,
          xLabel: d.xLabel,
          series: [
            { label: "Baumé", cor: CORES_HEX.densL1, valor: d.baumeL1 },
          ],
        })),
      })
    : gerarGraficoLinha({
        titulo: "Densidade",
        unidade: "Densidade",
        largura: 800,
        marcadores: marcadoresGrafico,
        dados: chartData.map((d) => ({
          x: d.x,
          xLabel: d.xLabel,
          series: [
            { label: "Densidade", cor: CORES_HEX.densL1, valor: d.densL1 },
          ],
        })),
      });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const imgDens = (wb as any).addImage({ buffer: pngDens.buffer, extension: "png" }) as number;
  wsG.addImage(imgDens, { tl: { col: 0, row: 2 }, ext: { width: 800, height: pngDens.height } });

  // Gráfico 2: Temperatura
  const pngTemp = gerarGraficoLinha({
    titulo: "Temperatura (°C)",
    unidade: "°C",
    largura: 800,
    marcadores: marcadoresGrafico,
    linhaRef: cuba.tempPretendida
      ? { valor: parseFloat(cuba.tempPretendida), label: `Temp. pretendida (${cuba.tempPretendida}°C)`, cor: "#1565c0" }
      : undefined,
    dados: chartData.map((d) => ({
      x: d.x,
      xLabel: d.xLabel,
      series: [
        { label: "Temperatura", cor: CORES_HEX.tempL1, valor: d.tempL1 },
      ],
    })),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const imgTemp = (wb as any).addImage({ buffer: pngTemp.buffer, extension: "png" }) as number;
  wsG.addImage(imgTemp, { tl: { col: 0, row: 2 + CHART_ROWS }, ext: { width: 800, height: pngTemp.height } });

  // Gráfico 3: O₂ (se tiver dados)
  const hasO2 = chartData.some((d) => d.o2 !== null);
  if (hasO2) {
    const pngO2 = gerarGraficoLinha({
      titulo: "O₂ Dissolvido (mg/L)",
      unidade: "mg/L",
      largura: 800,
      marcadores: marcadoresGrafico,
      dados: chartData.map((d) => ({
        x: d.x,
        xLabel: d.xLabel,
        series: [{ label: "O₂ Dissolvido", cor: CORES_HEX.o2, valor: d.o2 }],
      })),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const imgO2 = (wb as any).addImage({ buffer: pngO2.buffer, extension: "png" }) as number;
    wsG.addImage(imgO2, { tl: { col: 0, row: 2 + CHART_ROWS * 2 }, ext: { width: 800, height: pngO2.height } });
  }

  // Gráfico 4: Redox (se tiver dados)
  const hasRedox = chartData.some((d) => d.redox !== null);
  if (hasRedox) {
    const rowOffset = 2 + CHART_ROWS * (hasO2 ? 3 : 2);
    const pngRedox = gerarGraficoLinha({
      titulo: "Potencial Redox (mV)",
      unidade: "mV",
      largura: 800,
      marcadores: marcadoresGrafico,
      dados: chartData.map((d) => ({
        x: d.x,
        xLabel: d.xLabel,
        series: [{ label: "Potencial Redox", cor: CORES_HEX.redox, valor: d.redox }],
      })),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const imgRedox = (wb as any).addImage({ buffer: pngRedox.buffer, extension: "png" }) as number;
    wsG.addImage(imgRedox, { tl: { col: 0, row: rowOffset }, ext: { width: 800, height: pngRedox.height } });
  }

  // ── Legenda de adições na folha Gráficos ────────────────
  if (marcadoresGrafico.length > 0) {
    const nGraficos = 2 + (hasO2 ? 1 : 0) + (hasRedox ? 1 : 0);
    const legendaRowStart = 2 + CHART_ROWS * nGraficos + 2;
    const legendaTitulo = wsG.getRow(legendaRowStart);
    const tituloCell = legendaTitulo.getCell(1);
    tituloCell.value = "ADIÇÕES / NOTAS";
    tituloCell.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
    tituloCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF5D1A2E" } };
    tituloCell.alignment = { horizontal: "center" };
    wsG.mergeCells(legendaRowStart, 1, legendaRowStart, 6);

    const hdrLeg = wsG.getRow(legendaRowStart + 1);
    ["Nº", "Dia", "Produto / Adição", "Dose", "Observações", "Data"].forEach((h, i) => {
      const cell = hdrLeg.getCell(i + 1);
      cell.value = h;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF7C3AED" } };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
      cell.alignment = { horizontal: "center" };
    });

    adicoes.forEach((a, idx) => {
      const r = wsG.getRow(legendaRowStart + 2 + idx);
      [
        `\u25BC${idx + 1}`,
        marcadoresGrafico[idx]?.dia ?? "",
        a.produto ?? "",
        a.dose ?? "",
        a.observacoes ?? "",
        new Date(a.dataAdicao).toLocaleDateString("pt-PT"),
      ].forEach((v, i) => {
        const cell = r.getCell(i + 1);
        cell.value = v;
        cell.font = { size: 10, color: i === 0 ? { argb: "FF7C3AED" } : undefined, bold: i === 0 };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: idx % 2 === 0 ? "FFFFFFFF" : "FFF3EEFF" } };
        cell.alignment = { horizontal: i === 0 ? "center" : "left" };
      });
    });

    wsG.getColumn(1).width = 6;
    wsG.getColumn(2).width = 8;
    wsG.getColumn(3).width = 30;
    wsG.getColumn(4).width = 16;
    wsG.getColumn(5).width = 40;
    wsG.getColumn(6).width = 13;
  }

  // ── Folha 3: Adições ──────────────────────────────────
  if (adicoes.length > 0) {
    const wsA = wb.addWorksheet("Adições e Notas");
    wsA.mergeCells("A1:E1");
    wsA.getCell("A1").value = `Adições e Notas — ${cuba.codigo.toUpperCase()} — ${cuba.nomeLote ?? "Sem nome"}`;
    wsA.getCell("A1").font = { bold: true, size: 12, color: { argb: "FF5D1A2E" } };
    wsA.getCell("A1").alignment = { horizontal: "center" };

    const hdrA = wsA.addRow(["Data", "Produto / Adição", "Dose", "Observações", "Registado por"]);
    hdrA.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF5D1A2E" } };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
      cell.alignment = { horizontal: "center" };
    });

    adicoes.forEach((a, idx) => {
      const row = wsA.addRow([
        new Date(a.dataAdicao).toLocaleDateString("pt-PT"),
        a.produto ?? "",
        a.dose ?? "",
        a.observacoes ?? "",
        a.userName ?? "",
      ]);
      const bg = idx % 2 === 0 ? "FFFFFFFF" : "FFF8F4F6";
      row.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        cell.font = { size: 10 };
      });
    });

    wsA.columns = [
      { width: 13 }, { width: 28 }, { width: 16 }, { width: 40 }, { width: 20 },
    ];
  }

  // ── Folha 4: Movimentos / Rastreabilidade ─────────────
  if (movimentos.length > 0) {
    const wsM = wb.addWorksheet("Movimentos");
    wsM.mergeCells("A1:G1");
    wsM.getCell("A1").value = `Movimentos / Rastreabilidade — ${cuba.codigo.toUpperCase()}`;
    wsM.getCell("A1").font = { bold: true, size: 12, color: { argb: "FF1565C0" } };
    wsM.getCell("A1").alignment = { horizontal: "center" };
    const hdrM = wsM.addRow(["Data", "Tipo", "Sentido", "Cuba(s) Origem", "Cuba(s) Destino", "Litros", "Notas"]);
    hdrM.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1565C0" } };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
      cell.alignment = { horizontal: "center" };
    });
    movimentos.forEach((m, idx) => {
      let origens: number[] = [];
      try { origens = JSON.parse(m.cubasOrigemIds); } catch { origens = []; }
      const isDestino = m.cubaDestinoId === cuba.id;
      const sentido = isDestino ? "↓ Entrada" : "↑ Saída";
      let destinosStr = "";
      try {
        const destinos = JSON.parse(m.destinosJson ?? "[]") as { cubaCodigo: string; litros: number }[];
        destinosStr = destinos.map(d => `${d.cubaCodigo} (${d.litros}L)`).join(", ");
      } catch { destinosStr = m.cubaDestinoId ? String(m.cubaDestinoId) : "—"; }
      let litrosTotal = 0;
      try { litrosTotal = (JSON.parse(m.destinosJson ?? "[]") as { litros: number }[]).reduce((s, d) => s + d.litros, 0); } catch { litrosTotal = 0; }
      const row = wsM.addRow([
        m.dataMovimento ?? "—",
        m.tipo === "transferencia" ? "Transferência" : "Junção",
        sentido,
        origens.join(", ") || "—",
        destinosStr || "—",
        litrosTotal > 0 ? litrosTotal : "—",
        m.motivo ?? "",
      ]);
      const bg = idx % 2 === 0 ? "FFFFFFFF" : "FFE3F2FD";
      row.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        cell.font = { size: 10 };
      });
      row.getCell(3).font = { bold: true, size: 10, color: { argb: isDestino ? "FF1565C0" : "FFc62828" } };
    });
    wsM.columns = [
      { width: 13 }, { width: 15 }, { width: 12 }, { width: 25 }, { width: 30 }, { width: 12 }, { width: 35 },
    ];
  }

  // ── Folha 5: Histórico de Análises ─────────────────────
  if (analises.length > 0) {
    const wsAn = wb.addWorksheet("Histórico Análises");
    wsAn.mergeCells("A1:J1");
    wsAn.getCell("A1").value = `Histórico de Análises — ${cuba.codigo.toUpperCase()} — ${cuba.nomeLote ?? "Sem nome"}`;
    wsAn.getCell("A1").font = { bold: true, size: 12, color: { argb: "FF2E7D32" } };
    wsAn.getCell("A1").alignment = { horizontal: "center" };
    const hdrAn = wsAn.addRow(["Data", "Litros", "pH", "AT (g/L)", "AV (g/L)", "NFA (mg/L)", "NTU", "Glucónico (g/L)", "Álcool Prov. (%)", "Registado por"]);
    hdrAn.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2E7D32" } };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
      cell.alignment = { horizontal: "center" };
    });
    analises.forEach((a, idx) => {
      const row = wsAn.addRow([
        a.dataAnalise ?? "—",
        a.fichaLitros ?? "—",
        a.fichaPh ?? "—",
        a.fichaAt ?? "—",
        a.fichaAv ?? "—",
        a.fichaNfa ?? "—",
        a.fichaNtu ?? "—",
        a.fichaGluconico ?? "—",
        a.fichaAlcoolProvavel ?? "—",
        a.userName ?? "—",
      ]);
      const bg = idx % 2 === 0 ? "FFFFFFFF" : "FFF1F8E9";
      row.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        cell.font = { size: 10 };
      });
    });
    wsAn.columns = [
      { width: 13 }, { width: 10 }, { width: 8 }, { width: 12 }, { width: 12 },
      { width: 14 }, { width: 10 }, { width: 16 }, { width: 18 }, { width: 22 },
    ];
  }

  return wb.xlsx.writeBuffer();
}

// ── Gerador do digest diário (todas as cubas ativas) ──────
export async function gerarExcelDigestDiario(): Promise<ArrayBuffer> {
  const todasCubas = await getAllCubas() as CubaInfo[];
  const cubasAtivas = todasCubas.filter((c) => c.estado === "em_fermentacao");

  const wb = new ExcelJS.Workbook();
  wb.creator = "Controlo de Fermentação Vinícola";
  wb.created = new Date();

  // Folha de resumo
  const wsResumo = wb.addWorksheet("Resumo");
  wsResumo.mergeCells("A1:G1");
  wsResumo.getCell("A1").value = `Digest Diário — ${new Date().toLocaleDateString("pt-PT", { timeZone: "Europe/Lisbon" })}`;
  wsResumo.getCell("A1").font = { bold: true, size: 14, color: { argb: "FF5D1A2E" } };
  wsResumo.getCell("A1").alignment = { horizontal: "center" };
  wsResumo.getRow(1).height = 24;

  wsResumo.mergeCells("A2:G2");
  wsResumo.getCell("A2").value = `${cubasAtivas.length} cuba(s) em fermentação`;
  wsResumo.getCell("A2").font = { size: 11, color: { argb: "FF666666" } };
  wsResumo.getCell("A2").alignment = { horizontal: "center" };

  const hdrR = wsResumo.addRow(["Cuba", "Lote", "Fermentação Nº", "Estado", "Dens. Limite", "Temp. Pretendida", "Nº Leituras"]);
  hdrR.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF5D1A2E" } };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.alignment = { horizontal: "center" };
  });

  for (const cuba of cubasAtivas) {
    const leituras = await getLeiturasByCuba(cuba.id, cuba.fermentacaoNum);
    const row = wsResumo.addRow([
      cuba.codigo.toUpperCase(),
      cuba.nomeLote ?? "—",
      cuba.fermentacaoNum,
      "Em fermentação",
      cuba.densidadeLimite ?? "—",
      cuba.tempPretendida ? `${cuba.tempPretendida}°C` : "—",
      leituras.length,
    ]);
    row.eachCell((cell) => {
      cell.alignment = { horizontal: "center" };
      cell.font = { size: 10 };
    });
  }

  wsResumo.columns = [
    { width: 10 }, { width: 28 }, { width: 14 }, { width: 16 }, { width: 14 }, { width: 16 }, { width: 12 },
  ];

  // Uma folha por cuba ativa
  for (const cuba of cubasAtivas) {
    const leituras = (await getLeiturasByCuba(cuba.id, cuba.fermentacaoNum)) as LeituraRow[];
    const adicoes = (await getAdicoesByCuba(cuba.id, cuba.fermentacaoNum)) as AdicaoRow[];

    const nomeFolha = cuba.codigo.toUpperCase().substring(0, 28); // Excel: max 31 chars
    const wsC = wb.addWorksheet(nomeFolha);

    // Cabeçalho
    wsC.mergeCells("A1:K1");
    wsC.getCell("A1").value = `${cuba.codigo.toUpperCase()} — ${cuba.nomeLote ?? "Sem nome"} — Fermentação Nº ${cuba.fermentacaoNum}`;
    wsC.getCell("A1").font = { bold: true, size: 12, color: { argb: "FF5D1A2E" } };
    wsC.getCell("A1").alignment = { horizontal: "center" };

    // Tabela de leituras
    const hdr = wsC.addRow([
      "Data", "Dia Nº",
      "Densidade", "Baumé (°Bé)", "Temperatura",
      "O₂", "Redox", "Utilizador",
    ]);
    hdr.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF5D1A2E" } };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
      cell.alignment = { horizontal: "center" };
    });

    leituras.forEach((l, idx) => {
      const row = wsC.addRow([
        new Date(l.dataLeitura).toLocaleDateString("pt-PT"),
        l.diaNr ?? "",
        l.densL1 ? parseFloat(l.densL1) : "",
        l.baumeL1 ? parseFloat(l.baumeL1) : "",
        l.tempL1 ? parseFloat(l.tempL1) : "",
        l.o2 ? parseFloat(l.o2) : "",
        l.redox ? parseFloat(l.redox) : "",
        l.userName ?? "",
      ]);
      const bg = idx % 2 === 0 ? "FFFFFFFF" : "FFF8F4F6";
      row.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        cell.alignment = { horizontal: "center" };
        cell.font = { size: 9 };
      });
    });

    wsC.columns = [
      { width: 12 }, { width: 7 },
      { width: 12 }, { width: 12 }, { width: 12 },
      { width: 8 }, { width: 8 }, { width: 18 },
    ];

    // Gráficos (mostrar mesmo com 1 leitura)
    if (leituras.length >= 1) {
      const startRow = leituras.length + 4;
      const CHART_ROW_H = 20;

      // Gráfico 1: Densidade
      const chartDataDens = leituras.map((l, idx) => ({
        x: idx + 1,
        xLabel: l.hora ? l.hora.substring(0, 5) : String(l.diaNr ?? idx + 1),
        series: [
          { label: "Densidade (g/cm³)", cor: CORES_HEX.densL1, valor: l.densL1 ? parseFloat(l.densL1) : null },
        ],
      }));
      const pngDens = gerarGraficoLinha({
        titulo: `Densidade — ${cuba.codigo.toUpperCase()} — ${cuba.nomeLote ?? "Sem nome"}`,
        dados: chartDataDens,
        unidade: "Densidade",
        largura: 750,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const imgId = (wb as any).addImage({ buffer: pngDens.buffer, extension: "png" }) as number;
      wsC.addImage(imgId, { tl: { col: 0, row: startRow }, ext: { width: 750, height: pngDens.height } });

      // Gráfico 2: Baumé (se tiver dados)
      const hasBaume = leituras.some((l) => l.baumeL1);
      let baumeOffset = 0;
      if (hasBaume) {
        const chartDataBaume = leituras.map((l, idx) => ({
          x: idx + 1,
          xLabel: l.hora ? l.hora.substring(0, 5) : String(l.diaNr ?? idx + 1),
          series: [
            { label: "Baumé (°Bé)", cor: "#f59e0b", valor: l.baumeL1 ? parseFloat(l.baumeL1) : null },
          ],
        }));
        const pngBaume = gerarGraficoLinha({
          titulo: `Baumé — ${cuba.codigo.toUpperCase()} — ${cuba.nomeLote ?? "Sem nome"}`,
          dados: chartDataBaume,
          unidade: "°",
          largura: 750,
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const imgBId = (wb as any).addImage({ buffer: pngBaume.buffer, extension: "png" }) as number;
        wsC.addImage(imgBId, { tl: { col: 0, row: startRow + CHART_ROW_H }, ext: { width: 750, height: pngBaume.height } });
        baumeOffset = CHART_ROW_H;
      }

      // Gráfico 3: Temperatura
      const chartDataT = leituras.map((l, idx) => ({
        x: idx + 1,
        xLabel: l.hora ? l.hora.substring(0, 5) : String(l.diaNr ?? idx + 1),
        series: [
          { label: "Temperatura (°C)", cor: CORES_HEX.tempL1, valor: l.tempL1 ? parseFloat(l.tempL1) : null },
        ],
      }));
      const pngTemp = gerarGraficoLinha({
        titulo: `Temperatura — ${cuba.codigo.toUpperCase()} — ${cuba.nomeLote ?? "Sem nome"}`,
        dados: chartDataT,
        unidade: "°C",
        largura: 750,
        linhaRef: cuba.tempPretendida
          ? { valor: parseFloat(cuba.tempPretendida), label: `Pretendida (${cuba.tempPretendida}°C)`, cor: "#1565c0" }
          : undefined,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const imgTId = (wb as any).addImage({ buffer: pngTemp.buffer, extension: "png" }) as number;
      wsC.addImage(imgTId, { tl: { col: 0, row: startRow + CHART_ROW_H + baumeOffset }, ext: { width: 750, height: pngTemp.height } });
    }

    // Adições no final da folha (se existirem)
    if (adicoes.length > 0) {
      const addRow = leituras.length + 40;
      const hdrA = wsC.getRow(addRow);
      const addRowData = ["Data", "Produto / Adição", "Dose", "Observações", "Por"];
      addRowData.forEach((v, i) => {
        const cell = hdrA.getCell(i + 1);
        cell.value = v;
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF5D1A2E" } };
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
        cell.alignment = { horizontal: "center" };
      });
      adicoes.forEach((a, idx) => {
        const r = wsC.getRow(addRow + 1 + idx);
        [
          new Date(a.dataAdicao).toLocaleDateString("pt-PT"),
          a.produto ?? "",
          a.dose ?? "",
          a.observacoes ?? "",
          a.userName ?? "",
        ].forEach((v, i) => {
          const cell = r.getCell(i + 1);
          cell.value = v;
          cell.font = { size: 9 };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: idx % 2 === 0 ? "FFFFFFFF" : "FFF8F4F6" } };
        });
      });
    }
  }

  // Adicionar folha de movimentos e recepções do dia
  const dataHojeMovimentos = new Date().toISOString().slice(0, 10);
  await adicionarFolhaMovimentos(wb, dataHojeMovimentos);

  return wb.xlsx.writeBuffer();
}

/** Adiciona folha de Movimentos e Recepções ao workbook do digest diário */
async function adicionarFolhaMovimentos(wb: ExcelJS.Workbook, dataHoje: string): Promise<void> {
  const movimentos = await getMovimentosHoje();
  const recepcoes = await getRecepcoesDoDia(dataHoje);

  if (movimentos.length === 0 && recepcoes.length === 0) return;

  const todasCubas = await getAllCubas();
  const cubaPorId = new Map(todasCubas.map((c) => [c.id, c]));

  const ws = wb.addWorksheet("Movimentos do Dia");

  ws.mergeCells("A1:F1");
  ws.getCell("A1").value = `Movimentos e Recepções — ${new Date(dataHoje + "T12:00:00").toLocaleDateString("pt-PT")}`;
  ws.getCell("A1").font = { bold: true, size: 13, color: { argb: "FF5D1A2E" } };
  ws.getCell("A1").alignment = { horizontal: "center" };
  ws.getRow(1).height = 22;

  let linha = 3;

  if (recepcoes.length > 0) {
    ws.mergeCells(`A${linha}:F${linha}`);
    ws.getCell(`A${linha}`).value = "RECEPÇÕES DE UVAS";
    ws.getCell(`A${linha}`).font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
    ws.getCell(`A${linha}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF5D1A2E" } };
    ws.getCell(`A${linha}`).alignment = { horizontal: "center" };
    linha++;

    const hdrR = ws.getRow(linha++);
    ["Data", "Casta", "Kg Totais", "Notas", "Registado por", ""].forEach((v, i) => {
      const cell = hdrR.getCell(i + 1);
      cell.value = v;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5E6E6" } };
      cell.font = { bold: true, size: 9 };
      cell.alignment = { horizontal: "center" };
    });

    for (const r of recepcoes) {
      const row = ws.getRow(linha++);
      [
        new Date(r.dataRecepcao + "T12:00:00").toLocaleDateString("pt-PT"),
        r.casta ?? "—",
        parseFloat(r.kgTotal).toLocaleString("pt-PT") + " kg",
        r.notas ?? "—",
        r.userName ?? "—",
        "",
      ].forEach((v, i) => { row.getCell(i + 1).value = v; row.getCell(i + 1).font = { size: 9 }; });
    }
    linha++;
  }

  if (movimentos.length > 0) {
    ws.mergeCells(`A${linha}:F${linha}`);
    ws.getCell(`A${linha}`).value = "MOVIMENTOS DE CUBA";
    ws.getCell(`A${linha}`).font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
    ws.getCell(`A${linha}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A3A5D" } };
    ws.getCell(`A${linha}`).alignment = { horizontal: "center" };
    linha++;

    const hdrM = ws.getRow(linha++);
    ["Tipo", "Data", "Origem(s)", "Destino", "Motivo", "Registado por"].forEach((v, i) => {
      const cell = hdrM.getCell(i + 1);
      cell.value = v;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6EEF5" } };
      cell.font = { bold: true, size: 9 };
      cell.alignment = { horizontal: "center" };
    });

    for (const m of movimentos) {
      let origemNomes = "—";
      try {
        const ids: number[] = JSON.parse(m.cubasOrigemIds);
        origemNomes = ids.map((id) => cubaPorId.get(id)?.codigo.toUpperCase() ?? `#${id}`).join(", ");
      } catch { /* ignorar */ }
      const destinoNome = m.cubaDestinoId != null ? (cubaPorId.get(m.cubaDestinoId)?.codigo.toUpperCase() ?? `#${m.cubaDestinoId}`) : (m.destinosJson ? (JSON.parse(m.destinosJson) as {cubaCodigo: string}[]).map((d) => d.cubaCodigo.toUpperCase()).join(", ") : "—");

      const row = ws.getRow(linha++);
      [
        m.tipo === "transferencia" ? "Transferência" : "Junção",
        new Date(m.dataMovimento + "T12:00:00").toLocaleDateString("pt-PT"),
        origemNomes,
        destinoNome,
        m.motivo ?? "—",
        m.userName ?? "—",
      ].forEach((v, i) => { row.getCell(i + 1).value = v; row.getCell(i + 1).font = { size: 9 }; });
    }
  }

  ws.columns = [
    { width: 14 }, { width: 12 }, { width: 22 }, { width: 12 }, { width: 30 }, { width: 18 },
  ];
}

// ── Envio via Resend ──────────────────────────────────────
export async function enviarEmailComExcel(params: {
  assunto: string;
  htmlBody: string;
  nomeAnexo: string;
  bufferExcel: ArrayBuffer | Buffer;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[Email] RESEND_API_KEY não configurada — email não enviado");
    return;
  }

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from: "Controlo Fermentação <onboarding@resend.dev>",
    to: TO_EMAIL,
    subject: params.assunto,
    html: params.htmlBody,
    attachments: [
      {
        filename: params.nomeAnexo,
        content: Buffer.isBuffer(params.bufferExcel)
          ? params.bufferExcel
          : Buffer.from(params.bufferExcel as ArrayBuffer),
      },
    ],
  });

  if (error) {
    console.error("[Email] Erro ao enviar via Resend:", error);
    throw new Error(`Resend error: ${JSON.stringify(error)}`);
  }

  console.log(`[Email] Enviado com sucesso: ${params.assunto} → ${TO_EMAIL}`);
}
