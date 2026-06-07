# Auth Onboarding Implementation Phase 7: Doku und aktive TODOs

Main plan: [Auth Onboarding Slice Plan](../2026-06-07-auth-onboarding-slice-plan.md)

Relevant review detail:

- [DX Review](2026-06-07-auth-onboarding-phase-3-5-dx-plan.md)
- [CEO Review](2026-06-07-auth-onboarding-phase-1-ceo-plan.md)

## Ziel

Plan, Runbook und TODO spiegeln den echten Stand und die bewusst ausgeschlossenen Folgearbeiten.

## Aufgaben

- `TODO.md` aktuell halten:
  - Auth-Onboarding als aktuellen offenen Slice setzen.
  - Invites/Switching, OAuth/Magic Link, Recipe Sharing/Copy/Collections, BYOK/Credential Ownership und Recovery-Haertung als konkrete TODOs fuehren.
- `docs/auth-runbook-route-privacy.md` aktualisieren:
  - Recipes nicht mehr als deferred markieren.
  - Signup, Bootstrap, Confirmation Resend, Reset und Deep Links dokumentieren.
  - Privacy Boundary klarziehen: was jetzt geschuetzt ist und was nicht.
- README aktualisieren:
  - Nutzer-Registrierung erklaeren.
  - benoetigte Supabase Auth-Konfiguration nennen.
  - Fresh User Smoke verlinken.
- `.env.example` mit relevanten Supabase/Expo Auth Variablen pruefen.
- `docs/TEST_STATUS.md` bei Bedarf nachziehen.

## Akzeptanz

- Main-Plan verweist auf alle Detailplaene.
- Follow-ups stehen direkt in `TODO.md`.
- Runbook deckt local und staging inklusive Testuser-Cleanup ab.
- Neue Contributor koennen den Fresh User Smoke copy-pasten.

