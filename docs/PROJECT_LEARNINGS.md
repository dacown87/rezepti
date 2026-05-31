# Project Learnings — RecipeDeck (rezepti)

Auto-aggregierte Befunde aus gstack-Sessions. Quelle: `~/.gstack/projects/dacown87-rezepti/learnings.jsonl`.
Stand: 2026-05-31 — 41 Eintraege.

Format: `[key] (confidence/10, datum)` + Insight + ggf. Files.
Aktualisieren via `/learn` (zeigt aktuelle), neue Eintraege werden automatisch von `/review`, `/ship`, `/investigate` u.a. ergaenzt.

---

## Architecture

### web-plugin-architecture (10/10, 2026-05-06)

Das `PLUGINS`-Array in `web/index.ts` wurde im Cleanup 2026-05-05 entfernt. `WebScraperPlugin`-Interface lebt weiter in `src/fetchers/web/base.ts`. Fuer neue domain-spezifische Scraper: Interface reimplementieren, `PLUGINS`-Registry in `web/index.ts` neu anlegen, Plugin als `web/[domain].ts` hinzufuegen. Chefkoch bleibt dedizierter Fetcher in `pipeline.ts` — kein Plugin.
*Files:* `src/fetchers/web/base.ts`, `src/fetchers/web/index.ts`

---

## Pitfalls

### Performance & Lighthouse

#### lighthouse-mock-needs-parametric-paths (10/10, 2026-05-08)

`handleApiMock()` in `scripts/performance/lighthouse-runner.mjs` matchte zuerst nur exakte API-Pfade (`/api/v1/recipes`, `/api/v1/shopping`). Parametrisierte Pfade wie `/api/v1/recipes/1` fielen in den `json({})` Catchall. Fix: API-Mock auf parametrisierte Routen erweitern und realistische Empty-State-Strukturen liefern. Wichtig: Das war notwendig, aber nicht der finale LCP-Fix; Phase 4c zeigte spaeter, dass `/shopping` und `/recipe/1` zusaetzlich eine statische App-Shell fuer einen fruehen LCP-Kandidaten brauchen.
*Files:* `scripts/performance/lighthouse-runner.mjs`

#### phase4c-static-shell-beats-hydration-lcp (10/10, 2026-05-11)

Expo-Web kann statisches HTML fuer Routen ausgeben und trotzdem unter Lighthouse erst nach React-Hydration einen validen LCP-Kandidaten liefern. Skeletons innerhalb der React-App verbessern echte Wahrnehmung, aber nicht den Lab-LCP, wenn der LCP-Kandidat erst nach dem grossen Entry-Bundle entsteht. Der validierte Fix war eine route-aware statische Shell in `mobile/app/+html.tsx`, vor dem Expo-Root. Ergebnis nach `perf:lighthouse:compare`: `/shopping` und `/recipe/1` mobile p50 LCP von ~25s auf ~0.9-1.45s. PDF-Lazy-Loading reduzierte den Entry-Chunk, loeste LCP aber nicht allein.
*Files:* `mobile/app/+html.tsx`, `scripts/performance/throttling-compare.mjs`, `docs/performance/throttling-analysis.md`

#### strict-hardening-needs-nonsandboxed-server-and-outlier-review (10/10, 2026-05-12)

`perf:stability:seed` startet fuer Lighthouse lokal `127.0.0.1:4173`; im Codex-Sandbox-Kontext kann das mit `listen EPERM` scheitern. Fuer echte 10er-Seeds nicht-sandboxiert ausfuehren oder `PERF_LIGHTHOUSE_BASE_URL` auf eine erreichbare App setzen. Budget-Suggestions danach nicht mechanisch uebernehmen: Der 2026-05-12-Seed hatte ein komplettes `10/10`-Window, aber `/` enthielt einen Cold-Run-LCP-Ausreisser von 22378 ms; der daraus folgende 24616-ms-Vorschlag wurde bewusst verworfen, weil warme Runs bei ~903 ms lagen.
*Files:* `scripts/performance/baseline.json`, `artifacts/performance/budget-suggestions.json`, `docs/performance/throttling-analysis.md`

#### audit-shell-must-be-route-scoped (10/10, 2026-05-12)

Eine globale `rd-audit-shell` ueber alle Routen vergiftet die `/`-LCP-Messung: der erste Versuch fuer Phase 4c-Outcome-Z hatte das Overlay auf `<body>` fuer jede Route gerendert und fuehrte unter Lighthouse zu LCP ~22 s auf `/` (warm runs vorher ~903 ms). Loesung: Audit-Shell nur fuer die historisch instabilen Routen `/shopping` und `/recipe/*` aktiv schalten, gesteuert ueber `html[data-audit-shell='shopping'|'recipe']`. `<head>`-Script setzt das Attribut vor dem Expo-Root-Render. Begleitende Korrektur: CI-Performance-History-Cache mehrfach neu namespacen (v2 -> v3 -> v4), damit verseuchte History-Eintraege nicht in spaetere Beobachtungslaeufe zurueckkippen.
*Files:* `mobile/app/+html.tsx`, `.github/workflows/ci.yml`

#### strict-probe-gate-needs-five-fresh-runs (10/10, 2026-05-12)

Das `strictProbeEligible=true`-Gate setzt 5 aufeinanderfolgende eigenstaendige CI-Workflow-Runs voraus; GitHub-Reruns mit identischer `run_id` zaehlen nicht. Erfolgreicher Pfad am 2026-05-12: `validate-status.mjs` schreibt eindeutige `runId`s pro Run-Attempt-Timestamp, `observation.json` zaehlt nur Runs aus dem aktuellen Cache-Namespace, anschliessend 5 leere Trigger-Commits (`be15632`, `d819437`, `fc4eef6`, `043869e` + finaler Warn-Run `25742437228`) seriell pushen und sequenziell auf `completed success` warten. Erst danach `gh workflow run CI --ref ... -f perf_enforcement=strict` als einzelner Probe-Run dispatchen (`25742783313` gruen). Wichtig: `consecutiveGreenRuns` springt nach dem Probe-Run zurueck auf `0`; weitere Strict-Probes brauchen ein neues 5er-Fenster.
*Files:* `scripts/performance/validate-status.mjs`, `scripts/performance/observation-gate.mjs`, `docs/performance/strict-probe-runbook.md`

#### expo-export-hangs-postbuild (10/10, 2026-05-08)

`npm run build:mobile` (= `cd mobile && CI=1 npx expo export --platform web`) druckt erfolgreich `Exported: ../public` aber der sh/npm/expo-Wrapper-Stack haengt danach unbegrenzt — Metro-Bundler oder ein Worker exit nicht sauber. Mehrere parallele Versuche fuehren zu Zombie-Prozess-Akkumulation (5+ stuck expo nodes nach 1 Tag), die RAM blockieren. Fix fuer wiederholte Lighthouse-Iterationen: `build:mobile` EINMAL ausfuehren und im Loop nur `perf:bundle` + `perf:lighthouse` aufrufen. Zombies via `pkill -KILL -f "expo export"` entfernen. Iteration sinkt von >25min auf 111s.
*Files:* `scripts/performance/lighthouse-runner.mjs`, `mobile/app.json`

### Shell & Tooling

#### bash-c-inline-newline-collapse (10/10, 2026-05-08)

`bash -c "..."` mit Inline-Newlines im for-Loop-Body kollabiert die Newlines zu Leerzeichen. Resultat: der ganze Loop-Body wird als EINE pipeline ohne Befehlsseparatoren geparsed (`echo+npm+pipe+npm+pipe+echo` statt 5 separate Commands). Loop laeuft scheinbar erfolgreich aber tut nichts. **10h verbrannt.** Fix: Loop-Body in eigenes Script (`/tmp/foo.sh`) auslagern und dieses via `nohup` ausfuehren — niemals mehrzeilige `bash -c` Inline-Loops fuer non-trivial Logik.

#### tsx-eval-top-level-await-cjs (10/10, 2026-04-29)

`npx tsx -e` mit top-level `await` schlaegt fehl ("Top-level await is currently not supported with the cjs output format"). Fix: Code in eine `.ts`-Datei auslagern und `npx tsx scripts/foo.ts` aufrufen.
*Files:* `scripts/get-db-urls.ts`

### Web Scraping & Fetcher

#### yt-dlp-output-template-id (10/10, 2026-05-01)

yt-dlp mit Template `foo_%(id)s.%(ext)s` schreibt `foo_<id>.info.json` (nicht `foo_info.json`) und `foo_<id>.description` (nicht `foo_description.txt`). Immer `readdir()` + find-by-extension statt hardcoded Pfade.
*Files:* `src/fetchers/pinterest.ts`

#### ichkoche-microdata-not-jsonld (10/10, 2026-04-29)

`ichkoche.at` verwendet HTML Microdata (`itemprop`-Attribute) statt JSON-LD. Unser CSS-Selektor matched den Microdata-Container `[itemtype*=schema.org/Recipe]`, liest ihn aber als Text statt die `itemprop`-Felder zu parsen — strukturierte Daten gehen verloren. Fix: 13b Microdata-Support (`extractMicrodataRecipe()`).
*Files:* `src/fetchers/web.ts`

#### hardcoded-recipe-urls-404 (10/10, 2026-04-29)

Erfundene Rezept-URLs fuer Tests ergeben fast immer 404. Echte URLs ueber DB-Abfrage (`SELECT source_url FROM recipes`) oder Homepage-Scraping (`href`-Patterns aus Listings) beschaffen. Sitemaps oft leer oder blockiert.
*Files:* `scripts/sample-test.ts`

#### chefkoch-ts-code-duplication (9/10, 2026-04-30)

`chefkoch.ts` hatte `extractJsonLdRecipes`, `findRecipeInJsonLd`, `resolveSchemaImage` und `extractImages` komplett dupliziert aus `web.ts` — unbemerkt. Beim naechsten Fetcher immer zuerst pruefen ob Hilfsfunktionen bereits in `web/base.ts` existieren statt neu implementieren.
*Files:* `src/fetchers/chefkoch.ts`, `src/fetchers/web/base.ts`

#### chefkoch-api-field-name (10/10, 2026-04-12)

Chefkoch API v2 returns `result.recipe.previewImageUrlTemplate` (NOT `previewImageUrl`). Template contains `<format>` placeholder — replace with e.g. `crop-960x720`. Silent `catch(() => [])` hid this bug since the start.
*Files:* `src/utils/image-search.ts`

### Database & Supabase

#### supabase-pgbouncer-prepared-statements (10/10, 2026-04-16)

Transaction Pooler (port 6543, pgbouncer mode) does NOT support prepared statements. Set `prepare: false` in postgres-js options. Direct connection (port 5432) supports prepared statements, but does not work from Northflank.
*Files:* `src/db-react.ts`

#### supabase-direct-url-northflank-dns (10/10, 2026-04-16)

`db.[ref].supabase.co:5432` (direct connection) resolves locally but ENOTFOUND from Northflank. Always use Transaction Pooler (`aws-0-[region].pooler.supabase.com:6543`) for production deployments on Northflank.
*Files:* `src/db-react.ts`

#### postgres-js-failed-query-means-connection (10/10, 2026-04-16)

`"Failed query: <sql>\nparams: "` error format from postgres-js always indicates a connection problem (SSL, network), NOT a bad SQL query. If params is empty and query is trivial, check connection options first.
*Files:* `src/db-react.ts`

#### supabase-ssl-required-northflank (10/10, 2026-04-16)

postgres-js without `ssl` option fails in Northflank with "Failed query" (not a query error — it is a connection error). Always set `ssl: "require"` for Supabase connections. Works locally too.
*Files:* `src/db-react.ts`

#### ensureSchema-client-exec-api (10/10, 2026-04-14)

`ensureReactSchema()` uses `db.$client.exec()` which is better-sqlite3 specific. Cannot port to postgres-js. Replace with drizzle-kit generate + migrate for PostgreSQL.
*Files:* `src/db-react.ts`

#### supabase-job-manager-hidden-sqlite (10/10, 2026-04-14)

`job-manager.ts` uses better-sqlite3 directly (independent of Drizzle/db-react.ts) — always check all SQLite users before removing better-sqlite3 from `package.json`.
*Files:* `src/job-manager.ts`

### Mobile UI / Expo

#### rntl-vitest-real-runtime-via-targeted-optimizer (10/10, 2026-05-31)

Mobile-Testdateien importieren inzwischen echte `@testing-library/react-native`. Der Vitest-Pfad braucht dafuer gezielte SSR-Dependency-Optimierung fuer RNTL, waehrend `react-native` auf dem lokalen Test-Shim bleibt; sonst landet der React-Native-Flow-Entrypoint (`import typeof`) roh in Node. `mobile/test/testing-library-rn-real.ts` ist kein alter Renderer-Compat-Layer mehr, sondern nur ein duennes Real-RNTL-Modul fuer live weitergereichtes `screen` und Uebergangstypen. Direkte `react-test-renderer`-Imports sind per `npm run test:mobile:rntl-guard` blockiert. Die migrierten Tests sollen keine string-basierten `UNSAFE_*ByType`-Strukturabfragen mehr nutzen; fehlende Nutzerqueries werden ueber Accessibility-Labels oder gezielte `testID`s nachgezogen.
*Files:* `mobile/vitest.config.ts`, `mobile/test/testing-library-rn-real.ts`, `docs/testing/rntl-migration-phase-0-inventory.md`

#### rntl-real-runtime-still-emits-test-warnings (9/10, 2026-05-31)

Der Real-RNTL-Pfad ist gruen, aber nicht komplett warnfrei. Lokale `FlatList`-Testshims muessen gerenderte `renderItem`-Kinder mit stabilen Keys weitergeben, sonst erzeugen sie falsche `key`-Prop-Warnungen trotz korrekter Produkt-`keyExtractor`s. Retry-/Mutation-Events in RNTL-Fallbacktests sollten ueber `act`-Wrapper laufen. Nach der ersten Triage sind `key`-Warnungen weg und `act(...)` stark reduziert; `react-test-renderer is deprecated` bleibt aus RNTL/React-19-Internals und ist eher ein Dependency-/Renderer-Upgrade-Thema als ein lokaler Testcode-Fix.
*Files:* `docs/TEST_STATUS.md`, `mobile/test/planner-screen-fallbacks.test.tsx`, `mobile/test/shopping-screen-fallbacks.test.tsx`, `mobile/test/recipe-list-screen-fallbacks.test.tsx`

#### expo-scrollview-justify-center-web (10/10, 2026-04-16)

`justifyContent:center` in a horizontal React Native ScrollView on web clips the left overflow — content starts at a negative offset and cannot be scrolled to. The right side is accessible but the first N items are unreachable. Fix: remove `justifyContent:center` for web, or use `flex-start`. Also: set `showsHorizontalScrollIndicator={Platform.OS===web}` so users see the scrollbar hint.
*Files:* `mobile/app/(tabs)/planner.tsx`

#### expo-web-assets-gitignored (10/10, 2026-04-16)

`public/assets/` was gitignored so Expo web build output (Logo hash file) never reached Docker production image. `Dockerfile` does `COPY public/` from git context — any gitignored file in `public/` is silently missing in prod. Fix: remove `public/assets/` from `.gitignore` and commit the generated assets.
*Files:* `Dockerfile`, `.gitignore`, `public/assets/public/Logo.5015480b5075ff28f979e0c6cac6fa38.png`

#### mediatrack-focusmode-advanced-ignored (8/10, 2026-04-16)

On mobile Chrome, `focusMode` in the `MediaTrackConstraints.advanced` array is silently ignored. Use three-level approach: (1) pass `focusMode` in `getUserMedia` constraints directly, (2) call `applyConstraints({ focusMode: continuous })` as a direct constraint (not in `advanced`) AFTER `onloadeddata` fires, (3) fallback to `advanced` array only if the direct call throws. Timing matters: `applyConstraints` before `video.play()` fails silently on some Android devices.
*Files:* `mobile/components/ScannerCamera.web.tsx`

#### render-guard-vs-trigger-condition (10/10, 2026-04-12)

Two-gate pattern: fixing the trigger condition (what causes state to be set) is not enough if there is a separate render guard (what causes the component to show). Both must be updated together. In `extract.tsx` the modal trigger at line 185 was fixed but the render guard at line 379 still had the old `imageSuggestions.length > 0` check.
*Files:* `mobile/app/(tabs)/extract.tsx`

### API / Routing

#### planner-api-query-param-mismatch (10/10, 2026-04-16)

Planer-Client sendete `?weekStart=` aber Server liest `c.req.query("week")` — Server ignorierte den Param und berechnete immer die aktuelle Woche. Zusaetzlich gibt der Server `{ entries, weekStart }` zurueck, aber Client parsete direkt als Array → `entries` immer `[]`. Beide Bugs zusammen: Planer immer leer, Wochennavigation wirkungslos.
*Files:* `mobile/app/(tabs)/planner.tsx`, `src/routes/planner.ts`

#### mobile-branch-not-merged (10/10, 2026-04-16)

`phase1-remove-local-sqlite` branch contained complete Phase 1 work (remove expo-sqlite from mobile) but was never merged into main — sat unmerged while Phase 2 (server Supabase) shipped. Always check `git branch -a` and `git log main...branch` before starting Phase N+1.

### QR / PDF / Bilder

#### qr-pdf-pixel-density (10/10, 2026-04-16)

`QRCode.toDataURL` mit `width:80` erzeugt bei einem 2KB-Payload (Rezept-JSON) einen QR-Code Version 20+ mit `<1px` pro Modul — weder BarcodeDetector noch jsQR koennen ihn lesen. Fix: `width:400` + `errorCorrectionLevel:L`. Noch besser: URL statt JSON enkodieren (~30 Zeichen → Version 2, ~15px pro Modul).
*Files:* `mobile/utils/pdf-export.web.ts`, `mobile/utils/pdf-export.native.ts`

#### regex-optional-char-ordering (10/10, 2026-04-16)

Regex `Personen?` means `Persone` + optional `n` — matches `Persone` and `Personen` but NOT `Person` (the `e` is required). To match all variants `Person`/`Persone`/`Personen` use `Persone?n?` (`e` optional, then `n` optional). Pattern: when making letters optional in a suffix, work from the end inward.
*Files:* `src/fetchers/chefkoch.ts`, `test/unit/chefkoch.test.ts`

### Docker / Infra

#### mobile-engines-require-node24-in-docker (10/10, 2026-05-24)

Wenn `mobile/package.json` Engines auf `node >=24.15.0` und `npm >=11` stehen, aber der Docker-Builder mit `node:20-slim` laeuft, bricht `cd mobile && npm ci` frueh mit `EBADENGINE` und kann anschliessend irrefuehrende Lockfile-Fehler zeigen (`npm ci can only install...`, fehlende Pakete). Der stabile Fix ist, Builder-Images auf Node-24-Linie zu heben (hier: `node:24.15.0-slim` fuer `base` + `web-builder`) und danach `npm --prefix mobile ci` gegen den aktuellen Lockfile-Stand zu verifizieren.
*Files:* `Dockerfile`, `mobile/package.json`, `mobile/package-lock.json`

#### ytdlp-static-binary-node-slim (10/10, 2026-04-16)

yt-dlp PyInstaller static binary from GitHub Releases fails with exit 127 in `node:20-slim` — missing glibc deps. Use `pip3 install yt-dlp` instead. Also: `curl` without `--fail` silently downloads HTML error pages as binaries.
*Files:* `Dockerfile`

#### squash-merge-deletes-changelog-json-breaks-docker (10/10, 2026-05-12) — FIXED 2026-05-13

`Dockerfile:51` machte `COPY public/changelog.json ./public/changelog.json` direkt aus dem Build-Context. Wenn ein Feature-Branch `public/changelog.json` nicht enthielt (typisch bei Phase-4c-Builds, wo `public/` neu gebaut wurde), loeschte der Squash-Merge die Datei auf `main`. Erster `docker-build`-Workflow auf dem Squash-Commit failte dann mit `failed to calculate checksum ... "/public/changelog.json": not found` (siehe Run `25745137805` am 2026-05-12). Selbstheilend: der `changelog-update.yml`-Workflow committete danach den naechsten Version-Bump, der die Datei wieder anlegte; der zweite Docker-Build lief auf diesem Commit gruen. Folge: jeder Squash-Merge eines Branches ohne `public/changelog.json` kostete einen roten Docker-Build und einen verzoegerten Northflank-Deploy. **Fix am 2026-05-13:** `Dockerfile`-COPY durch BuildKit-`RUN --mount=type=bind,source=public,target=/tmp/public-host` mit Shell-Fallback ersetzt — fehlt die Datei, schreibt der Build einen Minimal-Stub `{"version":"0.0.0","entries":[]}`, sodass der Image-Build durchlaeuft. `changelog-update.yml` legt die Datei beim naechsten Version-Bump wieder neu an.
*Files:* `Dockerfile`, `.github/workflows/changelog-update.yml`, `.github/workflows/docker-publish.yml`

---

## Operationals

### Performance Gates

#### phase3-readiness-stability-vs-budget (10/10, 2026-05-08)

`artifacts/performance/readiness.json metricStabilityMet` prueft NUR den Spread zwischen Runs (`max-min/median <= 10%`), nicht ob die Werte unter den `baseline.json` LCP/CLS-Budgets liegen. Eine konstant schlechte LCP (z.B. 25s mit Spread 0.3%) erfuellt `metricStabilityMet=true` und kippt `ready=true`. Das Gate sagt "genug stabile Daten zum Enforcen", nicht "Werte sind gut". Budget-Verletzungen werden separat in `validate-status.mjs` als WARN getrackt aber tauchen nicht im `warningRate` von `readiness.json` auf — die Metrik zaehlt nur Lighthouse-Run-Failures.
*Files:* `scripts/performance/validate-status.mjs`, `scripts/performance/baseline.json`

### Build & Public/

#### expo-build-deletes-public-files (10/10, 2026-04-16)

`npm run build:mobile` (Expo web export) completely clears and regenerates `public/` including deleting hand-maintained files like `changelog.json`. Always run `git checkout HEAD -- public/changelog.json` (and any other manually-maintained `public/` files) immediately after a build.
*Files:* `public/changelog.json`

### Obsidian Vault

#### obsidian-vault-direct-path (10/10, 2026-04-16)

Obsidian vault is at `/home/patrick/Vault/` — can write markdown files directly with the Write tool instead of going through MCP `patch_content`. Files are live in Obsidian immediately.

#### obsidian-patch-content-broken (10/10, 2026-04-16)

`obsidian_patch_content` with `target_type=heading` always fails with error 40080 (invalid-target) via Obsidian REST API — even for valid, existing, ASCII headings. Use Write tool directly to `/home/patrick/Vault/` instead. `append_content` works fine for adding to end of files.

### Supabase Setup

#### supabase-pooler-url-location (10/10, 2026-04-16)

Pooler URL is NOT in the main Database > Connection String view. Navigate to Settings > Database > Connection pooling section (scroll down). Region format: `aws-0-[region].pooler.supabase.com`. Username format: `postgres.[ref]` (not just `postgres`).

### Web Scraping Heuristik

#### sample-test-bot-403-category (9/10, 2026-04-29)

Bot-Schutz (HTTP 403 von Cloudflare/WAF) bei `allrecipes.com`, `simplyrecipes.com`, `seriouseats.com` ist KEIN Schema-Problem — kein Selektor-Fix hilft. Neue Fehlerkategorie fuer `toUserFriendlyError()` noetig: "Website erlaubt kein automatisches Abrufen, Freitext-Import verwenden." 16% der getesteten Sites betroffen.
*Files:* `src/pipeline.ts`, `scripts/sample-test-analysis.md`

### Mobile Routing & Camera

#### expo-router-params-first-render (9/10, 2026-04-12)

Expo Router `useLocalSearchParams()` is synchronously available on first render. Use `useState(param === value)` directly instead of `useEffect` to initialize state from params. `useEffect` fires after paint and causes a visible flash (e.g. scanner landing page visible before camera opens). Direct initialization skips the intermediate render entirely.
*Files:* `mobile/app/(tabs)/scanner.tsx`

#### expo-web-camera-supported (9/10, 2026-04-10)

`expo-camera` v17 (Expo SDK 54) ships `useWebQRScanner+jsQR` for web via `ExpoCamera.web.js`. `CameraView` with `barcodeScannerSettings` works on web. `ScannerCamera.web.tsx` stub can be replaced with identical `CameraView` code.
*Files:* `mobile/components/ScannerCamera.web.tsx`, `mobile/node_modules/expo-camera/build/ExpoCamera.web.js`

### Planning Workflow

#### no-plan-file-general-review (8/10, 2026-04-09)

When user invokes `/autoplan` without an existing plan file and wants a general project review, create the plan document inline in the plan mode file as the review target. Use `docs/superpowers/plans/` dir for project-specific plans.

---

## Preferences

#### recipedeck-color-system (10/10, user-stated, 2026-04-08)

User approved C (warm white `#FFFFFF` + terracotta `#C84B31` primary + gold `#D4A853` accent) als Light Mode und B (espresso `#1A0F0A` + paprika/saffron) als Dark Mode. Replaces purple/gray AI-slop scheme. Logo at `mobile/public/Logo.png` in nav.
*Files:* `mobile/tailwind.config.js`, `mobile/app/(tabs)/_layout.tsx`
