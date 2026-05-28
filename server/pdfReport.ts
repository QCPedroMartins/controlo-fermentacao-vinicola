/**
 * pdfReport.ts
 * Gera um ficheiro PDF com ficha inicial, tabela de leituras e adições
 * para exportação por cuba.
 */

import PDFDocument from "pdfkit";
import { getLeiturasByCuba, getAdicoesByCuba } from "./db";

type LeituraRow = {
  id: number;
  dataLeitura: Date | string;
  diaNr: number | null;
  densL1: string | null;
  densL2: string | null;
  densL3: string | null;
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
};

// Cor principal bordô
const COR_BORDO = "#5D1A2E";
const COR_ROXO = "#7C3AED";
const COR_CINZA = "#666666";

function formatVal(v: string | null, decimals = 3): string {
  if (!v) return "—";
  const n = parseFloat(v);
  return isNaN(n) ? v : n.toFixed(decimals);
}

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("pt-PT");
}

export async function gerarPdfCuba(cuba: CubaInfo): Promise<Buffer> {
  const leituras = (await getLeiturasByCuba(cuba.id, cuba.fermentacaoNum)) as LeituraRow[];
  const adicoes = (await getAdicoesByCuba(cuba.id, cuba.fermentacaoNum)) as AdicaoRow[];

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

    let y = MARGIN + 56;

    // ── Ficha Inicial ──────────────────────────────────────
    const temFicha = cuba.fichaKilos || cuba.fichaLitros || cuba.fichaPh || cuba.fichaAt ||
      cuba.fichaAv || cuba.fichaNfa || cuba.fichaNtu || cuba.fichaGluconico || cuba.fichaAlcoolProvavel;

    if (temFicha) {
      // Título da secção
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

      // Labels
      doc.rect(MARGIN, y, CONTENT_W, 14).fill("#FDF0F3");
      fichaFields.forEach(([label], i) => {
        doc.fillColor(COR_BORDO).fontSize(7).font("Helvetica-Bold")
          .text(label, MARGIN + i * colW, y + 3, { width: colW, align: "center" });
      });
      y += 14;

      // Valores
      doc.rect(MARGIN, y, CONTENT_W, 14).fill("#FFFFFF");
      fichaFields.forEach(([, val], i) => {
        doc.fillColor("#333333").fontSize(8).font("Helvetica")
          .text(val ?? "—", MARGIN + i * colW, y + 3, { width: colW, align: "center" });
      });
      y += 20;
    }

    // ── Tabela de Leituras ─────────────────────────────────
    if (leituras.length > 0) {
      // Título
      doc.rect(MARGIN, y, CONTENT_W, 16).fill(COR_BORDO);
      doc.fillColor("#FFFFFF").fontSize(9).font("Helvetica-Bold")
        .text("LEITURAS DE FERMENTAÇÃO", MARGIN, y + 3, { width: CONTENT_W, align: "center" });
      y += 18;

      const cols = [
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
        { header: "Utilizador", width: 0 }, // preenche o resto
      ];
      // Calcular largura da última coluna
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

      // Linhas de dados
      leituras.forEach((l, idx) => {
        const rowH = 13;
        if (y + rowH > doc.page.height - 50) {
          doc.addPage({ size: "A4", layout: "landscape" });
          y = MARGIN;
        }
        const bg = idx % 2 === 0 ? "#FFFFFF" : "#F8F4F6";
        doc.rect(MARGIN, y, CONTENT_W, rowH).fill(bg);

        const vals = [
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
          l.editedAt && l.editedByName
            ? `${l.userName ?? ""} ✏ ${l.editedByName}`
            : (l.userName ?? ""),
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

      // Cabeçalho
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
