# Upgrade Review Findings Remediation Plan

Datum: 2026-05-14
Branch: `chore/update-batches-0-3`
Status: Reviewt, Scope reduziert

## Ausgangslage

Die Review-Findings zum Upgrade-Branch fallen in vier Gruppen:

1. `Batch 0` ist in `TODO.md` als abgeschlossen markiert, obwohl `ci.yml` noch alte Action-Majors nutzt und die Node-20-Deprecation daher nicht nur von Northflank kommen kann.
2. Die E2E-Verifikation ist schwächer als dokumentiert, weil die relevanten API-E2E-Suiten bei nicht laufendem Server geskippt werden.
3. Die Coverage-Gates wurden im Zuge der Vitest-4-Migration deutlich abgesenkt und sind damit nicht nur technisch rekalibriert, sondern auch als Qualitätsgate gelockert.
4. Der `JobManager`-Test hat an Verifikationswert verloren, und Batch 3 ist dokumentarisch weiter als seine manuelle Persistenz-Verifikation.

## Ziel

Den Branch so nachschärfen, dass:

- die CI-/Workflow-Aussagen technisch belastbar sind,
- E2E wirklich E2E bedeutet,
- Testwert nicht still verloren geht,
- Coverage-Policy bewusst entschieden statt versehentlich gelockert wird,
- und `TODO.md` wieder exakt dem realen Verifikationsstand entspricht.

## Scope-Entscheidung aus dem Eng-Review

Dieser Plan wird bewusst **kleiner und härter** geschnitten als der erste Entwurf:

- **Im Scope** sind nur die Änderungen, die die Review-Findings direkt beheben:
  - `.github/workflows/ci.yml`
  - ein kleiner, deterministischer Root-API-E2E-Contract-Slice
  - `test/utils/test-helpers.ts`
  - `src/job-manager.ts`
  - `test/unit/job-manager.test.ts`
  - `vitest.config.ts`
  - `mobile/vitest.config.ts`
  - `TODO.md`
  - `docs/TEST_STATUS.md`
- **Nicht im Scope** dieser Remediation:
  - Umbau des Northflank-Deploy-Mechanismus
  - Komplettsanierung der gesamten historischen `react-api.test.ts`
  - neues Mobile-E2E-Framework nur für Persistenz-Abnahme

Begründung:

- Die echten Landminen sitzen in CI-Wahrheit, stillen E2E-Skips, weich gewordenen Coverage-Gates und entwerteten `JobManager`-Tests.
- Alles andere ist Folgearbeit oder Infrastrukturpolitik und würde diese PR unnötig aufblähen.

## What already exists

- Die Server-Start-/Health-Wait-Idee existiert bereits in `test/scripts/test-local.sh`; CI muss dieses Muster nur boring und deterministisch übernehmen.
- Route-nahe Request-Validierung für Extraktion existiert bereits in `test/unit/photo-extraction.test.ts`; wir müssen nicht dieselben Fehlerpfade noch einmal als breite E2E-Suite neu erfinden.
- Die Coverage-Ratchet-Mechanik existiert bereits in Root und Mobile; falsch ist im Moment primär die Höhe der Floors, nicht das Grundgerüst.

## Arbeitsströme

### 1. CI- und Batch-0-Wahrheit herstellen

Betroffene Dateien:

- `.github/workflows/ci.yml`
- `TODO.md`

Aufgaben:

- `ci.yml` auf die nötigen aktuellen Action-Majors anheben, soweit diese zum Node-24-Ziel gehören.
- Den Batch-0-Claim in `TODO.md` so formulieren, dass klar zwischen
  - erledigter Workflow-Hygiene in `docker-publish.yml` / `changelog-update.yml`
  - und weiter offenem `ci.yml`-/Northflank-Risiko
  unterschieden wird.

Akzeptanzkriterium:

- `ci.yml` zieht dieselbe Node-24-kompatible Action-Linie wie die bereits bereinigten Workflows.
- `TODO.md` behauptet nicht mehr, Batch 0 sei als Gesamtpaket sauber, solange `ci.yml` oder Northflank noch Rest-Risiko tragen.

### 2. E2E-Verifikation echt machen

Betroffene Dateien:

- `.github/workflows/ci.yml`
- ein kleiner Root-API-Contract-E2E-Test (`test/e2e/basic-api.test.ts` oder dedizierter CI-Slice)
- `test/utils/test-helpers.ts`

Aufgaben:

- Den E2E-Job in CI so erweitern, dass der App-/API-Server tatsächlich gestartet wird:
  - `npm start` im Hintergrund
  - Health-Wait auf `/api/v1/health`
  - harter Fail statt still grünem Skip, wenn der Server nicht hochkommt
  - sauberer Prozess-Cleanup im Workflow
- Den Pflicht-Gate auf einen **kleinen, deterministischen API-Contract-Slice** beschränken:
  - Health
  - API-Key-Validation
  - URL-Extraktions-Validierung
  - Job-Create/Poll nur dort, wo die Assertions gegen den echten Server stabil sind
- Die bestehenden großen Alt-E2E-Dateien nicht in dieser PR “pauschal grün machen”, sondern nur so weit anfassen, wie sie den neuen CI-Contract-Gate direkt stören.
- Das bestehende `skipIf(!serverAvailable)`-Verhalten so anpassen oder umrouten, dass ein fehlender Server in CI nicht als „grün“ durchrutscht.

Akzeptanzkriterium:

- CI bootet den echten Root-Server und läuft nicht mehr nur gegen “Server vielleicht da”.
- Das Pflicht-Gate hängt an real ausgeführten API-Contract-Pfaden, nicht an einem grünen Skip.
- `docs/TEST_STATUS.md` und `TODO.md` trennen sauber zwischen
  - “E2E-Infrastruktur bootet und prüft Contract-Pfade”
  - und “historische breite E2E-Suite ist komplett aufgeräumt”.

### 3. `JobManager`-Tests auf Runtime-Wert zurückführen

Betroffene Dateien:

- `src/job-manager.ts`
- `test/unit/job-manager.test.ts`

Aufgaben:

- In `src/job-manager.ts` einen kleinen Test-Seam schaffen, damit der Singleton-Zustand deterministisch zurückgesetzt werden kann.
- Den Test wieder gegen reale Laufzeitlogik in `src/job-manager.ts` ausrichten statt gegen nachgebaute Literale und Typformen.
- Mindestens folgende Pfade wieder mit echtem Verifikationswert abdecken:
  - `createJob`
  - Status-Transitionen
  - Progress-/Message-Updates
  - Abschluss-/Fehlerpfade
  - Cleanup-/Lookup-Verhalten
  - `getRecentJobs`
  - `getActiveJobs`
  - `isUrlProcessing`
  - `getJobEventsSince`

Akzeptanzkriterium:

- Ein Defekt in `src/job-manager.ts` kann den Test wieder real brechen.
- Der Test besteht nicht nur aus Typ- und Literalprüfungen.

### 4. Coverage-Policy bewusst entscheiden

Betroffene Dateien:

- `vitest.config.ts`
- `mobile/vitest.config.ts`
- ggf. `TODO.md`

Aufgaben:

- Trennen zwischen:
  - realer Vitest-4-Messänderung,
  - und echter Lockerung des Qualitätsgates.
- Danach **nicht** bei einer offenen A/B-Entscheidung stehenbleiben, sondern die strengere Linie sofort ziehen:
  - Root-Floors jetzt auf mindestens `30`
  - Mobile-Floors jetzt auf mindestens `30`
  - vorhandenen Ratchet-Mechanismus beibehalten, damit spätere Anhebung leicht bleibt
- Wenn ein Floor dadurch rot wird, im selben Arbeitsstrom die fehlende Abdeckung oder fehlerhafte Teststruktur nachziehen statt den Gate wieder weich zu machen.

Akzeptanzkriterium:

- Die Coverage-Floors sind eine bewusste Qualitätsentscheidung und keine implizite Folge des Tool-Upgrades.
- Die Config dokumentiert klar, warum die Floor-Zahl gewählt wurde und dass `25` nur Übergangsschmutz aus der Migration war.

## Dokumentation korrigieren

Betroffene Datei:

- `TODO.md`

Aufgaben:

- Batch 2 nur so weit als verifiziert markieren, wie die tatsächliche Root-API-E2E-Ausführung trägt.
- Batch 3 nicht als vollständig abgeschlossen formulieren, solange die manuelle Persistenzprüfung nach App-Neustart noch offen ist.
- `docs/TEST_STATUS.md` explizit an den neuen Stand angleichen, damit dort nicht nur das alte “skippt graceful” steht, sondern auch, welche Verifikation bewusst noch aussteht.
- Formulierungen so schärfen, dass Plan, Ist und Restrisiko deckungsgleich sind.

Akzeptanzkriterium:

- `TODO.md` und `docs/TEST_STATUS.md` enthalten keine stärkeren Behauptungen als die tatsächlich nachgewiesene Verifikation.

## Empfohlene Reihenfolge

1. CI-/Workflow-Wahrheit herstellen
2. kleinen CI-Contract-E2E-Slice bootfähig und fail-hard machen
3. `JobManager`-Tests zurück auf Runtime-Wert bringen
4. Coverage-Policy festziehen
5. `TODO.md` und `docs/TEST_STATUS.md` bereinigen
6. erneute Review

## Abschluss-Gates

Nach Umsetzung der Punkte erneut ausführen:

- Root-Typecheck
- Mobile-Typecheck
- Root-Unit
- Mobile-Unit
- Root-Coverage
- Mobile-Coverage
- Root-API-Contract-E2E im CI-kompatiblen Modus mit tatsächlich laufendem Server
- manuelle Mobile-Neustart-Prüfung für Settings/Theme/PDF

## Failure modes, die dieser Plan explizit schließen muss

- **CI startet keinen Server**  
  Test: ja, durch Health-Wait + Fail-Hard.  
  Error Handling: ja, Workflow bricht sichtbar ab.  
  User-Sicht: kein still grüner E2E-Check mehr.

- **API-E2E-Dateien skippen weiter still**  
  Test: ja, durch echten Pflicht-Gate mit gebootetem Server.  
  Error Handling: ja, CI schlägt fehl statt grün zu skippen.  
  User-Sicht: keine falsche “Batch 2 verifiziert”-Aussage mehr.

- **`JobManager`-Regression wird von Tests nicht mehr bemerkt**  
  Test: ja, durch echte Methodenpfade statt Typprüfungen.  
  Error Handling: nein, das ist ein reines Test-/Qualitätsproblem.  
  User-Sicht: indirekt, weil Polling/Status/Cancel sonst unbemerkt brechen können.

- **Persistenz bricht erst nach App-Neustart sichtbar**  
  Test: nein, dafür bleibt die manuelle Abnahme Pflicht.  
  Error Handling: nein.  
  User-Sicht: kritisch, weil Theme/Settings/PDF nach Relaunch verloren wirken würden.

## NOT in scope

- **Northflank-Deploy-Mechanismus ersetzen** — gehört in einen separaten Infra-Track, nicht in diese Review-Remediation.
- **Große Alt-E2E-Suite vollständig modernisieren** — sinnvoll, aber nicht nötig, um die aktuelle Review-Lüge zu schließen.
- **Neues Mobile-E2E- oder Device-Test-Framework** — zu großer Blast Radius für einen Batch-2/3-Remediation-Branch.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | OPEN | 19 issues, 2 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **UNRESOLVED:** 0
- **VERDICT:** ENG REVIEW OPEN — scope should be reduced, 2 critical gaps remain, eng review required before implementation is considered clear.
