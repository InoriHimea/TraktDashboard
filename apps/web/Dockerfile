FROM node:22-alpine AS builder
WORKDIR /app

# Build args for registry configuration
ARG NPM_REGISTRY=https://registry.npmjs.org/
ARG APK_MIRROR=https://dl-cdn.alpinelinux.org/alpine

# Switch apk mirror if specified
RUN if [ "${APK_MIRROR}" != "https://dl-cdn.alpinelinux.org/alpine" ]; then \
      sed -i "s|https://dl-cdn.alpinelinux.org/alpine|${APK_MIRROR}|g" /etc/apk/repositories; \
    fi

# Install pnpm via npm
RUN npm install -g pnpm@10.19.0 --registry=${NPM_REGISTRY}

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/types/package.json ./packages/types/
COPY packages/db/package.json ./packages/db/
COPY apps/web/package.json ./apps/web/

RUN if [ "${NPM_REGISTRY}" != "https://registry.npmjs.org/" ]; then \
      pnpm config set registry ${NPM_REGISTRY}; \
    fi \
    && pnpm install --frozen-lockfile

COPY packages/ ./packages/
COPY apps/web/ ./apps/web/

ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

WORKDIR /app/apps/web
RUN pnpm build

# ─── Nginx ────────────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runner

# Build args for registry configuration
ARG APK_MIRROR=https://dl-cdn.alpinelinux.org/alpine

# Switch apk mirror if specified
RUN if [ "${APK_MIRROR}" != "https://dl-cdn.alpinelinux.org/alpine" ]; then \
      sed -i "s|https://dl-cdn.alpinelinux.org/alpine|${APK_MIRROR}|g" /etc/apk/repositories; \
    fi

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
