# Multi-Auth Phase 3: Credential Ownership Boundary

Datum: 2026-06-09
Main plan: [Multi-Auth Hardening Plan](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-06-09-multi-auth-hardening-plan.md)

> **Umgesetzt:** Credential-Auth-Hotfix (T1/T3/T4), Privacy-Copy (T2), Cookidoo-Email-Strip (T8), Tests (T5/T6). A11y und Error-Copy (T14/T15) als Bonus.

> **/autoplan 2026-06-09 — HOCHGEZOGEN zu Schritt 0 (Hotfix zuerst).** Der Review hat
> bestaetigt: das ist kein Privacy-Copy-Thema, sondern ein LIVE unauthentifizierter
> Cross-User-Bug. Verifizierter Ist-Zustand + gewaehlte Zielregeln stehen unten in
> "Schritt 1". Die Vorbedingung "Phase 2 zuerst" ist aufgehoben — die Kandidaten sind
> bekannt. Tasks T1-T6 im Main-Plan.

## Ziel

BYOK-Keys und Plattform-Credentials duerfen unter Multi-Auth keine falsche
Privatsphaere suggerieren. Fuer jeden Credential-Pfad braucht es eine
explizite Boundary-Regel: user-scoped, workspace-scoped, admin-only, hidden
oder disabled.

## Vorbedingung

Die Ownership-Inventur aus Phase 2 ist gelaufen. Dieser Plan baut auf echten
Befunden auf, nicht auf Vermutungen.

## Scope

- Alle Credential- und Key-Pfade klassifizieren.
- Zwischenregel oder echtes Ownership-Modell festlegen.
- Server-, UI- und Doku-Verhalten an diese Regel anpassen.
- Tests fuer die gewaehlte Boundary absichern.

## Entscheidungsrahmen

Fuer jeden Credential-Typ wird genau eine Zielregel gewaehlt:

1. `disabled`
   Keine normale Nutzer-Mutation, keine Privacy-Versprechen.

2. `hidden/admin-only`
   Nur interne oder Admin-Nutzung, fuer normale Nutzer unsichtbar oder klar
   gesperrt.

3. `user-scoped`
   Ein Nutzer sieht und mutiert nur eigene Credentials.

4. `workspace-scoped`
   Credentials gelten fuer einen gemeinsamen Workspace und muessen entsprechend
   mit Membership und Rollen abgesichert werden.

## Empfehlung fuer die Reihenfolge

### Schritt 1: Ist-Zustand benennen

Fuer jeden Typ festhalten:

- Speicherort
- aktuelle Read- und Write-Pfade
- aktuelle Sichtbarkeit in UI oder API
- aktuelles Risiko

Kandidaten + verifizierter Ist-Zustand + Zielregel (/autoplan 2026-06-09):

| Pfad | Ist-Zustand (verifiziert) | Zielregel |
|------|---------------------------|-----------|
| `/api/v1/keys` POST/DELETE/validate (`src/routes/keys.ts`) | **kein Auth**; `DELETE` per Hash ohne Owner-Check | `requireUserAuth` pro Route; Store droppen (siehe unten) |
| `api_keys`-Persistenz (`src/db-react.ts`, `schema.ts`) | **totes Table**: `getApiKeyByHash` hat 0 Aufrufer, `userId` immer null, jede Zeile Waise; BYOK laeuft real ueber `x-groq-key`-Header | **droppen** statt scopen (keine Migration noetig) |
| Cookidoo (`src/routes/platforms.ts`, `src/fetchers/cookidoo.ts`) | **kein Auth**; globale Plaintext-Disk-Datei; `cookidoo/status` leakt Account-Email | `admin/global` + ehrliche Copy; Email aus `status` strippen |
| Pinterest-Credentials (`platforms.ts`) | **kein Auth**; Connector 0% (unfertig) | `disabled` (501) |
| Facebook-Cookies (`platforms.ts`) | **kein Auth**; Connector unfertig | `disabled` (501) |
| `/api/v1/proxy/image` (`platforms.ts:181`) | unauth **by design** (PDF-Export, pre-auth), hat SSRF-Guard | **offen lassen** — NICHT Router-weit blanket-authen |

Konsequenz: kein Router-weites `requireAuth` (wuerde PDF-Export brechen), sondern Auth
pro Credential-Route. BYOK-Groq-Key bleibt user-lokal (SecureStore); der serverseitige
Hash-Store entfaellt.

### Schritt 2: Zwischenregel statt Wunschmodell

Wenn ein echter user- oder workspace-scope kurzfristig nicht sauber lieferbar
ist, gilt:

- lieber `hidden`, `disabled` oder `admin-only`
- nicht halbprivate UI mit globalem Backend

### Schritt 3: Technische Durchsetzung

Je nach gewaehlter Regel:

- Route sperren
- UI verbergen oder klar markieren
- Mutationen auf `user_id` oder `workspace_id` absichern
- Delete-/Update-Queries nicht nur auf Identifier, sondern auf Identifier plus
  Owner-Kontext absichern
- Logs und Fehlercodes auf den neuen Boundary-Typ anpassen

### Schritt 4: Copy und Doku begradigen

- Settings- oder Account-Copy darf nur sagen, was wirklich stimmt.
- README, Runbook und TODO muessen dieselbe Grenze beschreiben.
- Falls etwas lokal oder admin-global bleibt, muss das klar benannt werden.

### Schritt 5: Tests

Mindestens folgende Faelle abdecken:

- unauthenticated denied
- user A darf user B nicht lesen oder mutieren
- workspace-Member nur falls bewusst erlaubt
- admin-only wirklich nicht fuer normale Nutzer erreichbar
- hidden/disabled Pfade erzeugen keine irrefuehrenden UI-Zustaende

## Entscheidungskriterien

Die beste kurzfristige Regel ist nicht die groesste, sondern die sicherste:

- keine Cross-User-Leaks
- keine falschen Produktversprechen
- moeglichst kleine Blast Radius fuer spaetere Migration

## Definition of Done

Dieser Teilplan ist fertig, wenn:

- jeder Credential-Typ eine explizite Boundary-Regel hat,
- UI und Doku dieselbe Regel kommunizieren,
- Route-Tests die Grenze belegen,
- `TODO.md:40` nicht mehr als offene Unklarheit existiert.

## Risiken

- Ein vorschneller Wechsel auf `workspace-scoped` kann spaeter Migrationen und
  Rollenlogik erzwingen, bevor Einladungen oder Household-Switching existieren.
- Ein globaler Fallback ohne klare UI-Abschottung ist fuer Vertrauen schlechter
  als eine bewusst deaktivierte Funktion.
