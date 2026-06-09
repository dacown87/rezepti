# Post-Hotfix Phase 4: Account Deletion and Recovery Hardening

Datum: 2026-06-09
Main plan: [Post-Hotfix Auth Hardening Follow-Up Plan](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-06-09-post-hotfix-auth-hardening-plan.md)

## Ziel

Der minimal gelieferte Reset-/Confirmation-Unterbau reicht fuer interne Nutzung,
aber nicht fuer belastbare externe Account-Verwaltung. Dieser Teilplan schneidet
die offenen Entscheidungen fuer Recovery-Hardening und Account-Loeschung so,
dass der naechste Umsetzungsslice nicht wieder bei Grundsatzfragen startet.

## Scope

- Recovery-/Confirmation-Fehlerpfade und Redirect-Matrix explizit machen.
- Support-, Audit- und Runbook-Grenzen dokumentieren.
- Account-Loeschung inklusive Datenfolgen und Household-Konsequenzen planen.

## Nicht-Ziele

- Kein OAuth-/Magic-Link-Ausbau.
- Kein Datenexport-UI in dieser Phase.
- Kein Invite-System.

## Arbeitsschritte

### 1. Recovery-Matrix vervollstaendigen

- Staging/Production URLs
- Web-Redirects
- Mobile-Deep-Links
- abgelaufene Links
- Session-Mismatch
- Rate-Limit-Faelle
- Support-Fallback

### 2. Nutzer- und Support-Verhalten festziehen

- Welche Fehler sieht der Nutzer direkt?
- Welche Fehler brauchen Logs oder Telemetrie?
- Wann ist Support notwendig und was muss dafuer sichtbar dokumentiert sein?

### 3. Account-Loeschung modellieren

- Welche Daten werden geloescht, anonymisiert oder bleiben aus
  Workspace-/Audit-Gruenden bestehen?
- Was passiert mit Owner-Memberships, Default-Workspace, Recipes, Jobs,
  Shopping, Planner und Credential-Artefakten?
- Welche Vorbedingungen gelten, wenn der letzte Owner einen Workspace verlaesst?

### 4. Minimalen Umsetzungsweg schneiden

- manueller Support-Pfad als Vorstufe
- Self-Service nur, wenn Regeln und DB-Folgen klar sind
- klare Nicht-Versprechen in UI und Doku bis zur echten Umsetzung

## Artefakte

- Recovery-Runbook-Matrix
- Entscheidungsnotiz fuer Account-Loeschung und Datenfolgen
- Restliste fuer offene Policy- oder Produktfragen

## Abschlusskriterium

Diese Phase ist fertig, wenn:

- `TODO.md:48` nicht mehr nur ein Sammelpunkt ist,
- Recovery-Hardening als konkreter Umsetzungsslice vorbereitet ist,
- und Account-Loeschung inklusive Datenfolgen explizit entschieden oder als
  offene Produktentscheidung markiert ist.
