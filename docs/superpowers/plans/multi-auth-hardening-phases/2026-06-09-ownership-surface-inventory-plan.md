# Multi-Auth Phase 2: Ownership Surface Inventory

Datum: 2026-06-09
Main plan: [Multi-Auth Hardening Plan](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-06-09-multi-auth-hardening-plan.md)

> **Umgesetzt:** Vollstaendige Inventur auf aktuellem Code-Stand abgeschlossen
> (2026-06-15). Referenzartefakt:
> [Ownership Surface Inventory](/home/patrick/Projekte/rezepti/docs/2026-06-15-ownership-surface-inventory.md).

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

---

# /autoplan Review (2026-06-09, vorwaertsgerichtet)

## Phase 1: CEO Review

**Premise-Tabelle:**

| Praemisse | Beurteilung | Befund |
|-----------|-------------|--------|
| `recipes` ist user/household-scoped und sauber | KORREKT | DB-Check-Constraint + `ownerType IN ('user','household')` enforced |
| `shopping`/`planner` ist household-scoped | KORREKT | `householdId NOT NULL` in Schema, Route liest `activeHouseholdId` aus Auth-Context |
| `ingredient_dictionary` ist global mutable | KORREKT | Kein Owner-Feld, `GET` ohne Auth (bewusste Entscheidung, braucht Dokumentation) |
| Credential-Routes sind als Hotspot bekannt | TEILWEISE | Cookidoo disk-backed global fehlt als eigene Kategorie |
| `/api/v1/images/search` ist auth-gated | FALSCH | Kein `requireAuth()` — unguarded Unsplash-Call (P0-Kandidat) |

**Scope-Gaps (fehlende Oberflaechen):**
- `households` + `householdMemberships` + `userDefaultHouseholds` — Membership-CRUD-Routen fehlen im Scope komplett
- `photoDataStore` / `textDataStore` (in-memory in `extraction.ts`) — kurzlebig aber keine TTL-Guarantee im Plan
- `disk-backed / server-scoped-singleton` als Kategorie fehlt (Cookidoo Credentials)
- Dictionary `GET` Read-Path explizit labeln (intentional public-read, kein Datenleak — aber unbeschriftet)

**DoD-Bewertung:** Abschluss-Kriterium nicht automatisch pruefbar. "Keine Flaeche mehr unknown" braucht einen diff-faehigen Route-Scan.

**CEO Completion:** Plan ist strukturell solide, aber 2 kritische Luecken (images/search, households-Scope) muessen vor Ausfuehrung in den Scope aufgenommen werden.

## Phase 3: Eng Review

**Findings:**

| Severity | Finding | Fix |
|----------|---------|-----|
| CRITICAL | `/api/v1/images/search` unauthenticated + dictionary GET Read-Path nicht als "intentional public" gelabelt | In Inventory-Scope aufnehmen; images/search klassifizieren und entscheiden |
| HIGH | `households`/`householdMemberships`/`userDefaultHouseholds` fehlen komplett im Scope | In Scope aufnehmen |
| HIGH | `grep src/routes/*` uebersieht Routen in `extraction.ts`, `platforms.ts` usw. — alle Routen muessen erfasst werden, nicht nur nach Dateiname | Methodik: alle Routen via `grep -r "app\.(get\|post\|put\|patch\|delete)" src/` |
| MEDIUM | `server-scoped-singleton`-Kategorie fehlt in den 6 definierten Kategorien | Kategorie ergaenzen |
| MEDIUM | `shoppingList.userId` vorhanden, aber Read-Boundary ist nur `householdId` — Inkonsistenz | In Inventory klassifizieren |
| LOW | DoD-Exit-Test nicht automatable ohne Script | Vorschlag: Route-Liste per Script gegen Inventory-Tabelle diff-en |

## Scope-Erweiterungen (vor Ausfuehrung einarbeiten)

Der Inventory-Pass (S3) muss folgende Ergaenzungen gegenueber dem urspruenglichen Plan abdecken:

1. `/api/v1/images/search` — klassifizieren (auth hinzufuegen oder dokumentiert offen lassen)
2. `ingredient_dictionary` GET Read-Path — als "intentional public-read, global" labeln
3. `households` + `householdMemberships` + `userDefaultHouseholds` — Scope aufnehmen
4. Cookidoo `disk-backed` als Kategorie `server-scoped-singleton` ergaenzen
5. Methodik: vollstaendiger Route-grep statt nur `src/routes/`

## Decision Audit Trail

| # | Decision | Classification | Rationale |
|---|----------|----------------|-----------|
| INV-CEO-1 | images/search in Inventory-Scope (P0-Kandidat) | Mechanical | Unguarded external API call; CEO-6 im Post-Hotfix-Plan bereits bestaetigt |
| INV-CEO-2 | households-Scope hinzufuegen | Mechanical | Zukuenftige Invite-Slices bauen darauf auf |
| INV-ENG-1 | Methodik auf vollstaendigen Route-grep erweitern | Mechanical | Dateipfad-basierter grep verpasst Subrouten |
| INV-ENG-2 | server-scoped-singleton als neue Kategorie | Mechanical | Cookidoo-Pattern passt in keine der 6 bestehenden Kategorien |
| INV-ENG-3 | DoD-Script vorschlagen (kein Pflichtartefakt) | Taste | Nice-to-have; manueller Diff ist akzeptabel fuer einmalige Inventur |

## Phase 4: Final Gate — APPROVED 2026-06-09

| Entscheidung | Gewaehlt | Aktion |
|---|---|---|
| Inventur-Methodik | **Vollstaendiger Route-grep** | `grep -r 'app\.(get\|post\|put\|patch\|delete)' src/` — nicht nur `src/routes/` |
| Scope-Erweiterung | **Households + images/search + disk-backed** | Alle 5 Ergaenzungen aus Eng-Review in Scope aufgenommen |
| DoD-Exit-Test | **Manueller Diff reicht** | Kein Pflicht-Script; Route-Liste manuell gegen Inventory-Tabelle diff-en |

**Status: ABGESCHLOSSEN ✅ (2026-06-12)**
S3 ausgefuehrt: Vollstaendiger Route-grep ueber `src/`, alle 46 Routen klassifiziert, Route-Auth-Inventory-Tabelle in CLAUDE.md eingefuegt, `/api/v1/images/search` mit `requireUserAuth` gated. Keine `unknown`-Flaechen ohne Folgeaktion offen.
