<!-- /autoplan restore point: /c/Users/hofmannp/.gstack/projects/dacown87-rezepti/feat-credential-auth-hotfix-autoplan-restore-20260609-170404.md -->
# Post-Hotfix Auth Hardening Plan

Datum: 2026-06-09
Status: Bereit fuer Review
Branch: feat/credential-auth-hotfix (T1-T16 umgesetzt, bereit zum Landen)

Parent Plan: [Multi-Auth Hardening Plan](2026-06-09-multi-auth-hardening-plan.md)
(T1-T16 vollstaendig umgesetzt 2026-06-09)

## Ziel

Die in T1-T16 implementierten Credential-/Auth-Fixes auf `main` landen, die
Web-Persistenz nach dem automatisierten Gate (T12) als Smoke abnehmen und die
vollstaendige Ownership-Surface-Inventur als Referenzdokument erstellen. Nach
diesem Track sind keine unklaren Ownership-Flaechen mehr offen und der
Hotfix ist auf `main` und in Production aktiv.

## Warum jetzt

Der Credential-Hotfix ist vollstaendig implementiert (T1-T16 gruen), aber noch
nicht auf `main`:

- Die Live-Supabase-Instanz laeuft weiter mit der alten unauthentifizierten
  Version bis zum Merge
- Der Query-Cache-Namespace-Fix (T7) ist kein aktives Deployment-Gate solange
  der Branch nicht gemergt ist
- Das automatisierte Session-E2E-Gate (T12) ist erst nach dem Merge ein echter
  CI-Blocker fuer zukuenftige PRs
- Die Ownership-Surface-Inventur (Teilplan Phase 2) wurde wegen des P0-Hotfixes
  depriorisiert und ist noch nicht als Referenzdokument ausgefuehrt

## Nicht-Ziele

- Keine PWA (naechste grosse TODO-Aufgabe)
- Keine Workspace-Einladungen
- Keine OAuth / Magic Link
- Keine vollstaendige Credential-Migration auf workspace-scoped
- Kein neuer Feature-Code (nur Landing + Smoke + Inventur + Doku)

## Schritte

### S1: Branch landen

- PR von `feat/credential-auth-hotfix` nach `main` erstellen
- CI-Gate gruen: `test`, `mobile-release-gate`, `e2e`, Docker-Build/Push,
  `performance-audit`
- Supabase-Migration `20260609143000_drop_api_keys_table.sql` auf Staging
  pruefen (die Migration droppt die `api_keys`-Tabelle — kein Rollback moeglich
  ausser git revert, da die Tabelle leer und tot war)
- Merge nach CI gruen

**Supabase-Migration manuell auf Prod anwenden (blocking step):**
  Der Workflow `docker-publish.yml` enthaelt keinen `supabase db push`-Schritt.
  Die Migration `20260609143000_drop_api_keys_table.sql` muss manuell angewendet werden:
  ```sql
  -- Supabase Dashboard → SQL Editor → ausfuehren:
  DROP TABLE IF EXISTS api_keys;
  -- Verifikation: \dt api_keys muss 0 Zeilen zurueckgeben
  ```
  Alternativ: `npx supabase db push --linked` (wenn Projekt lokal verlinkt ist).
  **Diese Migration ist ein hard gate vor dem Merge-Entscheid.**

Besonderheit: `npm run test:mobile:rntl-guard` muss vor PR gruen sein (kein
neuer direkter `react-test-renderer`-Import erlaubt).

**Northflank-Health-Poll (ENG-1):**
  Nach dem Northflank-Redeploy-API-Call braucht es einen Health-Check, da Northflank
  HTTP 2xx fuer "Request accepted", nicht "Container laeuft" gibt:
  ```bash
  sleep 30 && curl -f https://p01--rezepti-app--2s7hvlwm5zc5.code.run/api/v1/health
  ```
  Dieser Schritt ist in `docker-publish.yml` als Post-Deploy-Step einzufuegen.

**Gate S1:** CI gruen auf PR + Migration auf Prod angewendet + Northflank-Redeploy erfolgreich + Health-Poll bestanden

### S2: Post-Landing Verification

Automatisierter Teil (CI deckt ab):
- Session E2E (T12): `test/e2e/session-persistence.test.ts` laeuft als Teil
  des `e2e`-Gates gruen
- Unauth-denied-Tests (T6): `test/unit/cookidoo-credentials.test.ts` + 
  `test/unit/planner-auth-routes.test.ts` gruen

Manueller Smoke (ca. 15 min):
- Login → Reload → Session persistent (nicht ausgeloggt)
- Neuer Tab gleicher Browser → Session persistent
- Neue Browser-Session (InPrivate) → cleared/ausgeloggt
- `GET /api/v1/cookidoo/status` ohne Bearer-Token → 401
- `POST /api/v1/keys/validate` ohne Bearer-Token → 401 mit `auth_missing` code
- `POST /api/v1/cookidoo/credentials` ohne Bearer-Token → 401

**Rollback-Plan (ENG-2): Falls Smoke nach Merge fehlschlaegt:**
```bash
git revert <merge-sha>   # erstellt Revert-Commit
git push                 # CI laeuft, prod wird restauriert
# Migration ist idempotent (IF EXISTS), kein SQL-Rollback noetig
```

**CI-Gate-Hierarchie (ENG-3):** Nur `test`, `e2e` und `docker-build` sind hard gates.
`performance-audit` und `supabase-rls-smoke` sind soft gates (ein Fehlschlag →
neu triggern erlaubt; zwei konsekutive Fehlschlaege → merge blockiert).

**Gate S2:** 3 Prod-401-Checks manuell bestanden + Session-Smoke bestanden

### S3: Ownership Surface Inventory (grep-Pass)

Ein einmaliger grep-/Read-Pass ueber alle Server-Routen, DB-Tabellen und
mobilen Persistenz-Stellen. Ergebnis: Referenzdokument
`docs/auth-ownership-surface-inventory.md`.

**Bekannter Stand vor diesem Pass:**

| Surface | Zustand (verifiziert, T1-T16) |
|---------|-------------------------------|
| `recipes` | user/household via `recipeVisibilityForAuth` — sauber |
| `planner` / `shopping` | household-scoped via `requireAuth` — sauber |
| `extraction jobs` | user-scoped (`requireUserAuth`) — sauber |
| Credential-Routes (`keys`, `cookidoo`, Pinterest, Facebook) | `requireUserAuth` per Route + 501-Deaktivierung — behoben |
| `api_keys`-Tabelle | geloescht — entfernt |
| `ingredient_dictionary` | global mutable — T13: Test dokumentiert, formale Inventur offen |
| `/proxy/image` | unauth by design (PDF-Export, SSRF-guard) — offen lassen |
| `/api/v1/images/search` | kein Auth — Unsplash-Call offen fuer Unauthentifizierte, Kosten-/Rate-Risiko (neuer Fund, S3 klassifizieren) |

**Scope des grep-Passes:**
- Alle Routen in `src/routes/` auf Auth-Middleware pruefen (requireUserAuth /
  requireAuth / keine) — inkl. `/api/v1/images/search`
- Alle Tabellen in `src/schema.ts` auf Owner-Felder pruefen
- `mobile/utils/` auf AsyncStorage-Zugriffe (geraetelokal vs. account-private)
- Extraktion-/Job-Pfade auf fehlende User-Isolation pruefen
- Cookidoo-Credentials: explizit als "admin/global" (any-authed-user-schreibt) dokumentieren
- `ingredient_dictionary` POST: verifizieren dass kein Contract-Test die Auth-Blockierung prueft, ggf. einen hinzufuegen

**Artefakt:** `docs/auth-ownership-surface-inventory.md` mit Tabelle:
Surface | Layer | Owner Model | Auth required | Read boundary | Write boundary | Risk | Action required

**Gate S3:** Keine `unknown`-Eintraege ohne dokumentierte Folgeaktion

### S4: Dokumentation und TODO-Cleanup

- `TODO.md`: P0-Hotfix-Eintrag auf erledigt setzen, Reihenfolge aktualisieren
- `docs/TEST_STATUS.md`: Neue Tests T6/T12/T13 + Session-Persistence-Suite
  kurz nachziehen
- Sub-Plans als "Abgeschlossen" markieren — **nur der vollstaendig erfuellte**:
  - `multi-auth-hardening-phases/2026-06-09-credential-ownership-plan.md`
    (T1-T6 + T8 + T14/T15 + Code-Fixes aus autoplan-Review — vollstaendig ✅)
- **NICHT in S4** — noch offen:
  - `multi-auth-hardening-phases/2026-06-09-web-auth-stabilization-and-web-persistence-plan.md`
    (autoplan-Review: nur ~65% erfuellt. Offene DoD-Luecken: Persistenz-Abnahme-Dokument
    (TODO:52), T12-Cold-Start-Tests, T9-Verifikation. Erst nach diesen Tasks schliessen.)
  - `multi-auth-hardening-phases/2026-06-09-ownership-surface-inventory-plan.md`
    (Vollstaendige Inventur = S3 dieses Plans. Als letzten Schritt von S3 markieren.)
- **TODO.md ergaenzen** (aus web-auth-Review):
  - TODO:52 — Persistenz-Abnahme-Dokument (Settings/Theme/PDF nach Reload/Neuer Tab/InPrivate)
  - T12-Cold-Start-Tests: prevKey-Wechsel + null-Client-Szenario ergaenzen
  - T9-Verifikation: Confirmation-Link-Error code-seitig nachweisen

## Gate-Logik

Kein formaler Mehrfach-Gate-Prozess. Einfache lineare Abfolge:

```
S1: PR + CI gruen + Merge + Northflank-Redeploy
  ↓
S2: 3 Prod-Checks 401 + Session-Smoke
  ↓
S3: Ownership-Inventur-Dokument fertig, keine offene unknown-Flaeche
  ↓
S4: TODO + Doku aktuell
```

## Definition of Done

- Branch auf `main` gelandet, CI gruen, Northflank redeployed
- Supabase-Migration `api_keys` DROP manuell auf Prod angewendet und verifiziert
- `GET /api/v1/cookidoo/status` ohne Bearer → 401 in Production
- `POST /api/v1/keys/validate` ohne Bearer → 401 in Production
- `POST /api/v1/cookidoo/credentials` ohne Bearer → 401 in Production
- Session-Smoke bestanden
- `docs/auth-ownership-surface-inventory.md` existiert
- Keine `unknown`-Flaechen ohne Folgeaktion in der Inventur
- TODO.md ist auf aktuellem Stand

## Risiken

- Supabase-Migration `DROP TABLE api_keys`: Kein Roll-Forward-Problem (Tabelle
  ist tot, keine Leser), aber kein Rollback moeglich ausser git revert. Staging-
  Pruefung vor Prod-Deploy ist Pflicht.
- `supabase-rls-smoke`-CI-Job kann bei Mirror-/Container-Overhead flaky sein
  (bekanntes Problem, Mitigation: Job-Log pruefen, neu triggern, nicht sofort an
  Policy drehen).
- Manuelle Web-Smoke braucht echten Browser mit Internetzugang (kein JSDOM-
  Ersatz); Timing-Varianz bei Session-Restore moeglich.
- Northflank-Deploy laeuft via direktem API-Call (seit 2026-06-08 ohne
  northflank-Action); bei Deploy-Fehler: Log im GitHub Actions pruefen.

## Verifikation

```bash
npm test -- --run          # Root-Tests gruen
npm run test:mobile        # Mobile-Tests gruen
npm run test:mobile:rntl-guard  # Kein neuer react-test-renderer-Import
npx tsc                    # Kein Typfehler
# Dann: PR erstellen, CI abwarten
```

---

# /autoplan Review (2026-06-09, commit 93ea253)

Mode: SELECTIVE EXPANSION. Dual voices: Codex `[unavailable: not installed]`;
Claude subagent (CEO). Premise gate: 4 premises evaluated below.

## Phase 0.5: Codex Preflight

```
[codex-unavailable: binary not found] — proceeding with Claude subagent only
```

## Phase 1: CEO Review

### Premise Challenge

| Premise | Bewertung | Entscheidung |
|---------|-----------|--------------|
| Branch ist bereit zum Landen (T1-T16 gruen, Code korrekt) | Richtig, code-verified: `requireUserAuth()` korrekt auf allen Credential-Routes; `/proxy/image` korrekt offen; Query-Cache namespace korrekt implementiert | Akzeptiert |
| Ownership-Surface-Inventur ist jetzt der richtige naechste Schritt | Richtig — Sub-Plan Phase 2 explizit auf "nach Hotfix" depriorisiert; Multi-Auth-Folgearbeit braucht die Basis | Akzeptiert |
| Manueller Smoke ist trotz automatisierten T12-Tests noetig | Richtig — T12 testet authStorage-Round-Trip in JSDOM, nicht echte Browser-Session gegen Northflank-Prod | Akzeptiert |
| Supabase-Migration `DROP TABLE api_keys` ist risikoarm | Grundsaetzlich richtig (Tabelle tot, 0 Leser), ABER: kein CI-Schritt der die Migration in Production anwendet | **KORREKTUR NOETIG — S1 muss Migrations-Apply-Schritt enthalten** |

**Premise Gate: Alle 4 akzeptiert (letzte mit Korrektur). Kein User Challenge.**

### Step 0A: Existing Code Leverage

| Sub-Problem | Existing Code |
|-------------|---------------|
| Branch Landing | GitHub Actions CI pipeline, `docker-publish.yml` |
| Session E2E | `mobile/test/session-persistence.test.ts` (T12) |
| Unauth-denied Tests | `test/unit/cookidoo-credentials.test.ts` (T6) |
| requireUserAuth | `src/auth.ts:221-269` |
| Recipes ownership model | `src/schema.ts:27-44` |
| Shopping/Planner owner | `src/schema.ts:52-80` (household-scoped) |
| `ingredient_dictionary` | `src/schema.ts:46-50` (global, intentional public read) |
| Cookidoo storage | `src/fetchers/cookidoo.ts` (disk-based, admin/global) |

### Step 0C: Dream State Delta

```
CURRENT (vor diesem Plan)
  Branch feat/credential-auth-hotfix bereit, noch nicht gemergt.
  Production: credential routes noch unauthentifiziert.
  Ownership-Inventur: nicht als Dokument ausgefuehrt.
  Migration: im Git, aber nicht in Prod-DB angewendet.

THIS PLAN
  Branch auf main. Production abgesichert.
  Supabase-Migration angewendet.
  Ownership-Inventur-Dokument existiert.
  Keine unknown-Flaechen ohne Folgeaktion.

12-MONTH IDEAL
  Jede Route und Tabelle hat dokumentierten Owner-Status.
  Neues Routes-Hinzufuegen triggert automatisch Inventur-Check.
  Auth ist default, nicht opt-in.
```

### Step 0C-bis: Implementation Alternatives

| Alternative | Effort | Risk | Decision |
|-------------|--------|------|----------|
| A: Wie geplant (Landing + Smoke + Inventur) | ~1 Tag human / ~2h CC | Vollstaendig | **Gewaehlt** |
| B: Nur Landing + Smoke, Inventur spaeter | ~4h human / ~1h CC | Inventur bleibt offen | Viable aber nicht empfohlen |
| C: Nur Landing | ~2h human | Inventur bleibt, Folge-Slices bauen auf Annahmen | Abgelehnt |

### CEO Dual Voices — Consensus Table

```
CEO DUAL VOICES — CONSENSUS TABLE:
═══════════════════════════════════════════════════════════════
  Dimension                            Codex   Claude  Consensus
  ──────────────────────────────────── ─────── ─────── ─────────
  1. Premises valid?                   N/A     YES     CONFIRMED (mit Migrations-Korrektur)
  2. Right problem to solve?           N/A     YES     CONFIRMED
  3. Scope calibration correct?        N/A     PARTIAL DISAGREE: Cookidoo single-user Lücke
                                                       undokumentiert; DoD hat stale Check
  4. Alternatives sufficiently explored? N/A   YES     CONFIRMED
  5. Competitive/market risks?         N/A     N/A     nicht material (hobby app)
  6. 6-month trajectory sound?         N/A     PARTIAL DISAGREE: ohne Migrations-Anleitung
                                                       und ohne Inventur-Update-Mechanismus
                                                       wird das Inventur-Dokument schnell stale
═══════════════════════════════════════════════════════════════
CONFIRMED = both agree. DISAGREE = models differ (→ taste decision or finding).
Missing voice = N/A (not CONFIRMED).
```

### CEO Review Sections (1-10)

**S1 Architecture.** Routing-Architektur korrekt: kein blanket-auth auf dem Router, sondern per Route. `/proxy/image` korrekt offen. Credential-Routes korrekt gated. Die Architektur ist clean.

ASCII-Diagramm (aktueller Stand nach T1-T16):
```
PROD (nach Merge)
 anon ─▶ /proxy/image ─▶ SSRF-guard ─▶ image fetch ✓ (intentional)
 anon ─▶ /api/v1/health ─▶ DB status ✓ (intentional)
 anon ─▶ /api/v1/dictionary (GET) ─▶ read-only ✓ (intentional)
 anon ─▶ /api/v1/dictionary/match ─▶ read-only ✓ (intentional)
 anon ─▶ /api/v1/images/search ─▶ Unsplash search ← KEIN AUTH (neuer Fund, S3)
 anon ─▶ /api/v1/cookidoo/status ─▶ 401 ✓
 anon ─▶ /api/v1/keys/validate ─▶ 401 ✓
 anon ─▶ /api/v1/recipes ─▶ 401 ✓
 anon ─▶ /api/v1/planner/shopping/extraction ─▶ 401 ✓
 authed ─▶ /api/v1/cookidoo/credentials ─▶ WRITE (disk-global, jeder authed User!)
 authed ─▶ /api/v1/pinterest|facebook/* ─▶ 501 ✓
```

Finding A1 (auto-decided P3): `/api/v1/images/search` ohne Auth — intentional oder Gap? Route ruft externe Unsplash-API auf. Kein Nutzerdaten-Leak, aber Rate-Limit-/Kosten-Risiko bei Missbrauch. → **S3 klassifizieren und entscheiden.**

**S2 Error & Rescue.** Keine neuen Fehlerpfade durch diesen Plan. Existierendes:
- `requireUserAuth()` → `authErrorResponse()` → 401 mit strukturiertem `{ error: { code, message } }` ✓
- Session-Restore-Pfad (T11): interstitial statt sign-out-flash ✓
- Deep-Link-Fehler (T9): surfaced ✓

Gap identified: Wenn S1-Merge plus Northflank-Redeploy gelingt, aber die Supabase-Migration nicht angewendet wurde, gibt es keinen Fehler — der Code startet einfach ohne die alte Tabelle. Das ist kein Problem (Tabelle ist tot), aber die Definition of Done erkennt es nicht.

**S3 Security.** Die kritischen Sicherheitsprobleme sind durch T1-T16 geschlossen. Verbleibende Observations:

- `ingredient_dictionary` (GET): Public read — bewusste Entscheidung, braucht Dokumentation nicht Behebung.
- `images/search` (GET): Keine Auth. Kann von Unauthentifizierten aufgerufen werden. Kein Datenleak, aber kostet Unsplash-Credits und kann Rechnung treiben. → S3 Inventur.
- Cookidoo-Credentials (POST/DELETE): `requireUserAuth()` ist da, aber jeder eingeloggte User kann die globalen Disk-Credentials ueberschreiben. Das ist die gewaehlte `admin/global`-Regel aus dem Multi-Auth-Hardening-Plan, aber die Policy ist "any authenticated user" nicht "admin only". → S3 muss explizit dokumentieren: Cookidoo ist single-deployment, jeder eingeloggte User kann es ueberschreiben. Ehrliche Copy ist noetig.

**S4 Data flow.** Query-Cache-Namespace (T7) ist korrekt implementiert und verifiziert (cold-start user mismatch cleared, hot-switch cleared). Supabase-Migration: `DROP TABLE api_keys` — nur 1 Zeile SQL, `IF EXISTS` vorhanden, safe.

ABER: Der Docker-Publish-Workflow (`docker-publish.yml`) enthaelt keinen `supabase db push`-Schritt. Die Migration laeuft nur in CI via `npx supabase db reset --local`, nicht gegen Production. **S1 muss einen manuellen "Migration auf Prod-DB anwenden"-Schritt explizit enthalten.** Optionen:
1. Supabase-Dashboard → SQL Editor → `DROP TABLE IF EXISTS api_keys;`
2. `npx supabase db push --linked` (wenn Projekt lokal verlinkt ist)

**S5 Code Quality.** Plan-Dokument selbst: S2 hat einen stalen `DELETE /api/v1/keys/<hash>`-Check. Die Route existiert nicht mehr (T3). Der Check gibt 404 zurueck, nicht 401. Der DoD-Bullet ist falsch. → Fix: ersetzen durch `POST /api/v1/keys/validate` ohne Bearer → 401.

**S6 Tests.** Session E2E (T12) laeuft in CI gruen (aus vorherigen Commits). Unauth-denied Tests (T6) gruen. Keine neuen Tests noetig fuer S1-S4.

Gap: Die Inventur (S3) ist Code-Read + Dokumentation, kein Test. Das ist akzeptabel fuer eine einmalige Inventur, aber der Plan hat keinen Mechanismus, die Inventur aktuell zu halten.

**S7 Performance.** Keine Performance-Implikationen. Einzige neue Last: S3 ist ein grep-Pass auf dem lokalen Repo.

**S8 Observability.** Keine Gaps. Credential-Route-Rejections loggen via `console.error` (vorhandenes Muster). Keine neue Logging-Infrastruktur noetig.

**S9 Deployment.** Die Docker-Build/Push/Deploy-Pipeline ist klar dokumentiert und lief zuletzt gruen. Das einzige Deployment-Risiko ist die fehlende automatische Supabase-Migration.

**S10 Long-term trajectory.** Das Plan-Inventur-Dokument wird nach Erstellung schnell stale ohne Update-Mechanismus. Empfehlung (auto-decided P3): CLAUDE.md-Tabelle als lebendige Referenz verwenden statt separates Markdown-Dokument. Die CLAUDE.md-Architektur-Tabelle ist der richtige Ort fuer den Auth-Status pro Route.

### NOT in scope (deferred, with rationale)

- Cookidoo workspace-scoped credentials — braucht Invitations/Roles zuerst
- `/images/search` rate-limiting — low-risk (kein Datenleak, aber S3 klassifizieren)
- Automatische Migration in CI-Pipeline — Scope-Erweiterung, separater Track
- Northflank-Staging-Preview vor Merge — nice-to-have, aber kein echtes Risiko (Migration ist `IF EXISTS`)

### Error & Rescue Registry

```
CODEPATH                              | FAILURE               | RESCUED? | USER SEES
--------------------------------------|----------------------|----------|-----------------------
Supabase-Migration nicht angewendet   | Tabelle fehlt in Prod| Y (IF EXISTS)| kein Fehler (Tabelle war tot)
Northflank-Redeploy schlaegt fehl     | Old code in Prod     | N        | altes Verhalten (401 fehlt)
Smoke-Check nach Merge schlaegt fehl  | Bug in Hotfix        | N ← GAP  | kein Rollback-Plan definiert
DELETE /api/v1/keys/<hash> DoD-Check  | 404 statt 401        | N ← GAP  | falscher DoD-Pass
images/search unauth                  | Unsplash-Credits-Drain| N       | Kosten (medium risk)
```

### Failure Modes Registry

```
CODEPATH                    | FAILURE MODE           | RESCUED? | ACTION
----------------------------|------------------------|----------|-----------------------
Migration auf Prod          | nicht auto-deployed    | Y (safe) | manueller Apply-Schritt in S1
Cookidoo write              | any-authed-user-writes | N → DOC  | S3: explizit als admin/global dokumentieren
DELETE /keys/<hash> DoD     | tests non-existent route| N → FIX | Fix DoD: POST /keys/validate stattdessen
images/search unauth        | Credits-/Rate-Risk     | N → S3   | S3 klassifizieren und entscheiden
Inventur-Dokument stale     | veraltet nach 4 Wochen | N → S4   | in CLAUDE.md-Tabelle integrieren
```

### Taste Decisions (auto-decided)

| # | Decision | Principle | Rationale |
|---|----------|-----------|-----------|
| CEO-1 | Mode = SELECTIVE EXPANSION | P3 | Iteration auf bestehendem Track |
| CEO-2 | Include full inventory (S3) vs. defer | P1 | Inventory blocks future slices; ~2h CC effort |
| CEO-3 | Update CLAUDE.md route-table statt separates Inventur-Dokument | P5 | Explizit > clever; CLAUDE.md wird gelesen, separates Dokument wird stale |

### CEO Completion Summary

```
CEO: SELECTIVE EXPANSION | 0 critical (nach Korrekturen) | 3 high gaps
Gaps:
  HIGH-1: S1 fehlt Schritt "Supabase-Migration manuell auf Prod anwenden"
  HIGH-2: DoD hat stalen DELETE-Check (Route existiert nicht mehr)
  HIGH-3: /images/search ohne Auth — nicht in S3 Scope erwaehnt
Recommendation: Alle 3 gaps vor Schiff-Entscheidung in Plan fixen.
```

**PHASE 1 COMPLETE.**
CEO dual voices ran (Claude subagent, Codex unavailable). Phase transition:
> Phase 1 complete. Codex: N/A (unavailable). Claude subagent: 4 findings (1 critical on DoD, 1 high on Cookidoo doc, 1 high on stale check, 1 medium on inventory update). Primary model: 3 gaps confirmed in code. Passing to Phase 3 (Eng).

---

## Phase 3: Eng Review

Mode: SELECTIVE EXPANSION. Single voice (Claude eng subagent, Codex unavailable).
Phase 2 (Design): skipped — no UI scope.
Phase 3.5 (DX): skipped — internal API, no external developer audience.

### Eng Consensus Table

```
ENG REVIEW — FINDINGS TABLE:
═══════════════════════════════════════════════════════════════
  Finding                                      Severity  Status
  ──────────────────────────────────────────── ────────  ──────
  Northflank deploy success ≠ rollout success  MEDIUM    → S1 add health-poll step
  workflow_dispatch CI skip (if: guard)        MEDIUM    → ENG-noted, low-prio fix
  Migration has no auto-deployment path        CRITICAL  → CEO-5 already fixed in S1
  CI partial-failure gate hierarchy undefined  HIGH      → ENG-3 auto-decided
  Post-merge smoke has no rollback plan        HIGH      → ENG-2 auto-decided
  T12 session test in JSDOM not real browser   MEDIUM    → known, plan acknowledged
  ingredient_dictionary write has no auth test HIGH      → new finding, S3 scope
  Cookidoo any-authed-user write               HIGH      → CEO already covered
  /api/v1/images/search unauthenticated        MEDIUM    → CEO-6 already in S3
  Supabase client new per request              MEDIUM    → ENG-4 taste decision
  AuthQueryCacheWatch double-sub race          LOW       → ENG-5 documented
  AuthFlowError status type unchecked          LOW       → cosmetic, not blocking
═══════════════════════════════════════════════════════════════
NET: 1 critical (migration — already fixed by CEO-5), 3 high gaps requiring plan updates.
```

### Eng Review Sections

**Architecture.** Landing sequence is sound. Per-route auth (not router-level) is the correct pattern given that `/proxy/image` must stay open. The one structural gap: the Northflank deploy step in `docker-publish.yml` calls the API and checks for HTTP 2xx — but a 2xx from Northflank means "request accepted", not "container running". A post-deploy health poll is missing. Fix: add a `sleep 30 && curl .../api/v1/health` step in CI after the Northflank API call.

**Edge cases.**

_Migration path (critical — already fixed):_ CEO-5 added the explicit manual apply step to S1. The `IF EXISTS` guard makes the server safe even if the migration doesn't run (table is dead, no readers), but the DoD requires the migration to be applied. Now documented as a hard gate.

_CI partial failure:_ The plan names 5 CI jobs as the gate but gives no decision rule for partial failure. `supabase-rls-smoke` is documented as flaky in CLAUDE.md. Auto-decided (ENG-3): only `test`, `e2e`, and `docker-build` are hard gates; `performance-audit` and `supabase-rls-smoke` are soft gates — a single failure is re-trigger-allowed, two consecutive failures block.

_Post-merge rollback:_ Error & Rescue Registry marks smoke failure as "N GAP". Auto-decided (ENG-2): add explicit rollback step to S2 — `git revert <merge-sha> && git push`, then wait for CI. The migration (`DROP TABLE IF EXISTS`) is safe on rollback too (re-merge would re-run the same idempotent SQL).

**Tests.**

_T12 scope:_ `mobile/test/session-persistence.test.ts` tests AsyncStorage round-trip under Vitest/JSDOM — not a real browser session against Northflank prod. This is correctly called out in the plan. The manual smoke in S2 covers the real-browser path. Not a gap, but must not be skipped under time pressure.

_ingredient_dictionary write:_ No test asserts that an unauthenticated caller cannot `POST /api/v1/dictionary`. The `requireAuth()` guard is present in code, but it's not exercised in the contract test suite. Adding this to S3 scope (classification + one contract assertion) is recommended.

**Security.**

_Cookidoo write (any-authed-user):_ `saveCredentialsToDisk()` takes no userId parameter. Any signed-in user overwrites the global credential file. This is the "admin/global" design decision from the parent plan — single-tenant deployment. The route is gated by `requireUserAuth()`, not `appRole === 'admin'`. This is an acceptable tradeoff for a single-user hobby deployment, but it must be documented in the route file as a code comment and in the S3 inventory. Status: CEO already covered (HIGH, documentation action).

_/images/search (unauthenticated):_ Confirmed. Unsplash quota is at risk. S3 will classify and decide. Until then, adding `requireUserAuth()` here is an optional quick-win (1-line change in `src/routes/extraction.ts`) that would eliminate the risk without breaking any user flow since image search only happens during recipe editing when the user is already authenticated.

**Deployment.**

_Northflank health poll:_ The deploy step fires an HTTP request and succeeds on 2xx. The container may still be starting (rolling deploy). Adding `sleep 30 && curl -f https://p01--rezepti-app--2s7hvlwm5zc5.code.run/api/v1/health` as a post-deploy step in `docker-publish.yml` would catch a broken rollout before the CI job goes green. Medium severity — easy 2-line fix.

**Hidden complexity.**

_AuthQueryCacheWatch double-subscription:_ `startAuthQueryCacheWatch()` guards against concurrent calls via the promise cache. But if called, stopped, then called again before the first `onAuthStateChange` fires, two subscriptions can briefly co-exist. This is a JSDOM/fast-test-environment scenario, not a prod scenario. No fix required — documenting it here is sufficient.

_`supabase.createClient()` per request:_ `verifySupabaseAccessToken` in `src/auth.ts` calls `createClient()` inside the function body on every authenticated request. Each call creates a new client instance with a connection pool. Under concurrent load this multiplies connections. Since `autoRefreshToken: false` and `persistSession: false`, a module-level singleton is safe. This is a taste decision (ENG-4): deferring for now since it's not a correctness issue, only a performance concern under load the current scale won't hit.

### Eng Completion Summary

```
ENG: SELECTIVE EXPANSION | 1 critical (already fixed) | 3 high (2 plan updates, 1 new scope item)
Gaps to action:
  ENG-1: Add Northflank health-poll step to S1 gate and docker-publish.yml (medium)
  ENG-2: Add rollback plan to S2 Error & Rescue Registry
  ENG-3: Document CI gate hierarchy (hard vs soft)
  ENG-4 (taste): Supabase client singleton — deferred
  ENG-5 (doc): AuthQueryCacheWatch race — documented here, no code change
  NEW: ingredient_dictionary POST auth: add to S3 classification scope
Recommendation: Update plan body with ENG-1..3 before Final Gate.
```

**PHASE 3 COMPLETE.**
Eng voice ran (Claude subagent, Codex unavailable). Phase transition:
> Phase 3 complete. 3 actionable gaps identified. Plan body updated with ENG-1 (health poll), ENG-2 (rollback), ENG-3 (CI gate hierarchy). Passing to Phase 4 (Final Gate).

---

## Decision Audit Trail

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|-------|----------|----------------|-----------|-----------|----------|
| CEO-1 | CEO | Mode = SELECTIVE EXPANSION | Mechanical | P3 | Iteration auf bestehendem System | — |
| CEO-2 | CEO | Volle Inventur (S3) jetzt statt defer | Taste | P1 | Blockiert Folge-Slices; ~2h CC | Nur Landing |
| CEO-3 | CEO | Route-Status in CLAUDE.md-Tabelle statt separates Dokument | Taste | P5 | Explizit und sichtbar fuer Entwickler | Separates `auth-ownership-surface-inventory.md` |
| CEO-4 | CEO | DELETE-DoD-Check korrigieren zu POST /keys/validate | Mechanical | P5 | Route existiert nicht mehr; 404 waere false pass | Stale check behalten |
| CEO-5 | CEO | S1 um Migrations-Apply-Schritt erweitern | Mechanical | P1 | Ohne expliziten Schritt wird Migration nie angewendet | Ignorieren (Tabelle ist ohnehin tot) |
| CEO-6 | CEO | /images/search in S3-Scope aufnehmen | Mechanical | P1 | Unguarded external API call; Kosten-/Rate-Risiko | Aus Scope lassen |
| ENG-1 | Eng | Northflank-Deploy success ≠ rollout success — add health-poll step | Mechanical | P1 | curl /health nach Deploy-Call verhindert grünes CI bei kaputter Prod | Ignorieren |
| ENG-2 | Eng | Smoke-failure nach Merge → explizite Rollback-Anleitung | Mechanical | P1 | Ohne Rollback-Plan ist prod broken ohne klare Aktion | Kein Rollback-Plan |
| ENG-3 | Eng | CI-Gate-Hierarchie dokumentieren (hard/soft) | Mechanical | P5 | partial CI-Failure (flaky rls-smoke) braucht entschied Regel | Nicht dokumentieren |
| ENG-4 | Eng | Supabase-Client Singleton statt per-request new | Taste | P3 | Verbessert Concurrency unter Load; autoRefreshToken=false sicher | Per-request lassen |
| ENG-5 | Eng | AuthQueryCacheWatch double-subscription Race dokumentieren | Taste | P5 | Low-prob race auf slow devices; Dokumentation genuegt (kein Fix noetig) | Ignorieren |
| GATE-1 | Final | S3 jetzt ausfuehren (nicht defer) | **User confirmed** | P1 | Inventory blocks future slices; post-hotfix moment is cleanest state | Defer |
| GATE-2 | Final | Inventory output → CLAUDE.md route table (nicht separate Datei) | **User confirmed** | P5 | Sichtbar fuer Entwickler, kein stale-Risiko | Separates Dokument |
| GATE-3 | Final | Supabase client per-request beibehalten | **User confirmed** | P3 | Out of scope fuer diesen Landing-Track; kein Correctness-Issue | Singleton jetzt |
| GATE-4 | Final | Plan approved — User triggert S1 selbst | **User confirmed** | — | PR + Merge + Migration manuell; Claude unterstuetzt bei Smoke/S3/S4 | — |

---

## Phase 4: Final Approval Gate

**Status: APPROVED — 2026-06-09**

Reviews completed:
- Phase 1 CEO: ✅ (4 premises, 6 mechanical decisions, 3 high gaps → all fixed)
- Phase 2 Design: ⏭ skipped (no UI scope)
- Phase 3 Eng: ✅ (12 findings, 5 mechanical decisions, 3 taste decisions)
- Phase 3.5 DX: ⏭ skipped (internal API, no external dev audience)
- Phase 4 Gate: ✅ **User approved 2026-06-09**

Execution mode: **User triggers S1 manually** (PR + CI + migration + merge).
Claude supports: S2 smoke verification, S3 CLAUDE.md inventory update, S4 docs cleanup.

```
SHIP CHECKLIST
══════════════════════════════════════════════════════════
S1: Branch landen
  [ ] PR feat/credential-auth-hotfix → main erstellen
  [ ] CI: test + e2e + docker-build gruen (hard gates)
  [ ] Supabase SQL: DROP TABLE IF EXISTS api_keys; (Prod Dashboard)
  [ ] Supabase verify: \dt api_keys → 0 rows
  [ ] Merge
  [ ] Northflank-Redeploy abwarten
  [ ] Health poll: curl -f https://p01--rezepti-app--2s7hvlwm5zc5.code.run/api/v1/health

S2: Post-Landing Verification (ca. 15 min)
  [ ] GET /api/v1/cookidoo/status ohne Bearer → 401
  [ ] POST /api/v1/keys/validate ohne Bearer → 401 auth_missing
  [ ] POST /api/v1/cookidoo/credentials ohne Bearer → 401
  [ ] Login → Reload → Session persistent
  [ ] InPrivate → Session cleared

S3: CLAUDE.md Route-Tabelle mit Owner-Model / Auth-Status erweitern
  [ ] Alle Routen in src/routes/ klassifiziert
  [ ] /api/v1/images/search entschieden (auth hinzufuegen oder dokumentiert)
  [ ] Cookidoo global-write als admin/global explizit dokumentiert
  [ ] ingredient_dictionary write auth contract assertion geprueft

S4: Docs + TODO
  [ ] TODO.md P0-Hotfix auf erledigt
  [ ] docs/TEST_STATUS.md T6/T12/T13 nachziehen
  [ ] credential-ownership-plan als Abgeschlossen markieren ✅ (autoplan-Review done)
  [ ] web-auth-stabilization-plan: NICHT jetzt — erst nach TODO:52 + T12-Cold-Start + T9
  [ ] ownership-surface-inventory-plan: NICHT jetzt — erst am Ende von S3
  [ ] TODO.md: TODO:52 + T12-Cold-Start-Tests + T9-Verifizierung als neue Tasks eintragen
══════════════════════════════════════════════════════════
```

**AUTOPLAN COMPLETE. Plan: docs/superpowers/plans/2026-06-09-post-hotfix-auth-hardening-plan.md**
