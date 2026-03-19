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

# .env anlegen (liegt im gleichen Ordner wie docker-compose.yml)
cp .env.example .env
# → .env öffnen und GROQ_API_KEY eintragen

# App starten (fertiges Image wird automatisch geladen, kein Build nötig)
docker compose up
```

Anschließend: [http://localhost:3000](http://localhost:3000)

---

## Entwicklungsmodus (Hot-Reload)

Quelldateien werden als Volume gemountet — Änderungen in `src/` werden sofort übernommen:

```bash
docker compose --profile dev up
```

> Das Dev-Image wird lokal gebaut (einmalig ~2–3 Minuten). Danach startet es sofort.

---

## Konfiguration

Alle Einstellungen werden über die Datei `.env` im **Projekt-Stammverzeichnis** gesetzt (neben `docker-compose.yml`). Vorlage: `.env.example`

```
rezepti/
├── .env              ← hier
├── .env.example      ← Vorlage zum Kopieren
├── docker-compose.yml
└── ...
```

> **Hinweis:** Dateien die mit `.` beginnen sind versteckt und werden standardmäßig nicht angezeigt.
> - **Windows:** Im Explorer → Ansicht → "Ausgeblendete Elemente" aktivieren
> - **macOS:** Im Finder `Cmd + Shift + .` drücken
> - **Linux:** Im Dateimanager `Strg + H` drücken
> - **Terminal:** `ls -la` zeigt alle Dateien inkl. versteckter

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
