FROM oven/bun:1.1-alpine AS base
WORKDIR /app

# ─── Install dependencies ─────────────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-workspace.yaml ./
COPY packages/types/package.json ./packages/types/
COPY packages/db/package.json ./packages/db/
COPY apps/api/package.json ./apps/api/

# Use bun workspaces install
RUN bun install --frozen-lockfile

# ─── Build ───────────────────────────────────────────────────────────────────
FROM deps AS builder
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

WORKDIR /app/apps/api
RUN bun build src/index.ts --target bun --outdir dist --external postgres --external ioredis

# ─── Production image ─────────────────────────────────────────────────────────
FROM oven/bun:1.1-alpine AS runner
WORKDIR /app

RUN apk add --no-cache curl

# Copy only what's needed
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/packages/db/drizzle ./packages/db/drizzle

# Entrypoint script handles migrations then starts server
COPY apps/api/docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 3001

ENTRYPOINT ["./docker-entrypoint.sh"]
