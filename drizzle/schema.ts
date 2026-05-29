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
  boolean,
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

// ── Campanhas / Anos de Vindima ───────────────────────────
export const campanhas = mysqlTable("campanhas", {
  id: int("id").autoincrement().primaryKey(),
  /** Ex: "2025", "2026", "Campanha Especial 2025" */
  nome: varchar("nome", { length: 60 }).notNull(),
  descricao: text("descricao"),
  /** Campanha atualmente ativa (só uma pode estar ativa) */
  ativa: boolean("ativa").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Campanha = typeof campanhas.$inferSelect;
export type InsertCampanha = typeof campanhas.$inferInsert;

// ── Cubas de Fermentação ───────────────────────────────────
export const cubas = mysqlTable("cubas", {
  id: int("id").autoincrement().primaryKey(),
  /** Identificador interno fixo: cf1..cf57, vp01..vp05 */
  codigo: varchar("codigo", { length: 8 }).notNull().unique(),
  /** Tipo de cuba: 'vinho' (fermentação normal) | 'porto' (Vinho do Porto, usa Baumé) */
  tipoCuba: mysqlEnum("tipo_cuba", ["vinho", "porto"]).default("vinho").notNull(),
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
  // ── Alertas de Densidade por Valor (cubas de vinho) ──────
  /** Lista JSON de valores de densidade que geram alertas (ex: "[1.050,1.020,1.000]") */
  alertasDensidade: text("alertas_densidade"),
  // ── Vinho do Porto — Baumé ────────────────────────────────
  /** Ponto de Baumé em que se deve adicionar aguardente (ex: 6.5) */
  pontoAguardentacao: decimal("ponto_aguardentacao", { precision: 5, scale: 2 }),
  /** Desvio ± em torno do ponto de aguardentação para disparar alerta (padrão: 0.5) */
  desvioAguardentacaoAlerta: decimal("desvio_aguardentacao_alerta", { precision: 5, scale: 2 }).default("0.50").notNull(),
  // ── Ficha Inicial ────────────────────────────────────────
  /** Quantidade em quilogramas */
  fichaKilos: decimal("ficha_kilos", { precision: 10, scale: 1 }),
  /** Quantidade em litros */
  fichaLitros: decimal("ficha_litros", { precision: 10, scale: 1 }),
  /** pH inicial */
  fichaPh: decimal("ficha_ph", { precision: 4, scale: 2 }),
  /** Acidez Total (g/L) */
  fichaAt: decimal("ficha_at", { precision: 6, scale: 2 }),
  /** Acidez Volátil (g/L) */
  fichaAv: decimal("ficha_av", { precision: 6, scale: 2 }),
  /** Azoto Facilmente Assimilável (mg/L) */
  fichaNfa: decimal("ficha_nfa", { precision: 7, scale: 1 }),
  /** Turbidez NTU */
  fichaNtu: decimal("ficha_ntu", { precision: 8, scale: 1 }),
  /** Ácido Glucónico (g/L) */
  fichaGluconico: decimal("ficha_gluconico", { precision: 6, scale: 2 }),
  /** Álcool Provável (% vol) */
  fichaAlcoolProvavel: decimal("ficha_alcool_provavel", { precision: 5, scale: 2 }),
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
  /** Campanha a que esta leitura pertence */
  campanhaId: int("campanha_id"),
  /** Data da leitura (apenas data, sem hora) */
  dataLeitura: date("data_leitura").notNull(),
  /** Dia de fermentação calculado (1, 2, 3...) */
  diaNr: int("dia_nr"),
  // Densidade — 3 leituras por dia (cubas de vinho)
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
  // Baumé — 3 leituras por dia (cubas de Vinho do Porto)
  baumeL1: decimal("baume_l1", { precision: 5, scale: 2 }),
  baumeL2: decimal("baume_l2", { precision: 5, scale: 2 }),
  baumeL3: decimal("baume_l3", { precision: 5, scale: 2 }),
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
  /** Campanha a que esta adição pertence */
  campanhaId: int("campanha_id"),
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
  /** Campanha a que esta fermentação pertence */
  campanhaId: int("campanha_id"),
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
