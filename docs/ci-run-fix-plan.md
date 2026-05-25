# Plan-Eng-Review: CI-Fehler aus den letzten 5 GitHub Runs

## Review Scope

- Quelle: letzte 5 Runs auf `main`
- Zeitraum: 2026-05-24 bis 2026-05-25
- Ziel: Fehlerursache klar benennen, risikoarm beheben, Drift verhindern

## Step 0: Scope Challenge (entschieden)

### Was existiert bereits?

- `/api/v1/health` liefert produktiv `database: "supabase"`:
  - `src/routes/recipes.ts`
- Ein Contract-Test erwartet bereits `supabase`:
  - `test/e2e/contract-api.test.ts`
- Legacy-Test erwartet veraltet `react`:
  - `test/e2e/basic-api.test.ts`

### Minimaler Change

1. Veraltete Erwartung im Legacy-Test auf `supabase` anpassen.
2. Testnamen/Kommentare von „React database“ auf neutralen Wortlaut ändern.
3. CI-Actions-Versionen auf Node-24-fähige Major-Versionen anheben.

### Komplexitätscheck

- Betroffene Bereiche: `test/e2e`, `.github/workflows`
- Neue Services/Klassen: 0
- Erwartete Dateien: 2 bis 4
- Ergebnis: **kein Overbuild**, Scope bleibt klein und sauber.

### Search-Check (Layer-Bewertung)

- **[Layer 1]** GitHub-Actions-Upgrades auf aktuelle Major-Releases sind Standardpfad.
- **[Layer 1]** Contract-Ausrichtung statt Hardcode-Drift in mehreren Tests ist Standard-Best-Practice.

### TODOS-Abgleich

- Bestehende TODOs blockieren diesen Fix nicht.
- Diese Arbeit sollte **nicht** mit Multi-User-Auth vermischt werden (separater Track bleibt korrekt).

### Completeness-Check

- Vollständige Lösung ist günstig:
  - Testfix + Terminologie + CI-Action-Upgrades + Verifikation in einem kleinen Diff.
- Shortcut (nur eine Assertion ändern) würde erneute Drift begünstigen.

### Distribution-Check

- Kein neuer Artefakttyp (kein neues Binary/Package/Image-Format).
- Bestehende CI/CD-Pipeline bleibt Träger des Changes.

## Architektur-Review

### Bewertung

- Problem ist ein **Contract-Drift** zwischen Legacy- und Contract-Testebene.
- Keine Architekturänderung an Runtime/API nötig.
- Höchster Nutzen mit niedrigem Risiko: Testvertrag konsistent machen.

### Entscheidung

- `/api/v1/health` bleibt bei `database: "supabase"` als Source of Truth.
- Legacy-Test wird auf denselben Vertrag gebracht.

## Code-Quality-Review

### Findings

1. `[P1] (confidence: 10/10) test/e2e/basic-api.test.ts:32`  
   Harte Erwartung `react` ist veraltet und erzeugt CI-Fehler.

2. `[P2] (confidence: 9/10) test/e2e/basic-api.test.ts:27,35`  
   Testbeschreibung/Kommentar verwendet veraltete Bezeichnung „React database“.

3. `[P2] (confidence: 8/10) .github/workflows/ci.yml`  
   Mehrere `@v4` Actions laufen in Node-20-Deprecation-Fenster.

### Entscheidung

- Alle drei Punkte im selben Change-Set beheben.

## Test-Review (Coverage-Diagramm + Gaps)

```text
CODE PATHS                                          USER FLOWS
[+] /api/v1/health                                  [+] Nightly CI (schedule)
  ├── status=healthy                                 ├── e2e contract gate
  ├── database="supabase"                            ├── e2e legacy soak
  └── status=unhealthy                               └── strict perf validation

TESTS
  ├── [★★★ TESTED] contract-api expects supabase
  ├── [GAP] basic-api expects react (stale)
  └── [★★ TESTED] legacy soak runs full suite, fails on stale assert

COVERAGE (contract consistency): 2/3 paths aligned (67%)
GAPS: 1 critical drift gap
```

### Test-Gaps und konkrete Maßnahmen

1. **CRITICAL Regression-Test-Fix**  
   `test/e2e/basic-api.test.ts`: Assertion `database === "supabase"`.

2. Legacy-Textkonsistenz  
   Testname/Beschreibung neutralisieren:
   - statt „React health endpoint“ eher „API health endpoint“
   - statt „React database“ eher „configured database backend“

3. Verifikation
   - `npm run test:e2e:legacy:ci`
   - optional zusätzlich `vitest run test/e2e/contract-api.test.ts`

## Performance-Review

### Bewertung

- Keine neue Laufzeitlogik, keine Query-/Cache-Änderung.
- Performance-Risiko: **vernachlässigbar**.
- CI-Stabilitätsrisiko durch veraltete Actions bleibt relevanter als Runtime-Performance.

### Entscheidung

- Performance-Maßnahmen hier nicht ausweiten.
- Fokus auf CI-Zukunftssicherheit über Actions-Upgrades.

## Failure Modes je neu/angepasstem Codepfad

1. **Legacy-Health-Assertion**
   - Failure Mode: Erwartungswert driftet erneut.
   - Testabdeckung: Ja (Legacy + Contract).
   - Error Handling: n/a (Testebene).
   - Usersicht: indirekt, über rote CI.

2. **Workflow-Action-Versionen**
   - Failure Mode: Breaking Change beim Upgrade einer Action.
   - Testabdeckung: indirekt über CI-Runs.
   - Error Handling: Workflow schlägt transparent fehl.
   - Usersicht: sichtbarer CI-Fail, kein Silent Failure.

**Kritische Lücke (silent + ungetestet + ohne Handling): keine.**

## What Already Exists

- Bereits vorhandener Contract-Test mit korrekter Erwartung `supabase`.
- Bestehender Legacy-Soak-Job mit Artefakt-Upload für schnelle Diagnose.
- Bestehende Performance-/Strict-Validierung muss nicht neu gebaut werden.

## NOT in Scope

- Multi-User-Login / RLS-Umstellung (separater Produkttrack).
- Northflank/Deploy-Strategieänderungen.
- Umfassende E2E-Neustrukturierung.
- API-Semantikänderung des Health-Endpunkts.

## Umsetzungsplan (final)

1. `test/e2e/basic-api.test.ts`
- `expect(result.data?.database).toBe('supabase')`
- Testtitel/Beschreibung auf neutralen Wortlaut ändern.

2. `.github/workflows/ci.yml`
- `actions/checkout@v4 -> @v5`
- `actions/setup-node@v4 -> @v5`
- `actions/upload-artifact@v4 -> @v4` belassen (wenn v5 nicht verfügbar im Repo-Standard) oder auf latest stable anheben, falls freigegeben.

3. Lokale Verifikation
- `npm run test:e2e:legacy:ci`

4. CI-Verifikation
- Push/Dispatch, dann Kontrolle:
  - `e2e-legacy-soak` grün
  - keine neuen Workflow-Inkompatibilitäten

## Worktree-Parallelisierung

| Step | Modules touched | Depends on |
|------|-----------------|------------|
| Testvertrag fixen | `test/e2e/` | — |
| CI-Actions upgraden | `.github/workflows/` | — |
| Verifikation | `test/e2e/`, `.github/workflows/` | beide |

### Parallel Lanes

- Lane A: Testvertrag fixen (isoliert)
- Lane B: CI-Actions upgraden (isoliert)
- Lane C: Verifikation nach Merge von A+B

### Execution Order

- A + B parallel starten.
- Danach C sequenziell.

### Konfliktflags

- Kein Modul-Overlap zwischen A und B, daher niedriges Merge-Konfliktrisiko.

## Completion Summary

- Step 0: Scope Challenge — **scope accepted (kleiner, vollständiger Fix)**
- Architecture Review: **0 Architekturumbauten, 1 Drift-Ursache bestätigt**
- Code Quality Review: **3 Issues**
- Test Review: **Diagramm erstellt, 1 kritische Gap**
- Performance Review: **0 Performance-Issues**
- NOT in scope: **geschrieben**
- What already exists: **geschrieben**
- Failure modes: **0 kritische Lücken**
- Parallelization: **3 Lanes, 2 parallel / 1 sequenziell**
- Lake Score: **3/3 complete-option Entscheidungen**
