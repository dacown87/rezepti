# Rezepti

**Rezepte aus dem Netz — direkt nach Notion.**

Rezepti ist ein selbstgehosteter Webservice, der Rezepte aus URLs extrahiert und als strukturierte Seiten in einer Notion-Datenbank speichert. Einfach einen Link einfügen — von YouTube, Instagram, TikTok oder einer beliebigen Webseite — und Rezepti erledigt den Rest.

## Funktionsweise

```
URL  →  Klassifizierung  →  Inhalte abrufen  →  Rezept extrahieren  →  Notion
```

Rezepti nutzt lokale LLM-Modelle (Ollama) zur Extraktion und Übersetzung. Alle Rezepte werden auf Deutsch ausgegeben.

### Extraktionspfade

| Priorität | Methode | Beschreibung |
|-----------|---------|--------------|
| 1 | **schema.org/Recipe** | JSON-LD-Parsing (schnellster Pfad, nur Web) |
| 2 | **Text → LLM** | Untertitel, Seitentext oder Beschreibung an Ollama |
| 3 | **Audio → Whisper → LLM** | Audiodatei transkribieren, dann extrahieren |
| 4 | **Bild → Vision-LLM** | Bild mit Vision-Modell analysieren (Fallback) |

## Unterstützte Quellen

- **YouTube** — Untertitel, Audio-Transkription oder Thumbnails
- **Instagram** — Reels und Posts
- **TikTok** — Videos
- **Web** — Beliebige Rezept-Webseiten (schema.org bevorzugt)

## Voraussetzungen

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

## Konfiguration

```bash
cp .env.example .env
```

`.env` bearbeiten:

```env
# Notion
NOTION_TOKEN=secret_...
NOTION_DATABASE_ID=           # Leer = wird automatisch erstellt
NOTION_PARENT_PAGE_ID=        # Seite für die Datenbank

# Ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_TEXT_MODEL=llama3.2:3b
OLLAMA_VISION_MODEL=llava:7b

# Server
PORT=3000
```

Ollama-Modelle laden:

```bash
ollama pull llama3.2:3b
ollama pull llava:7b      # optional, für Vision-Fallback
```

## Starten

```bash
# Entwicklung mit Hot Reload
npm run dev

# Produktion
npm start
```

Dann im Browser öffnen: `http://localhost:3000`

## API

### `GET /api/extract?url=<URL>`

Streamt den Fortschritt via Server-Sent Events (SSE).

**Events:** `classifying` → `fetching` → `transcribing` → `extracting` → `exporting` → `done`

```bash
curl -N "http://localhost:3000/api/extract?url=https://example.com/recipe"
```

### `GET /api/health`

Health-Check — prüft Server, Ollama-Verbindung und Notion-Konfiguration.

## Tech-Stack

- **Runtime:** Node.js + TypeScript (ESM)
- **Server:** [Hono](https://hono.dev/)
- **LLM:** [Ollama](https://ollama.com/) (lokal)
- **Transkription:** [whisper-cpp](https://github.com/ggerganov/whisper.cpp)
- **HTML-Parsing:** [cheerio](https://cheerio.js.org/)
- **Validierung:** [Zod](https://zod.dev/)
- **Export:** [Notion API](https://developers.notion.com/)
- **Frontend:** Vanilla JS + [Tailwind CSS](https://tailwindcss.com/) (CDN)

## Lizenz

MIT

---

# English

**Extract recipes from the web — straight to Notion.**

Rezepti is a self-hosted web service that extracts recipes from URLs and saves them as structured pages in a Notion database. Just paste a link — from YouTube, Instagram, TikTok, or any website — and Rezepti does the rest.

## How It Works

```
URL  →  Classify  →  Fetch content  →  Extract recipe  →  Notion
```

Rezepti uses local LLM models (Ollama) for extraction and translation. All recipes are output in German.

### Extraction Paths

| Priority | Method | Description |
|----------|--------|-------------|
| 1 | **schema.org/Recipe** | JSON-LD parsing (fastest path, web only) |
| 2 | **Text → LLM** | Subtitles, page text, or description via Ollama |
| 3 | **Audio → Whisper → LLM** | Transcribe audio, then extract |
| 4 | **Image → Vision LLM** | Analyze image with vision model (fallback) |

## Supported Sources

- **YouTube** — Subtitles, audio transcription, or thumbnails
- **Instagram** — Reels and posts
- **TikTok** — Videos
- **Web** — Any recipe website (schema.org preferred)

## Prerequisites

- [Node.js](https://nodejs.org/) (v20+)
- [Ollama](https://ollama.com/) with at least one text model (e.g. `llama3.2:3b`)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) — for YouTube/Instagram/TikTok
- [ffmpeg](https://ffmpeg.org/) — for audio conversion
- [whisper-cpp](https://github.com/ggerganov/whisper.cpp) — for audio transcription (optional)
- A [Notion integration token](https://developers.notion.com/)

## Installation

```bash
git clone https://github.com/keno303/rezepti.git
cd rezepti
npm install
```

## Configuration

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Notion
NOTION_TOKEN=secret_...
NOTION_DATABASE_ID=           # Empty = auto-created
NOTION_PARENT_PAGE_ID=        # Page for the database

# Ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_TEXT_MODEL=llama3.2:3b
OLLAMA_VISION_MODEL=llava:7b

# Server
PORT=3000
```

Pull Ollama models:

```bash
ollama pull llama3.2:3b
ollama pull llava:7b      # optional, for vision fallback
```

## Start

```bash
# Development with hot reload
npm run dev

# Production
npm start
```

Then open in browser: `http://localhost:3000`

## API

### `GET /api/extract?url=<URL>`

Streams progress via Server-Sent Events (SSE).

**Events:** `classifying` → `fetching` → `transcribing` → `extracting` → `exporting` → `done`

```bash
curl -N "http://localhost:3000/api/extract?url=https://example.com/recipe"
```

### `GET /api/health`

Health check — verifies server, Ollama connection, and Notion configuration.

## Tech Stack

- **Runtime:** Node.js + TypeScript (ESM)
- **Server:** [Hono](https://hono.dev/)
- **LLM:** [Ollama](https://ollama.com/) (local)
- **Transcription:** [whisper-cpp](https://github.com/ggerganov/whisper.cpp)
- **HTML parsing:** [cheerio](https://cheerio.js.org/)
- **Validation:** [Zod](https://zod.dev/)
- **Export:** [Notion API](https://developers.notion.com/)
- **Frontend:** Vanilla JS + [Tailwind CSS](https://tailwindcss.com/) (CDN)

## License

MIT
