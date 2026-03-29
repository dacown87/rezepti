# ─── base ──────────────────────────────────────────────────────────────────────
FROM node:20-slim AS base

WORKDIR /app

# Build-Tools für better-sqlite3 (natives Node-Addon)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# yt-dlp (static binary) + ffmpeg for video/audio processing
# Static binary is preferred over pip - no Python overhead, smaller image
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates ffmpeg \
    && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
       -o /usr/local/bin/yt-dlp \
    && chmod +x /usr/local/bin/yt-dlp \
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

# ─── frontend-builder ─────────────────────────────────────────────────────────
FROM base AS frontend-builder

WORKDIR /app

COPY .npmrc package*.json ./
RUN npm install

COPY frontend/ ./frontend/
RUN npm run build:react

# ─── production ────────────────────────────────────────────────────────────────
FROM base AS production

ENV NODE_ENV=production

COPY .npmrc package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=frontend-builder /app/public/ ./public/
COPY frontend/public/changelog.json ./frontend/public/changelog.json

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
