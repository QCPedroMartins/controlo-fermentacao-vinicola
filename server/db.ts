import {
  and,
  asc,
  desc,
  eq,
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
  // Normalizar o código: maiúsculas + zero de preenchimento se necessário
  // Exemplos: vp3 → VP03, cf1 → CF01, VP01 → VP01, lf37 → LF37
  const upper = codigo.toUpperCase();
  // Se terminar em dígitos sem zero de preenchimento (ex: VP3, CF1), adicionar zero
  const normalized = upper.replace(/^([A-Z]+)(\d+)$/, (_, prefix, num) => {
    // Manter o formato original se já tiver 2+ dígitos; caso contrário adicionar zero
    return num.length === 1 ? prefix + '0' + num : prefix + num;
  });
  // Tentar primeiro com o código normalizado, depois com o original em maiúsculas
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

/** Atualiza as configurações de alerta de temperatura e densidade de uma cuba */
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

/** Atualiza a ficha inicial de uma cuba (kg, litros, análises iniciais) */
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
    if (data[f] !== undefined) set[f] = data[f] === "" ? null : data[f];
  }
  if (Object.keys(set).length > 0) {
    await db.update(cubas).set(set).where(eq(cubas.id, id));
  }
}

/** Verifica se alguma densidade da leitura atingiu o limite e atualiza estado da cuba */
export async function verificarFermentacaoCompleta(
  cubaId: number,
  densidades: (string | null | undefined)[],
  densidadeLimite: string
): Promise<boolean> {
  const limite = parseFloat(densidadeLimite);
  const atingiu = densidades
    .filter((d): d is string => d !== null && d !== undefined && d !== "")
    .some((d) => parseFloat(d) <= limite);
  if (atingiu) {
    await updateCubaEstado(cubaId, "completa");
  }
  return atingiu;
}

/** Verifica alertas de temperatura e densidade para uma leitura nova/editada.
 *  Retorna array de mensagens de alerta (vazio se tudo OK). */
export function calcularAlertas(params: {
  tempPretendida: string | null | undefined;
  desvioTempAlerta: string;
  desvioDesnsAlerta: string;
  /** Lista JSON de valores de densidade que geram alertas (ex: "[1.050,1.020]") */
  alertasDensidade?: string | null;
  /** Ponto de Baumé para aguardentação (cubas VP) */
  pontoAguardentacao?: string | null;
  desvioAguardentacaoAlerta?: string;
  tempL1?: string | null;
  tempL2?: string | null;
  tempL3?: string | null;
  densL1?: string | null;
  densL2?: string | null;
  densL3?: string | null;
  baumeL1?: string | null;
  baumeL2?: string | null;
  baumeL3?: string | null;
  /** Leitura anterior para comparação de variação brusca */
  leituraAnterior?: {
    densL1?: string | null;
    densL2?: string | null;
    densL3?: string | null;
    baumeL1?: string | null;
    baumeL2?: string | null;
    baumeL3?: string | null;
  } | null;
}): string[] {
  const alertas: string[] = [];
  const desvioTemp = parseFloat(params.desvioTempAlerta) || 5;
  const desvioDesns = parseFloat(params.desvioDesnsAlerta) || 0.010;

  // Alerta de temperatura
  if (params.tempPretendida) {
    const pretendida = parseFloat(params.tempPretendida);
    const temps = [params.tempL1, params.tempL2, params.tempL3]
      .filter((t): t is string => t !== null && t !== undefined && t !== "")
      .map(parseFloat);
    for (const t of temps) {
      if (Math.abs(t - pretendida) > desvioTemp) {
        alertas.push(
          `Temperatura ${t.toFixed(1)}°C desvia ${Math.abs(t - pretendida).toFixed(1)}°C da pretendida (${pretendida.toFixed(1)}°C ± ${desvioTemp}°C)`
        );
        break;
      }
    }
  }

  // Alerta de variação brusca de densidade entre leituras consecutivas
  if (params.leituraAnterior) {
    const pares: [string | null | undefined, string | null | undefined][] = [
      [params.leituraAnterior.densL1, params.densL1],
      [params.leituraAnterior.densL2, params.densL2],
      [params.leituraAnterior.densL3, params.densL3],
    ];
    for (const [anterior, atual] of pares) {
      if (
        anterior !== null && anterior !== undefined && anterior !== "" &&
        atual !== null && atual !== undefined && atual !== ""
      ) {
        const diff = Math.abs(parseFloat(anterior) - parseFloat(atual));
        if (diff > desvioDesns) {
          alertas.push(
            `Variação brusca de densidade: ${diff.toFixed(3)} (limiar: ${desvioDesns.toFixed(3)})`
          );
          break;
        }
      }
    }
  }

  // Alertas de densidade por valor específico (cubas de vinho)
  if (params.alertasDensidade) {
    try {
      const valoresAlerta: number[] = JSON.parse(params.alertasDensidade);
      const densidades = [params.densL1, params.densL2, params.densL3]
        .filter((d): d is string => d !== null && d !== undefined && d !== "")
        .map(parseFloat);
      const anteriores = [
        params.leituraAnterior?.densL1,
        params.leituraAnterior?.densL2,
        params.leituraAnterior?.densL3,
      ].filter((d): d is string => d !== null && d !== undefined && d !== "")
        .map(parseFloat);
      for (const limiar of valoresAlerta) {
        const cruzou = densidades.some((d) => d <= limiar);
        const jaCruzado = anteriores.some((d) => d <= limiar);
        if (cruzou && !jaCruzado) {
          alertas.push(`Densidade atingiu o valor de alerta: ${limiar.toFixed(3)}`);
        }
      }
    } catch { /* JSON inválido, ignorar */ }
  }

  // Alerta de aguardentação (cubas VP — Baumé)
  if (params.pontoAguardentacao) {
    const ponto = parseFloat(params.pontoAguardentacao);
    const desvioAg = parseFloat(params.desvioAguardentacaoAlerta ?? "0.50") || 0.5;
    const baumesAtuais = [params.baumeL1, params.baumeL2, params.baumeL3]
      .filter((b): b is string => b !== null && b !== undefined && b !== "")
      .map(parseFloat);
    for (const b of baumesAtuais) {
      if (Math.abs(b - ponto) <= desvioAg) {
        alertas.push(
          `⚠️ AGUARDENTAÇÃO: Baumé ${b.toFixed(2)}° está no ponto de aguardentação (${ponto.toFixed(2)}° ± ${desvioAg.toFixed(2)}°) — adicionar aguardente!`
        );
        break;
      }
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

// Helper: converte string "YYYY-MM-DD" para Date (para campos date do Drizzle MySQL)
function toDate(dateStr: string): Date {
  return new Date(dateStr + "T00:00:00.000Z");
}

export async function createLeitura(data: {
  cubaId: number;
  fermentacaoNum: number;
  dataLeitura: string;
  diaNr?: number;
  densL1?: string | null;
  densL2?: string | null;
  densL3?: string | null;
  tempL1?: string | null;
  tempL2?: string | null;
  tempL3?: string | null;
  o2?: string | null;
  redox?: string | null;
  baumeL1?: string | null;
  baumeL2?: string | null;
  baumeL3?: string | null;
  userId?: number;
  userName?: string;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(leituras).values({
    cubaId: data.cubaId,
    fermentacaoNum: data.fermentacaoNum,
    dataLeitura: toDate(data.dataLeitura),
    diaNr: data.diaNr,
    densL1: data.densL1 ?? null,
    densL2: data.densL2 ?? null,
    densL3: data.densL3 ?? null,
    tempL1: data.tempL1 ?? null,
    tempL2: data.tempL2 ?? null,
    tempL3: data.tempL3 ?? null,
    o2: data.o2 ?? null,
    redox: data.redox ?? null,
    baumeL1: data.baumeL1 ?? null,
    baumeL2: data.baumeL2 ?? null,
    baumeL3: data.baumeL3 ?? null,
    userId: data.userId,
    userName: data.userName,
  });
}

/** Editar uma leitura existente, registando quem editou e quando */
export async function editarLeitura(
  id: number,
  data: {
    densL1?: string | null;
    densL2?: string | null;
    densL3?: string | null;
    tempL1?: string | null;
    tempL2?: string | null;
    tempL3?: string | null;
    o2?: string | null;
    redox?: string | null;
    baumeL1?: string | null;
    baumeL2?: string | null;
    baumeL3?: string | null;
    editedBy?: number;
    editedByName?: string;
  }
) {
  const db = await getDb();
  if (!db) return;
  await db.update(leituras).set({
    densL1: data.densL1,
    densL2: data.densL2,
    densL3: data.densL3,
    tempL1: data.tempL1,
    tempL2: data.tempL2,
    tempL3: data.tempL3,
    o2: data.o2,
    redox: data.redox,
    baumeL1: data.baumeL1,
    baumeL2: data.baumeL2,
    baumeL3: data.baumeL3,
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
    dataAdicao: toDate(data.dataAdicao),
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
    dataInicio: data.dataInicio ? toDate(data.dataInicio) : null,
    dataFim: data.dataFim ? toDate(data.dataFim) : null,
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
  return db.select().from(cubas).orderBy(asc(cubas.id));
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
  // Desativar todas as campanhas existentes
  await db.update(campanhas).set({ ativa: false });
  // Criar nova campanha ativa
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

/** Ao arquivar uma fermentação, associa-a à campanha ativa */
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

/** Retorna arquivo de uma cuba filtrado por campanha */
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

// ── Cálculo de Baumé de Envasilhamento (Vinho do Porto) ───

/** Devolve o último cálculo de Baumé guardado para uma cuba VP */
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
 * Verifica se já existe uma leitura para uma cuba numa determinada data.
 * Usado na importação CSV para evitar duplicados.
 */
export async function leituraExistePorData(cubaId: number, dataLeituraIso: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const dataDate = toDate(dataLeituraIso);
  const rows = await db
    .select({ id: leituras.id })
    .from(leituras)
    .where(and(eq(leituras.cubaId, cubaId), eq(leituras.dataLeitura, dataDate)))
    .limit(1);
  return rows.length > 0;
}

/** Guarda (insert ou update) o cálculo de Baumé para uma cuba VP */
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
