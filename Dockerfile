# ─── base ──────────────────────────────────────────────────────────────────────
FROM node:20-slim AS base

WORKDIR /app

# yt-dlp + ffmpeg
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates ffmpeg python3 python3-pip \
    && pip3 install --no-cache-dir --break-system-packages --upgrade yt-dlp \
    && rm -rf /var/lib/apt/lists/* \
    && yt-dlp --version

# Network debugging tools for troubleshooting
RUN apt-get update && apt-get install -y --no-install-recommends \
    iputils-ping net-tools dnsutils curl \
    && rm -rf /var/lib/apt/lists/*

# ─── builder ───────────────────────────────────────────────────────────────────
FROM base AS builder

COPY .npmrc package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
# Alle Imports in src/ müssen .js-Extensions tragen (ESM-Konvention im Projekt).
# Falls tsc hier scheitert, zuerst 'npx tsc --noEmit' lokal prüfen.
RUN npx tsc

# ─── web-builder ──────────────────────────────────────────────────────────────
FROM node:20-slim AS web-builder

WORKDIR /app

COPY mobile/package*.json ./mobile/
RUN cd mobile && npm ci

COPY mobile/ ./mobile/
RUN cd mobile && CI=1 npx expo export --platform web --output-dir ../public

# ─── production ────────────────────────────────────────────────────────────────
FROM base AS production

ENV NODE_ENV=production

COPY .npmrc package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=web-builder /app/public ./public
COPY public/changelog.json ./public/changelog.json

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3000/api/v1/health || exit 1

CMD ["node", "dist/index.js"]

# ─── dev ───────────────────────────────────────────────────────────────────────
FROM base AS dev

ENV NODE_ENV=development

COPY .npmrc package*.json ./
RUN npm ci

EXPOSE 3000

CMD ["npx", "tsx", "watch", "src/index.ts"]
