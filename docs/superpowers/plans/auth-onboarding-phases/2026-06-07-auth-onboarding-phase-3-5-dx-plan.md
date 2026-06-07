# Auth Onboarding Phase 3.5 DX Review Plan

Main plan: [Auth Onboarding Slice Plan](../2026-06-07-auth-onboarding-slice-plan.md)

## /autoplan Phase 3.5: DX Review

Status: Complete.
DX scope: yes.
Product type: consumer app with developer-facing server/mobile auth contract.
Initial DX score: 5.5/10.
Target DX score after plan changes: 8/10.
TTHW: currently unclear; target under 5 minutes after env is configured.

### Step 0: Developer Journey Map

| Stage | Current friction | Required improvement |
|---|---|---|
| 1. Find task | Plan names auth onboarding, later review reframes workspace. | Put the workspace premise in the top-level goal, not only review appendix. |
| 2. Configure env | README has env matrix, but slice-specific Supabase Auth settings are scattered. | Add Supabase Auth config checklist. |
| 3. Start local services | Commands exist, but auth-specific path is not one copy-paste block. | Add fast dev loop commands. |
| 4. Create test user | Runbook covers staging users, not local fresh-user bootstrap. | Add local confirmed/no-session user setup steps. |
| 5. Call bootstrap | Endpoint sample lacks status/error/retry contract. | Add formal API contract and curl examples. |
| 6. Verify protected data | RLS smoke exists, but not bootstrap-specific shopping/planner verification. | Add Fresh User Smoke. |
| 7. Debug failure | Error contract has code/message/cause/fix, no docs link. | Add `docs`/`docsUrl` field and runbook links. |
| 8. Test change | `test:auth` is fixed file list. | Add new test file to script or switch to glob. |
| 9. Release confidence | Local verification listed, staging bootstrap smoke missing. | Add staging pre-release smoke. |

### DX Dual Voices

#### CLAUDE SUBAGENT (DX - independent review)

The DX subagent found no copy-paste hello-world path, `test:auth` would not
automatically include a new bootstrap test file, email confirmation lacks a concrete
implementation contract, errors lack a docs field, bootstrap response is too thin for
retry/debug UX, `bootstrapAccount()` might bypass existing API error ergonomics,
staging smoke is missing, `.env.example` is missing from docs scope, and UI state
acceptance needs testable assertions.

#### CODEX SAYS (DX - developer experience challenge)

Codex scored the plan 5.5/10 for a new developer. It found the plan implementable but
not kind: no fresh-user smoke, underspecified Supabase dashboard/redirect settings,
incomplete bootstrap API contract, named-but-not-designed error messages, high dev
environment friction, broad verification without a staged fast loop, and docs updates
that do not include executable examples.

#### DX Dual Voices - Consensus Table

| Dimension | Claude | Codex | Consensus |
|---|---|---|---|
| Getting started < 5 min? | No | No | CONFIRMED |
| API/CLI naming guessable? | Mostly | Mostly | CONFIRMED: endpoint name good |
| Error messages actionable? | Partial | Partial | CONFIRMED |
| Docs findable & complete? | No | No | CONFIRMED |
| Upgrade/config path safe? | Partial | Partial | CONFIRMED |
| Dev environment friction-free? | No | No | CONFIRMED |

Consensus: 6/6 confirmed, 0 disagreements.

### Pass 1: Getting Started - 5/10

Add a runbook section named `Auth Onboarding Fresh User Smoke` with exact local and
staging steps:

```bash
npm install
npm --prefix mobile ci
npx supabase start
npx supabase db reset --local --yes
npm run dev
npm run dev:mobile
```

Then include local and staging-specific user steps:

```text
1. Create or sign up a test user.
2. If confirmation is enabled, confirm email or document the no-session branch.
3. Obtain a Supabase access token.
4. POST /api/v1/auth/bootstrap with Authorization: Bearer <token>.
5. GET /api/v1/shopping with the same token.
6. Open mobile/web Account & Workspace and verify ready state.
```

### Pass 2: API Contract - 6/10

Formal bootstrap contract:

```http
POST /api/v1/auth/bootstrap
Authorization: Bearer <Supabase access token>
```

Success:

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

Rules:

- `status` is `ready` on 200.
- `result` is `created` when bootstrap created profile/workspace/membership work, and
  `existing` when the user was already ready after the deterministic re-read.
- `profile.ready`, `workspace.ready`, and `membership.ready` are all true on 200.
- `workspace.id` and `membership.householdId` refer to the same active/default
  workspace.
- `warnings` is optional/empty for normal success and reserved for non-blocking setup
  notes.
- Concurrent calls are idempotent and return the same active workspace after re-read.
- Errors use the shared envelope and include a docs pointer.

Error envelope. `docs` is optional for backward compatibility, but required for new
auth/setup errors introduced by this slice:

```json
{
  "error": {
    "code": "no_household",
    "message": "Workspace is not ready.",
    "cause": "The authenticated user has no active household membership.",
    "fix": "Retry account bootstrap.",
    "docs": "docs/auth-runbook-route-privacy.md#auth-onboarding-bootstrap"
  }
}
```

### Pass 3: Error Handling - 6/10

Extend [src/auth.ts](/home/patrick/Projekte/rezepti/src/auth.ts:40) and the runbook
contract to allow `docs` or `docsUrl`. The UI does not have to render the docs link
for every consumer-facing error, but mobile utilities should preserve it for debug
screens/tests.

Required mapped codes:

- `auth_missing`
- `auth_invalid`
- `token_expired`
- `setup_required`
- `no_household`
- `bootstrap_failed`
- confirmation-required mobile state

### Pass 4: Documentation - 5/10

Promote docs from cleanup to acceptance:

- `.env.example`: include/verify Supabase server and Expo public auth variables.
- README: add `/api/v1/auth/bootstrap` to endpoint table and add Fresh User Smoke.
- `docs/auth-runbook-route-privacy.md`: update stale Recipes/Extraction rows and add
  bootstrap route/privacy contract.
- Password reset docs: expected local/staging redirect URL, neutral success copy, and
  the difference between signup confirmation and reset email behavior.
- `docs/TEST_STATUS.md`: record new auth/mobile test coverage when implemented.
- `TODO.md`: keep follow-ups separate, especially full recovery hardening/OAuth/invites.

### Pass 5: Fast Dev Loop - 6/10

Fast loop:

```bash
npm run test:auth
npm --prefix mobile run test:unit -- auth
npm run mobile:typecheck
```

Full pre-release gate:

```bash
npx tsc --noEmit
npm run test:auth
npm run test:unit
npm run test:mobile:rntl-guard
npm --prefix mobile run typecheck
npm --prefix mobile run test:unit
npm run supabase:rls-smoke
SUPABASE_RLS_SMOKE_CONFIRM=rezepti-staging npm run supabase:rls-smoke:staging
npm run build:mobile
```

Release must not proceed until both smoke paths pass:

- Local Fresh User Smoke: fresh user signup/login, bootstrap, session reload,
  protected Shopping/Planner access, create/import recipe, plan private own recipe,
  logout, no-token/expired-token checks.
- Staging Fresh User Smoke: same behavior against staging Supabase with documented
  confirmation and redirect expectations.

Important script change: `npm run test:auth` currently uses a fixed test file list in
[package.json](/home/patrick/Projekte/rezepti/package.json:38). The implementation
must convert it to reliable auth/bootstrap coverage, preferably with a safe explicit
pattern or maintained list that includes any `auth` and `bootstrap` route tests. A new
bootstrap test file must fail CI if it is not included in `test:auth`.

### Pass 6: Configuration / Escape Hatches - 6/10

Supabase Auth config checklist:

- Email confirmation expected behavior for local and staging.
- Password reset redirect behavior for local and staging.
- Redirect URLs for Expo Web/local and production.
- Whether mobile deep links are in scope or confirmation returns through login.
- Publishable/anon key usage for mobile only.
- Secret/service-role keys never exposed through `EXPO_PUBLIC_*`.
- Staging test user creation, naming/email convention, and cleanup path.
- Expo Linking/Supabase redirect configuration for confirmation and password reset in
  local and staging.

### Pass 7: Developer Empathy Narrative

"I am a new contributor. I can see the endpoint name and the high-level phases, but I
cannot yet copy one block to prove signup/bootstrap works. If a test fails, I do not
know whether Supabase confirmation, missing env vars, profile side effects, or route
idempotency is the problem. The plan needs to give me a short fast loop, exact error
contracts, and one smoke path that starts with a fresh user and ends with protected
Shopping/Planner working."

### DX Implementation Checklist

- Add local and staging Fresh User Smoke to README/runbook.
- Add Supabase Auth config checklist.
- Document minimal password reset behavior and redirect configuration.
- Formalize bootstrap API contract.
- Extend error envelope with optional `docs`.
- Require `bootstrapAccount()` to use `apiFetch`/`assertApiOk` and preserve
  `ApiRequestError` details.
- Document confirmation resend and deep-link behavior.
- Update `test:auth` script coverage.
- Require local and staging bootstrap smoke in the pre-release gate.
- Include `.env.example` in docs acceptance.

### DX Implementation Tasks

- [ ] **DX-T1 (P1, human: ~1h / CC: ~10min) — Fresh User Smoke** — Add copy-paste local and staging auth-onboarding smoke paths and make both pre-release blockers.
  - Surfaced by: DX dual voices Pass 1.
  - Files: `README.md`, `docs/auth-runbook-route-privacy.md`.
  - Verify: a new contributor can follow local commands to bootstrap and call shopping; release checklist also proves the staging path.
- [ ] **DX-T2 (P1, human: ~1h / CC: ~10min) — Bootstrap API contract** — Document rich request/response/errors/idempotency/nullability.
  - Surfaced by: DX Pass 2 and Pass 3.
  - Files: `docs/auth-runbook-route-privacy.md`, `README.md`, `src/auth.ts`.
  - Verify: tests assert `status`, `result`, `profile`, `workspace`, `membership`, optional `warnings`, and error envelope including optional `docs`.
- [ ] **DX-T3 (P1, human: ~20min / CC: ~5min) — test:auth coverage** — Convert `npm run test:auth` to reliable auth/bootstrap coverage.
  - Surfaced by: DX subagent finding 2.
  - Files: `package.json`, `test/unit`.
  - Verify: `npm run test:auth` includes auth/bootstrap route tests and fails CI if a new bootstrap test file is omitted.
- [ ] **DX-T4 (P1, human: ~1.5h / CC: ~15min) — Supabase config docs** — Document confirmation resend, confirmation/reset deep links, password reset redirects, public/secret key rules, staging users and cleanup.
  - Surfaced by: DX Pass 6.
  - Files: `README.md`, `.env.example`, `docs/auth-runbook-route-privacy.md`.
  - Verify: docs include local and staging expected behavior for signup confirmation, resend, password reset, deep links, and staging test-user cleanup.

Phase 3.5 complete. DX overall: 5.5/10 -> target 8/10. TTHW: unclear -> target
under 5 minutes after env is configured. Codex: 7 concerns. Claude subagent:
9 issues. Consensus: 6/6 confirmed, 0 disagreements. Passing to Phase 4.

---

