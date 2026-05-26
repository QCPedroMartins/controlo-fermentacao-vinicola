import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  date,
  smallint,
} from "drizzle-orm/mysql-core";

// ── Utilizadores ──────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ── Cubas de Fermentação ───────────────────────────────────
export const cubas = mysqlTable("cubas", {
  id: int("id").autoincrement().primaryKey(),
  /** Identificador interno fixo: cf1, cf2, ..., lf37, lf38, cf80..cf85, cf93, cf94, cf200..cf210 */
  codigo: varchar("codigo", { length: 8 }).notNull().unique(),
  /** Nome/lote personalizável pelo utilizador */
  nomeLote: varchar("nome_lote", { length: 120 }),
  /** Número da fermentação atual (incrementa ao arquivar) */
  fermentacaoNum: int("fermentacao_num").default(1).notNull(),
  /** Estado calculado: sem_dados | em_fermentacao | completa */
  estado: mysqlEnum("estado", ["sem_dados", "em_fermentacao", "completa"])
    .default("sem_dados")
    .notNull(),
  /** Densidade limite para considerar fermentação completa (ex: 1.000, 1.050) */
  densidadeLimite: decimal("densidade_limite", { precision: 7, scale: 3 }).default("1.000").notNull(),
  /** Temperatura de fermentação pretendida (°C) */
  tempPretendida: decimal("temp_pretendida", { precision: 5, scale: 1 }),
  /** Limiar de desvio de temperatura para alerta (°C, padrão: 5) */
  desvioTempAlerta: decimal("desvio_temp_alerta", { precision: 5, scale: 1 }).default("5.0").notNull(),
  /** Limiar de variação brusca de densidade entre leituras consecutivas (padrão: 10 pontos = 0.010) */
  desvioDesnsAlerta: decimal("desvio_desns_alerta", { precision: 7, scale: 3 }).default("0.010").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Cuba = typeof cubas.$inferSelect;
export type InsertCuba = typeof cubas.$inferInsert;

// ── Leituras Diárias ──────────────────────────────────────
export const leituras = mysqlTable("leituras", {
  id: int("id").autoincrement().primaryKey(),
  cubaId: int("cuba_id").notNull(),
  /** Número da fermentação a que esta leitura pertence */
  fermentacaoNum: int("fermentacao_num").default(1).notNull(),
  /** Data da leitura (apenas data, sem hora) */
  dataLeitura: date("data_leitura").notNull(),
  /** Dia de fermentação calculado (1, 2, 3...) */
  diaNr: int("dia_nr"),
  // Densidade — 3 leituras por dia
  densL1: decimal("dens_l1", { precision: 7, scale: 3 }),
  densL2: decimal("dens_l2", { precision: 7, scale: 3 }),
  densL3: decimal("dens_l3", { precision: 7, scale: 3 }),
  // Temperatura — 3 leituras por dia
  tempL1: decimal("temp_l1", { precision: 5, scale: 1 }),
  tempL2: decimal("temp_l2", { precision: 5, scale: 1 }),
  tempL3: decimal("temp_l3", { precision: 5, scale: 1 }),
  // O₂ dissolvido (mg/L) — leitura semanal
  o2: decimal("o2", { precision: 6, scale: 2 }),
  // Potencial Redox (mV) — leitura semanal
  redox: decimal("redox", { precision: 6, scale: 1 }),
  /** Utilizador que registou */
  userId: int("user_id"),
  userName: varchar("user_name", { length: 120 }),
  /** Auditoria de edição */
  editedAt: timestamp("edited_at"),
  editedBy: int("edited_by"),
  editedByName: varchar("edited_by_name", { length: 120 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Leitura = typeof leituras.$inferSelect;
export type InsertLeitura = typeof leituras.$inferInsert;

// ── Adições e Notas ───────────────────────────────────────
export const adicoes = mysqlTable("adicoes", {
  id: int("id").autoincrement().primaryKey(),
  cubaId: int("cuba_id").notNull(),
  fermentacaoNum: int("fermentacao_num").default(1).notNull(),
  dataAdicao: date("data_adicao").notNull(),
  produto: varchar("produto", { length: 200 }),
  dose: varchar("dose", { length: 100 }),
  observacoes: text("observacoes"),
  userId: int("user_id"),
  userName: varchar("user_name", { length: 120 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Adicao = typeof adicoes.$inferSelect;
export type InsertAdicao = typeof adicoes.$inferInsert;

// ── Arquivo de Fermentações ───────────────────────────────
export const fermentacoesArquivo = mysqlTable("fermentacoes_arquivo", {
  id: int("id").autoincrement().primaryKey(),
  cubaId: int("cuba_id").notNull(),
  fermentacaoNum: int("fermentacao_num").notNull(),
  nomeLote: varchar("nome_lote", { length: 120 }),
  dataInicio: date("data_inicio"),
  dataFim: date("data_fim"),
  totalDias: int("total_dias"),
  densMin: decimal("dens_min", { precision: 7, scale: 3 }),
  tempMax: decimal("temp_max", { precision: 5, scale: 1 }),
  archivedBy: varchar("archived_by", { length: 120 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FermentacaoArquivo = typeof fermentacoesArquivo.$inferSelect;
export type InsertFermentacaoArquivo = typeof fermentacoesArquivo.$inferInsert;
