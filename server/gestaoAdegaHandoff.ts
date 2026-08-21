import type { Request, Response } from "express";
import { SignJWT, jwtVerify } from "jose";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { cubas, movimentosCuba } from "../drizzle/schema";
import { getDb } from "./db";
import { ENV } from "./_core/env";

export const destinosAdegaSchema = z.array(z.object({
  cubaCodigo: z.string().trim().min(1).max(32),
  litros: z.number().positive(),
})).min(1);

export const origensAdegaSchema = z.array(z.object({
  cubaId: z.number().int().positive(),
  litros: z.number().positive(),
})).min(1);

export const borrasAdegaSchema = z.array(z.object({
  cubaOrigemId: z.number().int().positive(),
  litros: z.number().nonnegative(),
  destino: z.enum(["manter", "cuba_borras", "lixo"]),
  cubaDestinoId: z.number().int().positive().nullable().optional(),
})).default([]);

export const handoffAdegaSchema = z.object({
  referenciaExterna: z.string().min(8).max(128),
  dataMovimento: z.string().datetime(),
  operador: z.string().min(1).max(120),
  operadorId: z.number().int().nullable(),
  origens: z.array(z.object({
    cubaId: z.number().int().positive(),
    cubaCodigo: z.string().min(1).max(32),
    fermentacaoNumero: z.number().int().positive(),
    litros: z.number().positive(),
  })).min(1),
  destinos: destinosAdegaSchema,
  borras: borrasAdegaSchema,
  tipoVinho: z.enum(["Branco", "Tinto", "Rose", "Espumante Branco", "Espumante Rose", "Vinho do Porto", "Borras"]).nullable().optional(),
  lote: z.string().max(120).nullable().optional(),
  proveniencia: z.string().max(512).nullable().optional(),
  anoProducao: z.number().int().min(1900).max(2100).nullable().optional(),
  analiseFinal: z.object({
    dataAnalise: z.string().optional(), ph: z.number().nullable().optional(), at: z.number().nullable().optional(),
    av: z.number().nullable().optional(), nfa: z.number().nullable().optional(), ntu: z.number().nullable().optional(),
    gluconico: z.number().nullable().optional(), alcoolProvavel: z.number().nullable().optional(),
    acucaresResiduais: z.number().nullable().optional(), acidoMalico: z.number().nullable().optional(),
  }).optional(),
  comentarios: z.array(z.string().max(2000)).max(50).default([]),
  observacoes: z.string().max(4000).nullable().optional(),
});

export type HandoffAdega = z.infer<typeof handoffAdegaSchema>;

export function normalizarDataAnaliseIso(data: Date | string | number): string {
  if (typeof data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.trim())) {
    return `${data.trim()}T00:00:00.000Z`;
  }
  const normalizada = new Date(data);
  if (Number.isNaN(normalizada.getTime())) throw new Error("A data da análise final é inválida.");
  return normalizada.toISOString();
}

const secretKey = (secret: string) => new TextEncoder().encode(secret);

export async function criarTokenHandoff(payload: HandoffAdega, secret = ENV.cookieSecret) {
  if (!secret) throw new Error("Não foi possível preparar o envio para a adega.");
  return new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("15m").sign(secretKey(secret));
}

export async function lerTokenHandoff(token: string, secret = ENV.cookieSecret): Promise<HandoffAdega> {
  if (!secret) throw new Error("Não foi possível validar o envio para a adega.");
  const { payload } = await jwtVerify(token, secretKey(secret));
  return handoffAdegaSchema.parse(payload);
}

export function novaReferenciaAdega() {
  return `ADEGA-${randomUUID()}`;
}

function total(linhas: Array<{ litros: number }>) {
  return linhas.reduce((soma, linha) => soma + linha.litros, 0);
}

function resumoBorras(payload: HandoffAdega, porId: Map<number, { codigo: string }>) {
  return payload.borras.filter(borra => borra.litros > 0).map(borra => {
    const origem = porId.get(borra.cubaOrigemId)?.codigo ?? `#${borra.cubaOrigemId}`;
    const destino = borra.destino === "lixo" ? "lixo" : borra.destino === "manter"
      ? "mantidas na origem"
      : `cuba de borras ${porId.get(borra.cubaDestinoId ?? 0)?.codigo ?? ""}`.trim();
    return `${origem}: ${borra.litros} L → ${destino}`;
  });
}

/** Só é chamado depois da confirmação autenticada da entrada na Gestão de Adega. */
export async function confirmarHandoffNaFermentacao(payload: HandoffAdega) {
  const db = await getDb();
  if (!db) throw new Error("Base de dados de fermentação indisponível.");
  const referencia = `[ADEGA:${payload.referenciaExterna}]`;
  if (Math.abs(total(payload.origens) - total(payload.destinos)) > 0.001) {
    throw new Error(`Balanço inválido: saem ${total(payload.origens)} L e entram ${total(payload.destinos)} L.`);
  }

  return db.transaction(async tx => {
    const anterior = await tx.select({ id: movimentosCuba.id }).from(movimentosCuba).where(eq(movimentosCuba.motivo, referencia)).limit(1);
    if (anterior[0]) return { duplicate: true, movimentoId: anterior[0].id, cubasFechadas: [] as typeof cubas.$inferSelect[], detalhesBorras: [] as string[] };

    const origemIds = payload.origens.map(origem => origem.cubaId);
    const recipientes = await tx.select().from(cubas).where(inArray(cubas.id, origemIds));
    const porId = new Map(recipientes.map(cuba => [cuba.id, cuba]));
    if (payload.origens.some(origem => !porId.has(origem.cubaId))) throw new Error("Uma das cubas de origem já não existe.");
    if (payload.borras.some(borra => !origemIds.includes(borra.cubaOrigemId))) throw new Error("As borras têm de pertencer a uma cuba de origem.");
    const borrasPorOrigem = new Map(payload.borras.map(borra => [borra.cubaOrigemId, borra]));
    if (borrasPorOrigem.size !== payload.borras.length) throw new Error("Registe apenas um destino de borras por cuba de origem.");

    const destinosBorrasIds = payload.borras.filter(borra => borra.litros > 0 && borra.destino === "cuba_borras").map(borra => borra.cubaDestinoId!);
    if (destinosBorrasIds.some(id => origemIds.includes(id))) throw new Error("A cuba de borras não pode ser também uma cuba de origem.");
    const cubasBorras = destinosBorrasIds.length ? await tx.select().from(cubas).where(inArray(cubas.id, destinosBorrasIds)) : [];
    const borrasPorDestino = new Map(cubasBorras.map(cuba => [cuba.id, cuba]));
    if (destinosBorrasIds.some(id => !borrasPorDestino.has(id))) throw new Error("Uma cuba de borras não foi encontrada.");

    const fechadas: typeof cubas.$inferSelect[] = [];
    for (const origem of payload.origens) {
      const cuba = porId.get(origem.cubaId)!;
      const borra = borrasPorOrigem.get(origem.cubaId);
      const saidaBorras = borra?.destino === "manter" ? 0 : (borra?.litros ?? 0);
      const totalContabilizado = origem.litros + (borra?.litros ?? 0);
      const disponivel = Number(cuba.fichaLitros ?? 0);
      if (disponivel + 0.001 < origem.litros + saidaBorras) throw new Error(`${cuba.codigo} tem apenas ${disponivel} L disponíveis; o envio foi cancelado.`);
      if (borra?.destino === "cuba_borras" && !borra.cubaDestinoId) throw new Error(`Seleccione a cuba de borras para ${cuba.codigo}.`);
      const restante = Math.max(0, disponivel - origem.litros - saidaBorras);
      const terminada = Math.abs(disponivel - totalContabilizado) < 0.001;
      await tx.update(cubas).set({ fichaLitros: String(Math.round(restante * 10) / 10), estado: terminada ? "completa" : cuba.estado }).where(eq(cubas.id, cuba.id));
      if (terminada) fechadas.push({ ...cuba, fichaLitros: String(Math.round(restante * 10) / 10), estado: "completa" });
    }

    for (const borra of payload.borras.filter(item => item.litros > 0 && item.destino === "cuba_borras")) {
      const cubaBorras = borrasPorDestino.get(borra.cubaDestinoId!)!;
      const novosLitros = Number(cubaBorras.fichaLitros ?? 0) + borra.litros;
      await tx.update(cubas).set({ fichaLitros: String(Math.round(novosLitros * 10) / 10) }).where(eq(cubas.id, cubaBorras.id));
    }

    const codigosBorras = new Map<number, { codigo: string }>();
    porId.forEach((cuba, id) => codigosBorras.set(id, cuba));
    borrasPorDestino.forEach((cuba, id) => codigosBorras.set(id, cuba));
    const detalhesBorras = resumoBorras(payload, codigosBorras);
    const [resultado] = await tx.insert(movimentosCuba).values({
      tipo: payload.origens.length > 1 ? "juncao" : "transferencia",
      dataMovimento: payload.dataMovimento.slice(0, 10),
      cubasOrigemIds: JSON.stringify(origemIds),
      destinosJson: JSON.stringify([
        ...payload.destinos.map(destino => ({ cubaId: null, cubaCodigo: destino.cubaCodigo, litros: destino.litros, sistema: "gestao_adega", tipo: "vinho" })),
        ...payload.borras.filter(borra => borra.litros > 0).map(borra => ({ cubaId: borra.destino === "cuba_borras" ? borra.cubaDestinoId : null, cubaCodigo: borra.destino === "cuba_borras" ? borrasPorDestino.get(borra.cubaDestinoId!)?.codigo : null, litros: borra.litros, sistema: borra.destino === "cuba_borras" ? "fermentacao" : "local", tipo: "borras", destinoBorras: borra.destino })),
      ]),
      cubaDestinoId: null,
      motivo: referencia,
      campanhaId: null,
      userId: payload.operadorId,
      userName: payload.operador,
    });

    return { duplicate: false, movimentoId: Number(resultado.insertId), cubasFechadas: fechadas, detalhesBorras };
  });
}

export async function confirmarHandoffHandler(req: Request, res: Response) {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  const voltar = typeof req.query.voltar === "string" ? req.query.voltar : "/";
  try {
    const payload = await lerTokenHandoff(token);
    const resultado = await confirmarHandoffNaFermentacao(payload);
    if (!resultado.duplicate) {
      try {
        const { enviarEmailFechoIntegrado } = await import("./emailReport");
        await enviarEmailFechoIntegrado({ payload, cubasFechadas: resultado.cubasFechadas, detalhesBorras: resultado.detalhesBorras });
      } catch (emailError) {
        console.error("[Integração Adega] O movimento foi registado, mas o email de fecho falhou:", emailError);
      }
    }
    const url = new URL(voltar);
    url.searchParams.set("integracaoAdega", resultado.duplicate ? "ja_registado" : "concluida");
    res.redirect(303, url.toString());
  } catch (error) {
    res.status(422).send(error instanceof Error ? error.message : "Não foi possível confirmar a saída para a adega.");
  }
}
