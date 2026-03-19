# Docker-Setup Design — Rezepti

**Datum:** 2026-03-19
**Status:** Approved

## Ziel

Rezepti in Docker containerisieren, sodass andere mit `docker compose up` starten können. Der Dev-Modus (Hot-Reload via Volume-Mount) dient als Standard-Workflow während der Entwicklung; der Production-Modus liefert ein schlankes Image zum Teilen.

---

## Architektur

### Dockerfile (Multi-stage)

| Stage | Basis | Zweck |
|-------|-------|-------|
| `base` | `node:20-slim` | Node 20 LTS + yt-dlp (Binary) + Build-Tools für native Addons (better-sqlite3) |
| `builder` | `base` | `npm ci` (alle Deps) + `tsc` → `dist/` |
| `production` | `base` | `npm ci --omit=dev` + `dist/` kopiert → `CMD ["node", "dist/index.js"]` |
| `dev` | `base` | `npm ci` (alle Deps inkl. tsx) → `tsx watch src/index.ts` |

**Hinweis zu better-sqlite3:** Native Node-Addon, muss im Container kompiliert werden. Build-Tools (`python3`, `make`, `g++`) werden im `base`-Stage via `apt-get` installiert und sind in allen Stages verfügbar.

**Hinweis zu yt-dlp:** Direkter Binary-Download (kein pip/Python), sauberer für ein Node.js-Image:
`curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && chmod +x /usr/local/bin/yt-dlp`

**Hinweis zu tsconfig:** `moduleResolution: "bundler"` ist TypeScript-only. Die kompilierten `.js`-Dateien in `dist/` nutzen ESM-Importe mit `.js`-Extensions (Konvention im Projekt), was mit Node.js ESM funktioniert. Voraussetzung: alle Imports in `src/` müssen bereits `.js`-Extensions tragen — das ist im Projekt so umgesetzt.

**Wichtig:** In Production wird `CMD ["node", "dist/index.js"]` direkt aufgerufen, nicht `npm start` (tsx ist devDependency und nach `--omit=dev` nicht vorhanden).

**Wichtig:** `./node_modules` vom Host darf nie als Volume in den Container gemountet werden — `better-sqlite3` ist host-spezifisch kompiliert und inkompatibel mit Linux im Container.

### docker-compose.yml

**Standard** (`docker compose up`):
- Baut Production-Stage
- `env_file: .env`
- Volume: `./data:/app/data` (SQLite-Persistenz; `./data/` existiert nach `git clone` via `.gitkeep`)
- Port: `3000:3000`
- Restart: `unless-stopped`
- Healthcheck: `GET /api/health`

**Dev-Profil** (`docker compose --profile dev up`):
- Baut Dev-Stage
- Gleiche Volumes + `./src:/app/src` (Hot-Reload)
- `tsx watch src/index.ts` als Command
- Port: `3000:3000`

### .dockerignore

Excludiert: `node_modules/`, `dist/`, `data/`, `.env`, `LoginData/`, `*.db`, `*.db-shm`, `*.db-wal`, `.git/`

---

## Dateistruktur (neu)

```
rezepti/
├── Dockerfile
├── docker-compose.yml
├── .dockerignore
├── README.md          ← komplett neu, auf Deutsch
└── CLAUDE.md          ← Docker-Sektion ergänzt
```

---

## Umgebungsvariablen

Werden via `.env`-Datei übergeben (nicht in Image gebacken):

| Variable | Pflicht | Default |
|----------|---------|---------|
| `GROQ_API_KEY` | Ja | — |
| `PORT` | Nein | `3000` |
| `SQLITE_PATH` | Nein | `./data/rezepti.db` |
| `GROQ_TEXT_MODEL` | Nein | `llama-3.3-70b-versatile` |
| `GROQ_VISION_MODEL` | Nein | `meta-llama/llama-4-scout-17b-16e-instruct` |
| `GROQ_WHISPER_MODEL` | Nein | `whisper-large-v3-turbo` |
| `COOKIDOO_EMAIL` | Nein | — |
| `COOKIDOO_PASSWORD` | Nein | — |

---

## Onboarding-Flow für andere Entwickler

```bash
git clone git@github.com:dacown87/rezepti.git
cd rezepti
cp .env.example .env
# GROQ_API_KEY in .env eintragen
docker compose up
# → App läuft auf http://localhost:3000
```

## Dev-Flow (eigene Entwicklung)

```bash
docker compose --profile dev up
# → tsx watch aktiv, Änderungen in ./src werden sofort übernommen
```

---

## Nicht im Scope

- HTTPS / Reverse Proxy (Caddy, nginx) — Nutzer verantwortlich
- Multi-Arch Builds (ARM64/amd64) — wird durch Basis-Image abgedeckt, nicht explizit konfiguriert
- Automatische yt-dlp Updates zur Laufzeit
