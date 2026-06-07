# Auth Onboarding Implementation Phase 5: Web Account Einstieg

Main plan: [Auth Onboarding Slice Plan](../2026-06-07-auth-onboarding-slice-plan.md)

Relevant review detail:

- [Design Review](2026-06-07-auth-onboarding-phase-2-design-plan.md)
- [DX Review](2026-06-07-auth-onboarding-phase-3-5-dx-plan.md)

## Ziel

Wer die Web-App oeffnet, findet den Account-Einstieg ohne technische Settings-Suche.

## Aufgaben

- Account & Workspace in Web-/Tab-Navigation sichtbar machen.
- Guarded Web States fuehren zu Account & Workspace.
- Settings bleibt nur sekundärer Link.
- Deep-Link-/Redirect-Verhalten fuer Confirmation und Reset lokal/staging dokumentieren und testen.

## Akzeptanz

- Auf Web ist erkennbar, wo man sich anmeldet, registriert oder Passwort-Reset startet.
- Geschuetzte Web-Screens fuehren nicht in unerklaerte Auth-Fehler.
- Account & Workspace ist von Navigation, Settings und guarded states erreichbar.

