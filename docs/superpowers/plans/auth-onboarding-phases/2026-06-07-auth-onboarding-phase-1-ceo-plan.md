# Auth Onboarding Phase 1 CEO Review Plan

Main plan: [Auth Onboarding Slice Plan](../2026-06-07-auth-onboarding-slice-plan.md)

## /autoplan Phase 1: CEO Review

Status: Phase 1 written, premise gate pending.
Mode: SELECTIVE EXPANSION.
Base branch: `main`.
UI scope: yes.
DX scope: yes.

### Phase 1 Plan Summary

This plan closes the visible multi-user gap: users can create an account, sign in,
receive a server-created profile/default household/membership, and then use recipes,
shopping, and planner screens without manual Supabase setup. The core engineering
direction is sound, but the product frame is too infrastructure-heavy: the user
outcome should be "first trusted personal workspace with durable saved state," not
"auth rows exist."

### 0A. Premise Challenge

| Premise | Evaluation | Decision |
|---|---|---|
| Email/password signup is the right first auth mode | Reasonable for this slice because the repo already uses Supabase Auth tokens and Settings has login UI, but not proven as the best activation path. | Accept for this slice, defer OAuth/magic link with explicit rationale. |
| A server bootstrap endpoint is the right place to create profile/household/membership | Correct. Client writes would duplicate authorization logic and expose more database surface. | Accept. |
| A default single household is enough for first use | Correct for a first private workspace, but it must not imply household collaboration is complete. | Accept with workspace copy: "Mein Workspace" is a starter workspace, not full household sharing. |
| Settings can be the only account surface | Weak. Current Settings account card exists, but web users and guarded screens need a more direct route to account recovery/login. | Strengthen plan: guarded screens must link to Account & Workspace, and web entry must be explicit. |
| Password reset can be deferred | Risky. It is table-stakes for persistent accounts. | User decision: include a minimal Supabase reset-link flow in this slice; defer only full recovery hardening. |
| Email confirmation is just a UI state | Incomplete. Confirmation changes the return path and bootstrap timing. | Strengthen plan: specify post-confirm behavior, resend guidance, and no-session success copy. |

If we did nothing, new users would keep hitting `no_household` after signup/login and
protected screens would continue to look like empty or broken product states. That is
real user pain, not a hypothetical cleanup.

### 0B. What Already Exists

| Sub-problem | Existing code | Reuse / gap |
|---|---|---|
| Supabase token verification | [src/auth.ts](/home/patrick/Projekte/rezepti/src/auth.ts:97) verifies bearer tokens through Supabase. | Reuse `resolveUserAuthContext` / `requireUserAuth`. |
| Profile lookup and app role | [src/db-react.ts](/home/patrick/Projekte/rezepti/src/db-react.ts:482) loads authz and currently creates missing `user_profiles`. | Reuse schema and role normalization, but move/centralize bootstrap writes so auth resolution is not the only profile writer. |
| Active household selection | [src/db-react.ts](/home/patrick/Projekte/rezepti/src/db-react.ts:476) deterministically prefers owner memberships. | Reuse for status response. |
| Protected Shopping/Planner routes | [src/routes/planner.ts](/home/patrick/Projekte/rezepti/src/routes/planner.ts:1) already requires active household. | Bootstrap should make new users pass this boundary. |
| Protected Recipes routes | [src/routes/recipes.ts](/home/patrick/Projekte/rezepti/src/routes/recipes.ts:45) uses `requireUserAuth`. | No household required for private recipes, but error UX still needs review. |
| API router mounting | [src/api-react.ts](/home/patrick/Projekte/rezepti/src/api-react.ts:19) mounts route modules. | Add `authRouter` here. |
| Mobile auth client | [mobile/utils/auth.ts](/home/patrick/Projekte/rezepti/mobile/utils/auth.ts:57) supports password login and session headers. | Add signup and bootstrap helpers. |
| Settings account UI | [mobile/app/(tabs)/settings.tsx](/home/patrick/Projekte/rezepti/mobile/app/(tabs)/settings.tsx:629) has login/logout card. | Move account ownership to a dedicated Account & Workspace route/screen; Settings links there. |
| API error envelopes | [mobile/utils/api.ts](/home/patrick/Projekte/rezepti/mobile/utils/api.ts:30) preserves server error codes. | Reuse for guarded-screen state mapping. |

### 0C. Dream State Delta

```text
CURRENT STATE
  Auth and owner scoping exist, but a normal user can sign in and still hit
  no_household or silent empty states.
        |
        v
THIS PLAN
  Signup/login creates a trusted personal workspace: profile, starter household,
  owner membership, visible account status, and guarded screens that explain auth.
        |
        v
12-MONTH IDEAL
  Users have durable private and household recipe workspaces, invitation/copy flows,
  cross-device import history, clear privacy boundaries, account recovery, and
  no route where auth failure masquerades as missing food data.
```

The plan moves toward the ideal if it treats bootstrap as the first workspace
invariant. It moves away from the ideal if it exposes "admin" and household internals
without a user-facing privacy/workspace contract.

### 0C-bis. Implementation Alternatives

| Approach | Summary | Effort | Risk | Pros | Cons | Reuses |
|---|---|---:|---|---|---|---|
| A. Minimal Bootstrap Patch | Add `POST /api/v1/auth/bootstrap`, mobile signup, Settings status, and guarded error states exactly as planned. | M | Medium | Smallest diff; solves `no_household`; easy to test. | Leaves activation, recovery, confirmation return path, and privacy messaging thin. | Existing auth middleware, db schema, mobile Settings. |
| B. First Trusted Workspace | Keep the same bootstrap endpoint, but add explicit first-session success criteria, privacy copy, post-confirm behavior, web account entry decision, and no-empty-auth-state fixes as launch blockers. | M | Medium | Solves the technical gap and product confusion together; avoids overbuilding invites/OAuth now. | Slightly more plan detail and UI copy work. | Same as A, plus current docs/runbook and guarded screens. |
| C. Full Collaborative Auth | Add password reset, OAuth/magic link, invitations, household switching, and account/privacy management now. | XL | High | Stronger long-term account product. | Too much blast radius for this slice; risks delaying the core fix and entangling sharing semantics. | Supabase Auth, future follow-up plan. |

Recommendation: Approach B. It follows the existing architecture while correcting
the strategic frame. Approach C is a lake-sized future plan, not the right slice.

### 0D. Selective Expansion Scan

Accepted into this plan by autoplan principles:

- Add a first-session success path to acceptance: after signup/bootstrap, a user can
  create/import or view their own recipe context, then reach planner/shopping without
  auth-shaped empty states.
- Treat the privacy/workspace contract as release-blocking docs/copy, not optional
  housekeeping: state what login protects now and what remains deferred.
- Specify email-confirmation behavior: no immediate session, confirmation required,
  post-confirm login/bootstrap, and resend/retry guidance.
- Include a minimal password reset flow: "Passwort vergessen?", Supabase reset email,
  neutral success copy, invalid-email/network errors, and configured redirect behavior.
- Make web account entry explicit instead of leaving "Settings route reachable" as
  a maybe.
- Hide or de-emphasize internal `admin` role unless it unlocks visible behavior.

Deferred to follow-up:

- OAuth/magic link.
- Household invitations and switching.
- Recipe copy/sharing and full collaborative workspace flows.

### 0E. Temporal Interrogation

| Implementation time | Decision that should be resolved now |
|---|---|
| Hour 1 foundations (CC: ~5-10 min) | Bootstrap ownership invariant: "no membership -> create exactly one starter household + owner membership; existing membership -> return current status without creating a new household." |
| Hour 2-3 core logic (CC: ~15-25 min) | Idempotency and concurrency: use conflict-safe inserts and deterministic re-read after write. Generate household UUID server-side, not in the browser. |
| Hour 4-5 integration (CC: ~20-35 min) | Signup confirmation branch: if Supabase returns no session, show clear confirmation copy and do not call bootstrap until a session exists. |
| Hour 6+ polish/tests (CC: ~20-40 min) | Guarded screens need code-specific auth states; do not let `/api/v1/recipes` failures become empty recipe lists in planner. |

### 0F. Mode Confirmation

SELECTIVE EXPANSION is the right mode. The current plan is directionally correct, but
needs a small set of product and reliability additions in the blast radius.

### CEO Dual Voices

#### CLAUDE SUBAGENT (CEO - strategic independence)

The subagent found that the plan solves the right technical unblock but under-scopes
the product moment. It recommended reframing signup/bootstrap as a "first trusted
personal workspace," adding a premise check, making the bootstrap invariant explicit,
promoting the privacy contract from housekeeping to launch requirement, and analyzing
password reset/OAuth/invites as explicit tradeoffs rather than silent deferrals.

#### CODEX SAYS (CEO - strategy challenge)

Codex agreed the plan is too auth-plumbing-centered. It flagged password reset as a
risky deferral, email/password-only as a possible activation drag, auto-created
households as a product decision rather than just a database default, web account
entry as too vague, email confirmation as a funnel risk, lack of backfill/migration
story, and exposed `admin` role as visible complexity without user value.

#### CEO Dual Voices - Consensus Table

| Dimension | Claude | Codex | Consensus |
|---|---|---|---|
| Premises valid? | Partly | Partly | CONFIRMED: valid core, weak product premises |
| Right problem to solve? | Yes, but reframe | Yes, but reframe | CONFIRMED: solve first trusted workspace |
| Scope calibration correct? | Mostly | Too thin on recovery/confirmation | DISAGREE: password reset urgency |
| Alternatives sufficiently explored? | No | No | CONFIRMED: add alternatives table |
| Competitive/product risks covered? | No | No | CONFIRMED: auth is not differentiation |
| 6-month trajectory sound? | Only with privacy contract | Weak without recovery/backfill | CONFIRMED: needs launch contract |

### CEO Review Sections

#### Section 1: Architecture Review

System architecture after this slice:

```text
Supabase Auth
  |
  | access token
  v
mobile/utils/auth.ts ── bootstrapAccount() ──▶ /api/v1/auth/bootstrap
       |                                      │
       | getAuthHeaders()                     v
       v                                src/routes/auth.ts
mobile/utils/api.ts                           │
       |                                      v
       v                                requireUserAuth()
Recipes / Shopping / Planner screens          │
       |                                      v
       v                                db-react bootstrap helpers
/api/v1/recipes, /shopping, /planner           │
                                              v
                         user_profiles + households + household_memberships
```

New coupling is justified: mobile auth flows become coupled to the server bootstrap
contract, and protected screens become coupled to normalized auth error codes. The
main architecture gap is that `loadUserAuthorization` currently creates profiles as a
side effect ([src/db-react.ts](/home/patrick/Projekte/rezepti/src/db-react.ts:490)).
The plan should state whether that remains as a compatibility safety net or moves
behind explicit bootstrap helpers.

Data flow shadow paths:

```text
Signup/Login -> Session? -> Bootstrap -> Status -> Guarded API calls
    |            |             |           |
    |            |             |           +-> stale/missing membership: show retry/setup state
    |            |             +-> DB conflict: re-read, return existing status
    |            +-> no session: show confirmation-needed state, no bootstrap call
    +-> invalid email/password: inline form error, no session writes
```

Rollback posture is simple if no schema migration is needed beyond existing tables:
remove route mount and mobile calls. If a new DB uniqueness invariant is added, deploy
order must be migration first, code second, rollback by disabling the mobile bootstrap
call and leaving idempotent server route in place until data is inspected.

#### Section 2: Error & Rescue Registry

| Method / codepath | What can go wrong | Class/code | Rescued? | Rescue action | User sees |
|---|---|---|---|---|---|
| `POST /api/v1/auth/bootstrap` | Missing token | `auth_missing` | Yes | Existing auth response | "Bitte anmelden" / login CTA |
| `POST /api/v1/auth/bootstrap` | Invalid/expired token | `auth_invalid` / `token_expired` | Yes | Existing auth response | "Bitte erneut anmelden" |
| `ensureUserProfile` | DB insert conflict | unique conflict | Yes, planned | `onConflictDoNothing`, re-read | No interruption |
| `ensureDefaultHouseholdForUser` | Double submit creates two households | race condition | Gap in current plan | transaction or conflict-safe invariant plus re-read | No duplicate household |
| `ensureDefaultHouseholdForUser` | DB unavailable | database error | Partly | Return structured 500/setup error with retry copy | "Haushalt konnte nicht eingerichtet werden" |
| `signUpWithPassword` | Email confirmation required, no session | Supabase no-session result | Gap | Return explicit confirmation state | "E-Mail bestaetigen" |
| `bootstrapAccount` | Server returns `no_household`/500 | API error envelope | Yes, planned | Use existing `apiFetch`/`assertApiOk`, preserve code/cause/fix/docs and expose retry | Setup error with retry |
| Protected screens | API returns auth error | `ApiRequestError` | Yes, planned | Shared auth/setup error mapper for all protected mobile `apiFetch` callsites | Login/session/setup CTA |
| Planner recipe picker | `/api/v1/recipes` returns 401/403 | currently swallowed | No | Use `assertApiOk` instead of `if (!res.ok) return []` | Auth state, not empty recipe list |

#### Section 3: Security & Threat Model

| Threat | Likelihood | Impact | Plan coverage | Decision |
|---|---|---|---|---|
| User creates/reads another user's household | Low | High | Route derives user from token; no user ID param planned. | Keep. |
| Duplicate default households via concurrent bootstrap | Medium | Medium | Mentioned as idempotency risk, not implementation detail. | Add transaction/conflict-safe re-read requirement. |
| Client-side direct writes to exposed Supabase tables | Medium | High | Plan rejects this by using server endpoint. | Keep server-only writes. |
| User-editable metadata used for role decisions | Low | High | Existing role comes from DB, not user metadata. | Keep. |
| Overclaiming privacy for BYOK/platform credentials | Medium | Medium | Deferred items exist but not launch copy. | Add privacy/workspace contract. |
| Internal admin role exposed to normal users | Medium | Low/Medium | Earlier plan showed roles. | Hide roles completely in this slice; show only account/workspace state. |

No new secret is required. The endpoint should use existing Supabase token verification
and server database credentials. No new npm package is needed.

#### Section 4: Data Flow & Interaction Edge Cases

```text
email/password
  -> trim/validate non-empty
  -> Supabase signup/login
  -> session exists?
       yes -> POST bootstrap with bearer token
       no  -> confirmation-needed state
  -> bootstrap status
       status ready -> show account/workspace ready
       failure         -> show retry and preserve error code
  -> guarded screens
       auth_missing/token_expired/no_household -> CTA state
       ok -> normal data
```

Key gaps to add to the plan:

- Double tapping signup/login must not fire concurrent bootstrap calls from the UI.
- Retry after a partial bootstrap must be idempotent.
- Email confirmation return path must be explicit enough for web/mobile, including
  resend behavior and configured deep links for confirmation/reset.
- Planner currently has an auth-shaped empty-state bug at
  [mobile/app/(tabs)/planner.tsx](/home/patrick/Projekte/rezepti/mobile/app/(tabs)/planner.tsx:35).

#### Section 5: Code Quality Review

The plan fits existing route-module patterns: add `src/routes/auth.ts` and mount it in
[src/api-react.ts](/home/patrick/Projekte/rezepti/src/api-react.ts:19). DB helpers fit
[src/db-react.ts](/home/patrick/Projekte/rezepti/src/db-react.ts:482), but they should
avoid growing a monolithic auth block with unclear write/read separation. Recommended
shape:

- `ensureUserProfile(userId, email)` handles only profile upsert.
- `ensureDefaultHouseholdForUser(userId)` handles membership invariant and re-read.
- `getAccountBootstrapStatus(userId)` is read-only and reuses `chooseActiveHouseholdId`.

Avoid a large `bootstrapEverything()` function that mixes request parsing, auth,
database writes, and response shaping.

#### Section 6: Test Review

New UX flows:

- Signup with immediate session.
- Signup with email confirmation required.
- Login with successful bootstrap.
- Bootstrap failure and retry.
- Logout.
- Guarded screen auth/session/setup states.

New data flows:

- Bearer token -> verified user -> profile upsert -> default household/membership -> account status response.
- Existing member -> bootstrap -> no duplicate household -> same active household.
- Protected screen API auth error -> `ApiRequestError` -> state-specific UI.

New codepaths:

- `src/routes/auth.ts` happy/missing/invalid/expired/error paths.
- `db-react` profile/household/membership helper branches.
- `mobile/utils/auth.ts` signup/login/bootstrap/no-session branches.
- Account & Workspace auth mode/status/retry branches.
- Planner recipe load non-OK path should become explicit error path.

Test gaps to add:

- Concurrent/double bootstrap does not create duplicate memberships/households.
- Existing user with an existing member-only membership does not get a new default owner household.
- Signup confirmation-required state does not call bootstrap with no token.
- Planner recipe picker and recipe list do not convert 401/403 into empty list.
- Account & Workspace renders inline errors, not only alerts.

#### Section 7: Performance Review

The bootstrap route is low-volume and per-login/signup, so p99 latency is dominated
by Supabase token verification and a small number of Postgres reads/writes. Existing
indexes cover membership lookup by user via
`household_memberships_user_idx` ([src/schema.ts](/home/patrick/Projekte/rezepti/src/schema.ts:108)).
No caching is needed. The main performance risk is accidental multiple bootstrap calls
on every app focus; mobile should call bootstrap after signup/login and on explicit
retry, not every render.

#### Section 8: Observability & Debuggability Review

Add structured server logs for bootstrap start/success/failure with `userId`, result
kind (`created` vs `existing` vs `failed`), household id when available, and
`errorCode` on failure. Do not log tokens, passwords, or raw email addresses.
Useful metrics:

- bootstrap attempts, successes, failures by code.
- confirmation-required signup count.
- `no_household` responses after bootstrap release.

Runbook docs should include how to inspect a user's profile/membership state without
touching auth secrets.

#### Section 9: Deployment & Rollout Review

Deployment sequence:

```text
1. Add server route + db helpers + tests
2. Deploy server before mobile/web export that calls bootstrap
3. Add mobile signup/bootstrap UI
4. Build/export mobile web public assets
5. Run auth/unit/mobile/RLS smoke checks
6. Verify a fresh user in staging
```

Rollback:

```text
Mobile call breaks?
  -> disable/hide signup/bootstrap UI or revert public export
Server route breaks?
  -> revert route mount; existing protected routes remain as before
Data duplicated?
  -> stop bootstrap calls, inspect households/memberships, clean with targeted SQL
```

The plan should include a staging fresh-user smoke before production, because this
slice depends on Supabase Auth configuration as well as app code.

#### Section 10: Long-Term Trajectory Review

Reversibility: 4/5 if no new schema migration is needed; 3/5 if new constraints are
added. The path dependency is acceptable if the default household is explicitly a
starter workspace and does not pretend to solve household collaboration. The next
logical slices are password recovery, invite/switching, recipe copy/sharing, and
credential ownership. The plan should say that bootstrap creates platform capability:
future features can assume a user has a workspace after first successful auth.

#### Section 11: Design & UX Review

User flow:

```text
Unauthenticated guarded screen
  -> Login/session hint
  -> Account entry
  -> Login or Account erstellen
  -> [session] bootstrap setting up
  -> Workspace: Mein Workspace / retry error
  -> back to Recipes / Shopping / Planner
```

Interaction state coverage:

| Feature | Loading | Empty | Error | Success | Partial |
|---|---|---|---|---|---|
| Account form | Busy button | Empty email/password validation | Inline auth error | Active account | Confirmation required |
| Bootstrap | "Workspace wird eingerichtet" | No membership | Retry setup error | Workspace name/status | Profile exists, workspace membership missing |
| Guarded screens | Existing loaders | Real empty data only | Login/session/setup CTA | Normal content | Existing data preserved while auth refreshes |

Design gaps: the current Settings copy still references server-checked role/household
state ([mobile/app/(tabs)/settings.tsx](/home/patrick/Projekte/rezepti/mobile/app/(tabs)/settings.tsx:656)).
The plan should replace this with the dedicated Account & Workspace route, concrete
workspace status, no role labels, and guarded-screen actions instead of passive
messages.

### NOT In Scope

- Household invitations: deferred because default personal workspace is enough for first use.
- Household switching: deferred until multiple-household model exists.
- OAuth/magic link: deferred and tracked directly in `TODO.md`.
- Full account recovery hardening beyond the minimal Supabase reset-link flow:
  support tooling, audit trail, and advanced abuse handling.
- Recipe sharing/copy and collections: deferred and tracked directly in `TODO.md` to avoid mixing workspace bootstrap with collaboration semantics.
- BYOK/platform credential ownership: deferred, called out in privacy copy, and tracked directly in `TODO.md`.
- Admin UI: deferred; roles are hidden in this slice.

### Error & Rescue Registry

| Codepath | Failure mode | Rescued? | Test? | User sees? | Logged? |
|---|---|---:|---:|---|---:|
| Bootstrap route auth | Missing token | Yes | Yes | Login required | No |
| Bootstrap route auth | Invalid/expired token | Yes | Yes | Sign in again | No |
| Profile upsert | Unique conflict | Yes | Yes | Nothing, status returned | Optional |
| Household creation | Concurrent duplicate | Must fix | Must add | Nothing if fixed; setup error if not | Yes |
| Membership insert | Unique conflict | Yes | Yes | Nothing, status returned | Optional |
| Signup | Confirmation required | Must fix | Must add | Check email / return after confirmation | No |
| Bootstrap API call | Network/server failure | Must fix | Must add | Setup failed + retry | Yes |
| Guarded recipes/planner | Auth error becomes empty list | Critical gap | Must add | Login/setup CTA | Optional |

### Failure Modes Registry

| Codepath | Failure mode | Rescued? | Test? | User sees? | Logged? |
|---|---|---:|---:|---|---:|
| `ensureDefaultHouseholdForUser` | double call creates duplicate starter households | Gap | Gap | Possibly confusing household state | Yes needed |
| `signUpWithPassword` | no session because confirmation required | Gap | Gap | Clear confirmation state needed | No |
| `bootstrapAccount` | route returns 500/setup error | Planned | Gap | Retry setup state | Yes needed |
| `planner.loadAllRecipes` | 401/403 returns `[]` | No | Gap | False empty recipe picker | No |
| Account & Workspace screen | bootstrap failed after login | Planned | Gap | Retry setup state | No |

### Dream State Delta

After this phase, the plan should leave Rezepti with a reliable "workspace exists
after auth" invariant. It still will not have collaborative household flows,
account recovery, or OAuth. That is acceptable only if the release copy and docs do
not imply those capabilities already exist.

### CEO Completion Summary

| Area | Score | Summary |
|---|---:|---|
| Strategy | 7/10 | Correct immediate problem, stronger if reframed around first trusted workspace. |
| Scope | 7/10 | Bootstrap slice is right; confirmation and minimal password reset need explicit handling; full recovery polish remains follow-up. |
| Architecture | 8/10 | Server endpoint fits existing auth boundaries. |
| Product clarity | 6/10 | Needs privacy/workspace contract and web account decision. |
| Risk coverage | 7/10 | Idempotency named, but concurrency and confirmation need sharper tests. |

Phase 1 complete. Codex: 10 concerns. Claude subagent: 6 issues. Consensus:
5/6 confirmed, 1 disagreement surfaced as taste/user judgment around password reset
urgency.

### CEO Implementation Tasks

- [ ] **CEO-T1 (P1, human: ~1h / CC: ~10min) — Plan/product framing** — Reframe acceptance from auth rows to first trusted personal workspace.
  - Surfaced by: CEO dual voices and premise challenge.
  - Files: `docs/superpowers/plans/2026-06-07-auth-onboarding-slice-plan.md`.
  - Verify: Plan acceptance includes post-login user success path.
- [ ] **CEO-T2 (P1, human: ~1h / CC: ~10min) — Privacy contract** — Make login privacy/workspace guarantees explicit before release.
  - Surfaced by: 6-month regret and stale runbook risk.
  - Files: `docs/auth-runbook-route-privacy.md`, `README.md`, Account & Workspace copy.
  - Verify: Docs say what login protects now and what remains deferred.
- [ ] **CEO-T3 (P1, human: ~2h / CC: ~20min) — Confirmation path** — Specify and test Supabase email-confirmation/no-session behavior.
  - Surfaced by: Codex and subagent premise critique.
  - Files: `mobile/utils/auth.ts`, Account & Workspace route/screen, tests.
  - Verify: Signup without session returns `confirmation_required`, shows confirmation state, supports resend, handles configured confirmation deep links, and does not call bootstrap.
- [ ] **CEO-T5 (P1, human: ~2h / CC: ~20min) — Minimal password reset** — Add a "Passwort vergessen?" path that requests a Supabase reset email and shows neutral success/error states.
  - Surfaced by: CEO password-reset challenge and user decision.
  - Files: `mobile/utils/auth.ts`, Account & Workspace route/screen, Supabase auth config docs, tests.
  - Verify: reset request calls Supabase, success copy does not reveal whether an email exists, and configured reset deep links work locally and in staging.
- [ ] **CEO-T4 (P1, human: ~1h / CC: ~10min) — Auth-shaped empty states** — Fix protected screens that turn auth failures into empty data.
  - Surfaced by: code review of `planner.loadAllRecipes`.
  - Files: `mobile/app/(tabs)/planner.tsx`, recipe list/detail screens as applicable.
  - Verify: 401/403 render auth/setup CTA, not empty list.

<!-- AUTONOMOUS DECISION LOG -->
