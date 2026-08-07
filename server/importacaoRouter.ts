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
 *   Col G (7)  = Value (densidade bruta ← usar esta)
 *   Col H (8)  = Unit
 *   Col I (9)  = Offset
 *   Col J (10) = Alpha
 *   Col K (11) = Measured Parameter 2
 *   Col L (12) = Value  (densidade SG 20/20 — ignorar)
 *   Col M (13) = Unit
 *   Col N (14) = Alpha
 *   Col O (15) = Temperature  ← temperatura em °C
 *   Col P (16) = Unit
 *   Col Q (17) = State
 */
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getCubaByCodigo, createLeitura, getLeiturasByCuba, leituraExistePorData, updateCubaEstado } from "./db";
// ── Tipos ─────────────────────────────────────────────────────────────────────
export interface LinhaPreview {
  measNo: string;
  data: string;           // DD.MM.YYYY
  hora: string;           // HH:MM:SS
  cubaCodigo: string;     // normalizado (ex: CF01)
  cubaId: number;
  cubaNome: string;
  densidade: number;      // SG 20/20
  baume: number | null;   // Baumé (col L)
  temperatura: number;    // °C
  diaFermentacao?: number; // calculado a partir das leituras existentes
  duplicado?: boolean;    // true se já existe leitura para esta cuba+data
  isPorto?: boolean;      // true se é cuba VP
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
// Gera lista de variantes do código a tentar: CF01 → ["CF01", "CF1"], VP01 → ["VP01", "VP1"]
function variantesCodigo(raw: string): string[] {
  const upper = raw.trim().toUpperCase();
  const variants = new Set<string>();
  variants.add(upper);
  // Sem zero de preenchimento: CF01 → CF1
  const semZero = upper.replace(/^([A-Z]+)0+(\d+)$/, (_, prefix, num) => prefix + num);
  variants.add(semZero);
  // Com zero de preenchimento (1 dígito → 2): CF1 → CF01
  const comZero = upper.replace(/^([A-Z]+)(\d)$/, (_, prefix, num) => prefix + "0" + num);
  variants.add(comZero);
  return Array.from(variants);
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
/** Converte data DD.MM.YYYY → string ISO YYYY-MM-DD */
function dataParaIso(dataStr: string): string | null {
  const m = dataStr.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

const CUBAS_PORTO = new Set(["VP01", "VP02", "VP03", "VP04", "VP05"]);

export async function parsearCsv(csvContent: string): Promise<{
  validas: Array<{
    measNo: string;
    data: Date;
    dataStr: string;
    hora: string;
    cubaCodigo: string;
    densidade: number;
    baume: number | null;
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
    baume: number | null;
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
    const densidadeStr = cols[6] || ""; // Col G (índice 6)
    const baumeStr = cols[11] || "";       // Col L (índice 11) — Baumé
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
    let densidade = parsearDecimal(densidadeStr);
    // Aceitar valores na escala 900-1200 (ex: 1087.6) e converter para decimal (ex: 1.0876)
    if (densidade !== null && densidade > 2 && densidade < 1300) {
      densidade = Math.round((densidade / 1000) * 100000) / 100000;
    }
    if (densidade === null || densidade <= 0 || densidade > 2) {
      ignoradas.push({ measNo, motivo: `Densidade inválida: "${densidadeStr}"`, raw });
      continue;
    }
    const temperatura = parsearDecimal(temperaturaStr);
    if (temperatura === null) {
      ignoradas.push({ measNo, motivo: `Temperatura inválida: "${temperaturaStr}"`, raw });
      continue;
    }
    const baume = parsearDecimal(baumeStr); // pode ser null se não existir
    // Guardar o sampleId original — a resolução para código de cuba será feita no router
    validas.push({ measNo, data, dataStr: dateStr, hora, cubaCodigo: sampleId.trim().toUpperCase(), densidade, baume, temperatura });
  }
  return { validas, ignoradas };
}
// ── Router ────────────────────────────────────────────────────────────────────
export const importacaoRouter = router({
  /**
   * Processa o CSV e devolve um preview das leituras a criar.
   * Não persiste nada — apenas valida e devolve para confirmação.
   * Marca como `duplicado: true` as linhas que já existem na BD (mesma cuba + data).
   */
  processarCsv: protectedProcedure
    .input(z.object({ csvContent: z.string().max(5_000_000) }))
    .mutation(async ({ input }) => {
      const { validas, ignoradas } = await parsearCsv(input.csvContent);

      const linhasValidas: LinhaPreview[] = [];
      const linhasIgnoradasFinal: LinhaIgnorada[] = [...ignoradas];

      for (const linha of validas) {
        // Tentar múltiplas variantes do código até encontrar a cuba
        let cuba = null;
        for (const variante of variantesCodigo(linha.cubaCodigo)) {
          cuba = await getCubaByCodigo(variante);
          if (cuba) break;
        }
        if (!cuba) {
          linhasIgnoradasFinal.push({
            measNo: linha.measNo,
            motivo: `Cuba não encontrada: "${linha.cubaCodigo}"`,
            raw: `${linha.cubaCodigo} | ${linha.dataStr} | dens=${linha.densidade} | temp=${linha.temperatura}`,
          });
          continue;
        }

        // Converter data para ISO (YYYY-MM-DD)
        const dataIso = dataParaIso(linha.dataStr);
        if (!dataIso) {
          linhasIgnoradasFinal.push({
            measNo: linha.measNo,
            motivo: `Data inválida: "${linha.dataStr}"`,
            raw: `${linha.cubaCodigo} | ${linha.dataStr}`,
          });
          continue;
        }

        // Verificar se já existe leitura para esta cuba nesta data E hora (duplicado exacto)
        const isDuplicado = await leituraExistePorData(cuba.id, dataIso, linha.hora);

        // Calcular dia de fermentação: contar leituras existentes + 1
        const leiturasExistentes = await getLeiturasByCuba(cuba.id);
        const diaFermentacao = leiturasExistentes.length + 1;

        const codigoNorm = linha.cubaCodigo.toUpperCase().replace(/^([A-Z]+)0+(\d+)$/, (_, p, n) => p + n);
        const isPorto = CUBAS_PORTO.has(codigoNorm) || CUBAS_PORTO.has(linha.cubaCodigo.toUpperCase());

        linhasValidas.push({
          measNo: linha.measNo,
          data: linha.dataStr,
          hora: linha.hora,
          cubaCodigo: linha.cubaCodigo,
          cubaId: cuba.id,
          cubaNome: cuba.nomeLote || linha.cubaCodigo,
          densidade: linha.densidade,
          baume: linha.baume ?? null,
          temperatura: linha.temperatura,
          diaFermentacao,
          duplicado: isDuplicado,
          isPorto,
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
   * Ignora silenciosamente linhas duplicadas (mesma cuba + data + hora já existe na BD).
   * Suporta cubas VP (baumeL1) e cubas normais (densL1).
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
            baume: z.number().nullable().optional(),
            temperatura: z.number(),
            isPorto: z.boolean().optional().default(false),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      let criadas = 0;
      let ignoradas = 0;
      const erros: string[] = [];
      const alertasCubas: { cubaId: number; codigo: string; nomeLote: string | null; densidadeAtual: string; densidadeLimite: string }[] = [];

      for (const linha of input.linhas) {
        try {
          // Converter data DD.MM.YYYY → string ISO para o createLeitura
          const dataIso = dataParaIso(linha.data);
          if (!dataIso) { erros.push(`Data inválida para cuba ${linha.cubaCodigo}: ${linha.data}`); continue; }

          // Verificar duplicado antes de criar (cuba + data + hora)
          const isDuplicado = await leituraExistePorData(linha.cubaId, dataIso, linha.hora);
          if (isDuplicado) {
            ignoradas++;
            continue;
          }

          // Obter cuba para saber fermentacaoNum actual (tentar múltiplas variantes)
          let cuba = null;
          for (const variante of variantesCodigo(linha.cubaCodigo)) {
            cuba = await getCubaByCodigo(variante);
            if (cuba) break;
          }
          if (!cuba) { erros.push(`Cuba não encontrada: ${linha.cubaCodigo}`); continue; }

          // Calcular dia de fermentação baseado na data (não apenas na contagem)
          const leiturasExistentes = await getLeiturasByCuba(linha.cubaId, cuba.fermentacaoNum);
          let diaFermentacao = 1;
          if (leiturasExistentes.length > 0) {
            const firstDate = new Date(leiturasExistentes[0].dataLeitura as unknown as string);
            const currentDate = new Date(dataIso);
            diaFermentacao = Math.floor((currentDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          }

          const isPorto = linha.isPorto ?? false;
          await createLeitura({
            cubaId: linha.cubaId,
            fermentacaoNum: cuba.fermentacaoNum,
            dataLeitura: dataIso,
            hora: linha.hora || null,
            diaNr: diaFermentacao,
            densL1: String(linha.densidade),
            tempL1: String(linha.temperatura),
            o2: null,
            redox: null,
            baumeL1: linha.baume != null ? String(linha.baume) : (isPorto ? String(linha.densidade) : null),
            userId: ctx.user.id,
            userName: ctx.user.name || ctx.user.email || "CSV Import",
          });
          criadas++;
          // Se a cuba está 'completa' ou 'sem_dados', mudar para 'em_fermentacao' (novo vinho entrou)
          if (cuba.estado === "completa" || cuba.estado === "sem_dados") {
            await updateCubaEstado(cuba.id, "em_fermentacao");
            cuba = { ...cuba, estado: "em_fermentacao" };
          }
          // Verificar se atingiu o limite de densidade
          const densAtual = isPorto ? (linha.densidade != null ? String(linha.densidade) : null) : (linha.densidade != null ? String(linha.densidade) : null);
          const limite = cuba.densidadeLimite ?? "0.990";
          if (densAtual && parseFloat(densAtual) <= parseFloat(limite) && cuba.estado === "em_fermentacao") {
            // Evitar duplicados no array (mesma cuba)
            if (!alertasCubas.some((a) => a.cubaId === cuba.id)) {
              alertasCubas.push({
                cubaId: cuba.id,
                codigo: cuba.codigo,
                nomeLote: cuba.nomeLote ?? null,
                densidadeAtual: densAtual,
                densidadeLimite: limite,
              });
            }
          }
        } catch (err) {
          erros.push(`Erro ao criar leitura para cuba ${linha.cubaCodigo}: ${String(err)}`);
        }
      }

      return { criadas, ignoradas, erros, alertasCubas };
    }),
});
