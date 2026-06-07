# Auth Onboarding Implementation Phase 3: Account & Workspace Route

Main plan: [Auth Onboarding Slice Plan](../2026-06-07-auth-onboarding-slice-plan.md)

Relevant review detail:

- [Design Review](2026-06-07-auth-onboarding-phase-2-design-plan.md)
- [CEO Review](2026-06-07-auth-onboarding-phase-1-ceo-plan.md)

## Ziel

Nutzer sehen in einem eigenen Account-&-Workspace-Screen, was mit ihrem Account und Workspace los ist. Settings verlinkt dorthin, ist aber nicht die primaere Account-Oberflaeche.

## Aufgaben

- Eigene Account-&-Workspace-Route bzw. eigenen Expo-Screen anlegen.
- Settings verlinkt sichtbar auf Account & Workspace.
- Umschaltung zwischen `Anmelden`, `Account erstellen` und `Passwort zuruecksetzen`.
- Workspace-Status anzeigen:
  - `Workspace wird eingerichtet`
  - `Workspace: <Name>`
  - `Workspace konnte nicht eingerichtet werden`
- Account-/Workspace-Status anzeigen, aber keine Rollenlabels.
- Auth-Fehler sichtbar machen, nicht nur per generischem Alert.
- Return-Intent nach erfolgreichem Auth/Bootstrap unterstuetzen.

## Akzeptanz

- Ein nicht angemeldeter Nutzer sieht Login, Signup und Reset-Einstieg.
- Ein angemeldeter Nutzer sieht E-Mail und Workspace-Status ohne Rollenlabel.
- Bei Bootstrap-Fehler gibt es einen Retry.
- Guarded Screens koennen auf Account & Workspace verlinken und nach Erfolg zur urspruenglichen Route/Aktion zurueckkehren.

