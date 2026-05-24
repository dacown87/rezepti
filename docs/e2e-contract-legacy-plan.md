# E2E Plan Review (ENG): Contract Gate + Legacy Soak

Stand: 2026-05-15
Entscheidungsmodus: "du entscheidest alles" (alle offenen Richtungsfragen wurden festgelegt)

## Step 0: Scope Challenge (Entscheidung)

### Was bereits existiert

- CI startet im `e2e`-Job bereits Postgres und pusht das Schema: [.github/workflows/ci.yml](/home/patrick/Projekte/rezepti/.github/workflows/ci.yml)
- Ein stabiler Contract-Slice existiert bereits: [test/e2e/contract-api.test.ts](/home/patrick/Projekte/rezepti/test/e2e/contract-api.test.ts)
- Historische E2E-Suite ist bereits separierbar: [package.json](/home/patrick/Projekte/rezepti/package.json) (`test:e2e:legacy`)

### Minimaler Scope (festgelegt)

1. PR-Gate bleibt klein: nur `test:e2e:contract`.
2. Legacy-Tests laufen separat als Nightly-Soak.
3. Ein deterministischer zusätzlicher Contract-Test (`GET /api/v1/recipes/:id` mit Fixture) wird ergänzt.
4. Keine funktionalen Produktänderungen außerhalb CI/Test-Infrastruktur.

### Komplexitätscheck

- Erwartete Dateien für die Umsetzung: 4 bis 7.
- Neue Services/Klassen: 0.
- Ergebnis: kein Overbuild, Scope ist angemessen.

### Search-Check

- Nicht erforderlich für diese Änderung (kein neues Architektur-Pattern, keine neue Infra-Klasse, keine neue Concurrency-Primitive).

### TODOS-Cross-Reference

- Es existiert `TODO.md` (nicht `TODOS.md`).
- Die geplanten Arbeiten decken die dort offenen Punkte "Root-API-E2E-Contract-Gate" und "historische Root-E2E-Suite aufräumen" direkt ab.

## Architekturreview (Entscheidung)

### Zielarchitektur

```
PR / Push
  -> job:e2e-contract
     -> start API server
     -> wait /api/v1/health (hard fail if not ready)
     -> run contract tests only

Nightly / Manual
  -> job:e2e-legacy-soak
     -> start API server
     -> wait /api/v1/health (hard fail if not ready)
     -> run legacy tests (non-blocking for PR flow)
     -> publish logs + report artifacts
```

### Architekturentscheidungen

1. `e2e` bleibt verpflichtend nur für Contract-Tests.
2. Legacy bekommt eigenen Job (`e2e-legacy-soak`) mit Trigger `schedule` + optional `workflow_dispatch`.
3. Server-Start wird in beiden Jobs identisch aufgebaut (DRY): gleicher Boot-/Wait-/Log-Pfad.
4. Legacy-Job darf Fehler zeigen, blockiert aber keine PR-Delivery.

### Realistische Failure-Szenarien (Architektur)

- Server bootet nicht (Port/Env/Runtime): wird als harter Fehler erkannt, Log-Artifact verfügbar.
- DB ist erreichbar, aber API hängt beim Start: Health-Wait läuft Timeout und beendet Job sauber.
- Legacy-Tests flaken: sichtbar im Nightly, ohne PR-Blockade.

## Code-Quality-Review (Entscheidung)

### DRY-Regeln

- Keine duplizierte Bash-Logik zwischen Contract- und Legacy-Job.
- Gemeinsame Steps in CI per konsistente Blockstruktur, klare Namen, gleiche Timeout-Politik.

### "Engineered enough"

- Keine neue interne Test-Runner-Abstraktion.
- Keine übermäßige Parametrisierung für nur zwei Jobs.
- Reicht: klare Scripts in `package.json` + klarer CI-Flow.

### Explizit statt clever

- Legacy klar benennen: `test:e2e:legacy:smoke`, `:jobs`, `:db`, `test:e2e:legacy`.
- Soak-Job nutzt explizit `test:e2e:legacy` (nicht implizit `test:e2e`).

## Test-Review (100%-Pfadabdeckung für neuen Plan)

### Codepfad- und Flow-Diagramm

```
CODE PATHS                                                 USER FLOWS
[+] CI contract gate                                       [+] PR validation
  -> Start API server                                        -> contract pass/fail visible in PR
  -> Wait health /api/v1/health                             -> fast feedback, low flake
  -> Run test:e2e:contract
  -> Stop server + upload log

[+] CI legacy soak                                         [+] nightly quality signal
  -> Start API server                                        -> failures triaged without blocking PRs
  -> Wait health /api/v1/health
  -> Run test:e2e:legacy
  -> Upload logs + test report artifact

[+] Contract tests                                          [+] API trust baseline
  -> health shape
  -> recipes list shape
  -> jobs envelope
  -> extract validation error path
  -> recipes/:id deterministic fixture path [GAP -> add]
```

### Gaps (entschieden)

1. `GET /api/v1/recipes/:id` fehlt im Contract-Slice deterministisch mit kontrollierter Fixture.
2. Legacy ist noch nicht in stabile Subsets geschnitten (`smoke/jobs/db`).
3. Legacy-Soak-Reportformat ist noch nicht standardisiert (JUnit oder maschinenlesbar).

### Testmaßnahmen (verpflichtend)

1. Contract:
- Seed/Fixture in Test-Setup erzeugen.
- `GET /api/v1/recipes/:id` gegen bekannte ID prüfen.
- Strikte Assertions auf Response-Felder.

2. Legacy:
- Split in Scripts:
- `test:e2e:legacy:smoke`
- `test:e2e:legacy:jobs`
- `test:e2e:legacy:db`
- `test:e2e:legacy` aggregiert die drei.

3. CI-Reporting:
- Legacy-Job schreibt Testreport-Artifact.
- Server-Log immer hochladen.

## Performance-Review (Entscheidung)

### Erwartete Auswirkung

- PR-CI wird schneller, weil nur Contract läuft.
- Nightly wird etwas länger, aber isoliert.
- Keine neue DB-Last in PR-Pipeline außer bestehendem Contract-Scope.

### Risiken

- Zu großer Contract-Scope kann wieder CI verlangsamen.
- Gegenmaßnahme: Contract-Suite klein halten, nur API-Baseline.

## Failure Modes pro neuem Codepfad

| Codepfad | Möglicher Produktionsfehler | Test deckt ab | Error Handling | User-Sicht |
|---|---|---|---|---|
| CI `Start API server` | Prozess startet, aber crasht sofort | Ja (Health-Wait indirekt) | Ja (Timeout + Log) | Klarer CI-Fehler |
| CI `Wait health` | Health bleibt rot | Ja | Ja (hartes `exit 1`) | Klarer CI-Fehler |
| Contract `recipes/:id` | falsche Serialisierung / 404 bei Seed-Daten | Nach Ergänzung: Ja | Teilweise (API-seitig) | Klarer Test-Fail |
| Legacy-Soak Runner | Flaky Tests durch Timing/Netzwerk | Ja (Nightly-Ausführung) | Ja (isoliert von PR) | Kein PR-Block, Nightly rot |

Kritische Lücken:
- Aktuell keine kritische Lücke mit "kein Test + kein Handling + silent failure", sobald `recipes/:id`-Contract ergänzt ist.

## NOT in scope

- Keine Ausweitung auf komplette historische E2E als PR-Gate.
- Keine neuen Produktfeatures in API/Mobile.
- Kein Wechsel des Testframeworks.
- Keine Re-Architektur des Job-Managers.
- Keine zusätzliche Deployment-Umstellung (Northflank bleibt separat).

## Parallelisierungsstrategie (Worktrees)

### Dependency-Tabelle

| Step | Modulebereich | Depends on |
|---|---|---|
| A: Legacy-Job in CI ergänzen | `.github/workflows/` | — |
| B: Legacy-Scripts splitten | `package.json`, `test/e2e/` | — |
| C: Deterministischen `recipes/:id` Contract ergänzen | `test/e2e/`, ggf. `test/utils/` | — |
| D: Doku/Status aktualisieren | `TODO.md`, `docs/TEST_STATUS.md`, `docs/` | A, B, C |

### Lanes

- Lane A: Step A (CI-Job)
- Lane B: Step B -> Step C (beide in `test/e2e/`, daher sequenziell)
- Lane C: Step D (nach Merge von A+B/C)

### Ausführungsreihenfolge

1. Starte Lane A und Lane B parallel.
2. Merge beider Ergebnisse.
3. Dann Lane C.

Konflikt-Hinweise:
- B und C teilen `test/e2e/` und sind daher absichtlich in einer Lane sequenziell.

## Umsetzungsplan (final)

### Phase 1: CI-Soak ergänzen

1. `e2e-legacy-soak` Job in [ci.yml](/home/patrick/Projekte/rezepti/.github/workflows/ci.yml) hinzufügen.
2. Trigger nur `schedule` + optional `workflow_dispatch`.
3. Identischen Boot-/Health-/Stop-/Log-Flow wie im Contract-Job verwenden.

### Phase 2: Legacy sauber trennen

1. In [package.json](/home/patrick/Projekte/rezepti/package.json) Scripts ergänzen:
- `test:e2e:legacy:smoke`
- `test:e2e:legacy:jobs`
- `test:e2e:legacy:db`
- `test:e2e:legacy` als Aggregat.
2. Testdateien logisch zuordnen und bei Bedarf umbenennen.

### Phase 3: Contract stärken

1. In [contract-api.test.ts](/home/patrick/Projekte/rezepti/test/e2e/contract-api.test.ts) deterministischen `GET /api/v1/recipes/:id` Test ergänzen.
2. Dafür Fixture/Seed mit stabiler ID im Setup erzeugen.
3. Assertions auf Pflichtfelder und Statuscode.

### Phase 4: Betriebsfähigkeit absichern

1. Server- und Testreport-Artefakte standardisieren.
2. `TODO.md` und `docs/TEST_STATUS.md` mit neuem Gate-Modell synchronisieren.
3. Nightly-Triage-Routine dokumentieren (Infra/Flake/Regression).

## Abschlusskriterien

- PRs werden nur durch `test:e2e:contract` geblockt.
- Nightly führt `test:e2e:legacy` mit Artifacts aus.
- Deterministischer `recipes/:id` Contract-Test ist grün.
- Dokumentation entspricht dem neuen Betriebsmodell.

