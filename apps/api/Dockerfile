FROM node:22-alpine AS deps
WORKDIR /app

# Build args for registry configuration
ARG NPM_REGISTRY=https://registry.npmjs.org/
ARG APK_MIRROR=https://dl-cdn.alpinelinux.org/alpine

# Install pnpm via npm
RUN npm install -g pnpm@10.19.0 --registry=${NPM_REGISTRY}

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml bunfig.toml ./
COPY packages/types/package.json ./packages/types/
COPY packages/db/package.json ./packages/db/
COPY apps/api/package.json ./apps/api/

RUN pnpm install --frozen-lockfile

# ─── Production image ─────────────────────────────────────────────────────────
# Bun runs TypeScript natively — no build step needed
FROM oven/bun:1.1-alpine AS runner
WORKDIR /app

# Build args for registry configuration
ARG APK_MIRROR=https://dl-cdn.alpinelinux.org/alpine

# Switch apk mirror if specified
RUN if [ "${APK_MIRROR}" != "https://dl-cdn.alpinelinux.org/alpine" ]; then \
      sed -i "s|https://dl-cdn.alpinelinux.org/alpine|${APK_MIRROR}|g" /etc/apk/repositories; \
    fi \
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
