FROM node:22-alpine AS deps
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml bunfig.toml ./
COPY packages/types/package.json ./packages/types/
COPY packages/db/package.json ./packages/db/
COPY apps/api/package.json ./apps/api/

RUN pnpm install --frozen-lockfile

# ─── Production image ─────────────────────────────────────────────────────────
# Bun runs TypeScript natively — no build step needed
FROM oven/bun:1.1-alpine AS runner
WORKDIR /app

# Switch to internal Nexus apk mirror
RUN sed -i 's|https://dl-cdn.alpinelinux.org/alpine|https://artifact.mellivora.com.cn/alpine/apk-group|g' /etc/apk/repositories \
    && apk add --no-cache curl

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/
COPY packages/db/drizzle ./packages/db/drizzle

COPY apps/api/docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 3001

ENTRYPOINT ["./docker-entrypoint.sh"]
