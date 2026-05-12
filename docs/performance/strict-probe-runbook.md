# Strict Probe Runbook

Stand: 2026-05-12

## Ziel

Dieses Runbook steuert die Freigabe fuer den ersten manuellen `workflow_dispatch` mit `perf_enforcement=strict`.

Die Policy bleibt konservativ:

- `push`, `pull_request` und `schedule` bleiben `warn`
- `strict` ist nur ein einzelner manueller Probe-Run
- Freigabe erst bei `artifacts/performance/observation.json -> strictProbeEligible=true`

## Aktueller Status

Stand 2026-05-12 nach frischem lokalem Warm-up-Seed:

- `readiness.ready=true`
- Warm-up-Seed verifiziert
- `strictProbeEligible=false`
- einziger Restblocker: `0/5` beobachtete gruene CI-Warn-Runs

## Freigabekriterien

Alle Bedingungen muessen gleichzeitig erfuellt sein:

1. `artifacts/performance/readiness.json`
   - `ready=true`
   - `checks.metricStabilityMet=true`
2. `artifacts/performance/stability-seed.json`
   - `status=ok`
   - `config.method=simulate`
   - `config.runs=10`
   - `verification.ready=true`
   - Sequenz: `bundle -> warmup -> lighthouse-1..10 -> validate-1..10`
3. `artifacts/performance/observation.json`
   - `strictProbeEligible=true`
   - `runs.consecutiveGreenRuns >= 5`
4. Die 5 CI-Runs muessen echte Warn-Mode-Runs sein, keine lokalen Seeds
5. GitHub-Reruns erhoehen den Zaehler nicht; es zaehlen nur eigenstaendige Workflow-Runs mit neuer `github.run_id`

## Green Run Definition

Ein CI-Run zaehlt nur dann als gruen, wenn alle Felder passen:

- `mode=warn-only`
- `enforcementLevel=warn`
- `throttlingMethod=simulate`
- `lighthouse=ok`
- `expectedRuns=9`
- `successfulRuns=9`
- `warningRuns=0`
- `unavailableRouteCount=0`
- `findingsCount=0`
- `budgetPass=true`
- `validateExitCode=0`

## Pro-Run Checkliste

Nach jedem `performance-audit`-Job in GitHub Actions:

1. Performance-Artefakte oeffnen.
2. `artifacts/performance/observation.json` pruefen.
3. `artifacts/performance/summary.md` gegenlesen.
4. Folgende Felder notieren:
   - `runs.consecutiveGreenRuns`
   - `strictProbeEligible`
   - `readiness.ready`
   - `warmupSeed.ready`
5. Bei Abweichung sofort den ersten nicht-gruenen Grund festhalten.

## Stop Conditions

Der Probe-Run bleibt gesperrt, wenn eines davon zutrifft:

- `strictProbeEligible=false`
- `readiness.ready=false`
- `warmupSeed.ready=false`
- irgendein CI-Run hat `findingsCount>0`
- irgendein CI-Run hat `budgetPass=false`
- irgendein CI-Run hat `warningRuns>0`

## Erster Strict Probe-Run

Erst nach Freigabe:

1. GitHub Actions manuell starten.
2. `workflow_dispatch` fuer `CI` waehlen.
3. Input `perf_enforcement=strict` setzen.
4. Nur einen Probe-Run ausfuehren.

Erwartung fuer Erfolg:

- Job `performance-audit` bleibt gruen
- keine neuen Budgetverletzungen
- keine neue Policy-Ausweitung auf `schedule`, `push` oder `pull_request`

## Nach dem Probe-Run

Wenn der Probe-Run gruen ist:

- Ergebnis in `docs/performance/throttling-analysis.md` und/oder Plan dokumentieren
- keine automatische Policy-Aenderung vornehmen
- gesondert entscheiden, ob und wann `strict` breiter ausgerollt wird

Wenn der Probe-Run rot ist:

- kein zweiter `strict`-Run im Reflex
- zuerst Artefakte sichern
- Ursache als Budget-, Flake- oder Infrastrukturproblem klassifizieren
