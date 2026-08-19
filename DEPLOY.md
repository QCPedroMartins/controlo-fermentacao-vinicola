# Guia de publicação — Controlo de Fermentação Vinícola

Este documento descreve como colocar a aplicação online num servidor próprio, sem qualquer dependência da plataforma onde foi originalmente desenvolvida.

## O que a aplicação precisa

A aplicação é um único processo Node.js que serve simultaneamente a API e a interface web já compilada. Precisa apenas de três coisas: um ambiente Node 22, uma base de dados MySQL 8 (ou TiDB compatível) e um conjunto reduzido de variáveis de ambiente.

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | Sim | Ligação MySQL no formato `mysql://utilizador:password@host:3306/base` |
| `JWT_SECRET` | Sim | Segredo aleatório que assina os cookies de sessão. Gere com `openssl rand -base64 48` |
| `NODE_ENV` | Sim | Deve ser `production` |
| `PORT` | Depende | Porta HTTP; muitos alojamentos definem-na automaticamente |
| `VITE_APP_ID` | Sim | Texto estável que identifica a aplicação, incluído no JWT |
| `RESEND_API_KEY` | Não | Chave da conta [Resend](https://resend.com) para envio de relatórios por email |
| `OAUTH_SERVER_URL` | Não | Deixe vazio para usar apenas contas locais |

> A autenticação é totalmente autónoma: as contas ficam na tabela `local_users`, com as passwords guardadas apenas como hash bcrypt, e as sessões são JWT assinados localmente com o `JWT_SECRET`. Nenhum pedido sai do servidor para validar um login.

## Opção A — VPS com Docker Compose (recomendada)

Esta é a via mais simples de controlar por completo. Serve para qualquer servidor com Docker: Hetzner, DigitalOcean, OVH, Contabo ou uma máquina na própria adega.

Comece por clonar o repositório e preparar o ficheiro de configuração:

```bash
git clone https://github.com/QCPedroMartins/controlo-fermentacao-vinicola.git
cd controlo-fermentacao-vinicola
cp .env.example .env
```

Edite o `.env` e defina, no mínimo, `MYSQL_PASSWORD`, `JWT_SECRET` e `ADMIN_PASSWORD`. Depois levante a stack, aplique as migrações e crie a primeira conta:

```bash
docker compose up -d --build
docker compose run --rm migrate
docker compose run --rm criar-admin
```

A aplicação fica acessível em `http://IP_DO_SERVIDOR:3000`. Para colocar um domínio próprio com HTTPS, coloque um Caddy ou Nginx à frente:

```caddyfile
adega.oseudominio.pt {
    reverse_proxy localhost:3000
}
```

O Caddy obtém e renova o certificado Let's Encrypt automaticamente.

## Opção B — Plataforma gerida (Railway, Render, Fly.io)

Estas plataformas constroem a imagem a partir do `Dockerfile` incluído e tratam de HTTPS e domínio. O procedimento é semelhante em todas: ligar o repositório GitHub, adicionar uma base de dados MySQL gerida, e definir as variáveis de ambiente da tabela acima. A `DATABASE_URL` é normalmente fornecida pela própria plataforma.

Depois do primeiro arranque é necessário aplicar as migrações e criar a conta inicial, executando na consola da plataforma:

```bash
npx drizzle-kit migrate
ADMIN_EMAIL=admin@adega.pt ADMIN_PASSWORD='...' node scripts/criar-admin.mjs
```

Note que o Vercel e a Netlify **não** servem para esta aplicação, porque ela precisa de um processo Node persistente e não de funções serverless.

## Opção C — VPS sem Docker

Instale Node 22 e pnpm, clone o repositório e execute:

```bash
pnpm install --frozen-lockfile
pnpm build
npx drizzle-kit migrate
ADMIN_EMAIL=admin@adega.pt ADMIN_PASSWORD='...' node scripts/criar-admin.mjs
```

Para manter o processo sempre ativo, registe um serviço systemd em `/etc/systemd/system/fermentacao.service`:

```ini
[Unit]
Description=Controlo de Fermentacao Vinicola
After=network.target mysql.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/controlo-fermentacao-vinicola
EnvironmentFile=/opt/controlo-fermentacao-vinicola/.env
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Ative com `sudo systemctl enable --now fermentacao`.

## Tarefas agendadas

A aplicação expõe dois endpoints que enviam relatórios por email e que, na plataforma original, eram disparados por um agendador externo:

| Endpoint | Função |
|---|---|
| `POST /api/scheduled/daily-digest` | Resumo diário de todas as cubas |
| `POST /api/scheduled/fermentacao-completa` | Aviso de fermentação concluída |

Fora dessa plataforma, dispare-os com o cron do sistema. Como exigem uma sessão válida, o caminho mais simples é gerar um cookie de sessão de uma conta de serviço e guardá-lo num ficheiro:

```cron
0 8 * * * curl -s -X POST http://localhost:3000/api/scheduled/daily-digest -H "Cookie: app_session_id=$(cat /opt/adega/.sessao)" > /dev/null
```

Se preferir dispensar o cookie, pode proteger estes endpoints com um segredo próprio, comparando um cabeçalho contra uma variável de ambiente em `server/_core/index.ts`.

## Cópias de segurança

A base de dados é o único elemento com estado. Um backup diário resolve:

```cron
0 3 * * * docker compose exec -T db mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" fermentacao | gzip > /backups/fermentacao-$(date +\%F).sql.gz
```

Guarde as cópias fora do servidor, por exemplo num bucket S3 ou Backblaze B2.

## Actualizações futuras

Como o código está no GitHub e não depende de nada externo, qualquer actualização segue o ciclo habitual:

```bash
git pull
docker compose up -d --build
docker compose run --rm migrate
```

## Verificação final

Depois de publicar, confirme que a página `/login` abre, que a conta criada entra no Dashboard, que os dados persistem após `docker compose restart app` e que as exportações PDF e Excel do Dashboard funcionam.
