# Auth Onboarding Implementation Phase 1: Server Bootstrap

Main plan: [Auth Onboarding Slice Plan](../2026-06-07-auth-onboarding-slice-plan.md)

Relevant review detail:

- [Engineering Review](2026-06-07-auth-onboarding-phase-3-engineering-plan.md)
- [DX Review](2026-06-07-auth-onboarding-phase-3-5-dx-plan.md)

## Ziel

Nach Signup/Login kann die App den Account-Kontext serverseitig vervollstaendigen.

## Aufgaben

- Neue Auth-Route anlegen, z. B. `src/routes/auth.ts`.
- `POST /api/v1/auth/bootstrap` implementieren.
- `user_default_households` als durable Default-Workspace-Invariante ergaenzen.
- DB-Helper in `src/db-react.ts` ergaenzen:
  - `ensureUserProfile(userId, email)`
  - `ensureDefaultHouseholdForUser(userId)`
  - `getAccountBootstrapStatus(userId)`
- Endpoint in `src/api-react.ts` mounten.
- Fehlervertrag an bestehende Auth-Codes anlehnen und optionales `docs` Feld erhalten.
- Strukturierte Bootstrap-Logs fuer start/success/failure ohne Tokens, Passwoerter oder rohe E-Mail-Adressen ergaenzen.

## Akzeptanz

- Neuer valider Supabase-User bekommt Profil, Default-Workspace und Owner-Membership.
- Bestehender User bekommt denselben Workspace zurueck, ohne Duplikate.
- Concurrent Bootstrap erzeugt genau einen Starter-Workspace und eine `user_default_households` Zeile.
- Fehlender Token liefert `auth_missing`.
- Invalid Token liefert `auth_invalid` oder `token_expired`.
- Success Response enthaelt `status`, `result`, `profile`, `workspace`, `membership` und optional `warnings`.

