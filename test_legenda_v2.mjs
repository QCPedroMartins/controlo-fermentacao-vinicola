// Teste directo da função gerarGraficoPng
import { createCanvas } from "@napi-rs/canvas";

const W = 760;
const LEGEND_W = 160;
const H = 200 + 24;
const PAD = { top: 36, right: LEGEND_W + 10, bottom: 28, left: 62 };

const canvas = createCanvas(W, H);
const ctx = canvas.getContext("2d");

// Fundo branco
ctx.fillStyle = "#ffffff";
ctx.fillRect(0, 0, W, H);

// Área do gráfico (azul claro para visualizar)
ctx.fillStyle = "#e3f2fd";
ctx.fillRect(PAD.left, PAD.top, W - PAD.left - PAD.right, H - PAD.top - PAD.bottom);

// Área da legenda (verde claro para visualizar)
const legendaX = W - LEGEND_W + 8;
ctx.fillStyle = "#e8f5e9";
ctx.fillRect(W - LEGEND_W, 0, LEGEND_W, H);

// Texto da legenda
ctx.fillStyle = "#000000";
ctx.font = "bold 12px sans-serif";
ctx.fillText("LEGENDA", legendaX, 20);

ctx.fillStyle = "#2e7d32";
ctx.font = "11px sans-serif";
ctx.beginPath();
ctx.moveTo(legendaX, 40);
ctx.lineTo(legendaX + 20, 40);
ctx.strokeStyle = "#2e7d32";
ctx.lineWidth = 2;
ctx.stroke();
ctx.fillText("Densidade", legendaX + 26, 44);

ctx.fillStyle = "#e53935";
ctx.beginPath();
ctx.moveTo(legendaX, 62);
ctx.lineTo(legendaX + 20, 62);
ctx.strokeStyle = "#e53935";
ctx.stroke();
ctx.fillStyle = "#000000";
ctx.fillText("Temperatura", legendaX + 26, 66);

// Bordas do canvas
ctx.strokeStyle = "#ff0000";
ctx.lineWidth = 2;
ctx.strokeRect(1, 1, W - 2, H - 2);

// Linha vertical da legenda
ctx.strokeStyle = "#888888";
ctx.lineWidth = 1;
ctx.beginPath();
ctx.moveTo(W - LEGEND_W, 0);
ctx.lineTo(W - LEGEND_W, H);
ctx.stroke();

import { writeFileSync } from "fs";
const buf = canvas.toBuffer("image/png");
writeFileSync("/tmp/test_legenda_v2.png", buf);
console.log(`Canvas: ${W}x${H}, LEGEND_W: ${LEGEND_W}, legendaX: ${legendaX}`);
console.log(`Área gráfico: x=${PAD.left} até x=${W - PAD.right} (largura: ${W - PAD.left - PAD.right})`);
console.log(`Área legenda: x=${W - LEGEND_W} até x=${W}`);
console.log("PNG gerado em /tmp/test_legenda_v2.png");
