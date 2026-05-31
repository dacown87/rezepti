# Nightly-Strict Remediation Plan

Stand: 2026-05-24

## Ausgangslage

Die Nightly-Strict-Beobachtung ist nicht stabil. Nach der Strict-Eskalation am 2026-05-13 waren die Schedule-Runs vom 2026-05-13, 2026-05-14 und 2026-05-15 gruen. Seit 2026-05-16 sind alle geprueften Nightly-Runs rot.

Letzter gepruefter Run:

- `26353358668` — 2026-05-24 — `schedule` — rot
- URL: https://github.com/dacown87/rezepti/actions/runs/26353358668

Betroffene Gates:

- `performance-audit`: seit 2026-05-16 wiederholt rot in `Validate performance status`.
- `mobile-release-gate`: seit 2026-05-20 zusaetzlich rot in `Run Expo Doctor`.

Nicht betroffen:

- Root `test` war in den geprueften roten Nightlies gruen.
- Root `e2e` war in den geprueften roten Nightlies gruen.

## Befunde

### Befund A: Performance-Strict-Gate ist zu frueh hart

`performance-audit` laeuft technisch durch:

- Lighthouse selbst: `ok`
- Erwartete Runs: `9/9`
- Bundle-Budgets: OK
- Warm-up Seed: vorhanden

Die Strict-Validierung scheitert aber, weil die Readiness wieder `ready=false` ist:

- `minRunsMet`: true
- `warningRateMet`: true
- `fullCoverageMet`: true
- `metricStabilityMet`: false

Konkrete Warnungen im Run `26353358668`:

- `/ @ mobile-375x812`: LCP `23538ms > 1200ms`
- `/ @ mobile-375x812`: JS execution `3610ms > 2295ms`

Historisches Muster der roten Performance-Nightlies:

- 2026-05-16: `/` mobile LCP ca. `23000ms`, JS execution `2718ms`
- 2026-05-17: `/` mobile LCP ca. `23242ms`, JS execution `2987ms`
- 2026-05-18: `/` mobile LCP `1427ms`, JS execution `3802ms`, `/shopping` mobile LCP `22086ms`
- 2026-05-19: `/` mobile LCP ca. `21976ms`, JS execution `2402ms`
- 2026-05-21: `/` mobile LCP ca. `23321ms`, JS execution `2983ms`
- 2026-05-22: `/` mobile LCP ca. `23459ms`, JS execution `3054ms`
- 2026-05-23: `/` mobile LCP ca. `23204ms`, JS execution `2747ms`
- 2026-05-24: `/` mobile LCP ca. `23538ms`, JS execution `3610ms`

Interpretation:

Das ist kein Bundle-Groessenproblem. Die mobile LCP-Messung kippt in der GitHub-Runner-Umgebung sporadisch, aber haeufig genug, dass `metricStabilityMet=false` korrekt blockiert. Die aktuelle Strict-Regel macht daraus einen Nightly-Fail, obwohl die Readiness selbst sagt, dass das Gate noch nicht stabil ist.

### Befund B: Expo-Doctor Drift durch Patch-Versionen

Seit 2026-05-20 scheitert `mobile-release-gate` im Schritt `CI=1 npx expo-doctor`.

Run `26353358668` meldet:

| Paket | erwartet | gefunden |
| --- | ---: | ---: |
| `expo` | `~55.0.26` | `55.0.24` |
| `expo-camera` | `~55.0.19` | `55.0.18` |
| `expo-file-system` | `~55.0.22` | `55.0.20` |
| `expo-font` | `~55.0.8` | `55.0.7` |
| `expo-image-manipulator` | `~55.0.17` | `55.0.16` |
| `expo-router` | `~55.0.16` | `55.0.14` |
| `expo-sharing` | `~55.0.20` | `55.0.19` |

Interpretation:

Das ist ein normaler Expo-SDK-55 Patch-Drift. Der lokale Stand war zum Zeitpunkt der letzten Aktualisierung gruen, aber `expo-doctor@1.19.8` fordert inzwischen neuere Patch-Versionen innerhalb derselben SDK-Linie. Das ist ein Low-Risk Update, muss aber sauber ueber `expo install --check`/`expo install` und die Mobile-Gates laufen.

## Zielbild

Nightly soll wieder ein verlaessliches Betriebssignal sein:

1. `mobile-release-gate` ist gruen und bleibt an Expo-SDK-55 gekoppelt.
2. `performance-audit` trennt echte Budget-Regressionen von einer noch nicht stabilen Strict-Readiness.
3. `schedule` ist erst dann wieder hard-strict, wenn `readiness.ready=true` ueber mehrere echte Nightlies stabil bleibt.
4. Root `test` und `e2e` bleiben unveraendert hart.

## Vorgehen

### Phase 1: Expo-Doctor Drift sofort beheben

Ziel: `mobile-release-gate` wieder gruen machen.

Schritte:

1. Im `mobile/`-Workspace Patch-Drift pruefen:
   - `CI=1 npx expo-doctor`
   - `npx expo install --check`
2. Nur die gemeldeten SDK-55 Patch-Versionen aktualisieren:
   - bevorzugt `npx expo install expo expo-camera expo-file-system expo-font expo-image-manipulator expo-router expo-sharing`
   - keine Expo-SDK-Major- oder React-Native-Major-Spruenge
3. Lockfile aktualisieren.
4. Lokal verifizieren:
   - `CI=1 npx expo-doctor` in `mobile/`
   - `npx expo install --check` in `mobile/`
   - `npm --prefix mobile run typecheck`
   - `npm --prefix mobile run build:web`
   - `npm --prefix mobile run test:coverage`

Akzeptanz:

- `expo-doctor` meldet wieder `19/19 checks passed`.
- `npx expo install --check` meldet keine SDK-55 Patch-Mismatches.
- CI `mobile-release-gate` scheitert nicht mehr vor Typecheck/Build/Coverage.

Entscheidung:

- `expo-doctor` wird nicht per CI-YAML auf eine alte Version eingefroren.
- Wenn deterministische Doctor-Version noetig wird, dann als `mobile/devDependencies` mit intentionalem Update-Commit, nicht als versteckter `npx expo-doctor@...` Pin im Workflow.
- Grund: Expo-Dependency-Validation soll weiterhin SDK-Drift melden; der Fix ist, SDK-55-Patches kontrolliert nachzuziehen, nicht das Signal abzuschalten.

### Phase 2: Performance-Fail klassifizieren statt blind Budget drehen

Ziel: feststellen, ob das LCP-Signal ein Mess-/Runner-Problem oder eine echte App-Regression ist.

Schritte:

1. Aktuellen roten Run als Basis sichern:
   - `performance-artifacts/status.json`
   - `performance-artifacts/readiness.json`
   - `performance-artifacts/history.json`
   - Lighthouse JSON fuer `/` mobile
2. Lokal denselben Auditpfad laufen lassen:
   - `npm run perf:audit`
   - `PERF_ENFORCEMENT_LEVEL=warn npm run perf:validate`
3. Bei lokal gruen, aber CI rot:
   - Runner-/Lighthouse-Umgebung vergleichen: Chrome-Version, Lighthouse-Version, Node-Version, throttling method.
   - Pruefen, ob die LCP-23s-Werte auf einen Timeout-/Asset-/static-shell-Ausreisser im Lighthouse-Report zeigen.
4. Bei lokal reproduzierbar rot:
   - Lighthouse Trace fuer `/ @ mobile-375x812` analysieren.
   - Klaeren, ob `+html.tsx` statische Shell noch als LCP-Element zaehlt oder ob ein spaeter Hydration-Inhalt LCP ersetzt.
   - Erst danach UI-/Bundle-Fix planen.

Akzeptanz:

- Ursache ist klassifiziert als `runner-measurement`, `threshold/readiness-policy`, oder `real-regression`.
- Keine Budget-Anhebung ohne belegten Grund.

### Phase 3: Strict-Gate-Policy reparieren

Ziel: Nightly nicht rot machen, wenn die eigene Readiness-Pruefung `ready=false` sagt, solange keine echte Budget-Regression ausserhalb des Readiness-Kontexts vorliegt.

Empfohlene Aenderung:

- `schedule` bleibt ein harter Gate fuer:
  - Lighthouse-Ausfuehrbarkeit
  - vollstaendige Run-Abdeckung
  - Bundle-Budgets
  - echte Budgetverletzungen, sobald `readiness.ready=true`
- Wenn `readiness.ready=false` wegen `metricStabilityMet=false`, soll der Nightly:
  - ein klares Artifact/Log-Signal erzeugen
  - optional GitHub Step Summary schreiben
  - aber nicht als failed enden, sofern keine andere harte Regression vorliegt

Entscheidung:

`validate-status.mjs` wird erweitert. Es gibt keinen neuen YAML-only `observe`-Modus und kein globales `schedule`-Downgrade auf `warn`.

Grund:

- Die aktuelle Code-Reihenfolge setzt bei Budget-Findings sofort `process.exitCode` (`scripts/performance/validate-status.mjs`, Budget-Schleife vor der Readiness-Berechnung). Eine reine YAML-Aenderung wuerde entweder weiter rot bleiben oder echte Regressionen zu grob maskieren.
- Die Policy gehoert in den Validator, weil dort Findings, Readiness, History und Exitcode gemeinsam vorliegen.
- Das bleibt explizit statt clever: eine Entscheidungstabelle ist leichter zu testen als verteilte Workflow-Bedingungen.

Neue Validator-Entscheidungstabelle:

```text
Input status                         Readiness                 Exit   Warum
───────────────────────────────────  ───────────────────────  ─────  ─────────────────────────────────────────────
lighthouse != ok                     egal                     1      Infrastruktur-/Messlauf kaputt
successfulRuns < expectedRuns        egal                     1      unvollstaendige Daten, kein valides Signal
bundle budget exceeded               egal                     1      Bundle-Budget ist deterministisch genug
metric unavailable                   egal                     1      Budget aktiv, aber Messwert fehlt
route unavailable                    egal                     1      Route nicht auditierbar
metric budget exceeded               ready=true               1      echte Strict-Regression
metric budget exceeded               ready=false              0      Beobachtungsblocker, kein gruener Readiness-Zustand
metric budget ok                     ready=false              0      Beobachtungsblocker, Nightly bleibt informativ
metric budget ok                     ready=true               0      gruen
warn mode                            egal                     0      bestehendes Verhalten
soft mode                            bestehende Soft-Regeln   0/1    bestehendes Verhalten
```

Wichtig: `metric budget exceeded + ready=false` ist kein "gruenes" Signal. Der Validator muss im Summary/Artifact klar schreiben:

- `readiness.ready=false`
- `classification=observation_blocked`
- betroffene Route/Viewports und Metriken
- `budgetPass=false`
- `validateExitCode=0` nur wegen nicht erreichter Readiness

Damit bleibt der Nightly nutzbar, ohne Entwickler auf einen bekannten Messstabilitaetszustand zu alarmieren.

Akzeptanz:

- Validator-Tests decken folgende Faelle ab:
  - `strict + ready=true + budget fail` => Exit 1
  - `strict + ready=false + metric budget fail` => Exit 0 mit `classification=observation_blocked`
  - `strict + ready=false + bundle budget fail` => Exit 1
  - `strict + ready=false + metric unavailable` => Exit 1
  - `strict + ready=false nur metricStability` => Exit 0 mit Blocker-Signal
  - `strict + lighthouse fail` => Exit 1
  - `strict + incomplete run coverage` => Exit 1
  - `warn` bleibt Exit 0
- Nightly erzeugt weiterhin Artifacts und sichtbare Warnungen.

Implementierungsnotiz:

- Budget-Findings muessen typisiert werden, nicht nur als Strings in `runFindings` landen.
- Mindestens diese Klassen: `bundle`, `metric-budget`, `metric-unavailable`, `lighthouse-integrity`, `route-availability`, `readiness`.
- `isBudgetFinding()` reicht fuer die neue Policy nicht aus, weil `bundle exceeded`, `metric unavailable` und `metric exceeded while not ready` unterschiedliche Exit-Regeln brauchen.

### Phase 3b: Performance-History entgiften

Ziel: alte 23s-LCP-Ausreisser sollen die neue Beobachtungsperiode nicht kuenstlich blockieren.

Entscheidung:

- Nach der Validator-Policy-Aenderung wird der GitHub-Actions-Cache-Key von `performance-history-v4-...` auf `performance-history-v5-...` erhoeht.
- Die heruntergeladenen alten Artifacts bleiben als Diagnosebeleg erhalten; die CI-History fuer neue Readiness startet bewusst neu.

Grund:

- GitHub Actions Restore-Keys holen bei partiellen Treffern den neuesten passenden Cache. Mit `performance-history-v4-${{ github.ref_name }}-` wuerden die roten Ausreisser weiter in neue Runs wandern.
- Ein Cache-Namespace-Bump ist kleiner und sicherer als History-Dateien in CI zu filtern.

Akzeptanz:

- `.github/workflows/ci.yml` nutzt fuer Restore und Save denselben neuen Namespace.
- Der erste neue Nightly darf `readiness.window.runs < 10` zeigen, ohne als Produktregression bewertet zu werden.
- Der Plan/TODO dokumentiert den Neustart der Beobachtungsperiode.

### Phase 4: Neue Nightly-Beobachtungsperiode

Ziel: nach Fixes wieder belastbare Nightly-Daten sammeln.

Schritte:

1. Nach Expo-Fix und Validator-Policy-Fix einen manuellen Workflow ausloesen:
   - `workflow_dispatch`
   - `perf_enforcement=warn` zur Baseline
2. Danach optional einen manuellen Strict-Probe ausloesen:
   - `workflow_dispatch`
   - `perf_enforcement=strict`
3. Die naechsten 3 Nightlies beobachten:
   - `mobile-release-gate`
   - `performance-audit`
   - `readiness.ready`
   - LCP-Ausreisser auf `/` und `/shopping`
4. Erst wenn 3 Nightlies in Folge gruen und `readiness.ready=true` ist:
   - Strict-Policy wieder voll hart ziehen.
   - `pull_request` strict weiterhin nicht eskalieren, bevor mindestens 5 stabile Nightlies vorliegen.

Akzeptanz:

- Mindestens 3 Nightly-Schedule-Runs in Folge ohne rote Gates.
- Keine Expo-Doctor Drift.
- Keine neuen Root-Test-/E2E-Regressionen.
- Dokumentierter Entscheid, ob PR-Strict weiter vertagt oder vorbereitet wird.

### Phase 5: Optionaler echter App-Fix, falls lokal reproduzierbar

Ziel: nur dann UI-/Bundle-Code anfassen, wenn der 23s-LCP-Wert lokal oder im Trace als echte App-Regression belegbar ist.

Schritte:

1. Lighthouse JSON/Trace fuer `/ @ mobile-375x812` aus dem roten Run ansehen:
   - LCP-Element
   - Netzwerk-Wasserfall
   - Main-thread long tasks
   - HTML/static-shell Timing
2. Wenn das LCP-Element nicht die statische Shell aus `mobile/app/+html.tsx` ist:
   - Shell-Markup und erste sichtbare Inhalte pruefen.
   - Sicherstellen, dass kein spaeter Hydration-Inhalt das LCP-Element ersetzt.
3. Wenn Netzwerk/Asset-Laden blockiert:
   - nur den konkreten Asset-Pfad optimieren.
   - keine pauschale Bundle- oder Budget-Aenderung.

Akzeptanz:

- Vor einem App-Fix liegt ein Trace-Beleg vor.
- Der Fix wird mit `npm run perf:audit` und fokussiertem Lighthouse-Report fuer `/ @ mobile-375x812` verifiziert.

## Reihenfolge

1. Expo-Patch-Drift fixen, weil es ein klarer, lokalisierter CI-Fail ist.
2. Performance-Artefakte analysieren und Ursache klassifizieren.
3. Validator-Strict-Policy mit typisierten Findings und Tests anpassen.
4. Performance-History-Cache auf `v5` setzen.
5. Manuelle Probe-Runs ausloesen.
6. Nightly-Beobachtung neu starten.
7. App-Performance-Code nur anfassen, wenn Trace/Lokalrepro eine echte Regression belegt.

## Nicht-Ziele

- Kein Expo-SDK-Major-Sprung.
- Keine React-Native-/Reanimated-/Worklets-Major-Migration.
- Keine pauschale Budget-Anhebung.
- Keine PR-Strict-Eskalation, solange Nightly nicht stabil ist.
- Keine Veraenderung an Root `test` oder Root `e2e`, da diese Gates gruen sind.
- Keine CI-Policy, die alle `schedule`-Runs pauschal auf `warn` setzt.
- Keine History-Filterlogik, die alte Ausreisser still aus `history.json` loescht.

## Eng-Review-Entscheidungen

1. `schedule` bleibt auf `PERF_ENFORCEMENT_LEVEL=strict`; die feinere Exit-Policy kommt in `validate-status.mjs`.
2. Die Performance-History-Cache-Line wird nach der Validator-Aenderung auf `performance-history-v5` gesetzt.
3. `expo-doctor` wird nicht im Workflow auf eine alte Version gepinnt; falls Determinismus noetig ist, dann ueber `mobile/devDependencies`.
4. App-Code wird erst nach Trace-/Lokalrepro-Beleg geaendert.

## What Already Exists

- `.github/workflows/ci.yml`: trennt `test`, `e2e`, `mobile-release-gate` und `performance-audit` bereits sauber. Der Plan nutzt diese Trennung und baut keinen Parallel-CI-Pfad.
- `scripts/performance/validate-status.mjs`: hat bereits Budget-, Readiness-, History- und Observation-Logik. Der Plan erweitert diesen Validator statt einen zweiten Validator zu bauen.
- `test/unit/validate-status-performance-budgets.test.ts`: testet bereits Budget-Findings, Warn-vs-Strict-Grundverhalten, Readiness und Observation. Der Plan fuegt hier gezielte Policy-Tests hinzu.
- `scripts/performance/lighthouse-runner.mjs`: schreibt bereits `status.json`, `summary.json` und Lighthouse-Reports. Der Plan nutzt diese Artifacts fuer Diagnose.
- `scripts/performance/baseline.json`: enthaelt methodenbewusste mobile Budgets. Der Plan hebt diese Budgets nicht pauschal an.
- `mobile/app/+html.tsx`: existiert als statische App-Shell aus der frueheren Performance-Optimierung. Der Plan prueft sie nur bei belegter echter Regression.

## Architecture Review

Status: `DONE_WITH_CONCERNS`, Entscheidungen oben eingearbeitet.

Findings:

1. `[P1] (confidence: 9/10) scripts/performance/validate-status.mjs:824` — Die bisherige Plan-Formulierung "ready=false darf nicht failen" war zu grob, weil Budget-Findings vor der Readiness-Berechnung sofort den Exitcode setzen. Entscheidung: typisierte Findings plus Exit-Entscheidungstabelle im Validator.
2. `[P1] (confidence: 8/10) .github/workflows/ci.yml:315` — Der v4-History-Cache wuerde alte 23s-Ausreisser weiter in neue Readiness-Fenster tragen. Entscheidung: Cache-Namespace nach Policy-Fix auf `v5` bumpen.
3. `[P2] (confidence: 8/10) .github/workflows/ci.yml:358` — YAML-only `warn`/`observe` wuerde die Policy verstecken und Tests erschweren. Entscheidung: keine YAML-only Policy, Validator bleibt Source of Truth.

Strict-Validator-Datenfluss:

```text
status.json + summary.json + bundle-report.json + baseline.json
        │
        ▼
validate-status.mjs
        │
        ├─ integrity findings       → hard fail in strict
        ├─ bundle findings          → hard fail in strict
        ├─ metric budget findings   → hard fail only when readiness.ready=true
        ├─ metric unavailable       → hard fail in strict
        └─ history/readiness update → readiness.json + observation.json + summary.md
```

## Code Quality Review

Status: `DONE_WITH_CONCERNS`, Entscheidungen oben eingearbeitet.

Findings:

1. `[P2] (confidence: 8/10) scripts/performance/validate-status.mjs:830` — `runFindings` ist aktuell stringbasiert. Fuer die neue Policy waere weitere String-Erkennung fragil und nicht explizit genug. Entscheidung: Findings als strukturierte Objekte klassifizieren und fuer Summary/History weiterhin lesbare Strings ausgeben.
2. `[P2] (confidence: 7/10) docs/superpowers/plans/2026-05-24-nightly-strict-remediation-plan.md` — Die urspruenglichen offenen Fragen waren echte Implementierungsentscheidungen. Entscheidung: alle drei Fragen sind jetzt entschieden, damit die Implementierung ohne erneute Plan-Debatte starten kann.

## Test Review

Framework: Vitest. Relevante bestehende Tests: `test/unit/validate-status-performance-budgets.test.ts`.

Coverage-Diagramm:

```text
CODE PATHS                                                       TEST STATUS
[~] scripts/performance/validate-status.mjs
  ├── getFailureExitCode()
  │   ├── [★★ TESTED] warn exits 0
  │   ├── [★★ TESTED] soft exits 1
  │   └── [★★ TESTED] strict exits 1
  ├── evaluateLighthouseBudgetFindings()
  │   ├── [★★★ TESTED] metric unavailable
  │   ├── [★★★ TESTED] metric over budget
  │   └── [GAP] typed finding category is emitted
  ├── strict final exit policy
  │   ├── [GAP] strict + ready=true + metric budget fail => exit 1
  │   ├── [GAP] strict + ready=false + metric budget fail => exit 0 + blocked classification
  │   ├── [GAP] strict + ready=false + bundle fail => exit 1
  │   ├── [GAP] strict + metric unavailable => exit 1
  │   ├── [GAP] strict + lighthouse fail => exit 1
  │   └── [GAP] strict + incomplete coverage => exit 1
  ├── history/readiness writes
  │   ├── [★★ TESTED] observation green-run logic
  │   └── [GAP] observation_blocked run preserves budgetPass=false while validateExitCode=0
  └── cache namespace in workflow
      └── [GAP] workflow uses v5 consistently for restore + save

USER/OPERATOR FLOWS
[~] Nightly schedule
  ├── [GAP] known metric instability produces non-red observation artifact
  ├── [GAP] broken Lighthouse run still fails visibly
  └── [GAP] bundle growth still fails visibly
[~] Expo patch drift
  ├── [GAP] expo-doctor passes after SDK-55 patch update
  └── [GAP] mobile typecheck/build/coverage still pass after patch update

COVERAGE AFTER PLAN UPDATE: 9 required new assertions
QUALITY TARGET: all new validator branches get ★★★ behavior + edge + error coverage
```

Required tests:

1. Add unit tests for typed finding classification in `test/unit/validate-status-performance-budgets.test.ts`.
2. Add unit tests for final strict exit policy with synthetic readiness states.
3. Add a workflow text test or focused assertion script that both cache restore/save keys use `performance-history-v5`.
4. Re-run existing focused suite:
   - `npx vitest run test/unit/validate-status-performance-budgets.test.ts`
5. Re-run mobile release gates after Expo patch:
   - `CI=1 npx expo-doctor`
   - `npx expo install --check`
   - `npm --prefix mobile run typecheck`
   - `npm --prefix mobile run build:web`
   - `npm --prefix mobile run test:coverage`

## Failure Modes

| Codepath | Production failure mode | Test required | Error handling / user signal |
| --- | --- | --- | --- |
| Expo patch update | New patch introduces type/build break | Mobile typecheck/build/coverage | CI red in `mobile-release-gate` |
| `expo-doctor` dependency validation | Future Doctor rule changes without package changes | `expo install --check` plus Doctor run | CI red with package table |
| Validator typed findings | Finding misclassified as observation-only | Unit test per finding type | Summary shows classification |
| Strict metric budget while not ready | Real regression hidden during unstable window | Unit test plus Trace follow-up requirement | Artifact says `budgetPass=false`, `classification=observation_blocked` |
| Strict bundle budget fail | Bundle growth accidentally passes | Unit test | CI red |
| Lighthouse integrity fail | Missing/partial report passes as observation | Unit test | CI red |
| History cache namespace | Old outliers contaminate new window | Workflow key assertion | Readiness window restarts |
| Local/CI mismatch diagnosis | Engineers chase budget without trace evidence | Plan requires trace before app fix | TODO/summary documents classification |

Critical gaps after this review: none, if the required validator tests are implemented with the code change.

## Performance Review

Status: `DONE_WITH_CONCERNS`, Entscheidungen oben eingearbeitet.

Findings:

1. `[P1] (confidence: 8/10) scripts/performance/baseline.json:20` — Der Baseline-Kommentar kennt bereits einen frueheren cold-run LCP-Ausreisser, aber die aktuelle Nightly-Serie zeigt wiederholt 22-23s. Entscheidung: keine Budget-Anhebung; erst Trace/Lokalrepro, dann gezielter App-Fix.
2. `[P2] (confidence: 8/10) .github/workflows/ci.yml:321` — Restore-Key-Verhalten kann alte History laenger mitschleppen. Entscheidung: Cache-Namespace-Bump statt in-place History-Filter.

## Worktree Parallelization Strategy

| Step | Modules touched | Depends on |
| --- | --- | --- |
| Expo patch drift | `mobile/`, lockfiles | — |
| Validator policy + tests | `scripts/performance/`, `test/unit/` | — |
| CI cache namespace | `.github/workflows/` | Validator policy |
| Plan/TODO docs | `docs/`, `TODO.md` | Validator policy decision |
| Optional app performance fix | `mobile/app/`, performance artifacts | Trace classification |

Parallel lanes:

- Lane A: Expo patch drift (independent)
- Lane B: Validator policy + tests -> CI cache namespace -> docs (sequential because the cache decision depends on the final policy)
- Lane C: Optional app performance fix (starts only if Phase 2 proves a real regression)

Execution order:

1. Launch Lane A and Lane B in parallel worktrees if desired.
2. Merge A + B.
3. Run manual workflow probes.
4. Start Lane C only if trace evidence requires it.

Conflict flags:

- Lane A and Lane C can both touch `mobile/`; keep Lane C blocked until after A merges.
- Lane B owns `.github/workflows/ci.yml`; avoid concurrent CI edits.

## TODO Candidates

No new long-lived TODO is required beyond updating the existing Nightly-Strict-Beobachtung item after implementation. The remediation itself should be completed in the next commit rather than deferred.

## Review Summary

- Step 0: Scope Challenge — scope reduced from "maybe app fix" to "policy + Expo drift first; app code only with trace evidence".
- Architecture Review: 3 issues found, all decisions made.
- Code Quality Review: 2 issues found, all decisions made.
- Test Review: coverage diagram produced, 9 required new assertions identified.
- Performance Review: 2 issues found, all decisions made.
- NOT in scope: written.
- What already exists: written.
- TODOS.md updates: 0 new items proposed; update existing TODO after implementation.
- Failure modes: 0 critical gaps if required tests ship.
- Outside voice: skipped; local code and CI artifacts were sufficient.
- Parallelization: 3 lanes, 2 can start parallel, 1 gated by trace evidence.
- Lake Score: 7/7 recommendations chose the complete option.

## Empfohlener naechster Commit

Ein kleiner Remediation-Commit:

- Expo-SDK-55 Patch-Versionen nachziehen.
- `validate-status.mjs` Strict-Readiness-Policy gezielt testen und anpassen.
- Performance-History-Cache auf `performance-history-v5` bumpen.
- Nightly-Runbook/TODO aktualisieren.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 5 | STALE / issues_open | Last relevant CEO review is older than 7 days and not for this remediation plan |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | NOT RUN | Outside voice skipped; local CI artifacts and code were sufficient |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 16 findings reviewed, 0 unresolved, 0 critical gaps; scope reduced to Expo drift + validator policy first |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | NOT REQUIRED | No UI change planned unless trace proves real app regression |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | NOT REQUIRED | CI/operator flow covered by Eng Review |

- **UNRESOLVED:** 0
- **VERDICT:** ENG CLEARED — ready to implement the remediation plan.
