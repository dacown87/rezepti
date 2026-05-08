# Project Learnings — RecipeDeck (rezepti)

Auto-aggregierte Befunde aus gstack-Sessions. Quelle: `~/.gstack/projects/dacown87-rezepti/learnings.jsonl`.
Stand: 2026-05-08 — 35 Eintraege.

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

`handleApiMock()` in `scripts/performance/lighthouse-runner.mjs` matcht nur exakte API-Pfade (`/api/v1/recipes`, `/api/v1/shopping`). Parametrisierte Pfade wie `/api/v1/recipes/1` fallen in den `json({})` Catchall — die React-App wartet auf eine sinnvolle Recipe-Struktur, rendert nichts und Lighthouse misst LCP=25s (Timeout). Folge: `/shopping` und `/recipe/1` zeigten LCP ~25s waehrend `/` sauber 902ms hatte. Fix: API-Mock auf parametrisierte Routen erweitern und realistische Empty-State-Strukturen liefern (z.B. `{id:1, name:"", ingredients:[]}` fuer `recipes/:id`).
*Files:* `scripts/performance/lighthouse-runner.mjs`

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

#### ytdlp-static-binary-node-slim (10/10, 2026-04-16)

yt-dlp PyInstaller static binary from GitHub Releases fails with exit 127 in `node:20-slim` — missing glibc deps. Use `pip3 install yt-dlp` instead. Also: `curl` without `--fail` silently downloads HTML error pages as binaries.
*Files:* `Dockerfile`

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
