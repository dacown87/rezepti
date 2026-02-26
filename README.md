# Rezepti

**Rezepte aus dem Netz — direkt nach Notion.**

Rezepti ist ein selbstgehosteter Webservice, der Rezepte aus URLs extrahiert und als strukturierte Seiten in einer Notion-Datenbank speichert. Einfach einen Link einfügen — von YouTube, Instagram, TikTok oder einer beliebigen Webseite — und Rezepti erledigt den Rest.

---

**Extract recipes from the web — straight to Notion.**

Rezepti is a self-hosted web service that extracts recipes from URLs and saves them as structured pages in a Notion database. Just paste a link — from YouTube, Instagram, TikTok, or any website — and Rezepti does the rest.

---

## Funktionsweise / How It Works

```
URL  →  Klassifizierung  →  Inhalte abrufen  →  Rezept extrahieren  →  Notion
         (classify)          (fetch)              (extract)              (export)
```

Rezepti nutzt lokale LLM-Modelle (Ollama) zur Extraktion und Übersetzung. Alle Rezepte werden auf Deutsch ausgegeben.

Rezepti uses local LLM models (Ollama) for extraction and translation. All recipes are output in German.

### Extraktionspfade / Extraction Paths

| Priorität | Methode | Beschreibung |
|-----------|---------|--------------|
| 1 | **schema.org/Recipe** | JSON-LD-Parsing (schnellster Pfad, nur Web) |
| 2 | **Text → LLM** | Untertitel, Seitentext oder Beschreibung an Ollama |
| 3 | **Audio → Whisper → LLM** | Audiodatei transkribieren, dann extrahieren |
| 4 | **Bild → Vision-LLM** | Bild mit Vision-Modell analysieren (Fallback) |

## Unterstützte Quellen / Supported Sources

- **YouTube** — Untertitel, Audio-Transkription oder Thumbnails
- **Instagram** — Reels und Posts
- **TikTok** — Videos
- **Web** — Beliebige Rezept-Webseiten (schema.org bevorzugt)

## Voraussetzungen / Prerequisites

- [Node.js](https://nodejs.org/) (v20+)
- [Ollama](https://ollama.com/) mit mindestens einem Textmodell (z.B. `llama3.2:3b`)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) — für YouTube/Instagram/TikTok
- [ffmpeg](https://ffmpeg.org/) — für Audiokonvertierung
- [whisper-cpp](https://github.com/ggerganov/whisper.cpp) — für Audio-Transkription (optional)
- Ein [Notion-Integration-Token](https://developers.notion.com/)

## Installation

```bash
git clone https://github.com/keno303/rezepti.git
cd rezepti
npm install
```

## Konfiguration / Configuration

```bash
cp .env.example .env
```

`.env` bearbeiten / edit `.env`:

```env
# Notion
NOTION_TOKEN=secret_...
NOTION_DATABASE_ID=           # Leer = wird automatisch erstellt / Empty = auto-created
NOTION_PARENT_PAGE_ID=        # Seite für die Datenbank / Page for the database

# Ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_TEXT_MODEL=llama3.2:3b
OLLAMA_VISION_MODEL=llava:7b

# Server
PORT=3000
```

Ollama-Modelle laden / Pull Ollama models:

```bash
ollama pull llama3.2:3b
ollama pull llava:7b      # optional, für Vision-Fallback / for vision fallback
```

## Starten / Start

```bash
# Entwicklung mit Hot Reload / Development with hot reload
npm run dev

# Produktion / Production
npm start
```

Dann im Browser öffnen / Then open in browser: `http://localhost:3000`

## API

### `GET /api/extract?url=<URL>`

Streamt den Fortschritt via Server-Sent Events (SSE).

Streams progress via Server-Sent Events (SSE).

**Events:** `classifying` → `fetching` → `transcribing` → `extracting` → `exporting` → `done`

```bash
curl -N "http://localhost:3000/api/extract?url=https://example.com/recipe"
```

### `GET /api/health`

Health-Check — prüft Server, Ollama-Verbindung und Notion-Konfiguration.

Health check — verifies server, Ollama connection, and Notion configuration.

## Tech-Stack

- **Runtime:** Node.js + TypeScript (ESM)
- **Server:** [Hono](https://hono.dev/)
- **LLM:** [Ollama](https://ollama.com/) (lokal / local)
- **Transkription:** [whisper-cpp](https://github.com/ggerganov/whisper.cpp)
- **HTML-Parsing:** [cheerio](https://cheerio.js.org/)
- **Validierung:** [Zod](https://zod.dev/)
- **Export:** [Notion API](https://developers.notion.com/)
- **Frontend:** Vanilla JS + [Tailwind CSS](https://tailwindcss.com/) (CDN)

## Lizenz / License

MIT
