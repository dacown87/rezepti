# gstack Learnings Export — 2026-05-01

Automatisch exportiert aus gstack-learnings (31 Einträge, Stand 2026-05-01).
Enthält alle Pitfalls, Architektur-Entscheidungen, Operationals und Preferences
die gstack über Sessions hinweg gesammelt hat.

---

## Pitfalls

**`yt-dlp-output-template-id`** *(2026-05-01, confidence 10/10)*
yt-dlp mit Template `foo_%(id)s.%(ext)s` schreibt `foo_<id>.info.json` (nicht `foo_info.json`) und `foo_<id>.description` (nicht `foo_description.txt`). Immer `readdir()` + find-by-extension statt hardcoded Pfade.
→ `src/fetchers/pinterest.ts`

**`ichkoche-microdata-not-jsonld`** *(2026-04-29, confidence 10/10)*
ichkoche.at verwendet HTML Microdata (`itemprop`-Attribute) statt JSON-LD. Unser CSS-Selektor matched den Microdata-Container `[itemtype*=schema.org/Recipe]`, liest ihn aber als Text statt die `itemprop`-Felder zu parsen — strukturierte Daten gehen verloren. Fix: Phase 13b `extractMicrodataRecipe()`.
→ `src/fetchers/web.ts`

**`hardcoded-recipe-urls-404`** *(2026-04-29, confidence 10/10)*
Erfundene Rezept-URLs für Tests ergeben fast immer 404. Echte URLs über DB-Abfrage (`SELECT source_url FROM recipes`) oder Homepage-Scraping (href-Patterns aus Listings) beschaffen. Sitemaps oft leer oder blockiert.
→ `scripts/sample-test.ts`

**`tsx-eval-top-level-await-cjs`** *(2026-04-29, confidence 10/10)*
`npx tsx -e` mit top-level await schlägt fehl ("Top-level await is currently not supported with the cjs output format"). Fix: Code in eine `.ts`-Datei auslagern und `npx tsx scripts/foo.ts` aufrufen.
→ `scripts/get-db-urls.ts`

**`qr-pdf-pixel-density`** *(2026-04-16, confidence 10/10)*
`QRCode.toDataURL` mit `width:80` erzeugt bei einem 2KB-Payload (Rezept-JSON) einen QR-Code Version 20+ mit < 1px pro Modul — weder BarcodeDetector noch jsQR können ihn lesen. Fix: `width:400` + `errorCorrectionLevel:L`. Noch besser: URL statt JSON enkodieren (~30 Zeichen → Version 2, ~15px pro Modul).
→ `mobile/utils/pdf-export.web.ts`, `mobile/utils/pdf-export.native.ts`

**`planner-api-query-param-mismatch`** *(2026-04-16, confidence 10/10)*
Planer-Client sendete `?weekStart=` aber Server liest `c.req.query("week")` — Server ignorierte den Param und berechnete immer die aktuelle Woche. Zusätzlich gibt der Server `{ entries, weekStart }` zurück, aber Client parsete direkt als Array → `entries` immer `[]`. Beide Bugs zusammen: Planer immer leer, Wochennavigation wirkungslos.
→ `mobile/app/(tabs)/planner.tsx`, `src/routes/planner.ts`

**`regex-optional-char-ordering`** *(2026-04-16, confidence 10/10)*
Regex `Personen?` bedeutet `Persone` + optionales `n` — matched `Persone` und `Personen`, aber NICHT `Person` (das `e` ist Pflicht). Für alle Varianten `Person/Persone/Personen` muss es `Persone?n?` heißen. Pattern: bei optionalen Suffixen von innen nach außen arbeiten.
→ `src/fetchers/chefkoch.ts`, `test/unit/chefkoch.test.ts`

**`expo-scrollview-justify-center-web`** *(2026-04-16, confidence 10/10)*
`justifyContent:center` in einem horizontalen React Native ScrollView auf Web clippt den linken Overflow — Inhalt beginnt bei negativem Offset und ist nicht scrollbar. Die rechte Seite ist erreichbar, die ersten N Elemente nicht. Fix: `justifyContent:center` auf Web entfernen oder `flex-start` setzen. Zusätzlich: `showsHorizontalScrollIndicator={Platform.OS==='web'}` für sichtbaren Scrollbar-Hinweis.
→ `mobile/app/(tabs)/planner.tsx`

**`expo-web-assets-gitignored`** *(2026-04-16, confidence 10/10)*
`public/assets/` war gitignored, daher erreichte der Expo-Web-Build-Output (Logo-Hash-Datei) nie das Docker-Production-Image. Dockerfile kopiert `public/` aus dem Git-Kontext — gitignorierte Dateien fehlen lautlos in Prod. Fix: `public/assets/` aus `.gitignore` entfernen und committen.
→ `Dockerfile`, `.gitignore`

**`mobile-branch-not-merged`** *(2026-04-16, confidence 10/10)*
`phase1-remove-local-sqlite` Branch enthielt abgeschlossene Phase-1-Arbeit, wurde aber nie gemergt — saß ungemergt während Phase 2 (Server Supabase) live ging. Immer `git branch -a` und `git log main...branch` prüfen bevor Phase N+1 gestartet wird.

**`supabase-pgbouncer-prepared-statements`** *(2026-04-16, confidence 10/10)*
Transaction Pooler (Port 6543, pgbouncer mode) unterstützt KEINE Prepared Statements. `prepare: false` in postgres-js-Optionen setzen. Direct Connection (Port 5432) unterstützt Prepared Statements, funktioniert aber nicht von Northflank aus.
→ `src/db-react.ts`

**`supabase-direct-url-northflank-dns`** *(2026-04-16, confidence 10/10)*
`db.[ref].supabase.co:5432` (Direct Connection) löst lokal auf, aber `ENOTFOUND` von Northflank. Immer Transaction Pooler (`aws-0-[region].pooler.supabase.com:6543`) für Production-Deployments auf Northflank verwenden.
→ `src/db-react.ts`

**`postgres-js-failed-query-means-connection`** *(2026-04-16, confidence 10/10)*
"Failed query: `<sql>`\nparams: " Format von postgres-js bedeutet immer ein Verbindungsproblem (SSL, Netzwerk), KEIN fehlerhaftes SQL. Wenn params leer und Query trivial ist: zuerst Connection-Optionen prüfen.
→ `src/db-react.ts`

**`supabase-ssl-required-northflank`** *(2026-04-16, confidence 10/10)*
postgres-js ohne `ssl`-Option schlägt auf Northflank mit "Failed query" fehl (kein Query-Fehler — es ist ein Connection-Fehler). Immer `ssl: "require"` für Supabase-Verbindungen setzen. Funktioniert auch lokal.
→ `src/db-react.ts`

**`ytdlp-static-binary-node-slim`** *(2026-04-16, confidence 10/10)*
yt-dlp PyInstaller-Static-Binary von GitHub Releases schlägt auf `node:20-slim` mit Exit 127 fehl — fehlende glibc-Deps. `pip3 install yt-dlp` verwenden. Außerdem: `curl` ohne `--fail` lädt lautlos HTML-Fehlerseiten als Binärdateien herunter.
→ `Dockerfile`

**`ensureSchema-client-exec-api`** *(2026-04-14, confidence 10/10)*
`ensureReactSchema()` nutzt `db.$client.exec()` — das ist better-sqlite3-spezifisch. Nicht auf postgres-js portierbar. Ersetzen durch `drizzle-kit generate` + `migrate` für PostgreSQL.
→ `src/db-react.ts`

**`supabase-job-manager-hidden-sqlite`** *(2026-04-14, confidence 10/10)*
`job-manager.ts` nutzt better-sqlite3 direkt (unabhängig von Drizzle/db-react.ts) — immer alle SQLite-Nutzer prüfen bevor better-sqlite3 aus package.json entfernt wird.
→ `src/job-manager.ts`

**`render-guard-vs-trigger-condition`** *(2026-04-12, confidence 10/10)*
Two-Gate-Pattern: Den Trigger-Zustand zu fixen (was State setzt) reicht nicht wenn es einen separaten Render-Guard gibt (was die Komponente zeigt). Beide müssen zusammen aktualisiert werden. In `extract.tsx` war der Modal-Trigger (Zeile 185) gefixt, aber der Render-Guard (Zeile 379) hatte noch die alte `imageSuggestions.length > 0`-Prüfung.
→ `mobile/app/(tabs)/extract.tsx`

**`chefkoch-api-field-name`** *(2026-04-12, confidence 10/10)*
Chefkoch API v2 gibt `result.recipe.previewImageUrlTemplate` zurück (NICHT `previewImageUrl`). Template enthält `<format>`-Placeholder — z.B. mit `crop-960x720` ersetzen. Stilles `catch(() => [])` hat diesen Bug von Anfang an verborgen.
→ `src/utils/image-search.ts`

**`chefkoch-ts-code-duplication`** *(2026-04-30, confidence 9/10)*
`chefkoch.ts` hatte `extractJsonLdRecipes`, `findRecipeInJsonLd`, `resolveSchemaImage` und `extractImages` komplett aus `web.ts` dupliziert — unbemerkt. Beim nächsten Fetcher immer zuerst prüfen ob Hilfsfunktionen bereits in `web/base.ts` existieren statt neu implementieren.
→ `src/fetchers/chefkoch.ts`, `src/fetchers/web/base.ts`

**`mediatrack-focusmode-advanced-ignored`** *(2026-04-16, confidence 8/10)*
Auf mobilem Chrome wird `focusMode` im `MediaTrackConstraints`-`advanced`-Array lautlos ignoriert. Drei-Stufen-Ansatz: (1) `focusMode` direkt in `getUserMedia`-Constraints übergeben, (2) `applyConstraints({ focusMode: 'continuous' })` als direkten Constraint (nicht in `advanced`) NACH `onloadeddata` aufrufen, (3) `advanced`-Array nur als Fallback. Timing: `applyConstraints` vor `video.play()` schlägt auf manchen Android-Geräten lautlos fehl.
→ `mobile/components/ScannerCamera.web.tsx`

---

## Architectures

**`web-plugin-architecture`** *(2026-04-30, confidence 10/10)*
Neue domain-spezifische Web-Scraper gehören als Plugin in `src/fetchers/web/`: (1) neue Datei `web/[domain].ts` mit `WebScraperPlugin`-Interface implementieren, (2) in `web/index.ts` in `PLUGINS`-Array eintragen. `web.ts` bleibt ein reiner Re-Export — Import-Pfade in Pipeline und Tests bleiben stabil.
→ `src/fetchers/web/base.ts`, `src/fetchers/web/index.ts`

---

## Operationals

**`expo-build-deletes-public-files`** *(2026-04-16, confidence 10/10)*
`npm run build:mobile` (Expo web export) löscht und regeneriert `public/` komplett — auch manuell gepflegte Dateien wie `changelog.json`. Immer sofort nach dem Build `git checkout HEAD -- public/changelog.json` (und alle anderen manuellen `public/`-Dateien) ausführen.
→ `public/changelog.json`

**`obsidian-vault-direct-path`** *(2026-04-16, confidence 10/10)*
Obsidian Vault liegt unter `/home/patrick/Vault/` — Markdown-Dateien direkt mit dem Write-Tool schreiben statt MCP `patch_content` zu nutzen. Dateien sind in Obsidian sofort live.

**`obsidian-patch-content-broken`** *(2026-04-16, confidence 10/10)*
`obsidian_patch_content` mit `target_type=heading` schlägt immer mit Error 40080 (invalid-target) via Obsidian REST API fehl — auch für gültige, existierende, ASCII-Überschriften. Stattdessen Write-Tool direkt auf `/home/patrick/Vault/` verwenden. `append_content` funktioniert für Anhänge ans Dateiende.

**`supabase-pooler-url-location`** *(2026-04-16, confidence 10/10)*
Pooler-URL ist NICHT in der Hauptansicht unter Database > Connection String. Navigation: Settings → Database → Connection pooling (runterscrollen). Regions-Format: `aws-0-[region].pooler.supabase.com`. Username-Format: `postgres.[ref]` (nicht nur `postgres`).

**`sample-test-bot-403-category`** *(2026-04-29, confidence 9/10)*
Bot-Schutz (HTTP 403 von Cloudflare/WAF) bei allrecipes.com, simplyrecipes.com, seriouseats.com ist KEIN Schema-Problem — kein Selektor-Fix hilft. Fehlerkategorie für `toUserFriendlyError()`: "Website erlaubt kein automatisches Abrufen, Freitext-Import verwenden." 16% der getesteten Sites betroffen.
→ `src/pipeline.ts`, `scripts/sample-test-analysis.md`

**`expo-router-params-first-render`** *(2026-04-12, confidence 9/10)*
`useLocalSearchParams()` von Expo Router ist synchron beim ersten Render verfügbar. `useState(param === value)` direkt zur Initialisierung nutzen statt `useEffect`. `useEffect` feuert nach dem Paint und verursacht ein sichtbares Flash (z.B. Scanner-Landingpage sichtbar bevor Kamera öffnet).
→ `mobile/app/(tabs)/scanner.tsx`

**`expo-web-camera-supported`** *(2026-04-10, confidence 9/10)*
expo-camera v17 (Expo SDK 54) liefert `useWebQRScanner` + jsQR für Web via `ExpoCamera.web.js`. `CameraView` mit `barcodeScannerSettings` funktioniert auf Web. `ScannerCamera.web.tsx`-Stub kann durch identischen `CameraView`-Code ersetzt werden.
→ `mobile/components/ScannerCamera.web.tsx`

**`no-plan-file-general-review`** *(2026-04-09, confidence 8/10)*
Wenn `/autoplan` ohne existierende Plan-Datei aufgerufen wird und der User einen allgemeinen Projekt-Review möchte, Plan-Dokument inline in der Plan-Mode-Datei erstellen. `docs/superpowers/plans/` für projektspezifische Pläne verwenden.

---

## Preferences

**`recipedeck-color-system`** *(2026-04-08, confidence 10/10)*
User hat C (warm white `#FFFFFF` + terracotta `#C84B31` Primary + gold `#D4A853` Accent) als Light Mode und B (espresso `#1A0F0A` + Paprika/Safran) als Dark Mode genehmigt. Ersetzt das Purple/Gray AI-Slop-Schema. Logo unter `mobile/public/Logo.png` in der Navigation.
→ `mobile/tailwind.config.js`, `mobile/app/(tabs)/_layout.tsx`
