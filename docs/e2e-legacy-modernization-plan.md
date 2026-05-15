# E2E Plan (ENG-REVIEW LOCKED): Legacy-Modernisierung und Contract-Ausbau

Stand: 2026-05-15  
Decision mode: Alle Entscheidungen sind getroffen.

## Step 0: Scope Challenge (entschieden)

### What already exists

- Verbindliches Contract-Gate in CI mit echtem Server-Boot:
  - `e2e` Job startet `npm start`, wartet auf `/api/v1/health`, failt hart bei Timeout.
- Legacy-Soak ist getrennt:
  - `e2e-legacy-soak` Job (nightly + optional manuell).
- Legacy-Scripts sind bereits segmentiert:
  - `test:e2e:legacy:smoke`
  - `test:e2e:legacy:jobs`
  - `test:e2e:legacy:db`
  - `test:e2e:legacy:ci` mit JUnit-Report.
- Reporting ist vorhanden:
  - `artifacts/test-reports/e2e-legacy-junit.xml`.

### Minimum viable scope

1. Flake-Reduktion nur in Legacy-Tests, keine Produktlogik aendern.
2. Contract-Slice nur um stabile API-Vertraege erweitern.
3. PR-Gate bleibt klein und schnell.
4. Nightly liefert klare Triage-Signale statt Rauschen.

### Complexity check

- Erwarteter Umfang: 5 bis 8 Dateien.
- Neue Klassen/Services: 0.
- Entscheidung: Scope bleibt so, kein Redesign noetig.

### Search check

- Search unavailable; proceeding with in-distribution knowledge only.

### Completeness check

- Keine 80%-Loesung: Plan deckt Entkopplung, Stabilisierung, Gate-Kriterien, Reporting, Failure-Modes und Rollout-Reihenfolge vollstaendig ab.

### Distribution check

- Kein neues Artifact-Typ. CI-Pipeline existiert bereits und wird weiterverwendet.

## Architekturreview (entschieden)

### Zielarchitektur

```
PR / Push
  -> e2e-contract (blocking)
     -> start server
     -> health wait
     -> contract tests only

Nightly / Manual
  -> e2e-legacy-soak (non-blocking for PR)
     -> start server
     -> health wait
     -> legacy tests + junit
     -> triage signal (infra / flake / regression)
```

### Architekturentscheidungen

1. Contract bleibt "vertragsnah", nicht "systemweit".
2. Legacy bleibt Soak, bis Stabilitaetskriterien belegt sind.
3. Promotion in Contract erfolgt nur testweise und schrittweise (ein Kandidat pro Zyklus).
4. Kein direkter Import unscharfer Legacy-Assertions in das PR-Gate.

## Code-Quality-Review (entschieden)

### DRY und Wartbarkeit

- Gemeinsame Erwartungen fuer API-Contract-Assertions zentral halten (Status + Kernfelder).
- Legacy-Segmente bleiben klar separiert (`smoke/jobs/db/edge`) statt Mischsuiten.
- Jede Flake-Korrektur braucht eine knappe Root-Cause-Notiz im Testkommentar oder in `docs/TEST_STATUS.md`.

### Explizit statt clever

- Keine impliziten Retry-Magie-Loesungen.
- Timeouts und Polling-Intervalle pro Testgruppe explizit dokumentieren.
- Jede weichere Assertion braucht eine Begruendung (fachlich irrelevant / nicht deterministisch).

## Test-Review (vollstaendig)

### Codepath- und Flow-Diagramm

```
CODE PATHS                                              USER / CI FLOWS
[+] Contract gate (blocking)                            [+] PR merge safety
  -> boot API                                             -> deterministic pass/fail
  -> check health                                         -> quick feedback
  -> run contract suite

[+] Legacy soak (non-blocking)                          [+] nightly stability signal
  -> boot API                                             -> flakes surfaced without blocking delivery
  -> check health                                         -> failures categorized for action
  -> run legacy suite + junit

[+] Promotion pipeline                                   [+] quality ratchet
  -> pick stable legacy candidate                         -> one candidate per cycle
  -> harden data + assertions                             -> promote only after stability window
  -> move to contract suite
```

### Coverage-Gaps (verpflichtend zu schliessen)

1. Legacy-Tests enthalten noch gemischte "historische" Assertions ohne klaren Contract-Wert.
2. Nicht alle Legacy-Fails sind sauber einer der 3 Triage-Kategorien zugeordnet.
3. Promotion-Kandidaten sind noch nicht mit festen Eintrittskriterien als Checkliste codifiziert.

### Verbindliche Testanforderungen

1. Fuer jede Legacy-Gruppe mindestens ein "stabiler Kernfall" plus ein "Fehlerpfad".
2. Jeder Promotion-Kandidat braucht:
   - deterministische Datenquelle,
   - reproduzierbaren Lauf lokal + CI,
   - klaren API-Vertrag (kein Implementierungsdetail).
3. Jeder rote Nightly erzeugt:
   - Kategorie,
   - Owner,
   - naechste konkrete Aktion.

## Performance-Review (entschieden)

- Contract-Suite muss unter 3 Minuten bleiben.
- Legacy-Soak darf laenger sein, beeinflusst aber keine PR-Durchlaufzeit.
- Keine neuen Performance-Risiken im Produktpfad, nur CI/Test-Pfad.

## Failure Modes (pro neuer/angepasster Pfad)

| Pfad | Realistische Failure | Testabdeckung | Error handling | Sichtbarkeit |
|---|---|---|---|---|
| `e2e-legacy-soak` server boot | Server startet nicht | Ja | Ja (hartes CI-Fail) | Klar |
| Legacy jobs polling | Timing-Race / sporadischer Timeout | Teilweise | Teilweise | Klar (Nightly rot) |
| Promotion in contract | Flaky Test wird zu frueh promoted | Nein (heute) | Prozessregel noetig | Klar, aber zu spaet |
| JUnit report parse | Report existiert, aber unvollstaendig | Teilweise | Artifact vorhanden | Klar |

Kritische Luecken:
- Keine stille Produktluecke, aber Prozessluecke: Promotion ohne harte Eintrittscheckliste ist riskant.

## Verbindliche Promotion-Checkliste (neu)

Ein Legacy-Test darf nur promoted werden, wenn alle Punkte erfuellt sind:

1. 14 Tage Nightly ohne test-flake fuer diesen Fall.
2. Lokal reproduzierbar mit dokumentiertem Command.
3. Deterministische Daten/Fixure ohne externe Unsicherheit.
4. Assertion prueft Vertrag, nicht interne Implementierung.
5. Laufzeitimpact fuer Contract-Suite bleibt im Budget.

## Umsetzungsphasen

### Phase A: Stabilization Backlog aufbauen (1-2 Tage)

1. Top-5 Flake-Faelle aus Nightly-Historie extrahieren.
2. Jeden Fall in `infra` / `test-flake` / `produkt-regression` einordnen.
3. Fix-Reihenfolge nach Haeufigkeit x Schwere festlegen.

### Phase B: Legacy inhaltlich stabilisieren (2-4 Tage)

1. Fixture/Setup-Cleanup je Flake-Fall haerten.
2. Ueberstrenge Assertions auf Vertragssicht umbauen.
3. Polling/Timeout-Parameter gruppenweit vereinheitlichen.

### Phase C: Contract inkrementell erweitern (laufend)

1. Pro Zyklus genau einen Kandidaten aus Legacy nach Contract ziehen.
2. Zuerst `PATCH /api/v1/recipes/:id`, dann `DELETE /api/v1/recipes/:id`, danach ggf. `extract/jobs`-Envelope.
3. Nach jedem Transfer CI-Laufzeit + Stabilitaet gegen Budget pruefen.

Fortschritt (2026-05-15):
- Promotion-Kandidat `PATCH /api/v1/recipes/:id` umgesetzt.
- Promotion-Kandidat `DELETE /api/v1/recipes/:id` umgesetzt (deterministische Fixture + 404-Verify via `GET /api/v1/recipes/:id`).
- Promotion-Kandidat `GET /api/v1/extract/jobs?limit=N` erweitert (Envelope + Limit-Grenze + robuste Job-Shape-Pruefung fuer `limit=1`).
- Promotion-Kandidat `POST /api/v1/keys/validate` ohne `apiKey` als stabiler 400-Contract aufgenommen.
- Contract-Slice ist gegen laufenden Server verifiziert: `npm run test:e2e:contract` -> `11 passed` (0 failed).
- Legacy-P1-Entkopplung umgesetzt: Polling stabilisiert, Performance-Checks als non-gating Soak-Signal mit Soft-Budgets/Spike-Hinweisen.
- Legacy-P2 DB-Isolation abgeschlossen: deterministische Fixture-/Cleanup-Strategie in `Database Operations`, plus 10x Repro-Lauf `test:e2e:legacy:db` ohne Reihenfolgefehler.

### Phase D: Betriebsroutine fixieren (laufend)

1. Woechentlicher kurzer Soak-Review.
2. Dokumentation in `TODO.md` und `docs/TEST_STATUS.md` aktualisieren.
3. Offene Flake-Tickets nicht sammeln, sondern aktiv abbauen.

#### P2a-Ergaenzung: Skip-Wave-Tagesroutine (verbindlich)

1. Nightly-Artefakte oeffnen: `e2e-legacy-junit.xml`, `e2e-legacy-skip-signal.json`, `rezepti-server.log`.
2. Bei `skipped > 0` bis 12:00 CET initiale Klasse setzen (`infra`/`test`) nach deterministischer Regel aus dem Flake-Inventory.
3. Bis 18:00 CET finale Klasse + Repro-Command + naechste Aktion dokumentieren.
4. Bei `infra`: zuerst Boot/Health/Runner als Incident behandeln, keine voreilige Produktregression markieren.
5. Bei `test`: betroffene Legacy-Gruppe (`polling`, `perf`, `db-mutation`) markieren und in den P1/P2-Backlog rueckfuehren.

#### P3a-Ergaenzung: Docker/Environment strikt von API-Vertrag trennen

Klassifikationsregeln (verbindlich):
1. Docker-/Host-/Runtime-Auffaelligkeiten sind initial immer `infra`.
2. `produkt-regression` erst nach Repro bei stabiler Runtime (`/api/v1/health` gruen, kein Bootfehler, kein Container-Sonderpfad).
3. Wenn innerhalb von 15 Minuten nicht reproduzierbar: `infra-unverified` und Follow-up statt Fehlklassifikation.

Erst-15-Minuten-Triage:
1. `rezepti-server.log` auf Boot/Crash/Port pruefen.
2. `e2e-legacy-junit.xml` + `e2e-legacy-skip-signal.json` korrelieren.
3. Health pruefen und nur dann API-Verhalten bewerten.
4. Thread-Notiz setzen: `Noch keine Produktregression; zuerst Environment-Diagnostik abgeschlossen.`

## Worktree-Parallelisierung

### Dependency table

| Step | Modules touched | Depends on |
|---|---|---|
| A1 Flake-Inventar + Triage | `docs/`, `artifacts/` | — |
| B1 Legacy fixture hardening | `test/e2e/`, `test/utils/` | A1 |
| B2 Assertion cleanup | `test/e2e/` | A1 |
| C1 Contract candidate add | `test/e2e/` | B1, B2 |
| D1 Docs sync | `TODO.md`, `docs/` | C1 |

### Parallel lanes

- Lane A: A1 -> D1 (sequenziell)
- Lane B: B1 -> B2 -> C1 (sequenziell, shared `test/e2e/`)

Execution order:
1. A1 und B1 parallel starten.
2. Dann B2 und C1.
3. Zum Schluss D1.

Conflict flags:
- B1/B2/C1 teilen `test/e2e/`; deshalb bewusst in einer sequenziellen Lane.

## NOT in scope

- Vollstaendiges Ersetzen der Legacy-Suite.
- Ausweitung des PR-Gates auf alle historischen E2E-Tests.
- Produktfeatures oder API-Refactors ausserhalb Test/CI.
- Neue Toolchain/Framework-Migrationen.

## Completion summary

- Step 0: Scope Challenge — scope accepted as-is.
- Architecture Review: 1 Issue (Promotion-Prozess ohne harte Eintrittscheckliste) -> entschieden und geloest.
- Code Quality Review: 1 Issue (uneinheitliche Legacy-Assertions) -> entschieden.
- Test Review: Diagram produziert, 3 Gaps identifiziert.
- Performance Review: 0 neue Performance-Issues im Produkt, 1 CI-Budget-Constraint bestaetigt.
- NOT in scope: written.
- What already exists: written.
- TODOS.md updates: 0 neue TODOs jetzt; wird nach Phase-A-Ergebnissen gezielt erweitert.
- Failure modes: 0 kritische silent-failure Gaps, 1 Prozessluecke geschlossen.
- Outside voice: skipped.
- Parallelization: 2 lanes, 1 parallel start, danach sequenziell.
- Lake score: 2/2 Empfehlungen complete option.

## Ready-to-implement sequence

1. Phase A sofort starten (Top-5 Flakes + Klassifikation).
2. Dann Phase B fuer die Top-2 mit hoechster Wiederholrate.
3. Danach genau 1 Contract-Promotion in Phase C.
4. Erst dann naechsten Zyklus starten.
