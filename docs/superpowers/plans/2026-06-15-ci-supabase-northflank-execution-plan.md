# CI / Supabase / Northflank Track — Reviewed Execution Plan

Stand: 2026-06-15

## Ziel

Den offenen Betriebs-Track mit kleinstmoeglichem, belastbarem Scope schliessen:

- PR-CI fuer den echten aktuellen Fix wieder gruen bekommen
- den reproduzierbaren Root-Testfehler vom historischen Nightly-Laerm trennen
- Supabase und Northflank nur dort anfassen, wo heute noch ein frisches Signal existiert

## Step 0 — Scope Challenge

### Entscheidung

Scope reduziert.

### Warum

- Der Plan mischt einen echten aktuellen Push-Blocker mit bereits getrennten Nightly-Signalen.
- Die Mobile-Drift ist nicht mehr ungeklaert, sondern bereits dokumentiert als lokal verifiziert gruen.
- Northflank ist nicht der aktuelle Blocker, hat aber einen separaten Deploy-Hygiene-Gap, der nicht in denselben Fix-Slice gehoert.

### In Scope

1. Von `origin/main` oder einem frischen Branch darauf arbeiten, nicht vom driftenden lokalen `main`.
2. Den echten roten Root-Test sauber reparieren.
3. Root-Coverage lokal erneut gruen verifizieren.
4. `expo-doctor` plus `expo install --check` isoliert gegen den aktuellen Stand pruefen.
5. Einen PR-Run als Remote-Beweis holen.

### Nicht mehr In Scope fuer diesen Slice

1. `performance-audit` strict fixen.
2. `e2e-legacy-soak` fixen.
3. Supabase CLI oder Advisor-Themen anfassen.
4. Northflank umbauen oder den Deploy-Workflow in demselben Slice aendern.

### Step-0-Findings

- `[P1] (confidence: 10/10) docs/superpowers/plans/2026-06-15-ci-supabase-northflank-execution-plan.md:166-179 — Definition of Done koppelt den Push-CI-Fix unnoetig an Nightly-Follow-ups.`
  - Motivierende Zeilen alt: `- performance-audit strict separat untersuchen`, `- e2e-legacy-soak separat untersuchen`, und in der DoD `die Restthemen performance-audit strict und e2e-legacy-soak entweder separat geplant oder separat gefixt sind`.
  - Entscheidung: Nightly bleibt explizit out of scope. Das ist der kleinere und sauberere Diff.

## Was Bereits Existiert

1. `.github/workflows/ci.yml` trennt die Tracks bereits sauber:
   - `test`
   - `mobile-release-gate`
   - `supabase-rls-smoke`
   - `performance-audit`
   - `e2e-legacy-soak`
2. `docs/2026-06-06-ci-supabase-northflank-check.md` enthaelt schon die historische Expo-Drift-Analyse und eine gruene lokale Verifikation vom 2026-06-08.
3. `test/unit/photo-extraction.test.ts` deckt den Extraction-Router bereits breit ab; der aktuelle Root-Fail ist ein einzelner stale Expectation-Fall, kein fehlender Test-Surface.
4. `.github/workflows/docker-publish.yml` ist schon vom alten Northflank-Action-Wrapper auf direkten API-Call umgestellt.

## Architektur-Review

### 1. Remote-Beweis muss PR-basiert sein, nicht "Push oder PR"

- `[P1] (confidence: 9/10) docs/superpowers/plans/2026-06-15-ci-supabase-northflank-execution-plan.md:157-164 — der Plan laesst offen, ob der Remote-Beweis ueber Push auf main oder ueber PR laeuft.`
- Motivierende Zeilen alt: `- nach lokalen Fixes einen neuen Push-/PR-Lauf erzeugen` und `- GitHub-Actions-Run auswerten`.
- Empfehlung: immer frischer Branch von `origin/main` -> PR -> gruene Required Checks -> erst dann Merge.
- Warum: GitHub Protected Branches erwarten erfolgreiche Required Status Checks vor Merge; "Push direkt auf main als Diagnose" ist der falsche Sicherheitsstandard. GitHub dokumentiert zudem, dass Required Status Checks im strict mode den Branch aktuell zur Basis halten sollen. Quelle: GitHub Docs zu Protected Branches und Required Status Checks.

### 2. Northflank-Deploy-Erfolg ist nicht dasselbe wie Rollout-Erfolg

- `[P2] (confidence: 10/10) .github/workflows/docker-publish.yml:52-68 — der Workflow prueft nur HTTP 2xx vom Deploy-API-Call, aber keinen nachgelagerten App-Health-Check.`
- Motivierende Zeilen:
  - `http_code=$(curl -sS -o "$response_file" -w "%{http_code}" ... /deployment ...)`
  - `if [ "$http_code" -lt 200 ] || [ "$http_code" -ge 300 ]; then ...`
  - `echo "Northflank deploy succeeded"`
- Entscheidung: nicht in diesem Slice bauen, aber als expliziten Follow-up festhalten.
- Warum: Ein akzeptierter Deploy-Request beweist nicht, dass der neue Container wirklich gesund hochkommt. Das ist ein echter Produktions-Gap, aber kein Grund, den aktuellen CI-Fix-Slice aufzublaehen.

## Code-Quality-Review

### 1. Die aktuelle Root-Fehlerdiagnose zeigt auf den falschen Testfall

- `[P1] (confidence: 10/10) test/unit/photo-extraction.test.ts:274-297 — der rote Test sitzt aktuell im URL-Extraction-Fall ohne aktiven Haushalt, nicht im Foto-Fall.`
- Motivierende Zeilen:
  - `it('creates user-owned URL extraction jobs without an active household', async () => {`
  - `activeHouseholdId: null,`
  - `expect(mockCreateJob).toHaveBeenCalledWith(... userId,)`
- Gegenbeleg aus der Runtime-Implementierung:
  - `src/routes/extraction.ts:101` ruft `jobManager.createJob(url, userAgent, apiKeyHash, auth.userId, auth.activeHouseholdId);`
  - `src/job-manager.ts:73` deklariert `createJob(url, userAgent, apiKeyHash, userId, activeHouseholdId)`.
- Entscheidung: Plan auf den echten failing assertion scope umschreiben.
- Warum: Explizit vor clever. Wenn die Diagnose falsch ist, fixen wir im Blindflug.

### 2. Der Plan dupliziert bereits abgeschlossene Expo-Drift-Diagnose

- `[P2] (confidence: 9/10) docs/2026-06-06-ci-supabase-northflank-check.md:97-138 — die historische Expo-Drift ist bereits analysiert und lokal gruen verifiziert.`
- Motivierende Zeilen:
  - `expo-doctor blockiert den Job wegen SDK-Patch-Drift`
  - `Folgende lokale Verifikation lief am 2026-06-08 erfolgreich durch`
  - `Lokales mobile-release-gate: gruen`
- Entscheidung: Im Ausfuehrungsplan nicht noch einmal Ursachenforschung spielen, sondern nur einen frischen Repro-Check fahren.
- Warum: DRY gilt auch fuer Ops-Dokumente. Der neue Plan soll den naechsten Schritt beschreiben, nicht den erledigten Forensik-Teil wiederholen.

## Ausfuehrungsreihenfolge

### Phase 1 — Saubere Arbeitsbasis

- `git fetch origin`
- frischen Arbeitsbranch von `origin/main` anlegen
- keinen Fix auf dem driftenden lokalen `main` anfangen

Abschlusskriterium:

- Arbeitsbranch basiert 1:1 auf `origin/main`

### Phase 2 — Root-CI-Fix

- `test/unit/photo-extraction.test.ts` auf die 5-Argument-Signatur im URL-no-household-Fall anpassen
- falls Coverage danach weiter rot bleibt, nur die naechsten echten Failures aufnehmen, nicht parallel Nightly untersuchen

Abschlusskriterium:

- `npm run test:coverage` lokal gruen

### Phase 3 — Mobile Gate nur als Frische-Check

- `cd mobile && npx expo install --check`
- `cd mobile && CI=1 npx expo-doctor`
- nur wenn einer der beiden wirklich rot ist: restliche Mobile-Gate-Bausteine einzeln laufen lassen

Abschlusskriterium:

- entweder frischer reproduzierbarer Mobile-Fehler
- oder belastbarer Nachweis, dass der historische rote Push-Befund stale war

### Phase 4 — Remote-Beweis

- Branch pushen
- PR oeffnen
- CI-Run fuer denselben Head auswerten

Abschlusskriterium:

- PR-Checks fuer `test`, `mobile-release-gate`, `e2e`, `supabase-rls-smoke`, `performance-audit` sind fuer den Fix-Head gruen oder bewusst nicht Bestandteil des Slice

## Test-Review

### Framework

- Root: Vitest laut `CLAUDE.md` und `vitest.config.ts`
- Mobile: Vitest laut `package.json` / `mobile`-Scripts

### ASCII-Coverage-Diagram

```text
CODE PATHS                                              USER FLOWS
[+] src/routes/extraction.ts                            [+] PR CI recovery
  └── POST /api/v1/extract/react                          ├── [GAP][CRITICAL] fresh branch from origin/main
      ├── [★★★ TESTED] auth + url validation              ├── [GAP][CRITICAL] stale URL no-household assertion fixed
      ├── [★★  TESTED] duplicate URL -> 409               ├── [GAP] root coverage rerun on same head
      ├── [GAP][CRITICAL] activeHouseholdId = null        └── [GAP] remote PR run evaluated before merge
      └── [★★  TESTED] job polling / ownership

[+] .github/workflows/ci.yml                            [+] Mobile gate freshness
  └── mobile-release-gate                                 ├── [GAP] expo install --check before doctor
      ├── Install mobile deps                             ├── [UNVERIFIED] direct expo-doctor output in current shell
      ├── Install root deps                               └── [★★  TESTED] historic local green run documented
      ├── Run Expo Doctor
      ├── RNTL guard
      ├── Typecheck
      ├── Build web
      └── Mobile coverage

[+] .github/workflows/docker-publish.yml                [+] Post-merge rollout confidence
  └── Northflank deploy API call                          ├── [GAP][→E2E] health poll after deploy
      ├── [★★  TESTED] 2xx request acceptance             └── [GAP] explicit prod-ready signal
      └── [GAP] runtime health confirmation

COVERAGE: 5/12 paths tested (42%) | Code paths: 5/9 (56%) | User flows: 0/3 (0%)
QUALITY: ★★★:1 ★★:4 ★:0 | GAPS: 7 (1 E2E, 0 eval)
```

### Verifizierte Gaps

1. **CRITICAL regression test**
   - Die aktuelle Assertion in `test/unit/photo-extraction.test.ts:292-297` erwartet 4 Argumente, der Code liefert 5 mit `null` fuer `activeHouseholdId`.
2. **Fresh mobile repro signal**
   - `expo-doctor` ist laut Ops-Doku historisch gruen, aber im aktuellen lokalen Shell-Lauf hier ohne verwertbaren Output gehaengt; der Plan braucht deshalb `expo install --check` plus isolierten Doctor-Lauf als expliziten Schritt.
3. **Deploy smoke gap**
   - Der Docker/Northflank-Workflow bestaetigt Request-Annahme, aber nicht den Live-Health-Zustand.

### Failure Modes

| Codepath | Realistischer Prod-Fail | Test deckt ab | Error Handling | Nutzerbild |
|---|---|---:|---:|---|
| URL extraction without household | stale mock expectation blockiert CI obwohl Runtime korrekt ist | nein | n/a | silent developer failure |
| Mobile gate / Expo Doctor | SDK rule oder dependency drift taucht wieder auf | teilweise | ja, CI failt hart | klarer CI-Fail |
| Northflank deploy API call | Deploy accepted, container startet defekt | nein | nein | silent false green |

Kritischer Gap:

- Northflank rollout success hat aktuell **kein** nachgelagertes Health-Signal.

## Performance-Review

Keine neuen Laufzeit- oder Query-Performance-Issues im Scope dieses Plans.

- `performance-audit` ist bereits als separater Job und separater Nightly-Pfad modelliert.
- Das hier ist ein CI-Recovery-Slice, kein Performance-Remediation-Slice.

## NOT in Scope

1. `performance-audit` strict fixen — eigener Nightly-Track, bereits getrennt im Workflow.
2. `e2e-legacy-soak` fixen — eigener Legacy-Soak-Track, nicht PR-blockierend.
3. Supabase CLI/Advisor nachziehen — kein frisches Fehlersignal im aktuellen Push-Track.
4. Northflank deploy redesign — echter Follow-up, aber nicht noetig um den aktuellen Root-CI-Blocker zu schliessen.

## TODOS.md Updates

Vorgeschlagener Folgepunkt:

- **Northflank post-deploy health poll**
  - What: Nach `Deploy to Northflank` einen echten `/api/v1/health` Poll einbauen.
  - Why: 2xx vom Deploy-Endpoint beweist nur Request-Annahme, nicht gesunden Rollout.
  - Depends on / blocked by: kein Blocker; eigener kleiner Workflow-Slice.
  - Entscheidung: als spaeterer TODO, nicht in diesem PR bauen.

## Worktree-Parallelisierung

| Step | Modules touched | Depends on |
|---|---|---|
| Root-CI regression fix | `test/`, `src/routes/`, `src/job-manager.ts` | — |
| Mobile freshness check | `mobile/`, `.github/workflows/ci.yml` nur lesend | — |
| Deploy health follow-up | `.github/workflows/`, docs | Root-CI remote proof abgeschlossen |

Parallel lanes:

- Lane A: Root-CI regression fix -> root coverage rerun (sequenziell, shared `test/`)
- Lane B: Mobile freshness check (unabhaengig)
- Lane C: Deploy health follow-up (spaeter, shared `.github/workflows/`)

Execution order:

- A + B parallel starten.
- Nach gruener Diagnose A abschliessen und PR-CI laufen lassen.
- C separat danach oder als eigenen kleinen Infra-Slice.

Conflict flags:

- Lane A und C teilen keine Module.
- Lane B und C koennen bei Workflow-Aenderungen kollidieren, falls man doch denselben CI-Fix-PR ueberlaedt. Besser getrennt lassen.

## Implementation Tasks

Synthesized from this review's findings. Each task derives from a specific finding above.

- [ ] **T1 (P1, human: ~20min / CC: ~5min)** — Root CI — stale URL no-household assertion auf 5-Argument-Signatur anpassen
  - Surfaced by: Code Quality Review — `test/unit/photo-extraction.test.ts:274-297`
  - Files: `test/unit/photo-extraction.test.ts`
  - Verify: `npx vitest run test/unit/photo-extraction.test.ts`

- [ ] **T2 (P1, human: ~30min / CC: ~10min)** — Root CI — kompletten Root-Coverage-Run auf demselben Head erneut grün ziehen
  - Surfaced by: Test Review — root coverage is the real blocking gate
  - Files: `test/unit/photo-extraction.test.ts`, ggf. weitere echte failing tests
  - Verify: `npm run test:coverage`

- [ ] **T3 (P2, human: ~20min / CC: ~5min)** — Mobile verification — frischen `expo install --check` + `expo-doctor` Repro-Check dokumentieren
  - Surfaced by: Test Review — current shell run produced no usable Doctor output
  - Files: ops doc / plan docs only unless a fresh mobile failure is reproduced
  - Verify: `cd mobile && npx expo install --check && CI=1 npx expo-doctor`

- [ ] **T4 (P3, human: ~30min / CC: ~10min)** — Deploy hygiene — Northflank health poll als separaten Infra-Follow-up planen
  - Surfaced by: Architecture Review — `.github/workflows/docker-publish.yml:52-68`
  - Files: `.github/workflows/docker-publish.yml`, `TODO.md`
  - Verify: post-deploy `curl -f https://p01--rezepti-app--2s7hvlwm5zc5.code.run/api/v1/health`

## Completion Summary

- Step 0: Scope Challenge — scope reduced per recommendation
- Architecture Review: 2 issues found
- Code Quality Review: 2 issues found
- Test Review: diagram produced, 7 gaps identified
- Performance Review: 0 issues found
- NOT in scope: written
- What already exists: written
- TODOS.md updates: 1 item proposed
- Failure modes: 1 critical gap flagged
- Outside voice: skipped
- Parallelization: 3 lanes, 2 parallel / 1 sequential
- Lake Score: 3/3 recommendations chose the complete option

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 4 issues reviewed, scope reduced, 1 deploy-health follow-up |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **UNRESOLVED:** 0
- **VERDICT:** ENG CLEARED — ready to implement the reduced slice. Nightly and deploy-hygiene follow-ups stay separate.
