/**
 * pdfReport.ts
 * Gera um ficheiro PDF com ficha inicial, gráficos (canvas), tabela de leituras e adições.
 */

import PDFDocument from "pdfkit";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { getLeiturasByCuba, getAdicoesByCuba, getMovimentosByCuba, getAnalisesByCuba, getComentariosByCuba, getAlertasByCuba } from "./db";
import { fileURLToPath } from "url";
import { join, dirname } from "path";
import { readFileSync } from "fs";

// Registar fontes empacotadas no projecto via Buffer (funciona em produção sem depender do sistema de ficheiros)
try {
  const __dirname_pdf = dirname(fileURLToPath(import.meta.url));
  // Em produção o ficheiro compilado fica em dist/, as fontes em server/fonts/
  const candidates_pdf = [
    join(__dirname_pdf, "fonts"),
    join(__dirname_pdf, "../server/fonts"),
    join(process.cwd(), "server/fonts"),
  ];
  const FONT_DIR = candidates_pdf.find(d => {
    try { readFileSync(join(d, "NotoSans-Regular.ttf")); return true; } catch { return false; }
  }) ?? candidates_pdf[0];
  const regularBuf = readFileSync(join(FONT_DIR, "NotoSans-Regular.ttf"));
  const boldBuf = readFileSync(join(FONT_DIR, "NotoSans-Bold.ttf"));
  GlobalFonts.register(regularBuf, "Noto Sans");
  GlobalFonts.register(boldBuf, "Noto Sans");
  console.log("[Fonts PDF] Carregadas de:", FONT_DIR);
} catch (_e) {
  // Fallback: tentar caminhos do sistema
  try {
    GlobalFonts.registerFromPath("/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf", "Noto Sans");
    GlobalFonts.registerFromPath("/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf", "Noto Sans");
  } catch (_e2) { /* ignorar */ }
}

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
  densidadeLimite?: string | null;
};

// Cores
const COR_BORDO = "#5D1A2E";
const COR_ROXO = "#7C3AED";
const COR_CINZA = "#666666";

const CORES = {
  l1: "2e7d32",
  o2: "00838f",
  redox: "6a1b9a",
};

function formatVal(v: string | null | undefined, decimals = 4): string {
  if (!v) return "—";
  const n = parseFloat(v);
  return isNaN(n) ? v : n.toFixed(decimals);
}

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("pt-PT");
}

// ── Gerador de gráfico PNG ──────────────────────────────────
function gerarGraficoPng(params: {
  titulo: string;
  dados: { x: number; xLabel?: string; series: { label: string; cor: string; valor: number | null }[] }[];
  unidade?: string;
  marcadores?: { dia: number; index: number }[];
  linhaRef?: { valor: number; label: string; cor: string };
  largura?: number;
  altura?: number;
}): Buffer {
  const W = params.largura ?? 760;
  const nSeries = params.dados[0]?.series.length ?? 0;
  // Legenda lateral direita: largura fixa de 160px
  const LEGEND_W = 160;
  const H = (params.altura ?? 200) + 24; // apenas espaço para labels X
  const PAD = { top: 36, right: LEGEND_W + 10, bottom: 28, left: 62 };

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // Fundo branco
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // Título
  ctx.fillStyle = COR_BORDO;
  ctx.font = "bold 12px Noto Sans, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(params.titulo, PAD.left, 20);

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  // Domínio Y
  const allVals = params.dados.flatMap((d) =>
    d.series.map((s) => s.valor).filter((v): v is number => v !== null)
  );
  if (params.linhaRef) allVals.push(params.linhaRef.valor);

  if (allVals.length === 0) {
    ctx.fillStyle = "#999";
    ctx.font = "11px Noto Sans, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Sem dados", PAD.left + plotW / 2, PAD.top + plotH / 2);
    return canvas.toBuffer("image/png");
  }

  const rawMin = Math.min(...allVals);
  const rawMax = Math.max(...allVals);
  // Garantir escala mínima para que 1 único ponto seja visível
  const rangeMin = params.unidade === "m°C" || params.unidade === "°C" ? 2 :
    params.unidade === "mg/L" ? 0.5 :
    params.unidade === "mV" ? 20 :
    params.unidade === "°" ? 0.5 : 0.005;
  const mid = (rawMin + rawMax) / 2;
  const halfRange = Math.max((rawMax - rawMin) / 2, rangeMin);
  const yMin = mid - halfRange * 1.15;
  const yMax = mid + halfRange * 1.15;
  const xMin = params.dados[0]?.x ?? 0;
  const xMax = params.dados[params.dados.length - 1]?.x ?? 1;

  const toX = (x: number) => PAD.left + ((x - xMin) / Math.max(xMax - xMin, 1)) * plotW;
  const toY = (y: number) => PAD.top + plotH - ((y - yMin) / Math.max(yMax - yMin, 0.001)) * plotH;

  // Grelha e labels Y
  const decimais = params.unidade === "°C" || params.unidade === "mg/L" || params.unidade === "mV" || params.unidade === "°" ? 1 : 4;
  ctx.strokeStyle = "#e8e8e8";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = PAD.top + (i / 4) * plotH;
    ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(PAD.left + plotW, y); ctx.stroke();
    const val = yMax - (i / 4) * (yMax - yMin);
    ctx.fillStyle = "#666"; ctx.font = "9px Noto Sans, sans-serif"; ctx.textAlign = "right";
    ctx.fillText(val.toFixed(decimais), PAD.left - 4, y + 3);
  }

  // Labels X (usa xLabel se disponível, caso contrário o valor numérico)
  ctx.fillStyle = "#666"; ctx.font = "9px Noto Sans, sans-serif"; ctx.textAlign = "center";
  // Mostrar no máximo 12 labels para não sobrepor
  const step = Math.max(1, Math.ceil(params.dados.length / 12));
  params.dados.forEach((d, i) => {
    if (i % step !== 0 && i !== params.dados.length - 1) return;
    ctx.fillText(d.xLabel ?? String(d.x), toX(d.x), PAD.top + plotH + 10);
  });

  // Unidade Y
  if (params.unidade) {
    ctx.save();
    ctx.translate(12, PAD.top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center"; ctx.fillStyle = "#444"; ctx.font = "9px Noto Sans, sans-serif";
    ctx.fillText(params.unidade, 0, 0);
    ctx.restore();
  }

  // Marcadores de adições
  if (params.marcadores) {
    params.marcadores.forEach((m) => {
      const mx = toX(m.dia);
      ctx.save();
      ctx.strokeStyle = "#7c3aed"; ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(mx, PAD.top); ctx.lineTo(mx, PAD.top + plotH); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#7c3aed"; ctx.font = "bold 9px Noto Sans, sans-serif"; ctx.textAlign = "center";
      ctx.fillText(`▼${m.index}`, mx, PAD.top + 10);
      ctx.restore();
    });
  }

  // Linha de referência
  if (params.linhaRef) {
    const ry = toY(params.linhaRef.valor);
    ctx.save();
    ctx.strokeStyle = params.linhaRef.cor; ctx.lineWidth = 1.2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(PAD.left, ry); ctx.lineTo(PAD.left + plotW, ry); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // Séries
  for (let si = 0; si < nSeries; si++) {
    const cor = params.dados[0]?.series[si]?.cor ?? "888888";
    ctx.strokeStyle = "#" + cor; ctx.lineWidth = 1.8;
    ctx.beginPath();
    let started = false;
    params.dados.forEach((d) => {
      const v = d.series[si]?.valor;
      if (v == null) { started = false; return; }
      if (!started) { ctx.moveTo(toX(d.x), toY(v)); started = true; }
      else ctx.lineTo(toX(d.x), toY(v));
    });
    ctx.stroke();
    params.dados.forEach((d) => {
      const v = d.series[si]?.valor;
      if (v == null) return;
      ctx.fillStyle = "#" + cor;
      ctx.beginPath(); ctx.arc(toX(d.x), toY(v), 2.5, 0, Math.PI * 2); ctx.fill();
    });
  }

  // Legenda das séries — lateral direita
  const legendaX = W - LEGEND_W + 8;
  let legendaY = PAD.top + 4;
  for (let si = 0; si < nSeries; si++) {
    const label = params.dados[0]?.series[si]?.label ?? "";
    const cor = params.dados[0]?.series[si]?.cor ?? "888888";
    const ly = legendaY + si * 22;
    // Linha colorida
    ctx.strokeStyle = "#" + cor; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(legendaX, ly); ctx.lineTo(legendaX + 20, ly); ctx.stroke();
    // Ponto central
    ctx.fillStyle = "#" + cor;
    ctx.beginPath(); ctx.arc(legendaX + 10, ly, 4, 0, Math.PI * 2); ctx.fill();
    // Texto (com quebra de linha se necessário)
    ctx.fillStyle = "#111111"; ctx.font = "bold 10px Noto Sans, sans-serif"; ctx.textAlign = "left";
    ctx.fillText(label, legendaX + 26, ly + 4);
  }

  // Legenda da linha de referência — lateral direita, abaixo das séries
  if (params.linhaRef) {
    const ly = legendaY + nSeries * 22 + 6;
    ctx.save();
    ctx.strokeStyle = params.linhaRef.cor; ctx.lineWidth = 1.8;
    ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.moveTo(legendaX, ly); ctx.lineTo(legendaX + 20, ly); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    // Texto da referência (pode ser longo — quebrar em 2 linhas)
    const refLabel = params.linhaRef.label;
    const maxW = LEGEND_W - 32;
    ctx.fillStyle = "#111111"; ctx.font = "bold 9px Noto Sans, sans-serif"; ctx.textAlign = "left";
    // Dividir em palavras e desenhar em até 2 linhas
    const words = refLabel.split(" ");
    let line1 = ""; let line2 = "";
    for (const w of words) {
      const test = line1 ? line1 + " " + w : w;
      if (ctx.measureText(test).width <= maxW) { line1 = test; }
      else { line2 = line2 ? line2 + " " + w : w; }
    }
    ctx.fillText(line1, legendaX + 26, ly + 3);
    if (line2) ctx.fillText(line2, legendaX + 26, ly + 14);
  }

  return canvas.toBuffer("image/png");
}

export async function gerarPdfCuba(cuba: CubaInfo): Promise<Buffer> {
  const leituras = (await getLeiturasByCuba(cuba.id, cuba.fermentacaoNum)) as LeituraRow[];
  const adicoes = (await getAdicoesByCuba(cuba.id, cuba.fermentacaoNum)) as AdicaoRow[];
  const movimentos = await getMovimentosByCuba(cuba.id);
  const analises = await getAnalisesByCuba(cuba.id);
  const comentarios = await getComentariosByCuba(cuba.id);
  const alertasHist = await getAlertasByCuba(cuba.id);

  const isPorto = cuba.tipoCuba === "porto";

  // Calcular marcadores de adições para os gráficos
  const marcadoresGrafico = adicoes.map((a, idx) => {
    const dataAdicao = new Date(a.dataAdicao).getTime();
    let diaProximo = 0;
    let menorDiff = Infinity;
    leituras.forEach((l) => {
      const diff = Math.abs(new Date(l.dataLeitura).getTime() - dataAdicao);
      if (diff < menorDiff) { menorDiff = diff; diaProximo = l.diaNr ?? 0; }
    });
    return { dia: diaProximo, index: idx + 1 };
  });

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

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4", layout: "landscape" });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width;
    const MARGIN = 40;
    const CONTENT_W = W - MARGIN * 2;

    // ── Cabeçalho ──────────────────────────────────────────
    doc.fillColor(COR_BORDO).fontSize(16).font("Helvetica-Bold")
      .text(`${cuba.codigo.toUpperCase()} — ${cuba.nomeLote ?? "Sem nome"}`, MARGIN, MARGIN);

    doc.fontSize(10).font("Helvetica").fillColor(COR_CINZA)
      .text(`Fermentação Nº ${cuba.fermentacaoNum}  |  Gerado em: ${new Date().toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" })}`, MARGIN, MARGIN + 22);

    if (cuba.tempPretendida) {
      doc.fillColor("#1565C0").fontSize(9)
        .text(`Temperatura pretendida: ${cuba.tempPretendida}°C`, MARGIN, MARGIN + 36);
    }
    if (isPorto && cuba.pontoAguardentacao) {
      doc.fillColor("#e53935").fontSize(9)
        .text(`Ponto de aguardentação: ${cuba.pontoAguardentacao}° Baumé`, MARGIN, MARGIN + (cuba.tempPretendida ? 48 : 36));
    }

    let y = MARGIN + 58;

    // ── Ficha Inicial ───────────────────────────────────────────────────────────
    const temFicha = cuba.fichaKilos || cuba.fichaLitros || cuba.fichaPh || cuba.fichaAt ||
      cuba.fichaAv || cuba.fichaNfa || cuba.fichaNtu || cuba.fichaGluconico || cuba.fichaAlcoolProvavel;

    // Secção de configurações sempre visível na página 1
    {
      const configFields: [string, string][] = [
        ["Código", cuba.codigo.toUpperCase()],
        ["Tipo", cuba.tipoCuba === "porto" ? "Vinho do Porto (Baumé)" : "Ferment. Normal (Densidade)"],
        ["Nº Fermentação", String(cuba.fermentacaoNum)],
        ["Estado", cuba.estado === "completa" ? "Terminada" : cuba.estado === "em_fermentacao" ? "Em Fermentação" : cuba.estado],
        ["Temp. Pretendida", cuba.tempPretendida ? `${cuba.tempPretendida}°C` : "—"],
        ...(cuba.tipoCuba === "porto" && cuba.pontoAguardentacao
          ? [["Ponto Aguardentação", `${cuba.pontoAguardentacao}° Baumé`] as [string, string]]
          : []),
      ];

      doc.rect(MARGIN, y, CONTENT_W, 16).fill(COR_BORDO);
      doc.fillColor("#FFFFFF").fontSize(9).font("Helvetica-Bold")
        .text("INFORMAÇÕES DA CUBA", MARGIN, y + 3, { width: CONTENT_W, align: "center" });
      y += 18;

      const colW2 = CONTENT_W / configFields.length;
      doc.rect(MARGIN, y, CONTENT_W, 14).fill("#FDF0F3");
      configFields.forEach(([label], i) => {
        doc.fillColor(COR_BORDO).fontSize(7).font("Helvetica-Bold")
          .text(label, MARGIN + i * colW2, y + 3, { width: colW2, align: "center" });
      });
      y += 14;

      doc.rect(MARGIN, y, CONTENT_W, 14).fill("#FFFFFF");
      configFields.forEach(([, val], i) => {
        doc.fillColor("#333333").fontSize(8).font("Helvetica")
          .text(val, MARGIN + i * colW2, y + 3, { width: colW2, align: "center" });
      });
      y += 20;
    }

    if (temFicha) {
      doc.fillColor("#FFFFFF").rect(MARGIN, y, CONTENT_W, 16).fill(COR_BORDO);
      doc.fillColor("#FFFFFF").fontSize(9).font("Helvetica-Bold")
        .text("FICHA INICIAL", MARGIN, y + 3, { width: CONTENT_W, align: "center" });
      y += 18;

      const fichaFields: [string, string | null][] = [
        ["Kilos", cuba.fichaKilos],
        ["Litros", cuba.fichaLitros],
        ["pH", cuba.fichaPh],
        ["AT (g/L)", cuba.fichaAt],
        ["AV (g/L)", cuba.fichaAv],
        ["NFA (mg/L)", cuba.fichaNfa],
        ["NTU", cuba.fichaNtu],
        ["Glucónico (g/L)", cuba.fichaGluconico],
        ["Álcool Provável (%)", cuba.fichaAlcoolProvavel],
      ];

      const colW = CONTENT_W / fichaFields.length;
      doc.rect(MARGIN, y, CONTENT_W, 14).fill("#FDF0F3");
      fichaFields.forEach(([label], i) => {
        doc.fillColor(COR_BORDO).fontSize(7).font("Helvetica-Bold")
          .text(label, MARGIN + i * colW, y + 3, { width: colW, align: "center" });
      });
      y += 14;

      doc.rect(MARGIN, y, CONTENT_W, 14).fill("#FFFFFF");
      fichaFields.forEach(([, val], i) => {
        doc.fillColor("#333333").fontSize(8).font("Helvetica")
          .text(val ?? "—", MARGIN + i * colW, y + 3, { width: colW, align: "center" });
      });
      y += 20;
    }

    // ── Gráficos ───────────────────────────────────────────
    if (chartData.length > 0) {
      // Só adicionar nova página se não há espaço suficiente na página actual
      const CHART_H_NEEDED = 220; // altura mínima necessária para um gráfico
      if (y + CHART_H_NEEDED > doc.page.height - 50) {
        doc.addPage({ size: "A4", layout: "landscape" });
        y = MARGIN;
      }

      // Título da secção de gráficos
      doc.rect(MARGIN, y, CONTENT_W, 16).fill(COR_BORDO);
      doc.fillColor("#FFFFFF").fontSize(9).font("Helvetica-Bold")
        .text("GRÁFICOS", MARGIN, y + 3, { width: CONTENT_W, align: "center" });
      y += 20;

      const CHART_W = CONTENT_W;
      const CHART_H_PX = 200; // altura do plot em px canvas
      // O canvas é gerado com a mesma largura do PDF (1:1) para que a legenda lateral não fique cortada
      const CANVAS_W = Math.round(CHART_W); // mesma largura que o PDF
      const CHART_H_PDF = 200; // altura no PDF em pontos (inclui legenda)

      // Gráfico 1: Densidade / Baumé
      const pngDens = isPorto
        ? gerarGraficoPng({
            titulo: `Baumé (°) — ${cuba.codigo.toUpperCase()}`,
            unidade: "°",
            marcadores: marcadoresGrafico,
            linhaRef: cuba.pontoAguardentacao
              ? { valor: parseFloat(cuba.pontoAguardentacao), label: `Ponto aguardentação (${cuba.pontoAguardentacao}°)`, cor: "#e53935" }
              : undefined,
            dados: chartData.map((d) => ({
              x: d.x,
              xLabel: d.xLabel,
              series: [
                { label: "Baumé", cor: CORES.l1, valor: d.baumeL1 },
              ],
            })),
            largura: CANVAS_W,
            altura: CHART_H_PX,
          })
        : gerarGraficoPng({
            titulo: `Densidade — ${cuba.codigo.toUpperCase()}`,
            unidade: "Densidade",
            marcadores: marcadoresGrafico,
            dados: chartData.map((d) => ({
              x: d.x,
              xLabel: d.xLabel,
              series: [
                { label: "Densidade", cor: CORES.l1, valor: d.densL1 },
              ],
            })),
            largura: CANVAS_W,
            altura: CHART_H_PX,
          });

      doc.image(pngDens, MARGIN, y, { width: CHART_W, height: CHART_H_PDF });
      y += CHART_H_PDF + 10;

      // Gráfico 2: Temperatura
      const pngTemp = gerarGraficoPng({
        titulo: `Temperatura (°C) — ${cuba.codigo.toUpperCase()}`,
        unidade: "°C",
        marcadores: marcadoresGrafico,
        linhaRef: cuba.tempPretendida
          ? { valor: parseFloat(cuba.tempPretendida), label: `Temp. pretendida (${cuba.tempPretendida}°C)`, cor: "#1565c0" }
          : undefined,
        dados: chartData.map((d) => ({
          x: d.x,
          xLabel: d.xLabel,
          series: [
            { label: "Temperatura", cor: CORES.l1, valor: d.tempL1 },
          ],
        })),
        largura: CANVAS_W,
        altura: CHART_H_PX,
      });

      doc.image(pngTemp, MARGIN, y, { width: CHART_W, height: CHART_H_PDF });
      y += CHART_H_PDF + 10;

      // Gráfico 3: O₂ (se tiver dados)
      const hasO2 = chartData.some((d) => d.o2 !== null);
      if (hasO2) {
        if (y + CHART_H_PDF > doc.page.height - 50) {
          doc.addPage({ size: "A4", layout: "landscape" }); y = MARGIN;
        }
        const pngO2 = gerarGraficoPng({
          titulo: `O₂ Dissolvido (mg/L) — ${cuba.codigo.toUpperCase()}`,
          unidade: "mg/L",
          marcadores: marcadoresGrafico,
          dados: chartData.map((d) => ({
            x: d.x,
            xLabel: d.xLabel,
            series: [{ label: "O₂ Dissolvido", cor: CORES.o2, valor: d.o2 }],
          })),
          largura: CANVAS_W,
          altura: CHART_H_PX,
        });
        doc.image(pngO2, MARGIN, y, { width: CHART_W, height: CHART_H_PDF });
        y += CHART_H_PDF + 10;
      }

      // Gráfico 4: Redox (se tiver dados)
      const hasRedox = chartData.some((d) => d.redox !== null);
      if (hasRedox) {
        if (y + CHART_H_PDF > doc.page.height - 50) {
          doc.addPage({ size: "A4", layout: "landscape" }); y = MARGIN;
        }
        const pngRedox = gerarGraficoPng({
          titulo: `Potencial Redox (mV) — ${cuba.codigo.toUpperCase()}`,
          unidade: "mV",
          marcadores: marcadoresGrafico,
          dados: chartData.map((d) => ({
            x: d.x,
            xLabel: d.xLabel,
            series: [{ label: "Potencial Redox", cor: CORES.redox, valor: d.redox }],
          })),
          largura: CANVAS_W,
          altura: CHART_H_PX,
        });
        doc.image(pngRedox, MARGIN, y, { width: CHART_W, height: CHART_H_PDF });
        y += CHART_H_PDF + 10;
      }
    }

    // ── Tabela de Leituras ─────────────────────────────────
    if (leituras.length > 0) {
      doc.addPage({ size: "A4", layout: "landscape" });
      y = MARGIN;

      doc.rect(MARGIN, y, CONTENT_W, 16).fill(COR_BORDO);
      doc.fillColor("#FFFFFF").fontSize(9).font("Helvetica-Bold")
        .text("LEITURAS DE FERMENTAÇÃO", MARGIN, y + 3, { width: CONTENT_W, align: "center" });
      y += 18;

      const cols = isPorto
        ? [
            { header: "Data", width: 65 },
            { header: "Dia", width: 30 },
            { header: "Baumé", width: 55 },
            { header: "Temperatura", width: 55 },
            { header: "O₂", width: 40 },
            { header: "Redox", width: 45 },
            { header: "Utilizador", width: 0 },
          ]
        : [
            { header: "Data", width: 65 },
            { header: "Dia", width: 30 },
            { header: "Densidade", width: 60 },
            { header: "Temperatura", width: 55 },
            { header: "O₂", width: 40 },
            { header: "Redox", width: 45 },
            { header: "Utilizador", width: 0 },
          ];

      const totalFixed = cols.slice(0, -1).reduce((s, c) => s + c.width, 0);
      cols[cols.length - 1].width = Math.max(CONTENT_W - totalFixed, 60);

      // Cabeçalho da tabela
      doc.rect(MARGIN, y, CONTENT_W, 14).fill("#F3E8FF");
      let cx = MARGIN;
      cols.forEach((col) => {
        doc.fillColor(COR_ROXO).fontSize(7).font("Helvetica-Bold")
          .text(col.header, cx + 2, y + 3, { width: col.width - 4, align: "center" });
        cx += col.width;
      });
      y += 14;

      leituras.forEach((l, idx) => {
        const rowH = 13;
        if (y + rowH > doc.page.height - 50) {
          doc.addPage({ size: "A4", layout: "landscape" });
          y = MARGIN;
        }
        const bg = idx % 2 === 0 ? "#FFFFFF" : "#F8F4F6";
        doc.rect(MARGIN, y, CONTENT_W, rowH).fill(bg);

        const vals = isPorto
          ? [
              formatDate(l.dataLeitura),
              String(l.diaNr ?? ""),
              formatVal(l.baumeL1, 1),
              formatVal(l.tempL1, 1),
              formatVal(l.o2, 2),
              formatVal(l.redox, 0),
              l.editedAt && l.editedByName ? `${l.userName ?? ""} ✏ ${l.editedByName}` : (l.userName ?? ""),
            ]
          : [
              formatDate(l.dataLeitura),
              String(l.diaNr ?? ""),
              formatVal(l.densL1),
              formatVal(l.tempL1, 1),
              formatVal(l.o2, 2),
              formatVal(l.redox, 0),
              l.editedAt && l.editedByName ? `${l.userName ?? ""} ✏ ${l.editedByName}` : (l.userName ?? ""),
            ];

        cx = MARGIN;
        vals.forEach((v, i) => {
          doc.fillColor("#333333").fontSize(7).font("Helvetica")
            .text(v, cx + 2, y + 3, { width: cols[i].width - 4, align: i < 2 ? "center" : "right", lineBreak: false });
          cx += cols[i].width;
        });
        y += rowH;
      });

      y += 10;
    }

    // ── Adições e Notas ────────────────────────────────────
    if (adicoes.length > 0) {
      if (y + 60 > doc.page.height - 50) {
        doc.addPage({ size: "A4", layout: "landscape" });
        y = MARGIN;
      }

      doc.rect(MARGIN, y, CONTENT_W, 16).fill(COR_BORDO);
      doc.fillColor("#FFFFFF").fontSize(9).font("Helvetica-Bold")
        .text("ADIÇÕES E NOTAS", MARGIN, y + 3, { width: CONTENT_W, align: "center" });
      y += 18;

      const addCols = [
        { header: "Nº", width: 24 },
        { header: "Data", width: 55 },
        { header: "Produto / Adição", width: 140 },
        { header: "Dose", width: 70 },
        { header: "Observações", width: 0 },
        { header: "Por", width: 80 },
      ];
      const totalAddFixed = addCols.filter((_, i) => i !== 4).reduce((s, c) => s + c.width, 0);
      addCols[4].width = Math.max(CONTENT_W - totalAddFixed, 80);

      doc.rect(MARGIN, y, CONTENT_W, 14).fill("#F3E8FF");
      let ax = MARGIN;
      addCols.forEach((col) => {
        doc.fillColor(COR_ROXO).fontSize(7).font("Helvetica-Bold")
          .text(col.header, ax + 2, y + 3, { width: col.width - 4, align: "center" });
        ax += col.width;
      });
      y += 14;

      adicoes.forEach((a, idx) => {
        const rowH = 13;
        if (y + rowH > doc.page.height - 50) {
          doc.addPage({ size: "A4", layout: "landscape" });
          y = MARGIN;
        }
        const bg = idx % 2 === 0 ? "#FFFFFF" : "#F3EEFF";
        doc.rect(MARGIN, y, CONTENT_W, rowH).fill(bg);

        const vals = [
          `▼${idx + 1}`,
          formatDate(a.dataAdicao),
          a.produto ?? "",
          a.dose ?? "",
          a.observacoes ?? "",
          a.userName ?? "",
        ];

        ax = MARGIN;
        vals.forEach((v, i) => {
          const isNum = i === 0;
          doc.fillColor(isNum ? COR_ROXO : "#333333")
            .fontSize(7).font(isNum ? "Helvetica-Bold" : "Helvetica")
            .text(v, ax + 2, y + 3, { width: addCols[i].width - 4, align: isNum ? "center" : "left", lineBreak: false });
          ax += addCols[i].width;
        });
        y += rowH;
      });
    }

    // ── Movimentos / Rastreabilidade ───────────────────────
    if (movimentos.length > 0) {
      if (y + 60 > doc.page.height - 50) {
        doc.addPage({ size: "A4", layout: "landscape" });
        y = MARGIN;
      }
      doc.rect(MARGIN, y, CONTENT_W, 16).fill("#1565C0");
      doc.fillColor("#FFFFFF").fontSize(9).font("Helvetica-Bold")
        .text("MOVIMENTOS / RASTREABILIDADE", MARGIN, y + 3, { width: CONTENT_W, align: "center" });
      y += 18;

      const movCols = [
        { header: "Data", width: 60 },
        { header: "Tipo", width: 70 },
        { header: "Sentido", width: 55 },
        { header: "Cuba(s) Origem", width: 120 },
        { header: "Cuba(s) Destino", width: 120 },
        { header: "Litros", width: 55 },
        { header: "Notas", width: 0 },
      ];
      const totalMovFixed = movCols.filter((_, i) => i !== 6).reduce((s, c) => s + c.width, 0);
      movCols[6].width = Math.max(CONTENT_W - totalMovFixed, 60);

      doc.rect(MARGIN, y, CONTENT_W, 14).fill("#E3F2FD");
      let mx2 = MARGIN;
      movCols.forEach((col) => {
        doc.fillColor("#1565C0").fontSize(7).font("Helvetica-Bold")
          .text(col.header, mx2 + 2, y + 3, { width: col.width - 4, align: "center" });
        mx2 += col.width;
      });
      y += 14;

      movimentos.forEach((m, idx) => {
        const rowH = 13;
        if (y + rowH > doc.page.height - 50) {
          doc.addPage({ size: "A4", layout: "landscape" });
          y = MARGIN;
        }
        const bg = idx % 2 === 0 ? "#FFFFFF" : "#EBF5FB";
        doc.rect(MARGIN, y, CONTENT_W, rowH).fill(bg);

        // Determinar sentido
        let origens: number[] = [];
        try { origens = JSON.parse(m.cubasOrigemIds); } catch { origens = []; }
        const isDestino = m.cubaDestinoId === cuba.id;
        const sentido = isDestino ? "↓ Entrada" : "↑ Saída";

        // Destinos (pode ser JSON com múltiplos)
        let destinosStr = "";
        try {
          const destinos = JSON.parse(m.destinosJson ?? "[]") as { cubaCodigo: string; litros: number }[];
          destinosStr = destinos.map(d => `${d.cubaCodigo} (${d.litros}L)`).join(", ");
        } catch { destinosStr = m.cubaDestinoId ? String(m.cubaDestinoId) : "—"; }

        const vals = [
          m.dataMovimento ?? "—",
          m.tipo === "transferencia" ? "Transferência" : "Junção",
          sentido,
          (m as any).cubasOrigemCodigos || origens.join(", ") || "—",
          destinosStr || "—",
          (() => { try { const d = JSON.parse(m.destinosJson ?? "[]") as {litros:number}[]; const tot = d.reduce((s,x)=>s+x.litros,0); return tot > 0 ? `${tot} L` : "—"; } catch { return "—"; } })(),
          m.motivo ?? "",
        ];

        mx2 = MARGIN;
        vals.forEach((v, i) => {
          doc.fillColor(i === 2 ? (isDestino ? "#1565C0" : "#c62828") : "#333333")
            .fontSize(7).font("Helvetica")
            .text(String(v), mx2 + 2, y + 3, { width: movCols[i].width - 4, align: "left", lineBreak: false });
          mx2 += movCols[i].width;
        });
        y += rowH;
      });
      y += 6;
    }

    // ── Histórico de Análises ──────────────────────────────
    if (analises.length > 0) {
      if (y + 60 > doc.page.height - 50) {
        doc.addPage({ size: "A4", layout: "landscape" });
        y = MARGIN;
      }
      doc.rect(MARGIN, y, CONTENT_W, 16).fill("#2E7D32");
      doc.fillColor("#FFFFFF").fontSize(9).font("Helvetica-Bold")
        .text("HISTÓRICO DE ANÁLISES", MARGIN, y + 3, { width: CONTENT_W, align: "center" });
      y += 18;

      const anCols = [
        { header: "Data", width: 60 },
        { header: "Litros", width: 50 },
        { header: "pH", width: 35 },
        { header: "AT (g/L)", width: 45 },
        { header: "AV (g/L)", width: 45 },
        { header: "NFA (mg/L)", width: 50 },
        { header: "NTU", width: 40 },
        { header: "Glucónico", width: 50 },
        { header: "Álcool (%)", width: 50 },
        { header: "Por", width: 0 },
      ];
      const totalAnFixed = anCols.filter((_, i) => i !== 9).reduce((s, c) => s + c.width, 0);
      anCols[9].width = Math.max(CONTENT_W - totalAnFixed, 60);

      doc.rect(MARGIN, y, CONTENT_W, 14).fill("#E8F5E9");
      let anx = MARGIN;
      anCols.forEach((col) => {
        doc.fillColor("#2E7D32").fontSize(7).font("Helvetica-Bold")
          .text(col.header, anx + 2, y + 3, { width: col.width - 4, align: "center" });
        anx += col.width;
      });
      y += 14;

      analises.forEach((a, idx) => {
        const rowH = 13;
        if (y + rowH > doc.page.height - 50) {
          doc.addPage({ size: "A4", layout: "landscape" });
          y = MARGIN;
        }
        const bg = idx % 2 === 0 ? "#FFFFFF" : "#F1F8E9";
        doc.rect(MARGIN, y, CONTENT_W, rowH).fill(bg);
        const vals = [
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
        ];
        anx = MARGIN;
        vals.forEach((v, i) => {
          doc.fillColor("#333333").fontSize(7).font("Helvetica")
            .text(String(v), anx + 2, y + 3, { width: anCols[i].width - 4, align: i === 0 || i === 9 ? "left" : "center", lineBreak: false });
          anx += anCols[i].width;
        });
        y += rowH;
      });
      y += 6;
    }

    // ── Comentários ────────────────────────────────────────
    if (comentarios.length > 0) {
      if (y + 60 > doc.page.height - 50) {
        doc.addPage({ size: "A4", layout: "landscape" });
        y = MARGIN;
      }
      doc.rect(MARGIN, y, CONTENT_W, 16).fill("#4A148C");
      doc.fillColor("#FFFFFF").fontSize(9).font("Helvetica-Bold")
        .text("COMENTÁRIOS", MARGIN, y + 3, { width: CONTENT_W, align: "center" });
      y += 18;

      comentarios.forEach((c, idx) => {
        const rowH = 30;
        if (y + rowH > doc.page.height - 50) {
          doc.addPage({ size: "A4", layout: "landscape" });
          y = MARGIN;
        }
        const bg = idx % 2 === 0 ? "#FFFFFF" : "#F3E5F5";
        doc.rect(MARGIN, y, CONTENT_W, rowH).fill(bg);
        const data = c.createdAt ? new Date(c.createdAt).toLocaleString("pt-PT", { timeZone: "Europe/Lisbon", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
        const autor = c.userName ?? "—";
        const herdado = c.herdadoDe ? ` [Herdado de ${c.herdadoDe}]` : "";
        doc.fillColor("#666666").fontSize(7).font("Helvetica")
          .text(`${data} · ${autor}${herdado}`, MARGIN + 4, y + 4, { width: CONTENT_W - 8, lineBreak: false });
        doc.fillColor("#333333").fontSize(8).font("Helvetica")
          .text(c.texto, MARGIN + 4, y + 14, { width: CONTENT_W - 8, lineBreak: false });
        y += rowH;
      });
      y += 6;
    }

    // ── Histórico de Alertas ──────────────────────────────────
    if (alertasHist.length > 0) {
      if (y + 60 > doc.page.height - 50) {
        doc.addPage({ size: "A4", layout: "landscape" });
        y = MARGIN;
      }
      doc.rect(MARGIN, y, CONTENT_W, 16).fill("#B71C1C");
      doc.fillColor("#FFFFFF").fontSize(9).font("Helvetica-Bold")
        .text("HISTÓRICO DE ALERTAS", MARGIN, y + 3, { width: CONTENT_W, align: "center" });
      y += 18;
      const alertaCols = [{ w: 90, label: "Data" }, { w: 100, label: "Tipo" }, { w: 70, label: "Valor" }, { w: 100, label: "Reconhecido em" }, { w: 80, label: "Por" }];
      let ax = MARGIN;
      alertaCols.forEach(col => {
        doc.rect(ax, y, col.w, 14).fill("#FFCDD2");
        doc.fillColor("#B71C1C").fontSize(7).font("Helvetica-Bold").text(col.label, ax + 2, y + 3, { width: col.w - 4, lineBreak: false });
        ax += col.w;
      });
      y += 14;
      alertasHist.forEach((a, idx) => {
        const rowH = 14;
        if (y + rowH > doc.page.height - 50) {
          doc.addPage({ size: "A4", layout: "landscape" });
          y = MARGIN;
        }
        const bg = idx % 2 === 0 ? "#FFFFFF" : "#FFEBEE";
        const data = a.criadoEm ? new Date(a.criadoEm).toLocaleString("pt-PT", { timeZone: "Europe/Lisbon", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
        const recEm = a.reconhecidoEm ? new Date(a.reconhecidoEm).toLocaleString("pt-PT", { timeZone: "Europe/Lisbon", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Por reconhecer";
        const vals = [data, a.tipoAlerta.replace(/_/g, " "), a.valorAlerta ?? "—", recEm, a.reconhecidoPorNome ?? "—"];
        let vx = MARGIN;
        alertaCols.forEach((col, ci) => {
          doc.rect(vx, y, col.w, rowH).fill(bg);
          const textColor = ci === 3 && !a.reconhecidoEm ? "#B71C1C" : "#333333";
          doc.fillColor(textColor).fontSize(7).font("Helvetica").text(vals[ci], vx + 2, y + 3, { width: col.w - 4, lineBreak: false });
          vx += col.w;
        });
        y += rowH;
      });
      y += 6;
    }

    // ── Rodapé ─────────────────────────────────────────────
    const pageH = doc.page.height;
    doc.fillColor(COR_CINZA).fontSize(7).font("Helvetica")
      .text(
        `Controlo de Fermentação Vinícola — ${cuba.codigo.toUpperCase()} — Fermentação Nº ${cuba.fermentacaoNum}`,
        MARGIN, pageH - 25, { width: CONTENT_W, align: "center" }
      );

    doc.end();
  });
}

// ── PDF Dashboard — Todas as Cubas Activas ─────────────────
export async function gerarPdfDashboard(): Promise<Buffer> {
  const { getAllCubas } = await import("./db");
  const todasCubas = (await getAllCubas()) as CubaInfo[];
  const cubasAtivas = todasCubas.filter((c) => c.estado === "em_fermentacao");

  return new Promise(async (resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4", layout: "landscape" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width;
    const MARGIN = 40;
    const CONTENT_W = W - MARGIN * 2;
    const dataHoje = new Date().toLocaleDateString("pt-PT", { timeZone: "Europe/Lisbon" });

    // ── Capa ──────────────────────────────────────────────
    doc.rect(MARGIN, MARGIN, CONTENT_W, 50).fill(COR_BORDO);
    doc.fillColor("#FFFFFF").fontSize(18).font("Helvetica-Bold")
      .text("CONTROLO DE FERMENTAÇÃO VINÍCOLA", MARGIN, MARGIN + 8, { width: CONTENT_W, align: "center" });
    doc.fillColor("#FFFFFF").fontSize(11).font("Helvetica")
      .text(`Relatório Dashboard — ${dataHoje} — ${cubasAtivas.length} cuba(s) em fermentação`, MARGIN, MARGIN + 30, { width: CONTENT_W, align: "center" });

    let y = MARGIN + 65;

    if (cubasAtivas.length === 0) {
      doc.fillColor(COR_CINZA).fontSize(12).font("Helvetica")
        .text("Sem cubas em fermentação activa.", MARGIN, y, { width: CONTENT_W, align: "center" });
      doc.end();
      return;
    }

    for (let ci = 0; ci < cubasAtivas.length; ci++) {
      const cuba = cubasAtivas[ci];
      const isPorto = cuba.tipoCuba === "porto";
      const leituras = (await getLeiturasByCuba(cuba.id, cuba.fermentacaoNum)) as LeituraRow[];
      const adicoes = (await getAdicoesByCuba(cuba.id, cuba.fermentacaoNum)) as AdicaoRow[];

      // Nova página para cada cuba (excepto a primeira)
      if (ci > 0) {
        doc.addPage({ size: "A4", layout: "landscape" });
        y = MARGIN;
      }

      // ── Cabeçalho da cuba ──────────────────────────────
      doc.rect(MARGIN, y, CONTENT_W, 22).fill(COR_BORDO);
      doc.fillColor("#FFFFFF").fontSize(12).font("Helvetica-Bold")
        .text(
          `${cuba.codigo.toUpperCase()}${cuba.nomeLote ? ` — ${cuba.nomeLote}` : ""} — Fermentação Nº ${cuba.fermentacaoNum}`,
          MARGIN + 8, y + 5, { width: CONTENT_W - 16, align: "left" }
        );
      y += 26;

      // ── Resumo rápido ──────────────────────────────────
      const densMin = leituras.length > 0
        ? Math.min(...leituras.map((l) => parseFloat(isPorto ? (l.baumeL1 ?? "999") : (l.densL1 ?? "999"))).filter((v) => v < 999))
        : null;
      const tempMax = leituras.length > 0
        ? Math.max(...leituras.map((l) => parseFloat(l.tempL1 ?? "0")).filter((v) => v > 0))
        : null;

      const resumoItems = [
        `Leituras: ${leituras.length}`,
        `Adições: ${adicoes.length}`,
        densMin !== null ? `${isPorto ? "Baumé mín." : "Dens. mín."}: ${densMin.toFixed(isPorto ? 1 : 4)}` : null,
        tempMax !== null ? `Temp. máx.: ${tempMax.toFixed(1)}°C` : null,
        cuba.tempPretendida ? `Temp. pretendida: ${cuba.tempPretendida}°C` : null,
        cuba.densidadeLimite ? `Limite: ${parseFloat(cuba.densidadeLimite).toFixed(isPorto ? 1 : 3)}` : null,
      ].filter(Boolean) as string[];

      doc.fillColor(COR_CINZA).fontSize(8).font("Helvetica");
      const colW = CONTENT_W / resumoItems.length;
      resumoItems.forEach((item, i) => {
        doc.text(item, MARGIN + i * colW, y, { width: colW, align: "center" });
      });
      y += 14;

      // ── Gráficos ───────────────────────────────────────
      if (leituras.length > 1) {
        const marcadoresGrafico = adicoes.map((a, idx) => {
          const dataAdicao = new Date(a.dataAdicao).getTime();
          let diaProximo = 0;
          let menorDiff = Infinity;
          leituras.forEach((l) => {
            const diff = Math.abs(new Date(l.dataLeitura).getTime() - dataAdicao);
            if (diff < menorDiff) { menorDiff = diff; diaProximo = l.diaNr ?? 0; }
          });
          return { dia: diaProximo, index: idx + 1 };
        });

        const chartData = leituras.map((l, idx) => ({
          x: idx,
          xLabel: l.hora ? l.hora.substring(0, 5) : String(l.diaNr ?? idx),
          densL1: l.densL1 ? parseFloat(l.densL1) : null,
          baumeL1: l.baumeL1 ? parseFloat(l.baumeL1) : null,
          tempL1: l.tempL1 ? parseFloat(l.tempL1) : null,
        }));

        const CHART_W = CONTENT_W;
        const CHART_H = 130;

        // Gráfico Densidade/Baumé
        const graficoDens = gerarGraficoPng({
          titulo: isPorto ? "Baumé" : "Densidade",
          dados: chartData.map((d) => ({
            x: d.x,
            xLabel: d.xLabel,
            series: [{ label: isPorto ? "Baumé" : "Densidade", cor: CORES.l1, valor: isPorto ? d.baumeL1 : d.densL1 }],
          })),
          unidade: isPorto ? "°Bé" : "",
          marcadores: marcadoresGrafico,
          linhaRef: cuba.tempPretendida && !isPorto ? undefined :
            (cuba.pontoAguardentacao && isPorto ? {
              valor: parseFloat(cuba.pontoAguardentacao),
              label: `Aguardentação (${cuba.pontoAguardentacao}°Bé)`,
              cor: "#E53E3E",
            } : undefined),
          largura: CHART_W,
          altura: CHART_H,
        });

        if (y + CHART_H + 24 > doc.page.height - 50) {
          doc.addPage({ size: "A4", layout: "landscape" });
          y = MARGIN;
        }
        doc.image(graficoDens, MARGIN, y, { width: CHART_W });
        y += CHART_H + 24 + 8;

        // Gráfico Temperatura
        const graficoTemp = gerarGraficoPng({
          titulo: "Temperatura (°C)",
          dados: chartData.map((d) => ({
            x: d.x,
            xLabel: d.xLabel,
            series: [{ label: "Temperatura", cor: "c62828", valor: d.tempL1 }],
          })),
          unidade: "°C",
          marcadores: marcadoresGrafico,
          linhaRef: cuba.tempPretendida ? {
            valor: parseFloat(cuba.tempPretendida),
            label: `Pretendida (${cuba.tempPretendida}°C)`,
            cor: "#E53E3E",
          } : undefined,
          largura: CHART_W,
          altura: CHART_H,
        });

        if (y + CHART_H + 24 > doc.page.height - 50) {
          doc.addPage({ size: "A4", layout: "landscape" });
          y = MARGIN;
        }
        doc.image(graficoTemp, MARGIN, y, { width: CHART_W });
        y += CHART_H + 24 + 8;
      }

      // ── Tabela de leituras resumida (últimas 10) ───────
      const leiturasResumo = leituras.slice(-10);
      if (leiturasResumo.length > 0) {
        if (y + 60 > doc.page.height - 50) {
          doc.addPage({ size: "A4", layout: "landscape" });
          y = MARGIN;
        }

        doc.rect(MARGIN, y, CONTENT_W, 14).fill("#F3E8FF");
        const colsT = isPorto
          ? ["Data", "Hora", "Dia", "Baumé", "Temp.", "O₂", "Redox"]
          : ["Data", "Hora", "Dia", "Densidade", "Temp.", "O₂", "Redox"];
        const colWs = [60, 45, 28, 60, 45, 35, 40, 0];
        const totalFixed = colWs.slice(0, -1).reduce((s, v) => s + v, 0);
        colWs[colWs.length - 1] = Math.max(CONTENT_W - totalFixed, 40);

        let cx = MARGIN;
        colsT.forEach((h, i) => {
          doc.fillColor(COR_ROXO).fontSize(7).font("Helvetica-Bold")
            .text(h, cx + 2, y + 3, { width: colWs[i] - 4, align: "center" });
          cx += colWs[i];
        });
        y += 14;

        leiturasResumo.forEach((l, idx) => {
          if (y + 13 > doc.page.height - 50) {
            doc.addPage({ size: "A4", layout: "landscape" });
            y = MARGIN;
          }
          const bg = idx % 2 === 0 ? "#FFFFFF" : "#F8F4F6";
          doc.rect(MARGIN, y, CONTENT_W, 13).fill(bg);
          const vals = [
            formatDate(l.dataLeitura),
            l.hora ? l.hora.substring(0, 5) : "—",
            String(l.diaNr ?? ""),
            isPorto ? formatVal(l.baumeL1, 1) : formatVal(l.densL1),
            formatVal(l.tempL1, 1),
            formatVal(l.o2, 2),
            formatVal(l.redox, 0),
          ];
          cx = MARGIN;
          vals.forEach((v, i) => {
            doc.fillColor("#333333").fontSize(7).font("Helvetica")
              .text(v, cx + 2, y + 3, { width: colWs[i] - 4, align: "center", lineBreak: false });
            cx += colWs[i];
          });
          y += 13;
        });
        y += 8;
      }

      // ── Rodapé ─────────────────────────────────────────
      const pageH = doc.page.height;
      doc.fillColor(COR_CINZA).fontSize(7).font("Helvetica")
        .text(
          `Controlo de Fermentação Vinícola — Dashboard — ${dataHoje}`,
          MARGIN, pageH - 25, { width: CONTENT_W, align: "center" }
        );
    }

    doc.end();
  });
}
