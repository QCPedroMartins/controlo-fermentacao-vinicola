/**
 * importacaoRouter.ts
 * Importação de ficheiros CSV da máquina de densimetria (Anton Paar / similar).
 *
 * Formato do CSV:
 *   Separador: ;
 *   Decimal: ,
 *   Cabeçalho na linha 1
 *   Col A (1)  = MeasNo
 *   Col B (2)  = Date (DD.MM.YYYY)
 *   Col C (3)  = Time (HH:MM:SS)
 *   Col D (4)  = Method
 *   Col E (5)  = Sample ID  ← código da cuba (ex: CF01, VP01)
 *   Col F (6)  = Measured Parameter 1
 *   Col G (7)  = Value (densidade bruta — ignorar)
 *   Col H (8)  = Unit
 *   Col I (9)  = Offset
 *   Col J (10) = Alpha
 *   Col K (11) = Measured Parameter 2
 *   Col L (12) = Value  ← densidade SG 20/20 (usar esta)
 *   Col M (13) = Unit
 *   Col N (14) = Alpha
 *   Col O (15) = Temperature  ← temperatura em °C
 *   Col P (16) = Unit
 *   Col Q (17) = State
 */

import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getCubaByCodigo, createLeitura, getLeiturasByCuba } from "./db";

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface LinhaPreview {
  measNo: string;
  data: string;           // DD.MM.YYYY
  hora: string;           // HH:MM:SS
  cubaCodigo: string;     // normalizado (ex: CF01)
  cubaId: number;
  cubaNome: string;
  densidade: number;      // SG 20/20
  temperatura: number;    // °C
  diaFermentacao?: number; // calculado a partir das leituras existentes
}

export interface LinhaIgnorada {
  measNo: string;
  motivo: string;
  raw: string;
}

export interface ResultadoPreview {
  linhasValidas: LinhaPreview[];
  linhasIgnoradas: LinhaIgnorada[];
  totalLinhas: number;
}

// ── Parser CSV ────────────────────────────────────────────────────────────────

function normalizarCodigo(raw: string): string {
  const upper = raw.trim().toUpperCase();
  // vp3 → VP03, cf1 → CF01, lf37 → LF37 (2+ dígitos mantêm)
  return upper.replace(/^([A-Z]+)(\d+)$/, (_, prefix, num) =>
    num.length === 1 ? prefix + "0" + num : prefix + num
  );
}

function parsearDecimal(str: string): number | null {
  if (!str || str.trim() === "" || str.trim() === "-") return null;
  const n = parseFloat(str.trim().replace(",", "."));
  return isNaN(n) ? null : n;
}

function parsearData(str: string): Date | null {
  // DD.MM.YYYY
  const m = str.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return null;
  return new Date(`${m[3]}-${m[2]}-${m[1]}T12:00:00.000Z`);
}

export async function parsearCsv(csvContent: string): Promise<{
  validas: Array<{
    measNo: string;
    data: Date;
    dataStr: string;
    hora: string;
    cubaCodigo: string;
    densidade: number;
    temperatura: number;
  }>;
  ignoradas: LinhaIgnorada[];
}> {
  const linhas = csvContent.split(/\r?\n/).filter((l) => l.trim() !== "");
  const validas: Array<{
    measNo: string;
    data: Date;
    dataStr: string;
    hora: string;
    cubaCodigo: string;
    densidade: number;
    temperatura: number;
  }> = [];
  const ignoradas: LinhaIgnorada[] = [];

  // Saltar cabeçalho (linha 1)
  for (let i = 1; i < linhas.length; i++) {
    const raw = linhas[i];
    // Separar por ; respeitando aspas
    const cols = raw.split(";").map((c) => c.trim().replace(/^"|"$/g, ""));

    const measNo = cols[0] || String(i);
    const dateStr = cols[1] || "";
    const hora = cols[2] || "";
    const method = cols[3] || "";
    const sampleId = cols[4] || "";
    const densidadeStr = cols[11] || ""; // Col L (índice 11)
    const temperaturaStr = cols[14] || ""; // Col O (índice 14)

    // Ignorar WaterCheck ou linhas sem Sample ID
    if (method === "WaterCheck" || sampleId === "") {
      ignoradas.push({ measNo, motivo: method === "WaterCheck" ? "WaterCheck (calibração)" : "Sem Sample ID", raw });
      continue;
    }

    const data = parsearData(dateStr);
    if (!data) {
      ignoradas.push({ measNo, motivo: `Data inválida: "${dateStr}"`, raw });
      continue;
    }

    const densidade = parsearDecimal(densidadeStr);
    if (densidade === null || densidade <= 0 || densidade > 2) {
      ignoradas.push({ measNo, motivo: `Densidade inválida: "${densidadeStr}"`, raw });
      continue;
    }

    const temperatura = parsearDecimal(temperaturaStr);
    if (temperatura === null) {
      ignoradas.push({ measNo, motivo: `Temperatura inválida: "${temperaturaStr}"`, raw });
      continue;
    }

    const cubaCodigo = normalizarCodigo(sampleId);

    validas.push({ measNo, data, dataStr: dateStr, hora, cubaCodigo, densidade, temperatura });
  }

  return { validas, ignoradas };
}

// ── Router ────────────────────────────────────────────────────────────────────

export const importacaoRouter = router({
  /**
   * Processa o CSV e devolve um preview das leituras a criar.
   * Não persiste nada — apenas valida e devolve para confirmação.
   */
  processarCsv: protectedProcedure
    .input(z.object({ csvContent: z.string().max(5_000_000) }))
    .mutation(async ({ input }) => {
      const { validas, ignoradas } = await parsearCsv(input.csvContent);

      const linhasValidas: LinhaPreview[] = [];
      const linhasIgnoradasFinal: LinhaIgnorada[] = [...ignoradas];

      for (const linha of validas) {
        const cuba = await getCubaByCodigo(linha.cubaCodigo);
        if (!cuba) {
          linhasIgnoradasFinal.push({
            measNo: linha.measNo,
            motivo: `Cuba não encontrada: "${linha.cubaCodigo}"`,
            raw: `${linha.cubaCodigo} | ${linha.dataStr} | dens=${linha.densidade} | temp=${linha.temperatura}`,
          });
          continue;
        }

        // Calcular dia de fermentação: contar leituras existentes + 1
        const leiturasExistentes = await getLeiturasByCuba(cuba.id);
        const diaFermentacao = leiturasExistentes.length + 1;

        linhasValidas.push({
          measNo: linha.measNo,
          data: linha.dataStr,
          hora: linha.hora,
          cubaCodigo: linha.cubaCodigo,
          cubaId: cuba.id,
          cubaNome: cuba.nomeLote || linha.cubaCodigo,
          densidade: linha.densidade,
          temperatura: linha.temperatura,
          diaFermentacao,
        });
      }

      return {
        linhasValidas,
        linhasIgnoradas: linhasIgnoradasFinal,
        totalLinhas: validas.length + ignoradas.length,
      } as ResultadoPreview;
    }),

  /**
   * Confirma a importação e persiste as leituras na BD.
   * Recebe apenas as linhas que o utilizador aprovou.
   */
  confirmarCsv: protectedProcedure
    .input(
      z.object({
        linhas: z.array(
          z.object({
            cubaId: z.number(),
            cubaCodigo: z.string(),
            data: z.string(),       // DD.MM.YYYY
            hora: z.string(),
            densidade: z.number(),
            temperatura: z.number(),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      let criadas = 0;
      const erros: string[] = [];

      for (const linha of input.linhas) {
        try {
          // Converter data DD.MM.YYYY → string ISO para o createLeitura
          const m = linha.data.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
          if (!m) { erros.push(`Data inválida para cuba ${linha.cubaCodigo}: ${linha.data}`); continue; }
          const dataIso = `${m[3]}-${m[2]}-${m[1]}`; // YYYY-MM-DD

          // Obter cuba para saber fermentacaoNum actual
          const cuba = await getCubaByCodigo(linha.cubaCodigo);
          if (!cuba) { erros.push(`Cuba não encontrada: ${linha.cubaCodigo}`); continue; }

          // Calcular dia de fermentação
          const leiturasExistentes = await getLeiturasByCuba(linha.cubaId);
          const diaFermentacao = leiturasExistentes.length + 1;

          await createLeitura({
            cubaId: linha.cubaId,
            fermentacaoNum: cuba.fermentacaoNum,
            dataLeitura: dataIso,
            diaNr: diaFermentacao,
            densL1: String(linha.densidade),
            densL2: null,
            densL3: null,
            tempL1: String(linha.temperatura),
            tempL2: null,
            tempL3: null,
            o2: null,
            redox: null,
            baumeL1: null,
            baumeL2: null,
            baumeL3: null,
            userId: ctx.user.id,
            userName: ctx.user.name || ctx.user.email || "CSV Import",
          });
          criadas++;
        } catch (err) {
          erros.push(`Erro ao criar leitura para cuba ${linha.cubaCodigo}: ${String(err)}`);
        }
      }

      return { criadas, erros };
    }),
});
