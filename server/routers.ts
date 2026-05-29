import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  getAllCubas,
  getAdicoesByCuba,
  getArquivoByCuba,
  getArquivoByCubaCampanha,
  getCubaByCodigo,
  getDashboardCubas,
  getLeiturasByCuba,
  getLeituraById,
  updateCubaNomeLote,
  updateCubaEstado,
  updateCubaDensidadeLimite,
  updateCubaAlertas,
  updateFichaInicial,
  verificarFermentacaoCompleta,
  calcularAlertas,
  createLeitura,
  editarLeitura,
  createAdicao,
  deleteAdicao,
  createArquivo,
  associarCampanhaArquivo,
  getAllCampanhas,
  getCampanhaAtiva,
  createCampanha,
  ativarCampanha,
  getBaumeCalculo,
  upsertBaumeCalculo,
  getDb,
} from "./db";
import { notifyOwner } from "./_core/notification";
import { desc, eq } from "drizzle-orm";
import { cubas, leituras, adicoes, fermentacoesArquivo, campanhas } from "../drizzle/schema";

// ── Router de Cubas ───────────────────────────────────────
const cubasRouter = router({
  list: publicProcedure.query(async () => {
    return getAllCubas();
  }),

  get: publicProcedure
    .input(z.object({ codigo: z.string() }))
    .query(async ({ input }) => {
      const cuba = await getCubaByCodigo(input.codigo);
      if (!cuba) throw new TRPCError({ code: "NOT_FOUND", message: "Cuba não encontrada" });
      return cuba;
    }),

  updateNome: protectedProcedure
    .input(z.object({ id: z.number(), nomeLote: z.string().max(120) }))
    .mutation(async ({ input }) => {
      await updateCubaNomeLote(input.id, input.nomeLote);
      return { success: true };
    }),

  updateDensidadeLimite: protectedProcedure
    .input(z.object({ id: z.number(), densidadeLimite: z.string() }))
    .mutation(async ({ input }) => {
      await updateCubaDensidadeLimite(input.id, input.densidadeLimite);
      return { success: true };
    }),

  /** Atualizar configurações de alerta: temperatura pretendida, desvio de temperatura, desvio de densidade */
  updateAlertas: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        tempPretendida: z.string().nullable().optional(),
        desvioTempAlerta: z.string().optional(),
        desvioDesnsAlerta: z.string().optional(),
        alertasDensidade: z.string().nullable().optional(),
        pontoAguardentacao: z.string().nullable().optional(),
        desvioAguardentacaoAlerta: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      await updateCubaAlertas(input.id, {
        tempPretendida: input.tempPretendida,
        desvioTempAlerta: input.desvioTempAlerta,
        desvioDesnsAlerta: input.desvioDesnsAlerta,
        alertasDensidade: input.alertasDensidade,
        pontoAguardentacao: input.pontoAguardentacao,
        desvioAguardentacaoAlerta: input.desvioAguardentacaoAlerta,
      });
      return { success: true };
    }),

  /** Atualizar ficha inicial: kg, litros, pH, AT, AV, NFA, NTU, Glucónico, Álcool Provável */
  updateFichaInicial: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        fichaKilos: z.string().nullable().optional(),
        fichaLitros: z.string().nullable().optional(),
        fichaPh: z.string().nullable().optional(),
        fichaAt: z.string().nullable().optional(),
        fichaAv: z.string().nullable().optional(),
        fichaNfa: z.string().nullable().optional(),
        fichaNtu: z.string().nullable().optional(),
        fichaGluconico: z.string().nullable().optional(),
        fichaAlcoolProvavel: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateFichaInicial(id, data);
      return { success: true };
    }),

  dashboard: publicProcedure.query(async () => {
    return getDashboardCubas();
  }),

  /** Obter último cálculo de Baumé guardado para uma cuba VP */
  getBaumeCalculo: publicProcedure
    .input(z.object({ cubaId: z.number() }))
    .query(async ({ input }) => {
      return getBaumeCalculo(input.cubaId);
    }),

  /** Guardar (upsert) o cálculo de Baumé para uma cuba VP */
  saveBaumeCalculo: protectedProcedure
    .input(
      z.object({
        cubaId: z.number(),
        mostoFresco: z.number(),
        beLagrima: z.number(),
        alcool: z.number(),
        beActual: z.number(),
        grauVinica: z.number(),
        beAbafar: z.number(),
        beLagrimaPretendido: z.number(),
        adNecessaria: z.number(),
        adPorPipa: z.number(),
        volumeFinal: z.number(),
        pipasFinals: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      await upsertBaumeCalculo(input);
      return { success: true };
    }),
});

// ── Função auxiliar: verificar alertas e notificar ────────
async function processarAlertas(params: {
  cuba: {
    id: number; codigo: string; nomeLote: string | null; densidadeLimite: string; estado: string;
    tempPretendida: string | null; desvioTempAlerta: string; desvioDesnsAlerta: string;
    alertasDensidade?: string | null;
    pontoAguardentacao?: string | null;
    desvioAguardentacaoAlerta?: string | null;
  };
  densidades: (string | null | undefined)[];
  leituraInput: {
    densL1?: string | null; densL2?: string | null; densL3?: string | null;
    tempL1?: string | null; tempL2?: string | null; tempL3?: string | null;
    baumeL1?: string | null; baumeL2?: string | null; baumeL3?: string | null;
  };
  leituraAnterior?: {
    densL1?: string | null; densL2?: string | null; densL3?: string | null;
    baumeL1?: string | null; baumeL2?: string | null; baumeL3?: string | null;
  } | null;
  diaNr: number;
  userName: string;
}): Promise<{ fermentacaoCompleta: boolean; alertas: string[] }> {
  const estadoAnterior = params.cuba.estado;

  // Verificar fermentação completa (apenas cubas de vinho com densidade)
  const fermentacaoCompleta = await verificarFermentacaoCompleta(
    params.cuba.id,
    params.densidades,
    params.cuba.densidadeLimite ?? "1.000"
  );
  if (fermentacaoCompleta && estadoAnterior !== "completa") {
    const nomeCuba = params.cuba.nomeLote
      ? `${params.cuba.codigo} (${params.cuba.nomeLote})`
      : params.cuba.codigo;
    await notifyOwner({
      title: `🍷 Fermentação Completa — ${nomeCuba.toUpperCase()}`,
      content: `A cuba ${nomeCuba} atingiu a densidade limite de ${params.cuba.densidadeLimite} g/L.\nDia de fermentação: ${params.diaNr}\nRegistado por: ${params.userName}`,
    }).catch(() => {});
  } else if (!fermentacaoCompleta) {
    await updateCubaEstado(params.cuba.id, "em_fermentacao");
  }

  // Calcular alertas (temperatura, densidade, Baumé/aguardentação)
  const alertas = calcularAlertas({
    tempPretendida: params.cuba.tempPretendida,
    desvioTempAlerta: params.cuba.desvioTempAlerta ?? "5.0",
    desvioDesnsAlerta: params.cuba.desvioDesnsAlerta ?? "0.010",
    alertasDensidade: params.cuba.alertasDensidade,
    pontoAguardentacao: params.cuba.pontoAguardentacao,
    desvioAguardentacaoAlerta: params.cuba.desvioAguardentacaoAlerta ?? "0.50",
    tempL1: params.leituraInput.tempL1,
    tempL2: params.leituraInput.tempL2,
    tempL3: params.leituraInput.tempL3,
    densL1: params.leituraInput.densL1,
    densL2: params.leituraInput.densL2,
    densL3: params.leituraInput.densL3,
    baumeL1: params.leituraInput.baumeL1,
    baumeL2: params.leituraInput.baumeL2,
    baumeL3: params.leituraInput.baumeL3,
    leituraAnterior: params.leituraAnterior,
  });

  // Notificar alertas críticos
  if (alertas.length > 0) {
    const nomeCuba = params.cuba.nomeLote
      ? `${params.cuba.codigo} (${params.cuba.nomeLote})`
      : params.cuba.codigo;
    await notifyOwner({
      title: `⚠️ Alerta de Fermentação — ${nomeCuba.toUpperCase()}`,
      content: alertas.join("\n") + `\nDia de fermentação: ${params.diaNr}\nRegistado por: ${params.userName}`,
    }).catch(() => {});
  }

  return { fermentacaoCompleta, alertas };
}

// ── Router de Leituras ────────────────────────────────────
const leiturasRouter = router({
  listByCuba: publicProcedure
    .input(z.object({ cubaId: z.number(), fermentacaoNum: z.number().optional() }))
    .query(async ({ input }) => {
      return getLeiturasByCuba(input.cubaId, input.fermentacaoNum);
    }),

  create: protectedProcedure
    .input(
      z.object({
        cubaId: z.number(),
        fermentacaoNum: z.number(),
        dataLeitura: z.string(),
        densL1: z.string().nullable().optional(),
        densL2: z.string().nullable().optional(),
        densL3: z.string().nullable().optional(),
        tempL1: z.string().nullable().optional(),
        tempL2: z.string().nullable().optional(),
        tempL3: z.string().nullable().optional(),
        o2: z.string().nullable().optional(),
        redox: z.string().nullable().optional(),
        baumeL1: z.string().nullable().optional(),
        baumeL2: z.string().nullable().optional(),
        baumeL3: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Calcular dia de fermentação
      const existingLeituras = await getLeiturasByCuba(input.cubaId, input.fermentacaoNum);
      let diaNr = 1;
      if (existingLeituras.length > 0) {
        const firstDate = new Date(existingLeituras[0].dataLeitura as unknown as string);
        const currentDate = new Date(input.dataLeitura);
        diaNr = Math.floor((currentDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      }

      const userName = ctx.user.name ?? ctx.user.email ?? "Utilizador";

      await createLeitura({
        cubaId: input.cubaId,
        fermentacaoNum: input.fermentacaoNum,
        dataLeitura: input.dataLeitura,
        diaNr,
        densL1: input.densL1,
        densL2: input.densL2,
        densL3: input.densL3,
        tempL1: input.tempL1,
        tempL2: input.tempL2,
        tempL3: input.tempL3,
        o2: input.o2,
        redox: input.redox,
        baumeL1: input.baumeL1,
        baumeL2: input.baumeL2,
        baumeL3: input.baumeL3,
        userId: ctx.user.id,
        userName,
      });

      // Obter dados da cuba (limite, alertas)
      const cubaRows = await db.select().from(cubas).where(eq(cubas.id, input.cubaId)).limit(1);
      const cuba = cubaRows[0];
      let fermentacaoCompleta = false;
      let alertas: string[] = [];

      if (cuba) {
        // Leitura anterior para comparação de variação de densidade
        const leituraAnterior = existingLeituras.length > 0
          ? existingLeituras[existingLeituras.length - 1]
          : null;

        const resultado = await processarAlertas({
          cuba: {
            ...cuba,
            tempPretendida: cuba.tempPretendida ?? null,
            desvioTempAlerta: cuba.desvioTempAlerta ?? "5.0",
            desvioDesnsAlerta: cuba.desvioDesnsAlerta ?? "0.010",
            alertasDensidade: cuba.alertasDensidade ?? null,
            pontoAguardentacao: cuba.pontoAguardentacao ?? null,
            desvioAguardentacaoAlerta: cuba.desvioAguardentacaoAlerta ?? "0.50",
          },
          densidades: [input.densL1, input.densL2, input.densL3],
          leituraInput: input,
          leituraAnterior,
          diaNr,
          userName,
        });
        fermentacaoCompleta = resultado.fermentacaoCompleta;
        alertas = resultado.alertas;
      }

      return { success: true, diaNr, fermentacaoCompleta, alertas };
    }),

  /** Editar uma leitura já registada — regista quem editou e quando */
  edit: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        densL1: z.string().nullable().optional(),
        densL2: z.string().nullable().optional(),
        densL3: z.string().nullable().optional(),
        tempL1: z.string().nullable().optional(),
        tempL2: z.string().nullable().optional(),
        tempL3: z.string().nullable().optional(),
        o2: z.string().nullable().optional(),
        redox: z.string().nullable().optional(),
        baumeL1: z.string().nullable().optional(),
        baumeL2: z.string().nullable().optional(),
        baumeL3: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      const userName = ctx.user.name ?? ctx.user.email ?? "Utilizador";

      // Verificar que a leitura existe
      const leituraExistente = await getLeituraById(id);
      if (!leituraExistente) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Leitura não encontrada" });
      }

      await editarLeitura(id, {
        ...data,
        editedBy: ctx.user.id,
        editedByName: userName,
      });

      // Rever alertas e estado após edição
      const db = await getDb();
      let alertas: string[] = [];
      if (db) {
        const cubaRows = await db.select().from(cubas).where(eq(cubas.id, leituraExistente.cubaId)).limit(1);
        const cuba = cubaRows[0];
        if (cuba) {
          // Leitura anterior (a que vem antes desta na ordem de data)
          const todasLeituras = await getLeiturasByCuba(leituraExistente.cubaId, leituraExistente.fermentacaoNum);
          const idx = todasLeituras.findIndex((l) => l.id === id);
          const leituraAnterior = idx > 0 ? todasLeituras[idx - 1] : null;

          const resultado = await processarAlertas({
            cuba: {
              ...cuba,
              tempPretendida: cuba.tempPretendida ?? null,
              desvioTempAlerta: cuba.desvioTempAlerta ?? "5.0",
              desvioDesnsAlerta: cuba.desvioDesnsAlerta ?? "0.010",
              alertasDensidade: cuba.alertasDensidade ?? null,
              pontoAguardentacao: cuba.pontoAguardentacao ?? null,
              desvioAguardentacaoAlerta: cuba.desvioAguardentacaoAlerta ?? "0.50",
            },
            densidades: [data.densL1, data.densL2, data.densL3],
            leituraInput: data,
            leituraAnterior,
            diaNr: leituraExistente.diaNr ?? 1,
            userName,
          });
          alertas = resultado.alertas;
        }
      }

      return { success: true, alertas };
    }),

  registarLote: protectedProcedure
    .input(
      z.object({
        dataLeitura: z.string(),
        leituras: z.array(
          z.object({
            cubaId: z.number(),
            fermentacaoNum: z.number(),
            densL1: z.string().nullable().optional(),
            densL2: z.string().nullable().optional(),
            densL3: z.string().nullable().optional(),
            tempL1: z.string().nullable().optional(),
            tempL2: z.string().nullable().optional(),
            tempL3: z.string().nullable().optional(),
            o2: z.string().nullable().optional(),
            redox: z.string().nullable().optional(),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const resultados: { cubaId: number; success: boolean; alertas?: string[]; erro?: string }[] = [];
      const userName = ctx.user.name ?? ctx.user.email ?? "Utilizador";

      for (const linha of input.leituras) {
        try {
          const existingLeituras = await getLeiturasByCuba(linha.cubaId, linha.fermentacaoNum);
          let diaNr = 1;
          if (existingLeituras.length > 0) {
            const firstDate = new Date(existingLeituras[0].dataLeitura as unknown as string);
            const currentDate = new Date(input.dataLeitura);
            diaNr = Math.floor((currentDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          }

          await createLeitura({
            cubaId: linha.cubaId,
            fermentacaoNum: linha.fermentacaoNum,
            dataLeitura: input.dataLeitura,
            diaNr,
            densL1: linha.densL1,
            densL2: linha.densL2,
            densL3: linha.densL3,
            tempL1: linha.tempL1,
            tempL2: linha.tempL2,
            tempL3: linha.tempL3,
            o2: linha.o2,
            redox: linha.redox,
            userId: ctx.user.id,
            userName,
          });

          const cubaRows = await db.select().from(cubas).where(eq(cubas.id, linha.cubaId)).limit(1);
          const cuba = cubaRows[0];
          let alertas: string[] = [];
          if (cuba) {
            const leituraAnterior = existingLeituras.length > 0
              ? existingLeituras[existingLeituras.length - 1]
              : null;
            const resultado = await processarAlertas({
              cuba: {
                ...cuba,
                tempPretendida: cuba.tempPretendida ?? null,
                desvioTempAlerta: cuba.desvioTempAlerta ?? "5.0",
                desvioDesnsAlerta: cuba.desvioDesnsAlerta ?? "0.010",
              },
              densidades: [linha.densL1, linha.densL2, linha.densL3],
              leituraInput: linha,
              leituraAnterior,
              diaNr,
              userName,
            });
            alertas = resultado.alertas;
          }

          resultados.push({ cubaId: linha.cubaId, success: true, alertas });
        } catch (err) {
          resultados.push({ cubaId: linha.cubaId, success: false, erro: String(err) });
        }
      }

      return { resultados, total: input.leituras.length, sucesso: resultados.filter((r) => r.success).length };
    }),

  /** Retorna leituras de todas as cubas em fermentação para cálculo de alertas no dashboard */
  listAllDashboard: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    // Apenas cubas em fermentação precisam de alertas
    const cubasAtivas = await db.select().from(cubas).where(eq(cubas.estado, "em_fermentacao"));
    if (cubasAtivas.length === 0) return [];
    // Buscar leituras de cada cuba ativa (apenas a fermentação atual)
    const todasLeituras: Array<{
      cubaId: number; fermentacaoNum: number;
      densL1: string | null; densL2: string | null; densL3: string | null;
      tempL1: string | null; tempL2: string | null; tempL3: string | null;
    }> = [];
    for (const cuba of cubasAtivas) {
      const rows = await getLeiturasByCuba(cuba.id, cuba.fermentacaoNum);
      for (const r of rows) {
        todasLeituras.push({
          cubaId: cuba.id,
          fermentacaoNum: cuba.fermentacaoNum,
          densL1: r.densL1 ?? null,
          densL2: r.densL2 ?? null,
          densL3: r.densL3 ?? null,
          tempL1: r.tempL1 ?? null,
          tempL2: r.tempL2 ?? null,
          tempL3: r.tempL3 ?? null,
        });
      }
    }
    return todasLeituras;
  }),

  resumo: publicProcedure
    .input(z.object({ cubaId: z.number(), fermentacaoNum: z.number().optional() }))
    .query(async ({ input }) => {
      const rows = await getLeiturasByCuba(input.cubaId, input.fermentacaoNum);
      if (rows.length === 0) return { totalDias: 0, densMin: null, tempMax: null };

      const totalDias = rows[rows.length - 1].diaNr ?? rows.length;
      const allDens = rows.flatMap((r) =>
        [r.densL1, r.densL2, r.densL3].filter((v) => v !== null).map(Number)
      );
      const allTemp = rows.flatMap((r) =>
        [r.tempL1, r.tempL2, r.tempL3].filter((v) => v !== null).map(Number)
      );
      const densMin = allDens.length > 0 ? Math.min(...allDens) : null;
      const tempMax = allTemp.length > 0 ? Math.max(...allTemp) : null;

      return { totalDias, densMin, tempMax };
    }),
});

// ── Router de Adições ─────────────────────────────────────
const adicoesRouter = router({
  listByCuba: publicProcedure
    .input(z.object({ cubaId: z.number(), fermentacaoNum: z.number().optional() }))
    .query(async ({ input }) => {
      return getAdicoesByCuba(input.cubaId, input.fermentacaoNum);
    }),

  create: protectedProcedure
    .input(
      z.object({
        cubaId: z.number(),
        fermentacaoNum: z.number(),
        dataAdicao: z.string(),
        produto: z.string().optional(),
        dose: z.string().optional(),
        observacoes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await createAdicao({
        ...input,
        userId: ctx.user.id,
        userName: ctx.user.name ?? ctx.user.email ?? "Utilizador",
      });
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteAdicao(input.id);
      return { success: true };
    }),
});

// ── Router de Arquivo / Nova Fermentação ──────────────────
const arquivoRouter = router({
  listByCuba: publicProcedure
    .input(z.object({ cubaId: z.number() }))
    .query(async ({ input }) => {
      return getArquivoByCuba(input.cubaId);
    }),

  novaFermentacao: protectedProcedure
    .input(
      z.object({
        cubaId: z.number(),
        nomeLoteNovo: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const cuba = await db
        .select()
        .from(cubas)
        .where(eq(cubas.id, input.cubaId))
        .limit(1);
      if (!cuba[0]) throw new TRPCError({ code: "NOT_FOUND" });

      const fermentacaoAtual = cuba[0].fermentacaoNum;

      const rows = await getLeiturasByCuba(input.cubaId, fermentacaoAtual);
      let dataInicio: string | null = null;
      let dataFim: string | null = null;
      let totalDias: number | null = null;
      let densMin: string | null = null;
      let tempMax: string | null = null;

      if (rows.length > 0) {
        dataInicio = rows[0].dataLeitura instanceof Date ? rows[0].dataLeitura.toISOString().split('T')[0] : String(rows[0].dataLeitura);
        dataFim = rows[rows.length - 1].dataLeitura instanceof Date ? rows[rows.length - 1].dataLeitura.toISOString().split('T')[0] : String(rows[rows.length - 1].dataLeitura);
        totalDias = rows[rows.length - 1].diaNr ?? rows.length;
        const allDens = rows.flatMap((r) =>
          [r.densL1, r.densL2, r.densL3].filter((v) => v !== null).map(Number)
        );
        const allTemp = rows.flatMap((r) =>
          [r.tempL1, r.tempL2, r.tempL3].filter((v) => v !== null).map(Number)
        );
        if (allDens.length > 0) densMin = Math.min(...allDens).toFixed(3);
        if (allTemp.length > 0) tempMax = Math.max(...allTemp).toFixed(1);
      }

      await createArquivo({
        cubaId: input.cubaId,
        fermentacaoNum: fermentacaoAtual,
        nomeLote: cuba[0].nomeLote,
        dataInicio,
        dataFim,
        totalDias,
        densMin,
        tempMax,
        archivedBy: ctx.user.name ?? ctx.user.email ?? "Utilizador",
      });

      // Associar a fermentação arquivada à campanha ativa (se existir)
      try {
        const db2 = await getDb();
        if (db2) {
          const arquivoInserido = await db2
            .select()
            .from(fermentacoesArquivo)
            .where(eq(fermentacoesArquivo.cubaId, input.cubaId))
            .orderBy(desc(fermentacoesArquivo.id))
            .limit(1);
          if (arquivoInserido[0]) {
            await associarCampanhaArquivo(arquivoInserido[0].id);
          }
        }
      } catch (campErr) {
        console.warn("[Campanhas] Erro ao associar campanha ao arquivo:", campErr);
      }

      // A cuba fica com estado 'completa' após arquivar (mostra no dashboard).
      // Só volta a 'sem_dados' quando a nova fermentação tiver a primeira leitura registada.
      await db
        .update(cubas)
        .set({
          fermentacaoNum: fermentacaoAtual + 1,
          nomeLote: input.nomeLoteNovo ?? null,
          estado: "completa",
        })
        .where(eq(cubas.id, input.cubaId));

      // Enviar email de fim de fermentação em background (não bloqueia a resposta)
      import("../server/emailReport").then(async ({ gerarExcelCuba, enviarEmailComExcel }) => {
        try {
          const cubaParaRelatorio = {
            id: cuba[0].id,
            codigo: cuba[0].codigo,
            nomeLote: cuba[0].nomeLote,
            fermentacaoNum: fermentacaoAtual,
            estado: cuba[0].estado,
            densidadeLimite: cuba[0].densidadeLimite,
            tempPretendida: cuba[0].tempPretendida,
            fichaKilos: cuba[0].fichaKilos ?? null,
            fichaLitros: cuba[0].fichaLitros ?? null,
            fichaPh: cuba[0].fichaPh ?? null,
            fichaAt: cuba[0].fichaAt ?? null,
            fichaAv: cuba[0].fichaAv ?? null,
            fichaNfa: cuba[0].fichaNfa ?? null,
            fichaNtu: cuba[0].fichaNtu ?? null,
            fichaGluconico: cuba[0].fichaGluconico ?? null,
            fichaAlcoolProvavel: cuba[0].fichaAlcoolProvavel ?? null,
          };
          const adicoesArquivadas = await import("./db").then(m => m.getAdicoesByCuba(input.cubaId, fermentacaoAtual));
          const bufferExcel = Buffer.from(await gerarExcelCuba(cubaParaRelatorio));
          const dataHoje = new Date().toLocaleDateString("pt-PT", { timeZone: "Europe/Lisbon" });
          const nomeLoteSafe = (cuba[0].nomeLote ?? "sem_nome").replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "");
          const nomeFicheiro = `${cuba[0].codigo}_ferm${fermentacaoAtual}_${nomeLoteSafe}_${dataHoje.replace(/\//g, "-")}.xlsx`;
          const htmlBody = `<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8"><style>body{font-family:Georgia,serif;color:#333;max-width:600px;margin:0 auto;padding:20px}h1{color:#5d1a2e;font-size:22px;border-bottom:2px solid #5d1a2e;padding-bottom:8px}.highlight{background:#fdf6f8;border-left:4px solid #5d1a2e;padding:12px 16px;margin:16px 0;border-radius:4px}p{font-size:14px;line-height:1.6}.stat{display:inline-block;margin-right:20px}.stat strong{font-size:22px;color:#5d1a2e;display:block}.stat span{font-size:11px;color:#888}.footer{margin-top:30px;font-size:11px;color:#999;border-top:1px solid #eee;padding-top:12px}</style></head><body><h1>\u2705 Fermenta\u00e7\u00e3o Conclu\u00edda \u2014 ${cuba[0].codigo.toUpperCase()}</h1><p>A fermenta\u00e7\u00e3o da cuba <strong>${cuba[0].codigo.toUpperCase()}</strong> foi conclu\u00edda e arquivada.</p><div class="highlight"><strong style="font-size:16px;color:#5d1a2e">${cuba[0].nomeLote ?? "Sem nome"}</strong><br><span style="font-size:12px;color:#888">Fermenta\u00e7\u00e3o N\u00ba ${fermentacaoAtual}</span></div><div style="margin:20px 0"><div class="stat"><strong>${rows.length}</strong><span>leituras registadas</span></div><div class="stat"><strong>${adicoesArquivadas.length}</strong><span>adi\u00e7\u00f5es / notas</span></div></div><p>O relat\u00f3rio completo com gr\u00e1ficos de densidade, temperatura e todas as adi\u00e7\u00f5es segue em anexo.</p><div class="footer">Este email foi gerado automaticamente ao arquivar a fermenta\u00e7\u00e3o no sistema de Controlo de Fermenta\u00e7\u00e3o Vin\u00edcola \u2014 Castelares.</div></body></html>`;
          await enviarEmailComExcel({
            assunto: `\u2705 Fermenta\u00e7\u00e3o Conclu\u00edda \u2014 ${cuba[0].codigo.toUpperCase()} \u2014 ${cuba[0].nomeLote ?? "Sem nome"} (N\u00ba${fermentacaoAtual})`,
            htmlBody,
            nomeAnexo: nomeFicheiro,
            bufferExcel,
          });
          console.log(`[Email] Fim de fermenta\u00e7\u00e3o enviado: ${cuba[0].codigo} N\u00ba${fermentacaoAtual}`);
        } catch (emailErr) {
          console.error("[Email] Erro ao enviar email de fim de fermenta\u00e7\u00e3o:", emailErr);
        }
      }).catch((importErr) => {
        console.error("[Email] Erro ao importar emailReport:", importErr);
      });

      return { success: true, novaFermentacaoNum: fermentacaoAtual + 1 };
    }),
});

// ── Router de Arquivo / Nova Fermentação (extensão) ─────────
// Adicionar ao arquivoRouter os procedimentos de consulta de detalhe
const arquivoDetalheRouter = router({
  /** Retorna todas as leituras de uma fermentação arquivada */
  getLeituras: publicProcedure
    .input(z.object({ cubaId: z.number(), fermentacaoNum: z.number() }))
    .query(async ({ input }) => {
      return getLeiturasByCuba(input.cubaId, input.fermentacaoNum);
    }),

  /** Retorna todas as adições de uma fermentação arquivada */
  getAdicoes: publicProcedure
    .input(z.object({ cubaId: z.number(), fermentacaoNum: z.number() }))
    .query(async ({ input }) => {
      return getAdicoesByCuba(input.cubaId, input.fermentacaoNum);
    }),

  /** Retorna o resumo de uma fermentação arquivada (metadados do arquivo) */
  getResumo: publicProcedure
    .input(z.object({ cubaId: z.number(), fermentacaoNum: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const { fermentacoesArquivo } = await import("../drizzle/schema");
      const { and } = await import("drizzle-orm");
      const result = await db
        .select()
        .from(fermentacoesArquivo)
        .where(
          and(
            eq(fermentacoesArquivo.cubaId, input.cubaId),
            eq(fermentacoesArquivo.fermentacaoNum, input.fermentacaoNum)
          )
        )
        .limit(1);
      return result[0] ?? null;
    }),
});

// ── Router de Relatórios ────────────────────────────────────
const relatorioRouter = router({
  // Envia o Excel de uma cuba específica por email imediatamente
  enviarCuba: protectedProcedure
    .input(z.object({ codigo: z.string() }))
    .mutation(async ({ input }) => {
      const cuba = await getCubaByCodigo(input.codigo);
      if (!cuba) throw new Error("Cuba não encontrada");

      const { gerarExcelCuba, enviarEmailComExcel } = await import("./emailReport");
      const buffer = await gerarExcelCuba(cuba);

      const nomeLote = cuba.nomeLote ?? cuba.codigo.toUpperCase();
      const dataHoje = new Date().toLocaleDateString("pt-PT");

      await enviarEmailComExcel({
        assunto: `Relatório ${cuba.codigo.toUpperCase()} — ${nomeLote} (${dataHoje})`,
        htmlBody: `
          <h2>Relatório de Fermentação — ${cuba.codigo.toUpperCase()}</h2>
          <p><strong>Lote:</strong> ${nomeLote}</p>
          <p><strong>Estado:</strong> ${cuba.estado === "em_fermentacao" ? "Em fermentação" : cuba.estado}</p>
          <p><strong>Data:</strong> ${dataHoje}</p>
          <p>Em anexo encontra o Excel com o histórico completo de leituras, gráficos e adições.</p>
        `,
        nomeAnexo: `relatorio_${cuba.codigo}_${dataHoje.replace(/\//g, "-")}.xlsx`,
        bufferExcel: buffer as unknown as Buffer,
      });

      return { ok: true, destinatario: "geral@castelares.com" };
    }),

  // Exporta o Excel com gráficos de uma cuba (devolve base64)
  exportarExcelCuba: publicProcedure
    .input(z.object({ codigo: z.string() }))
    .mutation(async ({ input }) => {
      const cuba = await getCubaByCodigo(input.codigo);
      if (!cuba) throw new TRPCError({ code: "NOT_FOUND", message: "Cuba não encontrada" });
      const { gerarExcelCuba } = await import("./emailReport");
      const buffer = await gerarExcelCuba(cuba);
      const base64 = Buffer.from(buffer as unknown as ArrayBuffer).toString("base64");
      const nomeLote = cuba.nomeLote ?? cuba.codigo.toUpperCase();
      const nomeFicheiro = `${cuba.codigo}_${nomeLote.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "")}_ferm${cuba.fermentacaoNum}.xlsx`;
      return { base64, nomeFicheiro };
    }),

  // Exporta o PDF de uma cuba (devolve base64)
  exportarPdfCuba: publicProcedure
    .input(z.object({ codigo: z.string() }))
    .mutation(async ({ input }) => {
      const cuba = await getCubaByCodigo(input.codigo);
      if (!cuba) throw new TRPCError({ code: "NOT_FOUND", message: "Cuba não encontrada" });
      const { gerarPdfCuba } = await import("./pdfReport");
      const buffer = await gerarPdfCuba(cuba);
      const base64 = buffer.toString("base64");
      const nomeLote = cuba.nomeLote ?? cuba.codigo.toUpperCase();
      const nomeFicheiro = `${cuba.codigo}_${nomeLote.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "")}_ferm${cuba.fermentacaoNum}.pdf`;
      return { base64, nomeFicheiro };
    }),

  // Envia o digest diário com todas as cubas ativas por email
  enviarDigestDiario: protectedProcedure
    .mutation(async () => {
      const { gerarExcelDigestDiario, enviarEmailComExcel } = await import("./emailReport");
      const buffer = await gerarExcelDigestDiario();

      const dataHoje = new Date().toLocaleDateString("pt-PT");
      const cubas = await getAllCubas();
      const ativas = cubas.filter(c => c.estado === "em_fermentacao");

      await enviarEmailComExcel({
        assunto: `Digest Diário — ${ativas.length} cuba${ativas.length !== 1 ? "s" : ""} ativa${ativas.length !== 1 ? "s" : ""} (${dataHoje})`,
        htmlBody: `
          <h2>Digest Diário de Fermentação</h2>
          <p><strong>Data:</strong> ${dataHoje}</p>
          <p><strong>Cubas ativas:</strong> ${ativas.length}</p>
          ${ativas.length > 0 ? `<p>Cubas: ${ativas.map(c => c.codigo.toUpperCase()).join(", ")}</p>` : "<p>Não há cubas em fermentação neste momento.</p>"}
          <p>Em anexo encontra o Excel com o estado atual de todas as cubas ativas.</p>
        `,
        nomeAnexo: `digest_diario_${dataHoje.replace(/\//g, "-")}.xlsx`,
        bufferExcel: buffer as unknown as Buffer,
      });

      return { ok: true, cubasAtivas: ativas.length, destinatario: "geral@castelares.com" };
    }),
});


// ── Campanhas Router ─────────────────────────────────────
const campanhasRouter = router({
  list: publicProcedure.query(async () => getAllCampanhas()),
  ativa: publicProcedure.query(async () => (await getCampanhaAtiva()) ?? null),
  criar: protectedProcedure
    .input(z.object({ nome: z.string().min(1).max(60), descricao: z.string().optional() }))
    .mutation(async ({ input }) => {
      await createCampanha({ nome: input.nome, descricao: input.descricao });
      return { success: true };
    }),
  ativar: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await ativarCampanha(input.id);
      return { success: true };
    }),
  arquivoByCuba: publicProcedure
    .input(z.object({ cubaId: z.number(), campanhaId: z.number().optional() }))
    .query(async ({ input }) => getArquivoByCubaCampanha(input.cubaId, input.campanhaId)),
});

// ── App Router ────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  cubas: cubasRouter,
  leituras: leiturasRouter,
  adicoes: adicoesRouter,
  arquivo: arquivoRouter,
  arquivoDetalhe: arquivoDetalheRouter,
  relatorio: relatorioRouter,
  campanhas: campanhasRouter,
});

export type AppRouter = typeof appRouter;
