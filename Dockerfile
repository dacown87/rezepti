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

# ─── production ────────────────────────────────────────────────────────────────
FROM base AS production

ENV NODE_ENV=production

COPY .npmrc package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY public/ ./public/

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "dist/index.js"]

# ─── dev ───────────────────────────────────────────────────────────────────────
FROM base AS dev

ENV NODE_ENV=development

COPY .npmrc package*.json ./
RUN npm ci

EXPOSE 3000

CMD ["npx", "tsx", "watch", "src/index.ts"]
