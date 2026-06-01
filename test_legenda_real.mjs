// Teste com dados reais para verificar a legenda
import { createCanvas } from "@napi-rs/canvas";
import { writeFileSync } from "fs";

const W = 760;
const LEGEND_W = 160;
const H = 200 + 24;
const PAD = { top: 36, right: LEGEND_W + 10, bottom: 28, left: 62 };
const CORES = { l1: "2e7d32", temp: "e53935", o2: "1565c0", redox: "6a1b9a" };

// Simular dados reais
const dados = [
  { x: 1, xLabel: "1", series: [{ label: "Densidade", cor: CORES.l1, valor: 1.085 }] },
  { x: 2, xLabel: "2", series: [{ label: "Densidade", cor: CORES.l1, valor: 1.075 }] },
  { x: 3, xLabel: "3", series: [{ label: "Densidade", cor: CORES.l1, valor: 1.065 }] },
  { x: 4, xLabel: "4", series: [{ label: "Densidade", cor: CORES.l1, valor: 1.050 }] },
  { x: 5, xLabel: "5", series: [{ label: "Densidade", cor: CORES.l1, valor: 1.040 }] },
];

const nSeries = dados[0]?.series.length ?? 0;
const canvas = createCanvas(W, H);
const ctx = canvas.getContext("2d");

// Fundo branco
ctx.fillStyle = "#ffffff";
ctx.fillRect(0, 0, W, H);

// Área da legenda (fundo cinzento claro para debug)
ctx.fillStyle = "#f5f5f5";
ctx.fillRect(W - LEGEND_W, 0, LEGEND_W, H);

// Linha separadora da legenda
ctx.strokeStyle = "#cccccc";
ctx.lineWidth = 1;
ctx.beginPath();
ctx.moveTo(W - LEGEND_W, 0);
ctx.lineTo(W - LEGEND_W, H);
ctx.stroke();

// Legenda das séries — lateral direita
const legendaX = W - LEGEND_W + 8;
let legendaY = PAD.top + 4;

console.log(`W=${W}, LEGEND_W=${LEGEND_W}, legendaX=${legendaX}`);
console.log(`PAD.right=${PAD.right}, área gráfico: ${PAD.left} a ${W - PAD.right}`);

for (let si = 0; si < nSeries; si++) {
  const label = dados[0]?.series[si]?.label ?? "";
  const cor = dados[0]?.series[si]?.cor ?? "888888";
  const ly = legendaY + si * 22;
  
  console.log(`Série ${si}: label="${label}", ly=${ly}, legendaX=${legendaX}`);
  
  // Linha colorida
  ctx.strokeStyle = "#" + cor; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(legendaX, ly); ctx.lineTo(legendaX + 20, ly); ctx.stroke();
  
  // Ponto central
  ctx.fillStyle = "#" + cor;
  ctx.beginPath(); ctx.arc(legendaX + 10, ly, 4, 0, Math.PI * 2); ctx.fill();
  
  // Texto
  ctx.fillStyle = "#111111"; 
  ctx.font = "bold 10px sans-serif"; 
  ctx.textAlign = "left";
  const textX = legendaX + 26;
  const textY = ly + 4;
  console.log(`  Texto "${label}" em (${textX}, ${textY})`);
  ctx.fillText(label, textX, textY);
  
  // Verificar se o texto está dentro do canvas
  const textWidth = ctx.measureText(label).width;
  console.log(`  Largura do texto: ${textWidth}px, fim em x=${textX + textWidth} (canvas W=${W})`);
}

// Bordas do canvas para debug
ctx.strokeStyle = "#ff0000";
ctx.lineWidth = 2;
ctx.strokeRect(1, 1, W - 2, H - 2);

const buf = canvas.toBuffer("image/png");
writeFileSync("/tmp/test_legenda_real.png", buf);
console.log("PNG gerado em /tmp/test_legenda_real.png");
