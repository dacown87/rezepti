# Detailplan: Datenminimierung (Paket DM — D6, D7, D8)

> **Status: Detailplan — wartet auf Freigabe.** Kein Code, bevor der Betreiber die Entscheidungen am Ende bestaetigt hat.

Stand: 2026-10-07. Grobplan: [2026-10-07-grob-datenminimierung.md](2026-10-07-grob-datenminimierung.md). Bezug: [TODO.md](../../../TODO.md) → „Vor dem oeffentlichen Start" (Code-/Textarbeit aus der Rechtsrecherche, „Loeschfrist fuer Fehlerberichte festlegen"); [Vor-Start-Plan](2026-10-07-vor-start-backups-kostenschutz-recht-plan.md) Abschnitt D; [Detailplan Paket R](2026-10-07-paket-r-rechtstexte-detailplan.md) (uebernimmt die Textbausteine). Befunde: [Rechtsrecherche](../../legal/2026-10-impressum-datenschutz-recherche.md) Abschnitte 6, 7, 9.6, 11.3; [Faktencheck](../../legal/faktencheck/verify-3-dsgvo.md) D1–D4, E8, F9.

Rahmen (CLAUDE.md, verbindlich): Production-Migrationen **nur** ueber den Workflow *Apply Supabase Migrations*; jede neue User-ID-Spalte in `private.delete_user_account` **und** `COVERED_USER_COLUMNS` (`scripts/supabase/account-deletion-smoke.ts:130`); Rezeptbilder **max. 250 KB**; keine schweren lokalen Laeufe (Messserien/Backfills nicht auf dem Entwicklerrechner).

## Ueberblick und Reihenfolge

| PR | Inhalt | Abhaengigkeit | Aufwand |
|---|---|---|---|
| **DM-1 = D8** | Fehlerberichte bei Kontoloeschung bereinigen + Loeschfrist (+ abgelaufene Einladungen, siehe DM-1b) | keine (parallel zu D6 moeglich) | M |
| **DM-2 = D6** | EXIF/GPS aus Foto-Uploads entfernen, `sharp` einfuehren | keine | S–M |
| **DM-3 = D7** | Rezeptbilder selbst speichern und ausliefern, Bestandsmigration | D6 (`sharp`, Bildmodul) | L |
| DM-3b | Abschluss D7: CHECK-Constraint, Proxy-Allowlist, Altroute entfernen | Backfill auf Production abgeschlossen | S |

Begruendung: D8 ist reines SQL plus ein kleiner Timer und schliesst die konkreteste Luecke (Text in der Datenschutzerklaerung verspricht heute mehr, als der Code tut). D6 bringt die Bildverarbeitung, die D7 fuer Komprimierung und EXIF-Freiheit aller gespeicherten Bilder braucht.

---

## DM-1 — D8 Fehlerberichte anonymisieren + Loeschfrist

### Ist-Zustand
- `supabase/migrations/20261007120000_account_deletion.sql:68-70`: Kontoloeschung setzt nur `user_id` und `household_id` auf NULL. `metadata_json`, `route`, `description` bleiben unveraendert.
- Client sammelt `mobile/components/BugReportModal.tsx:60-73`: `appVersion`, `platform`, `osVersion`, `viewport`, `timestamp`, `userAgent`, `activeHouseholdId` (zusaetzlicher `fetchAuthMe()`-Call Z. 51-58), plus `...intent.metadata` (Z. 72). `route` als eigene Spalte (Z. 79; `src/schema.ts:248`).
- Bei Import-Fehlern (`mobile/app/(tabs)/extract.tsx:955-965`) landen **auf oberster Ebene** `importMode`, `jobId`, `jobStatus`, `currentStage`, `errorMessage`, `errorHint`, `qualityWarnings` **und** `lastFailureSnapshot` (Z. 171-183: `submittedUrl`, `textHint`, `photoHint`, `jobId`, `errorMessage`, `timestamp` …).
- Server-Whitelist `src/bug-reports.ts:34-55` (`TOP_LEVEL_ALLOWED_KEYS`) erlaubt zusaetzlich `route`, `lastClientError`, `lastApiError`, `sourceType`, `sourceUrl`; `sanitizeFailureSnapshot` Z. 87-107; `sanitizeBugReportMetadata` Z. 161-205. Strings max. 500 Zeichen.
- `household_id` wird schon als Spalte gespeichert → `activeHouseholdId` in `metadata_json` ist redundant.
- Keine Loeschfrist, kein Cleanup. Einziger Timer: `startJobCleanupTimer` (`src/job-manager.ts:239-256`, gestartet `src/index.ts:182`, stuendlich, `unref`).
- Admin-Routen `src/routes/bug-reports.ts:136-241`: nur GET/PATCH, **kein Loeschen** einzelner Berichte (noetig fuer „Text auf Wunsch loeschen", Recherche 11.3 Z. 103-104).
- Smoke: `account-deletion-smoke.ts:122-125` legt einen Bericht **ohne** Metadaten an; Pruefung Z. 251-253 nur auf `user_id`/`household_id` NULL und unveraenderte `description`.

### Loesungsoptionen
| Option | Beschreibung | Bewertung |
|---|---|---|
| A — Whitelist-Anonymisierung (**empfohlen**) | Bei Kontoloeschung `metadata_json` auf unkritische Schluessel reduzieren, `route` NULL, `anonymised_at` setzen; `description` bleibt | erhaelt den Nutzen fuer die Fehleranalyse, klar beschreibbar, testbar |
| B — Blacklist | nur `activeHouseholdId`, `userAgent`, `submittedUrl` … entfernen | bricht bei jedem neuen Metadatenfeld still; abgelehnt |
| C — Berichte bei Kontoloeschung ganz loeschen | `DELETE` statt `UPDATE` | maximal datensparsam und einfachster DSE-Satz, aber Widerspruch zur Entscheidung in Migration `20261007120000` (Berichte bleiben); Betreiber-Entscheidung 2 |

Whitelist (Vorschlag): `appVersion`, `platform`, `importMode`, `jobStatus`, `currentStage`, `errorHint`, `qualityWarnings`, aus dem Snapshot nur `mode`. **Entfernt** werden u. a. `activeHouseholdId`, `userAgent`, `osVersion`, `viewport`, `timestamp`, `route`, `sourceUrl`, `sourceType`, `jobId`, `errorMessage` (kann URLs enthalten), `lastClientError`, `lastApiError` und der Rest von `lastFailureSnapshot` (`submittedUrl`, `textHint`, `photoHint`, `jobId`, `errorMessage`, `timestamp`).

Loeschfrist umsetzen:
| Option | Bewertung |
|---|---|
| App-Timer wie `startJobCleanupTimer` (**empfohlen**) | keine Extension, mit Fake-Timern testbar, laeuft im ohnehin dauerhaft laufenden Northflank-Dienst; mehrere Instanzen sind unkritisch (idempotentes DELETE) |
| `pg_cron` in Supabase | unabhaengig von der App, aber neue Extension in Prod **und** in der lokalen CI-Supabase; mehr Betriebsflaeche |
| Northflank-Cron-Job | eigenes Image/Job nur fuer ein DELETE; Overkill |

### Schritte
1. **Migration `supabase/migrations/20261008090000_bug_reports_anonymise_and_retention.sql`** (Schema `YYYYMMDDHHMMSS_name.sql`, Zeitstempel nach `20261007120000`):
   - `ALTER TABLE public.bug_reports ADD COLUMN IF NOT EXISTS anonymised_at timestamptz NULL;`
   - `CREATE OR REPLACE FUNCTION private.anonymise_bug_report_metadata(m jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = pg_catalog, pg_temp` → `jsonb_strip_nulls(jsonb_build_object('appVersion', m->'appVersion', 'platform', m->'platform', 'importMode', m->'importMode', 'jobStatus', m->'jobStatus', 'currentStage', m->'currentStage', 'errorHint', m->'errorHint', 'qualityWarnings', m->'qualityWarnings', 'snapshotMode', m->'lastFailureSnapshot'->'mode'))`. `REVOKE ALL … FROM PUBLIC, anon, authenticated`.
   - `CREATE OR REPLACE FUNCTION private.delete_user_account(uuid)`: **gesamte** Funktion neu, Bug-Report-Block wird zu `SET user_id = NULL, household_id = NULL, route = NULL, metadata_json = private.anonymise_bug_report_metadata(metadata_json), anonymised_at = now(), updated_at = now()`. `SECURITY DEFINER` und `SET search_path = public, pg_temp` **beibehalten** (Lehre aus `20260927140000`: CREATE OR REPLACE ohne SET setzt `proconfig` zurueck). `REVOKE` erneut.
   - Einmalige Nachbereinigung der seit PR #74 schon anonymisierten Berichte: `UPDATE public.bug_reports SET … WHERE user_id IS NULL AND anonymised_at IS NULL;` (heute ist `user_id IS NULL` nur durch Kontoloeschung moeglich, `user_id` war bis `20261007120000` NOT NULL).
2. **`src/schema.ts:241-263`**: `anonymisedAt: timestamp("anonymised_at", { withTimezone: true })`.
3. **Erhebung minimieren** (Datensparsamkeit bei der Erfassung):
   - `BugReportModal.tsx`: `activeHouseholdId` und den `fetchAuthMe()`-Aufruf entfernen (Server kennt den Haushalt aus dem Auth-Kontext).
   - `src/bug-reports.ts`: `activeHouseholdId` aus `TOP_LEVEL_ALLOWED_KEYS` entfernen. Der Enum-Contract-Test (`test/unit/bug-report-enums-contract.test.ts`) ist nicht betroffen (nur Enums).
4. **Loeschfrist**: neues Modul `src/bug-report-retention.ts` mit `purgeExpiredBugReports(months)` (`DELETE FROM bug_reports WHERE created_at < now() - make_interval(months => $1)`, liefert Anzahl) und `startBugReportRetentionTimer(months, intervalMs)` (Muster `startJobCleanupTimer`: try/catch, Log `[bug-reports] retention removed N`, `unref`). Erster Lauf ca. 5 min nach Start, dann alle 24 h. Config `BUG_REPORT_RETENTION_MONTHS` (Default = Betreiber-Entscheidung 1, Vorschlag 12) in `src/config.ts`. Start in `src/index.ts` neben Z. 182.
5. **Admin-Loeschung**: `DELETE /api/v1/admin/bug-reports/:id` in `src/routes/bug-reports.ts` (gleicher Admin-Gate wie PATCH, `403 admin_required`), Funktion `deleteBugReport(id)` in `src/db-react.ts`. Button in `mobile/app/admin/bug-reports.tsx` (mit Bestaetigung). Damit ist „Text auf Wunsch loeschen" umsetzbar.
6. Admin-Detailansicht: bei `anonymisedAt` Hinweis „anonymisiert am …" statt Nutzerbezug.
7. **Tests**
   - `scripts/supabase/account-deletion-smoke.ts`: Seed-Bericht mit vollem `metadata_json` (alle oben genannten Schluessel inkl. `lastFailureSnapshot.submittedUrl`) und `route`; nach Loeschung pruefen: nur Whitelist-Schluessel vorhanden, `route IS NULL`, `anonymised_at IS NOT NULL`, `description` unveraendert. Bericht von User B unveraendert (bestehender Snapshot-Vergleich). `COVERED_USER_COLUMNS` bleibt unveraendert (keine neue User-ID-Spalte).
   - `test/unit/bug-report-retention.test.ts`: Timer mit Fake-Timern (Intervall, Fehler wird geloggt statt geworfen, `unref`), SQL-Parameter.
   - `test/unit/bug-reports-routes.test.ts`: `activeHouseholdId` wird verworfen; Admin-DELETE: 403 fuer Nicht-Admin, 204/200 fuer Admin, 404 fuer unbekannte ID.
   - Mobile: BugReportModal-Test (falls vorhanden) — kein `activeHouseholdId`, kein `fetchAuthMe`-Call. `npm run test:mobile:rntl-guard` beachten.
   - CI-Job `supabase-rls-smoke` faehrt Migration und Smoke automatisch (lokale Supabase); lokal nur gezielte Unit-Tests, keine Vollsuite.

### DM-1b — Abgelaufene Rezept-Einladungen loeschen (Ergaenzung aus Paket R, Entscheidung R-E15)
Befund aus dem [Detailplan R](2026-10-07-paket-r-rechtstexte-detailplan.md): `src/db-react.ts:1396` leitet den Ablauf einer Einladung nur als Status ab; abgelaufene Einladungen (inkl. Empfaenger-E-Mail) werden offenbar nie geloescht. **Noch auszuarbeiten** (vor der Umsetzung im Code bestaetigen), Vorschlag: im selben Retention-Timer abgelaufene und angenommene Einladungen nach einer kurzen Frist (z. B. 30 Tage nach Ablauf bzw. Annahme) loeschen; Unit-Test; Frist an Paket R fuer den Datenschutztext (Brevo/Einladungen, Z. 76-78) melden.

### Akzeptanzkriterien
- Nach `private.delete_user_account` enthaelt kein Bericht des Nutzers mehr `activeHouseholdId`, `userAgent`, `submittedUrl`, `errorMessage`, `jobId`, `route`; `anonymised_at` ist gesetzt (Smoke gruen in CI).
- Bereits frueher anonymisierte Berichte in Production sind nach dem Migrationslauf bereinigt (Pruef-SQL: `select count(*) from bug_reports where user_id is null and (metadata_json ? 'userAgent' or route is not null)` = 0).
- Berichte aelter als die Frist verschwinden spaetestens 24 h nach Fristablauf (Log-Zeile im Northflank-Log).
- Admin kann einen einzelnen Bericht loeschen.

### Risiken
- `CREATE OR REPLACE` der Loeschfunktion: Kopierfehler im Funktionsrumpf → Smoke deckt alle Tabellen ab; zusaetzlich Diff gegen `20261007120000` im Review.
- Laufzeit-Retention loescht auch offene, ungeloeste Berichte nach 12 Monaten — gewollt (harte Obergrenze, einfach zu beschreiben).
- Kein Rollback der Anonymisierung (bewusst irreversibel).

### Doku-Nachzug
- CLAUDE.md: Endpunkt-Tabelle (`DELETE /api/v1/admin/bug-reports/:id`), Ownership-Tabelle (`bug_reports`: Retention N Monate, Anonymisierung), Hinweis bei `auth/account DELETE` („bug_reports: Whitelist-Anonymisierung ueber `private.anonymise_bug_report_metadata`").
- `docs/CODEMAPS/BACKEND.md` Endpunktliste.
- TODO.md: Punkt „Loeschfrist fuer Fehlerberichte festlegen" mit gewaehlter Frist abhaken.
- **Hinweis fuer Paket R** (`mobile/app/datenschutz.tsx` Z. 34-40 und 103-104, Recherche 11.3): „Fehlerberichte enthalten neben deinem Text technische Angaben (App-Version, Betriebssystem, Browserkennung, Bildschirmgroesse, aufgerufene Seite, Zeitpunkt; bei Import-Fehlern die importierte Adresse, Fehlermeldung und Auftragsnummer). Rechtsgrundlage Art. 6 Abs. 1 lit. f DSGVO. Loeschst du dein Konto, entfernen wir die Verknuepfung mit dir sowie alle technischen Angaben ausser App-Version und Plattform; dein Text bleibt erhalten. Fehlerberichte loeschen wir spaetestens [12] Monate nach Eingang, auf Wunsch auch frueher." **Kein Anonymitaetsversprechen** (Freitext bleibt pseudonym).

### Aufwand: **M**

---

## DM-2 — D6 EXIF/GPS aus Foto-Uploads entfernen

### Ist-Zustand
- `src/routes/extraction.ts:265-324` `POST /api/v1/extract/photo`: Typpruefung nur ueber `file.type` (Z. 274-277), max. 10 MB (Z. 279-282), dann `Buffer → Base64 → data:`-URL **unveraendert** (Z. 296-298), Ablage in `photoDataStore` (Z. 17, 304).
- `processPhotoJobInBackground` (Z. 326-374): Original geht an Groq (`extractRecipeFromImage`, Z. 342 → `src/processors/llm.ts:152-182`, `image_url: { url: dataUrl }`); ohne Chefkoch-Treffer wird das **Original inkl. EXIF** als Rezeptbild gespeichert, wenn < 500 000 Zeichen (Z. 350-352). Das Ergebnis `recipe: recipeData` mit dieser data:-URL liegt bis 7 Tage im Job-Speicher und geht ueber die Poll-Antwort zurueck (Z. 362).
- Job-URL enthaelt den Dateinamen: `photo://${file.name}` (Z. 302-303) — Dateinamen wie `IMG_20261007_Ort.jpg` sind personenbezogen.
- Client: `mobile/utils/image-compress.ts:8` gibt auf Web die Original-URI zurueck (EXIF bleibt sicher); nativ Neukodierung erst > 256 KB (Z. 14-16).
- Keine Bildbibliothek im Projekt (`package.json` dependencies: kein `sharp`/`jimp`; nur transitive `buffer-image-size`, `image-ssim`). Docker-Basis `node:24.15.0-slim` (Debian/glibc, amd64) — `sharp`-Prebuilds passen.
- Nebenbefund: Groq akzeptiert Base64-Bilder laut Doku nur bis 4 MB Request-Groesse (vor Umsetzung gegenpruefen). Uploads bis 10 MB scheitern dort heute vermutlich; die Normalisierung behebt das mit.

### Loesungsoptionen
| Option | Bewertung |
|---|---|
| **`sharp` (libvips) — empfohlen** | entfernt Metadaten beim Neukodieren standardmaessig, dreht nach EXIF-Orientation (`.rotate()`), verkleinert, prueft das echte Format (Magic Bytes statt `file.type`), `limitInputPixels` gegen Dekompressionsbomben. Wird fuer D7 (250-KB-Komprimierung) ohnehin gebraucht. Image waechst um ca. 20–30 MB (entpackt), gemessen am Image mit ffmpeg/python vernachlaessigbar |
| Reiner JS-EXIF-Stripper (Segmente APP1/eXIf/XMP entfernen, ohne Neukodierung) | leicht, keine native Abhaengigkeit; aber keine Groessenreduktion, Formatsonderfaelle (WebP-RIFF, PNG-Chunks) selbst pflegen, Orientation geht verloren; fuer D7 nutzlos |
| ffmpeg-CLI (schon im Image) | laut CLAUDE.md **optional** (lokal oft nicht vorhanden), Prozess-Spawn pro Bild; abgelehnt |
| Nur clientseitig (Canvas-Neukodierung im Web) | nicht verlaesslich (manipulierte Clients, native ≤ 256 KB); hoechstens spaeter als Bandbreiten-Optimierung |

### Schritte
1. `npm install sharp` (Root-`package.json` dependencies; Lockfile auf Linux erzeugen, damit `@img/sharp-linux-x64` + `@img/sharp-libvips-linux-x64` drin sind). Keine Dockerfile-Aenderung noetig; im PR das CI-Docker-Build-Log auf erfolgreichen `npm ci --omit=dev` pruefen. `knip` (`lint:dead:ci`) muss die neue Dependency als genutzt sehen.
2. Neues Modul **`src/utils/image-processing.ts`**:
   - Modul-Init: `sharp.cache(false)`, `sharp.concurrency(1)` (kleine Northflank-Instanz, Speicher).
   - `inspectImage(buf)` → Format aus `sharp(buf).metadata()`; nur `jpeg|png|webp` zulassen, sonst `UnsupportedImageError`.
   - `normalizeForVision(buf)` → `sharp(buf, { limitInputPixels: 40_000_000, failOn: "error" }).rotate().resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 85, mozjpeg: true })`; falls > 3 MB: Qualitaet/Kantenlaenge schrittweise senken. Ergebnis ohne jegliche Metadaten (kein `.withMetadata()`/`.keepMetadata()`).
   - `toStoredRecipeImage(buf)` → max. 1024 px Kante, JPEG (mozjpeg, progressiv), Startqualitaet 75, Schleife bis ≤ 250 000 Bytes (Qualitaet bis 50, dann 800 px); liefert `{ bytes, mime: "image/jpeg", width, height }`. (Wird in D6 fuer den Foto-Fallback genutzt, in D7 fuer alle Bilder.)
   - JPEG statt WebP: der PDF-Export uebergibt Bilder fest als `'JPEG'` an jsPDF (`mobile/utils/pdf-export.web.ts:52`), jsPDF kann kein WebP. WebP spart ca. 25–35 %, braeuchte aber eine Exportanpassung — bewusst nicht in diesem Paket.
3. **`src/routes/extraction.ts`**:
   - Nach der Groessenpruefung: Buffer lesen → `normalizeForVision` (bei `UnsupportedImageError`/Dekodierfehler: `400 "Bild konnte nicht gelesen werden"`); `dataUrl` aus dem bereinigten JPEG bauen. Die `allowedTypes`-Pruefung bleibt als Schnellfilter.
   - Job-URL fest `photo://upload` (kein Dateiname).
   - Fallback-Rezeptbild (Z. 350-352): statt der Original-data:-URL `toStoredRecipeImage(...)` → data:-URL (≤ 250 KB). In D7 wird daraus der Speicherpfad.
   - `completeJob` (Z. 362): `recipe.imageUrl` im Job-Ergebnis nicht mehr als data:-URL mitschicken (Client laedt das Rezept ohnehin per ID nach, `extract.tsx:289-294`).
4. **Tests** (gezielt, keine Vollsuite lokal):
   - `test/unit/image-processing.test.ts`: Fixture `test/fixtures/images/exif-gps.jpg` (klein, < 30 KB, mit GPS- und Kamera-EXIF, Orientation 6). Erwartung: `sharp(out).metadata()` ohne `exif`, `xmp`, `iptc`; Rohbytes ohne `Exif\0\0`; Breite/Hoehe nach Orientation getauscht; PNG mit Transparenz → weisser Hintergrund; Pixelbombe (> 40 MP) → Fehler; Nicht-Bild mit `image/jpeg`-Header → Fehler; `toStoredRecipeImage` ≤ 250 000 Bytes fuer ein grosses Rauschbild.
   - `test/unit/photo-extraction.test.ts` erweitern: die an `extractRecipeFromImage` uebergebene data:-URL enthaelt kein EXIF; Job-URL ist `photo://upload`; Fallback-Bild ≤ 250 KB.
5. Kein Mobile-Code noetig. Optional (nicht in diesem PR): Web-Upload vor dem Senden per Canvas verkleinern (spart Bandbreite).

### Akzeptanzkriterien
- Ein Upload mit GPS-EXIF erreicht Groq und den Speicher nachweislich ohne EXIF/XMP/IPTC (Unit-Test + einmal manuell auf Staging: Rezeptbild herunterladen, `exiftool` zeigt keine GPS-Daten).
- Hochkant fotografierte Rezeptkarten werden korrekt gedreht erkannt (Orientation angewendet).
- Uploads zwischen 4 und 10 MB scheitern nicht mehr an der Groq-Groessengrenze.
- Docker-Image baut in CI, `/api/v1/health` gruen nach Deploy.

### Risiken
- Native Abhaengigkeit: Lockfile ohne Linux-Binaries (z. B. auf macOS erzeugt) → Laufzeitfehler im Container. Gegenmassnahme: Lockfile auf Linux erzeugen, Docker-Build in CI ist Gate.
- Speicherspitzen bei grossen Bildern auf kleiner Instanz → `concurrency(1)`, `cache(false)`, Pixel-Limit; Concurrency-Limit der Jobs (3 pro Nutzer, 6 global) begrenzt zusaetzlich.
- Leicht geringere OCR-Qualitaet durch 2048-px-Grenze → bei Rezeptkarten unkritisch; Grenze als Konstante, bei Bedarf anheben.
- HEIC: `sharp`-Prebuilds dekodieren kein HEIC; heute ohnehin nicht erlaubt (Safari liefert beim Datei-Upload JPEG).

### Doku-Nachzug
- CLAUDE.md: „Key files" um `src/utils/image-processing.ts`; Hinweis bei Docker/Host-Abhaengigkeiten: `sharp` (Prebuild, glibc, kein apt-Paket noetig); Pipeline-Abschnitt „Vision": Uploads werden vor Groq normalisiert (EXIF entfernt, max. 2048 px).
- **Hinweis fuer Paket R** (datenschutz.tsx Z. 55-56): „Bevor wir ein Foto an Groq uebermitteln oder als Rezeptbild speichern, entfernen wir Standort- und Kameradaten (EXIF) und verkleinern das Bild." Erst nach Deploy von DM-2 in die Erklaerung uebernehmen.

### Aufwand: **S–M** (Code klein; Aufwand steckt in Fixture, Docker-Verifikation, Groq-Gegenprobe)

---

## DM-3 — D7 Keine Hotlinks auf Fremdbilder

### Ist-Zustand
- Schema: `recipes.image_url text` (`src/schema.ts:9`; `supabase/migrations/20260605120000_recipes_ownership_core.sql:17`). Inhalt: Fremd-URL **oder** data:-URL (Foto-Fallback).
- Herkunft der Fremd-URLs: schema.org (`src/processors/schema-org.ts:199`), `og:image` (Facebook `src/fetchers/facebook.ts:234`, Instagram `src/fetchers/instagram.ts:129-192`, Pinterest `src/fetchers/pinterest.ts:191-198`), Cookidoo (`src/fetchers/cookidoo.ts:501-508`), Vision-/Carousel-Pfad (`src/processors/llm.ts:177, 208, 235`), Chefkoch-Bildvorschlaege (`src/utils/image-search.ts`, `crop-960x720`).
- Schreibpfade: `saveRecipeToReactDb` (`src/db-react.ts:165-208`, `image_url: recipe.imageUrl` Z. 184) aus Pipeline (`src/pipeline.ts:181`), Foto (`extraction.ts:358`), Text (`extraction.ts:451`), `POST /api/v1/recipes` (`src/routes/recipes.ts:164`); `PATCH /api/v1/recipes/:id` uebernimmt **beliebige** `imageUrl`-Strings ungeprueft (`recipes.ts:173-188` → `db-react.ts:414`); Kopien (`copyVisibleRecipeToOwner`, `db-react.ts:1280ff.`, `image_url: original.image_url` Z. 1309) bei Haushalt-Teilen, In-Privat-Kopieren und angenommenen Einladungen.
- Auslieferung: Liste/Sammlung schreiben nur data:-URLs auf `/api/v1/recipes/:id/image` um, Fremd-URLs gehen unveraendert raus (`db-react.ts:276-278`, `deserializeListItem`). **Detailansicht liefert die data:-URL komplett im JSON** (`deserialize`, `db-react.ts:1568-1572`) — grosse Antworten, die auch im SW-Cache und in der TanStack-Persistenz landen.
- `GET /api/v1/recipes/:id/image` (`recipes.ts:104-129`) verlangt `requireUserAuth` (Bearer-Header). `<Image source={{ uri }}>` sendet keinen Authorization-Header, der Service Worker ergaenzt keinen (`mobile/sw/recipe-cache-handler.ts:52-66`) → **Listen-Vorschaubilder von Foto-Rezepten laden vermutlich nicht (401)**; nativ ist die relative URL ausserdem nicht aufloesbar. Beim Umsetzen auf Staging verifizieren.
- Darstellung: `mobile/app/(tabs)/index.tsx:86,141`, `mobile/app/recipe/[id].tsx:719-720`, `mobile/app/collection/[id].tsx:168`, `mobile/app/(tabs)/extract.tsx:592`; **Bildvorschlaege** in `mobile/components/ImagePickerModal.tsx:142` laden ebenfalls direkt von Chefkoch (weiterer Hotlink, in der Recherche nicht genannt).
- Proxy `GET /api/v1/proxy/image` (`src/routes/platforms.ts:147-202`): ohne Auth, nur fuer PDF-Export (`mobile/utils/pdf-export.web.ts:15-31`). SSRF-Guard prueft nur den **Hostnamen-String** per Regex: keine DNS-Aufloesung (Hostnamen, die auf private IPs zeigen), keine IPv4-Sonderformen/IPv4-mapped-IPv6/`100.64.0.0/10`/`0.0.0.0`, und `fetch` folgt **Weiterleitungen ungeprueft** (`https://` gilt nur fuer die erste URL; eine Weiterleitung auf `http://169.254.169.254/` wuerde befolgt). Groessenpruefung erst nach vollstaendigem Download (Z. 192-195).
- Nativer PDF-Export bettet `image_url` direkt als `<img src>` ein (`mobile/utils/pdf-export.native.ts:237-238`).
- Kein CDN davor (alle Cloudflare-Records `proxied: false`, `docs/domain-mail-infra-runbook.md:53`). Supabase **Free** (500 MB DB, 5 GB Egress/Monat; Vor-Start-Plan Z. 3).

### Loesungsoptionen
**Grundansatz**
| Option | Bewertung |
|---|---|
| **Beim Import herunterladen, verkleinern, selbst speichern und ausliefern — empfohlen** | Nutzer-IP geht nie an Dritte; behebt nebenbei tote Bilder (Instagram-/Facebook-CDN-URLs laufen ab); 250-KB-Regel durchsetzbar; Bilder werden mit dem Rezept/Konto geloescht; Fremdserver wird nur einmal kontaktiert |
| Alle Bilder bei jeder Anzeige ueber `/proxy/image` | kein Speicher, aber: jede Anzeige trifft die Fremdseite (Last, Latenz), abgelaufene CDN-URLs bleiben tot, offener Proxy ohne Auth (Bandbreitenmissbrauch), SSRF-Flaeche bei jedem Aufruf, keine Groessenkontrolle ohne Verarbeitung pro Aufruf |
| Nichts aendern, in der DSE offenlegen | rechtlich angreifbar (LG Muenchen I 3 O 17493/20, umstritten), schlechter Eindruck; nur Notloesung |

**Speicherort** (Betreiber-Entscheidung 3)
| Option | Vorteile | Nachteile |
|---|---|---|
| **DB-Tabelle `private.recipe_images` (bytea) — empfohlen fuer den Start** | Loeschung atomar per FK-Kaskade (Art. 17 ohne Zusatzcode, im Smoke pruefbar); in den Backups enthalten und mit 35-Tage-Rotation weg; kein neuer Dienstleister, keine neuen Secrets; lokal/CI ohne Zusatzinfrastruktur | zaehlt gegen 500 MB Free-DB-Limit und 5 GB Egress; Bilder durch Node ausgeliefert |
| Cloudflare R2 (EU-Jurisdiktion) | 10 GB frei, Egress kostenlos; Cloudflare ist fuer Backups ohnehin geplanter Auftragsverarbeiter | Loeschung ausserhalb der DB-Transaktion (Outbox/Trigger + Worker oder GC noetig), S3-Signatur-Client, Secrets, lokale Ersatzimplementierung fuer Dev/CI |
| Supabase Storage | gleiche Plattform | nur 1 GB frei, teilt Egress; Loeschung von `storage.objects` nicht per SQL in der Loeschfunktion vorgesehen → API-Aufrufe ausserhalb der Transaktion; keine Vorteile gegenueber R2 |

Empfehlung: DB-Variante hinter einer kleinen Schnittstelle (`RecipeImageStore` mit `put/get/delete/copy`), damit ein spaeterer Wechsel zu R2 nur die Implementierung tauscht. **Schwelle**: bei mehr als ca. 200 MB Bilddaten oder mehr als 350 MB DB-Groesse auf R2 umziehen (Abfrage taeglich im Retention-Timer aus DM-1 loggen). Grobe Rechnung: 1024-px-JPEG ca. 80–140 KB, also 200 MB ≈ 1 500–2 500 Bilder. Vor der Entscheidung die Bestandsmessung (Schritt B1) ausfuehren.

**Auslieferung** (Betreiber-Entscheidung 7)
| Option | Bewertung |
|---|---|
| **Nicht erratbare Token-URL ohne Auth — empfohlen** (`/api/v1/recipe-images/<uuid>`) | funktioniert mit `<Image>`, `<img>`, PDF-Export, nativ; 122 Bit Zufall; Token aendert sich bei jedem Bildwechsel → `immutable`-Caching moeglich. Bild ist nur fuer Personen abrufbar, die die URL kennen (wie die Rezeptdaten selbst) |
| Bearer-Auth wie heute | geht mit `<Image>` nicht (siehe Ist-Zustand); braeuchte Blob-Fetch im Client fuer jedes Bild |
| Signierte, ablaufende URLs (HMAC) | zerstoert SW-/Browser-Cache und Offline-Ansicht, mehr Code; kein echter Mehrwert fuer Rezeptfotos |

### Datenmodell
- Tabelle **`private.recipe_images`** (Schema `private` ist nicht ueber die Data API erreichbar; der Server verbindet sich als `postgres`): `token uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `recipe_id integer NOT NULL UNIQUE REFERENCES public.recipes(id) ON DELETE CASCADE`, `mime text NOT NULL CHECK (mime = 'image/jpeg')`, `bytes bytea NOT NULL CHECK (octet_length(bytes) <= 256000)`, `width int`, `height int`, `origin text NOT NULL CHECK (origin IN ('import','upload','suggestion','backfill','copy'))`, `created_at timestamptz NOT NULL DEFAULT now()`.
- `recipes.image_url` enthaelt danach nur noch `NULL` oder `/api/v1/recipe-images/<token>`. Die Original-URL wird **nicht** aufbewahrt (Datensparsamkeit; die Quelle steht in `source_url`).
- Keine User-ID-Spalte → `COVERED_USER_COLUMNS` unveraendert; Loeschung laeuft ueber Rezept → Kaskade. Private Rezepte kaskadieren ueber `auth.users`, Haushaltsrezepte ueber `households` (siehe Loeschfunktion), `recipe_images` haengt an beiden mit.
- Kopien (`copyVisibleRecipeToOwner`) bekommen eine **eigene** Bildzeile mit neuem Token (≤ 250 KB Duplikat, dafuer keine Referenzzaehlung und keine Waisen).

### Schritte
**A. Infrastruktur und neue Bilder (PR DM-3)**
1. **Migration `supabase/migrations/20261009090000_recipe_images.sql`**: Tabelle wie oben, `REVOKE ALL ON private.recipe_images FROM PUBLIC, anon, authenticated`. Kommentar wie bei `20261007120000` (warum `private`, warum Kaskade).
2. `src/schema.ts`: `export const privateSchema = pgSchema("private"); export const recipeImages = privateSchema.table("recipe_images", …)`.
3. **`src/utils/safe-fetch-image.ts`** (gemeinsam fuer Import, PATCH, Backfill und Proxy):
   - nur `http:`/`https:`; Hostname per `dns.promises.lookup(host, { all: true })` aufloesen und **jede** Adresse gegen private/Loopback/Link-local/CGNAT (`100.64/10`)/`0.0.0.0/8`/Multicast/IPv6-ULA/Link-local/IPv4-mapped pruefen (Hilfsfunktion `isPublicAddress`).
   - `redirect: "manual"`, max. 3 Hops, jede Zieladresse erneut pruefen.
   - Timeout 8 s, Body als Stream mit Abbruch bei 10 MB, Content-Type-Allowlist (jpeg/png/webp/gif/avif), danach `inspectImage` (echtes Format).
   - Optionale Haertung gegen DNS-Rebinding (TOCTOU): undici-`Agent` mit eigenem `lookup`; im PR bewerten, nicht zwingend.
   - Eigener User-Agent `RecipeDeck-ImageFetcher (+https://recipedeckapp.de)`.
4. **`src/recipe-images.ts`** (Store + Ingest):
   - `ingestImageSource(src)`: `https?://` → `safeFetchImage` → `toStoredRecipeImage`; `data:image/...` → dekodieren → `toStoredRecipeImage` (entfernt EXIF aus jeder data:-URL, auch aus POST/PATCH); interner Pfad `/api/v1/recipe-images/<token>` → vorhandenes Bild kopieren (nur wenn das zugehoerige Rezept fuer den Aufrufer sichtbar ist); alles andere → `null`.
   - Fehler sind nie fatal fuer den Import: Bild faellt weg, Rezept wird gespeichert; Log nur mit Host und Fehlerklasse, ohne volle URL.
   - `putImage(tx, recipeId, img, origin)` → `INSERT … ON CONFLICT (recipe_id) DO UPDATE SET token = gen_random_uuid(), …` und `UPDATE recipes SET image_url = '/api/v1/recipe-images/' || token` in **derselben Transaktion**.
   - `copyImage(tx, fromRecipeId, toRecipeId)`, `deleteImage(tx, recipeId)`, `getImageByToken(token)`.
5. **`src/db-react.ts`**:
   - `saveRecipeToReactDb` (Z. 165): vor der Transaktion `ingestImageSource(recipe.imageUrl)` (Netz/CPU ausserhalb der Transaktion), dann Rezept-INSERT + `putImage` in einer Transaktion. Damit sind Pipeline, Foto, Text und `POST /recipes` abgedeckt, ohne dass ein Aufrufer es vergessen kann.
   - `updateRecipeInReactDb` (Z. 406, Feld `imageUrl` Z. 414): `imageUrl` nicht mehr roh schreiben; `null`/`""` → `deleteImage`; sonst `ingestImageSource` → `putImage`; unbrauchbar → Fehler `invalid_image` (Route antwortet 422). Rueckgabe enthaelt die neue `imageUrl`.
   - `copyVisibleRecipeToOwner` (Z. 1280, `image_url` Z. 1309): Kopie zuerst mit `image_url: null`, dann `copyImage(dbClient, original.id, copy.id)` im selben `dbClient`.
   - `deserializeListItem` (Z. 264-285) und `deserialize` (Z. 1568): Uebergangslogik — data:-URL → `/api/v1/recipes/:id/image` (Altroute, bis Backfill fertig), interner Pfad unveraendert, **Fremd-URL → `null`** (kein Hotlink mehr ab Deploy, auch fuer noch nicht migrierte Rezepte; Bild erscheint nach dem Backfill wieder). Detail liefert keine data:-URL mehr inline.
6. **Routen**:
   - Neu `GET /api/v1/recipe-images/:token` (eigene Datei `src/routes/recipe-images.ts`, in `src/api-react.ts` mounten): UUID-Format pruefen, sonst 404; Antwort `Content-Type: image/jpeg`, `Cache-Control: private, max-age=31536000, immutable`, `ETag: "<token>"`, `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'; sandbox`, `Cross-Origin-Resource-Policy: same-site`. 404 ohne Hinweis, ob das Token je existierte.
   - Kleiner In-Process-LRU-Cache (z. B. 32 MB, TTL 1 h, Eintrag beim Loeschen/Ersetzen verwerfen), um Supabase-Egress zu sparen.
   - `PATCH /api/v1/recipes/:id`: Antwort `{ success: true, imageUrl }`; 422 bei unbrauchbarem Bild.
   - `GET /api/v1/proxy/image` (`platforms.ts:147`): auf `safeFetchImage` umstellen (behebt Redirect-/DNS-Luecke), Groessenpruefung per Stream. Host-Allowlist folgt in DM-3b (bis dahin braucht der PDF-Export noch beliebige Alt-URLs — die aber ab Schritt 5 gar nicht mehr ausgeliefert werden; Allowlist kann deshalb ggf. schon hier rein, im PR entscheiden).
   - `src/middleware/request-logger.ts:14-16`: `[/^\/api\/v1\/recipe-images\/[^/]+/, "/api/v1/recipe-images/:token"]` in `SECRET_SEGMENT_PATTERNS` (Token ist eine Berechtigung); Log-Flut ggf. per `SKIPPED_PATHS`-Praefix fuer erfolgreiche Bild-GETs vermeiden.
7. **Mobile**:
   - Neuer Helper `mobile/utils/image-uri.ts`: `resolveImageUri(url)` (relative `/api/…` → absolute Server-URL fuer nativ; Web unveraendert) und `previewImageUri(url)` (Fremd-URL → `${serverUrl}/api/v1/proxy/image?url=…`).
   - Alle Darstellungsstellen auf `resolveImageUri` umstellen: `(tabs)/index.tsx:86,141`, `recipe/[id].tsx:720`, `collection/[id].tsx:168`, `(tabs)/extract.tsx:592`.
   - `ImagePickerModal.tsx:142`: Vorschlaege ueber `previewImageUri` anzeigen; an `onSelect` weiterhin die Original-URL geben (der Server laedt sie).
   - `recipe/[id].tsx:662-663`: nach PATCH die `imageUrl` aus der Antwort setzen statt der gewaehlten Fremd-URL.
   - PDF-Export: `pdf-export.web.ts:15-31` — interne Pfade direkt same-origin laden, nur Fremd-URLs ueber den Proxy; `pdf-export.native.ts:237-238` → `resolveImageUri`.
   - `mobile/sw/cache-names.ts:104-111` (`isCacheableRecipeRequest`): Kommentar/Regex anpassen. Bild-Requests tragen keinen User-Hash-Header und laufen daher network-only (Browser-HTTP-Cache greift dank `immutable`). Offline-Bilder per eigenem Cache sind ein optionaler Folgeschritt (muss beim Logout geleert werden).
8. **Tests**
   - `test/unit/safe-fetch-image.test.ts`: private IPs, Hostname → privat aufgeloest (gemockter `lookup`), Redirect auf privat, Redirect-Limit, Groessenabbruch, falscher Content-Type, SVG abgelehnt.
   - `test/unit/recipe-images.test.ts`: Ingest Fremd-URL (gemockter Fetch) → ≤ 250 KB JPEG ohne EXIF; data:-URL mit EXIF → ohne EXIF; fremder interner Pfad eines unsichtbaren Rezepts → abgelehnt; Fehler → Rezept ohne Bild.
   - `test/unit/recipe-images-route.test.ts`: 200 mit Headern, 404 fuer unbekannt/ungueltig, kein Auth noetig.
   - `test/unit/recipes-routes.test.ts`: PATCH mit Fremd-URL/data:/null/Unsinn; `db-react.test.ts`: Liste/Detail liefern nie Fremd-URLs und nie data:-URLs.
   - `test/unit/cookidoo-credentials.test.ts:553ff.` (Proxy-Regressionstests) an neue Guard-Fehlerbilder anpassen.
   - `scripts/supabase/account-deletion-smoke.ts`: im Seed ein Bild fuer das private und das Haushaltsrezept von A anlegen; nach Loeschung `select count(*) from private.recipe_images where recipe_id in (…)` = 0; Bilder von B unveraendert (in `snapshot` aufnehmen). Kopierpfad: Smoke oder Unit-Test, dass die Kopie eines angenommenen Invites ein eigenes Bild hat und die Loeschung des Absenders es nicht entfernt.
   - Mobile: `image-uri`-Unit-Test; vorhandene Tests der genannten Screens anpassen; `npm run test:mobile:rntl-guard`.

**B. Bestandsdaten-Migration (ausdruecklich)**
1. **Messung vor dem Start (Betreiber, read-only, Supabase SQL Editor, Production und Staging):**
   ```sql
   select count(*) as total,
          count(*) filter (where image_url like 'data:%')  as data_urls,
          count(*) filter (where image_url ~* '^https?://') as external,
          count(*) filter (where coalesce(image_url,'') = '') as none,
          pg_size_pretty(coalesce(sum(octet_length(image_url)) filter (where image_url like 'data:%'),0)) as data_url_bytes,
          pg_size_pretty(pg_database_size(current_database())) as db_size
     from public.recipes;
   select split_part(split_part(image_url, '://', 2), '/', 1) as host, count(*)
     from public.recipes where image_url ~* '^https?://' group by 1 order by 2 desc limit 20;
   ```
   Ergebnis entscheidet DB vs. R2 (Entscheidung 3) und ob die Kapazitaetsschwelle sofort droht.
2. **Sicherung**: vor dem Apply auf Production muss ein frisches Backup aus Paket A existieren. Falls A noch nicht live ist: `id, image_url` der Fremd-URL-Rezepte als CSV aus dem SQL-Editor exportieren (klein) — der Backfill verwirft die Original-URLs.
3. **Backfill-Skript `src/maintenance/backfill-recipe-images.ts`** (unter `src/`, damit `tsc` es nach `dist/` baut und es im Production-Image als `node dist/maintenance/backfill-recipe-images.js` laeuft — das Image hat kein `tsx`):
   - Default `--dry-run` (zaehlt nur und probiert Downloads ohne Schreiben); `--apply` nur mit `RECIPE_IMAGE_BACKFILL_CONFIRM=<project-ref>` (Muster wie `SUPABASE_RLS_SMOKE_CONFIRM`); `--limit`, `--batch 50`, Parallelitaet 2, pro Host hoechstens 1 gleichzeitiger Request + 250 ms Pause (Ruecksicht auf Quellseiten).
   - Auswahl: `image_url IS NOT NULL AND image_url NOT LIKE '/api/v1/recipe-images/%'`, nach `id` geordnet, Cursor ueber `id` (fortsetzbar).
   - Pro Rezept: `ingestImageSource` (data:-URLs: EXIF entfernen und auf ≤ 250 KB bringen; Fremd-URLs: `safeFetchImage`). Schreiben in einer Transaktion mit Optimistic Guard `UPDATE recipes … WHERE id = $1 AND image_url = $alt` (gleichzeitige Nutzeraenderung gewinnt).
   - **Dauerhaft unbrauchbar** (404/410, kein Bild, zu gross, SSRF-blockiert, Dekodierfehler) → `image_url = NULL` (App zeigt Emoji-Fallback). **Voruebergehend** (Timeout, 5xx, 429) → unveraendert lassen, naechster Lauf versucht erneut; nach 3 Laeufen manuell entscheiden.
   - Ausgabe: Zaehler je Ergebnis und Host, keine vollstaendigen URLs, keine Rezeptnamen.
   - Erwartung: abgelaufene Instagram-/Facebook-CDN-Links (signierte `oe=`-Parameter) sind ueberwiegend schon tot und werden NULL — diese Bilder werden heute bereits nicht mehr angezeigt.
4. **Ausfuehrung** (Betreiber-Entscheidung 5): als **Northflank-Einmal-Job** aus dem aktuellen Production-Image (EU-Egress, DB-Zugang ist dort vorhanden, nichts laeuft lokal), zuerst gegen **Staging** (dry-run → apply → Sichtpruefung in der App), dann Production (dry-run → apply). Mehrfach ausfuehrbar bis „remaining = 0".
5. **Kontrolle nach dem Lauf**: Abfrage aus B1 erneut — `external = 0`, `data_urls = 0`; `select pg_size_pretty(sum(octet_length(bytes))) from private.recipe_images;` dokumentieren.

**C. Abschluss (PR DM-3b, nach erfolgreichem Backfill)**
1. Migration `supabase/migrations/20261012090000_recipes_image_url_internal_only.sql`: `ALTER TABLE public.recipes ADD CONSTRAINT recipes_image_url_internal_chk CHECK (image_url IS NULL OR image_url ~ '^/api/v1/recipe-images/[0-9a-f-]{36}$') NOT VALID;` dann `VALIDATE CONSTRAINT` (schlaegt fehl, falls noch Altwerte da sind — gewollt als Gate). Zeitstempel beim Anlegen aktualisieren.
2. Altroute `GET /api/v1/recipes/:id/image` (`recipes.ts:104-129`) und die data:-/Fremd-URL-Zweige in `deserializeListItem`/`deserialize` entfernen; SW-Regex ohne `/image`.
3. `/api/v1/proxy/image`: Host-Allowlist (nur Chefkoch-Bild-CDN, Host aus `previewImageUrlTemplate` verifizieren, z. B. `img.chefkoch-cdn.de`). Damit ist der offene Proxy geschlossen; Kommentar „used for PDF export before login" (Z. 145-146) korrigieren — PDF-Export braucht ihn nicht mehr.

### Akzeptanzkriterien
- Kein API-Response (Liste, Detail, Sammlung, Planer, Job-Ergebnis) enthaelt eine Fremd-Bild-URL oder eine data:-URL (Unit-Tests; Stichprobe in den DevTools auf Staging: Netzwerk-Tab zeigt beim Durchklicken von Liste, Detail, Sammlung, Bildauswahl und PDF-Export **keine** Requests an Fremd-Hosts).
- Jedes gespeicherte Bild ≤ 250 000 Bytes, JPEG, ohne EXIF (DB-CHECK + Test).
- Kontoloeschung entfernt alle Bilder des Kontos (Smoke gruen).
- Haushalt-Teilen/Kopieren/Einladung: Kopie hat eigenes Bild; Loeschen des Originals laesst die Kopie intakt.
- Foto-Rezepte zeigen Vorschaubilder in der Liste (Web und nativ) — behebt den vermuteten 401-Fehler.
- Backfill auf Production abgeschlossen, Constraint aus DM-3b validiert.
- Proxy folgt keinen Weiterleitungen auf private Adressen (Test).

### Risiken
- **Kapazitaet Supabase Free** (500 MB DB, 5 GB Egress): Messung B1, taegliches Log der Bildgroesse, Umstiegsschwelle auf R2; LRU-Cache und `immutable` gegen Egress.
- **Import wird langsamer** (Download + Verarbeitung, typ. 0,3–2 s); Timeout 8 s, Fehler nie fatal.
- **Urheberrecht** (Recherche 9.2): Speichern ist eine Vervielfaeltigung, Hotlinking nicht. Die Bilder sind nur fuer die eigene Sammlung bestimmt und werden nicht oeffentlich verbreitet; Risiko aehnlich wie beim Rezepttext selbst. In Paket R (Nutzungsbedingungen) mitbedenken.
- **Token-URLs** koennen geteilt werden (z. B. Screenshot der DevTools) → Folge: nur dieses eine Bild ist sichtbar; bei Bildwechsel neues Token. Akzeptabel.
- **Uebergangsphase** zwischen Deploy und Backfill: Fremdbilder fehlen voruebergehend (bewusst: lieber kein Bild als ein Hotlink). Backfill direkt nach dem Deploy starten.
- **SSRF** bleibt eine Angriffsflaeche (jetzt an drei Stellen): zentraler Guard + Tests; der allgemeine Web-Fetcher (`src/fetchers/web/index.ts:23`, `redirect: "follow"`) hat dieselbe Luecke, gehoert aber nicht zu diesem Paket (eigener Punkt, siehe unten).
- **Backup-Groesse** steigt um die Bilddaten (bei 200 MB × 18 aufbewahrten Sicherungen ca. 3,6 GB, unter 10 GB R2-Free).

### Doku-Nachzug
- CLAUDE.md: Endpunkt-Tabelle (neu `/api/v1/recipe-images/:token` GET, „unauthenticated capability URL"; `/recipes/:id/image` entfernt in DM-3b; `/proxy/image` „SSRF-guarded, Chefkoch-Allowlist, Bildvorschlaege"), Ownership-Tabelle (neue Zeile `recipe_images`: Kaskade ueber `recipes`, keine User-ID-Spalte), „Key files" (`src/recipe-images.ts`, `src/utils/safe-fetch-image.ts`, `src/maintenance/backfill-recipe-images.ts`), Abschnitt PWA/SW (Bild-Requests network-only), Konvention „alle Bildschreibpfade laufen durch `ingestImageSource`, nie `image_url` direkt setzen".
- `docs/CODEMAPS/BACKEND.md` Endpunkte; Runbook-Abschnitt „Bild-Backfill" (Ausfuehrung als Northflank-Job) in `docs/domain-mail-infra-runbook.md` oder eigenem Runbook.
- Memory/Regel „Rezeptbilder max. 250 KB" ist jetzt technisch durchgesetzt (CHECK-Constraint) — in CLAUDE.md erwaehnen.
- **Hinweis fuer Paket R** (datenschutz.tsx, Recherche 11.3 „neu nach 40" und Z. 62-65): den Hotlink-Satz **weglassen**. Stattdessen: „Beim Import laedt unser Server das Rezeptbild einmal von der Quellseite, verkleinert es und speichert es bei uns. Dein Geraet laedt Rezeptbilder nur von RecipeDeck; Quellseiten und Chefkoch erhalten deine IP-Adresse dabei nicht. Bilder werden mit dem Rezept bzw. deinem Konto geloescht." Chefkoch-Satz: „Bildvorschlaege von Chefkoch ruft unser Server ab." Erst nach Deploy von DM-3 **und** abgeschlossenem Backfill uebernehmen.

### Aufwand: **L** (DM-3) + **S** (DM-3b) + Betreiberzeit fuer Messung und Backfill-Laeufe (ca. 1 h)

---

## Nicht Teil dieses Pakets (bewusst ausgeklammert)
- SSRF-Haertung des allgemeinen Web-/Pinterest-/Chefkoch-Fetchers (`redirect: "follow"` ohne Adresspruefung) — eigener Sicherheitspunkt; `safeFetchImage` aus DM-3 kann dafuer als Vorlage dienen.
- Clientseitige Verkleinerung im Web vor dem Upload (Bandbreite).
- WebP-Speicherung (braucht PDF-Export-Anpassung).
- Offline-Cache fuer Bilder im Service Worker.

---

## Entscheidungen fuer den Betreiber

| # | Frage | Empfehlung | Alternativen |
|---|---|---|---|
| 1 | **Loeschfrist Fehlerberichte** | **12 Monate ab Eingang**, unabhaengig vom Status (eine Regel, leicht zu beschreiben, harte Obergrenze) | 6 Monate nach Erledigung + max. 12 Monate; kuerzer (6 Monate ab Eingang) |
| 2 | **Fehlerberichte bei Kontoloeschung** | **Whitelist-Anonymisierung**, Text bleibt (Fehleranalyse bleibt moeglich) | Berichte ganz loeschen (einfachster DSE-Satz, kehrt Entscheidung aus `20261007120000` um) |
| 3 | **Bildspeicherort** | **DB-Tabelle `private.recipe_images`** hinter austauschbarer Schnittstelle; Umzug auf R2 ab ca. 200 MB Bilddaten | sofort Cloudflare R2 (EU) — sinnvoll, wenn die Messung (B1) schon heute > 1 500 Bilder zeigt; Supabase Storage nicht empfohlen |
| 4 | **Nicht mehr ladbare Bestandsbilder** | **auf NULL setzen** (Emoji-Fallback; meist ohnehin tote CDN-Links) | Fremd-URL behalten und in der DSE offenlegen (widerspricht dem Ziel) |
| 5 | **Wo laeuft der Backfill** | **Northflank-Einmal-Job** aus dem Production-Image, Staging zuerst | lokal mit Production-`DATABASE_URL` (Zugangsdaten lokal, Rechner und Heimnetz-IP im Spiel — nicht empfohlen) |
| 6 | **Bestandsmessung (B1)** | Betreiber fuehrt die zwei read-only Abfragen vor Freigabe von DM-3 im SQL-Editor aus und traegt die Zahlen hier nach | Claude fuehrt sie per vorhandener Staging/Prod-Verbindung aus, falls freigegeben |
| 7 | **Bild-URLs ohne Anmeldung** (Token-URL) | **ja** — einzige Variante, die mit `<Image>`, PDF und nativ ohne Umbau funktioniert | Bearer-Auth mit Blob-Fetch im Client (deutlich mehr Code, schlechteres Caching) |
| 8 | **Chefkoch-Bildvorschlaege** | **ueber den Proxy mit Host-Allowlist** laden | direkt laden und in der DSE offenlegen |
| 9 | **Abgelaufene Einladungen** (DM-1b, aus Paket R) | mit in DM-1 aufnehmen, Frist ca. 30 Tage nach Ablauf/Annahme | eigener kleiner PR |

Nach Freigabe: Entscheidungen in diesen Plan eintragen, TODO.md-Verweis auf diesen Detailplan pruefen, dann DM-1 (D8) beginnen.
