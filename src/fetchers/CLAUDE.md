# Fetchers — Claude Notes

## Cookidoo (`cookidoo.ts`)

### Übersicht
Cookidoo-Rezepte werden per OAuth 2.0 (ROPC-Flow) abgerufen. Kein Headless-Browser, kein Scraping mit Cookies — ausschließlich Bearer-Token via Vorwerk Mobile App API.

### Auth-Flow

**Endpunkt:**
```
POST https://eu.tmmobile.vorwerk-digital.com/ciam/auth/token
```

**Headers:**
```
Authorization: Basic a3VwZmVyd2Vyay1jbGllbnQtbndvdDpMczUwT04xd295U3FzMWRDZEpnZQ==
Content-Type: application/x-www-form-urlencoded
```
> Der Basic-Auth-Wert ist die hardcodierte Client-ID/Secret der Vorwerk-App — kein privates Secret, bereits öffentlich im App-Binary.

**Login-Body:**
```
grant_type=password&username=EMAIL&password=PASSWORD
```

**Refresh-Body:**
```
grant_type=refresh_token&refresh_token=TOKEN
```

**Response:**
```json
{ "access_token": "...", "refresh_token": "...", "expires_in": 3600 }
```

**Rezeptseiten:** `Authorization: Bearer {access_token}`

### Session-Management

- Session (`access_token`, `refresh_token`, `expires_at`) wird in **`data/cookidoo-session.json`** gespeichert
- Token-Ablauf: 60 Sekunden Puffer (`EXPIRY_BUFFER_MS`)
- Priorität: In-Memory-Cache → Disk → Token-Refresh → Full Login
- Bei 401/403: Session löschen, einmal neu einloggen

### Konfiguration

```
COOKIDOO_EMAIL=...     # in .env
COOKIDOO_PASSWORD=...  # in .env
```

Zugriff via `config.cookidoo.email` / `config.cookidoo.password`

### Scraping-Strategie

1. **Fast Path:** Schema.org JSON-LD (`@type: "Recipe"`) — Cookidoo bettet strukturierte Daten ein
2. **Fallback:** Cheerio-Selektoren: `.recipe-card`, `.recipe-detail`, `.recipe-content`, `main`, `article`

### Bekannte Einschränkungen

- `BASIC_AUTH` ist hardcodiert — wenn Vorwerk das ändert, muss der Wert aktualisiert werden
- `doLogin()` und `doRefresh()` sind strukturell sehr ähnlich (bewusstes Trade-off, YAGNI)
- Kein Android-Support für `node:fs` — bei Android-Migration muss die Session-Persistenz ersetzt werden

### Relevante Dateien

| Datei | Zweck |
|---|---|
| `src/fetchers/cookidoo.ts` | Fetcher (diese Datei) |
| `src/types.ts` | `SourceType` enthält `"cookidoo"` |
| `src/classifier.ts` | Regex `/cookidoo\.de\//i` |
| `src/pipeline.ts` | `case "cookidoo"` im Switch |
| `src/config.ts` | `config.cookidoo.{email,password}` |
| `data/cookidoo-session.json` | Persistente Session (gitignored) |
