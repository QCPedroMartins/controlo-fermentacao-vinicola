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

// ── Utilizadores Locais (login com email+password) ────────
// Para utilizadores sem conta Manus (enologia, laboratório, etc.)
export const localUsers = mysqlTable("local_users", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});
export type LocalUser = typeof localUsers.$inferSelect;

// ── Campanhas / Anos de Vindima ───────────────────────────
export const campanhas = mysqlTable("campanhas", {
  id: int("id").autoincrement().primaryKey(),
  nome: varchar("nome", { length: 60 }).notNull(),
  descricao: text("descricao"),
  ativa: boolean("ativa").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Campanha = typeof campanhas.$inferSelect;
export type InsertCampanha = typeof campanhas.$inferInsert;

// ── Cubas de Fermentação ───────────────────────────────────
export const cubas = mysqlTable("cubas", {
  id: int("id").autoincrement().primaryKey(),
  codigo: varchar("codigo", { length: 8 }).notNull().unique(),
  tipoCuba: mysqlEnum("tipo_cuba", ["vinho", "porto"]).default("vinho").notNull(),
  nomeLote: varchar("nome_lote", { length: 120 }),
  fermentacaoNum: int("fermentacao_num").default(1).notNull(),
  estado: mysqlEnum("estado", ["sem_dados", "em_fermentacao", "completa"])
    .default("sem_dados")
    .notNull(),
  densidadeLimite: decimal("densidade_limite", { precision: 7, scale: 3 }).default("0.990").notNull(),
  tempPretendida: decimal("temp_pretendida", { precision: 5, scale: 1 }),
  desvioTempAlerta: decimal("desvio_temp_alerta", { precision: 5, scale: 1 }).default("5.0").notNull(),
  desvioDesnsAlerta: decimal("desvio_desns_alerta", { precision: 7, scale: 3 }).default("0.010").notNull(),
  alertasDensidade: text("alertas_densidade"),
  pontoAguardentacao: decimal("ponto_aguardentacao", { precision: 5, scale: 2 }),
  desvioAguardentacaoAlerta: decimal("desvio_aguardentacao_alerta", { precision: 5, scale: 2 }).default("0.50").notNull(),
  fichaKilos: decimal("ficha_kilos", { precision: 10, scale: 1 }),
  fichaLitros: decimal("ficha_litros", { precision: 10, scale: 1 }),
  fichaPh: decimal("ficha_ph", { precision: 4, scale: 2 }),
  fichaAt: decimal("ficha_at", { precision: 6, scale: 2 }),
  fichaAv: decimal("ficha_av", { precision: 6, scale: 2 }),
  fichaNfa: decimal("ficha_nfa", { precision: 7, scale: 1 }),
  fichaNtu: decimal("ficha_ntu", { precision: 8, scale: 1 }),
  fichaGluconico: decimal("ficha_gluconico", { precision: 6, scale: 2 }),
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
  fermentacaoNum: int("fermentacao_num").default(1).notNull(),
  campanhaId: int("campanha_id"),
  dataLeitura: date("data_leitura", { mode: "string" }).notNull(),
  hora: varchar("hora", { length: 8 }),
  diaNr: int("dia_nr"),
  densL1: decimal("dens_l1", { precision: 8, scale: 4 }),
  tempL1: decimal("temp_l1", { precision: 5, scale: 1 }),
  o2: decimal("o2", { precision: 6, scale: 2 }),
  redox: decimal("redox", { precision: 6, scale: 1 }),
  baumeL1: decimal("baume_l1", { precision: 5, scale: 2 }),
  userId: int("user_id"),
  userName: varchar("user_name", { length: 120 }),
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
  campanhaId: int("campanha_id"),
  dataAdicao: date("data_adicao", { mode: "string" }).notNull(),
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
  campanhaId: int("campanha_id"),
  nomeLote: varchar("nome_lote", { length: 120 }),
  dataInicio: date("data_inicio", { mode: "string" }),
  dataFim: date("data_fim", { mode: "string" }),
  totalDias: int("total_dias"),
  densMin: decimal("dens_min", { precision: 7, scale: 3 }),
  tempMax: decimal("temp_max", { precision: 5, scale: 1 }),
  archivedBy: varchar("archived_by", { length: 120 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FermentacaoArquivo = typeof fermentacoesArquivo.$inferSelect;
export type InsertFermentacaoArquivo = typeof fermentacoesArquivo.$inferInsert;

// ── Cálculo de Baumé de Envasilhamento (Vinho do Porto) ───
export const baumeCalculo = mysqlTable("baume_calculo", {
  id: int("id").autoincrement().primaryKey(),
  cubaId: int("cuba_id").notNull().unique(),
  mostoFresco: decimal("mosto_fresco", { precision: 10, scale: 1 }),
  beLagrima: decimal("be_lagrima", { precision: 5, scale: 2 }),
  alcool: decimal("alcool", { precision: 5, scale: 2 }),
  beActual: decimal("be_actual", { precision: 5, scale: 2 }),
  grauVinica: decimal("grau_vinica", { precision: 5, scale: 2 }).default("77.00"),
  beAbafar: decimal("be_abafar", { precision: 5, scale: 2 }),
  beLagrimaPretendido: decimal("be_lagrima_pretendido", { precision: 5, scale: 2 }),
  adNecessaria: decimal("ad_necessaria", { precision: 10, scale: 1 }),
  adPorPipa: decimal("ad_por_pipa", { precision: 8, scale: 2 }),
  volumeFinal: decimal("volume_final", { precision: 10, scale: 1 }),
  pipasFinals: decimal("pipas_finals", { precision: 8, scale: 2 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BaumeCalculo = typeof baumeCalculo.$inferSelect;
export type InsertBaumeCalculo = typeof baumeCalculo.$inferInsert;

// ── Recepções de Uvas ─────────────────────────────────────
export const recepcoes = mysqlTable("recepcoes", {
  id: int("id").autoincrement().primaryKey(),
  dataRecepcao: date("data_recepcao", { mode: "string" }).notNull(),
  /** Variedade / casta */
  casta: varchar("casta", { length: 120 }),
  /** Kg totais recebidos */
  kgTotal: decimal("kg_total", { precision: 10, scale: 1 }).notNull(),
  notas: text("notas"),
  campanhaId: int("campanha_id"),
  userId: int("user_id"),
  userName: varchar("user_name", { length: 120 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Recepcao = typeof recepcoes.$inferSelect;
export type InsertRecepcao = typeof recepcoes.$inferInsert;

// ── Distribuição de Recepção por Cubas ────────────────────
export const recepcaoCubas = mysqlTable("recepcao_cubas", {
  id: int("id").autoincrement().primaryKey(),
  recepcaoId: int("recepcao_id").notNull(),
  cubaId: int("cuba_id").notNull(),
  /** Kg atribuídos a esta cuba */
  kg: decimal("kg", { precision: 10, scale: 1 }).notNull(),
  notas: text("notas"),
});

export type RecepcaoCuba = typeof recepcaoCubas.$inferSelect;
export type InsertRecepcaoCuba = typeof recepcaoCubas.$inferInsert;

// ── Movimentos de Cuba ────────────────────────────────────
export const movimentosCuba = mysqlTable("movimentos_cuba", {
  id: int("id").autoincrement().primaryKey(),
  /** transferencia: 1 origem → 1 destino; juncao: N origens → 1 destino */
  tipo: mysqlEnum("tipo_movimento", ["transferencia", "juncao"]).notNull(),
  dataMovimento: date("data_movimento", { mode: "string" }).notNull(),
  /** JSON array de IDs das cubas de origem, ex: "[1]" ou "[1,2]" */
  cubasOrigemIds: text("cubas_origem_ids").notNull(),
  cubaDestinoId: int("cuba_destino_id").notNull(),
  motivo: text("motivo"),
  campanhaId: int("campanha_id"),
  userId: int("user_id"),
  userName: varchar("user_name", { length: 120 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MovimentoCuba = typeof movimentosCuba.$inferSelect;
export type InsertMovimentoCuba = typeof movimentosCuba.$inferInsert;
