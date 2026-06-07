# Auth Onboarding Implementation Phase 2: Mobile Auth Utility

Main plan: [Auth Onboarding Slice Plan](../2026-06-07-auth-onboarding-slice-plan.md)

Relevant review detail:

- [Design Review](2026-06-07-auth-onboarding-phase-2-design-plan.md)
- [DX Review](2026-06-07-auth-onboarding-phase-3-5-dx-plan.md)

## Ziel

Mobile kann Signup, Login, Passwort-Reset und Bootstrap einheitlich ausloesen.

## Aufgaben

- `mobile/utils/auth.ts` um `signUpWithPassword(email, password)` erweitern.
- Discriminated Signup Result verwenden:
  - `session_ready`
  - `confirmation_required`
  - `signup_failed`
- Confirmation Resend mit Loading-, Success-, Fehler- und Rate-Limit-Zustaenden ergaenzen.
- Minimalen Passwort-Reset ueber Supabase Reset-Mail ergaenzen.
- Confirmation-/Reset-Deep-Links fuer Expo/Supabase local und staging verdrahten.
- Helper fuer `bootstrapAccount()` oder `ensureAccountBootstrap()` ergaenzen.
- `bootstrapAccount()` muss `apiFetch`/`assertApiOk` nutzen und `ApiRequestError` Details erhalten.
- Submit-Lock fuer Signup/Login/Reset/Bootstrap ergaenzen.

## Akzeptanz

- Signup erzeugt eine Session oder zeigt `confirmation_required` klar.
- `confirmation_required` ruft Bootstrap nicht auf und kann E-Mail erneut senden.
- Login ruft Bootstrap genau einmal pro Submit auf.
- Passwort-Reset zeigt neutrale Success-Copy und leakt nicht, ob eine E-Mail existiert.
- Deep Links funktionieren in local/staging oder zeigen dokumentierte recoverable Copy.
- Logout bleibt unveraendert und leert Session/Cache.

