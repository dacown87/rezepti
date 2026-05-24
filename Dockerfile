# ─── base ──────────────────────────────────────────────────────────────────────
FROM node:24.15.0-slim AS base

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
FROM node:24.15.0-slim AS web-builder

WORKDIR /app

COPY mobile/package*.json ./mobile/
RUN cd mobile && npm ci

COPY mobile/ ./mobile/
COPY scripts/mobile/expo-export-web.mjs ./scripts/mobile/expo-export-web.mjs
# Wrapper umgeht den bekannten Expo-Export-Post-Hang: timeout + Log-Marker-Check.
# Siehe docs/PROJECT_LEARNINGS.md, Eintrag "expo-export-hangs-postbuild".
RUN cd mobile && CI=1 EXPO_EXPORT_TIMEOUT_SECONDS=300 node ../scripts/mobile/expo-export-web.mjs --output-dir ../public

# ─── production ────────────────────────────────────────────────────────────────
FROM base AS production

ENV NODE_ENV=production

COPY .npmrc package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=web-builder /app/public ./public
# changelog.json ist im Repo manuell gepflegt; Squash-Merges koennen die Datei
# auf main loeschen (siehe docs/PROJECT_LEARNINGS.md "squash-merge-deletes-changelog-json-breaks-docker").
# Bind-Mount + Fallback verhindern, dass der Build dann scheitert. Der
# changelog-update.yml-Workflow legt sie beim naechsten Version-Bump wieder neu an.
RUN --mount=type=bind,source=public,target=/tmp/public-host \
    if [ -f /tmp/public-host/changelog.json ]; then \
      cp /tmp/public-host/changelog.json ./public/changelog.json; \
    else \
      echo '{"version":"0.0.0","entries":[]}' > ./public/changelog.json; \
    fi

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
