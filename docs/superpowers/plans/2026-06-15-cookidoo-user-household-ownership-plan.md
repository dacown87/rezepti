<!-- /autoplan restore point: /home/patrick/.gstack/projects/rezepti/fix-ci-supabase-northflank-execution-autoplan-restore-20260616-084557.md -->
# Cookidoo User-Default + Optional Household-Share Plan

Datum: 2026-06-15
Status: geplant

## Ziel

Cookidoo-Credentials sollen nicht mehr server-global geteilt sein.

Das eigentliche Produktproblem ist nicht nur ein Storage-Refactor, sondern
Vertrauen und Vorhersehbarkeit:

- ein User soll sicher sein koennen, dass private Cookidoo-Zugangsdaten nicht
  still fuer andere Nutzer gelten
- ein Haushalt soll klar sehen, ob gerade eine private Verbindung oder eine
  explizite Haushaltsfreigabe wirkt
- Support und Rollout duerfen nicht in einem impliziten Mischzustand aus
  Alt-Singleton, privater Verbindung und Haushaltsfreigabe enden

Neue Zielregel:

- Default: `user-scoped`
- Optional: ein User kann die eigenen Cookidoo-Credentials explizit fuer den
  aktiven Haushalt freigeben
- Kein Server-Default und keine globale Singleton-Credential mehr

BYOK/Groq bleibt bewusst der Sonderfall:

- wenn ein User lokal keinen BYOK-Key hinterlegt hat, nutzt der Server weiter
  den konfigurierten `GROQ_API_KEY`
- wenn ein User lokal einen BYOK-Key hinterlegt, wird dieser fuer die Anfrage
  verwendet

## Produktregel

### Cookidoo

- Jeder User startet mit privaten Cookidoo-Credentials.
- In Settings gibt es eine explizite Freigabe-Option fuer den aktiven
  Haushalt.
- Household-Share ist ein aktiver Opt-in, kein implizites Verhalten.
- Bereits vorhandene globale Cookidoo-Credentials werden beim Umstieg
  verworfen, nicht migriert.

### BYOK/Groq

- BYOK bleibt lokal auf dem Geraet/User gespeichert.
- Fehlt lokal ein BYOK-Key, arbeitet die App weiter mit dem Server-Key.
- Diese Ausnahme bleibt in Copy und Doku explizit benannt.

## Scope

- Kleiner Follow-up-Slice fuer Cookidoo-Ownership.
- Datenmodell fuer private und optional haushaltsgeteilte Cookidoo-Credentials.
- API-Regeln fuer lesen, setzen, loeschen und Share-Umschalten.
- Settings-Copy und sichtbare Scope-Anzeige.
- Migrationsregel: globale Altdaten verwerfen.
- Security-Hardening fuer die neue Secret-Tabelle:
  - backend-only Zugriff
  - FK-/Delete-Semantik
  - kein stiller Supabase/Data-API-Lesezugriff auf Klartext-Secrets

## Nicht-Ziele

- Kein Pinterest-/Facebook-Rework.
- Keine allgemeine Credential-Plattform fuer beliebige Provider.
- Keine Multi-Household-Share-Matrix ausser "aktiver Haushalt".
- Kein Umbau des BYOK-Speicherorts.

## Zielmodell

### Datenebene

Cookidoo braucht zwei erlaubte Scope-Typen:

- `user`
- `household`

Minimalregel:

- Ein User kann genau einen privaten Cookidoo-Eintrag haben.
- Ein Haushalt kann hoechstens einen geteilten Cookidoo-Eintrag haben.
- Beim Resolve gilt:
  1. privater User-Eintrag gewinnt
  2. sonst aktiver Household-Eintrag
  3. sonst keine Cookidoo-Credentials
- `aktiver Haushalt` darf kein still serverseitig "erstbester" Membership-
  Fallback sein; die Quelle muss auf der echten aktiven/default Household-
  Auswahl beruhen oder fuer Multi-Household-Nutzer explizit blockiert sein

### Security-Hard-Requirements

- `cookidoo_credentials` ist ein Secret-Store und muss backend-only bleiben:
  entweder `private`-Schema oder `public` + harte Revokes/RLS ohne Client-
  Policies fuer `anon`/`authenticated`
- `user_id` und `household_id` brauchen Foreign Keys mit expliziter
  Delete-Semantik; verwaiste Secrets sind nicht akzeptabel
- Share-Semantik wird explizit als Copy-Modell definiert:
  die Household-Freigabe bleibt bestehen, bis sie aktiv entfernt wird, auch
  wenn der User spaeter private Credentials aendert oder loescht
- Diese Copy-Semantik muss in UI, API-Texten und Tests explizit abgesichert
  werden
- Passwort-/Session-Felder werden als besonders schuetzenswerte Secrets
  behandelt; wenn Klartext in Postgres bleibt, muss das als bewusste
  Server-only-Entscheidung mit begrenztem Blast Radius dokumentiert sein

## API-Richtung

Zielverhalten:

- `GET /api/v1/cookidoo/status`
  - liefert Scope-Info statt nur `connected`
  - z. B. `scope: 'user' | 'household' | 'none'`
- `POST /api/v1/cookidoo/credentials`
  - speichert privat fuer den eingeloggten User
- `POST /api/v1/cookidoo/credentials/share`
  - uebernimmt die aktuellen User-Credentials in den aktiven Haushalt
- `DELETE /api/v1/cookidoo/credentials`
  - loescht den privaten User-Eintrag
- `DELETE /api/v1/cookidoo/credentials/share`
  - entfernt die Household-Freigabe im aktiven Haushalt

Offene Detailentscheidung fuer Implementierung:

- entschieden: Share/Delete-Share nur fuer Household-Owner
- Household-Mitglieder ohne Owner-Rolle duerfen den Share-Status sehen, aber
  nicht veraendern
- `DELETE /api/v1/cookidoo/credentials/share` soll idempotent spezifiziert
  werden: Owner darf den Share entfernen, auch wenn bereits keiner existiert;
  fehlender Share ist kein Policy-Fehler

## UI-Richtung

Settings soll klar zwischen privat und geteilt unterscheiden:

- Standardtext: "Deine Cookidoo-Zugangsdaten sind privat."
- Wenn Household-Share aktiv ist: "Fuer Haushalt freigegeben."
- Eigener Call-to-Action: "Fuer Haushalt freigeben"
- Eigener Call-to-Action: "Haushaltsfreigabe entfernen"
- Sichtbare Anzeige, welche Quelle aktuell effektiv genutzt wird:
  `privat`, `Haushalt` oder `keine`
- Wenn private Credentials die Haushaltsfreigabe uebersteuern, braucht es
  explizite Copy fuer diese Override-Regel
- Wenn ein Member keinen Share aendern darf, braucht die UI einen sichtbaren
  Hinweis statt nur einen deaktivierten Button
- Email- und Passwortfelder brauchen persistente Labels, nicht nur
  Placeholder-Text
- Lade-, Fehler-, Success- und Disabled-Zustaende werden explizit spezifiziert

Wichtig:

- keine Formulierung mehr, die eine globale Server-Verbindung suggeriert
- keine implizite Freigabe beim normalen Speichern
- keine Copy, die nur "privat" oder "geteilt" sagt, ohne die Konsequenz fuer
  andere Household-Mitglieder zu erklaeren

## Migration

Beim Rollout:

- bestehende globale Datei `data/cookidoo-credentials.json` wird verworfen
- bestehende globale Session-Datei wird ebenfalls nicht als gueltiger Shared
  Zustand uebernommen
- User muessen ihre Cookidoo-Daten nach Deploy neu eingeben
- Release Notes und In-App-Copy muessen diese Re-Connect-Pflicht vorher klar
  ankundigen
- Post-Deploy-Verifikation muss pruefen, dass Altdateien weder gelesen noch
  versehentlich als Household-Share dargestellt werden

Das ist absichtlich die sicherste Regel und vermeidet falsche Zuweisung alter
globaler Secrets. Produktseitig ist das aber nur akzeptabel, wenn der Rollout
die erwartete Reibung explizit benennt und beobachtet.

## Tests

Mindestens noetig:

- User A sieht/mutiert nicht die privaten Cookidoo-Credentials von User B
- User ohne private Credentials kann Household-Share nutzen, falls vorhanden
- privater Eintrag hat Vorrang vor Household-Share
- alte globale Datei wird nicht mehr gelesen
- Status-/UI-Copy spiegelt den echten Scope korrekt
- Owner-only-Policy fuer Share/Delete-Share ist mit positiven und negativen
  Faellen abgedeckt
- Resolver-Tests fuer `user > household > none`
- Idempotenz-/Semantik-Test fuer `DELETE /api/v1/cookidoo/credentials/share`
- Multi-Household-Test: Share/Fallback darf nicht an einer still sortierten
  Membership-Auswahl haengen
- DB-/Migrationstest fuer backend-only-Zugriff, FK-Schutz und Delete-Semantik
- Fetcher-/Job-Pfad testet, dass Household-Fallback auch in async/background
  Flows denselben Auth-Context-Snapshot nutzt
- Session-Reset bei Save/Share-Ueberschreiben ist abgedeckt, damit alte
  Cookidoo-Websessions nicht still auf falschem Scope weiterleben
- Share-Copy-Lifecycle ist getestet: private Loeschung/Aenderung hebt den
  bestehenden Household-Share nicht implizit auf

## TODO-Folge

Nach diesem Plan ist Cookidoo kein `server-scoped-singleton` mehr, sondern:

- primaer `user-scoped`
- optional `household-scoped` per expliziter Freigabe

BYOK bleibt separat:

- `device-local` mit optionalem Server-Fallback, wenn kein User-Key gesetzt ist

## GSTACK REVIEW REPORT

Autoplan ausgefuehrt am 2026-06-16 auf Branch `fix/ci-supabase-northflank-execution`
gegen Base `main`.

### Phase 0 Summary

- Plan-Summary: kleiner Ownership-Slice fuer Cookidoo mit `user` als Default,
  optionalem `household`-Share und bewusst verworfener Singleton-Migration.
- UI-Scope: ja. Die Datei spezifiziert Settings-Copy, Statusanzeige und CTA-
  Verhalten.
- DX-Scope: ja, aber nur indirekt. Die developer-facing Surface ist die interne
  API-/Resolver-/Route-Spezifikation, nicht ein externes SDK-Produkt.
- Realer Code-Stand: Die Zielrichtung ist im Repo bereits groesstenteils
  umgesetzt ueber `src/schema.ts`, `src/db-react.ts`, `src/routes/platforms.ts`,
  `mobile/app/(tabs)/settings.tsx` und
  `supabase/migrations/20260615170413_cookidoo_credentials_scoped.sql`.

### Phase 1 — CEO Review

#### Premise Challenge

- Die Kernpraemisse ist richtig: server-globale Cookidoo-Credentials sind nach
  Multi-User-Login ein Vertrauensbruch.
- Der urspruengliche Plantext war aber zu storage-zentriert. Die eigentliche
  Nutzerwirkung ist Privatsphaere, Vorhersehbarkeit und klarer Household-
  Kontext.
- "Legacy verwerfen" bleibt die richtige Sicherheitsentscheidung, braucht aber
  explizite Rollout-Kommunikation, sonst wird ein technischer Safety-Tradeoff
  als ungeplante User-Reibung ausgeliefert.

#### What Already Exists

| Sub-problem | Existing code | Reuse decision |
|---|---|---|
| Scoped persistence | `src/schema.ts`, migration `20260615170413_*` | reuse |
| Resolver precedence | `src/db-react.ts:692-774` | reuse |
| Owner-only share mutation | `src/db-react.ts:634-689`, `src/routes/platforms.ts:71-118` | reuse |
| UI scope/status display | `mobile/app/(tabs)/settings.tsx:871-1011` | reuse |
| Legacy singleton cleanup | `src/fetchers/cookidoo.ts:35-45`, `test/unit/cookidoo-storage.test.ts` | reuse |

#### Dream State Mapping

```text
CURRENT STATE                  THIS PLAN                     12-MONTH IDEAL
global singleton +             explicit user default         provider ownership model
ambiguous trust                + optional household share    across integrations,
                    --->       + clear resolver          ---> auditability, rollout
                               + no legacy fallback          metrics, richer source UX
```

#### Implementation Alternatives

```text
APPROACH A: Minimal Cookidoo Slice
  Summary: Keep Cookidoo-specific ownership model with two scopes and explicit UI.
  Effort:  S
  Risk:    Low
  Pros:    reuses shipped codepaths; smallest blast radius; solves current trust issue
  Cons:    not a general credential framework; future providers may need another slice
  Reuses:  schema, resolver, settings UI, fetcher session writeback

APPROACH B: General Credential Ownership Platform
  Summary: Abstract all provider credentials behind one reusable ownership model now.
  Effort:  L
  Risk:    Med
  Pros:    long-term consistency; fewer provider-specific follow-ups later
  Cons:    scope jump; drags BYOK/Pinterest/Facebook into current slice
  Reuses:  ownership inventory, auth boundaries, existing provider surfaces

APPROACH C: Household-Canonical Source Only
  Summary: Remove private override and make household the only shared source of truth.
  Effort:  M
  Risk:    Med
  Pros:    simpler mental model; less per-user divergence
  Cons:    worse privacy default; forces collaboration even for private use cases
  Reuses:  household auth model and owner role checks
```

Decision: Approach A. It is the right completeness/speed tradeoff for this repo
today and stays compatible with a later generalization.

#### Scope Decisions

- Accepted:
  - owner-only share governance is now explicit
  - rollout communication and verification are part of the slice
  - UI must show effective source and override consequences
- Deferred to `TODO.md`:
  - general provider-agnostic credential ownership platform
  - richer household source identity and audit history
  - business metrics for reconnect/share success in production
- Not in scope:
  - multi-household sharing
  - BYOK storage-model unification
  - Pinterest/Facebook ownership redesign

#### CEO Dual Voices — CONSENSUS TABLE

```text
CEO DUAL VOICES — CONSENSUS TABLE:
═══════════════════════════════════════════════════════════════
  Dimension                           Primary  Codex  Consensus
  ──────────────────────────────────── ─────── ─────  ─────────
  1. Premises valid?                   PARTIAL  PARTIAL CONFIRMED
  2. Right problem to solve?           YES      PARTIAL DISAGREE
  3. Scope calibration correct?        YES      PARTIAL DISAGREE
  4. Alternatives sufficiently explored?PARTIAL NO      CONFIRMED
  5. Competitive/product risks covered?NO       NO      CONFIRMED
  6. 6-month trajectory sound?         PARTIAL  PARTIAL CONFIRMED
═══════════════════════════════════════════════════════════════
```

Codex CLI and an independent architecture subagent both ran. The subagent's
strongest additions were: backend-only secret-store hardening, FK/delete
semantics, active-household ambiguity and explicit share-copy lifecycle.

#### CEO Completion Summary

| Area | Status | Notes |
|---|---|---|
| Problem framing | improved | now explicit user trust/privacy problem |
| Scope | accepted | keep narrow Cookidoo slice |
| Governance | decided | owner-only share/delete-share |
| Rollout risk | open but bounded | requires notice + post-deploy verification |
| Long-term architecture | deferred | general ownership platform stays follow-up |

### Phase 2 — Design Review

#### Design Scope Assessment

- Initial design completeness: 6/10.
- What a 10/10 version needs here: explicit state coverage, visible source
  hierarchy, a11y-safe input labeling, member-vs-owner behavior, and copy for
  override consequences.
- DESIGN.md: not found. Universal product-design rules apply.

#### What Already Exists

- Scoped status chips and source sections already exist in
  `mobile/app/(tabs)/settings.tsx:873-1011`.
- Existing UI already distinguishes `Privat` and `Haushalt`; the gap is not
  layout invention but missing state depth and accessibility specifics.

#### Design Scorecard

| Dimension | Score | Why |
|---|---|---|
| Information architecture | 7/10 | private vs household split is clear, but effective-source hierarchy was implicit |
| Interaction state coverage | 5/10 | loading exists, but owner/member/disabled/error states were under-specified |
| User journey & emotional arc | 6/10 | trust narrative exists, but override consequences were too abstract |
| AI slop risk | 8/10 | concrete and product-specific, not template-speak |
| Design system alignment | 6/10 | reuses current Settings surface, no DESIGN.md anchor |
| Responsive & accessibility | 4/10 | placeholders without persistent labels are not sufficient |
| Unresolved design decisions | 6/10 | owner/member behavior and share removal semantics needed explicit text |

#### Interaction State Coverage

| Feature | Loading | Empty | Error | Success | Partial |
|---|---|---|---|---|---|
| Status load | spinner in status chip | `Nicht verbunden` | inline error toast plus retry affordance | chip reflects source | share exists but private override active |
| Private save | button spinner | disabled until both fields valid | inline/server error | `Privat verbunden` | save succeeds while household share still exists |
| Share action | disabled for non-owner or no private creds | no household share active | policy/server error | `Fuer Haushalt freigegeben` | member can see share but not mutate |
| Share removal | button spinner | already removed | policy/server error | household share removed | private creds remain and still resolve |

#### User Flow

```text
none
  ├── save private ──▶ private connected
  └── household share exists elsewhere ──▶ household connected

private connected
  ├── share as owner ──▶ private override + household share active
  ├── delete private ──▶ household connected or none
  └── save new private creds ──▶ private connected (session reset)

household connected
  ├── save private ──▶ private override active
  └── owner removes share ──▶ none
```

#### Design Litmus

- Brand/product unmistakable in first screen: N/A for settings detail view
- One strong visual anchor present: yes, scoped status chips
- Page understandable by scanning headings only: mostly yes
- Each section has one job: yes
- Cards actually necessary: yes
- Motion improves hierarchy: N/A
- Premium without decorative shadows: yes

### Phase 3 — Engineering Review

#### Step 0 Scope Challenge

- This slice reuses existing modules instead of inventing new services.
- The actual implementation blast radius is about 6 core files plus tests and
  migration, which is acceptable for a follow-up slice.
- No new infrastructure is introduced; the plan correctly rides existing auth,
  household membership and fetcher/session paths.

#### Architecture Diagram

```text
Settings UI
  └── /api/v1/cookidoo/*
        └── Hono route guards (`requireUserAuth`)
              └── auth context (`userId`, memberships, activeHouseholdId)
                    └── db-react resolver/mutators
                          ├── `cookidoo_credentials` secret store
                          │     ├── backend-only read/write boundary
                          │     ├── FK + delete semantics
                          │     └── scope=user|household
                          └── resolver precedence `user > household > none`
                                └── fetcher session writeback / clear
                                      └── authenticated Cookidoo HTML fetch
```

#### Data Flow

```text
INPUT ──▶ VALIDATION ──▶ TRANSFORM ──▶ PERSIST ──▶ OUTPUT
 save       body shape      scope=user     upsert row    status=user
   │             │               │              │             │
   ├── nil  ─▶ 400         empty pwd ─▶ 400     db fail ─▶ 500
   └── bad json ─▶ 400     session reset        success ─▶ JSON success

 share      owner check     copy private   upsert row    status=household
   │             │               │              │             │
   ├── no auth ─▶ 401      no private ─▶ 400    db fail ─▶ 500
   ├── member ─▶ 403       share row reset      success ─▶ JSON success
   └── no household ─▶ 403
```

#### State Machine

```text
none
  ├── save private ─▶ user
  └── resolve household share ─▶ household

user
  ├── share to household ─▶ user + household row exists
  ├── delete private ─▶ household or none
  └── save new private creds ─▶ user (session invalidated)

household
  ├── save private ─▶ user override
  └── owner deletes share ─▶ none
```

#### Error & Rescue Registry

| Method / codepath | What can go wrong | Exception / result | Rescued? | Rescue action | User sees |
|---|---|---|---|---|---|
| `POST /credentials` | invalid json/body | 400 | Y | fail fast | validation error |
| `POST /credentials` | db write fails | thrown error | Y | 500 + log | generic save error |
| `POST /credentials/share` | member is not owner | `false` | Y | 403 policy response | owner-only message |
| `POST /credentials/share` | no private creds | explicit `Error` | Y | 400 mapped error | must save private creds first |
| `DELETE /credentials/share` | member is not owner | `false` | Y | 403 policy response | owner-only message |
| `DELETE /credentials/share` | owner but no share row | currently `false` | PARTIAL | plan now requires idempotent semantic | should not look like policy failure |
| secret table exposure | client/Data API can read secret rows | auth/schema misconfig | N | require backend-only schema/grants/RLS | invisible until breach |
| household selection | multiple memberships resolve wrong household | ambiguous active source | PARTIAL | require explicit active/default household | confusing wrong source |
| fetcher login | stale scope session | 401/403 from upstream | Y | clear scoped session + retry once | transparent retry or fetch failure |

#### Failure Modes Registry

| Codepath | Failure mode | Rescued? | Test? | User sees? | Logged? |
|---|---|---|---|---|---|
| share route | member attempts share | Y | Y route mock | clear 403 | yes |
| delete share route | owner removes missing share | PARTIAL | N | currently ambiguous 403 | yes |
| resolver | private + household both exist | Y | N db-level | predictable but unverified | N/A |
| async fetcher path | background job lacks household snapshot | PARTIAL | N | unexpected unauthenticated fallback | partial |
| save/share overwrite | stale web session reused on wrong scope | Y | N focused | hidden unless fetch fails later | partial |
| secret table | no RLS/revoke/private boundary | N | N | silent blast radius increase | no |
| user/household deletion | orphaned secrets remain | N | N | not user-visible until later | no |

Critical gap threshold check: none of the current gaps are silent security leaks,
except the secret-store boundary itself. That one is a real security hardening
gap and should be treated as blocking scope, not polish.

#### Test Diagram

```text
NEW UX FLOWS
  - Save private Cookidoo credentials
  - Share private creds to household (owner only)
  - Remove household share
  - Private override over active household share

NEW DATA FLOWS
  - `user` row upsert
  - `household` row upsert from private source
  - resolver `user > household > none`
  - scoped session writeback/reset

NEW CODEPATHS
  - owner/member branch in share/remove-share
  - no-private-creds branch on share
  - idempotent delete-share branch
  - background-job household fallback branch

NEW ERROR/RESCUE PATHS
  - invalid request body
  - upstream Cookidoo session expired
  - policy 403 vs business 400 distinction

COVERAGE
  - Route auth + happy path: covered by `test/unit/cookidoo-credentials.test.ts`
  - Legacy singleton cleanup: covered by `test/unit/cookidoo-storage.test.ts`
  - Resolver precedence, scoped session invalidation, async household fallback:
    GAP
```

#### Performance Review

- Query shapes are cheap: single-row upserts/selects on unique partial indexes.
- No N+1 risk in the Cookidoo ownership slice.
- Main performance concern is not DB cost but remote session churn if scope
  changes invalidate cookies frequently. Current session reset behavior is the
  right safety tradeoff.

#### Eng Dual Voices — CONSENSUS TABLE

```text
ENG DUAL VOICES — CONSENSUS TABLE:
═══════════════════════════════════════════════════════════════
  Dimension                           Primary  Subagent  Consensus
  ──────────────────────────────────── ─────── ─────  ─────────
  1. Architecture sound?               YES      PARTIAL  PARTIAL DISAGREE
  2. Test coverage sufficient?         PARTIAL  NO       CONFIRMED
  3. Performance risks addressed?      YES      N/A      N/A
  4. Security threats covered?         PARTIAL  NO       CONFIRMED
  5. Error paths handled?              PARTIAL  PARTIAL  CONFIRMED
  6. Deployment risk manageable?       PARTIAL  PARTIAL  CONFIRMED
═══════════════════════════════════════════════════════════════
```

The independent subagent raised four high-signal architecture/security issues:
backend-only secret-store boundary, FK/delete semantics, active-household
ambiguity for multi-membership users, and explicit share-copy lifecycle.

### Phase 3.5 — DX Review

#### Product Type

- Classified as: internal API/Service plan.
- Primary developer persona: repo maintainer shipping a settings UI plus
  server-side auth/route/model change inside the existing TypeScript service.

#### Developer Persona Card

```text
TARGET DEVELOPER PERSONA
========================
Who:       full-stack maintainer in this repo
Context:   extends auth, DB, routes and mobile settings in one slice
Tolerance: low for policy ambiguity, medium for code complexity
Expects:   explicit route semantics, tests for resolver precedence, rollout notes
```

#### Developer Empathy Narrative

I open the plan and can tell what ownership model is wanted, but not every API
edge I need to implement confidently. I see `GET/POST/DELETE` routes and the
two scopes quickly, which is good. Then I hit the fuzzy parts: who exactly may
share, what `DELETE /share` should do when nothing is shared, what the UI must
show when private and household credentials coexist, and what happens in async
fetcher paths that depend on the active household. I can implement the happy
path fast, but I would still need to stop and inspect existing auth, resolver
and fetcher code to avoid guessing policy or rollout semantics.

#### Competitive Benchmark

Search was not necessary here because this is not an external developer product.
Reference benchmark used: internal slice plans should let an implementer ship
without reopening policy questions.

#### Developer Journey Map

| Stage | Developer does | Friction points | Status |
|---|---|---|---|
| Read plan | infer target behavior | governance rule was fuzzy | fixed |
| Wire routes | map endpoint semantics | delete-share idempotency unclear | fixed |
| Build UI | connect status + CTA states | member/owner/override copy thin | fixed |
| Add tests | map resolver branches | db-level precedence tests missing | open |
| Rollout | prepare deploy notes | reconnect communication absent | fixed |

#### DX Scorecard

```text
+====================================================================+
|              DX PLAN REVIEW — SCORECARD                            |
+====================================================================+
| Dimension            | Score  | Prior  | Trend  |
|----------------------|--------|--------|--------|
| Getting Started      | 7/10   | N/A    | N/A    |
| API/CLI/SDK          | 6/10   | N/A    | N/A    |
| Error Messages       | 6/10   | N/A    | N/A    |
| Documentation        | 7/10   | N/A    | N/A    |
| Upgrade Path         | 5/10   | N/A    | N/A    |
| Dev Environment      | 8/10   | N/A    | N/A    |
| Community            | N/A    | N/A    | N/A    |
| DX Measurement       | 4/10   | N/A    | N/A    |
+--------------------------------------------------------------------+
| TTHW                 | 10 min | N/A    | N/A    |
| Competitive Rank     | Needs Work                                 |
| Magical Moment       | resolved policy + testable route contract  |
| Product Type         | internal API/service plan                  |
| Mode                 | DX POLISH                                  |
| Overall DX           | 6/10                                       |
+====================================================================+
```

#### DX Implementation Checklist

- [ ] route semantics document owner/member/error/idempotent behavior
- [ ] reconnect/rollout note exists for forced re-entry
- [ ] resolver precedence has explicit DB-level tests
- [ ] async household snapshot requirement is named in the plan
- [ ] sensitive credential mutations are observable enough to debug rollout bugs

### Cross-Phase Themes

- Theme: trust must be visible, not just correct in storage. Flagged in CEO,
  Design and DX.
- Theme: policy ambiguity is more dangerous here than code complexity. Flagged in
  CEO, Eng and DX.
- Theme: rollout/reconnect friction needs explicit handling. Flagged in CEO and
  Eng.

### Deferred to TODO.md

- general credential ownership platform across providers
- richer household source identity / "shared by household owner X" UX
- metrics for reconnect completion, share failure rate and rollout support load
- audit logging and operator visibility for credential ownership mutations

### Implementation Tasks

- [ ] **CEO-1 (P1, human: ~2h / CC: ~15min)** — product framing — keep the plan anchored on trust/privacy/household predictability, not only storage scope.
- [ ] **CEO-2 (P1, human: ~1h / CC: ~10min)** — rollout — add explicit reconnect communication and post-deploy verification for discarded legacy credentials.
- [ ] **DESIGN-1 (P1, human: ~2h / CC: ~20min)** — settings UX — specify owner/member/override/loading/error states and persistent field labels.
- [ ] **ENG-1 (P1, human: ~2h / CC: ~20min)** — API contract — define idempotent `DELETE /api/v1/cookidoo/credentials/share` semantics.
- [ ] **ENG-2 (P1, human: ~3h / CC: ~30min)** — tests — add resolver precedence, scoped session reset and async household-snapshot tests.
- [ ] **ENG-3 (P1, human: ~4h / CC: ~45min)** — data security — harden `cookidoo_credentials` to backend-only access and add FK/delete semantics.
- [ ] **ENG-4 (P1, human: ~3h / CC: ~30min)** — multi-household policy — bind Cookidoo sharing/resolution to explicit active/default household semantics instead of opaque membership sorting.
- [ ] **DX-1 (P2, human: ~2h / CC: ~15min)** — implementation ergonomics — document the async household fallback dependency, share-copy lifecycle and route/error semantics in plan or code comments.

## Decision Audit Trail

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|---|---|---|---|---|---|
| 1 | CEO | keep narrow Cookidoo slice | taste | P3 pragmatic | current repo already has the needed primitives; wider abstraction is premature | general provider platform now |
| 2 | CEO | owner-only share governance | mechanical | P5 explicit | lowest ambiguity and aligns with existing household ownership model | member-write share |
| 3 | CEO | keep legacy discard migration | taste | P1 completeness | safest boundary reset, but only with explicit rollout comms | silent migration of unknown singleton state |
| 4 | Design | require effective-source and override copy | mechanical | P1 completeness | private-vs-household precedence is otherwise invisible to users | minimal "private/shared" labels only |
| 5 | Design | require visible field labels | mechanical | P5 explicit | placeholder-only fields are weak a11y and weak trust UI | placeholder-only form |
| 6 | Eng | require idempotent delete-share semantics | mechanical | P5 explicit | same route should not conflate "not owner" with "nothing to delete" | ambiguous 403 for both cases |
| 7 | Eng | backend-only secret-store hardening is in-scope | mechanical | P2 boil lakes | plaintext secrets in `public` without explicit boundary are too risky to defer | "do it later" security follow-up |
| 8 | Eng | require FK/delete semantics | mechanical | P1 completeness | ownership rows must not orphan secrets on user/household deletion | nullable forever/orphan cleanup later |
| 9 | Eng | require explicit multi-household source rule | taste | P5 explicit | opaque server-selected household is unacceptable once multi-membership exists | rely on current membership sort order |
| 10 | Eng | define share as copy-lifecycle semantics | mechanical | P5 explicit | UI/tests must match the fact that shared creds persist after private changes | implicit "share by reference" assumption |
| 11 | DX | run lightweight internal DX pass | mechanical | P3 pragmatic | plan has internal API surface even if not external developer product | skip DX entirely |
