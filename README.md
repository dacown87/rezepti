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

- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS
- **Server:** Node.js 20, TypeScript, [Hono](https://hono.dev)
- **KI:** [Groq API](https://console.groq.com) (Llama 3.3 / Llama 4 / Whisper)
- **BYOK:** Bring Your Own Key Support (User können eigenen Groq Key verwenden)
- **Datenbank:** SQLite via [Drizzle ORM](https://orm.drizzle.team)
- **Video:** [yt-dlp](https://github.com/yt-dlp/yt-dlp) (im Docker-Image enthalten)
- **Mobile Ready:** Platform-Abstraktion für spätere Android/iOS Apps

---

## Roadmap

> Stand: März 2026 — Fortschritt basiert auf aktuellem Implementierungsstand

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
| Webseite neu gestalten mit Menüleiste | ░░░░░░░░░░ 0% | Nicht implementiert |
| Rezeptliste & Detailansicht | █████░░░░░ 50% | Grundstruktur vorhanden |
| Zutaten & Zubereitung getrennt anzeigen (à la Dr. Oetker) | ██░░░░░░░░ 20% | Daten liegen getrennt vor, UI nicht |
| Personenzahl einstellbar + Hochskalierung | ░░░░░░░░░░ 0% | Nicht implementiert |
| Zutat als Fixgröße → Rest hochskalieren | ░░░░░░░░░░ 0% | Nicht implementiert |

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
| Mobile-First-Ansatz | ░░░░░░░░░░ 0% | Zuerst für Mobilgeräte optimieren, dann Desktop |
| Media Queries für typische Bildschirmgrößen | ░░░░░░░░░░ 0% | Responsive Breakpoints für Handys, Tablets, Desktops |
| Android App (Flutter) | ░░░░░░░░░░ 0% | Nicht implementiert — ggf. Framework-Wechsel nötig |

---

### 🍽️ Rezeptanzeige & Navigation (Aktualisiert)

| Feature | Fortschritt | Status |
|---------|-------------|--------|
| Webseite neu gestalten mit Menüleiste | ░░░░░░░░░░ 0% | Nicht implementiert |
| Rezeptliste & Detailansicht | █████░░░░░ 50% | Grundstruktur vorhanden |
| Zutaten & Zubereitung getrennt anzeigen (à la Dr. Oetker) | ██░░░░░░░░ 20% | Daten liegen getrennt vor, UI nicht |
| Personenzahl einstellbar + Hochskalierung | ░░░░░░░░░░ 0% | Nicht implementiert |
| Zutat als Fixgröße → Rest hochskalieren | ░░░░░░░░░░ 0% | Nicht implementiert |
| **Fullscreen Cook Mode** | ░░░░░░░░░░ 0% | Vollbild-Ansicht für Schritt-für-Schritt-Kochen |
| **Original-Rezept-Link** | ░░░░░░░░░░ 0% | Link zur Quell-Webseite in Rezeptansicht |
| **Rezept als separate Seite (kein Modal)** | ░░░░░░░░░░ 0% | Dedizierte Rezeptseite statt Modal |

---

### Gesamtfortschritt: ~25%

```
Import/Extraktion     ████████░░░░░░░░░░░░ 55%
Rezeptanzeige         ████░░░░░░░░░░░░░░░░ 35%
Einkauf & Planung     ░░░░░░░░░░░░░░░░░░░░  0%
Community & Sozial    ░░░░░░░░░░░░░░░░░░░░  0%
Export & Druck        ░░░░░░░░░░░░░░░░░░░░  0%
Mobile (Flutter)      ░░░░░░░░░░░░░░░░░░░░  0%
```
