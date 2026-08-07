# Project Learnings — RecipeDeck (rezepti)

Auto-aggregierte Befunde aus gstack-Sessions. Quelle: `~/.gstack/projects/dacown87-rezepti/learnings.jsonl`.
Stand: 2026-08-07 — 57 Eintraege. (Zaehler war bis dahin auf 41 stehengeblieben.)

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

#### pipe-swallows-exit-code (10/10, 2026-08-07)

`npm run mobile:release-gate 2>&1 | tail -40` meldete `exit code 0` — das belegte nur, dass `tail` funktioniert. Bash gibt fuer eine Pipeline den Status des **letzten** Kommandos zurueck; ohne `set -o pipefail` geht der Status von `npm` verloren. Zweiter Schaden: `tail` behielt nur die letzten 40 Zeilen, damit waren alle Belege der vorherigen Schritte (expo-doctor, RNTL-Guard, typecheck, Export) weg. Fuer Verifikationslaeufe nie pipen, sondern in eine Datei umleiten und den Status separat festhalten: `cmd > run.log 2>&1; echo "EXIT=$?"`. Merksatz: Ein Exit-Code hinter einer Pipe ist kein Beweis.

#### composite-ci-script-must-be-run-whole (10/10, 2026-08-07)

Vor einem Push liefen `mobile:typecheck` und `test:mobile` gruen, in CI fiel dann `mobile-release-gate` durch. Das Gate ist eine `&&`-Kette aus sechs Schritten (`npm ci` ×2, `expo-doctor`, RNTL-Guard, `typecheck`, `build:mobile`, `test:coverage`); geprueft waren zwei davon, der Ausfall lag in `expo-doctor` — dem einzigen Schritt, den kein lokaler Lauf beruehrte. Wenn CI ein zusammengesetztes Script faehrt, lokal genau dieses Script ausfuehren, nicht seine Bestandteile.
*Files:* `package.json`, `.github/workflows/ci.yml`

#### knip-needs-workspace-entrypoints (10/10, 2026-08-07)

`npx knip` ohne Config meldete **156 ungenutzte Dateien**, darunter praktisch die komplette Expo-App: `mobile/` ist ein eigenes npm-Paket mit expo-router (dateibasiertes Routing ohne explizite Imports), Service Worker und eigener Vitest-Config. Mit Workspace-Config in `knip.json` (Entry-Points inkl. Metro-Platform-Suffixe `**/*.{web,native}.{ts,tsx}`): **13 statt 156**. Ohne diese Konfiguration ist die Ausgabe unbrauchbar, nicht nur ungenau.
*Files:* `knip.json`

#### knip-unused-exports-are-not-dead-code (10/10, 2026-08-07)

Die knip-Kategorie *unused exports* misst **Export-Oberflaeche**, nicht toten Code. Von den gemeldeten Symbolen waren die meisten modulintern in Gebrauch und lediglich unnoetig exportiert: `getPinterestCredentials` (speist `fetchFromPinterestApi`), `hasFacebookCookies` (steuert das yt-dlp-`--cookies`-Flag), `downloadCobaltMedia` (aufgerufen von `downloadFirstCobaltMedia`), vier `evaluateIngredientSearch`-Helfer und acht von neun `bug-reports.ts`-Konstanten. Wirklich tot war ein einziges Symbol (`BugReportCreateInput`). Auch `sharp` als "unlisted dependency" war kein Fund — der Script-Header dokumentiert `npm i sharp --no-save` als Absicht. Verlaesslich sind die Kategorien files/dependencies/unlisted/unresolved/binaries; nur die gated `npm run lint:dead:ci`. Echter Fund dort: `undici` wurde in `test/unit/web-regression.test.ts` importiert, stand in keiner `package.json` und loeste nur transitiv auf.
*Files:* `knip.json`, `package.json`

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

#### expo-doctor-patch-drift-blocks-release-gate (10/10, 2026-08-07)

`mobile-release-gate` war seit dem 2026-08-01 rot, acht `main`-Runs in Folge: `expo-doctor` meldete `11 packages out of date`. Reine Patch-Drift innerhalb SDK 56 (`expo`, `expo-router`, `expo-image-picker` u.a. je einen Patch hinter der erwarteten Version) — kein Code- und kein Merge-Problem. Falle beim Fix: `npx expo install --fix` zieht nicht nur Patches, sondern schrieb `react-native-screens` von der exakten Pinnung `4.25.2` auf die Range `~4.26.0` um, hob also die Pinnung auf **und** machte einen Minor-Sprung. Die RN-Oekosystem-Pakete sind hier bewusst exakt gepinnt (react, react-dom, react-native, react-native-svg, react-native-reanimated, react-native-worklets, async-storage), also nach `--fix` immer den Diff pruefen und Pinnungen von Hand wiederherstellen — expo-doctor akzeptiert eine exakte Version innerhalb der erwarteten Range. Merksatz: ein tagelang roter Gate wird zur Tapete; hier war der Fix nach acht roten Runs ein Zweizeiler.
*Files:* `mobile/package.json`, `mobile/package-lock.json`, `.github/workflows/ci.yml`

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

#### production-url-and-unowned-domain-boundary (10/10, 2026-07-25)

Die funktionierende Production-Origin ist `https://p01--rezepti-app--2s7hvlwm5zc5.code.run`; ihr Health-Endpunkt liefert `200`. Die einzige vom Projekt genutzte oeffentliche Adresse ist der Shortpen-Link `https://shr.pn/RecipeDeck`, der auf diese Origin zeigt. `shr.pn` gehoert Shortpen; RecipeDeck verwaltet dort nur den Pfad `RecipeDeck`, keine eigene DNS-Domain. `recipedeck.app` gehoert **nicht** dem Projekt und darf weder als offizielle URL kommuniziert noch in Northflank registriert oder konfiguriert werden. Ein beobachteter Zertifikatsfehler auf dieser fremden Domain ist ausserhalb unseres Betriebsbereichs. **Nachtrag 2026-08-07:** Dasselbe gilt fuer E-Mail — es gibt keine eigene Maildomain. Verifizierter Brevo-Absender fuer Invite-Mails *und* Supabase-Auth-SMTP ist die Einzeladresse `recipedeckapp@gmail.com` (zugleich die vom Gmail-Monitor ueberwachte Operator-Mailbox). Die Brevo-Spec vom 2026-07-17 nannte urspruenglich `einladungen@recipedeck.app`/`auth@recipedeck.app` und wurde korrigiert.
*Files:* `.github/workflows/docker-publish.yml`, `README.md`, `.env.example`, `docs/supabase-auth-email-runbook.md`, `docs/superpowers/specs/2026-07-17-brevo-transactional-email-design.md`

#### supabase-free-tier-pause-signature (10/10, 2026-08-07)

Wenn Production `500` liefert und `/api/v1/health` `Failed query: select "id" from "recipes"` meldet, **zuerst pruefen ob das Supabase-Projekt pausiert ist** — nicht die App debuggen. Eindeutige Signatur: `db.<project-ref>.supabase.co` loest per DNS nicht mehr auf (`ENOTFOUND`), Supabase entfernt den Record beim Pausieren. Schnelltest: `getaddrinfo` gegen den Host aus `DATABASE_URL`, oder direkt ein `select 1` mit `postgres-js`. Der Free-Tier pausiert nach etwa vier Wochen Inaktivitaet; passiert am 2026-07-07 und erneut am 2026-08-07. Folge: der `Poll Northflank health`-Step im Deploy-Workflow wird rot, obwohl Build und Deploy fehlerfrei waren — das sieht wie ein kaputter Deploy aus, ist aber ein Datenbank-Betriebszustand. Reaktivierung geht nur ueber das Supabase-Dashboard; danach war die App ohne Container-Restart sofort wieder gesund.
*Files:* `src/db-react.ts`, `.github/workflows/docker-publish.yml`

#### public-export-untracked-ci-fallout (9/10, 2026-08-07)

Der Expo-Web-Export unter `public/` wurde am 2026-08-07 aus dem Repo entfernt (Build-Artefakt, wird vom `web-builder`-Stage neu erzeugt). Zwei CI-Jobs setzten stillschweigend voraus, dass er im Checkout liegt, und wurden erst nach dem Push rot: `test` ueber `test/unit/static-assets.test.ts`, das `readdirSync("public/assets/public")` macht, und `e2e-legacy-soak`, das `GET /` gegen einen echten Server auf `200` prueft und dafuer `public/index.html` braucht. `performance-audit` war **nicht** betroffen, weil `perf:audit` den Export selbst baut. Lehre: beim Untracken von Build-Output nicht nur den Docker-Build pruefen, sondern jeden Job, der einen echten Server startet oder das Dateisystem liest. Zweite Falle: `public/changelog.json` sah wie Build-Output aus, ist aber eine zur Laufzeit geladene Datendatei — mitgeloescht erzeugte `changelog-update.yml` sie neu und verlor die gesamte Versionshistorie.
*Files:* `.gitignore`, `.github/workflows/ci.yml`, `test/unit/static-assets.test.ts`, `public/changelog.json`

#### gitignore-route-list-rots-use-whitelist (10/10, 2026-08-07)

Der `public/`-Block in `.gitignore` zaehlte jede Expo-Export-Route einzeln auf (`public/recipe/`, `public/(tabs)/`, ...). Die spaeter dazugekommenen Routen `admin/`, `collection/` und `share-invite/` wurden nie nachgetragen und lagen nach jedem `build:mobile` untracked herum — beim naechsten `git add -A` waeren sie mitgegangen. Die Liste veraltet strukturell mit jedem neuen Screen. Fix: Whitelist statt Blacklist — `public/*` ignorieren und die sieben handgepflegten Assets (Logo, vier Icons, Manifest, `changelog.json`) per `!` wieder freigeben. Fallstrick: `public/*` schreiben, nicht `public/` — bei einem ignorierten *Verzeichnis* steigt Git nicht hinein und alle Negationen darunter bleiben wirkungslos.
*Files:* `.gitignore`

#### changelog-json-addadd-conflict-loses-history (10/10, 2026-08-07)

Add/add-Merge-Konflikt in `public/changelog.json`: auf `main` hatte `changelog-update.yml` die Datei mit **einem** Eintrag neu angelegt, der Feature-Branch hatte **31** (1.0.196 → 1.0.166). Die App laedt die Datei zur Laufzeit — ein reflexhaftes `--theirs` haette 30 Changelog-Eintraege in Production geloescht. Aufloesung war die Branch-Fassung (echte Obermenge, `lastUpdated` in beiden identisch), der Merge hat die Historie auf `main` nebenbei repariert. Regel: bei add/add-Konflikten in Datendateien beide Seiten **zaehlen**, nicht nur ansehen. Verwandt mit `public-export-untracked-ci-fallout` und `squash-merge-deletes-changelog-json-breaks-docker`.
*Files:* `public/changelog.json`, `.github/workflows/changelog-update.yml`

---

## Operationals

### Performance Gates

#### phase3-readiness-stability-vs-budget (10/10, 2026-05-08)

`artifacts/performance/readiness.json metricStabilityMet` prueft NUR den Spread zwischen Runs (`max-min/median <= 10%`), nicht ob die Werte unter den `baseline.json` LCP/CLS-Budgets liegen. Eine konstant schlechte LCP (z.B. 25s mit Spread 0.3%) erfuellt `metricStabilityMet=true` und kippt `ready=true`. Das Gate sagt "genug stabile Daten zum Enforcen", nicht "Werte sind gut". Budget-Verletzungen werden separat in `validate-status.mjs` als WARN getrackt aber tauchen nicht im `warningRate` von `readiness.json` auf — die Metrik zaehlt nur Lighthouse-Run-Failures.
*Files:* `scripts/performance/validate-status.mjs`, `scripts/performance/baseline.json`

#### strict-budget-clean-can-still-be-observation-blocked (10/10, 2026-06-08)

Ein `perf:validate:strict` ohne Budget-Findings ist nicht automatisch `ready=true`. Sobald ein frischer Run in ein historisches 10er-Fenster gemischt wird, kann `metricStabilityMet` kippen, obwohl LCP/JS-Budgets eingehalten werden. Am 2026-06-08 war der Juni-Run fuer `/` und `/shopping` schnell genug, aber das Fenster bestand aus 9 Mai-Runs plus 1 Juni-Run; dadurch stieg der LCP-Spread ueber 10 % und der Validator endete als `classification=observation_blocked`. Bedeutung: Budgetgrenzen und Observation-/Readiness-Gate getrennt lesen.
*Files:* `artifacts/performance/readiness.json`, `scripts/performance/validate-status.mjs`, `scripts/performance/baseline.json`

#### expo-auth-side-effects-inflate-web-entry (9/10, 2026-06-08)

Wenn Auth-Observer oder Auth-Cache-Watcher statisch im mobilen Root-Layout importiert werden, landet der komplette `@supabase/supabase-js`-Stack im initialen Expo-Web-Entry, auch wenn der eigentliche Account-Flow spaeter kommt. In diesem Repo war der pragmatische Fix, Observer und Cache-Watch lazy nach dem Mount zu laden. Das reduziert zwar nicht automatisch jedes rohe JS-Byte-Budget dramatisch, zieht aber den Auth-/Workspace-Slice aus dem ersten Startpfad und verhindert, dass Performance-Regressionsanalyse an einem vermeidbaren statischen Import haengen bleibt.
*Files:* `mobile/app/_layout.tsx`, `mobile/utils/query-client.ts`

### Build & Public/

#### expo-build-deletes-public-files (10/10, 2026-04-16)

`npm run build:mobile` (Expo web export) completely clears and regenerates `public/` including deleting hand-maintained files like `changelog.json`. Always run `git checkout HEAD -- public/changelog.json` (and any other manually-maintained `public/` files) immediately after a build.
*Files:* `public/changelog.json`

### Git & parallele Sessions

#### shared-worktree-entangles-branches (10/10, 2026-08-07)

Zwei Claude-Sessions arbeiteten gleichzeitig im selben Verzeichnis. Symptome: fremde Aenderungen tauchten mitten in der Arbeit im Working Tree auf und verschwanden wieder, das Reflog zeigte zwei fremde Commits und drei `git reset`, und ein fremder Commit landete auf dem eigenen Feature-Branch — `git checkout -b` nimmt den gemeinsamen Working Tree mit, also committete die andere Session auf den neuen Branch statt auf `main`. Konsequenzen: `git status` zu Sessionbeginn ist eine Momentaufnahme, keine Zusage; vor `git stash`/`checkout`/`reset` pruefen, ob fremde Aenderungen im Baum liegen, und `git stash pop` nicht ungeprueft als erfolgreich annehmen (Exit-Code pruefen, nicht nur `echo`); fremde Commits auf dem eigenen Branch **nicht** herausrebasen — sie existieren sonst nirgends mehr, stattdessen mitnehmen und im PR-Text benennen. Fuer echte Parallelarbeit gehoeren getrennte Worktrees her.

### Obsidian Vault

#### obsidian-vault-direct-path (10/10, 2026-04-16)

Obsidian vault is at `/home/patrick/Vault/` — can write markdown files directly with the Write tool instead of going through MCP `patch_content`. Files are live in Obsidian immediately.

#### obsidian-patch-content-broken (10/10, 2026-04-16)

`obsidian_patch_content` with `target_type=heading` always fails with error 40080 (invalid-target) via Obsidian REST API — even for valid, existing, ASCII headings. Use Write tool directly to `/home/patrick/Vault/` instead. `append_content` works fine for adding to end of files.

### Supabase Setup

#### supabase-pooler-url-location (10/10, 2026-04-16)

Pooler URL is NOT in the main Database > Connection String view. Navigate to Settings > Database > Connection pooling section (scroll down). Region format: `aws-0-[region].pooler.supabase.com`. Username format: `postgres.[ref]` (not just `postgres`).

#### supabase-ci-prefetch-mirrors (9/10, 2026-06-07)

Der lokale/CI-RLS-Smoke braucht nicht den kompletten Supabase-Stack. Wenn `npx supabase start` in GitHub Actions von Docker-Hub-Verfuegbarkeit oder unnoetigen Diensten abhaengt, wird der Gate fragil. Stabilerer Pfad hier: benoetigte Images vorab aus `public.ecr.aws`-Mirrors ziehen/taggen und `supabase start` mit `-x studio -x imgproxy -x edge-runtime -x vector -x supavisor` verschlanken.
*Files:* `.github/workflows/ci.yml`

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
