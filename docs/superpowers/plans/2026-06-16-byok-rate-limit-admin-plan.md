# BYOK Rate Limit Admin Slice — Execution Plan

Stand: 2026-06-16
Status: Draft, noch nicht reviewed

## Ziel

Das serverseitige BYOK-Rate-Limit fuer `POST /api/v1/keys/validate` soll im Admin sichtbar und aenderbar werden, damit der aktive Grenzwert nicht nur als lokale Konstante in [src/routes/keys.ts](/home/patrick/Projekte/rezepti/src/routes/keys.ts:5) existiert.

Der Slice soll:

- den aktuell wirksamen Rate-Limit-Wert und das Zeitfenster anzeigen
- eine Admin-only Aenderung dieser Werte erlauben
- den bestehenden Validation-Flow weiterverwenden
- keine neue Produktlogik fuer normale Nutzer einfuehren

## Ausgangslage

Heute liegt die Konfiguration fest im Code:

- `BYOK_VALIDATE_WINDOW_MINUTES = 60`
- `BYOK_VALIDATE_MAX_REQUESTS = 20`

Die Persistenz fuer Verbrauchsdaten existiert bereits:

- Tabelle `public.byok_validation_rate_limits` in [src/schema.ts](/home/patrick/Projekte/rezepti/src/schema.ts:185)
- Schreib-/Zaehllogik in `recordByokValidationAttempt()` in [src/db-react.ts](/home/patrick/Projekte/rezepti/src/db-react.ts:927)

Es gibt ausserdem bereits ein Admin-Gate-Muster im Backend:

- `auth.appRole !== "admin"` in [src/routes/planner.ts](/home/patrick/Projekte/rezepti/src/routes/planner.ts:143)

## Scope-Entscheidung

### In Scope

1. Serverseitige Konfiguration fuer BYOK-Validation-Rate-Limit in DB oder aehnlich zentraler Server-Quelle fuehren.
2. Admin-only Read- und Write-API fuer diese Konfiguration bereitstellen.
3. Kleines Admin-UI, das aktuellen Wert + Zeitfenster zeigt und editierbar macht.
4. Tests fuer Auth-Gate, Validierung, Persistenz und Runtime-Nutzung.
5. TODO/Doku auf den neuen Stand ziehen.

### Nicht in Scope

1. Nutzer-sichtbare Rate-Limit-Seite ausserhalb Admin.
2. Historische Analytics oder Diagramme ueber Rate-Limit-Verbrauch.
3. Per-Provider oder per-Workspace getrennte Limits.
4. Automatische Alerting-/Notification-Mechanik.
5. Generelles Admin-CMS fuer beliebige Runtime-Settings.

## Empfohlener Ansatz

Empfohlen ist ein kleiner zentraler Runtime-Config-Slice statt weiterer Hardcoded-Konstanten.

Konkret:

1. Eine dedizierte Server-Konfiguration fuer das BYOK-Validate-Limit einfuehren.
2. `POST /api/v1/keys/validate` liest diese Werte zur Laufzeit statt aus Datei-Konstanten.
3. Ein Admin-Endpoint liefert und schreibt genau diese zwei Werte:
   - `windowMinutes`
   - `maxRequests`
4. Das Admin-UI bleibt minimal und lebt am besten im bestehenden Settings-/Admin-Umfeld.

Warum dieser Weg:

- Er ersetzt die harte Konstante direkt an der Quelle.
- Er erzeugt keinen Wildwuchs aus Env-Variablen, Code-Fallbacks und UI-Sonderwegen.
- Er bleibt klein genug fuer einen einzelnen Slice.

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

Option A. Dieser Slice will kein Settings-Framework bauen, sondern genau einen bestehenden Hardcode administrierbar machen.

## API-Schnittstellen

### 1. Admin Read

`GET /api/v1/admin/byok-rate-limit`

Response:

```json
{
  "windowMinutes": 60,
  "maxRequests": 20,
  "source": "database"
}
```

Regeln:

- nur authentifizierte Admins
- `403 admin_required` fuer normale Nutzer
- falls noch kein DB-Eintrag existiert: Default aus bestehendem Verhalten zurueckgeben

### 2. Admin Write

`PUT /api/v1/admin/byok-rate-limit`

Request:

```json
{
  "windowMinutes": 60,
  "maxRequests": 20
}
```

Regeln:

- nur authentifizierte Admins
- Ganzzahlen, beide > 0
- konservative Grenzen setzen, z. B.:
  - `windowMinutes`: 1 bis 1440
  - `maxRequests`: 1 bis 1000
- Antwort liefert den gespeicherten Zustand zurueck

### 3. Runtime-Nutzung in `keys.ts`

`POST /api/v1/keys/validate` soll vor `BYOKValidator.checkRateLimit()` die aktive Config laden.

Wichtig:

- kein Schreibpfad in der Request-Runtime ausser dem bestehenden Verbrauchszaehler
- wenn Config-Read fehlschlaegt oder leer ist: sauberer Fallback auf heutige Defaults

## Backend-Aufteilung

### Phase 1 — Config-Store

- Schema + Migration fuer die Settings-Tabelle
- Drizzle-Schema in `src/schema.ts`
- DB-Helfer in `src/db-react.ts`
  - `getByokValidationSettings()`
  - `upsertByokValidationSettings()`

### Phase 2 — Admin-Routen

- neue Admin-Route, z. B. in `src/routes/admin-byok.ts` oder bestehende Admin-Route erweitern
- Auth-/Admin-Gate analog zum Planner-Dictionary-Muster
- Input-Validierung und klare Fehlercodes

### Phase 3 — Runtime-Integration

- `src/routes/keys.ts` liest aktive Settings
- Hardcoded-Fallback bleibt als sichere letzte Linie erhalten

## Frontend-/Admin-UI

Der UI-Slice soll klein bleiben.

Empfohlen:

1. Im Settings-Screen nur fuer Admins ein kompakter Abschnitt `BYOK Rate Limit`.
2. Anzeigen:
   - `Max. Validierungen`
   - `Zeitfenster in Minuten`
3. Bearbeitung ueber zwei numerische Inputs plus `Speichern`.
4. Beim Speichern:
   - Loading-State
   - Success-Feedback
   - klarer Fehler bei `403`, `400`, `500`

Nicht noetig fuer Slice 1:

- Tabellenansicht
- Audit-Timeline
- Detailansicht einzelner Verbrauchseintraege

## Fehlerbehandlung

### Backend

- `401` wenn nicht eingeloggt
- `403 admin_required` wenn kein Admin
- `400` bei ungueltigen Zahlen oder fehlendem Body
- `500` nur fuer echte Server-/DB-Fehler

### Frontend

- bei `403`: Hinweis, dass Admin-Rechte fehlen
- bei `400`: Feldfehler oder kompakte Validierungsnachricht
- bei `500`: generische Fehlermeldung, ohne technische Interna

## Tests

### Backend

1. `GET /api/v1/admin/byok-rate-limit`
   - `401` ohne Auth
   - `403` ohne Admin-Rolle
   - `200` mit Default-Fallback
   - `200` mit DB-Wert

2. `PUT /api/v1/admin/byok-rate-limit`
   - `401` ohne Auth
   - `403` ohne Admin-Rolle
   - `400` fuer ungueltige Werte
   - `200` fuer gueltige Werte

3. `POST /api/v1/keys/validate`
   - verwendet gespeichertes `windowMinutes`
   - verwendet gespeichertes `maxRequests`
   - faellt bei fehlender Config auf Defaults zurueck

### Frontend

1. Admin sieht den BYOK-Block.
2. Nicht-Admin sieht ihn nicht.
3. Laden zeigt vorhandene Werte.
4. Speichern sendet den Write-Request und aktualisiert die Anzeige.
5. `403` und `500` werden sauber im UI behandelt.

## Reihenfolge

1. Migration + Schema fuer BYOK-Settings
2. DB-Helfer fuer Read/Write
3. Admin-API
4. Runtime-Anbindung in `keys.ts`
5. Admin-UI im Settings-Bereich
6. Tests
7. `TODO.md` auf erledigt oder in Nachweisblock aktualisieren

## Definition of Done

- Der aktive BYOK-Validation-Grenzwert ist nicht mehr nur als Hardcode gepflegt.
- Ein Admin kann `windowMinutes` und `maxRequests` lesen und aendern.
- `POST /api/v1/keys/validate` nutzt die gespeicherte Runtime-Config.
- Nicht-Admins koennen die Werte weder lesen noch aendern.
- Tests decken Auth, Validierung, Persistenz und Runtime-Nutzung ab.
- `TODO.md` spiegelt den Abschluss korrekt.

## Risiken

1. Ein generischer Settings-Ansatz wuerde den Slice unnötig aufblasen.
2. Ohne Default-Fallback kann ein leerer DB-Zustand den bestehenden Validate-Flow brechen.
3. Ein UI ohne Admin-Gate wuerde eine nutzlose oder irrefuehrende Flaeche fuer normale Nutzer zeigen.

## Offene Folgepunkte fuer spaeter

1. Verbrauchsmetriken oder Admin-Statistik fuer `byok_validation_rate_limits`
2. Audit-Log, wer die Werte geaendert hat
3. Weitere Runtime-Settings im selben Admin-Bereich
