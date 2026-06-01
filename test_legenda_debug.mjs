// Script de teste para verificar a legenda lateral no gráfico
import { createCanvas } from "@napi-rs/canvas";
import { writeFileSync } from "fs";

const CORES = {
  l1: "#8B0000",
  l2: "#1565C0",
  l3: "#2E7D32",
  l4: "#E65100",
};
const COR_BORDO = "#8B0000";

// Simular os parâmetros reais usados no pdfReport
// A4 landscape: 841.89pt, MARGIN=40, CONTENT_W = 841.89 - 80 = 761.89
const CONTENT_W = Math.round(841.89 - 80); // ~762
const LEGEND_W = 160;
const W = CONTENT_W; // canvas width = CONTENT_W
const H = 224; // 200 + 24
const PAD = { top: 36, right: LEGEND_W + 10, bottom: 28, left: 62 };

console.log(`Canvas: ${W}x${H}`);
console.log(`LEGEND_W: ${LEGEND_W}`);
console.log(`PAD.right: ${PAD.right}`);
console.log(`Plot area: left=${PAD.left} right=${W - PAD.right} width=${W - PAD.left - PAD.right}`);
console.log(`Legenda X: ${W - LEGEND_W + 8}`);

const canvas = createCanvas(W, H);
const ctx = canvas.getContext("2d");

// Fundo branco
ctx.fillStyle = "#ffffff";
ctx.fillRect(0, 0, W, H);

// Borda vermelha para ver os limites
ctx.strokeStyle = "red";
ctx.lineWidth = 2;
ctx.strokeRect(1, 1, W - 2, H - 2);

// Área do plot
const plotX1 = PAD.left;
const plotX2 = W - PAD.right;
const plotY1 = PAD.top;
const plotY2 = H - PAD.bottom;

ctx.fillStyle = "#f0f8ff";
ctx.fillRect(plotX1, plotY1, plotX2 - plotX1, plotY2 - plotY1);

// Título
ctx.fillStyle = COR_BORDO;
ctx.font = "bold 13px sans-serif";
ctx.fillText("Densidade — CF10", PAD.left, 20);

// Linha de exemplo
const series = [
  { label: "Densidade L1", cor: CORES.l1 },
  { label: "Temperatura", cor: CORES.l2 },
];

// Legenda lateral direita
const legendaX = W - LEGEND_W + 8;
let legendaY = PAD.top + 4;

console.log(`\nLegenda começa em X=${legendaX}, dentro do canvas W=${W}? ${legendaX < W}`);
console.log(`Legenda texto em X=${legendaX + 26}, dentro do canvas? ${legendaX + 26 < W}`);

series.forEach((s, si) => {
  const ly = legendaY + si * 22;
  ctx.strokeStyle = s.cor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(legendaX, ly);
  ctx.lineTo(legendaX + 20, ly);
  ctx.stroke();

  ctx.fillStyle = s.cor;
  ctx.beginPath();
  ctx.arc(legendaX + 10, ly, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#333";
  ctx.font = "11px sans-serif";
  ctx.fillText(s.label, legendaX + 26, ly + 4);
});

// Marcar a área da legenda com borda azul
ctx.strokeStyle = "blue";
ctx.lineWidth = 1;
ctx.strokeRect(W - LEGEND_W, PAD.top, LEGEND_W - 2, 80);

const buf = canvas.toBuffer("image/png");
writeFileSync("/tmp/test_legenda_debug.png", buf);
console.log("\nImagem guardada em /tmp/test_legenda_debug.png");
