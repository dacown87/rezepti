# Cookidoo User-Default + Optional Household-Share Implementation Plan

Datum: 2026-06-15
Status: geplant
Design: [2026-06-15-cookidoo-user-household-ownership-plan.md](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-06-15-cookidoo-user-household-ownership-plan.md)

## Goal

Ersetze die aktuelle globale Cookidoo-Singleton-Speicherung durch:

- private Cookidoo-Credentials pro User als Default
- optionale explizite Freigabe fuer den aktiven Haushalt
- keine Uebernahme alter globaler Disk-Credentials

BYOK bleibt unveraendert:

- lokal gespeicherter User-Key gewinnt
- ohne User-Key bleibt der Server-Fallback auf `GROQ_API_KEY`

## Architektur

Cookidoo bekommt einen kleinen serverseitigen Credential-Store mit explizitem
Scope statt der bisherigen globalen Datei:

- DB-Tabelle fuer Cookidoo-Credentials mit `scope_type = 'user' | 'household'`
- derselbe Scoped-Store haelt auch die Cookidoo-Session-Metadaten
- API-Resolver mit Prioritaet `user > household > none`
- Settings-UI fuer privaten Save und getrennte Household-Freigabe
- alte globale Datei wird ignoriert und entfernt

Wichtige Architekturentscheidung aus dem Review:

- **keine neuen scope-namespaced Dateipfade auf Disk**
- Credentials und Cookidoo-Session werden gemeinsam DB-scoped gehalten

Warum: der aktuelle Fetcher haengt heute noch an globalem `config.cookidoo.*`
und globaler Session-Datei `data/cookidoo-session.json`. Ein Plan, der nur die
Credentials scoped, aber die Session weiter auf globaler Disk laesst, behaelt
den eigentlichen Boundary-Bug.

## Scope

- Cookidoo-Datenmodell
- Credential-Resolver
- Cookidoo-Status-/Save-/Delete-/Share-Routen
- Settings-UI und Copy
- Migration von global -> scoped mit hartem Verwerfen alter Daten
- Unit-/Contract-Tests

## What already exists

- `src/routes/platforms.ts` hat bereits auth-gated Cookidoo-Status-/Save-/Delete-Routen.
- `src/fetchers/cookidoo.ts` enthaelt den kompletten Login- und Session-Flow,
  ist heute aber global an `config.cookidoo` und `cookidoo-session.json`
  gekoppelt.
- `mobile/app/(tabs)/settings.tsx` hat bereits die komplette Cookidoo-UI fuer
  Save/Disconnect/Status.
- `test/unit/cookidoo-credentials.test.ts` deckt den aktuellen Auth-Vertrag der
  Routen bereits gut ab und ist die richtige Basis fuer den neuen Scope-Vertrag.

## NOT in scope

- kein allgemeiner Multi-Provider-Credential-Layer
- keine Pinterest-/Facebook-Reaktivierung
- keine serverseitige BYOK-Persistenz
- kein Multi-Household-Switcher oder Household-Rollenumbau ausser dem benoetigten
  Owner-Gate fuer Share/Delete-Share
- keine Migration alter globaler Credentials auf einen User oder Haushalt

## Nicht-Ziele

- kein Pinterest-/Facebook-Rework
- keine allgemeine Provider-Credential-Abstraktion
- kein Multi-Household-Switcher
- kein BYOK-Storage-Umbau

## Umsetzung in Phasen

### Phase 1: Datenmodell + harte Migration

Ziel: globale Altlasten abschneiden und sauberen Scoped-Store einfuehren.

#### Dateien

- neu: `supabase/migrations/<timestamp>_cookidoo_credentials_scoped.sql`
- anpassen: `src/schema.ts`
- anpassen: `src/db-react.ts`

#### Datenmodell

Neue Tabelle `cookidoo_credentials`:

- `id`
- `scope_type text not null check in ('user','household')`
- `user_id uuid null`
- `household_id uuid null`
- `email text not null`
- `password text not null`
- `created_by uuid not null`
- `session_cookies text null`
- `session_user_agent text null`
- `session_expires_at timestamptz null`
- `created_at`
- `updated_at`

Constraints:

- genau einer von `user_id` oder `household_id` passend zu `scope_type`
- unique auf `user_id` fuer `scope_type='user'`
- unique auf `household_id` fuer `scope_type='household'`

Migrationsregeln:

- globale Datei `data/cookidoo-credentials.json` loeschen bzw. nicht mehr lesen
- globale Datei `data/cookidoo-session.json` loeschen bzw. nicht mehr lesen
- keine automatische Datenuebernahme

#### Abnahmekriterien

- es existiert kein produktiver Lese-/Schreibpfad mehr auf globale Cookidoo-Dateien
- DB-Constraints erzwingen genau einen Scope

### Phase 2: Server-Resolver + Fetcher-Integration

Ziel: Cookidoo nutzt scoped Credentials statt globaler Datei.

#### Dateien

- anpassen: `src/fetchers/cookidoo.ts`
- anpassen: `src/pipeline.ts`
- anpassen: `src/routes/platforms.ts`
- anpassen: `src/routes/extraction.ts`
- anpassen: `src/job-manager.ts`
- anpassen: `src/db-react.ts`

#### Regeln

Resolver:

1. private User-Credentials des Callers
2. falls nicht vorhanden: Household-Credentials des aktiven Haushalts
3. sonst keine Credentials

Serververhalten:

- `GET /api/v1/cookidoo/status`
  - Antwort erweitert um Scope-Info:
    - `scope: 'user' | 'household' | 'none'`
    - `connected`
    - optional `sharedByCurrentHousehold: boolean`
- `POST /api/v1/cookidoo/credentials`
  - speichert/ueberschreibt nur den privaten User-Eintrag
- `DELETE /api/v1/cookidoo/credentials`
  - loescht nur den privaten User-Eintrag
- `POST /api/v1/cookidoo/credentials/share`
  - kopiert aktuelle private User-Credentials in den aktiven Haushalt
- `DELETE /api/v1/cookidoo/credentials/share`
  - entfernt den Household-Eintrag des aktiven Haushalts

Policy:

- Share/Delete-Share nur fuer Household-Owner
- normale Household-Member duerfen Household-Share lesen/nutzen, aber nicht setzen

#### Wichtige technische Entscheidung

Der aktuelle Fetcher darf nicht weiter `config.cookidoo.email/password` oder
`data/cookidoo-session.json` als globale Wahrheit lesen. Stattdessen:

- neue DB-Helfer loesen fuer einen Auth-Context den aktiven Cookidoo-Scope auf
- `fetchCookidoo(...)` bekommt resolved credentials + session state injiziert
- erfolgreiche Logins aktualisieren nur den gerade verwendeten Scope
- `401/403` invalidieren nur die Session dieses Scopes, nicht global alles

Der Async-Job-Pfad braucht dafuer zusaetzlichen Scope-Context:

- heute traegt `jobManager` nur `userId`
- fuer Household-Fallback muss der Job auch `activeHouseholdId` snapshotten
- `processURL(..., options)` braucht deshalb zusaetzlich `activeHouseholdId`

Ohne diesen Snapshot weiss der Cookidoo-Fetch im Background-Job nicht, welchen
Household-Scope er ueberhaupt pruefen soll.

ASCII Datenfluss:

```text
Settings save/share
  -> platforms.ts
    -> db-react cookidoo helpers
      -> cookidoo_credentials row (user or household)

Extraction job
  -> routes/extraction.ts snapshots { userId, activeHouseholdId }
    -> job-manager stores both
      -> pipeline.ts passes both into fetchCookidoo
        -> db-react resolves scope: user > household > none
          -> fetcher logs in with resolved creds
            -> session fields written back to SAME scope row
```

### Phase 3: Settings-UI

Ziel: Nutzer koennen private Credentials speichern und bewusst teilen.

#### Dateien

- anpassen: `mobile/app/(tabs)/settings.tsx`
- optional neu: kleine Hilfsfunktionen in `mobile/utils/`
- anpassen/erstellen: `mobile/test/settings-cookidoo-fetch.test.ts`

#### UI-Verhalten

Private Ebene:

- Email/Passwort speichern bleibt der Default
- Copy: "Deine Cookidoo-Zugangsdaten sind privat."

Household-Ebene:

- separater Abschnitt oder Status-Hinweis:
  - "Fuer Haushalt freigegeben"
  - "Nicht fuer Haushalt freigegeben"
- Button:
  - `Fuer Haushalt freigeben`
  - `Haushaltsfreigabe entfernen`

Statusanzeige:

- `Privat verbunden`
- `Ueber Haushalt verbunden`
- `Nicht verbunden`

Keine UI darf weiter suggerieren, dass eine globale Server-Verbindung existiert.

### Phase 4: Tests + Doku-Abschluss

#### Server-Tests

- neue/erweiterte Tests in:
  - `test/unit/cookidoo-credentials.test.ts`
  - optional getrennt: `test/unit/cookidoo-scope-resolution.test.ts`

Pflichtfaelle:

- unauthenticated -> `401`
- User A sieht/mutiert nicht private Credentials von User B
- User-private Credentials schlagen Household-Share
- Household-Share greift, wenn private Credentials fehlen
- Non-owner darf Share/Delete-Share nicht mutieren
- globale Datei wird nicht mehr als Fallback gelesen
- Session-Invalidation betrifft nur den betroffenen Scope
- Extraction-Job mit `activeHouseholdId` nutzt denselben Resolver wie Settings

#### Mobile/UI-Tests

- Settings-Status rendert richtigen Scope
- Share/Delete-Share ruft richtige Endpunkte
- Copy spiegelt den echten Scope
- Disconnect privat vs. Disconnect Household-Share trennt die richtige Ebene

#### Doku

- `CLAUDE.md`
- `TODO.md`
- `docs/2026-06-15-ownership-surface-inventory.md`
- evtl. `docs/TEST_STATUS.md`

Danach Cookidoo in der Ownership-Doku umstellen von:

- `server-scoped-singleton`

auf:

- `user-scoped` default
- `workspace-scoped` optional via explicit share

## Task-Reihenfolge

1. Migration + Schema
2. DB-Helfer fuer scoped Cookidoo-Credentials
3. Job-/Pipeline-Context um `activeHouseholdId` erweitern
4. Resolver + scoped Session-State im Fetcher
5. API-Routen fuer status/save/delete/share
6. Settings-UI
7. Tests
8. Doku schliessen

## Risiken

- Wenn nur Credentials gescoped werden, aber die Cookidoo-Session global bleibt,
  bleibt die Boundary kaputt.
- Household-Share ohne Owner-Gate fuehrt zu unnötigem Rechtechaos.
- Altdaten-Fallback auf globale Datei wuerde den neuen Scope still unterlaufen.

## Failure Modes

| Codepath | Real production failure | Test? | Error handling? | User impact |
|---|---|---|---|---|
| private save | malformed payload or empty credentials | yes, required | yes -> `400` | clear inline/API error |
| household share | user is member but not owner | yes, required | yes -> `403` | clear denial, no silent fail |
| extraction job with household fallback | job lacks `activeHouseholdId`, so household share is never considered | yes, required | not today | silent wrong "not connected" behavior unless fixed |
| scoped session reuse | stale session for household scope is reused for private scope | yes, required | must be per-scope invalidation | cross-scope auth confusion |
| migration | old global file still read by fallback path | yes, required | no today | silent policy bypass |

## Verification

Minimum:

```bash
npx vitest run test/unit/cookidoo-credentials.test.ts
npx vitest run test/unit/planner-auth-routes.test.ts
npm run test:mobile -- settings-cookidoo-fetch
npx tsc --noEmit
```

Optional danach:

- eingeloggter manueller Smoke mit zwei Usern und einem gemeinsamen Haushalt

## Done

Der Slice ist fertig, wenn:

- globale Cookidoo-Credentials nicht mehr gelesen oder geschrieben werden
- private User-Credentials Default sind
- Household-Share explizit und owner-gated funktioniert
- BYOK-Fallback unveraendert bleibt
- UI, API und Doku dieselbe Scope-Regel kommunizieren

## Eng Review Decision

Review-Status: **freigegeben mit Architektur-Nachhaertung**

Entschiedene Punkte:

- **Cookidoo bleibt ein eigenstaendiger scoped Store**, kein allgemeiner
  Multi-Provider-Layer in diesem Slice.
- **Credentials und Session-State werden gemeinsam pro Scope gespeichert**.
  Ein nur teilweiser Umbau waere falsch, weil der aktuelle Boundary-Bug ueber
  die globale Session-Datei genauso weiterleben wuerde.
- **Der Resolver ist strikt `user > active household > none`**.
  Kein Server-Fallback, kein Read alter globaler Dateien, kein Read aus
  `config.cookidoo.*` im Runtime-Pfad.
- **Household-Fallback ist nur mit Job-Snapshot korrekt**.
  Deshalb ist `activeHouseholdId` im Background-Job kein Nice-to-have, sondern
  eine funktionale Voraussetzung fuer korrekte Ownership.
- **Share/Unshare bleibt Owner-gated**.
  Household-Mitglieder duerfen freigegebene Credentials nutzen, aber nicht
  stillschweigend die Quelle fuer den ganzen Haushalt umschalten.

Freigabegrund:

- Der Plan ist klein genug fuer einen einzelnen vertikalen Slice.
- Die wichtigsten echten Produktionsrisiken sind jetzt explizit adressiert:
  globaler Session-Leak, stiller Legacy-Fallback und fehlender Household-Kontext
  in Async-Jobs.
- Die Teststrategie deckt die Stellen ab, an denen die Boundary real brechen
  wuerde, statt nur Happy Paths zu pruefen.

## Parallelization Strategy

| Step | Modules touched | Depends on |
|---|---|---|
| Migration + DB helpers | `supabase/migrations/`, `src/schema.ts`, `src/db-react.ts` | — |
| Job/pipeline/fetcher scope wiring | `src/job-manager.ts`, `src/routes/extraction.ts`, `src/pipeline.ts`, `src/fetchers/cookidoo.ts` | Migration + DB helpers |
| Settings UI + mobile tests | `mobile/app/(tabs)/settings.tsx`, `mobile/test/` | API shape should be stable first |
| Route contract tests + docs | `test/unit/`, `CLAUDE.md`, `TODO.md`, docs | after API shape is locked |

Lanes:

- Lane A: Migration + DB helpers -> job/pipeline/fetcher wiring
- Lane B: Settings UI draft, then final adjustment after API shape stabilizes
- Lane C: route tests + docs after A

Execution order:

- Launch A first.
- B can start in parallel only on UI copy/layout, but should wait for A's final
  response shape before landing.
- C waits for A.

Conflict flags:

- Lane A and C both touch `src/` + test contracts around the same routes.
- Lane B and C both depend on final `cookidoo/status` response shape.

## Implementation Tasks

- [ ] **T1 (P1, human: ~3h / CC: ~20min)** — Cookidoo scoped store — move credentials and session state into DB-scoped rows
  - Surfaced by: Architecture Review — current fetcher still uses global `config.cookidoo.*` and global session file
  - Files: `supabase/migrations/`, `src/schema.ts`, `src/db-react.ts`, `src/fetchers/cookidoo.ts`
  - Verify: migration reset + `npx tsc --noEmit`
- [ ] **T2 (P1, human: ~2h / CC: ~15min)** — Extraction job scope snapshot — carry `activeHouseholdId` through background Cookidoo jobs
  - Surfaced by: Architecture Review — current jobs only persist `userId`, so household fallback cannot resolve correctly
  - Files: `src/job-manager.ts`, `src/routes/extraction.ts`, `src/pipeline.ts`
  - Verify: unit tests for resolver + job path
- [ ] **T3 (P1, human: ~2h / CC: ~15min)** — Route contract expansion — add owner-gated share/unshare endpoints and per-scope invalidation behavior
  - Surfaced by: Code Quality Review — boundary must live in dedicated helpers, not ad hoc route branches
  - Files: `src/routes/platforms.ts`, `src/db-react.ts`, `test/unit/cookidoo-credentials.test.ts`
  - Verify: `npx vitest run test/unit/cookidoo-credentials.test.ts`
- [ ] **T4 (P2, human: ~2h / CC: ~15min)** — Settings scope UX — expose private vs household state and actions explicitly
  - Surfaced by: Test Review — current UI only models connected/disconnected, not scope
  - Files: `mobile/app/(tabs)/settings.tsx`, `mobile/test/settings-cookidoo-fetch.test.ts`
  - Verify: `npm run test:mobile -- settings-cookidoo-fetch`
- [ ] **T5 (P1, human: ~1h / CC: ~10min)** — Legacy guardrail tests — prove old global files are ignored and scope invalidation is local only
  - Surfaced by: Failure Modes Review — silent fallback to old files would bypass the whole ownership change
  - Files: `test/unit/cookidoo-credentials.test.ts`, optionally `test/unit/cookidoo-scope-resolution.test.ts`
  - Verify: targeted Vitest run
