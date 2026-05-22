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

// ── Leituras ──────────────────────────────────────────────
export async function getLeiturasByCuba(cubaId: number, fermentacaoNum?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = fermentacaoNum !== undefined
    ? and(eq(leituras.cubaId, cubaId), eq(leituras.fermentacaoNum, fermentacaoNum))
    : eq(leituras.cubaId, cubaId);
  return db.select().from(leituras).where(conditions).orderBy(asc(leituras.dataLeitura));
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

export async function updateLeitura(
  id: number,
  data: Partial<{
    densL1: string | null;
    densL2: string | null;
    densL3: string | null;
    tempL1: string | null;
    tempL2: string | null;
    tempL3: string | null;
    o2: string | null;
    redox: string | null;
  }>
) {
  const db = await getDb();
  if (!db) return;
  await db.update(leituras).set(data).where(eq(leituras.id, id));
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
