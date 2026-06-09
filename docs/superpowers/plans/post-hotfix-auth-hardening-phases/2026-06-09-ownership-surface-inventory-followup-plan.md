# Post-Hotfix Phase 2: Ownership Surface Inventory Follow-Up

Datum: 2026-06-09
Main plan: [Post-Hotfix Auth Hardening Follow-Up Plan](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-06-09-post-hotfix-auth-hardening-plan.md)

## Ziel

Nach dem Credential-Hotfix darf keine relevante produktive Datenflaeche mehr
nur gefuehlt scoped sein. Dieser Schritt erzeugt die Referenzkarte aller
Ownership-Grenzen.

## Scope

- API-Routen, DB-Tabellen, lokale Persistenz und disk-backed Konfigurationen
  klassifizieren.
- Read- und Write-Boundaries explizit trennen.
- Unklare oder riskante Flaechen als P0/P1/P2-Finding dokumentieren.

## Kategorien

- `user-scoped`
- `workspace-scoped`
- `global`
- `admin-only`
- `disabled`
- `unknown`

Zusatzmarker:

- `read-only`
- `mutation`
- `legacy`
- `needs-migration`
- `copy-risk`

## Inventur-Reihenfolge

### 1. API-Oberflaechen

- Alle produktiven `/api/v1/*`-Routen mit Nutzer- oder Workspace-Bezug erfassen.
- Pro Route dokumentieren:
  - Auth requirement
  - aktiver Workspace ja/nein
  - gelesene/geschriebene Daten
  - Read- und Write-Boundary
  - Admin-/Local-only-Ausnahmen

### 2. Persistente Daten

- Tabellen fuer Recipes, Planner, Shopping, Jobs, Memberships, Defaults,
  `ingredient_dictionary`, Credentials und weitere Artefakte pruefen.
- Data-API offen/geschlossen explizit markieren.

### 3. App-seitige lokale Persistenz

- AsyncStorage, Query-Persistenz und sonstige lokale Stores pruefen.
- Klar markieren, was nur geraetelokal, sessionlokal oder serverseitig gedacht
  ist.

### 4. Legacy- und Admin-Pfade

- Historische Admin-, CLI- und lokale Dateipfade aufnehmen.
- Entscheiden, ob sie produktfern bleiben duerfen oder explizit begrenzt werden
  muessen.

## Artefakt

Ergebnis ist eine Referenztabelle mit:

- Surface
- Layer
- Current owner model
- Auth requirement
- Read boundary
- Write boundary
- Risk
- Required action

## Erwartete Hotspots

- `ingredient_dictionary`
- Import-/Extraction-Artefakte
- Jobs mit indirektem Nutzerbezug
- lokale Credential-/Config-Files
- Folgeobjekte wie Favorites, Collections oder Copy-Flows

## Abschlusskriterium

Diese Phase ist fertig, wenn:

- keine relevante produktive Flaeche ohne Klassifikation bleibt,
- `TODO.md:47` in eine konkrete Restliste ueberfuehrt werden kann,
- und der Credential-Teilplan auf dieser Inventur statt auf Annahmen basiert.
