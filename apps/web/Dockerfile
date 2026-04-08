FROM node:22-alpine AS builder
WORKDIR /app

# Switch to USTC mirror to avoid apk timeout in restricted networks
RUN sed -i 's|https://dl-cdn.alpinelinux.org|https://mirrors.ustc.edu.cn|g' /etc/apk/repositories \
    && corepack enable \
    && corepack prepare pnpm@latest --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/types/package.json ./packages/types/
COPY packages/db/package.json ./packages/db/
COPY apps/web/package.json ./apps/web/

RUN pnpm config set registry https://nexus.mellivora.com.cn:18082/repository/npm-group/ \
    && pnpm install --frozen-lockfile

COPY packages/ ./packages/
COPY apps/web/ ./apps/web/

ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

WORKDIR /app/apps/web
RUN pnpm build

# ─── Nginx ────────────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runner

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
