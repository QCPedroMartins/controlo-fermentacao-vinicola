import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { tipoCubaArquivo } from "@shared/arquivoBaume";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, editProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { importacaoRouter } from "./importacaoRouter";
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
  updateCubaTipo,
  updateCubaDensidadeLimite,
  updateCubaAlertas,
  updateFichaInicial,
  criarAnalise,
  getAnalisesByCuba,
  criarAnaliseFinal,
  getAnalisesFinaisByCuba,
  getAllBarricas,
  getMovimentosBarricaByCuba,
  getAnalisesByBarrica,
  getComentariosByBarrica,
  criarComentario,
  getComentariosByCuba,
  copiarComentarios,
  registarAlerta,
  getAlertasByCuba,
  reconhecerAlerta,
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
  getFermentacoesByCampanha,
  getBaumeCalculo,
  upsertBaumeCalculo,
  getDb,
  leituraExistePorData,
  pesquisarGlobal,
} from "./db";
import {
  getAllRecepcoes,
  getRecepcaoById,
  getRecepcaoCubasByRecepcao,
  getRecepcoesByCuba,
  createRecepcao,
  deleteRecepcao,
  getAllMovimentos,
  getMovimentosByCuba,
  createMovimento,
} from "./db";
import {
  verifyLocalUserPassword,
  createLocalUser,
  getAllLocalUsers,
  updateLocalUserPassword,
  toggleLocalUserActive,
} from "./db";
import { upsertUser, getLocalUserByEmail } from "./db";
import {
  atribuirProtocoloACuba,
  atualizarProtocolo,
  concluirEtapaDeProtocolo,
  criarProtocolo,
  definirEstadoProtocolo,
  listarProtocolos,
  obterProtocolo,
  obterProtocoloDaCuba,
} from "./protocolos";
import { localUsers } from "../drizzle/schema";
import { notifyOwner } from "./_core/notification";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { inArray } from "drizzle-orm";
import { normalizarNumeroDecimal } from "./numeros";
import { validarDistribuicaoBarricas } from "./barricasRules";
import {
  cubas,
  leituras,
  adicoes,
  fermentacoesArquivo,
  campanhas,
  movimentosCuba,
  alertasHistorico,
  analisesFinaisFermentacao,
  analisesBarrica,
  barricas,
  movimentosBarrica,
  comentariosBarrica,
  comentariosCuba,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { borrasAdegaSchema, criarTokenHandoff, destinosAdegaSchema, normalizarDataAnaliseIso, novaReferenciaAdega, origensAdegaSchema } from "./gestaoAdegaHandoff";
import { erroCapacidadeDestinos, listarDestinosAdega } from "./gestaoAdegaDestinos";
import { encontrarDestinosAdegaDuplicados, normalizarCodigoDestinoAdega } from "../shared/gestaoAdegaDestinos";

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

  updateNome: editProcedure
    .input(z.object({ id: z.number(), nomeLote: z.string().max(120) }))
    .mutation(async ({ input }) => {
      await updateCubaNomeLote(input.id, input.nomeLote);
      return { success: true };
    }),

  updateDensidadeLimite: editProcedure
    .input(z.object({ id: z.number(), densidadeLimite: z.string() }))
    .mutation(async ({ input }) => {
      await updateCubaDensidadeLimite(input.id, input.densidadeLimite);
      return { success: true };
    }),

  updateTipo: editProcedure
    .input(z.object({ id: z.number().int().positive(), tipoCuba: z.enum(["vinho", "porto"]) }))
    .mutation(async ({ input }) => {
      await updateCubaTipo(input.id, input.tipoCuba);
      return { success: true };
    }),

  updateAlertas: editProcedure
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

  updateFichaInicial: editProcedure
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
        tipoVinho: z.enum(["branco", "tinto", "rose", "outro"]).nullable().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      const fichaNormalizada = {
        fichaKilos: normalizarNumeroDecimal(data.fichaKilos),
        fichaLitros: normalizarNumeroDecimal(data.fichaLitros),
        fichaPh: normalizarNumeroDecimal(data.fichaPh),
        fichaAt: normalizarNumeroDecimal(data.fichaAt),
        fichaAv: normalizarNumeroDecimal(data.fichaAv),
        fichaNfa: normalizarNumeroDecimal(data.fichaNfa),
        fichaNtu: normalizarNumeroDecimal(data.fichaNtu),
        fichaGluconico: normalizarNumeroDecimal(data.fichaGluconico),
        fichaAlcoolProvavel: normalizarNumeroDecimal(data.fichaAlcoolProvavel),
        tipoVinho: data.tipoVinho,
      };
      await updateFichaInicial(id, fichaNormalizada);
      // Guardar no histórico de análises
      const hoje = new Date().toISOString().slice(0, 10);
      const dbConn = await getDb();
      if (dbConn) {
        // Obter fermentacaoNum actual da cuba
        const cubaRows = await dbConn.select({ fermentacaoNum: cubas.fermentacaoNum }).from(cubas).where(eq(cubas.id, id)).limit(1);
        const fermentacaoNum = cubaRows[0]?.fermentacaoNum ?? 1;
        await criarAnalise({
          cubaId: id,
          fermentacaoNum,
          dataAnalise: hoje,
          fichaKilos: fichaNormalizada.fichaKilos ?? null,
          fichaLitros: fichaNormalizada.fichaLitros ?? null,
          fichaPh: fichaNormalizada.fichaPh ?? null,
          fichaAt: fichaNormalizada.fichaAt ?? null,
          fichaAv: fichaNormalizada.fichaAv ?? null,
          fichaNfa: fichaNormalizada.fichaNfa ?? null,
          fichaNtu: fichaNormalizada.fichaNtu ?? null,
          fichaGluconico: fichaNormalizada.fichaGluconico ?? null,
          fichaAlcoolProvavel: fichaNormalizada.fichaAlcoolProvavel ?? null,
          userId: ctx.user.id,
          userName: ctx.user.name ?? ctx.user.email ?? null,
        });
        // Limpar aviso de análises pendentes
        await dbConn.update(cubas).set({ analisesPendentes: false }).where(eq(cubas.id, id));
      }
      return { success: true };
    }),

  dashboard: publicProcedure.query(async () => {
    return getDashboardCubas();
  }),

  getAnalises: publicProcedure
    .input(z.object({ cubaId: z.number(), fermentacaoNum: z.number().optional() }))
    .query(async ({ input }) => getAnalisesByCuba(input.cubaId, input.fermentacaoNum)),

  getComentarios: publicProcedure
    .input(z.object({ cubaId: z.number() }))
    .query(async ({ input }) => getComentariosByCuba(input.cubaId)),

  addComentario: editProcedure
    .input(z.object({
      cubaId: z.number(),
      fermentacaoNum: z.number(),
      texto: z.string().min(1).max(2000),
    }))
    .mutation(async ({ input, ctx }) => {
      await criarComentario({
        cubaId: input.cubaId,
        fermentacaoNum: input.fermentacaoNum,
        texto: input.texto,
        userId: ctx.user.id,
        userName: ctx.user.name ?? ctx.user.email ?? null,
      });
      return { success: true };
    }),

  deleteComentario: editProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { comentariosCuba } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await db.delete(comentariosCuba).where(eq(comentariosCuba.id, input.id));
      return { success: true };
    }),

  getAlertas: publicProcedure
    .input(z.object({ cubaId: z.number() }))
    .query(async ({ input }) => getAlertasByCuba(input.cubaId)),

  // Lista todos os alertas reconhecidos (para o Dashboard filtrar cubas com alertas activos)
  getAlertasReconhecidosDashboard: publicProcedure
    .query(async () => {
      const { getDb } = await import("./db");
      const dbConn = await getDb();
      if (!dbConn) return [];
      const rows = await dbConn.select({
        cubaId: alertasHistorico.cubaId,
        reconhecidoEm: alertasHistorico.reconhecidoEm,
      }).from(alertasHistorico).where(isNotNull(alertasHistorico.reconhecidoEm));
      return rows;
    }),

  reconhecerAlerta: editProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await reconhecerAlerta(input.id, ctx.user.id, ctx.user.name ?? ctx.user.email ?? null);
      return { success: true };
    }),

  // Cria um alerta na BD (se não existir) e reconhece-o imediatamente
  criarEReconhecerAlerta: editProcedure
    .input(z.object({
      cubaId: z.number(),
      fermentacaoNum: z.number(),
      tipoAlerta: z.string().trim().min(1).max(64),
      valorAlerta: z.string().trim().max(3000).optional(),
      dataLeitura: z.string(), // ISO date string
    }))
    .mutation(async ({ input, ctx }) => {
      const { criarAlerta, reconhecerAlerta: reconhecer } = await import("./db");
      // Criar o alerta com a data da leitura
      const criadoEm = new Date(input.dataLeitura);
      const id = await criarAlerta({
        cubaId: input.cubaId,
        fermentacaoNum: input.fermentacaoNum,
        tipoAlerta: input.tipoAlerta,
        valorAlerta: input.valorAlerta ?? null,
        criadoEm,
      });
      // Reconhecer imediatamente
      await reconhecer(id, ctx.user.id, ctx.user.name ?? ctx.user.email ?? null);
      return { success: true, id };
    }),

  getBaumeCalculo: publicProcedure
    .input(z.object({ cubaId: z.number() }))
    .query(async ({ input }) => {
      return getBaumeCalculo(input.cubaId);
    }),

  saveBaumeCalculo: editProcedure
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
    densL1?: string | null;
    tempL1?: string | null;
    baumeL1?: string | null;
  };
  leituraAnterior?: {
    densL1?: string | null;
    baumeL1?: string | null;
  } | null;
  diaNr: number;
  userName: string;
}): Promise<{ fermentacaoCompleta: boolean; alertas: string[] }> {
  const estadoAnterior = params.cuba.estado;

  const fermentacaoCompleta = await verificarFermentacaoCompleta(
    params.cuba.id,
    params.densidades,
    params.cuba.densidadeLimite ?? "1.000"
  );
  if (fermentacaoCompleta && estadoAnterior !== "completa") {
    // Apenas notificar — o estado NÃO muda automaticamente para 'completa'
    // O utilizador decide quando terminar a fermentação clicando 'Terminar Fermentação'
    const nomeCuba = params.cuba.nomeLote
      ? `${params.cuba.codigo} (${params.cuba.nomeLote})`
      : params.cuba.codigo;
    await notifyOwner({
      title: `⚠️ Densidade Limite Atingida — ${nomeCuba.toUpperCase()}`,
      content: `A cuba ${nomeCuba} atingiu a densidade limite de ${params.cuba.densidadeLimite} g/L.\nPode agora terminar a fermentação.\nDia de fermentação: ${params.diaNr}\nRegistado por: ${params.userName}`,
    }).catch(() => {});
  } else if (!fermentacaoCompleta && estadoAnterior !== "completa") {
    // Só repor em_fermentacao se a cuba não foi já terminada manualmente
    await updateCubaEstado(params.cuba.id, "em_fermentacao");
  }

  const alertas = calcularAlertas({
    tempPretendida: params.cuba.tempPretendida,
    desvioTempAlerta: params.cuba.desvioTempAlerta ?? "5.0",
    desvioDesnsAlerta: params.cuba.desvioDesnsAlerta ?? "0.010",
    alertasDensidade: params.cuba.alertasDensidade,
    pontoAguardentacao: params.cuba.pontoAguardentacao,
    desvioAguardentacaoAlerta: params.cuba.desvioAguardentacaoAlerta ?? "0.50",
    tempL1: params.leituraInput.tempL1,
    densL1: params.leituraInput.densL1,
    baumeL1: params.leituraInput.baumeL1,
    leituraAnterior: params.leituraAnterior,
  });

  if (alertas.length > 0) {
    const nomeCuba = params.cuba.nomeLote
      ? `${params.cuba.codigo} (${params.cuba.nomeLote})`
      : params.cuba.codigo;
    await notifyOwner({
      title: `⚠️ Alerta de Fermentação — ${nomeCuba.toUpperCase()}`,
      content: alertas.join("\n") + `\nDia de fermentação: ${params.diaNr}\nRegistado por: ${params.userName}`,
    }).catch(() => {});
    // Registar cada alerta no histórico
    for (const alerta of alertas) {
      // Extrair valor do alerta (ex: "Temperatura alta: 22.5°C" → "22.5°C")
      const match = alerta.match(/:\s*(.+)$/);
      const valorAlerta = match ? match[1].trim() : null;
      // Determinar tipo
      let tipoAlerta = "outro";
      if (alerta.toLowerCase().includes("temperatura")) tipoAlerta = alerta.toLowerCase().includes("alta") ? "temperatura_alta" : "temperatura_baixa";
      else if (alerta.toLowerCase().includes("densidade")) tipoAlerta = "densidade_limite";
      else if (alerta.toLowerCase().includes("baumé") || alerta.toLowerCase().includes("baume")) tipoAlerta = "baume_alerta";
      else if (alerta.toLowerCase().includes("aguardentação") || alerta.toLowerCase().includes("aguardentacao")) tipoAlerta = "aguardentacao";
      await registarAlerta({
        cubaId: params.cuba.id,
        fermentacaoNum: params.diaNr > 0 ? undefined : 1,
        tipoAlerta,
        valorAlerta,
      }).catch(() => {});
    }
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

  create: editProcedure
    .input(
      z.object({
        cubaId: z.number(),
        fermentacaoNum: z.number(),
        dataLeitura: z.string(),
        densL1: z.string().nullable().optional(),
        tempL1: z.string().nullable().optional(),
        o2: z.string().nullable().optional(),
        redox: z.string().nullable().optional(),
        baumeL1: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

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
        tempL1: input.tempL1,
        o2: input.o2,
        redox: input.redox,
        baumeL1: input.baumeL1,
        userId: ctx.user.id,
        userName,
      });

      const cubaRows = await db.select().from(cubas).where(eq(cubas.id, input.cubaId)).limit(1);
      const cuba = cubaRows[0];
      let fermentacaoCompleta = false;
      let alertas: string[] = [];

      if (cuba) {
        // Se a cuba está 'completa' ou 'sem_dados' e estão a ser inseridas leituras,
        // mudar automaticamente para 'em_fermentacao' (novo vinho entrou)
        if (cuba.estado === "completa" || cuba.estado === "sem_dados") {
          await updateCubaEstado(cuba.id, "em_fermentacao");
          cuba.estado = "em_fermentacao";
        }

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
          densidades: [input.densL1],
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

  edit: editProcedure
    .input(
      z.object({
        id: z.number(),
        densL1: z.string().nullable().optional(),
        tempL1: z.string().nullable().optional(),
        o2: z.string().nullable().optional(),
        redox: z.string().nullable().optional(),
        baumeL1: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      const userName = ctx.user.name ?? ctx.user.email ?? "Utilizador";

      const leituraExistente = await getLeituraById(id);
      if (!leituraExistente) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Leitura não encontrada" });
      }

      await editarLeitura(id, {
        ...data,
        editedBy: ctx.user.id,
        editedByName: userName,
      });

      const db = await getDb();
      let alertas: string[] = [];
      if (db) {
        const cubaRows = await db.select().from(cubas).where(eq(cubas.id, leituraExistente.cubaId)).limit(1);
        const cuba = cubaRows[0];
        if (cuba) {
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
            densidades: [data.densL1],
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

  registarLote: editProcedure
    .input(
      z.object({
        dataLeitura: z.string(),
        leituras: z
          .array(
            z.object({
              cubaId: z.number(),
              fermentacaoNum: z.number(),
              hora: z.string().nullable().optional(),
              densL1: z.string().nullable().optional(),
              baumeL1: z.string().nullable().optional(),
              tempL1: z.string().nullable().optional(),
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
      const alertasCubas: { cubaId: number; codigo: string; nomeLote: string | null; densidadeAtual: string; densidadeLimite: string }[] = [];
      const userName = ctx.user.name ?? ctx.user.email ?? "Utilizador";

      for (const linha of input.leituras) {
        try {
          // Verificar duplicado antes de criar (cuba + data + hora)
          const isDuplicado = await leituraExistePorData(linha.cubaId, input.dataLeitura, linha.hora ?? null);
          if (isDuplicado) {
            resultados.push({ cubaId: linha.cubaId, success: false, erro: "Leitura j\u00e1 existe para esta cuba, data e hora" });
            continue;
          }

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
            hora: linha.hora ?? null,
            diaNr,
            densL1: linha.densL1,
            baumeL1: linha.baumeL1 ?? null,
            tempL1: linha.tempL1,
            o2: linha.o2,
            redox: linha.redox,
            userId: ctx.user.id,
            userName,
          });

          const cubaRows = await db.select().from(cubas).where(eq(cubas.id, linha.cubaId)).limit(1);
          const cuba = cubaRows[0];
          let alertas: string[] = [];
          if (cuba) {
            // Se a cuba está 'completa' ou 'sem_dados', mudar para 'em_fermentacao' (novo vinho entrou)
            if (cuba.estado === "completa" || cuba.estado === "sem_dados") {
              await updateCubaEstado(cuba.id, "em_fermentacao");
              cuba.estado = "em_fermentacao";
            }

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
              densidades: [linha.densL1],
              leituraInput: linha,
              leituraAnterior,
              diaNr,
              userName,
            });
            alertas = resultado.alertas;
            // Verificar se atingiu o limite de densidade (sem marcar completa — utilizador confirma)
            const densAtual = linha.densL1 ?? null;
            const limite = cuba.densidadeLimite ?? "1.000";
            // cuba.estado já foi actualizado acima para 'em_fermentacao' se era 'completa'
            if (densAtual && parseFloat(densAtual) <= parseFloat(limite) && cuba.estado === "em_fermentacao") {
              alertasCubas.push({
                cubaId: cuba.id,
                codigo: cuba.codigo,
                nomeLote: cuba.nomeLote ?? null,
                densidadeAtual: densAtual,
                densidadeLimite: limite,
              });
            }
          }

          resultados.push({ cubaId: linha.cubaId, success: true, alertas });
        } catch (err) {
          resultados.push({ cubaId: linha.cubaId, success: false, erro: String(err) });
        }
      }

      return { resultados, total: input.leituras.length, sucesso: resultados.filter((r) => r.success).length, alertasCubas };
    }),

  listAllDashboard: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const cubasAtivas = await db.select().from(cubas).where(eq(cubas.estado, "em_fermentacao"));
    if (cubasAtivas.length === 0) return [];
    const todasLeituras: Array<{
      cubaId: number; fermentacaoNum: number;
      densL1: string | null;
      tempL1: string | null;
    }> = [];
    for (const cuba of cubasAtivas) {
      const rows = await getLeiturasByCuba(cuba.id, cuba.fermentacaoNum);
      for (const r of rows) {
        todasLeituras.push({
          cubaId: cuba.id,
          fermentacaoNum: cuba.fermentacaoNum,
          densL1: r.densL1 ?? null,
          tempL1: r.tempL1 ?? null,
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
      const allDens = rows.map((r) => r.densL1).filter((v): v is string => v !== null).map(Number);
      const allTemp = rows.map((r) => r.tempL1).filter((v): v is string => v !== null).map(Number);
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

  create: editProcedure
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

  delete: editProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteAdicao(input.id);
      return { success: true };
    }),
});

// ── Função auxiliar: terminar uma fermentação (reutilizável) ──────────────
async function terminarFermentacaoCuba(cubaId: number, nomeLote?: string | null, archivedBy = "Sistema") {
  const db = await getDb();
  if (!db) return;

  const cubaRows = await db.select().from(cubas).where(eq(cubas.id, cubaId)).limit(1);
  const cuba = cubaRows[0];
  if (!cuba) return;
  if (cuba.estado !== "em_fermentacao") return; // só termina se estiver activa

  const fermentacaoAtual = cuba.fermentacaoNum;
  const rows = await getLeiturasByCuba(cubaId, fermentacaoAtual);

  let dataInicio: string | null = null;
  let dataFim: string | null = null;
  let totalDias: number | null = null;
  let densMin: string | null = null;
  let tempMax: string | null = null;

  if (rows.length > 0) {
    dataInicio = rows[0].dataLeitura;
    dataFim = rows[rows.length - 1].dataLeitura;
    totalDias = rows[rows.length - 1].diaNr ?? rows.length;
    const allDens = rows.map((r) => r.densL1).filter((v): v is string => v !== null).map(Number);
    const allTemp = rows.map((r) => r.tempL1).filter((v): v is string => v !== null).map(Number);
    if (allDens.length > 0) densMin = Math.min(...allDens).toFixed(4);
    if (allTemp.length > 0) tempMax = Math.max(...allTemp).toFixed(1);
  }

  const nomeLoteArquivo = nomeLote ?? cuba.nomeLote;

  await createArquivo({
    cubaId,
    fermentacaoNum: fermentacaoAtual,
    tipoCuba: cuba.tipoCuba,
    nomeLote: nomeLoteArquivo,
    dataInicio,
    dataFim,
    totalDias,
    densMin,
    tempMax,
    archivedBy,
  });

  // Associar à campanha activa
  try {
    const arquivoInserido = await db
      .select()
      .from(fermentacoesArquivo)
      .where(eq(fermentacoesArquivo.cubaId, cubaId))
      .orderBy(desc(fermentacoesArquivo.id))
      .limit(1);
    if (arquivoInserido[0]) {
      await associarCampanhaArquivo(arquivoInserido[0].id);
    }
  } catch (_e) { /* ignorar erros de campanha */ }

  // Estado = completa, fermentacaoNum incrementa
  await db
    .update(cubas)
    .set({ nomeLote: null, estado: "completa", fermentacaoNum: fermentacaoAtual + 1 })
    .where(eq(cubas.id, cubaId));
}

// ── Router de Arquivo / Nova Fermentação ──────────────────
const arquivoRouter = router({
  listByCuba: publicProcedure
    .input(z.object({ cubaId: z.number() }))
    .query(async ({ input }) => {
      return getArquivoByCuba(input.cubaId);
    }),

  // terminarFermentacao: arquiva a fermentação actual, envia email, estado=completa
  // O fermentacaoNum NÃO muda — a cuba fica vazia mas com o mesmo número arquivado
  terminarFermentacao: editProcedure
    .input(
      z.object({
        cubaId: z.number(),
        nomeLote: z.string().optional(),
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
        dataInicio = rows[0].dataLeitura;
        dataFim = rows[rows.length - 1].dataLeitura;
        totalDias = rows[rows.length - 1].diaNr ?? rows.length;
        const allDens = rows.map((r) => r.densL1).filter((v): v is string => v !== null).map(Number);
        const allTemp = rows.map((r) => r.tempL1).filter((v): v is string => v !== null).map(Number);
        if (allDens.length > 0) densMin = Math.min(...allDens).toFixed(4);
        if (allTemp.length > 0) tempMax = Math.max(...allTemp).toFixed(1);
      }

      // Usar nomeLote fornecido ou manter o actual
      const nomeLoteArquivo = input.nomeLote ?? cuba[0].nomeLote;

      await createArquivo({
        cubaId: input.cubaId,
        fermentacaoNum: fermentacaoAtual,
        tipoCuba: cuba[0].tipoCuba,
        nomeLote: nomeLoteArquivo,
        dataInicio,
        dataFim,
        totalDias,
        densMin,
        tempMax,
        archivedBy: ctx.user.name ?? ctx.user.email ?? "Utilizador",
      });

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

      // Estado = completa, fermentacaoNum incrementa (cuba fica limpa para nova fermentação)
      const novoFermentacaoNum = fermentacaoAtual + 1;
      await db
        .update(cubas)
        .set({
          nomeLote: null, // limpar nome do lote — cuba fica vazia
          estado: "completa",
          fermentacaoNum: novoFermentacaoNum,
        })
        .where(eq(cubas.id, input.cubaId));

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

      return { success: true, fermentacaoArquivadaNum: fermentacaoAtual };
    }),

  // novaFermentacao: reinicia a cuba (só disponível quando estado=completa)
  // Incrementa fermentacaoNum, limpa nomeLote, estado=em_fermentacao
  novaFermentacao: editProcedure
    .input(
      z.object({
        cubaId: z.number(),
        nomeLoteNovo: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const cuba = await db
        .select()
        .from(cubas)
        .where(eq(cubas.id, input.cubaId))
        .limit(1);
      if (!cuba[0]) throw new TRPCError({ code: "NOT_FOUND" });
      if (cuba[0].estado !== "completa") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "A cuba tem de estar no estado 'completa' para iniciar nova fermentação" });
      }

      // fermentacaoNum já foi incrementado pelo terminarFermentacao
      // Apenas mudar estado e definir nome do lote
      await db
        .update(cubas)
        .set({
          nomeLote: input.nomeLoteNovo ?? null,
          estado: "em_fermentacao",
        })
        .where(eq(cubas.id, input.cubaId));

      return { success: true, novaFermentacaoNum: cuba[0].fermentacaoNum };
    }),
});

// ── Router de Arquivo / Nova Fermentação (extensão) ─────────
const arquivoDetalheRouter = router({
  getLeituras: publicProcedure
    .input(z.object({ cubaId: z.number(), fermentacaoNum: z.number() }))
    .query(async ({ input }) => {
      return getLeiturasByCuba(input.cubaId, input.fermentacaoNum);
    }),

  getAdicoes: publicProcedure
    .input(z.object({ cubaId: z.number(), fermentacaoNum: z.number() }))
    .query(async ({ input }) => {
      return getAdicoesByCuba(input.cubaId, input.fermentacaoNum);
    }),

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
  enviarCuba: editProcedure
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

  exportarExcelArquivo: publicProcedure
    .input(z.object({ codigo: z.string(), fermentacaoNum: z.number() }))
    .mutation(async ({ input }) => {
      const cuba = await getCubaByCodigo(input.codigo);
      if (!cuba) throw new TRPCError({ code: "NOT_FOUND", message: "Cuba n\u00e3o encontrada" });
      // Usar fermentacaoNum do arquivo em vez do actual
      const cubaArquivo = { ...cuba, fermentacaoNum: input.fermentacaoNum };
      // Buscar nomeLote do arquivo
      const db = await getDb();
      if (db) {
        const arq = await db.select().from(fermentacoesArquivo)
          .where(and(eq(fermentacoesArquivo.cubaId, cuba.id), eq(fermentacoesArquivo.fermentacaoNum, input.fermentacaoNum)))
          .limit(1);
        if (arq[0]?.nomeLote) cubaArquivo.nomeLote = arq[0].nomeLote;
        const leiturasArquivo = await getLeiturasByCuba(cuba.id, input.fermentacaoNum);
        cubaArquivo.tipoCuba = tipoCubaArquivo(arq[0]?.tipoCuba, leiturasArquivo);
      }
      const { gerarExcelCuba } = await import("./emailReport");
      const buffer = await gerarExcelCuba(cubaArquivo);
      const base64 = Buffer.from(buffer as unknown as ArrayBuffer).toString("base64");
      const nomeLote = cubaArquivo.nomeLote ?? cuba.codigo.toUpperCase();
      const nomeFicheiro = `${cuba.codigo}_${nomeLote.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "")}_ferm${input.fermentacaoNum}.xlsx`;
      return { base64, nomeFicheiro };
    }),

  exportarPdfArquivo: publicProcedure
    .input(z.object({ codigo: z.string(), fermentacaoNum: z.number() }))
    .mutation(async ({ input }) => {
      const cuba = await getCubaByCodigo(input.codigo);
      if (!cuba) throw new TRPCError({ code: "NOT_FOUND", message: "Cuba n\u00e3o encontrada" });
      const cubaArquivo = { ...cuba, fermentacaoNum: input.fermentacaoNum };
      const db = await getDb();
      if (db) {
        const arq = await db.select().from(fermentacoesArquivo)
          .where(and(eq(fermentacoesArquivo.cubaId, cuba.id), eq(fermentacoesArquivo.fermentacaoNum, input.fermentacaoNum)))
          .limit(1);
        if (arq[0]?.nomeLote) cubaArquivo.nomeLote = arq[0].nomeLote;
        const leiturasArquivo = await getLeiturasByCuba(cuba.id, input.fermentacaoNum);
        cubaArquivo.tipoCuba = tipoCubaArquivo(arq[0]?.tipoCuba, leiturasArquivo);
      }
      const { gerarPdfCuba } = await import("./pdfReport");
      const buffer = await gerarPdfCuba(cubaArquivo);
      const base64 = buffer.toString("base64");
      const nomeLote = cubaArquivo.nomeLote ?? cuba.codigo.toUpperCase();
      const nomeFicheiro = `${cuba.codigo}_${nomeLote.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "")}_ferm${input.fermentacaoNum}.pdf`;
      return { base64, nomeFicheiro };
    }),

  enviarDigestDiario: editProcedure
    .mutation(async () => {
      const { gerarExcelDigestDiario, enviarEmailComExcel } = await import("./emailReport");
      const buffer = await gerarExcelDigestDiario();

      const dataHoje = new Date().toLocaleDateString("pt-PT");
      const cubasAll = await getAllCubas();
      const ativas = cubasAll.filter(c => c.estado === "em_fermentacao");

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
  criar: adminProcedure
    .input(z.object({ nome: z.string().min(1).max(60), descricao: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      let cubasFechadas = 0;

      // 1. Terminar todas as cubas em fermentação antes de criar a nova campanha
      if (db) {
        const cubasActivas = await db
          .select()
          .from(cubas)
          .where(eq(cubas.estado, "em_fermentacao"));

        for (const cuba of cubasActivas) {
          try {
            await terminarFermentacaoCuba(
              cuba.id,
              cuba.nomeLote,
              ctx.user.name ?? ctx.user.email ?? "Nova Campanha"
            );
            cubasFechadas++;
          } catch (err) {
            console.warn(`[Campanha] Erro ao fechar cuba ${cuba.codigo}:`, err);
          }
        }
      }

      // 2. Criar a nova campanha (desactiva a anterior e activa esta)
      await createCampanha({ nome: input.nome, descricao: input.descricao });

      console.log(`[Campanha] Nova campanha '${input.nome}' criada. ${cubasFechadas} fermentações fechadas automaticamente.`);
      return { success: true, cubasFechadas };
    }),
  ativar: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await ativarCampanha(input.id);
      return { success: true };
    }),
  arquivoByCuba: publicProcedure
    .input(z.object({ cubaId: z.number(), campanhaId: z.number().optional() }))
    .query(async ({ input }) => getArquivoByCubaCampanha(input.cubaId, input.campanhaId)),
  fermentacoesByCampanha: publicProcedure
    .input(z.object({ campanhaId: z.number() }))
    .query(async ({ input }) => getFermentacoesByCampanha(input.campanhaId)),
});

// ── Router de Pesquisa Global ───────────────────────────
const pesquisaRouter = router({
  global: publicProcedure
    .input(z.object({ termo: z.string().min(1).max(100) }))
    .query(async ({ input }) => {
      return pesquisarGlobal(input.termo);
    }),
});

// ── Router de Recepções de Uvas ───────────────────────────
const recepcaoRouter = router({
  list: publicProcedure.query(async () => {
    const todas = await getAllRecepcoes();
    // Para cada recepção, buscar a distribuição por cubas
    const result = await Promise.all(
      todas.map(async (r) => ({
        ...r,
        distribuicao: await getRecepcaoCubasByRecepcao(r.id),
      }))
    );
    return result;
  }),

  byCuba: publicProcedure
    .input(z.object({ cubaId: z.number() }))
    .query(async ({ input }) => getRecepcoesByCuba(input.cubaId)),

  criar: editProcedure
    .input(z.object({
      dataRecepcao: z.string(),
      casta: z.string().optional(),
      kgTotal: z.number().positive(),
      notas: z.string().optional(),
      campanhaId: z.number().optional(),
      distribuicao: z.array(z.object({
        cubaId: z.number(),
        kg: z.number().positive(),
        notas: z.string().optional(),
      })).min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const id = await createRecepcao(
        {
          dataRecepcao: input.dataRecepcao,
          casta: input.casta ?? null,
          kgTotal: String(input.kgTotal),
          notas: input.notas ?? null,
          campanhaId: input.campanhaId ?? null,
          userId: ctx.user.id,
          userName: ctx.user.name ?? ctx.user.email ?? null,
        },
        input.distribuicao
      );
      // Actualizar fichaKilos de cada cuba com os kg atribuídos e mudar estado para em_fermentacao
      const db = await getDb();
      if (db) {
        for (const d of input.distribuicao) {
          await db
            .update(cubas)
            .set({
              fichaKilos: String(d.kg),
              estado: "em_fermentacao",
            })
            .where(eq(cubas.id, d.cubaId));
        }
      }
      return { id };
    }),

  eliminar: editProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteRecepcao(input.id);
      return { ok: true };
    }),
});

// ── Router de Movimentos de Cuba ──────────────────────────
const movimentosRouter = router({
  list: publicProcedure.query(async () => getAllMovimentos()),

  byCuba: publicProcedure
    .input(z.object({ cubaId: z.number() }))
    .query(async ({ input }) => getMovimentosByCuba(input.cubaId)),

  /**
   * Transferência: move a fermentação de uma cuba para outra.
   * - Cuba de origem fica com estado=completa (vazia)
   * - Cuba de destino herda nomeLote, fichaKilos e fichaLitros da origem
   * - Leituras e adições da origem são copiadas para o destino (mesmo fermentacaoNum)
   */
  transferir: editProcedure
    .input(z.object({
      cubaOrigemId: z.number(),
      /** Lista de destinos: [{cubaId, litros, cubaCodigo}] */
      destinos: z.array(z.object({
        cubaId: z.number(),
        litros: z.number().positive(),
        cubaCodigo: z.string(),
      })).min(1),
      dataMovimento: z.string(),
      motivo: z.string().optional(),
      campanhaId: z.number().optional(),
      /** Se true, o volume restante fica na cuba de origem (transferência parcial) */
      restaOrigem: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de dados indisponível" });

      // Validar que origem não está nos destinos (a menos que seja transferência parcial)
      if (!input.restaOrigem && input.destinos.some((d) => d.cubaId === input.cubaOrigemId)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "A cuba de origem não pode ser destino" });
      }

      // Buscar cuba de origem
      const origemRows = await db.select().from(cubas).where(eq(cubas.id, input.cubaOrigemId)).limit(1);
      const origem = origemRows[0];
      if (!origem) throw new TRPCError({ code: "NOT_FOUND", message: "Cuba de origem não encontrada" });

      const fermentacaoNumOrigem = origem.fermentacaoNum;

      // Buscar todas as cubas de destino
      const destinoIds = input.destinos.map((d) => d.cubaId);
      const destinoRows = await db.select().from(cubas).where(inArray(cubas.id, destinoIds));
      const destinoMap = new Map(destinoRows.map((c) => [c.id, c]));

      // Obter leituras e adições da origem
      const leiturasOrigem = await db
        .select()
        .from(leituras)
        .where(and(eq(leituras.cubaId, input.cubaOrigemId), eq(leituras.fermentacaoNum, fermentacaoNumOrigem)));

      const adicoesOrigem = await db
        .select()
        .from(adicoes)
        .where(and(eq(adicoes.cubaId, input.cubaOrigemId), eq(adicoes.fermentacaoNum, fermentacaoNumOrigem)));

      // Para cada destino: copiar leituras, adições e herdar ficha
      for (const dest of input.destinos) {
        const destino = destinoMap.get(dest.cubaId);
        if (!destino) throw new TRPCError({ code: "NOT_FOUND", message: `Cuba destino ${dest.cubaCodigo} não encontrada` });

        // Copiar leituras
        if (leiturasOrigem.length > 0) {
          await db.insert(leituras).values(
            leiturasOrigem.map((l) => ({
              cubaId: dest.cubaId,
              fermentacaoNum: destino.fermentacaoNum,
              campanhaId: l.campanhaId,
              dataLeitura: l.dataLeitura,
              hora: l.hora,
              diaNr: l.diaNr,
              densL1: l.densL1,
              tempL1: l.tempL1,
              o2: l.o2,
              redox: l.redox,
              baumeL1: l.baumeL1,
              userId: l.userId,
              userName: l.userName,
            }))
          );
        }

        // Copiar adições
        if (adicoesOrigem.length > 0) {
          await db.insert(adicoes).values(
            adicoesOrigem.map((a) => ({
              cubaId: dest.cubaId,
              fermentacaoNum: destino.fermentacaoNum,
              campanhaId: a.campanhaId,
              dataAdicao: a.dataAdicao,
              produto: a.produto,
              dose: a.dose,
              observacoes: a.observacoes,
              userId: a.userId,
              userName: a.userName,
            }))
          );
        }

        // Copiar comentários da origem para o destino
        await copiarComentarios(input.cubaOrigemId, dest.cubaId, destino.fermentacaoNum, `${origem.codigo.toUpperCase()} (transferência ${input.dataMovimento})`);

        // Actualizar destino: herda nomeLote e ficha (blend: soma litros se já tem vinho)
        const litrosTotal = origem.fichaLitros ? parseFloat(origem.fichaLitros) : null;
        const litrosDest = dest.litros;
        const proporcao = litrosTotal && litrosTotal > 0 ? litrosDest / litrosTotal : 1;
        const destinoActual = destinoMap.get(dest.cubaId);
        const jaTemVinho = destinoActual?.estado === "em_fermentacao";
        const litrosDestinoActual = destinoActual?.fichaLitros ? parseFloat(destinoActual.fichaLitros) : 0;
        await db.update(cubas).set({
          // Blend: se já tem vinho, manter nomeLote existente; caso contrário herdar da origem
          nomeLote: jaTemVinho ? destinoActual?.nomeLote : origem.nomeLote,
          estado: "em_fermentacao",
          fichaKilos: origem.fichaKilos ? String(Math.round(parseFloat(origem.fichaKilos) * proporcao * 10) / 10) : null,
          // Blend: somar litros se já tem vinho
          fichaLitros: String(litrosDest + (jaTemVinho ? litrosDestinoActual : 0)),
          // Blend: activar aviso de análises pendentes
          analisesPendentes: jaTemVinho,
          fichaPh: jaTemVinho ? destinoActual?.fichaPh : origem.fichaPh,
          fichaAt: jaTemVinho ? destinoActual?.fichaAt : origem.fichaAt,
          fichaAv: jaTemVinho ? destinoActual?.fichaAv : origem.fichaAv,
          fichaNfa: jaTemVinho ? destinoActual?.fichaNfa : origem.fichaNfa,
          fichaNtu: jaTemVinho ? destinoActual?.fichaNtu : origem.fichaNtu,
          fichaGluconico: jaTemVinho ? destinoActual?.fichaGluconico : origem.fichaGluconico,
          fichaAlcoolProvavel: jaTemVinho ? destinoActual?.fichaAlcoolProvavel : origem.fichaAlcoolProvavel,
        }).where(eq(cubas.id, dest.cubaId));
      }

      // Esvaziar a origem (ou actualizar litros se transferência parcial)
      const litrosTransferidos = input.destinos.reduce((s, d) => s + d.litros, 0);
      const litrosOrigemTotal = origem.fichaLitros ? parseFloat(origem.fichaLitros) : 0;
      const litrosRestantes = litrosOrigemTotal - litrosTransferidos;
      if (input.restaOrigem && litrosRestantes > 0) {
        // Transferência parcial: actualizar litros da origem
        await db.update(cubas).set({
          fichaLitros: String(Math.max(0, litrosRestantes)),
        }).where(eq(cubas.id, input.cubaOrigemId));
      } else {
        // Transferência total: esvaziar a origem
        await db.update(cubas).set({
          estado: "completa",
          nomeLote: null,
          fermentacaoNum: fermentacaoNumOrigem + 1,
          fichaKilos: null,
          fichaLitros: null,
          fichaPh: null,
          fichaAt: null,
          fichaAv: null,
          fichaNfa: null,
          fichaNtu: null,
          fichaGluconico: null,
          fichaAlcoolProvavel: null,
        }).where(eq(cubas.id, input.cubaOrigemId));
      }

      // Registar o movimento
      await createMovimento({
        tipo: "transferencia",
        dataMovimento: input.dataMovimento,
        cubasOrigemIds: JSON.stringify([input.cubaOrigemId]),
        cubaDestinoId: input.destinos[0]?.cubaId ?? null,
        destinosJson: JSON.stringify(input.destinos),
        motivo: input.motivo ?? null,
        campanhaId: input.campanhaId ?? null,
        userId: ctx.user.id,
        userName: ctx.user.name ?? ctx.user.email ?? null,
      });

      return {
        ok: true,
        origemCodigo: origem.codigo,
        destinos: input.destinos.map((d) => d.cubaCodigo),
        leiturasCopiadas: leiturasOrigem.length,
        adicoesCopiadas: adicoesOrigem.length,
      };
    }),

  /**
   * Junção: une duas ou mais cubas numa só.
   * - Cubas de origem ficam vazias (estado=completa)
   * - Cuba de destino herda leituras e adições de todas as origens
   * - fichaKilos do destino = soma dos kg de todas as origens
   */
  juntar: editProcedure
    .input(z.object({
      cubasOrigemIds: z.array(z.number()).min(2),
      cubaDestinoId: z.number(),
      dataMovimento: z.string(),
      motivo: z.string().optional(),
      campanhaId: z.number().optional(),
      // Litros a transferir de cada cuba de origem (opcional; se omitido usa fichaLitros)
      litrosPorOrigem: z.array(z.object({
        cubaId: z.number(),
        litros: z.number().positive(),
      })).optional(),
      // Destino para litros sobrantes (se a cuba não for totalmente esvaziada)
      sobrasCubaId: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (input.cubasOrigemIds.includes(input.cubaDestinoId)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "A cuba de destino não pode ser uma das origens" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de dados indisponível" });

      const destinoRows = await db.select().from(cubas).where(eq(cubas.id, input.cubaDestinoId)).limit(1);
      const destino = destinoRows[0];
      if (!destino) throw new TRPCError({ code: "NOT_FOUND", message: "Cuba de destino não encontrada" });

      let totalKg = 0;
      let totalLitros = 0;
      let totalLeituras = 0;
      let totalAdicoes = 0;
      let nomeLoteHerdado: string | null = null;
      const sobras: { cubaId: number; codigo: string; litrosDisponiveis: number; litrosTransferidos: number; litrosSobrantes: number }[] = [];

      for (const origemId of input.cubasOrigemIds) {
        const origemRows = await db.select().from(cubas).where(eq(cubas.id, origemId)).limit(1);
        const origem = origemRows[0];
        if (!origem) continue;

        // Calcular litros desta origem
        const litrosDisponiveis = origem.fichaLitros ? parseFloat(origem.fichaLitros) : 0;
        const litrosTransferidos = input.litrosPorOrigem?.find((l) => l.cubaId === origemId)?.litros ?? litrosDisponiveis;
        const litrosSobrantes = litrosDisponiveis - litrosTransferidos;

        if (litrosSobrantes > 0.1) {
          sobras.push({ cubaId: origemId, codigo: origem.codigo, litrosDisponiveis, litrosTransferidos, litrosSobrantes });
        }

        // Copiar leituras
        const leiturasOrigem = await db
          .select()
          .from(leituras)
          .where(and(eq(leituras.cubaId, origemId), eq(leituras.fermentacaoNum, origem.fermentacaoNum)));

        if (leiturasOrigem.length > 0) {
          await db.insert(leituras).values(
            leiturasOrigem.map((l) => ({
              cubaId: input.cubaDestinoId,
              fermentacaoNum: destino.fermentacaoNum,
              campanhaId: l.campanhaId,
              dataLeitura: l.dataLeitura,
              hora: l.hora,
              diaNr: l.diaNr,
              densL1: l.densL1,
              tempL1: l.tempL1,
              o2: l.o2,
              redox: l.redox,
              baumeL1: l.baumeL1,
              userId: l.userId,
              userName: l.userName,
            }))
          );
          totalLeituras += leiturasOrigem.length;
        }

        // Copiar adições
        const adicoesOrigem = await db
          .select()
          .from(adicoes)
          .where(and(eq(adicoes.cubaId, origemId), eq(adicoes.fermentacaoNum, origem.fermentacaoNum)));

        if (adicoesOrigem.length > 0) {
          await db.insert(adicoes).values(
            adicoesOrigem.map((a) => ({
              cubaId: input.cubaDestinoId,
              fermentacaoNum: destino.fermentacaoNum,
              campanhaId: a.campanhaId,
              dataAdicao: a.dataAdicao,
              produto: a.produto,
              dose: a.dose,
              observacoes: a.observacoes,
              userId: a.userId,
              userName: a.userName,
            }))
          );
          totalAdicoes += adicoesOrigem.length;
        }

        // Copiar comentários da origem para o destino
        await copiarComentarios(origemId, input.cubaDestinoId, destino.fermentacaoNum, `${origem.codigo.toUpperCase()} (junção ${input.dataMovimento})`);

        // Acumular kg e litros transferidos
        if (origem.fichaKilos) totalKg += parseFloat(origem.fichaKilos);
        totalLitros += litrosTransferidos;
        if (!nomeLoteHerdado && origem.nomeLote) nomeLoteHerdado = origem.nomeLote;

        // Esvaziar a origem (ou actualizar com sobras se houver)
        if (litrosSobrantes > 0.1 && input.sobrasCubaId && input.sobrasCubaId !== origemId) {
          // Manter a cuba de origem com os litros sobrantes
          await db.update(cubas).set({
            fichaLitros: String(Math.round(litrosSobrantes * 10) / 10),
          }).where(eq(cubas.id, origemId));
        } else {
          // Esvaziar completamente
          await db.update(cubas).set({
            estado: "completa",
            nomeLote: null,
            fermentacaoNum: origem.fermentacaoNum + 1,
            fichaKilos: null,
            fichaLitros: null,
          }).where(eq(cubas.id, origemId));
        }
      }

      // Actualizar destino com litros somados
      const litrosDestinoActuais = destino.fichaLitros ? parseFloat(destino.fichaLitros) : 0;
      const litrosDestinoTotal = litrosDestinoActuais + totalLitros;
      // Junção de vinhos diferentes → activar aviso de análises pendentes
      const eBlend = input.cubasOrigemIds.length >= 2 || litrosDestinoActuais > 0;
      await db.update(cubas).set({
        estado: "em_fermentacao",
        nomeLote: nomeLoteHerdado ?? destino.nomeLote,
        fichaKilos: totalKg > 0 ? String(totalKg) : destino.fichaKilos,
        fichaLitros: litrosDestinoTotal > 0 ? String(Math.round(litrosDestinoTotal)) : destino.fichaLitros,
        analisesPendentes: eBlend,
      }).where(eq(cubas.id, input.cubaDestinoId));

      // Registar o movimento
      const motivoComLitros = [
        input.motivo,
        input.litrosPorOrigem ? `Litros: ${input.litrosPorOrigem.map((l) => `${l.litros}L`).join(" + ")}` : null,
        sobras.length > 0 ? `Sobras: ${sobras.map((s) => `${s.codigo} ${s.litrosSobrantes.toFixed(0)}L`).join(", ")}` : null,
      ].filter(Boolean).join(" | ");

      await createMovimento({
        tipo: "juncao",
        dataMovimento: input.dataMovimento,
        cubasOrigemIds: JSON.stringify(input.cubasOrigemIds),
        cubaDestinoId: input.cubaDestinoId,
        motivo: motivoComLitros || null,
        campanhaId: input.campanhaId ?? null,
        userId: ctx.user.id,
        userName: ctx.user.name ?? ctx.user.email ?? null,
      });

      return {
        ok: true,
        destinoCodigo: destino.codigo,
        leiturasCopiadas: totalLeituras,
        adicoesCopiadas: totalAdicoes,
        kgTotal: totalKg,
        litrosTotal: litrosDestinoTotal,
        sobras,
      };
    }),
});



// ── Router de Protocolos de Fermentação ────────────────────
const protocoloEtapaInput = z.object({
  id: z.number().optional(),
  ordem: z.number().int().min(1),
  titulo: z.string().trim().min(1).max(160),
  descricao: z.string().trim().max(2000).nullable().optional(),
  tipoEtapa: z.enum(["adicao", "controlo", "manual"]),
  gatilhoTipo: z.enum(["densidade", "baume", "temperatura", "dia", "manual"]),
  operador: z.enum(["menor_igual", "maior_igual", "igual"]).nullable().optional(),
  valorGatilho: z.string().nullable().optional(),
  produto: z.string().trim().max(200).nullable().optional(),
  dosePorHl: z.string().nullable().optional(),
  doseUnidade: z.string().trim().max(30).nullable().optional(),
  instrucoes: z.string().trim().max(3000).nullable().optional(),
});

const protocolosRouter = router({
  list: publicProcedure
    .input(z.object({ apenasAtivos: z.boolean().optional() }).optional())
    .query(({ input }) => listarProtocolos(input?.apenasAtivos ?? false)),

  get: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const protocolo = await obterProtocolo(input.id);
      if (!protocolo) throw new TRPCError({ code: "NOT_FOUND", message: "Protocolo não encontrado" });
      return protocolo;
    }),

  criar: editProcedure
    .input(z.object({
      nome: z.string().trim().min(1).max(160),
      descricao: z.string().trim().max(3000).nullable().optional(),
      tipoCuba: z.enum(["vinho", "porto", "todos"]),
      etapas: z.array(protocoloEtapaInput).max(30),
    }))
    .mutation(async ({ input, ctx }) => {
      const id = await criarProtocolo({
        ...input,
        userId: ctx.user.id,
        userName: ctx.user.name ?? ctx.user.email ?? undefined,
      });
      return { success: true, id };
    }),

  actualizar: editProcedure
    .input(z.object({
      id: z.number(),
      nome: z.string().trim().min(1).max(160),
      descricao: z.string().trim().max(3000).nullable().optional(),
      tipoCuba: z.enum(["vinho", "porto", "todos"]),
      etapas: z.array(protocoloEtapaInput).max(30),
    }))
    .mutation(async ({ input }) => {
      try {
        await atualizarProtocolo(input);
        return { success: true, id: input.id };
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Não foi possível actualizar o protocolo" });
      }
    }),

  definirEstado: editProcedure
    .input(z.object({ id: z.number(), ativo: z.boolean() }))
    .mutation(async ({ input }) => {
      await definirEstadoProtocolo(input.id, input.ativo);
      return { success: true };
    }),

  atribuirACuba: editProcedure
    .input(z.object({ cubaId: z.number(), protocoloId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      try {
        const protocoloCubaId = await atribuirProtocoloACuba({
          ...input,
          userId: ctx.user.id,
          userName: ctx.user.name ?? ctx.user.email ?? undefined,
        });
        return { success: true, protocoloCubaId };
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Não foi possível atribuir o protocolo" });
      }
    }),

  daCuba: publicProcedure
    .input(z.object({ cubaId: z.number() }))
    .query(({ input }) => obterProtocoloDaCuba(input.cubaId)),

  concluirEtapa: editProcedure
    .input(z.object({
      etapaCubaId: z.number(),
      estado: z.enum(["concluida", "dispensada"]),
      observacoes: z.string().trim().max(3000).nullable().optional(),
      registarAdicao: z.boolean().optional(),
      doseReal: z.string().trim().max(100).nullable().optional(),
      data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await concluirEtapaDeProtocolo({
        ...input,
        userId: ctx.user.id,
        userName: ctx.user.name ?? ctx.user.email ?? undefined,
      });
      return { success: true };
    }),
});

// ── Router de Login Local ─────────────────────────────────
const localAuthRouter = router({
  login: publicProcedure
    .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const user = await verifyLocalUserPassword(input.email, input.password);
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Email ou password incorrectos." });
      const { sdk } = await import("./_core/sdk");
      const openId = `local_${user.id}`;
      const sessionToken = await sdk.createSessionToken(openId, { name: user.name, expiresInMs: 365 * 24 * 60 * 60 * 1000 });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: 365 * 24 * 60 * 60 * 1000 });
      // O papel definido na conta local (`local_users.role`) e propagado para a
      // tabela `users`, que e a fonte usada por `protectedProcedure` e
      // `adminProcedure`. Sem isto, um administrador local perderia as
      // permissoes de administracao ao iniciar sessao.
      await upsertUser({
        openId,
        name: user.name,
        email: user.email,
        loginMethod: "local",
        role: user.role,
        lastSignedIn: new Date(),
      });
      return { ok: true, name: user.name, email: user.email };
    }),

  list: adminProcedure.query(async () => {
    return getAllLocalUsers();
  }),

  criar: adminProcedure
    .input(z.object({ email: z.string().email(), name: z.string().min(1), password: z.string().min(6) }))
    .mutation(async ({ input }) => {
      const existing = await getLocalUserByEmail(input.email);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "Já existe um utilizador com este email." });
      return createLocalUser(input.email, input.name, input.password);
    }),

  alterarPassword: adminProcedure
    .input(z.object({ id: z.number(), newPassword: z.string().min(6) }))
    .mutation(async ({ input }) => {
      await updateLocalUserPassword(input.id, input.newPassword);
      return { ok: true };
    }),

  toggleActive: adminProcedure
    .input(z.object({ id: z.number(), active: z.boolean() }))
    .mutation(async ({ input }) => {
      await toggleLocalUserActive(input.id, input.active);
      return { ok: true };
    }),
});

const camposAnaliseFinal = [
  "fichaKilos", "fichaLitros", "fichaPh", "fichaAt", "fichaAv",
  "fichaNfa", "fichaNtu", "fichaGluconico", "fichaAlcoolProvavel",
  "acucaresResiduais", "acidoMalico",
] as const;

function normalizarCamposAnalise(input: Partial<Record<(typeof camposAnaliseFinal)[number], string | null | undefined>>) {
  return Object.fromEntries(camposAnaliseFinal.map((campo) => [
    campo,
    normalizarNumeroDecimal(input[campo]) ?? null,
  ])) as Record<(typeof camposAnaliseFinal)[number], string | null>;
}

// ── Análises Finais de Fermentação ─────────────────────────
const analisesFinaisRouter = router({
  byCuba: publicProcedure
    .input(z.object({ cubaId: z.number(), fermentacaoNum: z.number().optional() }))
    .query(({ input }) => getAnalisesFinaisByCuba(input.cubaId, input.fermentacaoNum)),

  criar: editProcedure
    .input(z.object({
      cubaId: z.number(),
      dataAnalise: z.string().min(10).max(10),
      fichaKilos: z.string().nullable().optional(),
      fichaLitros: z.string().nullable().optional(),
      fichaPh: z.string().nullable().optional(),
      fichaAt: z.string().nullable().optional(),
      fichaAv: z.string().nullable().optional(),
      fichaNfa: z.string().nullable().optional(),
      fichaNtu: z.string().nullable().optional(),
      fichaGluconico: z.string().nullable().optional(),
      fichaAlcoolProvavel: z.string().nullable().optional(),
      acucaresResiduais: z.string().nullable().optional(),
      acidoMalico: z.string().nullable().optional(),
      observacoes: z.string().max(4000).nullable().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de dados indisponível" });
      const cuba = (await db.select().from(cubas).where(eq(cubas.id, input.cubaId)).limit(1))[0];
      if (!cuba) throw new TRPCError({ code: "NOT_FOUND", message: "Cuba não encontrada" });
      const valores = normalizarCamposAnalise(input);
      await criarAnaliseFinal({
        cubaId: input.cubaId,
        fermentacaoNum: cuba.fermentacaoNum,
        dataAnalise: input.dataAnalise,
        ...valores,
        observacoes: input.observacoes?.trim() || null,
        userId: ctx.user.id,
        userName: ctx.user.name ?? ctx.user.email ?? null,
      });
      return { ok: true };
    }),
});

// ── Barricas ────────────────────────────────────────────────
const barricasRouter = router({
  list: publicProcedure.query(() => getAllBarricas()),
  movimentosByCuba: publicProcedure
    .input(z.object({ cubaId: z.number() }))
    .query(({ input }) => getMovimentosBarricaByCuba(input.cubaId)),
  analises: publicProcedure
    .input(z.object({ barricaId: z.number() }))
    .query(({ input }) => getAnalisesByBarrica(input.barricaId)),
  comentarios: publicProcedure
    .input(z.object({ barricaId: z.number() }))
    .query(({ input }) => getComentariosByBarrica(input.barricaId)),

  transferirDaCuba: editProcedure
    .input(z.object({
      cubaOrigemId: z.number(),
      dataMovimento: z.string().min(10).max(10),
      motivo: z.string().max(4000).optional(),
      campanhaId: z.number().optional(),
      destinos: z.array(z.object({
        capacidadeLitros: z.number().positive(),
        litros: z.number().positive(),
        codigo: z.string().trim().max(32).optional(),
      })).min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de dados indisponível" });
      const origem = (await db.select().from(cubas).where(eq(cubas.id, input.cubaOrigemId)).limit(1))[0];
      if (!origem) throw new TRPCError({ code: "NOT_FOUND", message: "Cuba de origem não encontrada" });

      const litrosDisponiveis = Number(origem.fichaLitros ?? 0);
      const distribuicao = validarDistribuicaoBarricas(litrosDisponiveis, input.destinos);
      if (!distribuicao.ok) throw new TRPCError({ code: "BAD_REQUEST", message: distribuicao.erro });

      const codigosExistentes = new Set((await db.select({ codigo: barricas.codigo }).from(barricas)).map((b) => b.codigo.toUpperCase()));
      const proximoNumero = Math.max(0, ...Array.from(codigosExistentes).map((codigo) => Number(codigo.match(/^BR-(\d+)$/)?.[1] ?? 0))) + 1;
      let sequencia = proximoNumero;
      const destinosComCodigo = input.destinos.map((destino) => {
        const codigo = destino.codigo?.trim().toUpperCase() || `BR-${String(sequencia++).padStart(3, "0")}`;
        if (codigosExistentes.has(codigo)) {
          throw new TRPCError({ code: "CONFLICT", message: `O código de barrica ${codigo} já existe` });
        }
        codigosExistentes.add(codigo);
        return { ...destino, codigo };
      });

      const analiseFinal = (await db.select().from(analisesFinaisFermentacao)
        .where(and(eq(analisesFinaisFermentacao.cubaId, origem.id), eq(analisesFinaisFermentacao.fermentacaoNum, origem.fermentacaoNum)))
        .orderBy(desc(analisesFinaisFermentacao.dataAnalise), desc(analisesFinaisFermentacao.id)).limit(1))[0];
      const comentariosOrigem = await db.select().from(comentariosCuba)
        .where(eq(comentariosCuba.cubaId, origem.id)).orderBy(desc(comentariosCuba.createdAt));

      const barricasCriadas: Array<{ barricaId: number; codigo: string; capacidadeLitros: number; litros: number }> = [];
      for (const destino of destinosComCodigo) {
        const resultado = await db.insert(barricas).values({
          codigo: destino.codigo,
          capacidadeLitros: String(destino.capacidadeLitros),
          litrosAtual: String(destino.litros),
          estado: "activa",
          cubaOrigemId: origem.id,
          fermentacaoOrigemNum: origem.fermentacaoNum,
          campanhaId: input.campanhaId ?? null,
          nomeLote: origem.nomeLote,
        });
        const barricaId = Number((resultado as any).insertId ?? (resultado as any)[0]?.insertId ?? 0);
        if (!barricaId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível criar a barrica" });
        barricasCriadas.push({ barricaId, codigo: destino.codigo, capacidadeLitros: destino.capacidadeLitros, litros: destino.litros });

        const analise = analiseFinal
          ? {
              tipoAnalise: "final" as const,
              dataAnalise: analiseFinal.dataAnalise,
              fichaKilos: analiseFinal.fichaKilos,
              fichaLitros: analiseFinal.fichaLitros,
              fichaPh: analiseFinal.fichaPh,
              fichaAt: analiseFinal.fichaAt,
              fichaAv: analiseFinal.fichaAv,
              fichaNfa: analiseFinal.fichaNfa,
              fichaNtu: analiseFinal.fichaNtu,
              fichaGluconico: analiseFinal.fichaGluconico,
              fichaAlcoolProvavel: analiseFinal.fichaAlcoolProvavel,
              acucaresResiduais: analiseFinal.acucaresResiduais,
              acidoMalico: analiseFinal.acidoMalico,
              origemAnaliseId: analiseFinal.id,
            }
          : {
              tipoAnalise: "inicial" as const,
              dataAnalise: input.dataMovimento,
              fichaKilos: origem.fichaKilos,
              fichaLitros: origem.fichaLitros,
              fichaPh: origem.fichaPh,
              fichaAt: origem.fichaAt,
              fichaAv: origem.fichaAv,
              fichaNfa: origem.fichaNfa,
              fichaNtu: origem.fichaNtu,
              fichaGluconico: origem.fichaGluconico,
              fichaAlcoolProvavel: origem.fichaAlcoolProvavel,
              acucaresResiduais: null,
              acidoMalico: null,
              origemAnaliseId: null,
            };
        await db.insert(analisesBarrica).values({
          barricaId,
          origemCubaId: origem.id,
          ...analise,
          userId: ctx.user.id,
          userName: ctx.user.name ?? ctx.user.email ?? null,
        });
        if (comentariosOrigem.length) {
          await db.insert(comentariosBarrica).values(comentariosOrigem.map((comentario) => ({
            barricaId,
            texto: comentario.texto,
            herdadoDe: `${origem.codigo.toUpperCase()} (transferência ${input.dataMovimento})`,
            userId: comentario.userId,
            userName: comentario.userName,
          })));
        }
      }

      const factorRestante = litrosDisponiveis > 0 ? distribuicao.litrosRestantes / litrosDisponiveis : 0;
      await db.update(cubas).set({
        fichaLitros: String(distribuicao.litrosRestantes),
        fichaKilos: origem.fichaKilos ? String(Math.round(Number(origem.fichaKilos) * factorRestante * 10) / 10) : null,
        estado: distribuicao.litrosRestantes > 0 ? origem.estado : "completa",
      }).where(eq(cubas.id, origem.id));
      await db.insert(movimentosBarrica).values({
        dataMovimento: input.dataMovimento,
        cubaOrigemId: origem.id,
        fermentacaoOrigemNum: origem.fermentacaoNum,
        barricasJson: JSON.stringify(barricasCriadas),
        litrosTotal: String(distribuicao.litrosTotal),
        motivo: input.motivo?.trim() || null,
        campanhaId: input.campanhaId ?? null,
        userId: ctx.user.id,
        userName: ctx.user.name ?? ctx.user.email ?? null,
      });
      return { ok: true, barricas: barricasCriadas, litrosRestantes: distribuicao.litrosRestantes };
    }),
});

const gestaoAdegaRouter = router({
  destinos: editProcedure.query(async () => {
    const adegaUrl = process.env.GESTAO_ADEGA_API_URL;
    if (!adegaUrl) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "A ligação à Gestão de Adega ainda não está disponível." });
    try {
      return await listarDestinosAdega(adegaUrl);
    } catch (error) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: error instanceof Error ? error.message : "Não foi possível consultar a Gestão de Adega." });
    }
  }),
  prepararEnvio: editProcedure
    .input(z.object({
      origens: origensAdegaSchema,
      destinos: destinosAdegaSchema,
      borras: borrasAdegaSchema,
      observacoes: z.string().max(4000).nullable().optional(),
      origemUrl: z.string().url(),
    }))
    .mutation(async ({ input, ctx }) => {
      const destinos = input.destinos.map(destino => ({ ...destino, cubaCodigo: normalizarCodigoDestinoAdega(destino.cubaCodigo) }));
      const destinosDuplicados = encontrarDestinosAdegaDuplicados(destinos);
      if (destinosDuplicados.length > 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Cada cuba de destino só pode ser indicada uma vez (${destinosDuplicados.join(", ")}). Some os litros na mesma linha.` });
      }
      const totalOrigem = input.origens.reduce((total, origem) => total + origem.litros, 0);
      const totalDestino = destinos.reduce((total, destino) => total + destino.litros, 0);
      if (Math.abs(totalOrigem - totalDestino) > 0.001) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Balanço inválido: saem ${totalOrigem} L e entram ${totalDestino} L.` });
      }
      const adegaUrl = process.env.GESTAO_ADEGA_API_URL;
      if (!adegaUrl) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "A ligação à Gestão de Adega ainda não está disponível." });
      try {
        const destinosAdega = await listarDestinosAdega(adegaUrl);
        const erroCapacidade = erroCapacidadeDestinos(destinos, destinosAdega);
        if (erroCapacidade) throw new TRPCError({ code: "BAD_REQUEST", message: erroCapacidade });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: error instanceof Error ? error.message : "Não foi possível validar os destinos na Gestão de Adega." });
      }

      const todasCubas = await getAllCubas();
      const porId = new Map(todasCubas.map(cuba => [cuba.id, cuba]));
      const fontes = input.origens.map(origem => ({ origem, cuba: porId.get(origem.cubaId) }));
      if (fontes.some(fonte => !fonte.cuba)) throw new TRPCError({ code: "NOT_FOUND", message: "Uma das cubas de origem não foi encontrada." });
      for (const { origem, cuba } of fontes) {
        const disponivel = Number(cuba!.fichaLitros ?? 0);
        const borra = input.borras.find(item => item.cubaOrigemId === origem.cubaId);
        const saidaBorras = borra?.destino === "manter" ? 0 : (borra?.litros ?? 0);
        if (disponivel + 0.001 < origem.litros + saidaBorras) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `${cuba!.codigo} tem apenas ${disponivel} L disponíveis.` });
        }
      }
      const resumoBorras = input.borras.filter(borra => borra.litros > 0).map(borra => {
        const origem = porId.get(borra.cubaOrigemId)?.codigo ?? `#${borra.cubaOrigemId}`;
        const destino = borra.destino === "lixo" ? "lixo" : borra.destino === "manter" ? "mantidas na origem" : `cuba de borras #${borra.cubaDestinoId}`;
        return `${origem}: ${borra.litros} L → ${destino}`;
      });

      const analises = await Promise.all(fontes.map(({ cuba }) => getAnalisesFinaisByCuba(cuba!.id, cuba!.fermentacaoNum)));
      const analiseFinal = analises.flat().sort((a, b) => String(b.dataAnalise).localeCompare(String(a.dataAnalise)))[0];
      const comentarios = (await Promise.all(fontes.map(({ cuba }) => getComentariosByCuba(cuba!.id)))).flat()
        .map(comentario => `${comentario.userName ?? "Operador"}: ${comentario.texto}`);
      const primeiraCuba = fontes[0].cuba!;
      const dataMovimento = new Date().toISOString();
      const operador = ctx.user.name ?? ctx.user.email ?? "Utilizador";
      const payload = {
        referenciaExterna: novaReferenciaAdega(),
        dataMovimento,
        operador,
        operadorId: ctx.user.id ?? null,
        origens: fontes.map(({ origem, cuba }) => ({ cubaId: cuba!.id, cubaCodigo: cuba!.codigo, fermentacaoNumero: cuba!.fermentacaoNum, litros: origem.litros })),
        destinos,
        borras: input.borras,
        tipoVinho: primeiraCuba.tipoCuba === "porto" ? "Vinho do Porto" as const : null,
        lote: primeiraCuba.nomeLote,
        proveniencia: fontes.map(({ cuba }) => cuba!.codigo).join(" + "),
        anoProducao: new Date().getFullYear(),
        analiseFinal: analiseFinal ? {
          dataAnalise: normalizarDataAnaliseIso(analiseFinal.dataAnalise), ph: analiseFinal.fichaPh ? Number(analiseFinal.fichaPh) : null,
          at: analiseFinal.fichaAt ? Number(analiseFinal.fichaAt) : null, av: analiseFinal.fichaAv ? Number(analiseFinal.fichaAv) : null,
          nfa: analiseFinal.fichaNfa ? Number(analiseFinal.fichaNfa) : null, ntu: analiseFinal.fichaNtu ? Number(analiseFinal.fichaNtu) : null,
          gluconico: analiseFinal.fichaGluconico ? Number(analiseFinal.fichaGluconico) : null,
          alcoolProvavel: analiseFinal.fichaAlcoolProvavel ? Number(analiseFinal.fichaAlcoolProvavel) : null,
          acucaresResiduais: analiseFinal.acucaresResiduais ? Number(analiseFinal.acucaresResiduais) : null,
          acidoMalico: analiseFinal.acidoMalico ? Number(analiseFinal.acidoMalico) : null,
        } : undefined,
        comentarios,
        observacoes: [input.observacoes?.trim(), resumoBorras.length ? `Borras: ${resumoBorras.join("; ")}` : null].filter(Boolean).join("\n") || null,
      };
      const token = await criarTokenHandoff(payload);
      const dados = Buffer.from(JSON.stringify(payload)).toString("base64url");
      const voltar = new URL(`/cubas/${primeiraCuba.id}`, input.origemUrl).toString();
      const confirmarUrl = new URL("/api/integracao/adega/confirmar", input.origemUrl);
      confirmarUrl.searchParams.set("token", token);
      confirmarUrl.searchParams.set("voltar", voltar);
      const urlAdega = new URL("/integracao/fermentacao", adegaUrl);
      urlAdega.searchParams.set("dados", dados);
      urlAdega.searchParams.set("confirmarUrl", confirmarUrl.toString());
      return { urlConfirmacao: urlAdega.toString(), referenciaExterna: payload.referenciaExterna, totalLitros: totalOrigem };
    }),
});

// ── App Router ────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => {
      const user = opts.ctx.user;
      if (!user) return null;
      // Qualquer utilizador autenticado pode editar
      const canEdit = true;
      return { ...user, canEdit };
    }),
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
  importacao: importacaoRouter,
  pesquisa: pesquisaRouter,
  recepcoes: recepcaoRouter,
  movimentos: movimentosRouter,
  analisesFinais: analisesFinaisRouter,
  barricas: barricasRouter,
  protocolos: protocolosRouter,
  gestaoAdega: gestaoAdegaRouter,
  localAuth: localAuthRouter,
});
export type AppRouter = typeof appRouter;
import { podeEditar } from "@shared/permissions";
