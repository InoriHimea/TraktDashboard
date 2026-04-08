FROM oven/bun:1.1-alpine AS base
WORKDIR /app

# ─── Install dependencies ─────────────────────────────────────────────────────
FROM base AS deps

# Install pnpm
RUN npm install -g pnpm

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml bunfig.toml ./
COPY packages/types/package.json ./packages/types/
COPY packages/db/package.json ./packages/db/
COPY apps/api/package.json ./apps/api/

RUN pnpm install --frozen-lockfile

# ─── Production image ─────────────────────────────────────────────────────────
# Bun runs TypeScript natively — no build step needed
FROM oven/bun:1.1-alpine AS runner
WORKDIR /app

# Switch to USTC mirror to avoid apk timeout in restricted networks
RUN sed -i 's|https://dl-cdn.alpinelinux.org|https://mirrors.ustc.edu.cn|g' /etc/apk/repositories \
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
