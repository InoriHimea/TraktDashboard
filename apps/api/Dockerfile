# Dependency resolution strategy (P1-T07):
# We intentionally install with pnpm (matching pnpm-lock.yaml and CI) in a Node base,
# then run on Bun. All runtime dependencies (hono, postgres, ioredis, bullmq, drizzle,
# jose, zod, p-limit) are pure-JS and Bun-compatible, so there is no native-addon ABI
# mismatch between the install and run stages. Bun is used only as the TS-native runtime.
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
# Bun runs TypeScript natively — no build step needed.
# Pinned to the 1.2 minor (matches the bun-types the workspace targets).
FROM oven/bun:1.2-alpine AS runner
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
# (packages/db/drizzle is already included by `COPY packages/ ./packages/` above)

COPY apps/api/docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 3001

ENTRYPOINT ["./docker-entrypoint.sh"]
