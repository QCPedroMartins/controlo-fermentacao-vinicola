// Testar o gerarGraficoLinha do emailReport directamente
import { createCanvas } from "@napi-rs/canvas";
import { writeFileSync } from "fs";

const W = 800;
const LEGEND_W = 180;
const H = 320 + 28; // altura padrão
const PAD = { top: 45, right: LEGEND_W + 16, bottom: 28, left: 70 };

console.log(`Canvas: ${W}x${H}`);
console.log(`LEGEND_W: ${LEGEND_W}`);
console.log(`PAD.right: ${PAD.right}`);
console.log(`Plot area: left=${PAD.left} right=${W - PAD.right} width=${W - PAD.left - PAD.right}`);
console.log(`Legenda X: ${W - LEGEND_W + 10}`);
console.log(`Legenda texto X: ${W - LEGEND_W + 10 + 30}`);

const canvas = createCanvas(W, H);
const ctx = canvas.getContext("2d");

ctx.fillStyle = "#ffffff";
ctx.fillRect(0, 0, W, H);

// Borda vermelha
ctx.strokeStyle = "red";
ctx.lineWidth = 2;
ctx.strokeRect(1, 1, W - 2, H - 2);

// Área do plot
ctx.fillStyle = "#f0f8ff";
ctx.fillRect(PAD.left, PAD.top, W - PAD.left - PAD.right, H - PAD.top - PAD.bottom);

// Título
ctx.fillStyle = "#5d1a2e";
ctx.font = "bold 14px sans-serif";
ctx.fillText("Densidade — CF10", PAD.left, 24);

// Legenda
const legendaX = W - LEGEND_W + 10;
const series = [
  { label: "Densidade", cor: "#8B0000" },
  { label: "Temperatura", cor: "#1565C0" },
];

series.forEach((s, si) => {
  const ly = PAD.top + 4 + si * 24;
  ctx.strokeStyle = s.cor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(legendaX, ly);
  ctx.lineTo(legendaX + 22, ly);
  ctx.stroke();

  ctx.fillStyle = s.cor;
  ctx.beginPath();
  ctx.arc(legendaX + 11, ly, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#333";
  ctx.font = "12px sans-serif";
  ctx.fillText(s.label, legendaX + 30, ly + 4);
});

// Borda azul na área da legenda
ctx.strokeStyle = "blue";
ctx.lineWidth = 1;
ctx.strokeRect(W - LEGEND_W, PAD.top, LEGEND_W - 2, 80);

const buf = canvas.toBuffer("image/png");
writeFileSync("/tmp/test_email_grafico.png", buf);
console.log("\nImagem guardada em /tmp/test_email_grafico.png");
