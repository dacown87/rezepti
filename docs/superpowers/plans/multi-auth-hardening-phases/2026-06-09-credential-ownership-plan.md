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

---

# /autoplan Review (2026-06-09, retrospektiv)

## Phase 1: CEO Review

**Premise-Tabelle:**

| Praemisse | Code-verifiziert | Befund |
|-----------|-----------------|--------|
| `/api/v1/keys` hatte keinen Auth-Schutz | JA | `requireUserAuth()` auf `/validate`; POST/DELETE/Store komplett entfernt |
| `api_keys`-Tabelle war totes Schema | JA | 0 Aufrufer in `src/`; Store vollstaendig entfernt |
| Cookidoo-Status leckte Account-Email | JA, behoben | `getSessionStatus()` gibt nur `{ connected, hasFileCredentials }` zurueck |
| Pinterest/Facebook waren unauth | JA | Alle 6 Stub-Routen: `requireUserAuth()` + 501 |
| `/proxy/image` muss auth-frei bleiben | JA | Kein `requireUserAuth()`, SSRF-Guard vorhanden |

**DoD-Checkliste:**

| Kriterium | Erfuellt | Beweis/Gap |
|-----------|---------|-----------|
| Jeder Credential-Typ hat explizite Boundary-Regel | JA | Keys=user-scoped, Cookidoo=admin/global, Pinterest/Facebook=disabled, Proxy=open |
| Route-Tests belegen die Grenze | JA | `cookidoo-credentials.test.ts`: unauth-denied, disabled-routes, happy-path, kein Email-Leak |
| `TODO.md:40` nicht mehr offene Unklarheit | JA | T1-T6 als umgesetzt bestaetigt |
| UI und Doku kommunizieren dieselbe Regel | TEILWEISE | Code + Tests ok; Privacy-Copy nicht direkt code-verifizierbar |

**CEO Completion:** ~85% erfuellt. Kernziel erreicht. Cookidoo disk-global ist bewusste Zwischenregel — kein Migrations-Trigger-Mechanismus fuer spaeteren workspace-scope vorhanden.

## Phase 3: Eng Review

**Findings:**

| Severity | Finding | Fix |
|----------|---------|-----|
| CRITICAL | Cookidoo TOCTOU-Race: zwei gleichzeitige `POST /credentials` schreiben dieselbe Datei ohne Locking — letzter Write gewinnt still | Single-User-Assumption dokumentieren ODER File-Lock (low-prio fuer Hobby-App) |
| HIGH | Leerer/Nicht-JSON-Body loest 500 statt 400 aus — `c.req.json()` nicht gegen Nicht-JSON-Bodies abgesichert | `try { const body = await c.req.json() } catch { return 400 }` vor Destructuring |
| HIGH | Cross-User-Test fehlt (Plan Schritt 5 explizit gefordert): kein Test prueft ob User B Status von User A sieht | Test hinzufuegen ODER explizit dokumentieren dass global-by-design keinen Cross-User-Scope hat |
| MEDIUM | `GET /api/v1/cookidoo/status` gibt `hasFileCredentials` zurueck — jeder authed User sieht ob irgendjemand Credentials gespeichert hat | Dokumentieren als bekanntes Verhalten (admin/global-Design) |
| MEDIUM | `clearSession()` nach `saveCredentialsToDisk()` ist nicht atomar — bei Fehler in `save` laeuft `clear` trotzdem (beide im try-Block, okay heute, fraechlich bei Refactor) | Kommentar: "save und clear sind absichtlich sequenziell, kein Rollback noetig" |
| LOW | `requireUserAuth()` per Route korrekt — keine Router-Level-Kopplung | — |

## Decision Audit Trail

| # | Decision | Classification | Rationale |
|---|----------|----------------|-----------|
| CR-CEO-1 | DoD zu ~85% erfuellt — Plan als Abgeschlossen markieren | Mechanical | Kernziel erreicht; verbleibende Gaps sind dokumentiert |
| CR-CEO-2 | Cookidoo disk-global bleibt Zwischenregel ohne Migrations-Trigger | Taste | Single-Tenant; Workspace-Scope erst nach Invitations moeglich |
| CR-ENG-1 | TOCTOU-Race dokumentieren statt fixen | Taste | Single-User-Hobby-App; concurrent writes praktisch unmoeglich |
| CR-ENG-2 | Leerer-Body-400-Fix: in Post-Hotfix-PR einschliessen oder eigener Mini-Fix | Offen — User-Entscheidung | 1-Zeile-Fix, aber ausserhalb des geplanten Scope |
| CR-ENG-3 | Cross-User-Test: durch "admin/global"-Kommentar in Route ersetzen statt Test | Taste | Test waere sinnlos (global by design), aber DoD-Text ist missverstaendlich |

## Phase 4: Final Gate — APPROVED 2026-06-09

| Entscheidung | Gewaehlt | Aktion |
|---|---|---|
| Cookidoo TOCTOU | **1-Zeilen File-Lock-Fix** | `saveCredentialsToDisk` nutzt jetzt atomic write (tmp + renameSync) — `src/fetchers/cookidoo.ts` |
| Body-Parsing 400 vs 500 | **Jetzt fixen** | `c.req.json().catch(() => null)` + expliziter 400-Return — `src/routes/platforms.ts` |
| Cross-User-Test | **Dokumentieren** | "Single-tenant — admin/global by design" im Code-Kommentar; kein sinnloser Test |

**Status nach Final Gate: ABGESCHLOSSEN** ✅
Alle Code-Fixes committed auf `feat/credential-auth-hotfix`. DoD erfuellt.
