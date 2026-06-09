<!-- /autoplan restore point: /c/Users/hofmannp/.gstack/projects/dacown87-rezepti/main-autoplan-restore-20260609-080654.md -->
# Multi-Auth Hardening Plan

Datum: 2026-06-09
Status: Umgesetzt (feat/credential-auth-hotfix, 2026-06-09)

> **Re-Sequencing (Pflicht):** Der /autoplan-Review hat einen LIVE, unauthentifizierten
> Cross-User-Credential-Bug gefunden (Routes in `src/routes/keys.ts` + `src/routes/platforms.ts`
> ohne Auth, oeffentlich erreichbar). Dieser Fix ist jetzt **Schritt 0 (Hotfix zuerst)**,
> nicht mehr Gate 4. Vollstaendiger Review, Decision Audit Trail, Tasks T1-T16 und
> GSTACK REVIEW REPORT stehen am Ende dieser Datei.

## Ziel

Der erste Multi-User- und Auth-Onboarding-Unterbau ist auf `main`, aber der
Web-Pfad und mehrere Ownership-Grenzen sind noch nicht belastbar genug, um
Multi-Auth als wirklich abgeschlossen zu betrachten.

Nach Abschluss dieses Follow-up-Tracks soll gelten:

- Web-Login, Signup, Session-Refresh und Account-/Workspace-Einstieg sind fuer
  normale Nutzung stabil genug.
- Die reale Web-Persistenz fuer Settings/Theme/PDF ist im Auth-Kontext manuell
  abgenommen.
- Es gibt eine explizite Inventur aller noch unklaren oder ungeschuetzten
  User-/Workspace-Grenzen.
- BYOK- und Plattform-Credentials haben eine dokumentierte Zwischenregel oder
  ein sauberes Ownership-Modell, das keine falschen Privacy-Erwartungen
  erzeugt.

## Warum jetzt

Der gelieferte Auth-Onboarding-Slice hat den Grundpfad fuer Signup, Login,
Bootstrap und geschuetzte Mobile-Zustaende geschlossen. Offen ist jetzt nicht
mehr "gibt es Auth?", sondern "ist Multi-Auth im Web und an den
Ownership-Grenzen wirklich belastbar?".

Die vier priorisierten TODOs dafuer sind:

- `TODO.md:21` Web-Auth-/Account-/Workspace-Einstieg stabilisieren
- `TODO.md:52` Web-Persistenz-Abnahme nach Multi-Auth-Stabilisierung
- `TODO.md:41` Weitere ungeschuetzte Ownership-Flaechen inventarisieren
- `TODO.md:40` BYOK- und Plattform-Credential-Ownership

## Nicht-Ziele

- Keine Haushaltseinladungen.
- Kein Multi-Workspace-Switcher.
- Kein OAuth oder Magic Link in diesem Track.
- Kein Recipe-Sharing- oder Collections-Slice.
- Keine direkte Supabase-Data-API-Oeffnung fuer `recipes`.

Diese Punkte bleiben im separaten Folgeplan:
[Auth Onboarding Deferred Follow-Ups Plan](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-06-07-auth-onboarding-deferred-followups-plan.md).

## Arbeitsaufteilung

Dieser Track ist in drei Teilplaene geschnitten:

1. [Web Auth Stabilization and Persistence](/home/patrick/Projekte/rezepti/docs/superpowers/plans/multi-auth-hardening-phases/2026-06-09-web-auth-stabilization-and-web-persistence-plan.md)
2. [Ownership Surface Inventory](/home/patrick/Projekte/rezepti/docs/superpowers/plans/multi-auth-hardening-phases/2026-06-09-ownership-surface-inventory-plan.md)
3. [Credential Ownership Boundary](/home/patrick/Projekte/rezepti/docs/superpowers/plans/multi-auth-hardening-phases/2026-06-09-credential-ownership-plan.md)

## Reihenfolge (re-sequenced /autoplan 2026-06-09)

0. **Credential-Auth-Hotfix zuerst (P0, Tasks T1-T6):** `requireUserAuth` auf die
   Credential-Routes (einzeln, **nicht** den Router blanket-authen — `/api/v1/proxy/image`
   muss offen bleiben), totes `api_keys`-Store+Route droppen, Pinterest/Facebook-Routes
   deaktivieren (501), falsche Privacy-Copy fixen, Unauth-Denied-Tests.
1. Web-Auth-/Account-/Workspace-Einstieg stabilisieren (inkl. Query-Cache nach `userId`
   namespacen — realer New-Tab-Leak, Task T7).
2. Web-Persistenz: **automatisierter Session-E2E als Gate** (Task T12), manuelle Abnahme
   nur noch als Smoke.
3. Ownership-Surface-Inventur (ein `grep`-Pass; `ingredient_dictionary` ergaenzen).
4. Credential-Boundary-Regel formal festziehen (Kern in Schritt 0 bereits umgesetzt).
5. TODOs, Runbooks und Privacy-Copy auf den neuen Stand ziehen.

## Gate-Logik

### Gate 1: Web Auth Ready

Vor Gate 1 muss klar sein:

- Web-Session bleibt ueber Reload und neuen Tab konsistent.
- Auth-Deep-Links oder Redirect-Rueckkehr fuer Confirmation/Reset sind fuer den
  Web-Pfad nachvollziehbar.
- Account-/Workspace-Einstieg ist im Web sichtbar und fuehrt nicht in
  Sackgassen.

### Gate 2: Web Persistence Accepted

Vor Gate 2 muss klar sein:

- Settings-/Theme-/PDF-Zustaende wurden im echten Web-Flow mit eingeloggtem
  User geprueft.
- Reload, neuer Tab und neue Browser-Session wurden manuell getestet.
- Ergebnisse sind als kurzer Abnahme-Report dokumentiert.

### Gate 3: Ownership Inventory Complete

Vor Gate 3 muss klar sein:

- Alle relevanten Routen, Tabellen, disk-backed Konfigurationen und
  Credential-Pfade sind kategorisiert.
- Jeder Fund ist als `user-scoped`, `workspace-scoped`, `global`,
  `admin-only`, `disabled` oder `unknown` markiert.
- Fuer `unknown` gibt es keine stillschweigende Duldung, sondern eine
  Folgeentscheidung.

### Gate 4: Credential Rule Landed

Vor Gate 4 muss klar sein:

- BYOK- und Plattform-Credentials haben pro Pfad eine explizite Sichtbarkeits-
  und Mutationsregel.
- UI- und Doku-Copy versprechen nicht mehr Privacy als der Code liefert.
- Tests decken die gewaehlte Boundary ab.

## Definition of Done

Der Track ist fertig, wenn:

- Web-Multi-Auth fuer normale Nutzung nicht mehr als Blocker in `TODO.md`
  auftaucht.
- Die Persistenz-Abnahme schriftlich vorliegt.
- Die Ownership-Inventur als Referenzdokument existiert.
- Credential-Boundaries technisch und dokumentarisch konsistent sind.

## Risiken

- Web-Probleme koennen aus Expo-Web, Supabase-Session-Persistenz oder
  Query-Cache-Kopplung gleichzeitig kommen. Ohne klare Trennung wird Debugging
  teuer.
- Ownership-Luecken koennen in Randpfaden liegen, die bisher nur lokal oder als
  Admin genutzt wurden.
- Credential-Privacy ist besonders riskant, weil falsche UI-Copy sofort
  Vertrauen zerstoert, selbst wenn noch kein direkter Leak vorliegt.

## Verifikation

- Lokale Root- und Mobile-Tests fuer Auth/Protected Screens.
- Gezielte Web-Manuallaeufe fuer Signup, Login, Logout, Reload, neuer Tab,
  neue Session.
- Route-/Policy-Tests fuer Ownership- und Credential-Grenzen.
- Doku-Check: README, Runbooks, TODO und Settings-Copy duerfen sich nicht
  widersprechen.

## Arbeitsregel

Diese Datei ist der Main-Plan. Fuer konkrete Umsetzung jeweils nur den
betroffenen Teilplan laden und abarbeiten.

---

## Implementiert

Alle Tasks T1-T16 umgesetzt auf `feat/credential-auth-hotfix` (2026-06-09):

- **T1** — `requireUserAuth` auf Credential-Routes in `keys.ts` + `platforms.ts` (individuell, nicht Router-weit).
- **T2** — Falsche Privacy-Copy in `settings.tsx` (Groq-Key + Cookidoo) korrigiert.
- **T3** — Totes `api_keys`-Store+Route + `getApiKeyByHash` (0 Aufrufer) entfernt.
- **T4** — Pinterest/Facebook-Credential-Routes deaktiviert (501).
- **T5** — Contract-Test auf Unauth-Credential-Routes geprueft; kein 200 auf unauth mehr kodifiziert.
- **T6** — `no-token→401` + Cross-User-Denial-Tests fuer alle Credential-Routes hinzugefuegt.
- **T7** — React-Query-Cache nach `userId` namespace-t; Cache-Clear bei User-Wechsel im New-Tab-Fall.
- **T8** — Cookidoo `cookidoo/status` gibt keine Account-Email mehr an nicht-eingeloggte Aufrufer aus.
- **T9** — Abgelaufener `exchangeCodeForSession`-Deep-Link wird jetzt als Fehler sichtbar (statt silent warn).
- **T10** — `account.tsx` zeigt Web-aware Confirmation/Reset-Rueckkehr-Screen; "in der App"-Copy entfernt.
- **T11** — "Session wird wiederhergestellt"-Interstitial in Protected Screens; kein Sign-out-Flash mehr.
- **T12** — Automatisierter Session-E2E (Login → Reload → authed; neuer Kontext → cleared) als Gate.
- **T13** — `ingredient_dictionary`-Admin-Gate-Test hinzugefuegt.
- **T14** — Live-Region-Fehler-Banner, Tab-Rollen und Icon-Labels in `account.tsx` (A11y-Bonus).
- **T15** — Supabase-Englisch-Fehler auf Deutsche Nutzer-Copy gemappt in `account.tsx` (Bonus).
- **T16** — Plan-Doku auf "Umgesetzt" gesetzt; 3 Sub-Plane / 4 Gates als abgeschlossen markiert.

---

# /autoplan Review (2026-06-09, commit 8ff9c5a)

Mode: SELECTIVE EXPANSION. Dual voices: Codex `[unavailable: not installed]`;
Claude independent subagents (CEO, Eng, Design) + verified code reads. Premise gate
answered by user: **Hotfix credentials first.**

## Headline finding (CRITICAL, verified in code)

The credential/key routes are **completely unauthenticated** on the public Northflank
deployment. Independently surfaced by the code-map voice, the CEO voice, and the Eng
voice; verified directly:

- `src/routes/keys.ts` and `src/routes/platforms.ts` mount with **no** `requireAuth`/
  `requireUserAuth` (`src/api-react.ts:23,25`), unlike recipes/planner/extraction.
- Any anonymous caller can: `POST/DELETE /api/v1/keys` (write/delete BYOK hash rows),
  `GET /api/v1/cookidoo/status` (read the stored account **email**, `platforms.ts:16`),
  `POST/DELETE /api/v1/cookidoo|pinterest|facebook` credentials (overwrite/wipe a
  global on-disk plaintext file — `cookidoo.ts` `CREDENTIALS_FILE`).
- The plan sequenced this fix **last** (Gate 4) and framed it as privacy-copy hygiene.

This is now re-sequenced to a standalone **hotfix first** (user decision at premise gate).

## CEO Dual Voices — Consensus Table

```
  Dimension                            Codex   Claude   Consensus
  ------------------------------------ ------- -------- -----------------------------
  1. Premises valid?                   N/A     NO       FLAGGED (web-is-weak premise
                                                        wrong; credentials understated)
  2. Right problem to solve?           N/A     PARTLY   FLAGGED (real problem = unauth
                                                        routes, not web polish; PWA is
                                                        user's own TODO #1)
  3. Scope calibration correct?        N/A     NO       FLAGGED (3 plans/4 gates over-
                                                        built for solo project)
  4. Alternatives explored?            N/A     NO       FLAGGED (disable-unfinished-
                                                        connectors never considered)
  5. Competitive/market risks?         N/A     N/A      not material (hobby app)
  6. 6-month trajectory sound?         N/A     NO       FLAGGED (track stalls at manual
                                                        gate; live bug stays open)
```

## CEO Review Sections (1-11)

**S1 Architecture.** Auth middleware exists and is correctly applied to recipes
(`recipeVisibilityForAuth`/`canMutateRecipeForAuth`, `db-react.ts:57-70`), planner and
shopping (household-scoped). The credential routers are the unguarded outliers. Required
diagram:

```
BEFORE (vulnerable)                          AFTER (hotfix)
 anon ─▶ /keys POST/DELETE ─▶ api_keys        authed ─requireUserAuth▶ /cookidoo/* (admin/global
 anon ─▶ /cookidoo/* ─▶ global plaintext file                          + honest copy)
 anon ─▶ /pinterest,/facebook ─▶ disk files   /pinterest,/facebook ─▶ 501 disabled (unfinished)
 anon ─▶ /proxy/image (SSRF-guarded) ✓         anon ─▶ /proxy/image (UNCHANGED, stays open) ✓
 authed ─▶ recipes/planner/shopping ✓          api_keys store+route ─▶ removed (dead, 0 readers)
```
Finding A1 (auto-decided, P2): do NOT blanket-auth the platforms router — `/api/v1/proxy/image`
(`platforms.ts:181`) is unauth by design for PDF export. Gate the credential routes individually.

**S2 Error & Rescue.** New failure: `requireUserAuth` rejection on credential routes →
must return `401`/`403`, not 500. Existing gap: `registerAuthRedirectObserver` swallows
`exchangeCodeForSession` failures to `console.warn` (`auth.ts`) → expired confirmation
link is a silent dead-end (→ task T9).

**S3 Security.** The headline finding. Plus: `cookidoo/status` leaks the stored email to
any caller even after auth if Cookidoo stays global (→ T8). `api_keys` rows are orphans
(no reader) → dropping removes the surface entirely (→ T3).

**S4 Data flow / interaction edge cases.** Persisted React Query cache
(`query-client.ts`) is not namespaced by userId; the first `onAuthStateChange`
(INITIAL_SESSION) sets the baseline without clearing → new-tab / cold-start can render a
prior user's cached recipes from disk. This is a *real* web bug (the manual "new tab"
gate would pass it intermittently) → T7.

**S5 Code quality.** `getApiKeyByHash` is dead code (zero callers); `storeApiKey` writes a
global row with `userId` always null. DRY/explicit (P4/P5): delete rather than scope.

**S6 Tests.** See test-plan artifact (below). The most important test — unauth/cross-user
credential denial — is unspecified; the contract test may currently codify the
vulnerability (assert 200 on unauth). Manual acceptance is ~70% automatable.

**S7 Performance.** No issues found. The hotfix adds one middleware call per credential
request; negligible. Cache-namespacing (T7) is correctness, not perf.

**S8 Observability.** Gap: failed auth on credential routes and failed deep-link exchange
should log structured context (route, anon, reason). Minor; folded into T1/T9.

**S9 Deployment.** Hotfix is a forward-only code change (no migration if `api_keys` is
dropped — table is unused). Rollback = git revert. No feature flag needed. Low risk.

**S10 Long-term trajectory.** Reversibility 4/5. Deferring credential ownership to
`workspace-scoped` later risks a double migration on connectors — but the recommended
interim (`admin/global` for Cookidoo, `disabled` for Pinterest/Facebook, drop BYOK store)
has near-zero rework because those connectors are single-tenant/unfinished anyway.

**S11 Design & UX.** Two LIVE false-privacy copy strings (critical, see Design phase):
`settings.tsx:662,716` (Groq key "ausschließlich lokal … nie an Dritte" — contradicted by
server-side hash + send to Groq) and `settings.tsx:849,916` (Cookidoo "Verbunden als
{email}" + "nur auf dem Server gespeichert" — implies per-account privacy on a global file).

## Design Dual Voices — Litmus Scorecard

```
  Dimension                         Codex   Claude   Score   Note
  --------------------------------- ------- -------- ------- ---------------------------
  1. Privacy/trust copy truthful?   N/A     NO       2/10    C1/C2 live false claims
  2. Confirmation/reset return arc  N/A     NO       3/10    web dead-end, "in der App"
  3. Reload/session-restore states  N/A     NO       4/10    no "wird wiederhergestellt"
  4. Interaction state coverage     N/A     PARTIAL  5/10    pending/expired states absent
  5. Specificity (UI named?)        N/A     NO       3/10    "stabilisieren", no states
  6. Accessibility basics           N/A     NO       2/10    no live regions/roles/labels
  7. Navigation hierarchy           N/A     PARTIAL  5/10    two entry points, no default
                                                             post-login destination
```

## Eng Dual Voices — Consensus Table

```
  Dimension                     Codex   Claude   Consensus
  ----------------------------- ------- -------- ----------------------------------
  1. Architecture sound?        N/A     PARTIAL  FLAGGED (mis-sequenced; don't blanket-auth)
  2. Test coverage sufficient?  N/A     NO       FLAGGED (manual gate; no denial test)
  3. Performance risks?         N/A     OK       no issues
  4. Security threats covered?  N/A     NO       FLAGGED (S1 critical; status email leak)
  5. Error paths handled?       N/A     NO       FLAGGED (silent deep-link failure)
  6. Deployment risk?           N/A     OK       low (forward-only, table is dead)
```

## DX Review — SKIPPED

Mechanical DX-term match fired (API, endpoint, README, docs), but the substance is an
**internal** REST API consumed only by the app's own frontend — no external developer
audience, no public SDK/CLI, product is not a dev tool, no AI-agent primary user. DX
methodology (TTHW, hello-world, competitive benchmark, magical moment) does not apply.
Skipped per P3 (pragmatic). BYOK key entry is an end-user setting, covered under Design.

## Required Outputs

### NOT in scope (deferred, with rationale)
- Workspace-scoped credential ownership — deferred; needs invites/roles first (rework risk).
- Per-user disk-credential storage for connectors — not built; `disabled`/`admin-global` instead.
- OAuth / Magic Link, invites, multi-workspace, sharing — separate follow-up plan (unchanged).
- Full PWA — user's TODO #1; flagged as possibly higher value than web-auth polish, but out of this track.

### What already exists (reused, not rebuilt)
- `requireUserAuth`/`requireAuth` middleware (`src/auth.ts:221-269`) — applied as-is to credential routes.
- Owner-scoping pattern `recipeVisibilityForAuth`/`canMutateRecipeForAuth` (`db-react.ts:57-70`).
- `api_keys.userId` column exists (`schema.ts:126`) — but table is dead; drop instead of populate.
- `account.tsx:326` "Session wird geprüft…" pattern — reuse for protected-screen restore (T11).
- `settings.tsx:962` Facebook copy is the honest template for corrected C1/C2 copy.
- `mobile/test/query-client-auth-cache.test.ts` — extend for cross-user restore (T7/T12).

### Dream-state delta
This track moves toward the 12-month ideal (clean per-surface ownership + automated session
E2E) **iff** it closes the credential hole and replaces the manual gate with an automated test.
As originally written (credentials last, manual acceptance) it drifted away from durability.

### Error & Rescue Registry
```
  CODEPATH                       | FAILURE              | RESCUED? | RESCUE/USER SEES
  -------------------------------|----------------------|----------|--------------------------
  credential routes (post-fix)   | no/expired token     | Y (new)  | 401, "Bitte anmelden"
  cookidoo/status                | non-owner reads email| N ← GAP  | strip email (T8)
  registerAuthRedirectObserver   | expired code exchange| N ← GAP  | silent → surface error (T9)
  query cache restore            | cross-user cache hit | N ← GAP  | namespace by userId (T7)
  keys store                     | n/a                  | —        | route removed (T3)
```

### Failure Modes Registry
```
  CODEPATH                | FAILURE MODE          | RESCUED? | TEST? | USER SEES   | LOGGED?
  ------------------------|-----------------------|----------|-------|-------------|--------
  /keys, /platforms creds | anon mutation         | N→Y(T1)  | N→Y(T6)| was: silent | N→Y
  cookidoo/status         | email disclosure      | N→Y(T8)  | N→Y(T6)| email leak  | N
  query cache new-tab     | prior-user data render | N→Y(T7) | N→Y(T12)| stale data | N
  deep-link expired       | silent dead-end       | N→Y(T9)  | N→Y    | nothing     | warn
```
Rows with RESCUED=N + USER SEES=silent today → **CRITICAL GAPS** (T1, T7, T9).

## Decision Audit Trail

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|-------|----------|----------------|-----------|-----------|----------|
| 1 | CEO | Re-sequence credential fix to standalone hotfix first | **User Challenge → user chose** | — | Live unauth bug; user confirmed at premise gate | Keep credentials at Gate 4 |
| 2 | CEO | Mode = SELECTIVE EXPANSION | Mechanical | P6 | Iteration on existing system | — |
| 3 | CEO | Approach C (hotfix first + collapse to one track + automated E2E) | Taste | P1+P5 | Closes bug first, drops process theater | A (minimal), B (as-written) |
| 4 | CEO | Disable unfinished Pinterest/Facebook credential routes | Taste | P3/P4 | 0% connectors; near-zero effort removes 2 holes | "Harden ownership" on dead features |
| 5 | Eng | Drop dead `api_keys` store+route instead of scoping | Taste | P4/P5 | Zero readers; migration risk is moot | Backfill userId + scope |
| 6 | Eng | Do NOT blanket-auth platforms router | Mechanical | P5 | Would break unauth `/proxy/image` PDF export | Router-level requireAuth |
| 7 | Eng | Add unauth-denied + cross-user route tests (P1) | Mechanical | P1 | Cheapest guard; would have caught S1 | Defer tests |
| 8 | Eng | Namespace query cache by userId | Mechanical | P1 | Real new-tab data-leak bug | Leave cache global |
| 9 | Eng/CEO | Replace manual acceptance *deliverable* with automated session E2E | **User Challenge** | P1 | Manual gate non-durable, ~70% automatable | Keep manual report as the gate |
| 10 | Design | Fix C1/C2 false-privacy copy now (P1) | Mechanical | P1 | Live false claims = the exact Gate-4 risk | Defer copy to Gate 4 |
| 11 | Design | Spec web confirmation/reset return + reload interstitial | Taste | P1+P5 | Plan lists categories, not states | Leave to implementer |
| 12 | DX | Skip DX phase | Mechanical | P3 | Internal API, no external dev audience | Run DX review |
| 13 | CEO | Collapse 3 sub-plans/4 gates into one track | Taste | P3 | Over-built process for solo project | Keep 4-gate ceremony |

## Implementation Tasks (jq unavailable — rendered inline, not aggregated from JSONL)

**P1 — blocks ship (the hotfix):**
- [ ] **T1 (P1, human ~3h / CC ~20min) — credential routes** — Require `requireUserAuth` on `keys.ts` + `platforms.ts` credential routes individually; keep `/proxy/image` unauth.
  - Surfaced by: CEO premise + Eng S1 + code-map (verified). Files: `src/routes/keys.ts`, `src/routes/platforms.ts`, `src/api-react.ts`. Verify: T6 tests green.
- [ ] **T2 (P1, human ~1h / CC ~10min) — settings copy** — Fix false-privacy copy: `settings.tsx:662,716` (Groq key) + `849,916` (Cookidoo); use the Facebook `:962` voice as template.
  - Surfaced by: Design C1/C2 (verified). Files: `mobile/app/(tabs)/settings.tsx`.
- [ ] **T3 (P1, human ~1h / CC ~10min) — api_keys** — Drop the dead `api_keys` store+route (`getApiKeyByHash` has 0 callers). Files: `src/routes/keys.ts`, `src/db-react.ts`, `src/schema.ts`.
- [ ] **T4 (P1, human ~30min / CC ~5min) — platforms** — Disable unfinished Pinterest+Facebook credential routes (501). Files: `src/routes/platforms.ts`.
- [ ] **T5 (P1, human ~30min / CC ~5min) — contract test** — Audit `contract-api.test.ts`: ensure it does not assert 200 on unauth credential routes. Files: `test/e2e/contract-api.test.ts`.
- [ ] **T6 (P1, human ~2h / CC ~15min) — route auth tests** — Add `no-token→401` + cross-user denial per credential route. Files: `test/unit/`.

**P2 — same branch:**
- [ ] **T7 (P2, human ~3h / CC ~25min) — query cache** — Namespace persisted cache by userId + clear when restored-cache user ≠ session user. Files: `mobile/utils/query-client.ts`.
- [ ] **T8 (P2, human ~30min / CC ~5min) — cookidoo/status** — Strip stored email from `cookidoo/status` for non-owner/unauth. Files: `src/routes/platforms.ts`, `src/fetchers/cookidoo.ts`.
- [ ] **T9 (P2, human ~1h / CC ~10min) — deep-link error** — Surface expired `exchangeCodeForSession` failure instead of silent warn. Files: `mobile/utils/auth.ts`, `mobile/app/account.tsx`.
- [ ] **T10 (P2, human ~3h / CC ~25min) — account.tsx** — Web-aware confirmation/reset return success screen; fix "in der App" copy. Files: `mobile/app/account.tsx`.
- [ ] **T11 (P2, human ~2h / CC ~20min) — protected screens** — "Session wird wiederhergestellt" interstitial; no signed-out flash. Files: `mobile/utils/protected-access.ts`, `mobile/app/_layout.tsx`.
- [ ] **T12 (P2, human ~4h / CC ~30min) — session E2E** — Automated web-session E2E replacing manual acceptance as the gate. Files: `test/e2e`, `mobile/test/query-client-auth-cache.test.ts`.

**P3 — follow-up:**
- [ ] **T13 (P3) — ingredient_dictionary** — Add to inventory hotspots + global-write-path test. Files: `src/db-react.ts`.
- [ ] **T14 (P3) — auth a11y** — Live-region error banners, tab roles, icon labels. Files: `mobile/app/account.tsx`.
- [ ] **T15 (P3) — auth error copy** — Map Supabase English errors to German. Files: `mobile/app/account.tsx`.
- [ ] **T16 (P3) — plan process** — Collapse 3 sub-plans/4 gates into one track; inventory = one grep pass.

## Cross-Phase Themes (flagged independently in 2+ phases)
- **Unauthenticated credential routes** — CEO + Eng + code-map. Highest-confidence signal; verified in code.
- **Manual acceptance gate is weak/automatable** — CEO + Eng (T1/T12).
- **False-privacy copy / email leak** — Design (C1/C2) + Eng (C1/T8).
- **Disable unfinished connectors** — CEO + Eng (S4/T4).

## Completion Summaries

```
  CEO: SELECTIVE EXPANSION | 1 critical (unauth routes) | 13 audit decisions
  Design: 7 dimensions scored, avg ~3.4/10 | 2 critical live copy bugs | 7 findings
  Eng: 4 sections | 1 critical, 4 high, 4 medium | test plan artifact written
  DX: skipped (internal API, no external dev audience)
  Test plan: ~/.gstack/projects/dacown87-rezepti/main-test-plan-20260609-080654.md
```

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | issues_open | SELECTIVE EXPANSION; 1 critical (unauth credential routes), premise reframed |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | codex unavailable (not installed) |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | issues_open | 1 critical, 4 high, 4 medium; test plan written |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | issues_open | 2 critical live copy bugs, 5 hi/med |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | skipped | internal API, no external dev audience |

- **VERDICT:** CEO + ENG + DESIGN reviewed — **APPROVED** (SELECTIVE EXPANSION, all recommendations accepted: hotfix-first, drop dead api_keys, disable Pinterest/Facebook, automated E2E as the gate + manual smoke, fix C1/C2 copy now, collapse to one track). NOT shippable until P1 tasks T1-T6 land — start with the credential hotfix.

NO UNRESOLVED DECISIONS
