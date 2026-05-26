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
  getCubaByCodigo,
  getDashboardCubas,
  getLeiturasByCuba,
  getLeituraById,
  updateCubaNomeLote,
  updateCubaEstado,
  updateCubaDensidadeLimite,
  updateCubaAlertas,
  verificarFermentacaoCompleta,
  calcularAlertas,
  createLeitura,
  editarLeitura,
  createAdicao,
  deleteAdicao,
  createArquivo,
  getDb,
} from "./db";
import { notifyOwner } from "./_core/notification";
import { eq } from "drizzle-orm";
import { cubas, leituras, adicoes } from "../drizzle/schema";

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
      })
    )
    .mutation(async ({ input }) => {
      await updateCubaAlertas(input.id, {
        tempPretendida: input.tempPretendida,
        desvioTempAlerta: input.desvioTempAlerta,
        desvioDesnsAlerta: input.desvioDesnsAlerta,
      });
      return { success: true };
    }),

  dashboard: publicProcedure.query(async () => {
    return getDashboardCubas();
  }),
});

// ── Função auxiliar: verificar alertas e notificar ────────
async function processarAlertas(params: {
  cuba: { id: number; codigo: string; nomeLote: string | null; densidadeLimite: string; estado: string; tempPretendida: string | null; desvioTempAlerta: string; desvioDesnsAlerta: string };
  densidades: (string | null | undefined)[];
  leituraInput: {
    densL1?: string | null; densL2?: string | null; densL3?: string | null;
    tempL1?: string | null; tempL2?: string | null; tempL3?: string | null;
  };
  leituraAnterior?: { densL1?: string | null; densL2?: string | null; densL3?: string | null } | null;
  diaNr: number;
  userName: string;
}): Promise<{ fermentacaoCompleta: boolean; alertas: string[] }> {
  const estadoAnterior = params.cuba.estado;

  // Verificar fermentação completa
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

  // Calcular alertas de temperatura e variação de densidade
  const alertas = calcularAlertas({
    tempPretendida: params.cuba.tempPretendida,
    desvioTempAlerta: params.cuba.desvioTempAlerta ?? "5.0",
    desvioDesnsAlerta: params.cuba.desvioDesnsAlerta ?? "0.010",
    tempL1: params.leituraInput.tempL1,
    tempL2: params.leituraInput.tempL2,
    tempL3: params.leituraInput.tempL3,
    densL1: params.leituraInput.densL1,
    densL2: params.leituraInput.densL2,
    densL3: params.leituraInput.densL3,
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

      await db
        .update(cubas)
        .set({
          fermentacaoNum: fermentacaoAtual + 1,
          nomeLote: input.nomeLoteNovo ?? null,
          estado: "sem_dados",
        })
        .where(eq(cubas.id, input.cubaId));

      return { success: true, novaFermentacaoNum: fermentacaoAtual + 1 };
    }),
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
});

export type AppRouter = typeof appRouter;
