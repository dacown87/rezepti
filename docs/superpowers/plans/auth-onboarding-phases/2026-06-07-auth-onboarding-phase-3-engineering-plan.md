# Auth Onboarding Phase 3 Engineering Review Plan

Main plan: [Auth Onboarding Slice Plan](../2026-06-07-auth-onboarding-slice-plan.md)

## /autoplan Phase 3: Engineering Review

Status: Complete.

### Step 0: Scope Challenge

The implementation is still a medium slice, not a rewrite, but it touches more than
the original phase list admits:

- Server auth route and DB helpers.
- Existing auth resolver write behavior.
- Mobile auth utility return types.
- Account & Workspace state machine.
- Protected fetch helpers across recipe list, recipe detail, planner picker, shopping,
  and ingredient search.
- Docs/runbook/privacy copy.

The narrowest correct version is: server-owned bootstrap invariant, explicit
account/workspace state machine, shared guarded-screen auth mapping, and one decision
about whether first-use private recipes can be planned.

### Eng Dual Voices

#### CLAUDE SUBAGENT (Eng - independent review)

The engineering subagent flagged eight issues: split profile write ownership,
underspecified default-household concurrency, correct but easy-to-misread
`requireUserAuth` semantics, non-centralized mobile guarded states, signup
confirmation hidden complexity, Account & Workspace state-machine complexity,
server-only Supabase write boundary, and missing high-risk tests.

#### CODEX SAYS (Eng - architecture challenge)

Codex agreed and added two concrete cross-slice mismatches: recipe creation/extraction
defaults to private user ownership while Planner only accepts household recipes, and
protected mobile fetch failures are swallowed in more places than Planner, including
recipe detail and ingredient search.

#### Eng Dual Voices - Consensus Table

| Dimension | Claude | Codex | Consensus |
|---|---|---|---|
| Architecture sound? | Partial | Partial | CONFIRMED: bootstrap shape right, invariants underspecified |
| Test coverage sufficient? | No | No | CONFIRMED |
| Performance risks addressed? | Mostly | Mostly | CONFIRMED: low volume, avoid repeated client bootstrap |
| Security threats covered? | Partial | Partial | CONFIRMED: server-only writes need explicit acceptance |
| Error paths handled? | No | No | CONFIRMED |
| Deployment risk manageable? | Partial | Partial | CONFIRMED: needs staging fresh-user smoke |

Consensus: 6/6 confirmed, 0 disagreements.

### Section 1: Architecture

```text
Mobile/Web Account UI
  |
  | signUp/signIn result: session_ready | confirmation_required
  v
mobile/utils/auth.ts
  |
  | session_ready only
  v
POST /api/v1/auth/bootstrap
  |
  v
src/routes/auth.ts
  |
  | requireUserAuth verifies token, but does not imply household readiness
  v
db-react bootstrap helpers
  |
  +--> ensureUserProfile(userId,email)
  +--> ensureDefaultHouseholdForUser(userId)
  +--> getAccountBootstrapStatus(userId)
          |
          v
user_profiles + households + household_memberships
```

Hard architecture requirements:

- Bootstrap uses `requireUserAuth`/`getUserAuth` only to identify the user. It must
  then run the write invariant and re-read status. Middleware success is not
  workspace-readiness success.
- Profile creation has one owner: explicit bootstrap helpers. `loadUserAuthorization`
  should become read-only and return default `appRole: "user"` when no profile exists,
  without writing. The bootstrap route is responsible for `ensureUserProfile`.
- Default household creation must be enforced by a durable data-model invariant. The
  current membership primary key only prevents duplicate membership for the same
  household/user pair; it does not prevent two concurrent default households. Add a
  migration-backed `user_default_households` table with `user_id primary key` and
  `household_id unique not null` plus foreign keys to the user profile and household.
  A transaction is still required around bootstrap writes, but the invariant must not
  rely only on advisory locks, membership flags, or household naming conventions.
- After every bootstrap write attempt, re-read memberships and choose the active
  household through the existing deterministic helper.

### Section 2: Code Quality

Recommended module boundaries:

- `src/routes/auth.ts`: request/response only.
- `src/db-react.ts`: bootstrap data helpers and status serializer.
- `src/auth.ts`: token verification and middleware. Avoid making middleware do
  product bootstrap work.
- `mobile/utils/auth.ts`: Supabase session/signup/bootstrap orchestration.
- `mobile/utils/api.ts`: shared `ApiRequestError` plus auth/setup-state mapper.

Avoid a route handler that mixes token verification, household creation, UI-facing
copy, and low-level SQL. Also avoid boolean soup in Settings; use a discriminated
state such as `signed_out`, `submitting`, `confirmation_required`, `bootstrap_running`,
`ready`, `bootstrap_failed`, `expired`.

### Section 3: Test Review

Test diagram:

```text
NEW UX FLOWS
  signup immediate session -> bootstrap -> ready
  signup confirmation required -> no bootstrap -> confirmation copy
  login -> bootstrap -> ready
  bootstrap failed -> retry
  guarded screen auth_missing/token_expired/no_household -> account CTA

NEW DATA FLOWS
  token -> user -> profile upsert -> default household/membership -> status
  concurrent bootstrap -> single starter workspace -> deterministic re-read
  existing membership -> no new owner escalation -> status
  private recipe / household recipe -> planner eligibility decision

NEW CODEPATHS
  src/routes/auth.ts: missing/invalid/expired/ok/DB error
  src/db-react.ts: profile exists/missing, membership exists/missing, conflict/retry
  mobile/utils/auth.ts: signUp session_ready vs confirmation_required/resend, reset password, submit lock
  mobile guarded fetches: shared mapper handles ok, 401, 403 no_household, token_expired, bootstrap_failed, 404, 500
  Expo Linking: confirmation/reset redirect handling

NEW INTEGRATIONS
  Supabase signup/login/session handling
  Server bootstrap endpoint from mobile/web
```

Required tests to add:

- Bootstrap route missing token, invalid token, expired token.
- New user gets profile, one starter workspace, owner membership.
- Existing user with membership returns existing active household, no duplicate.
- Existing member-only membership is not escalated to owner by bootstrap.
- Concurrent/double bootstrap creates one starter workspace.
- Partial profile-created/household-failed retry succeeds.
- Signup `confirmation_required` does not call bootstrap, supports resend, and clears/keeps fields per UI contract.
- Login/signup/reset calls are submit-locked; bootstrap runs exactly once per submit.
- Account & Workspace renders signed out, confirmation required, bootstrap running, ready, bootstrap failed, expired.
- Shared protected-fetch mapper turns 401/403/no_household/bootstrap_failed/token_expired into auth/setup state, not `[]` or generic errors.
- Planner ownership: own private recipe can be planned; another user's private recipe is rejected at server level and does not produce a false mobile empty state.
- Confirmation/reset deep links work in local and staging, or fail with documented recoverable copy.
- Staging fresh-user smoke: signup/login, confirmation resend, reset link, bootstrap, reload session, recipes, create/import recipe, shopping, planner eligibility, logout, no-token/expired state, test-user cleanup.

Test artifact:
`/home/patrick/.gstack/projects/dacown87-rezepti/main-auth-onboarding-test-plan-20260607.md`

### Section 4: Performance

Bootstrap is low-volume. The main performance risks are accidental repeated calls and
locking too broadly. Mobile must use a submit lock for signup/login/reset/bootstrap
flows, and server bootstrap must remain idempotent. Mobile should call bootstrap after
signup/login and explicit retry, not on every render, every focus, or every API
request.

### Section 5: Security

Security requirements:

- Mobile uses only publishable/anon Supabase keys.
- No `service_role` or secret key under any `EXPO_PUBLIC_*` variable.
- Confirmation/reset deep links must be constrained to documented local/staging/prod
  redirect URLs.
- Client never writes `user_profiles`, `households`, or `household_memberships`.
- Authorization and role decisions come from server DB state, not user-editable
  Supabase metadata.
- RLS smoke verifies user/household isolation after bootstrap.
- Logs never include access tokens, passwords, or raw email addresses.

### Section 6: Ownership / Planner Product Contract

Critical mismatch:

- Recipe create defaults to private user ownership in [src/routes/recipes.ts](/home/patrick/Projekte/rezepti/src/routes/recipes.ts:23).
- Text/photo extraction saves private user-owned recipes in [src/routes/extraction.ts](/home/patrick/Projekte/rezepti/src/routes/extraction.ts:312).
- Planner only accepts household-owned recipes in [src/routes/planner.ts](/home/patrick/Projekte/rezepti/src/routes/planner.ts:230).

Decision: for this slice, make first-use recipes plannable by allowing Planner to
accept private recipes owned by the same signed-in user. Keep recipe creation/import
defaults unchanged for now, and test the planner authorization predicate directly.
Do not promise "Planner works with your own recipes" while private recipe planning
still returns 404.

### Section 7: Deployment / Rollout

```text
1. Server route + transaction-safe bootstrap helpers.
2. Root auth/bootstrap tests.
3. Mobile auth utility state model.
4. Account & Workspace UI.
5. Shared guarded-screen error mapper and callsite inventory.
6. Mobile tests.
7. Build/export web assets if account route/nav changes.
8. Staging fresh-user smoke.
9. Production deploy.
```

Rollback:

- If mobile signup UI fails, hide/revert mobile account entry while leaving server route.
- If bootstrap route fails, stop client bootstrap calls and inspect affected profiles,
  households, memberships.
- If duplicate starter workspaces appear, pause rollout and clean with targeted SQL.

### Eng Failure Modes Registry

| Codepath | Failure mode | Rescued? | Test? | User sees? | Logged? |
|---|---|---:|---:|---|---:|
| Bootstrap concurrent submit | two starter households | Must fix | Must add | no duplicate if fixed | Yes |
| `loadUserAuthorization` side effect | profile created outside bootstrap | Must decide | Must add | no visible issue if consistent | Optional |
| Signup confirmation | no session, bootstrap impossible | Must fix | Must add | confirmation state | No |
| Planner private recipe | user recipe cannot be planned | Must fix | Must add | private own recipes are plannable | Optional |
| Recipe detail auth failure | generic request_failed | Must fix | Must add | auth/session CTA | Optional |
| Ingredient search auth failure | silent return | Must fix | Must add | auth/session CTA if relevant | Optional |
| Bootstrap DB failure | partial setup | Must fix | Must add | setup failed + retry | Yes: structured failure with `userId` and `errorCode` |

### Eng Implementation Tasks

- [ ] **ENG-T1 (P1, human: ~3h / CC: ~30min) — Bootstrap invariant** — Add `user_default_households`, transactional bootstrap, and deterministic re-read.
  - Surfaced by: Eng dual voices Section 1.
  - Files: `src/schema.ts`, `db/migrations` or `supabase/migrations`, `src/db-react.ts`, `src/routes/auth.ts`, root tests.
  - Verify: concurrent double bootstrap produces one starter workspace and one `user_default_households` row for the user.
- [ ] **ENG-T2 (P1, human: ~1h / CC: ~10min) — Profile write ownership** — Move profile creation to bootstrap helpers and make auth resolver read-only.
  - Surfaced by: Eng dual voices Section 1/2.
  - Files: `src/auth.ts`, `src/db-react.ts`, tests.
  - Verify: auth context for a user without profile does not write; bootstrap creates the profile and returns status.
- [ ] **ENG-T3 (P1, human: ~2h / CC: ~20min) — Recipe planner ownership contract** — Allow Planner to use private recipes owned by the signed-in user.
  - Surfaced by: Codex architecture challenge.
  - Files: `src/routes/planner.ts`, planner authorization tests, mobile planner flow tests.
  - Verify: server authorization tests and mobile flow tests cover own private recipe plannable, another user's private recipe rejected, and no false mobile empty state.
- [ ] **ENG-T4 (P1, human: ~2h / CC: ~20min) — Protected fetch inventory** — Replace swallowed non-OK responses with shared auth/setup mapping.
  - Surfaced by: planner, recipe detail, ingredient search callsites.
  - Files: `mobile/utils/api.ts`, `mobile/app/(tabs)/planner.tsx`, `mobile/app/recipe/[id].tsx`, `mobile/app/(tabs)/index.tsx`.
  - Verify: auth/setup errors across protected mobile `apiFetch` callsites use the shared mapper and never become empty/generic states.
- [ ] **ENG-T5 (P1, human: ~1h / CC: ~10min) — Bootstrap observability** — Add minimal structured start/success/failure logs and staging smoke notes.
  - Surfaced by: observability and rollout review.
  - Files: `src/routes/auth.ts`, docs/runbook.
  - Verify: fresh-user failure can be traced by `userId`, `result`, `householdId` where available, and `errorCode` without logging tokens, passwords, or raw email addresses.

Phase 3 complete. Codex: 7 concerns. Claude subagent: 8 issues. Consensus:
6/6 confirmed, 0 disagreements. Passing to Phase 3.5 DX Review.

---

