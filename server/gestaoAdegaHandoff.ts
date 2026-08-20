import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { SignJWT, jwtVerify } from "jose";
import { and, eq, inArray } from "drizzle-orm";
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
  tipoVinho: z.enum(["Branco", "Tinto", "Rose", "Espumante Branco", "Espumante Rose", "Vinho do Porto", "Borras"]).nullable().optional(),
  lote: z.string().max(120).nullable().optional(),
  proveniencia: z.string().max(512).nullable().optional(),
  anoProducao: z.number().int().min(1900).max(2100).nullable().optional(),
  analiseFinal: z.object({
    dataAnalise: z.string().optional(),
    ph: z.number().nullable().optional(),
    at: z.number().nullable().optional(),
    av: z.number().nullable().optional(),
    nfa: z.number().nullable().optional(),
    ntu: z.number().nullable().optional(),
    gluconico: z.number().nullable().optional(),
    alcoolProvavel: z.number().nullable().optional(),
    acucaresResiduais: z.number().nullable().optional(),
    acidoMalico: z.number().nullable().optional(),
  }).optional(),
  comentarios: z.array(z.string().max(2000)).max(50).default([]),
  observacoes: z.string().max(4000).nullable().optional(),
});

export type HandoffAdega = z.infer<typeof handoffAdegaSchema>;

const secretKey = (secret: string) => new TextEncoder().encode(secret);

export async function criarTokenHandoff(payload: HandoffAdega, secret = ENV.cookieSecret) {
  if (!secret) throw new Error("Não foi possível preparar o envio para a adega.");
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(secretKey(secret));
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

/**
 * Só é chamado depois de o utilizador autenticado confirmar a entrada no outro
 * projecto. Regista a saída local e reduz cada cuba de origem uma única vez.
 */
export async function confirmarHandoffNaFermentacao(payload: HandoffAdega) {
  const db = await getDb();
  if (!db) throw new Error("Base de dados de fermentação indisponível.");
  const referencia = `[ADEGA:${payload.referenciaExterna}]`;
  const totalOrigens = total(payload.origens);
  const totalDestinos = total(payload.destinos);
  if (Math.abs(totalOrigens - totalDestinos) > 0.001) {
    throw new Error(`Balanço inválido: saem ${totalOrigens} L e entram ${totalDestinos} L.`);
  }

  return db.transaction(async tx => {
    const anterior = await tx.select({ id: movimentosCuba.id }).from(movimentosCuba)
      .where(eq(movimentosCuba.motivo, referencia)).limit(1);
    if (anterior[0]) return { duplicate: true, movimentoId: anterior[0].id };

    const origemIds = payload.origens.map(origem => origem.cubaId);
    const recipientes = await tx.select().from(cubas).where(inArray(cubas.id, origemIds));
    const porId = new Map(recipientes.map(cuba => [cuba.id, cuba]));
    const emFalta = payload.origens.filter(origem => !porId.has(origem.cubaId));
    if (emFalta.length) throw new Error("Uma das cubas de origem já não existe.");

    for (const origem of payload.origens) {
      const cuba = porId.get(origem.cubaId)!;
      const disponivel = Number(cuba.fichaLitros ?? 0);
      if (disponivel + 0.001 < origem.litros) {
        throw new Error(`${cuba.codigo} tem apenas ${disponivel} L disponíveis; o envio foi cancelado.`);
      }
    }

    for (const origem of payload.origens) {
      const cuba = porId.get(origem.cubaId)!;
      const restante = Math.max(0, Number(cuba.fichaLitros ?? 0) - origem.litros);
      await tx.update(cubas).set({
        fichaLitros: String(Math.round(restante * 10) / 10),
        estado: restante === 0 ? "completa" : cuba.estado,
      }).where(eq(cubas.id, cuba.id));
    }

    const [resultado] = await tx.insert(movimentosCuba).values({
      tipo: payload.origens.length > 1 ? "juncao" : "transferencia",
      dataMovimento: payload.dataMovimento.slice(0, 10),
      cubasOrigemIds: JSON.stringify(payload.origens.map(origem => origem.cubaId)),
      destinosJson: JSON.stringify(payload.destinos.map(destino => ({
        cubaId: null,
        cubaCodigo: destino.cubaCodigo,
        litros: destino.litros,
        sistema: "gestao_adega",
      }))),
      cubaDestinoId: null,
      motivo: referencia,
      campanhaId: null,
      userId: payload.operadorId,
      userName: payload.operador,
    });

    return { duplicate: false, movimentoId: Number(resultado.insertId) };
  });
}

export async function confirmarHandoffHandler(req: Request, res: Response) {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  const voltar = typeof req.query.voltar === "string" ? req.query.voltar : "/";
  try {
    const resultado = await confirmarHandoffNaFermentacao(await lerTokenHandoff(token));
    const url = new URL(voltar);
    url.searchParams.set("integracaoAdega", resultado.duplicate ? "ja_registado" : "concluida");
    res.redirect(303, url.toString());
  } catch (error) {
    res.status(422).send(error instanceof Error ? error.message : "Não foi possível confirmar a saída para a adega.");
  }
}
