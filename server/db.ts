import {
  and,
  asc,
  desc,
  eq,
  like,
  or,
  sql,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  adicoes,
  baumeCalculo,
  campanhas,
  cubas,
  fermentacoesArquivo,
  leituras,
  users,
} from "../drizzle/schema";
import { localUsers } from "../drizzle/schema";
import bcrypt from "bcryptjs";
import {
  recepcoes,
  recepcaoCubas,
  movimentosCuba,
  type InsertRecepcao,
  type InsertRecepcaoCuba,
  type InsertMovimentoCuba,
  analisesCuba,
  type InsertAnaliseCuba,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ── Utilizadores ──────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  textFields.forEach((field) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  });
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ── Cubas ─────────────────────────────────────────────────
export async function getAllCubas() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(cubas).orderBy(asc(cubas.id));
}

export async function getCubaByCodigo(codigo: string) {
  const db = await getDb();
  if (!db) return undefined;
  const upper = codigo.toUpperCase();
  const normalized = upper.replace(/^([A-Z]+)(\d+)$/, (_, prefix, num) => {
    return num.length === 1 ? prefix + '0' + num : prefix + num;
  });
  let result = await db.select().from(cubas).where(eq(cubas.codigo, normalized)).limit(1);
  if (!result[0] && normalized !== upper) {
    result = await db.select().from(cubas).where(eq(cubas.codigo, upper)).limit(1);
  }
  return result[0];
}

export async function updateCubaNomeLote(id: number, nomeLote: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(cubas).set({ nomeLote }).where(eq(cubas.id, id));
}

export async function updateCubaEstado(
  id: number,
  estado: "sem_dados" | "em_fermentacao" | "completa"
) {
  const db = await getDb();
  if (!db) return;
  await db.update(cubas).set({ estado }).where(eq(cubas.id, id));
}

export async function updateCubaDensidadeLimite(id: number, densidadeLimite: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(cubas).set({ densidadeLimite }).where(eq(cubas.id, id));
}

export async function updateCubaAlertas(
  id: number,
  data: {
    tempPretendida?: string | null;
    desvioTempAlerta?: string;
    desvioDesnsAlerta?: string;
    alertasDensidade?: string | null;
    pontoAguardentacao?: string | null;
    desvioAguardentacaoAlerta?: string;
  }
) {
  const db = await getDb();
  if (!db) return;
  const set: Record<string, unknown> = {};
  if (data.tempPretendida !== undefined) set.tempPretendida = data.tempPretendida;
  if (data.desvioTempAlerta !== undefined) set.desvioTempAlerta = data.desvioTempAlerta;
  if (data.desvioDesnsAlerta !== undefined) set.desvioDesnsAlerta = data.desvioDesnsAlerta;
  if (data.alertasDensidade !== undefined) set.alertasDensidade = data.alertasDensidade;
  if (data.pontoAguardentacao !== undefined) set.pontoAguardentacao = data.pontoAguardentacao;
  if (data.desvioAguardentacaoAlerta !== undefined) set.desvioAguardentacaoAlerta = data.desvioAguardentacaoAlerta;
  if (Object.keys(set).length > 0) {
    await db.update(cubas).set(set).where(eq(cubas.id, id));
  }
}

export async function updateFichaInicial(
  id: number,
  data: {
    fichaKilos?: string | null;
    fichaLitros?: string | null;
    fichaPh?: string | null;
    fichaAt?: string | null;
    fichaAv?: string | null;
    fichaNfa?: string | null;
    fichaNtu?: string | null;
    fichaGluconico?: string | null;
    fichaAlcoolProvavel?: string | null;
  }
) {
  const db = await getDb();
  if (!db) return;
  const set: Record<string, unknown> = {};
  const fields = [
    "fichaKilos", "fichaLitros", "fichaPh", "fichaAt", "fichaAv",
    "fichaNfa", "fichaNtu", "fichaGluconico", "fichaAlcoolProvavel",
  ] as const;
  for (const f of fields) {
    if (data[f] !== undefined) {
      const raw = data[f];
      if (raw === null || raw === undefined || (typeof raw === "string" && raw.trim() === "")) {
        set[f] = null;
      } else {
        const trimmed = typeof raw === "string" ? raw.trim().replace(",", ".") : raw;
        const num = parseFloat(trimmed as string);
        set[f] = isNaN(num) ? null : trimmed;
      }
    }
  }
  if (Object.keys(set).length > 0) {
    await db.update(cubas).set(set).where(eq(cubas.id, id));
  }
}

export async function verificarFermentacaoCompleta(
  cubaId: number,
  densidades: (string | null | undefined)[],
  densidadeLimite: string
): Promise<boolean> {
  const limite = parseFloat(densidadeLimite);
  const atingiu = densidades
    .filter((d): d is string => d !== null && d !== undefined && d !== "")
    .some((d) => parseFloat(d) <= limite);
  // NÃO mudar o estado automaticamente — o utilizador decide quando terminar a fermentação
  // O estado 'completa' só é definido quando o utilizador clica 'Terminar Fermentação'
  return atingiu;
}

export function calcularAlertas(params: {
  tempPretendida: string | null | undefined;
  desvioTempAlerta: string;
  desvioDesnsAlerta: string;
  alertasDensidade?: string | null;
  pontoAguardentacao?: string | null;
  desvioAguardentacaoAlerta?: string;
  tempL1?: string | null;
  densL1?: string | null;
  baumeL1?: string | null;
  leituraAnterior?: {
    densL1?: string | null;
    baumeL1?: string | null;
  } | null;
}): string[] {
  const alertas: string[] = [];
  const desvioTemp = parseFloat(params.desvioTempAlerta) || 5;
  const desvioDesns = parseFloat(params.desvioDesnsAlerta) || 0.010;

  // Alerta de temperatura
  if (params.tempPretendida && params.tempL1) {
    const pretendida = parseFloat(params.tempPretendida);
    const t = parseFloat(params.tempL1);
    if (!isNaN(t) && Math.abs(t - pretendida) > desvioTemp) {
      alertas.push(
        `Temperatura ${t.toFixed(1)}°C desvia ${Math.abs(t - pretendida).toFixed(1)}°C da pretendida (${pretendida.toFixed(1)}°C ± ${desvioTemp}°C)`
      );
    }
  }

  // Alerta de variação brusca de densidade entre leituras consecutivas
  if (params.leituraAnterior?.densL1 && params.densL1) {
    const anterior = parseFloat(params.leituraAnterior.densL1);
    const atual = parseFloat(params.densL1);
    if (!isNaN(anterior) && !isNaN(atual)) {
      const diff = Math.abs(anterior - atual);
      if (diff > desvioDesns) {
        alertas.push(
          `Variação brusca de densidade: ${diff.toFixed(4)} (limiar: ${desvioDesns.toFixed(4)})`
        );
      }
    }
  }

  // Alertas de densidade por valor específico (cubas de vinho)
  if (params.alertasDensidade && params.densL1) {
    try {
      const valoresAlerta: number[] = JSON.parse(params.alertasDensidade);
      const dens = parseFloat(params.densL1);
      const anterior = params.leituraAnterior?.densL1 ? parseFloat(params.leituraAnterior.densL1) : null;
      for (const limiar of valoresAlerta) {
        const cruzou = !isNaN(dens) && dens <= limiar;
        const jaCruzado = anterior !== null && !isNaN(anterior) && anterior <= limiar;
        if (cruzou && !jaCruzado) {
          alertas.push(`Densidade atingiu o valor de alerta: ${limiar.toFixed(4)}`);
        }
      }
    } catch { /* JSON inválido, ignorar */ }
  }

  // Alerta de aguardentação (cubas VP — Baumé)
  if (params.pontoAguardentacao && params.baumeL1) {
    const ponto = parseFloat(params.pontoAguardentacao);
    const desvioAg = parseFloat(params.desvioAguardentacaoAlerta ?? "0.50") || 0.5;
    const b = parseFloat(params.baumeL1);
    if (!isNaN(b) && Math.abs(b - ponto) <= desvioAg) {
      alertas.push(
        `⚠️ AGUARDENTAÇÃO: Baumé ${b.toFixed(2)}° está no ponto de aguardentação (${ponto.toFixed(2)}° ± ${desvioAg.toFixed(2)}°) — adicionar aguardente!`
      );
    }
  }

  return alertas;
}

// ── Leituras ──────────────────────────────────────────────
export async function getLeiturasByCuba(cubaId: number, fermentacaoNum?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = fermentacaoNum !== undefined
    ? and(eq(leituras.cubaId, cubaId), eq(leituras.fermentacaoNum, fermentacaoNum))
    : eq(leituras.cubaId, cubaId);
  return db.select().from(leituras).where(conditions).orderBy(asc(leituras.dataLeitura));
}

export async function getLeituraById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(leituras).where(eq(leituras.id, id)).limit(1);
  return result[0];
}

function toDate(dateStr: string): Date {
  return new Date(dateStr + "T00:00:00.000Z");
}

export async function createLeitura(data: {
  cubaId: number;
  fermentacaoNum: number;
  dataLeitura: string;
  hora?: string | null;
  diaNr?: number;
  densL1?: string | null;
  tempL1?: string | null;
  o2?: string | null;
  redox?: string | null;
  baumeL1?: string | null;
  userId?: number;
  userName?: string;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(leituras).values({
    cubaId: data.cubaId,
    fermentacaoNum: data.fermentacaoNum,
    dataLeitura: data.dataLeitura,
    hora: data.hora ?? null,
    diaNr: data.diaNr,
    densL1: data.densL1 ?? null,
    tempL1: data.tempL1 ?? null,
    o2: data.o2 ?? null,
    redox: data.redox ?? null,
    baumeL1: data.baumeL1 ?? null,
    userId: data.userId,
    userName: data.userName,
  });
}

export async function editarLeitura(
  id: number,
  data: {
    densL1?: string | null;
    tempL1?: string | null;
    o2?: string | null;
    redox?: string | null;
    baumeL1?: string | null;
    editedBy?: number;
    editedByName?: string;
  }
) {
  const db = await getDb();
  if (!db) return;
  await db.update(leituras).set({
    densL1: data.densL1,
    tempL1: data.tempL1,
    o2: data.o2,
    redox: data.redox,
    baumeL1: data.baumeL1,
    editedAt: new Date(),
    editedBy: data.editedBy,
    editedByName: data.editedByName,
  }).where(eq(leituras.id, id));
}

// ── Adições ───────────────────────────────────────────────
export async function getAdicoesByCuba(cubaId: number, fermentacaoNum?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = fermentacaoNum !== undefined
    ? and(eq(adicoes.cubaId, cubaId), eq(adicoes.fermentacaoNum, fermentacaoNum))
    : eq(adicoes.cubaId, cubaId);
  return db.select().from(adicoes).where(conditions).orderBy(asc(adicoes.dataAdicao));
}

export async function createAdicao(data: {
  cubaId: number;
  fermentacaoNum: number;
  dataAdicao: string;
  produto?: string;
  dose?: string;
  observacoes?: string;
  userId?: number;
  userName?: string;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(adicoes).values({
    cubaId: data.cubaId,
    fermentacaoNum: data.fermentacaoNum,
    dataAdicao: data.dataAdicao,
    produto: data.produto ?? null,
    dose: data.dose ?? null,
    observacoes: data.observacoes ?? null,
    userId: data.userId,
    userName: data.userName,
  });
}

export async function deleteAdicao(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(adicoes).where(eq(adicoes.id, id));
}

// ── Arquivo de Fermentações ───────────────────────────────
export async function getArquivoByCuba(cubaId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(fermentacoesArquivo)
    .where(eq(fermentacoesArquivo.cubaId, cubaId))
    .orderBy(desc(fermentacoesArquivo.fermentacaoNum));
}

export async function createArquivo(data: {
  cubaId: number;
  fermentacaoNum: number;
  nomeLote?: string | null;
  dataInicio?: string | null;
  dataFim?: string | null;
  totalDias?: number | null;
  densMin?: string | null;
  tempMax?: string | null;
  archivedBy?: string;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(fermentacoesArquivo).values({
    cubaId: data.cubaId,
    fermentacaoNum: data.fermentacaoNum,
    nomeLote: data.nomeLote ?? null,
    dataInicio: data.dataInicio ?? null,
    dataFim: data.dataFim ?? null,
    totalDias: data.totalDias ?? null,
    densMin: data.densMin ?? null,
    tempMax: data.tempMax ?? null,
    archivedBy: data.archivedBy,
  });
}

// ── Dashboard ─────────────────────────────────────────────
export async function getDashboardCubas() {
  const db = await getDb();
  if (!db) return [];
  const todasCubas = await db.select().from(cubas).orderBy(asc(cubas.id));
  // Para cada cuba em fermentação, obter a última leitura (densL1 ou baumeL1)
  const resultado = await Promise.all(
    todasCubas.map(async (cuba) => {
      if (cuba.estado !== "em_fermentacao") return { ...cuba, ultimaDensidade: null as string | null };
      const ultimaLeitura = await db
        .select({ densL1: leituras.densL1, baumeL1: leituras.baumeL1 })
        .from(leituras)
        .where(and(eq(leituras.cubaId, cuba.id), eq(leituras.fermentacaoNum, cuba.fermentacaoNum)))
        .orderBy(desc(leituras.dataLeitura), desc(leituras.hora))
        .limit(1);
      const ul = ultimaLeitura[0];
      const ultimaDensidade = ul ? (ul.densL1 ?? null) : null;
      const ultimoBaume = ul ? (ul.baumeL1 ?? null) : null;
      return { ...cuba, ultimaDensidade, ultimoBaume };
    })
  );
  return resultado;
}

// ── Campanhas ─────────────────────────────────────────────
export async function getAllCampanhas() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(campanhas).orderBy(desc(campanhas.id));
}

export async function getCampanhaAtiva() {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(campanhas).where(eq(campanhas.ativa, true)).limit(1);
  return result[0];
}

export async function createCampanha(data: { nome: string; descricao?: string }) {
  const db = await getDb();
  if (!db) return;
  await db.update(campanhas).set({ ativa: false });
  await db.insert(campanhas).values({
    nome: data.nome,
    descricao: data.descricao ?? null,
    ativa: true,
  });
}

export async function ativarCampanha(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(campanhas).set({ ativa: false });
  await db.update(campanhas).set({ ativa: true }).where(eq(campanhas.id, id));
}

export async function associarCampanhaArquivo(fermentacaoArquivoId: number) {
  const db = await getDb();
  if (!db) return;
  const campanha = await getCampanhaAtiva();
  if (!campanha) return;
  await db
    .update(fermentacoesArquivo)
    .set({ campanhaId: campanha.id })
    .where(eq(fermentacoesArquivo.id, fermentacaoArquivoId));
}

export async function getArquivoByCubaCampanha(cubaId: number, campanhaId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = campanhaId !== undefined
    ? and(eq(fermentacoesArquivo.cubaId, cubaId), eq(fermentacoesArquivo.campanhaId, campanhaId))
    : eq(fermentacoesArquivo.cubaId, cubaId);
  return db
    .select()
    .from(fermentacoesArquivo)
    .where(conditions)
    .orderBy(desc(fermentacoesArquivo.fermentacaoNum));
}

/** Todas as fermentações arquivadas de uma campanha, com dados da cuba */
export async function getFermentacoesByCampanha(campanhaId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: fermentacoesArquivo.id,
      cubaId: fermentacoesArquivo.cubaId,
      fermentacaoNum: fermentacoesArquivo.fermentacaoNum,
      campanhaId: fermentacoesArquivo.campanhaId,
      nomeLote: fermentacoesArquivo.nomeLote,
      dataInicio: fermentacoesArquivo.dataInicio,
      dataFim: fermentacoesArquivo.dataFim,
      totalDias: fermentacoesArquivo.totalDias,
      densMin: fermentacoesArquivo.densMin,
      tempMax: fermentacoesArquivo.tempMax,
      archivedBy: fermentacoesArquivo.archivedBy,
      createdAt: fermentacoesArquivo.createdAt,
      cubaCodigo: cubas.codigo,
      cubaTipo: cubas.tipoCuba,
    })
    .from(fermentacoesArquivo)
    .innerJoin(cubas, eq(fermentacoesArquivo.cubaId, cubas.id))
    .where(eq(fermentacoesArquivo.campanhaId, campanhaId))
    .orderBy(desc(fermentacoesArquivo.dataFim));
}

// ── Cálculo de Baumé de Envasilhamento (Vinho do Porto) ───
export async function getBaumeCalculo(cubaId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(baumeCalculo)
    .where(eq(baumeCalculo.cubaId, cubaId))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Verifica se já existe uma leitura para uma cuba numa determinada data e hora.
 * Quando a hora é fornecida, o duplicado só é detectado se cuba + data + hora forem iguais.
 * Sem hora, verifica apenas cuba + data (comportamento legado).
 */
export async function leituraExistePorData(
  cubaId: number,
  dataLeituraIso: string,
  hora?: string | null
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  if (hora) {
    // Com hora: duplicado só se cuba + data + hora forem exactamente iguais
    const rows = await db
      .select({ id: leituras.id })
      .from(leituras)
      .where(and(
        eq(leituras.cubaId, cubaId),
        eq(leituras.dataLeitura, dataLeituraIso),
        eq(leituras.hora, hora)
      ))
      .limit(1);
    return rows.length > 0;
  } else {
    // Sem hora: verifica apenas cuba + data
    const rows = await db
      .select({ id: leituras.id })
      .from(leituras)
      .where(and(eq(leituras.cubaId, cubaId), eq(leituras.dataLeitura, dataLeituraIso)))
      .limit(1);
    return rows.length > 0;
  }
}

export async function upsertBaumeCalculo(data: {
  cubaId: number;
  mostoFresco: number;
  beLagrima: number;
  alcool: number;
  beActual: number;
  grauVinica: number;
  beAbafar: number;
  beLagrimaPretendido: number;
  adNecessaria: number;
  adPorPipa: number;
  volumeFinal: number;
  pipasFinals: number;
}) {
  const db = await getDb();
  if (!db) return;
  const existing = await getBaumeCalculo(data.cubaId);
  const row = {
    cubaId: data.cubaId,
    mostoFresco: String(data.mostoFresco),
    beLagrima: String(data.beLagrima),
    alcool: String(data.alcool),
    beActual: String(data.beActual),
    grauVinica: String(data.grauVinica),
    beAbafar: String(data.beAbafar),
    beLagrimaPretendido: String(data.beLagrimaPretendido),
    adNecessaria: String(data.adNecessaria),
    adPorPipa: String(data.adPorPipa),
    volumeFinal: String(data.volumeFinal),
    pipasFinals: String(data.pipasFinals),
  };
  if (existing) {
    await db.update(baumeCalculo).set(row).where(eq(baumeCalculo.cubaId, data.cubaId));
  } else {
    await db.insert(baumeCalculo).values(row);
  }
}

// ── Pesquisa Global ───────────────────────────────────────
export async function pesquisarGlobal(termo: string) {
  const db = await getDb();
  if (!db || !termo.trim()) return { cubas: [], adicoes: [], arquivo: [] };

  const t = `%${termo.trim()}%`;

  // Pesquisar cubas por código, nome do lote, tipo de cuba
  const cubasResult = await db
    .select({
      id: cubas.id,
      codigo: cubas.codigo,
      nomeLote: cubas.nomeLote,
      estado: cubas.estado,
      tipoCuba: cubas.tipoCuba,
      fermentacaoNum: cubas.fermentacaoNum,
    })
    .from(cubas)
    .where(
      or(
        like(cubas.codigo, t),
        like(cubas.nomeLote, t)
      )
    )
    .limit(20);

  // Pesquisar adições por produto, observações, nome da cuba
  const adicoesResult = await db
    .select({
      id: adicoes.id,
      cubaId: adicoes.cubaId,
      cubaCodigo: cubas.codigo,
      nomeLote: cubas.nomeLote,
      fermentacaoNum: adicoes.fermentacaoNum,
      dataAdicao: adicoes.dataAdicao,
      produto: adicoes.produto,
      dose: adicoes.dose,
      observacoes: adicoes.observacoes,
      userName: adicoes.userName,
    })
    .from(adicoes)
    .innerJoin(cubas, eq(adicoes.cubaId, cubas.id))
    .where(
      or(
        like(adicoes.produto, t),
        like(adicoes.observacoes, t),
        like(adicoes.dose, t),
        like(cubas.codigo, t),
        like(cubas.nomeLote, t)
      )
    )
    .orderBy(desc(adicoes.dataAdicao))
    .limit(30);

  // Pesquisar fermentações arquivadas por nome de lote, cuba
  const arquivoResult = await db
    .select({
      id: fermentacoesArquivo.id,
      cubaId: fermentacoesArquivo.cubaId,
      cubaCodigo: cubas.codigo,
      fermentacaoNum: fermentacoesArquivo.fermentacaoNum,
      nomeLote: fermentacoesArquivo.nomeLote,
      dataInicio: fermentacoesArquivo.dataInicio,
      dataFim: fermentacoesArquivo.dataFim,
      totalDias: fermentacoesArquivo.totalDias,
      densMin: fermentacoesArquivo.densMin,
    })
    .from(fermentacoesArquivo)
    .innerJoin(cubas, eq(fermentacoesArquivo.cubaId, cubas.id))
    .where(
      or(
        like(fermentacoesArquivo.nomeLote, t),
        like(cubas.codigo, t)
      )
    )
    .orderBy(desc(fermentacoesArquivo.dataFim))
    .limit(20);

  return {
    cubas: cubasResult,
    adicoes: adicoesResult,
    arquivo: arquivoResult,
  };
}

// ── Recepções de Uvas ─────────────────────────────────────

export async function getAllRecepcoes() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(recepcoes)
    .orderBy(desc(recepcoes.dataRecepcao));
}

export async function getRecepcaoById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(recepcoes).where(eq(recepcoes.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getRecepcaoCubasByRecepcao(recepcaoId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: recepcaoCubas.id,
      recepcaoId: recepcaoCubas.recepcaoId,
      cubaId: recepcaoCubas.cubaId,
      cubaCodigo: cubas.codigo,
      kg: recepcaoCubas.kg,
      notas: recepcaoCubas.notas,
    })
    .from(recepcaoCubas)
    .innerJoin(cubas, eq(recepcaoCubas.cubaId, cubas.id))
    .where(eq(recepcaoCubas.recepcaoId, recepcaoId));
}

/** Recepções associadas a uma cuba (via recepcao_cubas) */
export async function getRecepcoesByCuba(cubaId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: recepcoes.id,
      dataRecepcao: recepcoes.dataRecepcao,
      casta: recepcoes.casta,
      kgTotal: recepcoes.kgTotal,
      notas: recepcoes.notas,
      kg: recepcaoCubas.kg,
      notasCuba: recepcaoCubas.notas,
    })
    .from(recepcaoCubas)
    .innerJoin(recepcoes, eq(recepcaoCubas.recepcaoId, recepcoes.id))
    .where(eq(recepcaoCubas.cubaId, cubaId))
    .orderBy(desc(recepcoes.dataRecepcao));
}

export async function createRecepcao(
  data: InsertRecepcao,
  distribuicao: Array<{ cubaId: number; kg: number; notas?: string }>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [result] = await db.insert(recepcoes).values(data);
  const recepcaoId = (result as { insertId: number }).insertId;

  if (distribuicao.length > 0) {
    await db.insert(recepcaoCubas).values(
      distribuicao.map((d) => ({
        recepcaoId,
        cubaId: d.cubaId,
        kg: String(d.kg),
        notas: d.notas ?? null,
      }))
    );
  }
  return recepcaoId;
}

export async function deleteRecepcao(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(recepcaoCubas).where(eq(recepcaoCubas.recepcaoId, id));
  await db.delete(recepcoes).where(eq(recepcoes.id, id));
}

// ── Movimentos de Cuba ────────────────────────────────────

export async function getAllMovimentos() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(movimentosCuba)
    .orderBy(desc(movimentosCuba.dataMovimento));
}

/** Movimentos onde esta cuba foi origem ou destino */
export async function getMovimentosByCuba(cubaId: number) {
  const db = await getDb();
  if (!db) return [];
  // Busca todos os movimentos e filtra em JS (cubasOrigemIds é JSON)
  const todos = await db
    .select()
    .from(movimentosCuba)
    .orderBy(desc(movimentosCuba.dataMovimento));
  return todos.filter((m) => {
    if (m.cubaDestinoId === cubaId) return true;
    try {
      const origens: number[] = JSON.parse(m.cubasOrigemIds);
      return origens.includes(cubaId);
    } catch {
      return false;
    }
  });
}

/** Movimentos do dia de hoje (para o digest diário) */
export async function getMovimentosHoje() {
  const db = await getDb();
  if (!db) return [];
  const hoje = new Date().toISOString().slice(0, 10);
  return db
    .select()
    .from(movimentosCuba)
    .where(eq(movimentosCuba.dataMovimento, hoje))
    .orderBy(asc(movimentosCuba.createdAt));
}

/** Recepções do dia de hoje (para o digest diário) */
export async function getRecepcoesDoDia(data: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(recepcoes)
    .where(eq(recepcoes.dataRecepcao, data))
    .orderBy(asc(recepcoes.createdAt));
}

export async function createMovimento(data: InsertMovimentoCuba) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(movimentosCuba).values(data);
  return (result as { insertId: number }).insertId;
}

// ── Utilizadores Locais (login email+password) ────────────
export async function getLocalUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(localUsers).where(eq(localUsers.email, email.toLowerCase().trim())).limit(1);
  return rows[0] ?? null;
}

export async function getLocalUserById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(localUsers).where(eq(localUsers.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getAllLocalUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: localUsers.id, email: localUsers.email, name: localUsers.name,
    role: localUsers.role, active: localUsers.active,
    createdAt: localUsers.createdAt, lastSignedIn: localUsers.lastSignedIn,
  }).from(localUsers).orderBy(localUsers.name);
}

export async function createLocalUser(email: string, name: string, password: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const hash = await bcrypt.hash(password, 12);
  await db.insert(localUsers).values({ email: email.toLowerCase().trim(), name, passwordHash: hash });
  return getLocalUserByEmail(email);
}

export async function updateLocalUserPassword(id: number, newPassword: string) {
  const db = await getDb();
  if (!db) return;
  const hash = await bcrypt.hash(newPassword, 12);
  await db.update(localUsers).set({ passwordHash: hash, updatedAt: new Date() }).where(eq(localUsers.id, id));
}

export async function toggleLocalUserActive(id: number, active: boolean) {
  const db = await getDb();
  if (!db) return;
  await db.update(localUsers).set({ active, updatedAt: new Date() }).where(eq(localUsers.id, id));
}

export async function verifyLocalUserPassword(email: string, password: string) {
  const user = await getLocalUserByEmail(email);
  if (!user || !user.active) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;
  const db = await getDb();
  if (db) await db.update(localUsers).set({ lastSignedIn: new Date() }).where(eq(localUsers.id, user.id));
  return user;
}

/** Guardar análise no histórico */
export async function criarAnalise(data: InsertAnaliseCuba) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(analisesCuba).values(data);
}

/** Listar histórico de análises de uma cuba */
export async function getAnalisesByCuba(cubaId: number, fermentacaoNum?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = fermentacaoNum !== undefined
    ? and(eq(analisesCuba.cubaId, cubaId), eq(analisesCuba.fermentacaoNum, fermentacaoNum))
    : eq(analisesCuba.cubaId, cubaId);
  return db.select().from(analisesCuba).where(conditions).orderBy(desc(analisesCuba.dataAnalise));
}
