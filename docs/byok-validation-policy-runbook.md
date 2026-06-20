# BYOK Validation Policy Runbook

Stand: 2026-06-20

## Zweck

Die globale BYOK-Validation-Policy steuert gemeinsam:

- `POST /api/v1/keys/validate`
- `POST /api/v1/extract/react`
- `POST /api/v1/extract/photo`
- `POST /api/v1/extract/text`

Die Policy definiert:

- `windowMinutes`
- `maxRequests`

Wenn kein DB-Eintrag vorhanden ist oder der Config-Read fehlschlaegt, faellt die Runtime auf den Code-Default zurueck:

- `windowMinutes = 60`
- `maxRequests = 20`

## Admin-Flaeche

Pfad in der App:

1. `Settings`
2. `Admin Hub`
3. `BYOK Validation Policy`

Nur Admins duerfen die Flaeche lesen und schreiben.

## API-Endpunkte

- `GET /api/v1/admin/byok-validation-policy`
- `PUT /api/v1/admin/byok-validation-policy`

Read-Response liefert:

- `windowMinutes`
- `maxRequests`
- `source`
- `status`
- `updatedAt`
- `updatedBy`
- `appliesTo`

## Setzen

Beispiel:

```bash
curl -X PUT "$BASE_URL/api/v1/admin/byok-validation-policy" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"windowMinutes":15,"maxRequests":3}'
```

Erwartung:

- `200 OK`
- `source: "database"`
- `status: "active"`

## Verifizieren

### Verifizierter Live-Stand

Production wurde am 2026-06-20 nach dem Hotfix-Deploy `v1.0.177` erfolgreich gegen dieses Runbook geprueft:

- Browser-/PWA-Save auf `Settings -> Admin Hub -> BYOK Validation Policy` lief mit echtem `PUT /api/v1/admin/byok-validation-policy` auf `200 OK`.
- `POST /api/v1/keys/validate` liefert mit ungueltigem Key `200` + `valid: false` und spiegelt die aktive Policy.
- `POST /api/v1/extract/react`, `extract/photo` und `extract/text` liefern mit ungueltigem Key `400` + `code: "byok_key_invalid"`.
- Das geteilte Budget ueber mehrere Entry-Points kippt wie erwartet auf `429` + `code: "byok_validation_rate_limited"`.
- Die fuer den Smoke gesetzte Policy `15 / 3` wurde danach wieder auf `60 / 20` zurueckgesetzt.

### 1. Read-back pruefen

```bash
curl "$BASE_URL/api/v1/admin/byok-validation-policy" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Erwartung:

- die eben gesetzten Werte kommen unveraendert zurueck
- `updatedAt` und `updatedBy` sind gesetzt

### 2. Browser-/PWA-Save pruefen

1. Admin-Hub in der mobilen App oeffnen
2. `windowMinutes` oder `maxRequests` aendern
3. `Speichern` druecken
4. Erfolgsstatus in der UI pruefen
5. Read-back per `GET /api/v1/admin/byok-validation-policy` gegenpruefen

Erwartung:

- Preflight scheitert nicht
- Save liefert keinen generischen CORS-Fehler
- Werte sind serverseitig persistiert

### 3. `keys/validate` pruefen

Mit einem bewusst ungueltigen Key:

```bash
curl -X POST "$BASE_URL/api/v1/keys/validate" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"apiKey":"invalid_key_123"}'
```

Erwartung:

- `200 OK`
- `valid: false`
- `policy.windowMinutes` und `policy.maxRequests` spiegeln den aktiven Zustand

Rate-Limit-Signal pruefen:

1. Policy temporaer auf kleines Fenster setzen, z. B. `15` Minuten und `3` Requests
2. denselben Key mehrfach validieren

Erwartung:

- nach Ausschopfen des Budgets: `429`
- `code: "byok_validation_rate_limited"`
- `remaining` und `resetTime` sind gesetzt

### 4. Extraction-Pfade pruefen

Jeweils denselben BYOK-Key verwenden:

- `POST /api/v1/extract/react`
- `POST /api/v1/extract/photo`
- `POST /api/v1/extract/text`

Erwartung:

- ungueltiger Key -> `400` mit `code: "byok_key_invalid"`
- ausgeschopftes Budget -> `429` mit `code: "byok_validation_rate_limited"`
- alle drei Entry-Points reagieren auf dieselbe aktive Policy

## Rollback

Schnellster Rollback ist ein Ruecksetzen auf den Code-Default:

```bash
curl -X PUT "$BASE_URL/api/v1/admin/byok-validation-policy" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"windowMinutes":60,"maxRequests":20}'
```

Danach:

1. `GET /api/v1/admin/byok-validation-policy` pruefen
2. `POST /api/v1/keys/validate` einmal gegenpruefen

## Failure Modes

- `500` vor `byok_key_invalid` oder `byok_validation_rate_limited` auf allen Entry-Points
  - Verdacht auf Runtime-/DB-Fehler im gemeinsamen Rate-Limit-Pfad. Zuletzt trat das am 2026-06-20 vor dem Hotfix in `recordByokValidationAttempt()` beim Cleanup von `public.byok_validation_rate_limits` auf.

- `source: "default"` und `status: "uninitialized"`
  - Es existiert noch kein DB-Eintrag. Runtime laeuft mit Code-Default.

- Warnlog `byok.policy.fallback.validate`
  - Die Runtime konnte die DB-Policy nicht lesen und faellt auf Default zurueck.

- `403 admin_required`
  - Das verwendete Konto ist kein Admin.

- `400 validation_failed`
  - Admin-Save enthaelt ungueltige Werte.

- `500 byok_policy_unavailable`
  - Read/Write der Policy ist technisch fehlgeschlagen. DB/Migration pruefen.
