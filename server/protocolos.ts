import { and, asc, eq, inArray } from "drizzle-orm";
import {
  cubas,
  protocoloEtapas,
  protocoloEtapasCuba,
  protocolosCuba,
  protocolosFermentacao,
} from "../drizzle/schema";
import { createAdicao, getDb, getLeiturasByCuba } from "./db";
import { calcularDiaFermentacao, calcularDoseTotal, gatilhoFoiAtingido, unidadeTotal } from "./protocolosRules";

export type EtapaInput = {
  id?: number;
  ordem: number;
  titulo: string;
  descricao?: string | null;
  tipoEtapa: "adicao" | "controlo" | "manual";
  gatilhoTipo: "densidade" | "baume" | "temperatura" | "dia" | "manual";
  operador?: "menor_igual" | "maior_igual" | "igual" | null;
  valorGatilho?: string | null;
  produto?: string | null;
  dosePorHl?: string | null;
  doseUnidade?: string | null;
  instrucoes?: string | null;
};

export async function listarProtocolos(apenasAtivos = false) {
  const db = await getDb();
  if (!db) return [];
  const protocolos = await db.select().from(protocolosFermentacao).orderBy(asc(protocolosFermentacao.nome));
  const etapas = await db.select().from(protocoloEtapas).orderBy(asc(protocoloEtapas.ordem));
  return protocolos
    .filter((protocolo) => !apenasAtivos || protocolo.ativo)
    .map((protocolo) => ({
      ...protocolo,
      etapas: etapas.filter((etapa) => etapa.protocoloId === protocolo.id),
    }));
}

export async function obterProtocolo(id: number) {
  const protocolos = await listarProtocolos(false);
  return protocolos.find((protocolo) => protocolo.id === id);
}

export async function criarProtocolo(input: {
  nome: string;
  descricao?: string | null;
  tipoCuba: "vinho" | "porto" | "todos";
  etapas: EtapaInput[];
  userId?: number;
  userName?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Base de dados indisponível");
  const resultado = await db.insert(protocolosFermentacao).values({
    nome: input.nome,
    descricao: input.descricao ?? null,
    tipoCuba: input.tipoCuba,
    criadoPorId: input.userId,
    criadoPorNome: input.userName,
  });
  const protocoloId = Number(resultado[0].insertId);

  if (input.etapas.length) {
    await db.insert(protocoloEtapas).values(input.etapas.map((etapa, indice) => ({
      protocoloId,
      ordem: etapa.ordem || indice + 1,
      titulo: etapa.titulo,
      descricao: etapa.descricao ?? null,
      tipoEtapa: etapa.tipoEtapa,
      gatilhoTipo: etapa.gatilhoTipo,
      operador: etapa.gatilhoTipo === "manual" ? null : etapa.operador ?? null,
      valorGatilho: etapa.gatilhoTipo === "manual" ? null : etapa.valorGatilho ?? null,
      produto: etapa.produto ?? null,
      dosePorHl: etapa.dosePorHl ?? null,
      doseUnidade: etapa.doseUnidade ?? "g/hL",
      instrucoes: etapa.instrucoes ?? null,
    })));
  }
  return protocoloId;
}

export async function atualizarProtocolo(input: {
  id: number;
  nome: string;
  descricao?: string | null;
  tipoCuba: "vinho" | "porto" | "todos";
  etapas: EtapaInput[];
}) {
  const db = await getDb();
  if (!db) throw new Error("Base de dados indisponível");
  const protocolo = (await db.select().from(protocolosFermentacao).where(eq(protocolosFermentacao.id, input.id)).limit(1))[0];
  if (!protocolo) throw new Error("Protocolo não encontrado");

  const existentes = await db.select().from(protocoloEtapas)
    .where(eq(protocoloEtapas.protocoloId, input.id));
  const existentesPorId = new Map(existentes.map((etapa) => [etapa.id, etapa]));
  const idsMantidos = new Set(input.etapas.flatMap((etapa) => etapa.id ? [etapa.id] : []));
  const idsRemovidos = existentes.filter((etapa) => !idsMantidos.has(etapa.id)).map((etapa) => etapa.id);

  // Não apagar etapas que já pertencem ao histórico de uma cuba. Podem ser
  // corrigidas, mas a sua rastreabilidade deve manter-se intacta.
  if (idsRemovidos.length > 0) {
    const referencias = await db.select().from(protocoloEtapasCuba)
      .where(inArray(protocoloEtapasCuba.protocoloEtapaId, idsRemovidos));
    if (referencias.length > 0) {
      throw new Error("Não é possível remover uma etapa que já foi atribuída a uma cuba. Edite-a ou mantenha-a no protocolo.");
    }
    await db.delete(protocoloEtapas).where(inArray(protocoloEtapas.id, idsRemovidos));
  }

  await db.update(protocolosFermentacao).set({
    nome: input.nome,
    descricao: input.descricao ?? null,
    tipoCuba: input.tipoCuba,
  }).where(eq(protocolosFermentacao.id, input.id));

  for (let indice = 0; indice < input.etapas.length; indice += 1) {
    const etapa = input.etapas[indice];
    const valores = {
      ordem: etapa.ordem || indice + 1,
      titulo: etapa.titulo,
      descricao: etapa.descricao ?? null,
      tipoEtapa: etapa.tipoEtapa,
      gatilhoTipo: etapa.gatilhoTipo,
      operador: etapa.gatilhoTipo === "manual" ? null : etapa.operador ?? null,
      valorGatilho: etapa.gatilhoTipo === "manual" ? null : etapa.valorGatilho ?? null,
      produto: etapa.produto ?? null,
      dosePorHl: etapa.dosePorHl ?? null,
      doseUnidade: etapa.doseUnidade ?? "g/hL",
      instrucoes: etapa.instrucoes ?? null,
    };
    if (etapa.id) {
      if (!existentesPorId.has(etapa.id)) throw new Error("A etapa indicada não pertence a este protocolo");
      await db.update(protocoloEtapas).set(valores).where(eq(protocoloEtapas.id, etapa.id));
    } else {
      await db.insert(protocoloEtapas).values({ protocoloId: input.id, ...valores });
    }
  }
  return input.id;
}

export async function definirEstadoProtocolo(id: number, ativo: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Base de dados indisponível");
  await db.update(protocolosFermentacao).set({ ativo }).where(eq(protocolosFermentacao.id, id));
}

export async function atribuirProtocoloACuba(input: {
  cubaId: number;
  protocoloId: number;
  userId?: number;
  userName?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Base de dados indisponível");
  const cuba = (await db.select().from(cubas).where(eq(cubas.id, input.cubaId)).limit(1))[0];
  if (!cuba) throw new Error("Cuba não encontrada");
  const protocolo = await obterProtocolo(input.protocoloId);
  if (!protocolo) throw new Error("Protocolo não encontrado");
  if (!protocolo.ativo) throw new Error("Este protocolo está inactivo");
  if (protocolo.tipoCuba !== "todos" && protocolo.tipoCuba !== cuba.tipoCuba) {
    throw new Error("O protocolo não é compatível com o tipo desta cuba");
  }

  const existente = (await db.select().from(protocolosCuba)
    .where(and(eq(protocolosCuba.cubaId, input.cubaId), eq(protocolosCuba.fermentacaoNum, cuba.fermentacaoNum)))
    .limit(1))[0];

  let protocoloCubaId: number;
  if (existente) {
    protocoloCubaId = existente.id;
    await db.delete(protocoloEtapasCuba).where(eq(protocoloEtapasCuba.protocoloCubaId, protocoloCubaId));
    await db.update(protocolosCuba).set({
      protocoloId: input.protocoloId,
      atribuidoPorId: input.userId,
      atribuidoPorNome: input.userName,
    }).where(eq(protocolosCuba.id, protocoloCubaId));
  } else {
    const resultado = await db.insert(protocolosCuba).values({
      cubaId: input.cubaId,
      fermentacaoNum: cuba.fermentacaoNum,
      protocoloId: input.protocoloId,
      atribuidoPorId: input.userId,
      atribuidoPorNome: input.userName,
    });
    protocoloCubaId = Number(resultado[0].insertId);
  }

  if (protocolo.etapas.length) {
    await db.insert(protocoloEtapasCuba).values(protocolo.etapas.map((etapa) => ({
      protocoloCubaId,
      protocoloEtapaId: etapa.id,
    })));
  }
  return protocoloCubaId;
}

export async function obterProtocoloDaCuba(cubaId: number) {
  const db = await getDb();
  if (!db) return null;
  const cuba = (await db.select().from(cubas).where(eq(cubas.id, cubaId)).limit(1))[0];
  if (!cuba) return null;
  const atribuicao = (await db.select().from(protocolosCuba)
    .where(and(eq(protocolosCuba.cubaId, cubaId), eq(protocolosCuba.fermentacaoNum, cuba.fermentacaoNum)))
    .limit(1))[0];
  if (!atribuicao) return { cuba, atribuicao: null, protocolo: null, etapas: [], leituraAtual: null, diaFermentacao: null };

  const protocolo = await obterProtocolo(atribuicao.protocoloId);
  const estados = await db.select().from(protocoloEtapasCuba)
    .where(eq(protocoloEtapasCuba.protocoloCubaId, atribuicao.id));
  const leituras = await getLeiturasByCuba(cubaId, cuba.fermentacaoNum);
  const leituraAtual = leituras.at(-1) ?? null;
  const diaFermentacao = calcularDiaFermentacao(leituras[0]?.dataLeitura, leituraAtual?.dataLeitura, leituraAtual?.diaNr);

  const etapas = (protocolo?.etapas ?? []).map((etapa) => {
    const estado = estados.find((item) => item.protocoloEtapaId === etapa.id);
    const valores = {
      densidade: leituraAtual?.densL1 ? Number(leituraAtual.densL1) : null,
      baume: leituraAtual?.baumeL1 ? Number(leituraAtual.baumeL1) : null,
      temperatura: leituraAtual?.tempL1 ? Number(leituraAtual.tempL1) : null,
      dia: diaFermentacao,
    };
    const valorAtual = etapa.gatilhoTipo === "densidade" ? valores.densidade
      : etapa.gatilhoTipo === "baume" ? valores.baume
        : etapa.gatilhoTipo === "temperatura" ? valores.temperatura
          : etapa.gatilhoTipo === "dia" ? valores.dia : null;
    const alertaAtivo = estado?.estado === "pendente" && gatilhoFoiAtingido(
      etapa.gatilhoTipo,
      etapa.operador,
      etapa.valorGatilho ? Number(etapa.valorGatilho) : null,
      valores,
    );
    const doseTotal = calcularDoseTotal(etapa.dosePorHl ? Number(etapa.dosePorHl) : null, cuba.fichaLitros ? Number(cuba.fichaLitros) : null);
    return { ...etapa, estado: estado ?? null, alertaAtivo, valorAtual, doseTotal, unidadeTotal: unidadeTotal(etapa.doseUnidade) };
  });

  return { cuba, atribuicao, protocolo, etapas, leituraAtual, diaFermentacao };
}

export async function concluirEtapaDeProtocolo(input: {
  etapaCubaId: number;
  estado: "concluida" | "dispensada";
  observacoes?: string | null;
  registarAdicao?: boolean;
  doseReal?: string | null;
  data?: string;
  userId?: number;
  userName?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Base de dados indisponível");
  const etapaCuba = (await db.select().from(protocoloEtapasCuba)
    .where(eq(protocoloEtapasCuba.id, input.etapaCubaId)).limit(1))[0];
  if (!etapaCuba) throw new Error("Etapa não encontrada");
  const atribuicao = (await db.select().from(protocolosCuba)
    .where(eq(protocolosCuba.id, etapaCuba.protocoloCubaId)).limit(1))[0];
  const etapa = (await db.select().from(protocoloEtapas)
    .where(eq(protocoloEtapas.id, etapaCuba.protocoloEtapaId)).limit(1))[0];
  if (!atribuicao || !etapa) throw new Error("Dados do protocolo incompletos");

  await db.update(protocoloEtapasCuba).set({
    estado: input.estado,
    concluidaEm: new Date(),
    concluidaPorId: input.userId,
    concluidaPorNome: input.userName,
    observacoes: input.observacoes ?? null,
  }).where(eq(protocoloEtapasCuba.id, input.etapaCubaId));

  if (input.estado === "concluida" && input.registarAdicao && etapa.tipoEtapa === "adicao") {
    await createAdicao({
      cubaId: atribuicao.cubaId,
      fermentacaoNum: atribuicao.fermentacaoNum,
      dataAdicao: input.data ?? new Date().toISOString().slice(0, 10),
      produto: etapa.produto ?? etapa.titulo,
      dose: input.doseReal ?? (etapa.dosePorHl ? `${etapa.dosePorHl} ${etapa.doseUnidade ?? "g/hL"}` : undefined),
      observacoes: input.observacoes ?? etapa.instrucoes ?? undefined,
      userId: input.userId,
      userName: input.userName,
    });
  }
}
