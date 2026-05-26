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
  const result = await db.select().from(cubas).where(eq(cubas.codigo, codigo)).limit(1);
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
  }
) {
  const db = await getDb();
  if (!db) return;
  const set: Record<string, unknown> = {};
  if (data.tempPretendida !== undefined) set.tempPretendida = data.tempPretendida;
  if (data.desvioTempAlerta !== undefined) set.desvioTempAlerta = data.desvioTempAlerta;
  if (data.desvioDesnsAlerta !== undefined) set.desvioDesnsAlerta = data.desvioDesnsAlerta;
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
  tempL1?: string | null;
  tempL2?: string | null;
  tempL3?: string | null;
  densL1?: string | null;
  densL2?: string | null;
  densL3?: string | null;
  /** Leitura anterior para comparação de variação brusca */
  leituraAnterior?: {
    densL1?: string | null;
    densL2?: string | null;
    densL3?: string | null;
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
        break; // um alerta por leitura é suficiente
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
