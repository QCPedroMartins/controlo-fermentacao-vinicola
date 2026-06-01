// Testar a geração completa do PDF com dados reais
import { gerarRelatorioPdf } from "./server/pdfReport.ts";
import { writeFileSync } from "fs";

const cuba = {
  id: 1,
  codigo: "CF10",
  nomeLote: "Lote Teste 2025",
  fermentacaoNum: 1,
  tempPretendida: "18",
  densidadeLimite: "0.995",
  pontoAguardentacao: null,
  castas: "Touriga Nacional",
  dataInicio: "2025-10-01",
  observacoes: null,
};

// Gerar leituras de teste (20 dias)
const leituras = Array.from({ length: 20 }, (_, i) => ({
  id: i + 1,
  cubaId: 1,
  dataLeitura: `2025-10-${String(i + 1).padStart(2, "0")}`,
  hora: "14:00:00",
  diaFermentacao: i + 1,
  densL1: String(1.085 - i * 0.004),
  densL2: null,
  tempL1: String(18 + Math.sin(i) * 2),
  tempL2: null,
  o2L1: null,
  o2L2: null,
  redoxL1: null,
  redoxL2: null,
  baumeL1: null,
  baumeL2: null,
  utilizadorNome: "Pedro Martins",
  observacoes: null,
}));

console.log("A gerar PDF...");
try {
  const pdfBuffer = await gerarRelatorioPdf(cuba, leituras);
  writeFileSync("/tmp/test_relatorio.pdf", pdfBuffer);
  console.log(`PDF gerado: ${pdfBuffer.length} bytes → /tmp/test_relatorio.pdf`);
} catch (e) {
  console.error("Erro:", e.message);
}
