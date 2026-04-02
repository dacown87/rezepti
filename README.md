# RecipeDeck

KI-gestützter Rezept-Assistent: URL oder Foto eingeben → strukturiertes Rezept auf Deutsch → kochen, planen, einkaufen.

| | |
|---|---|
| **Frontend** | React Native (Expo) + Web |
| **LLM** | Groq API (Llama 3.3 / Llama 4 / Whisper) |
| **Datenbank** | SQLite (lokal) |
| **Deployment** | Docker + Northflank |

---

## Voraussetzungen

- [Docker](https://docs.docker.com/get-docker/) & Docker Compose
- Kostenloser [Groq API-Key](https://console.groq.com)

## Schnellstart

```bash
git clone git@github.com:dacown87/rezepti.git
cd rezepti

cp .env.example .env
# → .env öffnen und GROQ_API_KEY eintragen

docker compose up
```

Anschließend: [http://localhost:3000](http://localhost:3000)

Änderungen in `src/` sind sofort live — kein Neustart nötig.

---

## Production-Modus

```bash
docker compose --profile prod up
```

**Production-URL:** https://p01--rezepti-app--2s7hvlwm5zc5.code.run

**Deployment:** GitHub Actions → Docker Hub (`dacown/rezepti:latest`) → Northflank (auto-redeploy)

---

## Konfiguration

`.env` anlegen (Vorlage: `.env.example`):

| Variable | Pflicht | Standard | Beschreibung |
|----------|---------|----------|--------------|
| `GROQ_API_KEY` | ✅ | — | Groq API Key (kostenlos: console.groq.com) |
| `PORT` | | `3000` | Server-Port |
| `REACT_SQLITE_PATH` | | `./data/rezepti-react.db` | SQLite-Datenbankpfad |
| `GROQ_TEXT_MODEL` | | `llama-3.3-70b-versatile` | Textmodell für Extraktion |
| `GROQ_VISION_MODEL` | | `meta-llama/llama-4-scout-17b-16e-instruct` | Bildanalyse |
| `GROQ_WHISPER_MODEL` | | `whisper-large-v3-turbo` | Audio-Transkription |
| `COOKIDOO_EMAIL` | | — | Cookidoo-Login (optional) |
| `COOKIDOO_PASSWORD` | | — | Cookidoo-Passwort (optional) |

---

## API

| Route | Methode | Beschreibung |
|-------|---------|--------------|
| `/` | GET | Web-Frontend |
| `/api/v1/recipes` | GET/POST | Rezepte auflisten / erstellen |
| `/api/v1/recipes/:id` | GET/PATCH/DELETE | Einzelnes Rezept |
| `/api/v1/extract/react` | POST | Extraktion starten (Polling) |
| `/api/v1/extract/react/:jobId` | GET/DELETE | Job-Status / abbrechen |
| `/api/v1/shopping` | GET/POST | Einkaufsliste |
| `/api/v1/planner` | GET/POST | Wochenplan |
| `/api/v1/keys` | POST | BYOK API-Key speichern |
| `/api/v1/health` | GET | Server-Status |

---

## Daten

SQLite-DB: `./data/rezepti-react.db` — wird automatisch erstellt. Das `data/`-Verzeichnis ist als Docker-Volume gemountet, Daten bleiben nach `docker compose down` erhalten.

```bash
# Backup
tar -czf backups/recipedeck-$(date +%Y%m%d).tar.gz data/
```

---

## Technologie

- **Frontend:** React Native (Expo) — Web + Android/iOS
- **Server:** Node.js, TypeScript, [Hono](https://hono.dev)
- **KI:** [Groq API](https://console.groq.com) (Llama 3.3 / Llama 4 / Whisper)
- **Datenbank:** SQLite via [Drizzle ORM](https://orm.drizzle.team)
- **Video:** [yt-dlp](https://github.com/yt-dlp/yt-dlp) (im Docker-Image enthalten)
- **BYOK:** Nutzer können eigenen Groq API-Key verwenden

---

## Roadmap

> Stand: April 2026 — **Phasen 1–14 + ReactNative-Migration implementiert**

| Bereich | Status |
|---------|--------|
| Webseiten, YouTube, TikTok, Instagram | ✅ |
| Chefkoch, Cookidoo | ✅ |
| Pinterest, Facebook | ✅ (experimentell) |
| Foto-Import (Kamera/Galerie) | ✅ |
| Rezeptliste, Detailansicht, Inline-Edit | ✅ |
| Kochmodus (Vollbild, Wake Lock) | ✅ |
| Serving-Skalierung | ✅ |
| Einkaufsliste (Multi-Rezept) | ✅ |
| 7-Tage Wochenplan + Drag & Drop | ✅ |
| PDF-Export mit QR-Code | ✅ |
| PWA (Homescreen-Install) | ✅ |
| QR-Scan & Teilen | ✅ |
| Sterne-Rating + Notizen | ✅ |
| React Native / Expo Migration | ✅ (Branch: ReactNative) |
| Android/iOS App (EAS Build) | 🔄 In Arbeit |
| Multi-User / Login | ❌ Geplant |
