# Rezepti

> **Dieser Fork** — Fork von [keno303/rezepti](https://github.com/keno303/rezepti)

| | Original (keno303) | **Dieser Fork (dacown87)** |
|---|---|---|
| **Frontend** | Vanilla JS + Tailwind (CDN) | **React + Vite + TypeScript** |
| **LLM** | Ollama (lokal) | **Groq API** (Cloud) |
| **Export** | Notion | **SQLite (lokal)** |
| **Deployment** | Manuell | **Docker** |
| **Features** | Basic | **BYOK, React UI, Polling API** |

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

# React Frontend + Server starten
docker compose up --profile react
```

> Beim ersten Start wird das Image lokal gebaut (~2–3 Minuten). Danach startet es sofort.

Anschließend: [http://localhost:3000](http://localhost:3000)

Änderungen in `src/` oder `frontend/` sind sofort im Browser sichtbar — kein Neustart nötig.

---

## Production-Modus

Fertiges Image von Docker Hub, kein lokaler Build:

```bash
docker compose --profile prod up
```

---

## Docker Deployment

**Verfügbare Profile:**

| Profile | Beschreibung |
|---------|--------------|
| `react` | React Dev + Backend mit Hot Reload |
| `react-prod` | React Production Build |
| `prod` | Legacy Production (Docker Hub Image) |

**Nützliche Befehle:**
```bash
# Logs anzeigen
docker compose --profile react logs -f

# Container neu starten
docker compose --profile react restart

# Alle stoppen
docker compose --profile react --profile react-prod --profile prod down

# Volle Dokumentation → Siehe DOCKER_DEPLOYMENT.md
```

### Daten sichern

```bash
# Backup erstellen
mkdir -p backups
tar -czf backups/rezepti-$(date +%Y%m%d).tar.gz data/

# Wiederherstellen
tar -xzf backups/rezepti-20260322.tar.gz
```

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
| `GROQ_API_KEY` | ✅ | — | **Default Groq Key** (kostenlos unter console.groq.com) |
| `REACT_SQLITE_PATH` | | `./data/rezepti-react.db` | Neue DB für React Frontend |
| `PORT` | | `3000` | Server-Port |
| `SQLITE_PATH` | | `./data/rezepti.db` | Legacy DB (für alte UI) |
| `GROQ_TEXT_MODEL` | | `llama-3.3-70b-versatile` | Textmodell für Extraktion |
| `GROQ_VISION_MODEL` | | `meta-llama/llama-4-scout-17b-16e-instruct` | Bildanalyse-Modell |
| `GROQ_WHISPER_MODEL` | | `whisper-large-v3-turbo` | Audio-Transkription |
| `COOKIDOO_EMAIL` | | — | Cookidoo-Login (optional) |
| `COOKIDOO_PASSWORD` | | — | Cookidoo-Passwort (optional) |

---

## API

| Route | Methode | Beschreibung |
|-------|---------|--------------|
| `/` | GET | **React Frontend** (mit BYOK Support) |
| `/api/extract?url=<URL>` | GET | Legacy: Rezept extrahieren (SSE-Stream) |
| `/api/v1/extract/react?url=<URL>` | GET | **React:** Rezept extrahieren (Polling) |
| `/api/recipes` | GET | Alle gespeicherten Rezepte |
| `/api/v1/recipes` | GET | **React:** Rezepte aus neuer DB |
| `/api/recipes/:id` | GET | Einzelnes Rezept (Legacy DB) |
| `/api/v1/recipes/:id` | GET | **React:** Rezept aus neuer DB |
| `/api/v1/keys` | POST/DELETE | **BYOK:** User Key Management |
| `/api/health` | GET | Server-Status |

---

## Daten

- **React DB:** `./data/rezepti-react.db` - Neue SQLite DB für React Frontend
- **Legacy DB:** `./data/rezepti.db` - Alte DB (kompatibilität)

Datenbanken werden automatisch erstellt. Das `data/` Verzeichnis ist als Docker-Volume gemountet — Daten bleiben auch nach `docker compose down` erhalten.

---

## Technologie

- **Frontend:** React 19 + Vite 8 + TypeScript 6 + Tailwind CSS
- **Server:** Node.js 22, TypeScript, [Hono](https://hono.dev)
- **KI:** [Groq API](https://console.groq.com) (Llama 3.3 / Llama 4 / Whisper)
- **BYOK:** Bring Your Own Key Support (User können eigenen Groq Key verwenden)
- **Datenbank:** SQLite via [Drizzle ORM](https://orm.drizzle.team)
- **Video:** [yt-dlp](https://github.com/yt-dlp/yt-dlp) (im Docker-Image enthalten)
- **Mobile Ready:** Platform-Abstraktion für spätere Android/iOS Apps

---

## Roadmap

> Stand: März 2026 — **Dependencies aktualisiert** ✅ | React 19, Vite 8, TypeScript 6

---

### 📥 Import & Extraktion

| Feature | Fortschritt | Status |
|---------|-------------|--------|
| Webseiten (allgemein) | ████████░░ 80% | Funktioniert, kleinere Lücken |
| YouTube | ████████░░ 80% | Audio + Untertitel + Vision |
| TikTok | ███████░░░ 70% | Via yt-dlp |
| Instagram | ███████░░░ 70% | Via yt-dlp |
| Chefkoch | ████░░░░░░ 40% | Schema.org greift teilweise |
| Cookidoo | █░░░░░░░░░ 10% | Zugangsdaten vorbereitet, kein Scraper |
| Pinterest | ░░░░░░░░░░ 0% | Nicht implementiert |
| Facebook | ░░░░░░░░░░ 0% | Nicht implementiert |
| Foto-Import (Kamera/Galerie) | ░░░░░░░░░░ 0% | Vision-Modell vorhanden, kein Upload-Flow |

---

### 🍽️ Rezeptanzeige & Navigation

| Feature | Fortschritt | Status |
|---------|-------------|--------|
| Webseite neu gestalten mit Menüleiste | ███░░░░░░░ 30% | In Entwicklung |
| Rezeptliste & Detailansicht | ███████░░░ 70% | Verbessert |
| Zutaten & Zubereitung getrennt anzeigen (à la Dr. Oetker) | ███████░░░ 70% | UI vorhanden |
| Personenzahl einstellbar + Hochskalierung | ███░░░░░░░ 30% | In Entwicklung |
| Zutat als Fixgröße → Rest hochskalieren | ██░░░░░░░░ 20% | In Entwicklung |

---

### 🛒 Einkauf & Planung

| Feature | Fortschritt | Status |
|---------|-------------|--------|
| Einkaufsliste | ░░░░░░░░░░ 0% | Nicht implementiert |
| Zutaten eingeben → Rezeptvorschläge | ░░░░░░░░░░ 0% | Nicht implementiert |

---

### 👥 Community & Sozial

| Feature | Fortschritt | Status |
|---------|-------------|--------|
| Benutzer-Login (inkl. „Angemeldet bleiben") | ░░░░░░░░░░ 0% | Nicht implementiert |
| Bewertungsfunktion (Sterne) | ░░░░░░░░░░ 0% | Nicht implementiert |
| Kommentarfunktion | ░░░░░░░░░░ 0% | Nicht implementiert |
| Rezepte teilen via QR-Code | ░░░░░░░░░░ 0% | Nicht implementiert |

---

### 🖨️ Export & Druck

| Feature | Fortschritt | Status |
|---------|-------------|--------|
| Rezeptkarte als PDF (Bild + Kurzbeschreibung + QR-Code) | ░░░░░░░░░░ 0% | Nicht implementiert |

---

### 📱 Mobile

| Feature | Fortschritt | Status |
|---------|-------------|--------|
| Mobile-First / Responsive | ███████░░░ 80% | ✅ Implementiert |
| Android App | ░░░░░░░░░░ 0% | Nicht implementiert |

---

### Gesamtfortschritt: ~35%

```
Import/Extraktion     ████████░░░░░░░░░░░░ 55%
Rezeptanzeige         ███████░░░░░░░░░░░░░ 45%
Einkauf & Planung     ░░░░░░░░░░░░░░░░░░░░  0%
Community & Sozial    ░░░░░░░░░░░░░░░░░░░░  0%
Export & Druck        ░░░░░░░░░░░░░░░░░░░░  0%
```
