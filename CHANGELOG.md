# Changelog

## [1.0.214] – 2026-08-09



## [1.0.213] – 2026-08-09



## [1.0.212] – 2026-08-09



## [1.0.211] – 2026-08-09



## [1.0.210] – 2026-08-09



## [1.0.209] – 2026-08-09



## [1.0.208] – 2026-08-09



## [1.0.207] – 2026-08-08



## [1.0.206] – 2026-08-08



## [1.0.205] – 2026-08-08



## [1.0.204] – 2026-08-08



## [1.0.203] – 2026-08-08



## [1.0.202] – 2026-08-08



## [1.0.201] – 2026-08-08



## [1.0.200] – 2026-08-07



## [1.0.199] – 2026-08-07



## [1.0.198] – 2026-08-07



## [1.0.197] – 2026-08-07



## [1.0.196] – 2026-08-07

- update recipe invite email delivery provider from Resend to Brevo
- add Gmail delivery monitor

## [1.0.195] – 2026-07-08

- complete recipe sharing followup slices

## [1.0.194] – 2026-07-08



## [1.0.193] – 2026-07-08

- add recipe invites and household list copies

## [1.0.192] – 2026-07-07



## [1.0.191] – 2026-07-07



## [1.0.190] – 2026-07-05



## [1.0.189] – 2026-07-05

- Recipes Sharing/Favorites/Collections erster Slice: Share-als-Kopie zwischen privatem und aktivem Household-Scope, systemdefinierte Favorites, private und haushaltsbezogene Collections sowie Mobile-/Web-/PWA-Oberflaechen fuer Favoritenfilter, Scope-Aktionen und Collection-Inhalte.
- Whole-Branch-Review und QA abgeschlossen: PWA-Cache-Invalidierung, Scope-Kopierregeln, Share-Read-Model und sichtbarkeitskorrekte Collection-Zaehler gehaertet; finaler PR-CI-Lauf und lokaler 6/6-Web-/PWA-Smoke gruen.
- Expo-SDK-56-Patchstaende an die aktuelle `expo-doctor`-Kompatibilitaetsmatrix angepasst.

## [1.0.188] – 2026-06-24



## [1.0.187] – 2026-06-24



## [1.0.186] – 2026-06-24



## [1.0.185] – 2026-06-23



## [1.0.184] – 2026-06-23



## [1.0.183] – 2026-06-23

- harden recipe sw cache routing per request (#26)

## [1.0.182] – 2026-06-21



## [1.0.181] – 2026-06-21



## [1.0.180] – 2026-06-20



## [1.0.179] – 2026-06-20



## [1.0.178] – 2026-06-20

- implement bug reporting slice

## [1.0.177] – 2026-06-20



## [1.0.176] – 2026-06-19



## [1.0.175] – 2026-06-19



## [1.0.174] – 2026-06-19

- fuehre einen Admin Hub mit eigener BYOK-Validation-Policy-Seite und Bug-Reports-Andockpunkt ein
- zentralisiere die BYOK-Validation-Policy fuer `keys/validate` und alle BYOK-Extraction-Einstiege inklusive admin-only Runtime-Config
- ergaenze `GET /api/v1/auth/me`, den Operator-Runbook fuer Set/Verify/Rollback und halte den bisherigen `keys/validate`-Invalid-Key-Vertrag kompatibel

## [1.0.173] – 2026-06-19

## [1.0.172] – 2026-06-19

- härte den Cookidoo-Credential-Store mit RLS, direkten GRANT-Entzügen und Household-FK-Cascade
- snapshotte `activeHouseholdId` auch für Foto- und Text-Extraktionsjobs, damit asynchrone Imports im korrekten Haushalt landen
- sperre die Haushaltsfreigabe im Settings-Screen sichtbar für Nicht-Owner und liefere die Owner-Berechtigung im Status-API-Response mit

## [1.0.171] – 2026-06-16



## [1.0.170] – 2026-06-16



## [1.0.169] – 2026-06-16



## [1.0.168] – 2026-06-16



## [1.0.167] – 2026-06-16



## [1.0.166] – 2026-06-16



## [1.0.165] – 2026-06-15



## [1.0.164] – 2026-06-14



## [1.0.163] – 2026-06-14



## [1.0.162] – 2026-06-14



## [1.0.161] – 2026-06-14



## [1.0.160] – 2026-06-14



## [1.0.159] – 2026-06-14



## [1.0.158] – 2026-06-14



## [1.0.157] – 2026-06-14



## [1.0.156] – 2026-06-13



## [1.0.155] – 2026-06-13



## [1.0.154] – 2026-06-13

- surface readable extraction errors instead of "[object Object]"

## [1.0.153] – 2026-06-13



## [1.0.152] – 2026-06-13

- drop shebang from secret-scan.mjs so Vitest can import it

## [1.0.151] – 2026-06-12



## [1.0.150] – 2026-06-12

- baseline condition + --yes flag + Node24 for supabase-db-push workflow

## [1.0.149] – 2026-06-12



## [1.0.148] – 2026-06-12

- server auth falls back to EXPO_PUBLIC_ Supabase env vars

## [1.0.147] – 2026-06-12



## [1.0.146] – 2026-06-12

- inline EXPO_PUBLIC Supabase vars at web bundle build time

## [1.0.145] – 2026-06-12

- Cookidoo ownership ist jetzt von der globalen Server-Singleton-Semantik auf private User-Credentials mit optionaler expliziter Household-Freigabe umgestellt. `cookidoo_credentials` haelt Credentials und Session scoped in Postgres, `GET /api/v1/cookidoo/status` liefert den aufgeloesten Scope, und Share/Unshare laeuft ueber neue Owner-gated Endpunkte.
- Der Cookidoo-Fetcher liest keine globalen Disk-Credentials oder `cookidoo-session.json` mehr. Background-Jobs snapshotten `activeHouseholdId`, damit Settings-Flow und Async-Extraktion denselben Resolver `user > household > none` verwenden.
- Die Settings-UI zeigt jetzt die echten Scope-Zustaende `Privat verbunden` / `Ueber Haushalt verbunden`, trennt privates Speichern von Household-Share und nutzt dedizierte API-Helper statt inline Singleton-Calls.

- add @emnapi/core and @emnapi/runtime as optionalDependencies to fix CI lock file sync
- S3 route auth inventory — add requireUserAuth to images/search, update CLAUDE.md
- update cold-start cache test to expect legacy-key cleanup call
- Implement post-hotfix auth hardening plan and related changes

## [1.0.144] – 2026-06-12

### Fixed
- Credential- und Ownership-Hotfix komplettiert: `/api/v1/images/search` verlangt jetzt ebenfalls Auth, Cookidoo-Credentials werden atomar geschrieben, und invalides JSON auf `POST /api/v1/cookidoo/credentials` liefert 400 statt 500.
- Mobile Expo-SDK-56-Patch-Drift fuer CI behoben: die erwarteten Expo-Patchstaende sind jetzt im Linux-kompatiblen `mobile/package-lock.json` verankert, sodass `mobile-release-gate` und `performance-audit` wieder gruene `npm ci`-Laeufe haben.
- Zusätzliche Regressionstests sichern die neue Image-Search-Auth-Grenze und den temp-file-rename-Pfad fuer Cookidoo-Credential-Storage ab.

## [1.0.143] – 2026-06-09



## [1.0.142] – 2026-06-09



## [1.0.141] – 2026-06-09

- empty test suite, fix hot-switch cold-start data ordering
- add Platform to react-native mock in account test (T10 regression)
- remove JWT-looking test tokens, fix hot-switch cache test flow
- SVG XSS in image proxy, open-redirect in returnTo (adversarial review)
- align 501 test assertions with structured error envelope
- stale CLAUDE.md API table + 501 error envelope consistency (pre-landing review)
- null-client sessionRestoring guard; fix tautological settings-cookidoo tests (pre-landing review)
- auth screen a11y attributes and German error copy (T14+T15)
- session-restore interstitial prevents signed-out flash (T11)
- web-aware confirmation/reset copy and success state (T10)

## [1.0.140] – 2026-06-09

### Fixed
- **Security:** Credential and BYOK-key API routes (`/api/v1/keys/*`, `/api/v1/cookidoo/*`) are now authenticated — previously any caller could read, overwrite, or delete stored credentials on the public server.
- **Security:** Image proxy (`/api/v1/proxy/image`) now rejects SVG and other scriptable MIME types; only safe raster formats (JPEG, PNG, GIF, WebP, AVIF) are forwarded. SVGs served from an attacker-controlled URL could execute scripts in the app's browser origin.
- **Security:** Post-login `returnTo` redirect now validates that the target is a relative app path, preventing open-redirect attacks (including via Supabase confirmation email deep-links).
- Web session restore no longer flashes signed-out content — a "Session wird wiederhergestellt…" interstitial covers protected screens until the first auth event fires.
- New-tab and cold-start session restore no longer leaks a prior user's cached recipe data; the React Query cache is now namespaced by user ID.
- Expired email-confirmation and password-reset deep-links now surface a visible German error ("abgelaufen oder ungültig") instead of failing silently.
- Web email-confirmation message no longer says "öffne den Link in der App" (correct for native; confusing on web).
- Cookidoo status endpoint no longer returns the stored account email to unauthenticated or unauthorized callers.

### Changed
- Privacy copy for the Groq API key clarified: the key is sent to Groq for extraction requests (not "exclusively local" as stated before).
- Cookidoo credentials copy clarified: credentials apply to the whole server instance, not per user account.

### Removed
- Dead BYOK server-side key store: the `api_keys` table, store/delete routes, and related DB functions had zero callers and have been removed.
- Pinterest and Facebook credential endpoints (0% implemented) now return 501 instead of appearing functional.

## [1.0.139] – 2026-06-09



## [1.0.138] – 2026-06-08



## [1.0.137] – 2026-06-08



## [1.0.136] – 2026-06-08

- GitHub-Actions auf Node-24-kompatible Action-Majors gehoben: `actions/upload-artifact@v7`, `actions/cache@v5` und `browser-actions/setup-chrome@v2`, damit die Node-20-Deprecation-Warnings nicht mehr aus veralteten Marketplace-Actions kommen

## [1.0.135] – 2026-06-07

- haerte den `supabase-rls-smoke`-CI-Job: benoetigte Supabase-Container werden aus `public.ecr.aws`-Mirrors prefetcht, und der lokale Stack startet ohne unnoetige Dienste wie Studio/Imgproxy/Edge-Runtime/Vector/Supavisor
- release-metadaten auf `v1.0.135` nachgezogen

## [1.0.134] – 2026-06-07

- mobile Web-Auth-Startpfad entkoppelt: Auth-Redirect-Observer und Query-Cache-Watcher laden jetzt lazy statt den ersten Expo-Web-Entry statisch aufzublaehen
- Performance-Validierung nach Auth-Onboarding stabilisiert: Bundle-Baselines fuer den Juni-Export auf `maxJsBytes=5.55 MB` und `maxLargestJsAssetBytes=4.62 MB` nachgezogen
- aktuelle Performance-Artefakte versioniert; `perf:validate:strict` ist wieder budget-clean und landet nur noch am Observation-Gate

## [1.0.133] – 2026-06-07



## [1.0.132] – 2026-06-07



## [1.0.131] – 2026-06-06



## [1.0.130] – 2026-06-06



## [1.0.129] – 2026-06-06

- harden private trigger function search paths
- add recipe ownership model

## [1.0.128] – 2026-06-06

- harden private trigger function search paths
- add recipe ownership model

## [1.0.127] – 2026-06-06

- scope recipes and extraction jobs by user

## [1.0.126] – 2026-06-05



## [1.0.125] – 2026-06-05



## [1.0.124] – 2026-06-04



## [1.0.123] – 2026-06-01

- Expo-SDK-56-Core-Slice umgesetzt: Mobile-App von Expo SDK 55 auf SDK 56 gehoben, React/React Native/Expo-Module ueber `expo install --fix` aktualisiert, Expo-Router-Importmigration erledigt, Splash-Konfiguration auf Config-Plugin umgestellt und TypeScript-/RNTL-Folgefixes nachgezogen. NativeWind 5/Tailwind 4 bleibt ein separater Styling-Track.
- Restupdates nach dem SDK-Sprung nachgezogen: Root-Dev-Tooling `concurrently` auf 10.x aktualisiert, Mobile-`@types/react` auf 19.2.15 gehoben und `react-test-renderer` exakt auf die React-19.2.3-Linie gepinnt.
- Kleine Patch-Slices aus dem Dependency-Matrix-Nachzug umgesetzt: Root-Patches fuer Hono, OpenAI SDK, TSX, Vite/Vitest und Node-Typen; Mobile-Patches fuer TanStack Query/Persist, NativeWind, Lucide und Vitest. Expo-/React-Native-/Worklets-Track ist im SDK-56-Slice nachgezogen; Tailwind-4/NativeWind-5 bleibt als separater Styling-Track vertagt.
- GitHub Actions nach Merge auf `main` gruen: CI, Mobile Release Gate, E2E Contract, Performance Audit, Docker Build/Push und Northflank Deploy.

## Unreleased

- Rezeptdaten und Extraktionsjobs sind jetzt an den authentifizierten Benutzer gebunden; die mobilen API-Aufrufe nutzen die gemeinsame `apiFetch`-Schicht, und Planner-/Shopping-Flows prüfen Rezeptsichtbarkeit vor dem Schreiben.

## [1.0.122] – 2026-05-25


## [1.0.121] – 2026-05-25

- npm-Audit-Triage abgeschlossen: sichere Lockfile-Fixes ohne `--force`; Root-`ws`, Mobile-`@xmldom/xmldom`, `dompurify` und `brace-expansion` geloest; verbleibende `drizzle-kit`-/Expo-SDK-bound Findings dokumentiert.


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
