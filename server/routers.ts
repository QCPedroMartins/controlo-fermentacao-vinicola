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
  updateCubaNomeLote,
  updateCubaEstado,
  updateCubaDensidadeLimite,
  verificarFermentacaoCompleta,
  createLeitura,
  updateLeitura,
  createAdicao,
  deleteAdicao,
  createArquivo,
  getDb,
} from "./db";
import { notifyOwner } from "./_core/notification";
import { and, eq, min, max, asc } from "drizzle-orm";
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

  dashboard: publicProcedure.query(async () => {
    return getDashboardCubas();
  }),
});

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
      // Calcular dia de fermentação
      const existingLeituras = await getLeiturasByCuba(input.cubaId, input.fermentacaoNum);
      let diaNr = 1;
      if (existingLeituras.length > 0) {
        const firstDate = new Date(existingLeituras[0].dataLeitura as unknown as string);
        const currentDate = new Date(input.dataLeitura);
        diaNr = Math.floor((currentDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      }

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
        userName: ctx.user.name ?? ctx.user.email ?? "Utilizador",
      });

      // Verificar se fermentação está completa com base no limite configurado por cuba
      const db = await getDb();
      let fermentacaoCompleta = false;
      if (db) {
        const cubaRows = await db.select().from(cubas).where(eq(cubas.id, input.cubaId)).limit(1);
        const cuba = cubaRows[0];
        if (cuba) {
          const estadoAnterior = cuba.estado;
          fermentacaoCompleta = await verificarFermentacaoCompleta(
            input.cubaId,
            [input.densL1, input.densL2, input.densL3],
            cuba.densidadeLimite ?? "1.000"
          );
          // Notificar owner se acabou de atingir o limite (transição para completa)
          if (fermentacaoCompleta && estadoAnterior !== "completa") {
            const nomeCuba = cuba.nomeLote ? `${cuba.codigo} (${cuba.nomeLote})` : cuba.codigo;
            await notifyOwner({
              title: `🍷 Fermentação Completa — ${nomeCuba.toUpperCase()}`,
              content: `A cuba ${nomeCuba} atingiu a densidade limite de ${cuba.densidadeLimite} g/L.\nDia de fermentação: ${diaNr}\nRegistado por: ${ctx.user.name ?? ctx.user.email ?? "Utilizador"}`,
            }).catch(() => {}); // não bloquear se notificação falhar
          } else if (!fermentacaoCompleta) {
            await updateCubaEstado(input.cubaId, "em_fermentacao");
          }
        }
      }

      return { success: true, diaNr, fermentacaoCompleta };
    }),

  update: protectedProcedure
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
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateLeitura(id, data);
      return { success: true };
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

      // Calcular resumo da fermentação atual
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

      // Arquivar fermentação atual
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

      // Incrementar número de fermentação e atualizar nome/estado
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
