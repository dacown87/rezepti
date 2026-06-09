# Multi-Auth Phase 2: Ownership Surface Inventory

Datum: 2026-06-09
Main plan: [Multi-Auth Hardening Plan](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-06-09-multi-auth-hardening-plan.md)

> **/autoplan 2026-06-09 — Update:** Im Kern ein `grep`-Pass ueber `src/routes/*` +
> `src/schema.ts`; blockiert NICHT den Credential-Hotfix (dessen Kandidaten sind bereits
> bekannt und verifiziert). Bereits gesicherter Stand: `recipes` (user/household via
> `recipeVisibilityForAuth`), `shopping`/`planner` (household-scoped) sind sauber. Offen/
> unscoped: Credential-Routes (siehe Phase 3) **und** `ingredient_dictionary` (global
> mutable, in den Hotspots ergaenzen).

## Ziel

Vor weiteren Multi-Auth- oder Collaboration-Slices muss klar sein, welche
Daten, Routen und Aktionen bereits sauber user- oder workspace-scoped sind und
wo noch Luecken oder unklare Zwischenzustaende existieren.

## Scope

- Server-Routen, DB-Tabellen, disk-backed Daten, lokale Dateien und
  Credential-nahe Mutationen inventarisieren.
- Jede Flaeche einer Ownership-Kategorie zuordnen.
- Unklare oder riskante Flaechen als konkrete Folgearbeit dokumentieren.

## Kategorien

Jede Flaeche bekommt genau eine Primaerklassifikation:

- `user-scoped`
- `workspace-scoped`
- `global`
- `admin-only`
- `disabled`
- `unknown`

Zusatzmarker bei Bedarf:

- `read-only`
- `mutation`
- `legacy`
- `needs-migration`
- `copy-risk`

## Inventur-Reihenfolge

### 1. API-Oberflaechen

- Alle `/api/v1/*`-Routen mit Userdatenbezug erfassen.
- Pro Route festhalten:
  - braucht Auth?
  - nutzt aktiven Workspace?
  - liest/schreibt welche Daten?
  - welche Ownership wird erzwungen?
  - gibt es Sonderfaelle fuer Admin oder lokale Nutzung?

### 2. Persistente Daten

- Relevante Tabellen fuer Recipes, Planner, Shopping, Jobs, API-Keys,
  Plattform-Credentials, Profile, Memberships und Defaults pruefen.
- Pro Tabelle oder Datensatztyp festhalten:
  - Owner-Feld oder Membership-Kontext
  - wer lesen darf
  - wer schreiben darf
  - ob Data API geschlossen oder offen ist

### 3. App-seitige lokale Persistenz

- AsyncStorage oder andere lokale Stores pruefen.
- Festhalten, welche Daten nur geraetelokal, sessionlokal oder serverseitig
  erwartet werden.
- Sicherstellen, dass lokale Persistenz nicht versehentlich als
  account-private Cloud-Persistenz verstanden wird.

### 4. Legacy- und Admin-Pfade

- Historische Admin-, CLI-, Local-only- oder disk-backed Pfade erfassen.
- Entscheiden, ob sie fuer normale User verborgen, deaktiviert oder sauber
  begrenzt werden muessen.

## Artefakt

Das Ergebnis soll ein Referenzdokument sein, idealerweise als Tabelle mit:

- Surface
- Layer
- Current owner model
- Auth requirement
- Read boundary
- Write boundary
- Risk
- Required action

## Priorisierung der Findings

### P0

- Cross-user read/write moeglich
- Workspace-Daten ohne Workspace-Grenze
- UI verspricht privat, Code ist global

### P1

- Ownership unklar oder inkonsistent
- Read und write haben unterschiedliche Boundary-Logik
- Legacy-Pfade umgehen neue Auth-Regeln

### P2

- Nur Doku oder Copy unscharf
- Nur intern genutzte Pfade ohne unmittelbare Nutzerwirkung

## Erwartete Hotspots

- BYOK- und Plattform-Credentials
- Import-/Extraction-Pfade
- Admin- oder lokale Konfigurationspfade
- Recipe-Folgeobjekte wie Favorites, Collections oder Copy-Workflows
- eventuelle Jobs oder Artefakte mit indirektem Nutzerbezug

## Abschlusskriterium

Dieser Teilplan ist fertig, wenn:

- keine relevante produktive Datenflaeche mehr `unknown` ohne Folgeaktion ist,
- die Befunde in P0/P1/P2 sortiert sind,
- `TODO.md:41` in eine explizite Restliste ueberfuehrt werden kann,
- der Credential-Teilplan auf der Inventur statt auf Annahmen basiert.

## Risiken

- Ohne klare Kategorisierung werden spaetere Invite-, Sharing- oder
  Multi-Workspace-Slices auf unsaubere Besitzgrenzen gebaut.
- Eine nur codeorientierte Inventur reicht nicht, wenn UI-Copy etwas anderes
  verspricht als die echte Speicherung.
