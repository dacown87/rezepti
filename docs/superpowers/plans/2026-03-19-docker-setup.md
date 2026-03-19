# Docker-Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rezepti in Docker containerisieren — `docker compose up` startet Production, `docker compose --profile dev up` startet Hot-Reload-Dev-Modus.

**Architecture:** Multi-stage Dockerfile (base → builder → production + dev). Production kompiliert TypeScript via `tsc` und startet mit `node dist/index.js`. Dev-Stage mountet `./src` als Volume und nutzt `tsx watch`. SQLite-Daten persistieren via `./data` Volume.

**Tech Stack:** Docker 24+, Node 20 slim, yt-dlp (Binary), better-sqlite3 (native Addon, braucht Build-Tools im Container)

**Spec:** `docs/superpowers/specs/2026-03-19-docker-setup-design.md`

---

## Dateiübersicht

| Datei | Aktion | Verantwortung |
|-------|--------|---------------|
| `Dockerfile` | Erstellen | Multi-stage: base, builder, production, dev |
| `docker-compose.yml` | Erstellen | Production-Default + Dev-Profil |
| `.dockerignore` | Erstellen | Build-Context sauberhalten |
| `README.md` | Ersetzen | Vollständige Setup-Anleitung auf Deutsch |
| `CLAUDE.md` | Ändern | Docker-Sektion ergänzen |

---

### Task 1: `drizzle-kit` in devDependencies verschieben

**Files:**
- Modify: `package.json`

`drizzle-kit` ist ein CLI-Tool für Schema-Migrationen und hat keine Laufzeit-Rolle. Es ist fälschlicherweise in `dependencies` statt `devDependencies` — das bläht das Production-Image unnötig auf.

- [ ] **Schritt 1: drizzle-kit von dependencies nach devDependencies verschieben**

In `package.json` den Eintrag `"drizzle-kit": "^0.28.0"` aus `"dependencies"` entfernen und unter `"devDependencies"` einfügen.

- [ ] **Schritt 2: Prüfen**

```bash
node -e "const p = JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('deps:', Object.keys(p.dependencies)); console.log('devDeps:', Object.keys(p.devDependencies));"
```

Erwartet: `drizzle-kit` erscheint unter devDependencies, nicht mehr unter dependencies.

---

### Task 2: .dockerignore erstellen

**Files:**
- Create: `.dockerignore`

- [ ] **Schritt 1: .dockerignore anlegen**

```
node_modules/
dist/
data/
.env
LoginData/
*.db
*.db-shm
*.db-wal
.git/
docs/
public/v*.html
```

- [ ] **Schritt 2: Prüfen, dass nichts Sensitives fehlt**

```bash
cat .dockerignore
```

Erwartet: obige Liste vollständig vorhanden.

---

### Task 2: Dockerfile — base + builder Stage

**Files:**
- Create: `Dockerfile`

- [ ] **Schritt 1: Dockerfile mit `base` und `builder` Stage anlegen**

```dockerfile
# ─── base ──────────────────────────────────────────────────────────────────────
FROM node:20-slim AS base

WORKDIR /app

# Build-Tools für better-sqlite3 (natives Node-Addon)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# yt-dlp als statisches Binary (kein Python nötig)
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
    -o /usr/local/bin/yt-dlp \
    && chmod +x /usr/local/bin/yt-dlp

# ─── builder ───────────────────────────────────────────────────────────────────
FROM base AS builder

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
# Alle Imports in src/ müssen .js-Extensions tragen (ESM-Konvention im Projekt).
# Falls tsc hier scheitert, zuerst 'npx tsc --noEmit' lokal prüfen.
RUN npx tsc
```

- [ ] **Schritt 2: Build-Stage testen**

```bash
docker build --target builder -t rezepti-builder-test .
```

Erwartet: Build endet ohne Fehler. `tsc` darf keine Fehler ausgeben.

Falls `tsc` Fehler zeigt: TypeScript-Fehler in `src/` beheben (wahrscheinlich keine, da `dist/` bereits existiert).

---

### Task 3: Dockerfile — production Stage

**Files:**
- Modify: `Dockerfile`

- [ ] **Schritt 1: Production-Stage anhängen**

```dockerfile
# ─── production ────────────────────────────────────────────────────────────────
FROM base AS production

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
# Nur public/index.html wird kopiert — public/v*.html ist via .dockerignore ausgeschlossen
COPY public/ ./public/

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "dist/index.js"]
```

- [ ] **Schritt 2: Production-Image bauen**

```bash
docker build --target production -t rezepti-prod-test .
```

Erwartet: Build erfolgreich, Image ~300–500 MB.

- [ ] **Schritt 3: Production-Container kurz starten und Health-Check prüfen**

```bash
docker run --rm -e GROQ_API_KEY=test -p 3000:3000 rezepti-prod-test &
sleep 5
curl -s http://localhost:3000/api/health
docker stop $(docker ps -q --filter ancestor=rezepti-prod-test)
```

Erwartet: JSON-Antwort vom Health-Endpoint (auch wenn API-Key ungültig ist, antwortet der Server).

---

### Task 4: Dockerfile — dev Stage

**Files:**
- Modify: `Dockerfile`

- [ ] **Schritt 1: Dev-Stage anhängen**

```dockerfile
# ─── dev ───────────────────────────────────────────────────────────────────────
FROM base AS dev

ENV NODE_ENV=development

COPY package*.json ./
RUN npm ci

EXPOSE 3000

CMD ["npx", "tsx", "watch", "src/index.ts"]
```

- [ ] **Schritt 2: Dev-Image bauen**

```bash
docker build --target dev -t rezepti-dev-test .
```

Erwartet: Build erfolgreich.

---

### Task 5: docker-compose.yml erstellen

**Files:**
- Create: `docker-compose.yml`

- [ ] **Schritt 1: docker-compose.yml anlegen**

```yaml
services:
  rezepti:
    build:
      context: .
      target: production
    env_file: .env
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    restart: unless-stopped

  rezepti-dev:
    build:
      context: .
      target: dev
    env_file: .env
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
      - ./src:/app/src
    profiles:
      - dev
```

- [ ] **Schritt 2: Production-Compose testen**

```bash
docker compose up --build -d
sleep 8
curl -s http://localhost:3000/api/health
docker compose down
```

Erwartet: Health-Endpoint antwortet, Container läuft stabil.

- [ ] **Schritt 3: Dev-Compose testen**

```bash
docker compose --profile dev up --build -d rezepti-dev
sleep 8
curl -s http://localhost:3000/api/health
docker compose --profile dev down
```

Erwartet: Health-Endpoint antwortet, tsx watch läuft.

---

### Task 6: README.md neu schreiben (Deutsch)

**Files:**
- Modify: `README.md`

- [ ] **Schritt 1: README.md ersetzen**

```markdown
# Rezepti

Rezepti extrahiert Rezepte aus URLs — YouTube, Instagram, TikTok, Webseiten — übersetzt sie ins Deutsche, normalisiert Einheiten und speichert sie in einer lokalen SQLite-Datenbank.

---

## Voraussetzungen

- [Docker](https://docs.docker.com/get-docker/) & Docker Compose
- Kostenloser [Groq API-Key](https://console.groq.com)

## Schnellstart

```bash
git clone git@github.com:dacown87/rezepti.git
cd rezepti

# .env anlegen und API-Key eintragen
cp .env.example .env
# → GROQ_API_KEY in .env setzen

# App starten
docker compose up
```

Anschließend: [http://localhost:3000](http://localhost:3000)

---

## Entwicklungsmodus (Hot-Reload)

Quelldateien werden als Volume gemountet — Änderungen in `src/` werden sofort übernommen:

```bash
docker compose --profile dev up
```

---

## Konfiguration

Alle Einstellungen werden über `.env` gesetzt (Vorlage: `.env.example`):

| Variable | Pflicht | Standard | Beschreibung |
|----------|---------|----------|--------------|
| `GROQ_API_KEY` | ✅ | — | Groq API-Key (kostenlos unter console.groq.com) |
| `PORT` | | `3000` | Server-Port |
| `SQLITE_PATH` | | `./data/rezepti.db` | Pfad zur SQLite-Datenbank |
| `GROQ_TEXT_MODEL` | | `llama-3.3-70b-versatile` | Textmodell für Extraktion |
| `GROQ_VISION_MODEL` | | `meta-llama/llama-4-scout-17b-16e-instruct` | Bildanalyse-Modell |
| `GROQ_WHISPER_MODEL` | | `whisper-large-v3-turbo` | Audio-Transkription |
| `COOKIDOO_EMAIL` | | — | Cookidoo-Login (optional) |
| `COOKIDOO_PASSWORD` | | — | Cookidoo-Passwort (optional) |

---

## API

| Route | Methode | Beschreibung |
|-------|---------|--------------|
| `/` | GET | Web-Oberfläche |
| `/api/extract?url=<URL>` | GET | Rezept extrahieren (SSE-Stream) |
| `/api/recipes` | GET | Alle gespeicherten Rezepte |
| `/api/recipes/:id` | GET | Einzelnes Rezept |
| `/api/health` | GET | Server-Status |

---

## Daten

Die SQLite-Datenbank liegt in `./data/rezepti.db` und wird automatisch erstellt. Das Verzeichnis ist als Docker-Volume gemountet — Daten bleiben auch nach `docker compose down` erhalten.

---

## Technologie

- **Server:** Node.js 20, TypeScript, [Hono](https://hono.dev)
- **KI:** [Groq API](https://console.groq.com) (Llama 3.3 / Llama 4 / Whisper)
- **Datenbank:** SQLite via [Drizzle ORM](https://orm.drizzle.team)
- **Video:** [yt-dlp](https://github.com/yt-dlp/yt-dlp) (im Docker-Image enthalten)
```

- [ ] **Schritt 2: Prüfen**

```bash
cat README.md
```

Erwartet: Vollständige README auf Deutsch, alle Abschnitte vorhanden.

---

### Task 7: CLAUDE.md — Docker-Sektion ergänzen

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Schritt 1: Docker-Sektion nach dem `## Commands`-Block einfügen**

Nach dem bestehenden `## Commands`-Block folgendes einfügen:

```markdown
## Docker

- `docker compose up` — Production-Container starten (kompiliertes JS, schlankes Image)
- `docker compose up --build` — Neu bauen und starten (nach Code-Änderungen)
- `docker compose --profile dev up` — Dev-Modus mit Hot-Reload (tsx watch, src/ als Volume)
- `docker compose down` — Container stoppen

**Stages:** `base` (Node + yt-dlp + Build-Tools) → `builder` (tsc) → `production` (node dist/index.js) + `dev` (tsx watch)

**Volumes:**
- `./data:/app/data` — SQLite-Persistenz (beide Modi)
- `./src:/app/src` — Hot-Reload (nur Dev-Modus)

**Wichtig:** `./node_modules` nie als Volume mounten — `better-sqlite3` ist host-spezifisch kompiliert.
```

- [ ] **Schritt 2: Prüfen**

```bash
grep -A 20 "## Docker" CLAUDE.md
```

Erwartet: Docker-Sektion vollständig vorhanden.

---

### Task 8: Commit

**Files:** Alle neuen/geänderten Dateien

- [ ] **Schritt 1: Status prüfen**

```bash
git status
```

- [ ] **Schritt 2: Dateien stagen und committen**

```bash
git add Dockerfile docker-compose.yml .dockerignore README.md CLAUDE.md docs/ package.json .env.example
git commit -m "feat: add Docker setup with multi-stage build and compose profiles"
```

Erwartet: Commit auf Branch `ph/Test` (nie auf `main`).
