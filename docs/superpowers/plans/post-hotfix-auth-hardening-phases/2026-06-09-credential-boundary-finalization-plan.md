# Post-Hotfix Phase 3: Credential Boundary Finalization

Datum: 2026-06-09
Main plan: [Post-Hotfix Auth Hardening Follow-Up Plan](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-06-09-post-hotfix-auth-hardening-plan.md)

## Ziel

Der Hotfix hat akute unauthentifizierte Credential-Pfade geschlossen. Offen
bleibt die saubere Endregel: Welche Credential-Typen sind dauerhaft
`disabled`, `admin-only`, `user-scoped` oder spaeter `workspace-scoped`?

## Scope

- Alle aktuellen Credential-Typen mit einer Endregel versehen.
- Server, UI und Doku an dieselbe Boundary anpassen.
- Neue Implizitheit verhindern: keine halbprivate Copy auf globalen oder
  lokalen Backends.

## Entscheidungsrahmen

Fuer jeden Credential-Typ genau eine Regel:

1. `disabled`
2. `admin-only`
3. `user-scoped`
4. `workspace-scoped`

`global` ist nur als dokumentierter technischer Ist-Zustand fuer die Inventur
zulaessig, nicht als stilles Produktversprechen.

## Arbeitsschritte

### 1. Ist-Zustand final benennen

- Speicherort
- aktuelle Read-/Write-Pfade
- sichtbare UI/Copy
- Risiko

Kandidaten:

- BYOK/API-Key-Pfade
- Cookidoo-Credentials
- Pinterest-Credentials
- Facebook-Credentials
- weitere Connector-/Import-Zugangsdaten

### 2. Zwischenregel vor Wunschmodell

- Lieber `disabled` oder `admin-only` als scheinbar private, aber global
  wirkende Speicherung.
- `workspace-scoped` nur dann, wenn Membership- und Rollenlogik wirklich
  mitgeliefert wird.

### 3. Technische Durchsetzung

- Route sperren, verbergen oder owner-scopen.
- Delete-/Update-Zugriffe mit Owner-Kontext absichern.
- Fehlercodes, Logs und Settings-Copy anpassen.

### 4. Tests

- unauthenticated denied
- user A darf user B nicht lesen/mutieren
- admin-only nicht fuer normale Nutzer erreichbar
- disabled erzeugt keine irrefuehrenden UI-Zustaende

## Abschlusskriterium

Diese Phase ist fertig, wenn:

- jeder Credential-Typ eine explizite Boundary-Regel hat,
- `TODO.md:46` nicht mehr als unklare Ownership-Frage besteht,
- und neue Connector-Pfade an derselben Regel gemessen werden koennen.
