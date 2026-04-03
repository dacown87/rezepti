# Cookidoo Auth — Learnings 2026-04-03

## Was funktioniert (Stand heute)

Cookidoo-Rezepte mit echten Zubereitungsschritten werden erfolgreich importiert.
Die Schritte stehen nur für eingeloggte User im JSON-LD (`recipeInstructions`).

## Auth-Flow (vollständig implementiert in `src/fetchers/cookidoo.ts`)

1. **CF Clearance** holen via lokalen Docker-Service `cf-clearance-scraper` (Port 3001)
   - URL: `https://cookidoo.de/foundation/de-DE/explore` (wichtig: nicht `cookidoo.de/` — das redirectet und der Scraper returned dann nie)
   - Mode: `waf-session`
   - Gibt Headers zurück (user-agent, sec-ch-ua etc.) — kein `cf_clearance` Cookie nötig für cookidoo.de selbst

2. **Login-Flow** (3 Schritte, single cookie jar):
   - GET `https://cookidoo.de/profile/de-DE/login?redirectAfterLogin=%2F`
     → redirectet zu `https://eu.login.vorwerk.com/ciam/login?requestId=XXX`
   - GET `https://eu.login.vorwerk.com/ciam/login?requestId=XXX` → sammelt Cookies (cidaas_dr etc.)
   - POST `https://ciam.prod.cookidoo.vorwerk-digital.com/login-srv/login`
     Body: `requestId=XXX&username=EMAIL&password=PASSWORD`
     → 302 → `cookidoo.de/oauth2/callback?code=...` → setzt `v-authenticated`, `_oauth2_proxy` Cookies

3. **Kritische Erkenntnisse:**
   - ❌ Alter Endpoint `eu.tmmobile.vorwerk-digital.com/ciam/auth/token` → gibt 502 zurück (in Wartung/deprecated)
   - ❌ POST an `eu.login.vorwerk.com/ciam/login` → gibt 405 (falsche URL!)
   - ✅ Form-Action ist `https://ciam.prod.cookidoo.vorwerk-digital.com/login-srv/login`
   - ✅ Kein Turnstile-Token nötig (die Cloudflare-Challenge war nur beim Testen ohne User-Agent)
   - ✅ Ein einziger Cookie-Jar für alle Domains (vorwerk + cookidoo gemischt) funktioniert
   - ✅ `v-authenticated` Cookie zeigt erfolgreichen Login

4. **Session-Caching:**
   - CF Session: 25 min (gecacht in Memory)
   - Web Session: 55 min (gecacht in Memory + Disk `data/cookidoo-session.json`)
   - Bei 401/403: Session löschen und neu einloggen

## Docker Setup

```yaml
cf-clearance-scraper:
  image: zfcsoftware/cf-clearance-scraper:latest
  ports:
    - "3001:3000"
  environment:
    - PORT=3000
    - browserLimit=5
    - timeOut=300000
  shm_size: 512mb
  restart: unless-stopped
```

**Wichtig:** `shm_size: 512mb` ist nötig sonst crasht Chromium im Container.
**Wichtig:** `timeOut=300000` (5 min) — Cookidoo braucht manchmal länger.

## Verwendetes Image

`zfcsoftware/cf-clearance-scraper:latest` — zeigt auf v2.1.3 (gepusht 2025-02-01 auf Docker Hub).

**Status (geprüft 2026-04-03):** GitHub-Repo offiziell eingestellt (letzter Commit Sep 2024, README: "no more updates").
Docker Hub wurde aber noch bis Feb 2025 gepflegt. Kein aktiver Fork mit eigenem Docker-Image gefunden.

**Fork-Analyse:**
- `854771076/cf-clearance-scraper` — JS-basiert, API-kompatibel, kein eigenes Docker-Image → aber als Basis für ein selbst gebautes Image geeignet, falls das Original-Image mal bricht
- `0xsongsu/cf-clearance-scraper` — 221 Sterne, aber Python/Jupyter, nicht kompatibel
- `Ophelia-Priest/cf-clearance-scraper2` — verweist auf Original-Image, kein Mehrwert

**Empfehlung:** Beim Original-Image bleiben. Es funktioniert und es gibt keinen besseren Ersatz.

**Fallback-Option:** `ThePhaseless/Byparr` (`ghcr.io/thephaseless/byparr`) — aktiv gepflegt (v2.1.0, Feb 2026),
aber FlareSolverr-kompatible API (Python) → würde Änderungen in `cookidoo.ts` erfordern.

## Fallback (ohne Docker/CF-Scraper)

Wenn der CF-Scraper nicht erreichbar ist (`/health` timeout), fällt der Fetcher
auf unauthentiziertes Fetching zurück — Zutaten kommen aus Schema.org, Schritte
werden vom LLM generiert (ungenau).
