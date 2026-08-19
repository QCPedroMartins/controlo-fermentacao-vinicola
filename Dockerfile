# ─────────────────────────────────────────────────────────────────────────────
# Imagem de producao — Controlo de Fermentacao Vinicola
#
# Build em duas fases para manter a imagem final pequena:
#   1. builder  — instala todas as dependencias e compila cliente + servidor
#   2. runtime  — instala apenas dependencias de producao e copia o dist
#
# Arranque: node dist/index.js  (porta definida pela variavel PORT)
# ─────────────────────────────────────────────────────────────────────────────

FROM node:22-bookworm-slim AS builder

# Dependencias de sistema necessarias ao @napi-rs/canvas e a compilacao nativa
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        python3 \
        build-essential \
        pkg-config \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

WORKDIR /app

# Manifests primeiro, para aproveitar a cache de camadas do Docker
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile

# Codigo-fonte e build
COPY . .
RUN pnpm build


FROM node:22-bookworm-slim AS runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

ENV NODE_ENV=production
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile --prod

# Artefactos compilados
COPY --from=builder /app/dist ./dist

# Ficheiros necessarios em runtime
COPY drizzle ./drizzle
COPY drizzle.config.ts ./drizzle.config.ts
COPY server/fonts ./server/fonts

EXPOSE 3000

# Utilizador sem privilegios
USER node

CMD ["node", "dist/index.js"]
