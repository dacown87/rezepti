# RecipeDeck

Rezepte aus URLs extrahieren — YouTube, Instagram, TikTok, Webseiten, Cookidoo — ins Deutsche übersetzen, speichern und verwalten.

**Production:** https://p01--rezepti-app--2s7hvlwm5zc5.code.run

---

## Features

- **Extraktion** aus YouTube, Instagram, TikTok, Webseiten, Cookidoo, Foto-Import
- **KI-Analyse** via Groq (Llama 3.3 / Llama 4 / Whisper) — Text, Audio, Bild
- **Rezeptverwaltung** — Inline-Bearbeitung, Bewertung, Notizen, Tags, Kategorien
- **Kochmodus** — Vollbild, Wake Lock, Portionsscaler
- **Meal Planner** — 7-Tage-Plan mit Drag & Drop
- **Einkaufsliste** — Multi-Rezept-Aggregation, Abhaken, Export
- **PDF-Export** — Rezeptkarte mit QR-Code
- **BYOK** — Bring Your Own Groq Key
- **PWA** — Homescreen-Installation auf iOS/Android

---

## Voraussetzungen

- [Docker](https://docs.docker.com/get-docker/) & Docker Compose
- Kostenloser [Groq API-Key](https://console.groq.com)
- [Supabase](https://supabase.com) Projekt (kostenloser Free-Tier reicht)

---

## Schnellstart

```bash
git clone git@github.com:dacown87/rezepti.git
cd rezepti

cp .env.example .env
# .env öffnen und ausfüllen:
#   GROQ_API_KEY=...
#   DATABASE_URL=postgresql://postgres.[ref]:[pw]@aws-0-[region].pooler.supabase.com:6543/postgres
```

### Dev-Modus (Hot Reload)

```bash
docker compose up
```

→ [http://localhost:3000](http://localhost:3000)

Änderungen in `src/` und `public/` sind sofort sichtbar.

### Production-Modus (Docker Hub Image)

```bash
docker compose --profile prod up
```

---

## Konfiguration (`.env`)

| Variable | Pflicht | Beschreibung |
|----------|---------|--------------|
| `GROQ_API_KEY` | ✅ | Groq API-Key ([console.groq.com](https://console.groq.com)) |
| `DATABASE_URL` | ✅ | Supabase PostgreSQL — **Transaction Pooler URL** (Port 6543) |
| `SUPABASE_URL` | | Supabase Projekt-URL (für zukünftige Auth-Features) |
| `SUPABASE_ANON_KEY` | | Supabase Anon Key |
| `PORT` | | Server-Port (Standard: `3000`) |
| `GROQ_TEXT_MODEL` | | Standard: `llama-3.3-70b-versatile` |
| `GROQ_VISION_MODEL` | | Standard: `meta-llama/llama-4-scout-17b-16e-instruct` |
| `GROQ_WHISPER_MODEL` | | Standard: `whisper-large-v3-turbo` |
| `COOKIDOO_EMAIL` | | Thermomix-Login (optional) |
| `COOKIDOO_PASSWORD` | | Thermomix-Passwort (optional) |

> **DATABASE_URL:** Die direkte Supabase-URL (`db.[ref].supabase.co:5432`) funktioniert nur lokal.
> Für Production immer den Transaction Pooler verwenden.
> URL im Supabase Dashboard: Settings → Database → Connection pooling.

---

## Datenbankschema deployen

Beim ersten Start das Schema in Supabase anlegen:

```bash
npx drizzle-kit push
```

---

## API-Endpunkte

| Route | Methode | Beschreibung |
|-------|---------|--------------|
| `/` | GET | Web-App |
| `/api/v1/recipes` | GET/POST | Rezepte auflisten / erstellen |
| `/api/v1/recipes/:id` | GET/PATCH/DELETE | Einzelnes Rezept |
| `/api/v1/extract/react` | POST | Extraktion starten (Polling) |
| `/api/v1/extract/react/:jobId` | GET/DELETE | Job-Status / abbrechen |
| `/api/v1/keys/validate` | POST | BYOK Key validieren |
| `/api/v1/keys` | POST | BYOK Key speichern |
| `/api/v1/keys/:keyHash` | DELETE | BYOK Key löschen |
| `/api/v1/health` | GET | Server + DB Status |
| `/api/v1/planner` | GET/POST/DELETE | Meal Planner |
| `/api/v1/shopping` | GET/POST/DELETE | Einkaufsliste |

---

## Tech Stack

| Bereich | Technologie |
|---------|-------------|
| Backend | [Hono.js](https://hono.dev) + TypeScript |
| Datenbank | [Supabase](https://supabase.com) PostgreSQL + [Drizzle ORM](https://orm.drizzle.team) |
| Frontend | [Expo](https://expo.dev) (React Native Web) + TypeScript + Tailwind CSS |
| KI | [Groq API](https://console.groq.com) — Llama 3.3 / Llama 4 Scout / Whisper |
| Video | [yt-dlp](https://github.com/yt-dlp/yt-dlp) (via pip3 im Docker-Image) |
| Deployment | Docker → [Northflank](https://northflank.com) |
| CI/CD | GitHub Actions → Docker Hub (`dacown/rezepti:latest`) |

---

## Deployment

```
git push → main
  → GitHub Actions: Changelog + Version bump
  → Docker Hub: dacown/rezepti:latest
  → Northflank: auto-redeploy
```

---

## Roadmap

| Phase | Feature | Status |
|-------|---------|--------|
| 1–14 | Core, Cook Mode, Foto, PDF, Planner, Cookidoo, etc. | ✅ |
| 15 | React Native / Expo Web Migration | ✅ |
| SB-1 | Mobile: expo-sqlite entfernt → Server-API | ✅ |
| SB-2 | Server: SQLite → Supabase PostgreSQL | ✅ |
| — | Multi-User Login (Supabase Auth) | 🔜 |
| — | Rezept-Sharing via Link | 🔜 |
