<!-- /autoplan restore point: /home/patrick/.gstack/projects/unknown/main-autoplan-restore-20260607-064603.md -->

# Auth Onboarding Slice Plan

Datum: 2026-06-07
Status: Geplant

## Ziel

Der Multi-User-/Ownership-Unterbau ist technisch weitgehend vorhanden, aber fuer
normale Nutzer noch nicht fertig benutzbar. Dieser Slice schliesst die sichtbare
Luecke: Ein Nutzer kann einen Account erstellen, sich anmelden und danach ohne
manuellen Supabase-Bootstrap Shopping, Planner und eigene Rezepte nutzen.

Nach Abschluss soll gelten:

- Nutzer koennen in der App einen Account mit E-Mail und Passwort erstellen.
- Nutzer koennen sich anmelden und abmelden.
- Nutzer koennen einen Passwort-Reset-Link anfordern und erhalten klare
  Erfolg-/Fehlerzustaende.
- Nach Signup oder erstem Login existieren `user_profiles`, ein Default-Haushalt
  und eine `household_memberships`-Zeile.
- Geschuetzte Screens zeigen bei fehlender Session keinen leeren Datenzustand,
  sondern einen klaren Login-/Session-Hinweis.
- Ein neuer Nutzer laeuft nicht mehr in `no_household`, solange der Bootstrap
  erfolgreich ist.
- Web/Mobile haben einen sichtbaren Account-Einstieg.

## Nicht-Ziele

- Keine Haushaltseinladungen.
- Kein Wechsel zwischen mehreren Haushalten.
- Kein OAuth.
- Keine Admin-Oberflaeche.
- Kein Recipe-Sharing oder Copy-Flow.
- Keine BYOK-/Plattform-Credential-Ownership.
- Keine direkte Supabase Data-API-Oeffnung fuer `recipes`.

Diese Punkte stehen im Folgeplan:
[Auth Onboarding Deferred Follow-Up Plan](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-06-07-auth-onboarding-deferred-followups-plan.md).

## Ausgangslage

Bereits vorhanden:

- Server verifiziert Supabase Bearer Tokens in `src/auth.ts`.
- Shopping und Planner verlangen Auth plus aktiven Haushalt in
  `src/routes/planner.ts`.
- Recipes verlangen Auth und nutzen das neue Owner-Modell in
  `src/routes/recipes.ts`.
- Mobile API-Requests koennen Bearer Tokens ueber `mobile/utils/api.ts`
  mitsenden.
- `mobile/app/(tabs)/settings.tsx` hat bereits einen Account-Block mit
  E-Mail-/Passwort-Login und Logout.

Offen:

- Es gibt keinen App-seitigen Signup-Flow.
- Es gibt keinen produktnahen Bootstrap-Endpoint fuer Profil, Haushalt und
  Membership.
- Ein neuer Nutzer ohne manuell vorbereiteten Haushalt bekommt fuer
  Shopping/Planner `no_household`.
- Die Account-UI zeigt noch keinen klaren Account-/Workspace-Status.
- Web-Nutzer sehen nicht zwingend einen offensichtlichen Login-/Account-Einstieg.
- `TODO.md` und Teile der Auth-Doku sind nicht mehr synchron mit dem aktuellen
  Codezustand.

## Architekturentscheidung

Der Slice nutzt einen Server-Bootstrap-Endpoint statt clientseitiger direkter
Writes auf `user_profiles`, `households` und `household_memberships`.

Empfohlener Endpoint:

```text
POST /api/v1/auth/bootstrap
Authorization: Bearer <Supabase access token>
```

Verhalten:

- Verifiziert den User ueber bestehende `requireUserAuth`-Logik.
- Erstellt `user_profiles`, falls fehlt.
- Erstellt einen Default-Haushalt, falls der User keine Membership hat.
- Erstellt eine Owner-Membership fuer diesen Haushalt.
- Ist idempotent: mehrfaches Aufrufen erzeugt keine Duplikate.
- Gibt den aktuellen Account-/Workspace-/Membership-Status zurueck.

Beispielantwort:

```json
{
  "status": "ready",
  "result": "created",
  "profile": {
    "ready": true,
    "userId": "uuid",
    "email": "user@example.test",
    "appRole": "user"
  },
  "workspace": {
    "ready": true,
    "id": "uuid",
    "name": "Mein Workspace",
    "isDefault": true
  },
  "membership": {
    "ready": true,
    "householdId": "uuid",
    "role": "owner"
  },
  "warnings": []
}
```

## Phasen

Die Umsetzungsdetails liegen in separaten Phasenplaenen:

1. [Server Bootstrap](auth-onboarding-phases/2026-06-07-auth-onboarding-implementation-phase-1-server-bootstrap.md)
2. [Mobile Auth Utility](auth-onboarding-phases/2026-06-07-auth-onboarding-implementation-phase-2-mobile-auth.md)
3. [Account & Workspace Route](auth-onboarding-phases/2026-06-07-auth-onboarding-implementation-phase-3-account-workspace.md)
4. [Geschuetzte Screen-Zustaende](auth-onboarding-phases/2026-06-07-auth-onboarding-implementation-phase-4-protected-states.md)
5. [Web Account Einstieg](auth-onboarding-phases/2026-06-07-auth-onboarding-implementation-phase-5-web-account-entry.md)
6. [Tests](auth-onboarding-phases/2026-06-07-auth-onboarding-implementation-phase-6-tests.md)
7. [Doku und aktive TODOs](auth-onboarding-phases/2026-06-07-auth-onboarding-implementation-phase-7-docs-todo.md)

## Risiken

- Supabase kann Signup mit E-Mail-Bestaetigung konfigurieren. Dann liefert
  Signup eventuell keine sofort nutzbare Session. Die UI muss diesen Zustand
  explizit behandeln.
- Bootstrap muss idempotent sein, sonst erzeugt Retry/Netzwerkfehler doppelte
  Haushalte.
- Web-Fallback fuer Auth-Storage nutzt AsyncStorage statt SecureStore. Das ist
  fuer Expo-Web akzeptiert, muss aber nicht als Hochsicherheitsversprechen
  verkauft werden.
- Wenn bestehende Screens Auth-Fehler als leere Daten behandeln, wirkt Login wie
  Datenverlust.

## Empfohlene Reihenfolge

1. Server-Bootstrap-Endpoint und DB-Helper.
2. Tests fuer Bootstrap.
3. Mobile Signup/Login/Reset ruft Bootstrap bzw. Supabase Auth sauber auf.
4. Account & Workspace Route bauen; Settings verlinkt dorthin.
5. Geschuetzte Screen-Zustaende pruefen und fixen.
6. Web-Einstieg und Confirmation/Reset Deep Links pruefen.
7. Doku/TODO aktualisieren.
8. Vollstaendige Verifikation laufen lassen.

---


## Detailplaene

Diese Datei ist der Main-Plan. Fuer Detailarbeit nur den relevanten Phasenplan laden:

- [Phase 1 CEO Review](auth-onboarding-phases/2026-06-07-auth-onboarding-phase-1-ceo-plan.md) — Produktumfang, Scope-Entscheidungen, CEO-Aufgaben.
- [Phase 2 Design Review](auth-onboarding-phases/2026-06-07-auth-onboarding-phase-2-design-plan.md) — Account-&-Workspace-UX, Copy, Accessibility, Design-Aufgaben.
- [Phase 3 Engineering Review](auth-onboarding-phases/2026-06-07-auth-onboarding-phase-3-engineering-plan.md) — Architektur, Datenmodell, Tests, Rollout, Eng-Aufgaben.
- [Phase 3.5 DX Review](auth-onboarding-phases/2026-06-07-auth-onboarding-phase-3-5-dx-plan.md) — Runbook, API-Vertrag, Testskripte, Supabase-Konfig, DX-Aufgaben.

Arbeitsregel: Main-Plan fuer Orientierung und Entscheidungen lesen; danach nur den Phasenplan, der zur aktuellen Aufgabe passt.

## Decision Audit Trail

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|---|---|---|---|---|---|
| 1 | CEO | Use SELECTIVE EXPANSION mode | Mechanical | P2/P6 | Core plan is right, but small blast-radius additions materially reduce launch risk. | Hold-scope-only review |
| 2 | CEO | Adopt "First Trusted Workspace" framing | User Challenge accepted by user | P1/P2 | Both outside voices agree auth rows are a proxy; durable first-session value is the real outcome. User chose option A. | Keep "auth onboarding" as only frame |
| 3 | CEO | Keep server bootstrap endpoint | Mechanical | P3/P5 | Reuses existing auth boundary and avoids client-side table writes. | Direct Supabase client writes |
| 4 | CEO | Defer full collaborative auth features | Mechanical | P3/P4 | Invites/switching/sharing are meaningful but outside this slice's blast radius. | Expand into full household collaboration |
| 5 | CEO | Treat email confirmation behavior as in-scope | Mechanical | P1 | Signup can return no session; silent failure would strand users before bootstrap. | Leave as generic risk note |
| 6 | CEO | Include minimal password reset in this slice | Taste accepted by user | P1/P6 | Persistent email/password accounts need a basic recovery path. User chose to include a minimal Supabase reset-link flow now. | Defer password reset to P1 follow-up, or add full recovery/support tooling |
| 7 | Design | Use a dedicated Account & Workspace route/screen | Taste accepted by user | P1/P5 | Both design voices flagged Settings-only auth as hidden onboarding; user chose a dedicated route/screen over a Settings-first implementation. | Leave Settings as primary account surface, or defer route until later |
| 8 | Design | Use workspace language in UI and keep household as internal/data-model term | Mechanical | P5 | The user needs a personal saved workspace; "Haushalt" implies collaboration before invites exist. | Foreground "Haushalt" everywhere |
| 9 | Design | Require shared guarded-screen auth state contract | Mechanical | P1/P4 | Per-screen ad hoc handling already produced false empty data in planner. | Let each screen invent copy/state |
| 10 | Eng | Add `user_default_households` as the durable default-workspace invariant | Taste accepted by user | P1/P5 | Current schema does not prevent two starter households for one user under concurrent bootstrap calls. User chose a dedicated mapping table over advisory-lock-only, membership flags, or naming conventions. | Rely only on membership unique index/code-only advisory lock, add `is_default` to memberships, or infer default by household convention |
| 11 | Eng | Move profile creation ownership to bootstrap and make auth resolver read-only | Taste accepted by user | P5 | `loadUserAuthorization` already writes profiles; bootstrap needs one canonical write contract. User chose explicit bootstrap ownership. | Keep hidden profile creation in auth resolver |
| 12 | Eng | Planner accepts private recipes owned by the signed-in user | Taste accepted by user | P1/P6 | Current private recipe default conflicts with "new user can use Planner" promise. User chose to make Planner accept same-user private recipes instead of changing recipe creation defaults to workspace ownership. | Let first-use recipe planning fail after bootstrap, or force all new recipes into the starter workspace |
| 13 | Eng | Inventory every protected mobile `apiFetch` callsite | Mechanical | P1/P4 | Planner, recipe detail, and ingredient search currently swallow auth-shaped failures differently. | Only fix top-level Planner/Shopping |
| 14 | DX | Add copy-paste Fresh User Smoke runbook | Mechanical | P1/P6 | Both DX voices found no hello-world path from env to verified bootstrap. | Leave smoke as scattered commands |
| 15 | DX | Extend API error contract with optional `docs` field | Taste accepted by user | P1 | Error states should include problem, cause, fix, and docs for developers and UI mapping. User chose `docs` over `docsUrl`. | Keep code/message/cause/fix only |
| 16 | DX | Convert `npm run test:auth` to reliable auth/bootstrap coverage | Taste accepted by user | P5 | Current script is a fixed file list and would skip a new bootstrap test file. User chose option A: make the auth script itself reliably cover new auth/bootstrap route tests. | Rely on developer memory, or only add a one-off file path |
| 17 | Mobile/DX | Use discriminated signup result and call bootstrap only on `session_ready` | Taste accepted by user | P1/P5 | Supabase signup can return no session when confirmation is enabled; explicit states are testable and prevent stranded users. | Return `Session \| null` or treat confirmation as generic error |
| 18 | DX/Release | Require both local and staging Fresh User Smoke before release | Taste accepted by user | P1/P6 | Auth onboarding depends on Supabase confirmation, redirects, env vars, and staging user setup; local tests alone do not prove the real deployment path. | Local-only smoke, or unit/integration tests without a release smoke |
| 19 | Design | Make auth accessibility acceptance P1 | Taste accepted by user | P1/P5 | Login/signup/reset are blocking account paths; labels, error announcements, focus/status behavior, busy states, and touch targets must ship with the flow. | Keep accessibility as P2 polish, or only add basic labels |
| 20 | Eng/Release | Make minimal bootstrap observability P1 | Taste accepted by user | P1/P6 | Fresh-user setup failures need traceable server evidence during local/staging/prod rollout. User chose structured start/success/failure logs over error-only or P2 logging. | Error-only logs, or leave observability as P2 |
| 21 | DX/API | Return rich bootstrap status details | Taste accepted by user | P1/P5 | Client UI, tests, and smoke runbooks need to distinguish created vs existing setup and inspect profile/workspace/membership readiness. User chose the richer response shape. | Thin `status/householdId/role/result`, or `ok: true` plus logs |
| 22 | Mobile | Use a shared protected-fetch auth/setup mapper | Taste accepted by user | P1/P5 | Planner, recipe detail, ingredient search, and future protected screens must not independently turn auth failures into empty or generic states. | Patch only known callsites, or fix Planner only |
| 23 | Mobile UX | Return to original route/action after successful auth | Taste accepted by user | P1 | Users who start from a guarded screen should resume their intent after signup/login/bootstrap; Account & Workspace CTAs are the fallback. | Always stay on Account & Workspace, or always go Home/Recipes |
| 24 | Mobile/Auth | Include confirmation resend in this slice | Taste accepted by user | P1 | `confirmation_required` without resend can strand users if the email is missed. User chose resend with loading/success/error/rate-limit states. | Copy-only confirmation state |
| 25 | Mobile/Auth | Include confirmation/reset deep links in this slice | Taste accepted by user | P1/P6 | Password reset and confirmation are now part of the slice, so redirects must be configured and smoke-tested for local/staging. | Document browser-only fallback without deep links |
| 26 | Scope/TODO | Keep invites and workspace switching out of slice and add direct TODOs | Taste accepted by user | P3/P4 | Collaboration is a separate product surface; default-workspace mapping prepares it without expanding this slice. | Add minimal invites/switching now |
| 27 | Scope/TODO | Keep OAuth/Magic Link out of slice and add direct TODOs | Taste accepted by user | P3/P4 | Email/password remains the only login mode for this slice; adding more auth modes would compound redirect/deep-link test surface. | Add OAuth/Magic Link now |
| 28 | Scope/TODO | Keep recipe sharing/copy/collections out of slice and add direct TODOs | Taste accepted by user | P3/P4 | The slice makes private own recipes plannable; sharing/copy/collections require separate ownership UX and policy decisions. | Add sharing/copy/collections now |
| 29 | Design | Hide role labels in the UI | Taste accepted by user | P1/P5 | Roles have no user-facing actions in this slice, so `Admin`/`Nutzer`/`Mitglied` labels should not create expectations. | Show technical role labels or friendly role labels |
| 30 | Test | Cover private-recipe planner ownership with server and mobile tests | Taste accepted by user | P1/P5 | The core promise needs both authorization coverage and mobile flow coverage. | Server-only tests or happy-path-only tests |
| 31 | Privacy/TODO | Document current privacy boundary and add uncovered ownership topics to TODO | Taste accepted by user | P1/P6 | Copy should say what is protected now without implying BYOK/platform credential ownership is solved. | Positive-only copy with no TODO trail |
| 32 | DX/Mobile | `bootstrapAccount()` must use existing `apiFetch`/`assertApiOk` error path | Taste accepted by user | P5 | Bootstrap errors need the same `ApiRequestError` details as other API calls, including `code`, `cause`, `fix`, and `docs`. | Custom fetch/error parsing for bootstrap |
| 33 | Mobile/Eng | Add UI submit-lock plus server idempotency for auth/bootstrap | Taste accepted by user | P1/P5 | Bootstrap is idempotent, but the UI should not fire multiple parallel signup/login/bootstrap flows. | Server-only idempotency or UI-only lock |
| 34 | DX/Release | Document staging test user creation and cleanup | Taste accepted by user | P1/P6 | Repeatable staging smoke needs naming/email convention and cleanup to avoid stale test data. | Create-only staging smoke or manual improvisation |

---
