<!-- /autoplan restore point: /home/patrick/.gstack/projects/rezepti/main-autoplan-restore-20260616-224143.md -->
# BYOK Validation Policy Admin Slice — Execution Plan

Stand: 2026-06-16
Status: Draft, noch nicht reviewed

## Ziel

Die serverseitige BYOK-Validation-Policy soll ueber eine dedizierte Admin-Flaeche sichtbar und aenderbar werden, damit die aktive Validierungslogik nicht nur als lokale Konstante in [src/routes/keys.ts](/home/patrick/Projekte/rezepti/src/routes/keys.ts:5) existiert und im Incident-Fall ohne Redeploy geprueft sowie angepasst werden kann. Die Policy gilt fuer `POST /api/v1/keys/validate` und fuer alle Extraction-Einstiege, die heute `validateOptionalApiKey()` nutzen [src/routes/extraction.ts](/home/patrick/Projekte/rezepti/src/routes/extraction.ts:28).

Der Slice soll:

- den aktuell wirksamen Validation-Policy-Zustand anzeigen
- eine Admin-only Aenderung der Validation-Policy erlauben
- den bestehenden Validation-Flow zentralisieren und fuer `keys/validate` plus Extraction wiederverwenden
- keine neue Produktlogik fuer normale Nutzer einfuehren

## Ausgangslage

Heute liegt ein Teil der Konfiguration fest im Code:

- `BYOK_VALIDATE_WINDOW_MINUTES = 60`
- `BYOK_VALIDATE_MAX_REQUESTS = 20`

Die Persistenz fuer Verbrauchsdaten existiert bereits:

- Tabelle `public.byok_validation_rate_limits` in [src/schema.ts](/home/patrick/Projekte/rezepti/src/schema.ts:185)
- Schreib-/Zaehllogik in `recordByokValidationAttempt()` in [src/db-react.ts](/home/patrick/Projekte/rezepti/src/db-react.ts:927)

Es gibt ausserdem bereits ein Admin-Gate-Muster im Backend:

- `auth.appRole !== "admin"` in [src/routes/planner.ts](/home/patrick/Projekte/rezepti/src/routes/planner.ts:143)

Parallel dazu existiert heute schon ein zweiter BYOK-Einstieg:

- `validateOptionalApiKey()` in [src/routes/extraction.ts](/home/patrick/Projekte/rezepti/src/routes/extraction.ts:28) validiert Keys fuer mehrere Extraction-Routen
- dieser Pfad nutzt aktuell keine gemeinsame Runtime-Policy mit `POST /api/v1/keys/validate`

## Scope-Entscheidung

### In Scope

1. Serverseitige Konfiguration fuer die gemeinsame BYOK-Validation-Policy in DB oder aehnlich zentraler Server-Quelle fuehren.
2. Admin-only Read- und Write-API fuer diese Konfiguration bereitstellen.
3. Dedizierte Admin-Flaeche, die Policy-Zustand, Herkunft und letzten Aenderungszeitpunkt zeigt und editierbar macht.
4. Gemeinsame Runtime-Nutzung in `POST /api/v1/keys/validate` und in den Extraction-Pfaden mit `validateOptionalApiKey()`.
5. Tests fuer Auth-Gate, Validierung, Persistenz und Runtime-Nutzung.
6. TODO/Doku auf den neuen Stand ziehen.

### Nicht in Scope

1. Nutzer-sichtbare BYOK-Policy-Seite ausserhalb Admin.
2. Historische Analytics oder Diagramme ueber Validation-Verbrauch.
3. Per-Provider oder per-Workspace getrennte Limits.
4. Automatische Alerting-/Notification-Mechanik.
5. Generelles Admin-CMS fuer beliebige Runtime-Settings.
6. Per-Provider- oder Per-Workspace-Segmentierung des Limits.
7. Ein separates Runtime-Limit fuer Extraction-Starts oder laufende Jobs.

## Empfohlener Ansatz

Empfohlen ist ein kleiner zentraler Runtime-Config-Slice fuer die gemeinsame BYOK-Validation-Policy statt weiterer Hardcoded-Konstanten und getrennter Validierungssemantik.

Konkret:

1. Eine dedizierte Server-Konfiguration fuer die BYOK-Validation-Policy einfuehren.
2. `POST /api/v1/keys/validate` und alle `validateOptionalApiKey()`-Pfade lesen diese Werte zur Laufzeit statt aus getrennten lokalen Regeln.
3. Ein Admin-Endpoint liefert und schreibt zunaechst genau diese zwei Werte:
   - `windowMinutes`
   - `maxRequests`
4. Die UI lebt als eigene Admin-Seite, nicht im bestehenden nutzerseitigen Settings-Screen.
5. Die Policy wird als ein gemeinsamer Enforcement-Punkt umgesetzt, nicht als "gleiche Werte, aber zwei getrennte Codepfade".

Warum dieser Weg:

- Er ersetzt die harte Konstante direkt an der Quelle und beseitigt die aktuelle Drift zwischen Validate-Endpoint und Extraction.
- Er trennt Endnutzer-Settings klar von globalen Operator-Controls.
- Er bleibt kleiner als ein echtes Extraction-Rate-Limit und gross genug, um die relevante Runtime-Semantik zu vereinheitlichen.

## Datenmodell

Empfohlen ist eine kleine generische Server-Settings-Tabelle oder ein bewusst enger Single-Purpose-Eintrag. Fuer diesen Slice reicht beides; empfohlen ist die engere Form, um Scope klein zu halten.

### Option A — dedizierte Tabelle

Neue Tabelle, z. B. `public.byok_validation_settings`.

Felder:

- `id` oder statischer Singleton-Key
- `window_minutes`
- `max_requests`
- `updated_at`
- `updated_by`

Vorteile:

- klar, explizit, leicht testbar
- keine JSON-Konfiguration noetig

Nachteil:

- spaeter bei vielen Settings mehrere kleine Tabellen

### Option B — generische App-Settings-Tabelle

Neue Tabelle, z. B. `public.app_runtime_settings`.

Felder:

- `key`
- `value_json`
- `updated_at`
- `updated_by`

Vorteile:

- spaeter fuer weitere Admin-Settings wiederverwendbar

Nachteil:

- fuer diesen kleinen Slice etwas abstrakter
- mehr Validierungslogik noetig

### Empfehlung

Option A. Dieser Slice will kein Settings-Framework bauen, sondern die bestehende BYOK-Validation-Policy zentral administrierbar und gemeinsam nutzbar machen.

## API-Schnittstellen

### 1. Admin Read

`GET /api/v1/admin/byok-validation-policy`

Response:

```json
{
  "windowMinutes": 60,
  "maxRequests": 20,
  "source": "database",
  "status": "active",
  "updatedAt": "2026-06-16T22:00:00.000Z",
  "updatedBy": "admin@example.com"
}
```

Regeln:

- `requireUserAuth()` plus explizites `appRole === "admin"`-Gate; kein `requireAuth()`, damit fehlender Haushalt nicht als falsches `403 no_household` maskiert.
- `403 admin_required` fuer normale Nutzer
- falls noch kein DB-Eintrag existiert: Default aus bestehendem Verhalten zurueckgeben, aber explizit als `source: "default"` und `status: "uninitialized"` markieren
- wenn der Config-Read technisch fehlschlaegt: `500` mit strukturiertem Fehlervertrag, kein stilles "sieht aus wie Default"

### 2. Admin Write

`PUT /api/v1/admin/byok-validation-policy`

Request:

```json
{
  "windowMinutes": 60,
  "maxRequests": 20
}
```

Regeln:

- `requireUserAuth()` plus explizites `appRole === "admin"`-Gate
- Browser-/PWA-Clients brauchen dafuer ein aktualisiertes CORS-`allowMethods`, weil [src/index.ts](/home/patrick/Projekte/rezepti/src/index.ts:22) derzeit `PUT` nicht freigibt; alternativ kann der Write bewusst auf `PATCH` umgestellt werden, wenn das besser zum bestehenden HTTP-/CORS-Profil passt
- Ganzzahlen, beide > 0
- konservative Grenzen setzen, z. B.:
  - `windowMinutes`: 1 bis 1440
  - `maxRequests`: 1 bis 1000
- Antwort liefert den gespeicherten Zustand inkl. `source: "database"`, `status: "active"`, `updatedAt`, `updatedBy` zurueck

### 3. Runtime-Nutzung in `keys.ts` und `extraction.ts`

`POST /api/v1/keys/validate` soll vor `BYOKValidator.checkRateLimit()` die aktive Config laden. `validateOptionalApiKey()` in [src/routes/extraction.ts](/home/patrick/Projekte/rezepti/src/routes/extraction.ts:28) soll dieselbe Policy verwenden statt eine davon getrennte Validierungssemantik zu behalten.

Wichtig:

- kein Schreibpfad in der Request-Runtime ausser dem bestehenden Verbrauchszaehler
- wenn noch kein DB-Eintrag existiert: sauberer Fallback auf heutige Defaults mit explizit unterscheidbarer `default`-Quelle
- wenn der Config-Read technisch fehlschlaegt: Fehler loggen und auf Code-Default weiterlaufen, aber als observability-pflichtigen Fehlerfall behandeln
- der Fallback muss explizit auch Code-vor-Migration, Rollback und `relation does not exist` abfangen, damit `/api/v1/keys/validate` nicht durch eine fehlende Settings-Tabelle bricht
- Config-Read und Policy-Enforcement in einen gemeinsamen Helper kapseln, damit `keys.ts` und `extraction.ts` nicht erneut eigene Fallback-, Throttle- oder Validierungslogik bauen
- der bestehende rohe `500`-Leak in [src/routes/keys.ts](/home/patrick/Projekte/rezepti/src/routes/keys.ts:37) darf dabei nicht auf die neue Config-Leselogik durchschlagen; Runtime-Config-Failures sind intern zu loggen, aber nicht als DB-Interna an Clients durchzureichen
- Laufzeit-Aenderungen von `windowMinutes` aendern die Bucket-Semantik sofort, weil `windowStart` aus dem aktiven Fenster berechnet wird [src/db-react.ts](/home/patrick/Projekte/rezepti/src/db-react.ts:933); der Slice muss dieses Verhalten explizit akzeptieren und im Runbook dokumentieren statt es als "transparent" anzunehmen
- dieser Slice aendert nur die gemeinsame Validation-Policy, nicht die Rate-Limitierung von Extraction-Starts selbst; das bleibt bewusst ausserhalb des Slices
- die gemeinsame Policy muss explizit definieren, dass `keys/validate` und BYOK-Extraction dieselbe Budget-/Throttle-Semantik teilen, falls derselbe Counter wiederverwendet wird; das darf kein stilles Nebenprodukt des Helpers sein

## Backend-Aufteilung

### Phase 1 — Config-Store

- Schema + Migration fuer die Settings-Tabelle
- Drizzle-Schema in `src/schema.ts`
- DB-Helfer in `src/db-react.ts`
  - `getByokValidationPolicy()`
  - `upsertByokValidationPolicy()`
  - optionaler gemeinsamer Helper `loadEffectiveByokValidationPolicy()`

### Phase 2 — Admin-Routen

- neue Admin-Route, z. B. in `src/routes/admin-byok.ts` oder bestehende Admin-Route erweitern
- `requireUserAuth()` + explizites `appRole === "admin"`-Gate; Dictionary-Fehlervertrag aus [src/routes/planner.ts](/home/patrick/Projekte/rezepti/src/routes/planner.ts:140) als Vorbild, aber ohne Household-Kopplung
- strukturierter Fehlervertrag `{ error: { code, message, cause, fix, docs } }` fuer `401`, `403 admin_required`, `400 validation_failed`, `500 byok_rate_limit_config_unavailable`
- Read-Response zeigt `source`, `status`, `updatedAt`, `updatedBy`
- Read-Response zeigt ausserdem explizit den Geltungsbereich, z. B. `appliesTo: ["keys_validate","extract_react","extract_photo","extract_text"]`, damit Operatoren sehen, welche Entry-Points betroffen sind
- falls `PUT` beibehalten wird: CORS-Allowlist in [src/index.ts](/home/patrick/Projekte/rezepti/src/index.ts:22) parallel erweitern; das ist Teil dieses Slices, kein spaeteres Cleanup

### Phase 3 — Runtime-Integration

- `src/routes/keys.ts` liest aktive Policy
- `src/routes/extraction.ts` verwendet denselben Policy-Helper fuer BYOK-Validierung und Policy-Enforcement
- Hardcoded-Fallback bleibt als sichere letzte Linie erhalten

## Frontend-/Admin-UI

Der UI-Slice soll klein bleiben, aber als dedizierte Admin-Flaeche und nicht als Erweiterung des bestehenden user-/device-lokalen Settings-Screens.

Empfohlen:

1. Eigene Admin-Route, z. B. `/admin/runtime/byok-validation-policy`, mit klarer Nav-Einordnung unter einem spaeter ausbaubaren Admin-Bereich.
2. Sichtbarer Kopfbereich:
   - Titel `BYOK Validation Policy`
   - Kurztext, dass dies ein globaler Server-Regler fuer Key-Validierung in `POST /api/v1/keys/validate` und den Extraction-Einstiegen ist
   - Status-Chip `Aktiv`, `Default`, oder `Stoerung`
3. Anzeigen:
   - `Max. Validierungen`
   - `Zeitfenster in Minuten`
   - `Gilt fuer`: `keys/validate` und `extract/* mit BYOK`
   - `Quelle`: `database` oder `default`
   - `Zuletzt geaendert`: Zeitstempel + Actor
4. Bearbeitung ueber zwei numerische Inputs plus `Speichern` und `Auf Code-Default zuruecksetzen`.
5. Screen-Level-Zustaende:
   - Initial Loading
   - `default/uninitialized`-State ohne DB-Eintrag
   - `active/database`-State mit persistiertem Wert
   - `partial`-State, wenn Read auf Default faellt, Write aber nicht verfuegbar ist
   - Fehlerzustand mit klarer Retry-Aktion
   - Dirty-State, solange Formwerte von den zuletzt geladenen Werten abweichen
6. Beim Speichern:
   - Save-Spinner
   - Success-Feedback mit sichtbarer Aktualisierung von `updatedAt`/`updatedBy`
   - klarer Fehler bei `403`, `400`, `500`
   - Fokus springt bei Fehlern auf die erste betroffene Eingabe oder die Inline-Fehlermeldung
7. Die Admin-Navigation bzw. der Guard darf `appRole` nicht implizit ueber den side-effecting Bootstrap-POST beziehen [mobile/utils/account-bootstrap.ts](/home/patrick/Projekte/rezepti/mobile/utils/account-bootstrap.ts:3); benoetigt ist entweder ein read-only Profil-/Session-Read mit `appRole` oder serverseitiges Route-Gating mit sauberem `admin_required`-State fuer Direktaufrufe.

Nicht noetig fuer Slice 1:

- Tabellenansicht
- Audit-Timeline
- Detailansicht einzelner Verbrauchseintraege

### Responsive und Accessibility

- Labels bleiben immer sichtbar; keine Placeholder-only Inputs
- `inputMode="numeric"` bzw. entsprechende RN-Web-Numeric-Semantik
- Fehlertext per Feld klar zugeordnet
- Keyboard-Reihenfolge: Titel -> Status -> `windowMinutes` -> `maxRequests` -> Save -> Reset
- Mobile <= 480 px: einspaltig mit sticky Save-Bar
- Desktop >= 768 px: kompakte Form-Card plus Status-/Meta-Card

## Fehlerbehandlung

### Backend

- `401` wenn nicht eingeloggt
- `403 admin_required` wenn kein Admin
- `400 validation_failed` bei ungueltigen Zahlen oder fehlendem Body
- `500 byok_rate_limit_config_unavailable` nur fuer echte Server-/DB-Fehler
- alle Fehler im strukturierten Envelope `{ error: { code, message, cause, fix, docs } }`
- stabile fachliche Codes mindestens fuer:
  - `byok_key_invalid`
  - `byok_validation_rate_limited`
  - `byok_policy_unavailable`

### Frontend

- bei `403 admin_required`: dedizierter Admin-Hinweis statt generischer Alert
- bei `400 validation_failed`: Feldfehler direkt an `windowMinutes`/`maxRequests`
- bei `500 byok_rate_limit_config_unavailable`: Inline-Banner mit Retry und Hinweis auf Runbook
- `source: "default"` ist als sichtbarer Operate-Hinweis zu rendern, nicht nur als stiller API-String
- wenn die gemeinsame Policy einen BYOK-Extraction-Start blockiert, muss das UI denselben maschinenlesbaren Status/Code/Retry-Hinweis sehen wie bei `/api/v1/keys/validate`, statt den Fall als generischen "Invalid API key"-Fehler zu missdeuten

## Tests

### Backend

1. `GET /api/v1/admin/byok-validation-policy`
   - `401` ohne Auth
   - `403` ohne Admin-Rolle
   - `200` mit `source: "default"` / `status: "uninitialized"`
   - `200` mit DB-Wert
   - `500` bei Read-Fehler mit strukturiertem Fehler-Envelope

2. `PUT /api/v1/admin/byok-validation-policy`
   - `401` ohne Auth
   - `403` ohne Admin-Rolle
   - `400` fuer ungueltige Werte
   - `200` fuer gueltige Werte
   - `200` aktualisiert `updatedAt` und `updatedBy`

3. `POST /api/v1/keys/validate`
   - verwendet gespeichertes `windowMinutes`
   - verwendet gespeichertes `maxRequests`
   - faellt bei fehlender Config auf Defaults zurueck
   - loggt Config-Read-Failures sichtbar
   - faellt bei fehlender Tabelle / Code-vor-Migration / Rollback kontrolliert auf Defaults zurueck, ohne rohe DB-Fehler nach aussen zu leaken
   - dokumentiert und testet die Re-Bucket-Semantik bei Aenderungen von `windowMinutes`
   - liefert Fehler im strukturierten Envelope statt mit heutiger Top-Level-`error`/`code`-Mischform

4. Extraction-Pfade mit `validateOptionalApiKey()`
   - verwenden dieselbe persistierte Policy wie `keys/validate`
   - behandeln `default`-/`database`-Quelle semantisch identisch
   - fallen bei Config-Read-Failures kontrolliert zurueck
   - divergieren bei Invalid-Key-Fehlern nicht mehr in einer separaten Validierungslogik
   - liefern bei Policy-Blockaden denselben `429`-/Retry-Vertrag wie `keys/validate`, nicht generisches `400 Invalid API key`
   - decken alle drei aktuellen Entry-Points ab: `extract/react`, `extract/photo`, `extract/text`

### Frontend

1. Admin sieht die dedizierte Admin-Seite bzw. den Navigationseintrag.
2. Nicht-Admin sieht die Seite nicht oder bekommt einen expliziten `admin_required`-Zustand.
3. Laden zeigt `active`, `default`, `partial` und Fehlerzustand sauber.
4. Speichern sendet den Write-Request und aktualisiert Meta-Infos sichtbar.
5. `403`, `400` und `500` werden differenziert im UI behandelt.
6. Reset auf Code-Default ist explizit testbar.
7. Browser-/PWA-Save deckt die reale Write-Methode inkl. CORS-Preflight ab.
8. Admin-Guard nutzt keinen side-effecting Bootstrap-Request nur fuer Rollen-Erkennung.
9. Admin-Seite zeigt sichtbar, welche Entry-Points die Policy aktuell steuert.

## Reihenfolge

1. Migration + Schema fuer BYOK-Settings
2. DB-Helfer fuer Read/Write
3. Admin-API
4. Runtime-Anbindung in `keys.ts` und `extraction.ts`
5. Dedizierte Admin-Flaeche
6. Tests
7. CORS-/HTTP-Methoden-Anbindung fuer Browser/PWA sicherstellen
8. Runbook + Nachweis aktualisieren
9. `TODO.md` auf erledigt oder in Nachweisblock aktualisieren

## Definition of Done

- Der aktive BYOK-Validation-Grenzwert ist nicht mehr nur als Hardcode gepflegt.
- Die aktive BYOK-Validation-Policy gilt konsistent fuer `keys/validate` und die Extraction-Einstiege mit BYOK.
- Ein Admin kann `windowMinutes` und `maxRequests` lesen und aendern.
- Ein Admin kann erkennen, ob der aktive Wert aus `database` oder `default` stammt.
- `POST /api/v1/keys/validate` und `validateOptionalApiKey()` nutzen dieselbe gespeicherte Runtime-Config.
- `POST /api/v1/keys/validate` und alle drei Extraction-Einstiege nutzen denselben Policy-Enforcement-Helper.
- Browser-/PWA-Saves funktionieren real ueber denselben Write-Endpoint, inklusive korrekter CORS-/Methodenfreigabe.
- Nicht-Admins koennen die Werte weder lesen noch aendern.
- Tests decken Auth, Validierung, Persistenz, Runtime-Nutzung und Operate-Smoke ab.
- Ein Runbook beschreibt Setzen, Verifizieren, Rollback und den Fallback-Fall.
- `TODO.md` spiegelt den Abschluss korrekt.

## Risiken

1. Ein globaler Regler ohne Observability bleibt ein Operator-Knopf mit Blindflug.
2. Ohne klar unterscheidbaren `default`- vs. `database`-Status wird der Control-Plane-Fallback irrefuehrend.
3. Ein Admin-Gate auf `requireAuth()` statt `requireUserAuth()` koppelt faelschlich an Household-Zustaende.
4. Eine Live-Aenderung von `windowMinutes` rebucketed bestehende Rate-Limit-Fenster und kann Quota effektiv lockern oder verhaerten, wenn das Operate-Team den Effekt nicht kennt.
5. Ein fehlender CORS-/Methoden-Abgleich macht den Save-Pfad im Browser unbenutzbar, obwohl die Route serverseitig existiert.
6. Wenn `keys.ts` und `extraction.ts` trotz gemeinsamer Policy unterschiedliche Fehlersemantik behalten, bleibt die Vereinheitlichung fuer Nutzer und Operatoren nur halb umgesetzt.
7. Wenn Validate-Endpoint und Extraction denselben Counter teilen, ohne dass der Plan das explizit als Produktsemantik dokumentiert, entsteht versteckte Budget-Kopplung zwischen "Key testen" und "Extraction starten".

## Offene Folgepunkte fuer spaeter

1. Verbrauchsmetriken oder Admin-Statistik fuer `byok_validation_rate_limits`
2. Audit-Log, wer die Werte geaendert hat
3. Weitere Runtime-Settings im selben Admin-Bereich

## What Already Exists

- [src/routes/keys.ts](/home/patrick/Projekte/rezepti/src/routes/keys.ts:10): bestehender Validate-Endpunkt mit Hardcode-Limit
- [src/routes/extraction.ts](/home/patrick/Projekte/rezepti/src/routes/extraction.ts:28): bestehende BYOK-Validierung fuer mehrere Extraction-Einstiege
- [src/db-react.ts](/home/patrick/Projekte/rezepti/src/db-react.ts:933): persistierte Verbrauchszaehlung pro `userId + keyHash + windowStart`
- [src/routes/planner.ts](/home/patrick/Projekte/rezepti/src/routes/planner.ts:140): existierendes Admin-Gate-Muster fuer Dictionary-Writes
- [src/auth.ts](/home/patrick/Projekte/rezepti/src/auth.ts:41): strukturierter Auth-Error-Envelope
- [mobile/utils/api.ts](/home/patrick/Projekte/rezepti/mobile/utils/api.ts:30): Client-seitiger Parser fuer strukturierte API-Fehler
- [mobile/app/(tabs)/settings.tsx](/home/patrick/Projekte/rezepti/mobile/app/(tabs)/settings.tsx:635): bestehender user-/device-lokaler Settings-Screen, bewusst NICHT Wiederverwendungsziel fuer globale Admin-Controls

## NOT in Scope

- Verbrauchsdiagramme und Historienansicht des Limits: bewusst nicht im ersten Admin-Slice
- Per-Workspace- oder Per-Provider-Limits: als Folgearchitektur, nicht im initialen globalen Regler
- Vollstaendiges Runtime-Settings-Framework: kann spaeter folgen, wenn weitere Regler real kommen
- Automatisches Alerting: noetig, aber nicht in diesem Slice mitbauen

## GSTACK REVIEW REPORT

### Phase 1 — CEO Review

#### Step 0A — Premise Challenge

Die urspruengliche Planfassung war loesungsgetrieben: sie setzte voraus, dass "editierbarer Hardcode" am Validate-Endpunkt das eigentliche Problem ist. Der bestehende Code zeigt aber einen Rate-Limiter auf `POST /api/v1/keys/validate` [src/routes/keys.ts](/home/patrick/Projekte/rezepti/src/routes/keys.ts:10), waehrend die Extraction-Pfade BYOK separat ueber `validateOptionalApiKey()` validieren [src/routes/extraction.ts](/home/patrick/Projekte/rezepti/src/routes/extraction.ts:28). Gleichzeitig bleibt der sichtbare Nutzerpfad fuer den Groq-Key heute device-lokal [mobile/app/(tabs)/settings.tsx](/home/patrick/Projekte/rezepti/mobile/app/(tabs)/settings.tsx:434).

Aufloesung: Der Slice wird auf eine gemeinsame BYOK-Validation-Policy fuer `keys/validate` und alle Extraction-Einstiege mit BYOK angehoben. Bewusst nicht Teil dieses Slices ist ein separates Runtime-Limit fuer Extraction-Starts selbst.

#### Step 0B — Existing Code Leverage

Vorhandene Hebel sind stark genug, um keinen neuen Settings-Baukasten zu rechtfertigen. Die Verbrauchszaehlung existiert in [src/db-react.ts](/home/patrick/Projekte/rezepti/src/db-react.ts:933), das Admin-Rollenmodell existiert in [src/auth.ts](/home/patrick/Projekte/rezepti/src/auth.ts:26), und das bestehende Admin-Gate-Muster existiert fuer Dictionary-Writes [src/routes/planner.ts](/home/patrick/Projekte/rezepti/src/routes/planner.ts:140). Wiederverwendet werden sollten also: Rate-Limit-DB-Zaehlpfad, strukturierter Auth-Error-Envelope, und ein neuer dedizierter Admin-Router unter `api-react.ts`.

Nicht wiederverwendbar ist der bestehende `Settings`-Screen als UI-Heimat. Er ist explizit user-/device-lokal fuer `Groq API-Key`, `Server URL` und private/household Cookidoo-Credentials [mobile/app/(tabs)/settings.tsx](/home/patrick/Projekte/rezepti/mobile/app/(tabs)/settings.tsx:744). Dort einen globalen Server-Regler zu verstecken waere Boundary Debt.

#### Step 0C — Dream State Mapping

```text
  CURRENT STATE                  THIS PLAN                         12-MONTH IDEAL
  Split validation semantics     Shared validation policy          Small runtime-config area
  + DB-backed counters           across validate + extraction      with explicit provenance,
  + no admin UI                  + source/status visibility        audit trail, and metrics
  + weak operate path            + runbook + rollback path         for safe live operations
```

Der Plan bewegt sich in die richtige Richtung, wenn er als dedizierte Admin-Flaeche mit klarer Operate-Semantik gebaut wird. Er bewegt sich in die falsche Richtung, wenn er nur einen editierbaren Wert ohne Observability, Provenance und Runbook erzeugt.

#### Step 0C-bis — Implementation Alternatives

```text
APPROACH A: Shared validation-policy control (recommended)
  Summary: Eigene Admin-Route, eigene Admin-Seite, kleine dedizierte Tabelle, explizite source/status-Meta, gemeinsamer Helper fuer validate + extraction.
  Effort:  M
  Risk:    Medium
  Pros:    loest die reale Semantik-Drift; sauberer Operator-Scope; klare Erweiterungsfaehigkeit
  Cons:    noch keine Metriken; erfordert gemeinsame Fehlersemantik statt punktueller Route-Fixes
  Reuses:  auth/appRole, existing rate-limit counters, structured error envelope, extraction validation entrypoints

APPROACH B: Narrow validate-only control
  Summary: Admin-Regler nur fuer `POST /api/v1/keys/validate`, Extraction bleibt separat.
  Effort:  S
  Risk:    Low
  Pros:    kleinster Diff
  Cons:    laesst die relevante Drift bestehen; Operator sieht nur einen Teil des echten BYOK-Runtime-Pfads
  Reuses:  current constant path in keys.ts

APPROACH C: Generic runtime settings framework
  Summary: Allgemeine Runtime-Settings-Tabelle plus Admin-Config-Hub.
  Effort:  L
  Risk:    High
  Pros:    spaeter breit wiederverwendbar
  Cons:    fuer diesen Slice ueberbaut; abstrahiert zu frueh; hoher Governance- und Validation-Aufwand
  Reuses:  appRole and future runtime-config concept only
```

Empfehlung: Approach A. Es ist der kleinste Scope, der die echte Produktsemantik sauber zusammenzieht, ohne schon ein eigenes Extraction-Start-Limit zu bauen.

#### CEO Dual Voices — Consensus Table

```text
CEO DUAL VOICES — CONSENSUS TABLE:
═══════════════════════════════════════════════════════════════
  Dimension                           Claude  Codex  Consensus
  ──────────────────────────────────── ─────── ─────── ─────────
  1. Premises valid?                   no      no      DISAGREE WITH PLAN
  2. Right problem to solve?           mixed   mixed   USER CHALLENGE
  3. Scope calibration correct?        mixed   mixed   TASTE
  4. Alternatives sufficiently explored? no    no      CONFIRMED GAP
  5. Competitive/market risks covered? no      no      CONFIRMED GAP
  6. 6-month trajectory sound?         no      no      CONFIRMED GAP
═══════════════════════════════════════════════════════════════
```

CODEX und die unabhaengige CEO-Stimme waren sich einig, dass der schmale Validate-only-Slice das operative Problem nicht scharf genug trifft. Nach User-Entscheidung wird der Plan daher auf gemeinsame Validation-Policy, dedizierte Admin-Flaeche, explizite Provenance und Runbook gehoben.

#### CEO Findings

- Keine globale Nutzer-Settings-Einbettung. Der Slice bleibt auf einer dedizierten Admin-Flaeche.
- Keine stillen Fallbacks, die wie "alles okay" aussehen. `default` und technische Read-Failures muessen operatorisch unterscheidbar sein.
- `updatedAt`/`updatedBy` sind im ersten Slice sinnvoll genug, um direkt im Read-Vertrag mitzunehmen.
- Gemeinsame Validation-Semantik statt Route-Sonderweg: `keys.ts` und `extraction.ts` muessen denselben Policy-Helper sprechen.
- Der Admin-Regler muss fuer Operatoren explizit zeigen, welche Entry-Points er steuert; sonst bleibt die neue Breite des Slices im Incident unsichtbar.
- Observability-Light statt Voll-Analytics: sichtbare `source`/`status`, Logpflicht, Operate-Runbook und Smoke-Test sind Mindeststandard.

### Phase 2 — Design Review

Initiale Design-Completeness: 3/10. Die alte Planfassung beschrieb "kleines Admin-UI", aber weder die Informationshierarchie noch die benoetigten Bildschirmzustaende waren konkret genug.

#### Design Litmus

- Eine dedizierte Admin-Flaeche ist jetzt gesetzt.
- Die Seite muss sofort zeigen: was gesteuert wird, welcher Wert aktiv ist, woher er stammt, und wann/wonach zuletzt geaendert wurde.
- Save-Feedback allein reicht nicht; Initial-Loading, `default/uninitialized`, `active/database`, `partial`, Dirty-State und Retry-Failure sind Pflicht.

#### Design Dual Voices — Consensus

```text
DESIGN DUAL VOICES — CONSENSUS TABLE:
═══════════════════════════════════════════════════════════════
  Dimension                           Claude  Codex  Consensus
  ──────────────────────────────────── ─────── ─────── ─────────
  1. Hierarchy serves operator?        no      no      CONFIRMED GAP
  2. Missing states covered?           no      no      CONFIRMED GAP
  3. Specific UI decisions?            no      no      CONFIRMED GAP
  4. Responsive strategy?              no      no      CONFIRMED GAP
  5. Accessibility requirements?       no      no      CONFIRMED GAP
═══════════════════════════════════════════════════════════════
```

#### Design Pass Summary

- Pass 1 Information Architecture: von `Settings` auf dedizierte Admin-Route verschoben.
- Pass 2 Interaction State Coverage: explizite Screen-Zustaende und Provenance-Anzeige hinzugefuegt.
- Pass 3 User Journey: Admin sieht globalen Regler statt Nutzer-Setting.
- Pass 4 AI Slop Risk: vermieden durch funktionalen Operator-Screen statt generischer Settings-Card.
- Pass 5 Design System Alignment: an bestehende App-Sprache anlehnbar, aber als eigener Bereich.
- Pass 6 Responsive & Accessibility: Numeric Inputs, sichtbare Labels, Focus-Handling, mobile/desktop Layout aufgenommen.
- Pass 7 Unresolved Decisions: keine weiteren Taste-Calls mehr offen; dedizierte Admin-Flaeche ist gesetzt.

### Phase 3 — Eng Review

#### Scope Challenge

Der Slice bleibt im gesunden Rahmen, wenn er auf folgende Module konzentriert bleibt: `src/routes/admin-byok.ts`, `src/routes/keys.ts`, `src/routes/extraction.ts`, `src/db-react.ts`, `src/schema.ts`, `src/api-react.ts`, Admin-UI-Route/Screen und zugehoerige Tests. Ein generisches Settings-Framework oder ein separates Extraction-Start-Limit waere fuer diesen Slice overbuilt.

#### Architecture

```text
  Admin UI Route
      |
      v
  GET/PUT /api/v1/admin/byok-validation-policy
      |
      v
  requireUserAuth -> appRole === admin
      |
      v
  get/upsertByokValidationPolicy
      |
      v
  byok_validation_policy

  POST /api/v1/keys/validate
      |
      v
  loadEffectiveByokValidationPolicy
      |
      +--> database row? ------yes----> use persisted values
      |         |
      |         no
      |         v
      +----> code defaults (source=default)
      |
      v
  BYOKValidator.checkRateLimit
      |
      v
  recordByokValidationAttempt -> byok_validation_rate_limits

  POST /api/v1/extract/*
      |
      v
  validateOptionalApiKey
      |
      v
  loadEffectiveByokValidationPolicy
      |
      v
  shared validation + shared fallback semantics
```

#### Eng Dual Voices — Consensus

```text
ENG DUAL VOICES — CONSENSUS TABLE:
═══════════════════════════════════════════════════════════════
  Dimension                           Claude  Codex  Consensus
  ──────────────────────────────────── ─────── ─────── ─────────
  1. Architecture sound?               mixed   mixed   TASTE
  2. Test coverage sufficient?         no      no      CONFIRMED GAP
  3. Performance risks addressed?      mixed   mixed   LOW RISK
  4. Security threats covered?         mixed   mixed   NEEDS EXPLICIT GATE
  5. Error paths handled?              no      no      CONFIRMED GAP
  6. Deployment risk manageable?       no      no      CONFIRMED GAP
═══════════════════════════════════════════════════════════════
```

#### Error & Rescue Registry

| Method / Path | Failure Mode | Rescued? | Rescue Action | User Sees |
|---|---|---:|---|---|
| `GET /api/v1/admin/byok-validation-policy` | missing bearer token | Y | structured `401 auth_missing` | re-login CTA |
| `GET /api/v1/admin/byok-validation-policy` | non-admin | Y | structured `403 admin_required` | admin hint |
| `GET /api/v1/admin/byok-validation-policy` | no DB row | Y | `source=default`, `status=uninitialized` | visible default state |
| `GET /api/v1/admin/byok-validation-policy` | DB read failure | Y | structured `500 byok_rate_limit_config_unavailable` + log | inline retry banner |
| `PUT /api/v1/admin/byok-validation-policy` | invalid numbers | Y | `400 validation_failed` | field errors |
| `PUT /api/v1/admin/byok-validation-policy` | browser preflight blocked | Y | align route method with CORS allowlist | save unavailable / blocked |
| `PUT /api/v1/admin/byok-validation-policy` | DB write failure | Y | structured `500` + log | save failed |
| `POST /api/v1/keys/validate` | settings read failure / missing table | Y | log + code-default fallback | no user regression, but operator trace |
| `POST /api/v1/extract/*` | settings read failure / missing table | Y | log + code-default fallback | extraction still validates with default policy |
| `POST /api/v1/extract/*` | policy throttle misreported as invalid key | Y | same 429/code/retry contract as validate route | actionable retry state |

#### Failure Modes Registry

| Codepath | Failure Mode | Rescued? | Test? | User Sees? | Logged? |
|---|---|---:|---:|---|---:|
| admin read | fallback masked as success | Y | N | visible `default` state | Y |
| admin write | stale value after save | Y | N | refetch failure / stale state | Y |
| admin write | CORS/method mismatch blocks save | Y | N | save never reaches API | Y |
| validate runtime | DB config read fails | Y | N | request still works | Y |
| validate runtime | migration missing / rollback state | Y | N | request still works | Y |
| extraction runtime | divergent BYOK validation semantics | Y | N | inconsistent invalid-key or limit behavior | Y |
| validate + extraction | hidden shared budget coupling | Y | N | operators misread why extraction is blocked after prior key tests | Y |
| admin auth | wrong middleware yields `no_household` | Y | N | wrong 403 | Y |

#### Test Diagram

```text
NEW UX FLOWS
  1. Admin opens dedicated BYOK validation-policy page
  2. Admin edits and saves values
  3. Admin resets to default

NEW DATA FLOWS
  1. Admin read -> DB/default -> UI provenance render
  2. Admin write -> DB persist -> read refresh
  3. Validate route -> effective policy -> rate-limit counter
  4. Extraction route -> effective policy -> shared BYOK validation
  5. Shared counter semantics -> one budget across validate + extraction, or explicit split decision

NEW CODEPATHS
  1. admin auth gate
  2. no-row default state
  3. DB read failure path
  4. validation_failed path
  5. write success meta refresh
  6. runtime log+fallback path in `keys.ts`
  7. runtime log+fallback path in `extraction.ts`
  8. extraction throttle -> shared 429/error envelope path
```

#### Worktree Parallelization Strategy

| Step | Modules touched | Depends on |
|---|---|---|
| Admin settings storage + route | `src/routes/`, `src/db-react.ts`, `src/schema.ts` | — |
| Shared validation-policy integration | `src/routes/keys.ts`, `src/routes/extraction.ts`, `src/db-react.ts` | storage helper |
| Admin UI | `mobile/app/`, `mobile/utils/` | route contract |
| Tests + runbook | `test/`, `docs/` | route and UI contract |

Parallel lanes:
- Lane A: storage + route -> runtime integration
- Lane B: admin UI after route contract is fixed
- Lane B benoetigt vorab die Entscheidung `PUT` + CORS-Update vs. `PATCH` als Write-Methode
- Lane C: tests + runbook after A and B

### Phase 3.5 — DX Review

Produkttyp hier ist kein externer Developer-Tool-Slice, sondern ein interner Operator-/Admin-Flow. Daher wird DX als Operator-Experience interpretiert: Incident-Bedienbarkeit, Error-Vertrag, Runbook und schnelle Verifikation.

#### DX Dual Voices — Consensus

```text
DX DUAL VOICES — CONSENSUS TABLE:
═══════════════════════════════════════════════════════════════
  Dimension                           Claude  Codex  Consensus
  ──────────────────────────────────── ─────── ─────── ─────────
  1. Understand current limit fast?    no      no      CONFIRMED GAP
  2. Config source obvious?            no      no      CONFIRMED GAP
  3. Errors actionable?                no      no      CONFIRMED GAP
  4. Docs/runbook sufficient?          no      no      CONFIRMED GAP
  5. Incident-safe to operate?         no      no      CONFIRMED GAP
═══════════════════════════════════════════════════════════════
```

#### DX Score

- Getting started / operator entry: 6/10 after dedizierte Admin-Flaeche
- Error quality: 4/10 before structured admin error envelope, 8/10 after fix in plan
- Runbook quality: 3/10 before explicit runbook, 8/10 after adding runbook requirement
- Overall operator DX: 7/10 with revised plan, not 10/10 because full metrics/audit remain deferred

#### DX Implementation Checklist

- [ ] dedicated admin route exists
- [ ] read response shows `source`, `status`, `updatedAt`, `updatedBy`
- [ ] read response shows governed entry-points explicitly
- [ ] all admin errors use structured envelope
- [x] browser write path is proven with real method + CORS combination
- [x] runbook documents set / verify / rollback
- [x] post-deploy smoke proves live runtime change affects `/api/v1/keys/validate`
- [x] post-deploy smoke proves the same policy also affects `extract/react`, `extract/photo`, and `extract/text`

### Cross-Phase Themes

- **Theme: Boundary clarity** — CEO, Design und DX flaggen unabhaengig, dass der Slice nicht in user-/device-lokale Settings gehoert.
- **Theme: Provenance statt Blindflug** — CEO, Design, Eng und DX verlangen sichtbar unterscheidbare `default`-/`database`-Zustaende.
- **Theme: Gemeinsame Policy statt Split-Brain** — CEO und Eng verlangen, dass Validate-Endpoint und Extraction dieselbe BYOK-Validation-Semantik nutzen.
- **Theme: Operate-Sicherheit** — CEO und DX fordern Runbook, Error-Vertrag und Meta-Infos statt nur editierbarem Wert.
- **Theme: Runtime safety over happy-path only** — Eng fordert sichere Fallbacks fuer missing-table/Rollback, echte Browser-Write-Verifikation und explizite Bucket-Semantik bei Live-Aenderungen.

## Decision Audit Trail

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|---|---|---|---|---|---|
| 1 | CEO | Dedizierte Admin-Flaeche statt Settings | Taste | P5 explicit over clever | Globaler Operator-Control gehoert nicht in user-/device-lokalen Settings-Scope | Settings-Block |
| 2 | CEO | Schmale Single-Purpose-Tabelle statt generischem Settings-Framework | Mechanical | P3 pragmatic | Ein Regler rechtfertigt noch kein Runtime-Config-Framework | generische JSON-Settings |
| 3 | Design | Screen zeigt `source/status/updatedAt/updatedBy` sichtbar | Mechanical | P1 completeness | Operator muss aktive Herkunft sofort erkennen | Werte ohne Provenance |
| 4 | Eng | `requireUserAuth()` plus `appRole` statt `requireAuth()` | Mechanical | P5 explicit | Kein falsches `no_household` fuer globale Admin-Flaeche | household-gekoppeltes Gate |
| 5 | Eng | Structured error envelope fuer Admin-Endpunkte | Mechanical | P1 completeness | Bestehender Client-Parser und Runbook nutzen den Vertrag bereits | flache String-Fehler |
| 6 | Eng | Browser-Write-Pfad explizit in Methode/CORS absichern | Mechanical | P1 completeness | Ein Admin-Save ist wertlos, wenn Preflight die Route nie erreicht | implizites "wird schon gehen" |
| 7 | Eng | Runtime-Config-Read muss missing-table/Rollback abfedern | Mechanical | P2 preserve safety | Neuer DB-Read darf den Validate-Hot-Path nicht zerbrechen | ungeschuetzter DB-Read |
| 8 | CEO | Gemeinsame Validation-Policy statt validate-only Sonderweg | Mechanical | P1 completeness | Sonst bleibt die eigentliche BYOK-Runtime-Semantik gespalten | validate-only admin control |
| 9 | Eng | Einheitlicher Fehlervertrag fuer Validate + Extraction | Mechanical | P1 completeness | Gemeinsame Policy ohne gemeinsame Fehlersemantik bleibt fuer UI und Operatoren inkonsistent | route-spezifische Fehlerformen |
| 10 | DX | Runbook + operator smoke als DoD | Mechanical | P1 completeness | Editierbarer Regler ohne Verify-/Rollback-Pfad ist operativ unvollstaendig | TODO-only Abschluss |

## Implementation Tasks

- [ ] **T1 (P1, human: ~0.5 day / CC: ~30 min)** — backend/admin — Add dedicated admin BYOK validation-policy route with `requireUserAuth()` + explicit admin gate
  - Surfaced by: Eng / DX — current plan points at the wrong auth pattern for a global admin control
  - Files: `src/routes/admin-byok.ts`, `src/api-react.ts`, `src/auth.ts`
  - Verify: `npm run test:auth` plus dedicated route contract tests
- [ ] **T2 (P1, human: ~0.75 day / CC: ~40 min)** — backend/config — Add explicit `source/status/updatedAt/updatedBy` validation-policy contract and shared helper across validate + extraction
  - Surfaced by: CEO / Design / DX — operators must distinguish `default` vs `database`, and runtime callers must stop diverging
  - Files: `src/db-react.ts`, `src/routes/keys.ts`, `src/routes/extraction.ts`, `src/schema.ts`
  - Verify: unit tests for no-row default, DB row, and read-failure path in both callers
- [ ] **T2b (P1, human: ~0.5 day / CC: ~25 min)** — backend/contracts — Normalize validate + extraction onto one structured BYOK error envelope
  - Surfaced by: Eng / DX — shared policy needs shared machine-readable failure semantics
  - Files: `src/routes/keys.ts`, `src/routes/extraction.ts`, shared API error helper
  - Verify: route tests for `byok_key_invalid`, `byok_validation_rate_limited`, `byok_policy_unavailable`
- [ ] **T3 (P1, human: ~0.5 day / CC: ~30 min)** — admin-ui — Build a dedicated admin page, not a Settings block
  - Surfaced by: CEO / Design — boundary clarity and screen-state specificity
  - Files: `mobile/app/`, `mobile/utils/api.ts`, new admin navigation surface
  - Verify: mobile/unit UI tests for loading/default/active/error/dirty states
- [ ] **T4 (P1, human: ~0.5 day / CC: ~20 min)** — docs/ops — Add runbook and operator smoke for set / verify / rollback across validate + extraction
  - Surfaced by: DX — current plan stops at TODO.md instead of operable instructions
  - Files: `docs/`, plan follow-up artifact
  - Verify: manual smoke steps documented and executable for `keys/validate`, `extract/react`, `extract/photo`, and `extract/text`
- [ ] **T5 (P1, human: ~0.25 day / CC: ~15 min)** — api-platform — Align browser write method with CORS allowlist
  - Surfaced by: Eng — current global API CORS config does not allow `PUT`
  - Files: `src/index.ts`, route contract, web/PWA smoke test
  - Verify: real browser/PWA save reaches route and returns success/error contract
- [ ] **T6 (P1, human: ~0.25 day / CC: ~15 min)** — admin-shell — Add read-only role source for admin nav/guard
  - Surfaced by: Eng — `appRole` should not require the side-effecting bootstrap POST
  - Files: auth/profile read path, admin route guard, `mobile/utils/`
  - Verify: admin/non-admin route gating works without invoking bootstrap side effects
