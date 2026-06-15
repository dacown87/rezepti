# Fetchers — Claude Notes

## Cookidoo (`cookidoo.ts`)

### Übersicht
Cookidoo-Rezepte werden ueber den echten Web-Login-Flow von cookidoo.de
abgerufen. Der Fetcher nutzt den lokalen CF-Clearance-Scraper fuer WAF-Cookies,
folgt den Redirects manuell und speichert die resultierende Web-Session scoped
in Postgres statt in einer globalen Datei.

### Auth-Flow

1. `POST {CF_SCRAPER_URL}/cf-clearance-scraper` fuer eine frische WAF-Session
2. `GET https://cookidoo.de/profile/de-DE/login?redirectAfterLogin=%2F`
3. Redirect-Folge zu Vorwerk CIAM, `requestId` extrahieren
4. `POST https://ciam.prod.cookidoo.vorwerk-digital.com/login-srv/login`
   mit Formularfeldern `requestId`, `username`, `password`
5. Erfolgsfall: Session-Cookies inklusive `v-authenticated`
6. Rezeptseiten werden anschliessend mit Cookie-Header und passendem
   User-Agent geladen

### Session-Management

- Session-Felder (`session_cookies`, `session_user_agent`,
  `session_expires_at`) liegen in `public.cookidoo_credentials`
- Prioritaet: In-Memory-Cache -> scoped DB-Session -> Full Web Login
- Bei `401/403`: nur die Session des betroffenen Scopes loeschen, dann einmal
  neu einloggen
- Legacy-Dateien `data/cookidoo-session.json` und
  `data/cookidoo-credentials.json` werden nicht mehr gelesen, nur best-effort
  entfernt

### Konfiguration

- Credentials kommen nicht mehr aus `.env` oder `config.cookidoo.*`
- Aufloesung erfolgt serverseitig ueber `resolveCookidooCredentials(...)`
  mit Prioritaet `user > household > none`
- BYOK bleibt davon unberuehrt; nur der Connector-Scope wurde umgebaut
- Optionaler Laufzeit-Parameter: `CF_SCRAPER_URL` fuer den lokalen Clearance-
  Service

### Scraping-Strategie

1. **Fast Path:** Schema.org JSON-LD (`@type: "Recipe"`) — Cookidoo bettet strukturierte Daten ein
2. **Fallback:** Cheerio-Selektoren: `.recipe-card`, `.recipe-detail`, `.recipe-content`, `main`, `article`

### Bekannte Einschränkungen

- Der Auth-Pfad braucht einen laufenden lokalen CF-Clearance-Scraper
- Background-Jobs muessen `activeHouseholdId` snapshotten, damit Household-
  Fallback im Async-Pfad denselben Resolver nutzen kann
- Ohne gespeicherte scoped Credentials faellt der Fetcher auf unauthenticated
  HTML-Fetches zurueck; damit fehlen je nach Seite echte Steps/Details

### Relevante Dateien

| Datei | Zweck |
|---|---|
| `src/fetchers/cookidoo.ts` | Fetcher (diese Datei) |
| `src/db-react.ts` | Scoped Credential-Resolver + Session-Writeback |
| `src/routes/platforms.ts` | Private Save/Delete + Household Share/Unshare |
| `src/types.ts` | `SourceType` enthält `"cookidoo"` |
| `src/classifier.ts` | Regex `/cookidoo\.de\//i` |
| `src/pipeline.ts` | `case "cookidoo"` im Switch |
| `src/routes/extraction.ts` / `src/job-manager.ts` | Snapshot von `activeHouseholdId` fuer Background-Jobs |
| `supabase/migrations/20260615170413_cookidoo_credentials_scoped.sql` | Scoped DB-Tabelle |
