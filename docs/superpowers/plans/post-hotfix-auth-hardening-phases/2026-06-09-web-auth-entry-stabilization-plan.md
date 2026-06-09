# Post-Hotfix Phase 1: Web Auth Entry Stabilization

Datum: 2026-06-09
Main plan: [Post-Hotfix Auth Hardening Follow-Up Plan](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-06-09-post-hotfix-auth-hardening-plan.md)

## Ziel

Der Web-Einstieg fuer Login, Signup, Session-Restore, Account und Workspace
moechte nicht nur technisch irgendwie funktionieren, sondern fuer normale
Nutzung belastbar sein.

## Scope

- Browser-Flow fuer Signup, Login, Logout und Session-Restore verifizieren.
- Account-/Workspace-Einstieg auf Sackgassen, falsche Redirects und Alt-Caches
  pruefen.
- Deep-Link-/Reset-/Confirmation-Rueckkehr fuer Web konkret absichern.
- Web-Persistenz-Abnahme als Folge-Gate vorbereiten, aber nicht mit PWA mischen.

## Leitfragen

- Wo brechen Web-Flows heute noch: Session, Redirect, Bootstrap, Navigation oder
  Query-Cache?
- Welche Fehler sind echte Produktblocker und welche nur Detailpolitur?
- Welche Protected Screens zeigen nach Reload oder neuem Tab noch alte oder
  signed-out-nahe Zwischenzustaende?

## Arbeitsschritte

### 1. Relevante Pfade kartieren

- `account.tsx`, Root-Layout, Auth-Observer, Redirect-Helfer und Protected-
  Screen-Fallbacks als Flow erfassen.
- Browser-spezifische Session-Speicherung und Session-Restore dokumentieren.
- Rueckkehr nach Confirmation/Reset fuer Web explizit festhalten.

### 2. Repro-Matrix aufbauen

- Frischer Signup.
- Bestehender Login.
- Logout und erneuter Login.
- Reload auf geschuetzter Route.
- Neuer Tab auf geschuetzter Route.
- Neue Browser-Session.

Pro Fall festhalten:

- Repro
- Erwartung
- Ist-Verhalten
- betroffener Layer

### 3. Fixes nach Ursache statt nach Screen schneiden

Typische Kategorien:

- Session-Persistenz
- Auth-Observer-/Bootstrap-Race
- Query-Cache bei Userwechsel oder Signed-out-Rueckkehr
- Redirect-/Navigation-Rueckkehr
- Fehlerzustand fuer abgelaufene oder ungueltige Recovery-Links

### 4. Mindest-Regression absichern

- Auth-/Protected-Tests um den gefundenen Failure-Mode ergaenzen.
- Browser-spezifische manuelle Smokes knapp dokumentieren.
- Keine Bundle-/Entry-Regression stillschweigend einhandeln.

## Betroffene Bereiche

- `mobile/app/account.tsx`
- `mobile/app/(tabs)/settings.tsx`
- `mobile/app/_layout.tsx`
- `mobile/utils/auth.ts`
- `mobile/utils/api.ts`
- Query-Cache- und Protected-Screen-Fallbacks

## Abschlusskriterium

Diese Phase ist fertig, wenn:

- Web-Login-/Signup-/Session-Flow ohne Sackgassen laeuft,
- Reload und neuer Tab den Auth-Kontext nicht verlieren,
- und `TODO.md:20` inhaltlich abgearbeitet werden kann.
