# Auth Onboarding Implementation Phase 4: Geschuetzte Screen-Zustaende

Main plan: [Auth Onboarding Slice Plan](../2026-06-07-auth-onboarding-slice-plan.md)

Relevant review detail:

- [Engineering Review](2026-06-07-auth-onboarding-phase-3-engineering-plan.md)
- [Design Review](2026-06-07-auth-onboarding-phase-2-design-plan.md)

## Ziel

Auth- und Setup-Fehler duerfen nicht wie leere Daten aussehen.

## Aufgaben

- Gemeinsamen Auth-/Setup-Error-Mapper fuer geschuetzte mobile `apiFetch`-Callsites bauen.
- Recipe-Liste, Recipe-Detail, Shopping, Ingredient Search und Planner pruefen.
- `auth_missing` zeigt Login-Hinweis.
- `no_household` zeigt Bootstrap-/Workspace-Hinweis.
- `token_expired` zeigt erneutes Anmelden.
- `bootstrap_failed` zeigt Setup-Fehler mit Retry.
- Keine geschuetzte Liste behandelt Auth-Fehler als erfolgreiche leere Liste.

## Akzeptanz

- Ohne Session sieht der Nutzer keinen falschen leeren Zustand.
- Nach Login/Bootstrap laden die Screens normal.
- Planner akzeptiert eigene private Rezepte und lehnt fremde private Rezepte serverseitig ab.
- Mobile Flow Test beweist, dass Ownership-/Auth-Fehler nicht als Empty State erscheinen.

