# Auth Onboarding Implementation Phase 6: Tests

Main plan: [Auth Onboarding Slice Plan](../2026-06-07-auth-onboarding-slice-plan.md)

Relevant review detail:

- [Engineering Review](2026-06-07-auth-onboarding-phase-3-engineering-plan.md)
- [DX Review](2026-06-07-auth-onboarding-phase-3-5-dx-plan.md)

## Ziel

Signup, Bootstrap, Ownership und Auth-Zustaende regressionssicher machen.

## Aufgaben

- Root Unit Tests:
  - Bootstrap-Endpoint ohne Token.
  - Bootstrap-Endpoint mit validem User.
  - Bootstrap ist idempotent.
  - Concurrent Bootstrap erzeugt eine Default-Workspace-Mapping-Zeile.
  - Neuer User kann nach Bootstrap Shopping/Planner-Kontext laden.
  - Eigene private Rezepte sind im Planner erlaubt, fremde private Rezepte nicht.
- Mobile Unit Tests:
  - Signup/Login ruft Bootstrap.
  - Confirmation required und resend.
  - Passwort-Reset.
  - Account & Workspace zeigt Signup/Login/Logout/Reset-Zustaende; Settings verlinkt dorthin.
  - Shared protected-fetch mapper bewahrt Auth-/Setup-States.
- `test:auth` so erweitern, dass Auth-/Bootstrap-Tests nicht still ausgelassen werden.
- Local und Staging Fresh User Smoke inklusive Testuser-Cleanup dokumentieren.

## Verifikation

```bash
npx tsc --noEmit
npm run test:auth
npm run test:unit
npm --prefix mobile run typecheck
npm --prefix mobile run test:unit
npm run supabase:rls-smoke
SUPABASE_RLS_SMOKE_CONFIRM=rezepti-staging npm run supabase:rls-smoke:staging
```

