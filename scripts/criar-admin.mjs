#!/usr/bin/env node
/**
 * criar-admin.mjs
 *
 * Cria ou actualiza uma conta de acesso local (tabela `local_users`).
 * Nao depende de qualquer servico externo: escreve directamente na base de
 * dados indicada por DATABASE_URL e guarda apenas o hash bcrypt da password.
 *
 * Uso:
 *   ADMIN_EMAIL=admin@adega.pt ADMIN_PASSWORD='...' node scripts/criar-admin.mjs
 *
 * Variaveis:
 *   DATABASE_URL    (obrigatoria) ligacao MySQL
 *   ADMIN_EMAIL     (obrigatoria) email da conta
 *   ADMIN_PASSWORD  (obrigatoria) password em texto simples, minimo 8 caracteres
 *   ADMIN_NAME      (opcional)    nome a mostrar, por omissao "Administrador"
 *   ADMIN_ROLE      (opcional)    "admin" ou "user", por omissao "admin"
 */
import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";

const {
  DATABASE_URL,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ADMIN_NAME = "Administrador",
  ADMIN_ROLE = "admin",
} = process.env;

function sair(mensagem) {
  console.error(`[criar-admin] ${mensagem}`);
  process.exit(1);
}

if (!DATABASE_URL) sair("DATABASE_URL nao esta definida.");
if (!ADMIN_EMAIL) sair("ADMIN_EMAIL nao esta definida.");
if (!ADMIN_PASSWORD) sair("ADMIN_PASSWORD nao esta definida.");
if (ADMIN_PASSWORD.length < 8) sair("ADMIN_PASSWORD deve ter pelo menos 8 caracteres.");
if (!["admin", "user"].includes(ADMIN_ROLE)) sair('ADMIN_ROLE deve ser "admin" ou "user".');

const email = ADMIN_EMAIL.toLowerCase().trim();

let ligacao;
try {
  ligacao = await mysql.createConnection(DATABASE_URL);
} catch (erro) {
  sair(`Nao foi possivel ligar a base de dados: ${erro.message}`);
}

try {
  const [tabelas] = await ligacao.query("SHOW TABLES LIKE 'local_users'");
  if (tabelas.length === 0) {
    sair(
      "A tabela `local_users` nao existe. Aplique primeiro as migracoes: npx drizzle-kit migrate",
    );
  }

  const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  await ligacao.execute(
    `INSERT INTO local_users (email, name, password_hash, role, active)
     VALUES (?, ?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       password_hash = VALUES(password_hash),
       role = VALUES(role),
       active = 1`,
    [email, ADMIN_NAME, hash, ADMIN_ROLE],
  );

  const [linhas] = await ligacao.execute(
    "SELECT id, email, name, role, active FROM local_users WHERE email = ?",
    [email],
  );

  const conta = linhas[0];
  console.log(
    `[criar-admin] Conta pronta: #${conta.id} ${conta.email} (${conta.role}). Pode iniciar sessao em /login`,
  );
} catch (erro) {
  sair(`Falhou: ${erro.message}`);
} finally {
  await ligacao.end();
}
