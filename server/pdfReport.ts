/**
 * pdfReport.ts
 * Gera um ficheiro PDF com ficha inicial, gráficos (canvas), tabela de leituras e adições.
 */

import PDFDocument from "pdfkit";
import { createCanvas } from "@napi-rs/canvas";
import { getLeiturasByCuba, getAdicoesByCuba } from "./db";

type LeituraRow = {
  id: number;
  dataLeitura: Date | string;
  diaNr: number | null;
  densL1: string | null;
  densL2: string | null;
  densL3: string | null;
  baumeL1?: string | null;
  baumeL2?: string | null;
  baumeL3?: string | null;
  tempL1: string | null;
  tempL2: string | null;
  tempL3: string | null;
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
};

// Cores
const COR_BORDO = "#5D1A2E";
const COR_ROXO = "#7C3AED";
const COR_CINZA = "#666666";

const CORES = {
  l1: "2e7d32",
  l2: "1565c0",
  l3: "c62828",
  o2: "00838f",
  redox: "6a1b9a",
};

function formatVal(v: string | null | undefined, decimals = 3): string {
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
  dados: { x: number; series: { label: string; cor: string; valor: number | null }[] }[];
  unidade?: string;
  marcadores?: { dia: number; index: number }[];
  linhaRef?: { valor: number; label: string; cor: string };
  largura?: number;
  altura?: number;
}): Buffer {
  const W = params.largura ?? 760;
  const nSeries = params.dados[0]?.series.length ?? 0;
  const altLegenda = 28 + (params.linhaRef ? 18 : 0);
  const H = (params.altura ?? 200) + altLegenda;
  const PAD = { top: 32, right: 20, bottom: 12 + altLegenda, left: 58 };

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // Fundo branco
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // Título
  ctx.fillStyle = COR_BORDO;
  ctx.font = "bold 12px sans-serif";
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
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Sem dados", PAD.left + plotW / 2, PAD.top + plotH / 2);
    return canvas.toBuffer("image/png");
  }

  const yMin = Math.min(...allVals) * 0.997;
  const yMax = Math.max(...allVals) * 1.003;
  const xMin = params.dados[0]?.x ?? 0;
  const xMax = params.dados[params.dados.length - 1]?.x ?? 1;

  const toX = (x: number) => PAD.left + ((x - xMin) / Math.max(xMax - xMin, 1)) * plotW;
  const toY = (y: number) => PAD.top + plotH - ((y - yMin) / Math.max(yMax - yMin, 0.001)) * plotH;

  // Grelha e labels Y
  const decimais = params.unidade === "°C" || params.unidade === "mg/L" || params.unidade === "mV" || params.unidade === "°" ? 1 : 3;
  ctx.strokeStyle = "#e8e8e8";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = PAD.top + (i / 4) * plotH;
    ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(PAD.left + plotW, y); ctx.stroke();
    const val = yMax - (i / 4) * (yMax - yMin);
    ctx.fillStyle = "#666"; ctx.font = "9px sans-serif"; ctx.textAlign = "right";
    ctx.fillText(val.toFixed(decimais), PAD.left - 4, y + 3);
  }

  // Labels X
  ctx.fillStyle = "#666"; ctx.font = "9px sans-serif"; ctx.textAlign = "center";
  params.dados.forEach((d) => ctx.fillText(String(d.x), toX(d.x), PAD.top + plotH + 10));

  // Unidade Y
  if (params.unidade) {
    ctx.save();
    ctx.translate(12, PAD.top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center"; ctx.fillStyle = "#444"; ctx.font = "9px sans-serif";
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
      ctx.fillStyle = "#7c3aed"; ctx.font = "bold 9px sans-serif"; ctx.textAlign = "center";
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

  // Legenda das séries
  const legendaY = PAD.top + plotH + 18;
  for (let si = 0; si < nSeries; si++) {
    const label = params.dados[0]?.series[si]?.label ?? "";
    const cor = params.dados[0]?.series[si]?.cor ?? "888888";
    const lx = PAD.left + si * 110;
    ctx.strokeStyle = "#" + cor; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(lx, legendaY); ctx.lineTo(lx + 16, legendaY); ctx.stroke();
    ctx.fillStyle = "#" + cor;
    ctx.beginPath(); ctx.arc(lx + 8, legendaY, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#222"; ctx.font = "bold 9px sans-serif"; ctx.textAlign = "left";
    ctx.fillText(label, lx + 20, legendaY + 3);
  }

  // Legenda da linha de referência
  if (params.linhaRef) {
    const lx = PAD.left + nSeries * 110;
    const ly = legendaY;
    ctx.save();
    ctx.strokeStyle = params.linhaRef.cor; ctx.lineWidth = 1.2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + 16, ly); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    ctx.fillStyle = "#222"; ctx.font = "bold 9px sans-serif"; ctx.textAlign = "left";
    ctx.fillText(params.linhaRef.label, lx + 20, ly + 3);
  }

  return canvas.toBuffer("image/png");
}

export async function gerarPdfCuba(cuba: CubaInfo): Promise<Buffer> {
  const leituras = (await getLeiturasByCuba(cuba.id, cuba.fermentacaoNum)) as LeituraRow[];
  const adicoes = (await getAdicoesByCuba(cuba.id, cuba.fermentacaoNum)) as AdicaoRow[];

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

  const chartData = leituras.map((l) => ({
    x: l.diaNr ?? 0,
    densL1: l.densL1 ? parseFloat(l.densL1) : null,
    densL2: l.densL2 ? parseFloat(l.densL2) : null,
    densL3: l.densL3 ? parseFloat(l.densL3) : null,
    baumeL1: l.baumeL1 ? parseFloat(l.baumeL1) : null,
    baumeL2: l.baumeL2 ? parseFloat(l.baumeL2) : null,
    baumeL3: l.baumeL3 ? parseFloat(l.baumeL3) : null,
    tempL1: l.tempL1 ? parseFloat(l.tempL1) : null,
    tempL2: l.tempL2 ? parseFloat(l.tempL2) : null,
    tempL3: l.tempL3 ? parseFloat(l.tempL3) : null,
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

    // ── Ficha Inicial ──────────────────────────────────────
    const temFicha = cuba.fichaKilos || cuba.fichaLitros || cuba.fichaPh || cuba.fichaAt ||
      cuba.fichaAv || cuba.fichaNfa || cuba.fichaNtu || cuba.fichaGluconico || cuba.fichaAlcoolProvavel;

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
      doc.addPage({ size: "A4", layout: "landscape" });
      y = MARGIN;

      // Título da secção de gráficos
      doc.rect(MARGIN, y, CONTENT_W, 16).fill(COR_BORDO);
      doc.fillColor("#FFFFFF").fontSize(9).font("Helvetica-Bold")
        .text("GRÁFICOS", MARGIN, y + 3, { width: CONTENT_W, align: "center" });
      y += 20;

      const CHART_W = CONTENT_W;
      const CHART_H_PX = 200; // altura do plot em px canvas
      const CHART_H_PDF = 150; // altura no PDF em pontos

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
              series: [
                { label: "Baumé L1", cor: CORES.l1, valor: d.baumeL1 },
                { label: "Baumé L2", cor: CORES.l2, valor: d.baumeL2 },
                { label: "Baumé L3", cor: CORES.l3, valor: d.baumeL3 },
              ],
            })),
            largura: CHART_W * 2,
            altura: CHART_H_PX,
          })
        : gerarGraficoPng({
            titulo: `Densidade — ${cuba.codigo.toUpperCase()}`,
            unidade: "Densidade",
            marcadores: marcadoresGrafico,
            dados: chartData.map((d) => ({
              x: d.x,
              series: [
                { label: "Densidade L1", cor: CORES.l1, valor: d.densL1 },
                { label: "Densidade L2", cor: CORES.l2, valor: d.densL2 },
                { label: "Densidade L3", cor: CORES.l3, valor: d.densL3 },
              ],
            })),
            largura: CHART_W * 2,
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
          series: [
            { label: "Temp. L1", cor: CORES.l1, valor: d.tempL1 },
            { label: "Temp. L2", cor: CORES.l2, valor: d.tempL2 },
            { label: "Temp. L3", cor: CORES.l3, valor: d.tempL3 },
          ],
        })),
        largura: CHART_W * 2,
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
            series: [{ label: "O₂ Dissolvido", cor: CORES.o2, valor: d.o2 }],
          })),
          largura: CHART_W * 2,
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
            series: [{ label: "Potencial Redox", cor: CORES.redox, valor: d.redox }],
          })),
          largura: CHART_W * 2,
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
            { header: "Data", width: 55 },
            { header: "Dia", width: 28 },
            { header: "Baumé L1", width: 50 },
            { header: "Temp. L1", width: 48 },
            { header: "Baumé L2", width: 50 },
            { header: "Temp. L2", width: 48 },
            { header: "Baumé L3", width: 50 },
            { header: "Temp. L3", width: 48 },
            { header: "O₂", width: 38 },
            { header: "Redox", width: 40 },
            { header: "Utilizador", width: 0 },
          ]
        : [
            { header: "Data", width: 55 },
            { header: "Dia", width: 28 },
            { header: "Dens. L1", width: 48 },
            { header: "Temp. L1", width: 48 },
            { header: "Dens. L2", width: 48 },
            { header: "Temp. L2", width: 48 },
            { header: "Dens. L3", width: 48 },
            { header: "Temp. L3", width: 48 },
            { header: "O₂", width: 38 },
            { header: "Redox", width: 40 },
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
              formatVal(l.baumeL2, 1),
              formatVal(l.tempL2, 1),
              formatVal(l.baumeL3, 1),
              formatVal(l.tempL3, 1),
              formatVal(l.o2, 2),
              formatVal(l.redox, 0),
              l.editedAt && l.editedByName ? `${l.userName ?? ""} ✏ ${l.editedByName}` : (l.userName ?? ""),
            ]
          : [
              formatDate(l.dataLeitura),
              String(l.diaNr ?? ""),
              formatVal(l.densL1),
              formatVal(l.tempL1, 1),
              formatVal(l.densL2),
              formatVal(l.tempL2, 1),
              formatVal(l.densL3),
              formatVal(l.tempL3, 1),
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
