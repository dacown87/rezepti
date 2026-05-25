# Changelog

## [1.0.120] – 2026-05-25



## [1.0.119] – 2026-05-24



## [1.0.118] – 2026-05-24

- remediate nightly strict pipeline

## [1.0.117] – 2026-05-24



## [1.0.116] – 2026-05-24



## [1.0.115] – 2026-05-13



## [1.0.114] – 2026-05-13



## [1.0.113] – 2026-05-13



## [1.0.112] – 2026-05-13



## [1.0.111] – 2026-05-13



## [1.0.110] – 2026-05-13



## [1.0.109] – 2026-05-13



## [1.0.108] – 2026-05-13



## [1.0.107] – 2026-05-13



## [1.0.106] – 2026-05-13



## [1.0.105] – 2026-05-12



## [1.0.104] – 2026-05-12



## [1.0.103] – 2026-05-12



## [1.0.102] – 2026-05-12



## [1.0.101] – 2026-05-12



## [1.0.100] – 2026-05-12



## [1.0.99] – 2026-05-12



## [1.0.98] – 2026-05-04

- pass BYOK through extraction jobs

## [1.0.97] – 2026-04-25

- Bild-Review nach Import + Bild-Button im Edit-Modus

## [1.0.96] – 2026-04-25

- onSkip-Prop in ImagePickerModal auf Rezeptdetailseite

## [1.0.95] – 2026-04-21



## [1.0.94] – 2026-04-21



## [1.0.93] – 2026-04-16



## [1.0.92] – 2026-04-16



## [1.0.91] – 2026-04-16

- Planer: `?weekStart=` → `?week=` + `body.entries` statt Array-Cast; TS-Fehler (doppeltes Attribut) behoben

## [1.0.90] – 2026-04-16

- QR-Scan → direkte Rezept-Navigation (`/recipe/<id>`); Legacy-JSON-Fallback; Planer-QR-Handler aktualisiert

## [1.0.89] – 2026-04-16

- QR-PDF: width 80→400px + errorCorrectionLevel L; Karten-QR 14→18mm



## [1.0.88] – 2026-04-16

### Phase 9 — Quality & Stability (komplett)

- **React Query v5** — `useRecipes`, `useRecipe`, `useUpdateRecipe`, `useDeleteRecipe` Hooks; stale-while-revalidate (5 min staleTime, 24h gcTime)
- **Offline-Modus** — AsyncStorage-Persistenz via `PersistQueryClientProvider`; `OfflineBanner` zeigt Verbindungsstatus
- **CI** — `.github/workflows/ci.yml` mit `postgres:15` service, `drizzle-kit push --force`, Type-Check, Unit- + E2E-Tests
- **user_id Schema** — UUID nullable in recipes/shoppingList/mealPlan/apiKeys; `src/auth.ts` Stub für spätere Supabase-Auth
- **Tests** — 46 neue Unit-Tests: `schema-org.test.ts` (22), `chefkoch.test.ts` (14), `youtube.test.ts` (10); `db-react.test.ts` komplett neu (19 pure + 4 DB-Integration)
- **Bugfix** — `parseGermanPortions` Regex: "für 1 Person" (Singular) wurde nicht erkannt
- **QR-Scanner Autofokus** — Dreistufig: getUserMedia-Constraint + onloadeddata-Timing + direct applyConstraints vor advanced-Fallback

## [1.0.87] – 2026-04-16

- QR-Scanner: BarcodeDetector direkt auf video-Element; Autofokus-Fix

## [1.0.86] – 2026-04-16

- public/ rebuild nach 9d Autofokus-Fix

## [1.0.85] – 2026-04-16

## [1.0.84] – 2026-04-16

## [1.0.83] – 2026-04-16

## [1.0.82] – 2026-04-16

## [1.0.81] – 2026-04-16

## [1.0.80] – 2026-04-16



## [1.0.79] – 2026-04-16

- prepare:false für Supabase Transaction Pooler (pgbouncer)

## [1.0.78] – 2026-04-16

- ssl:require für Supabase-Verbindung in Production

## [1.0.77] – 2026-04-16

- yt-dlp via pip3 statt statischem Binary

## [1.0.76] – 2026-04-16

- curl --fail für yt-dlp Download im Dockerfile

## [1.0.75] – 2026-04-16

- Phase 2 — SQLite durch Supabase (PostgreSQL) ersetzen

## [1.0.74] – 2026-04-15



## [1.0.73] – 2026-04-14

- Success-Screen zeigt "Zum Rezept" statt "Zur Sammlung"
- Bildauswahl — image_url camelCase, imageCount aus AsyncStorage, lokales SQLite-Update
- Bildauswahl-Verbesserungen + Supabase-Entscheidung dokumentiert

## [1.0.72] – 2026-04-12



## [1.0.71] – 2026-04-12



## [1.0.70] – 2026-04-12

- build files after photo-import modal fix

## [1.0.69] – 2026-04-12



## [1.0.68] – 2026-04-12

- scanner opens camera immediately when autoOpen=true
- use uploaded photo as recipe cover when no Chefkoch images found
- ingredient search on web — use API endpoint instead of empty local state
- predefined categories + 3-mode view toggle + fix Alle Rezepte click

## [1.0.67] – 2026-04-11

- photo import + install expo-image-manipulator + rebuild web app

## [1.0.66] – 2026-04-11

- image compression + ingredient fuzzy search + category grid
- QR scanner auto-opens camera via autoOpen param
- chefkoch image search + fuzzy ingredient matching

## [1.0.65] – 2026-04-10

- don't use photo input as recipe image_url on extraction

## [1.0.64] – 2026-04-10



## [1.0.63] – 2026-04-10

- performance fix + QR scanner relocation + web QR scanner

## [1.0.62] – 2026-04-09

- Prio 2–4 — Code-Split, BYOK-DB, Tests, DX-Verbesserungen

## [1.0.61] – 2026-04-09

- Cookidoo ingredient-patching, RN dark-mode header, CLAUDE.md Obsidian-Protokoll
- PDF→Downloads, Planner-Zentrierung, Settings-Verbesserungen, Cache-Fix
- DRY getServerUrl, CORS allowlist, SSRF proxy hardening
- Dockerfile — veraltete frontend/public/changelog.json Zeile entfernt
- EAS workflow nur manuell triggerbar, Expo-Projekt verknüpft
- EAS Build vorbereitet (GitHub Actions + eas.json)
- Planer auf Web via AsyncStorage/localStorage
- Datum bei Quelle im Rezept anzeigen

## [1.0.60] – 2026-04-09

- Facebook-Einstellungen — Cookie-Hinweis klarer formuliert
- Phase 12 TikTok Verbesserung abgeschlossen — alle Features implementiert und getestet
- Phase 13 Pinterest Import abgeschlossen — OG-Extraktion, web-fetcher Delegation, yt-dlp Fallback
- Groq→Ollama Fallback via GROQ_BASE_URL + yt-dlp Health Check Script
- Phase 13 Pinterest Import - Proxy-Fetcher, API Integration, Vision-OCR
- Phase 12 code review fixes + classifier tests
- Phase 12 TikTok - Video OCR integration + unit tests
- Phase 11 Instagram - Complete (Carousel, OCR, Fallback)
- Phase 11 Instagram Verbesserungen (Kern)
- Phase 10 - Zutaten-basierte Rezeptvorschläge

## [1.0.59] – 2026-04-09



## [1.0.58] – 2026-04-09



## [1.0.57] – 2026-04-09

- Expo-Web-Build in public/ wiederhergestellt (JS-Bundles fehlten)

## [1.0.56] – 2026-04-09

- gelöschten image-search Import und Aufruf aus api-react.ts entfernt

## [1.0.55] – 2026-04-09



## [1.0.54] – 2026-04-09



## [1.0.53] – 2026-04-09



## [1.0.52] – 2026-04-09



## [1.0.51] – 2026-04-09

- Cookidoo ingredient-patching, RN dark-mode header, CLAUDE.md Obsidian-Protokoll
- PDF→Downloads, Planner-Zentrierung, Settings-Verbesserungen, Cache-Fix
- DRY getServerUrl, CORS allowlist, SSRF proxy hardening
- Dockerfile — veraltete frontend/public/changelog.json Zeile entfernt
- EAS workflow nur manuell triggerbar, Expo-Projekt verknüpft
- EAS Build vorbereitet (GitHub Actions + eas.json)
- Planer auf Web via AsyncStorage/localStorage
- Datum bei Quelle im Rezept anzeigen

## [1.0.50] – 2026-03-31

- camera video-Element immer im DOM halten, mediaDevices Null-Check

## [1.0.49] – 2026-03-31

- camera getUserMedia facingMode als ideal-Constraint, PlannerPage User-Gesture fix

## [1.0.48] – 2026-03-31

- add Logo.png to public/ and frontend/public/

## [1.0.47] – 2026-03-31

- revert logo from SVG back to Logo.png

## [1.0.46] – 2026-03-31

- Logo, Chefkoch image fixes, PDF redesign, QR scanner fixes

## [1.0.45] – 2026-03-29

- copy vite.config.ts for Docker build

## [1.0.44] – 2026-03-29

- add rollupOptions input to vite config for Docker

## [1.0.43] – 2026-03-29

- resolve conflict
- run vite build from frontend directory

## [1.0.42] – 2026-03-29

- remove paths-ignore from docker workflow
- simplify vite config, remove test section to fix Docker build

## [1.0.40] – 2026-03-29

- build frontend from root with npm run build:react

## [1.0.39] – 2026-03-29

- run frontend build from frontend directory

## [1.0.38] – 2026-03-29

- use correct npm script 'build' instead of 'build:react'

## [1.0.37] – 2026-03-29

- use npm install instead of npm ci in frontend-builder (no lock file)

## [1.0.36] – 2026-03-29

- build frontend in Docker to fix missing JS bundles

## [1.0.35] – 2026-03-29



## [1.0.34] – 2026-03-29



## [1.0.33] – 2026-03-29

- docker-publish workflow auch bei direct push

## [1.0.32] – 2026-03-29

- verbesserte QR-scanner fehlerbehandlung, footer layout, docker build trigger

## [1.0.31] – 2026-03-29

- QR-scanner, PDF-export modal, changelog entfernt

## [1.0.30] – 2026-03-29



## [1.0.29] – 2026-03-29

- integrate QR scanner into ExtractionPage and PlannerPage

## [1.0.28] – 2026-03-28



## [1.0.27] – 2026-03-28

- Phase 13 Pinterest Import - Proxy-Fetcher, API Integration, Vision-OCR
- Phase 12 code review fixes + classifier tests
- Phase 12 TikTok - Video OCR integration + unit tests
- Phase 11 Instagram - Complete (Carousel, OCR, Fallback)
- Phase 11 Instagram Verbesserungen (Kern)
- Phase 10 - Zutaten-basierte Rezeptvorschläge
- Phase 9 - Chefkoch Import-Verbesserung (40% → 100%)

## [1.0.26] – 2026-03-28



## [1.0.25] – 2026-03-27

- update in-app roadmap after Phase 1-5 delivery

## [1.0.24] – 2026-03-27



## [1.0.23] – 2026-03-27

- Phase 5 — meal planner + offline QR code sharing
- Phase 4 — ingredient search + PDF export
- Phase 3c — ingredient dictionary + shopping list

## [1.0.22] – 2026-03-27

- Phase 3c — ingredient dictionary + shopping list with multi-recipe aggregation
- Phase 4 — PDF export with QR code, ingredient-based recipe search
- Phase 5 — meal planner (7-day view), offline QR code sharing with recipe JSON
- fix route ordering for shopping list delete endpoints
- fix Drizzle camelCase→snake_case serializer
- fix race condition in shopping list useEffect
- fix checked shopping items now visible with strikethrough
- fix QR decode array validation
- fix PDF export page overflow in notes section

## [1.0.21] – 2026-03-26

- copy .npmrc into all Dockerfile stages before npm ci

## [1.0.20] – 2026-03-26

- add .npmrc with legacy-peer-deps for vite-plugin-pwa peer dep conflict

## [1.0.19] – 2026-03-26

- Phase 3b — photo import (camera/gallery → AI extraction)
- show star rating in recipe detail header and list/grid views
- Phase 3a — recipe rating (1–5 stars) + personal notes
- cook mode responsive layout — sidebar on desktop, improved drawer on mobile
- Phase 2 — PWA setup + Fullscreen Cook Mode
- Phase 1 — polished core fixes

## [1.0.18] – 2026-03-25

- remove performance-test references and add missing newline

## [1.0.16] – 2026-03-25

- increase serving size stepper buttons from w-4 to w-7

## [1.0.15] – 2026-03-25

- correct created_at storage, date display and footer timezone

## [1.0.14] – 2026-03-25

- correct recipe date display and changelog version numbers

## [1.0.13] – 2026-03-25

- trigger Docker build via workflow_run after changelog completes

## [1.0.12] – 2026-03-25



## [1.0.11] – 2026-03-25

- correct recipe date display (Unix seconds → milliseconds)

## [1.0.10] – 2026-03-25

- add error details panel with copy button on extraction failure
- filter changelog to only user-relevant commits, strip prefixes
- copy frontend/public/changelog.json into Docker production image
- read and write changelog.json from same file (frontend/public/)
- use file mtime as lastUpdated in changelog.json response
- serve changelog.json from frontend/public/ (source of truth)
- serve /changelog.json as static route
- add lastUpdated field to changelog.json and update script
- restore lastUpdated footer and dynamic changelog in Layout
- convert update-changelog.js to ES module syntax

## [1.0.9] – 2026-03-25

- filter changelog to only user-relevant commits, strip prefixes
- copy frontend/public/changelog.json into Docker production image
- read and write changelog.json from same file (frontend/public/)
- use file mtime as lastUpdated in changelog.json response
- serve changelog.json from frontend/public/ (source of truth)
- serve /changelog.json as static route
- add lastUpdated field to changelog.json and update script
- restore lastUpdated footer and dynamic changelog in Layout
- convert update-changelog.js to ES module syntax
- mobile UI improvements + auto-changelog workflow

## [1.0.8] – 2026-03-25

- fix: copy frontend/public/changelog.json into Docker production image
- fix: read and write changelog.json from same file (frontend/public/)
- feat: use file mtime as lastUpdated in changelog.json response
- fix: serve changelog.json from frontend/public/ (source of truth)
- fix: serve /changelog.json as static route
- fix: add lastUpdated field to changelog.json and update script
- fix: restore lastUpdated footer and dynamic changelog in Layout
- fix: convert update-changelog.js to ES module syntax
- chore: npm audit fix – flatted Schwachstelle behoben
- feat: mobile UI improvements + auto-changelog workflow

## [1.0.7] – 2026-03-25

- fix: read and write changelog.json from same file (frontend/public/)
- feat: use file mtime as lastUpdated in changelog.json response
- fix: serve changelog.json from frontend/public/ (source of truth)
- fix: serve /changelog.json as static route
- fix: add lastUpdated field to changelog.json and update script
- fix: restore lastUpdated footer and dynamic changelog in Layout
- fix: convert update-changelog.js to ES module syntax
- chore: npm audit fix – flatted Schwachstelle behoben
- feat: mobile UI improvements + auto-changelog workflow
- docs: clean up and improve README

## [1.0.6] – 2026-03-25

- feat: use file mtime as lastUpdated in changelog.json response
- fix: serve changelog.json from frontend/public/ (source of truth)
- fix: serve /changelog.json as static route
- fix: add lastUpdated field to changelog.json and update script
- fix: restore lastUpdated footer and dynamic changelog in Layout
- fix: convert update-changelog.js to ES module syntax
- chore: npm audit fix – flatted Schwachstelle behoben
- feat: mobile UI improvements + auto-changelog workflow
- docs: clean up and improve README
- docs: add fork comparison table to README

## [1.0.5] – 2026-03-25

- fix: serve changelog.json from frontend/public/ (source of truth)
- fix: serve /changelog.json as static route
- fix: add lastUpdated field to changelog.json and update script
- fix: restore lastUpdated footer and dynamic changelog in Layout
- fix: convert update-changelog.js to ES module syntax
- chore: npm audit fix – flatted Schwachstelle behoben
- feat: mobile UI improvements + auto-changelog workflow
- docs: clean up and improve README
- docs: add fork comparison table to README
- docs: update roadmap and fix lucide-react icons

## [1.0.4] – 2026-03-25

- fix: serve /changelog.json as static route
- fix: add lastUpdated field to changelog.json and update script
- fix: restore lastUpdated footer and dynamic changelog in Layout
- fix: convert update-changelog.js to ES module syntax
- chore: npm audit fix – flatted Schwachstelle behoben
- feat: mobile UI improvements + auto-changelog workflow
- docs: clean up and improve README
- docs: add fork comparison table to README
- docs: update roadmap and fix lucide-react icons
- chore: update package-lock.json

## [1.0.3] – 2026-03-25

- fix: add lastUpdated field to changelog.json and update script
- fix: restore lastUpdated footer and dynamic changelog in Layout
- fix: convert update-changelog.js to ES module syntax
- chore: npm audit fix – flatted Schwachstelle behoben
- feat: mobile UI improvements + auto-changelog workflow
- docs: clean up and improve README
- docs: add fork comparison table to README
- docs: update roadmap and fix lucide-react icons
- chore: update package-lock.json
- chore: complete dependency updates

## [1.0.2] – 2026-03-25

- fix: restore lastUpdated footer and dynamic changelog in Layout
- fix: convert update-changelog.js to ES module syntax
- chore: npm audit fix – flatted Schwachstelle behoben
- feat: mobile UI improvements + auto-changelog workflow
- docs: clean up and improve README
- docs: add fork comparison table to README
- docs: update roadmap and fix lucide-react icons
- chore: update package-lock.json
- chore: complete dependency updates
- chore: update dependencies to latest versions

## [1.0.1] – 2026-03-25

- fix: convert update-changelog.js to ES module syntax
- chore: npm audit fix – flatted Schwachstelle behoben
- feat: mobile UI improvements + auto-changelog workflow
- docs: clean up and improve README
- docs: add fork comparison table to README
- docs: update roadmap and fix lucide-react icons
- chore: update package-lock.json
- chore: complete dependency updates
- chore: update dependencies to latest versions
- fix: include public/index.html in Docker build

## [1.0.0] – 2026-03-25

- Initial release
