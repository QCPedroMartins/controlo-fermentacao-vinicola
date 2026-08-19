# Controlo de Fermentação Vinícola

Aplicação web para gestão operacional de fermentações numa adega. Centraliza o acompanhamento de cubas, leituras analíticas, recepções de uva, transferências e junções, relatórios e rastreabilidade.

## Funcionalidades principais

| Área | Funcionalidades |
|---|---|
| Cubas | Dashboard, ficha inicial, densidade, temperatura, Baumé, análises, adições e comentários. |
| Rastreabilidade | Transferências parciais para múltiplos destinos, junções, actualização de litros e histórico por cuba. A origem vê todos os destinos; cada destino vê apenas a parcela recebida. |
| Vindima | Campanhas, recepção de uvas e distribuição de quilogramas por várias cubas. |
| Dados e alertas | Importação de CSV, registo rápido, limites de densidade, alertas reconhecíveis e histórico de alertas. |
| Relatórios | Exportação PDF/Excel, gráficos, digest diário por email e inclusão de análises, movimentos, alertas e comentários. |
| Acesso | Contas locais próprias (email e password), com permissões de edição para a equipa de enologia e laboratório. Login OAuth externo opcional. |

## Tecnologias

O projecto usa **React 19**, **TypeScript**, **Tailwind CSS 4**, **Express 4**, **tRPC 11**, **Drizzle ORM** e **MySQL/TiDB**. Os relatórios usam PDFKit, ExcelJS e Canvas; o envio de email é realizado através de Resend.

## Estrutura

```text
client/                 Interface React
  src/pages/            Dashboard, Cuba, campanhas, recepções e registo rápido
  src/components/       Componentes de interface reutilizáveis
server/                 API tRPC, acesso à base de dados e relatórios
drizzle/                Schema e migrações da base de dados
examples/html-js/       Exemplo autónomo, sem framework, em HTML/CSS/JavaScript
server/*.test.ts        Testes Vitest
```

## Instalação local

Requer **Node.js 22+**, **pnpm 10+** e uma base de dados MySQL/TiDB compatível.

```bash
pnpm install
pnpm check
pnpm test
pnpm dev
```

O servidor de desenvolvimento inicia por defeito em `http://localhost:3000`.

## Variáveis de ambiente

Crie um ficheiro `.env` local, que **não deve ser enviado para o GitHub**, e configure as variáveis necessárias ao seu ambiente:

```dotenv
NODE_ENV=production
PORT=3000
DATABASE_URL=mysql://utilizador:palavra-passe@host:3306/base_de_dados
JWT_SECRET=uma_chave_longa_e_aleatoria
VITE_APP_ID=fermentacao-vinicola
# Opcional: envio de relatórios por email
RESEND_API_KEY=re_...
```

O ficheiro [`.env.example`](./.env.example) descreve cada variável em detalhe. Apenas `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`, `PORT` e `VITE_APP_ID` são obrigatórias; as restantes são opcionais.

A autenticação é **autónoma**: as contas ficam na tabela `local_users`, com as passwords guardadas apenas como hash bcrypt, e as sessões são JWT assinados localmente com o `JWT_SECRET`. Nenhum pedido sai do servidor para validar um início de sessão. Crie a primeira conta com:

```bash
ADMIN_EMAIL=admin@adega.pt ADMIN_PASSWORD='...' node scripts/criar-admin.mjs
```

Se preferir delegar o login num portal OAuth externo, defina `OAUTH_SERVER_URL` e `VITE_OAUTH_PORTAL_URL`; nesse caso a página de login passa a apresentar também essa opção.

## Base de dados

Antes de iniciar uma instância nova, confirme a ligação em `DATABASE_URL`. Depois gere e aplique as migrações:

```bash
pnpm db:push
```

> Em produção, reveja sempre a migração SQL antes de a aplicar a uma base de dados com informação operacional.

## Compilação e execução em produção

```bash
pnpm build
pnpm start
```

## Publicação em servidor próprio

O repositório inclui `Dockerfile`, `docker-compose.yml` e o script `scripts/criar-admin.mjs`, que permitem colocar a aplicação online num servidor independente. O caminho mais rápido é:

```bash
cp .env.example .env      # preencher MYSQL_PASSWORD, JWT_SECRET e ADMIN_PASSWORD
docker compose up -d --build
docker compose run --rm migrate
docker compose run --rm criar-admin
```

Consulte o [guia de publicação](./DEPLOY.md) para as opções detalhadas: VPS com Docker, plataformas geridas como Railway ou Render, instalação directa com systemd, HTTPS com domínio próprio, tarefas agendadas e cópias de segurança.

## Exemplo HTML/JavaScript autónomo

Na pasta [`examples/html-js`](./examples/html-js) encontra-se uma versão limpa em **HTML, CSS e JavaScript puro** do fluxo de movimentos entre cubas. É uma demonstração local e não contém autenticação, base de dados ou serviços de email. Abra `examples/html-js/index.html` directamente no navegador para a utilizar.

## Segurança

Nunca inclua no repositório ficheiros `.env`, tokens, chaves de email, credenciais de base de dados ou dados exportados de produção. Antes de partilhar o repositório, confirme que só contém código e documentação.

## Licença

Código privado para uso interno da adega Castelares. Todos os direitos reservados.
