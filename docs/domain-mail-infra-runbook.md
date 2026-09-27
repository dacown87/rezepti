# Runbook: Domain, DNS, Mail, Push und Betriebs-APIs

Stand: 2026-09-27. Gilt für Production (`https://www.recipedeckapp.de`). Hier steht, **wo was liegt und wie man es anfasst**. Offene Aufgaben stehen in [TODO.md](../TODO.md) unter „Offene Punkte (Stand 2026-09-27)“ und Punkt 9.

## Überblick

| Baustein | Anbieter | Steuerung |
|---|---|---|
| Domain `recipedeckapp.de` (Registrar) | INWX | DomRobot-API, Unterzugang `recipedeck-dns` |
| DNS-Zone | Cloudflare (Free) | Cloudflare-API, Account-Token |
| App-Hosting, TLS-Zertifikate | Northflank, Service `rezepti-app` im Projekt `rezepti` | Northflank-API |
| Einladungs-Mails (App) | Brevo, Transactional API | `BREVO_API_KEY` |
| Konto-Mails (Supabase Auth) | Brevo, SMTP-Relay | GitHub-Secrets `SMTP_*` → Workflow *Sync Supabase Auth Config* |
| Datenbank und Auth | Supabase, Projekt `zdiqtnljdxuhinqzgcnd` | Management API, Workflows |
| Web-Push | VAPID (eigene Schlüssel) | Northflank-Variablen und GitHub-Secret |

## Wo die Zugangsdaten liegen

**Lokal, nicht im Repo:**

| Datei | Inhalt |
|---|---|
| `~/.config/inwx.env` | `INWX_USER=recipedeck-dns`, `INWX_PASS`. Der Unterzugang hat keine 2FA und DNS- sowie Domain-Rechte. |
| `~/.config/recipedeck-vapid.env` | Sicherung des VAPID-Schlüsselpaars und `VAPID_SUBJECT`. **Nicht rotieren**, sonst verfallen alle Push-Abos. |

**In der Repo-`.env` (gitignored):**

| Variable | Zweck |
|---|---|
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` | Cloudflare. Account-Token (`cfat_…`) mit *Zone → Zone Edit* und *DNS Edit* |
| `NORTHFLANK_TOKEN` | Northflank-API. `NORTHFLANK_PROJECT_ID=rezepti`, `NORTHFLANK_SERVICE_ID=rezepti-app` |
| `SUPABASE_ACCESS_TOKEN` | Supabase Management API |
| `BREVO_API_KEY` | Brevo-API. Siehe IP-Allowlist unten |

**GitHub-Secrets (Auszug):**
- `NORTHFLANK_HEALTHCHECK_URL`
- `EXPO_PUBLIC_VAPID_PUBLIC_KEY`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SENDER_NAME`, `SMTP_ADMIN_EMAIL`
- `EXPO_PUBLIC_SUPABASE_*`

**Northflank-Laufzeitvariablen (13 Stück):**
- `BREVO_API_KEY`, `CREDENTIAL_ENCRYPTION_KEY`, `DATABASE_URL`, `GROQ_API_KEY`
- `RECIPE_INVITE_BASE_URL`, `RECIPE_INVITE_EMAIL_FROM`, `RECIPE_INVITE_EMAIL_PROVIDER`, `RECIPE_INVITE_EMAIL_REPLY_TO`
- `SUPABASE_ANON_KEY`, `SUPABASE_URL`
- `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT`

Werte aus diesen Quellen nie ausgeben oder in Logs, Commits oder PRs schreiben.

## DNS (Cloudflare)

- **Zone:** `e741d60c8b9d24e73dcd1f3a4065ade7`
- **Nameserver:** `casey.ns.cloudflare.com` und `daphne.ns.cloudflare.com`, bei INWX eingetragen
- **Alle Records `proxied: false`.** Mit Cloudflare-Proxy scheitern Northflank-Zertifikat und Routing.
- **Die alte INWX-Zone ist wirkungslos.** Records dort zu ändern bringt nichts.

| Typ | Name | Inhalt |
|---|---|---|
| CNAME | `@` (Cloudflare flacht ab) | `recipedeckapp.de.daco-sxsd.dns.northflank.app` |
| CNAME | `www` | `www.recipedeckapp.de.daco-sxsd.dns.northflank.app` |
| CNAME | `brevo1._domainkey` / `brevo2._domainkey` | `b1`/`b2.recipedeckapp-de.dkim.brevo.com` (DKIM) |
| TXT | `@` | `brevo-code:…` (Brevo-Verifizierung) |
| TXT | `@` | `v=spf1 include:spf.brevo.com ~all` |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com` |
| TXT | `verify-zorjb5zn53m6nup78qayi1h3` | Northflank-Domain-Verifizierung, nicht löschen |

```bash
eval "$(grep -E '^CLOUDFLARE_API_TOKEN=' .env)"
Z=e741d60c8b9d24e73dcd1f3a4065ade7
# Records auflisten
curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" "https://api.cloudflare.com/client/v4/zones/$Z/dns_records?per_page=100"
# Record anlegen (TXT-Inhalte in Anführungszeichen)
curl -s -X POST -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "content-type: application/json" \
  -d '{"type":"TXT","name":"_dmarc","content":"\"v=DMARC1; p=quarantine; rua=mailto:rua@dmarc.brevo.com\"","ttl":300,"proxied":false}' \
  "https://api.cloudflare.com/client/v4/zones/$Z/dns_records"
# Prüfen, direkt am Nameserver und öffentlich
dig +short TXT _dmarc.recipedeckapp.de @casey.ns.cloudflare.com
dig +short TXT _dmarc.recipedeckapp.de @1.1.1.1
```

Bei einer neuen Zone liefern die Cloudflare-Nameserver Subdomains kurz mit `NXDOMAIN` aus, bis die Records verteilt sind. Das ist normal, einfach kurz warten.

## Registrar (INWX)

Die API ist DomRobot JSON-RPC unter `https://api.domrobot.com/jsonrpc/`. Die Anmeldung läuft über `account.login` mit `{user, pass}` und liefert ein Session-Cookie, das bei allen weiteren Aufrufen mitgeschickt werden muss. INWX kennt keine API-Keys.

Nach der Anmeldung:

| Methode | Zweck |
|---|---|
| `domain.info` | Nameserver und Status einer Domain |
| `domain.update {domain, ns:[…]}` | Nameserver wechseln |
| `nameserver.info`, `nameserver.createRecord`, `nameserver.deleteRecord` | Die INWX-Zone. Ist aktuell ungenutzt |

Ein Nameserver-Wechsel wird von DENIC vorab geprüft. Die neue Zone muss also schon auf den neuen Nameservern antworten. Die Delegation prüfst du mit `dig NS recipedeckapp.de @a.nic.de +noall +authority`.

## Northflank

**Domains** (`recipedeckapp.de` ist verifiziert):
- `www` und `@` sind mit Port `p01` verknüpft.
- Die Zertifikate stellt Northflank automatisch aus. Sie laufen bis 2026-12-26 und werden verlängert.
- Endpunkte:
  - `GET /v1/domains/recipedeckapp.de`
  - `POST /v1/domains/{domain}/subdomains`
  - `POST …/subdomains/{sub}/verify`
  - `POST …/subdomains/{sub}/assign` mit `{serviceId, projectId, portName}`
- Den Apex als `%40` URL-kodiert übergeben.

**Laufzeitvariablen ändern:** Ein Update ersetzt die **komplette** Environment. Deshalb immer so vorgehen:
1. Mit `GET /v1/projects/rezepti/services/rezepti-app/runtime-environment` alle Variablen auslesen und lokal sichern.
2. Lokal ergänzen.
3. Alles zusammen mit `PATCH /v1/projects/rezepti/services/deployment/rezepti-app` und `{"runtimeEnvironment":{…alle…}}` zurückschreiben.
4. Die Anzahl der Variablen prüfen. Die Änderung löst einen Neustart aus, danach `/api/v1/health` prüfen.

**Health-Checks:**
- Es gibt nur eine `livenessProbe`: HTTP auf `/api/v1/health/live`, Port 3000, alle 30 s, Timeout 5 s, 3 Fehlschläge.
- Setzen mit `PATCH …/services/deployment/rezepti-app` und `{"healthChecks":[…]}`. Das ersetzt die komplette Liste. `successThreshold` ist nur bei `readinessProbe` erlaubt.
- **Keine Readiness auf `/api/v1/health`**, solange es nur eine Instanz gibt. Warum, steht in TODO Punkt 8.

**Logs:**
- `GET /v1/projects/rezepti/services/rezepti-app/logs` mit den Parametern `startTime`, `endTime`, `lineLimit`, `direction`, `textIncludes` und `containerName`.
- Ohne `containerName` kommen nur Logs des aktuellen Containers. Ältere Container fragst du einzeln ab.
- Ein Zeitraum darf höchstens 31 Tage umfassen.
- Ingress- und Access-Logs sind für den Account per Feature-Flag gesperrt.

## Brevo

- **IP-Allowlist:** Die API lehnt unbekannte IPs mit `unauthorized … unrecognised IP address` ab. Freigabe unter https://app.brevo.com/security/authorised_ips. Nur die **IPv4** freigeben und mit `curl -4` aufrufen, denn die IPv6 des Heimanschlusses rotiert.
- **Domain:** `recipedeckapp.de` ist authentifiziert. Prüfen mit `GET https://api.brevo.com/v3/senders/domains/recipedeckapp.de` und dem Header `api-key`.
- **Absender:**
  - `einladung@recipedeckapp.de` für Einladungen, Reply-To `recipedeckapp@gmail.com`
  - `noreply@recipedeckapp.de` für Supabase-Auth
  - `recipedeckapp@gmail.com` ist ein Altabsender
- **Altlast:** Der Domain-Eintrag `recipedeck.app` (fremde Domain, nie authentifiziert) sollte weg.
- **SMTP-Relay:**
  - Host `smtp-relay.brevo.com:587`, Login `b25ff3001@smtp-brevo.com`.
  - Das Passwort ist ein **SMTP-Key**, nicht der API-Key. Er lässt sich nur in der Brevo-Oberfläche unter *SMTP & API → SMTP keys* erzeugen.
  - Test ohne Supabase: `curl --url smtp://smtp-relay.brevo.com:587 --ssl-reqd --mail-from … --mail-rcpt … --user '<login>:<key>' --upload-file mail.txt`
- **Kontingent:** Der Free-Plan erlaubt 300 Mails am Tag, Einladungen und Auth zusammen.

## Supabase Auth

- **Konfiguration:** Sie wird **nur** über `.github/workflows/supabase-auth-config.yml` gesetzt. Manuelle Änderungen im Dashboard überschreibt der nächste Lauf. Der Workflow startet bei Änderungen am Workflow oder an `supabase/templates/**` und manuell über `gh workflow run "Sync Supabase Auth Config"`.
- **Was er setzt:**
  - `site_url` und `uri_allow_list` (www, Apex, code.run, `recipedeck://`)
  - Mail-Betreffs und Vorlagen
  - und nur wenn `SMTP_HOST` gesetzt ist: den SMTP-Block plus `rate_limit_email_sent` (30 pro Stunde)
- **Reihenfolge beim Einrichten:** `SMTP_HOST` immer als letztes Secret setzen, sonst schaltet der Workflow SMTP ohne Passwort ein.
- **Prüfen:**
  ```bash
  curl -s -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" https://api.supabase.com/v1/projects/zdiqtnljdxuhinqzgcnd/config/auth
  ```
  Relevant sind die Felder `rate_limit_email_sent`, `smtp_host`, `smtp_admin_email`, `site_url` und `password_hibp_enabled`.
- **Logs:**
  - `logs.all` gibt es seit 2026-09-23 nicht mehr. Neu ist `analytics/endpoints/logs`: eine Tabelle `logs`, gefiltert nach `source` (postgres, auth, edge und weitere).
  - Die Aufbewahrung beträgt nur etwa einen Tag.
  - Viele Abfragen kurz hintereinander führen zu `ThrottlerException`.
- **Advisors:** Abgleich gegen [supabase-advisor-remediation-plan.md](SupaBase/supabase-advisor-remediation-plan.md). Den Stand vom 2026-09-27 findest du in TODO Punkt 9.
- **Migrationen in Production** laufen nur über den Workflow *Apply Supabase Migrations*.

## Web-Push (VAPID)

- **Server:** `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` und `VAPID_SUBJECT=mailto:admin@recipedeckapp.de` als Northflank-Variablen.
- **Client:** Der öffentliche Schlüssel wird beim Build ins Bundle eingebaut. Er kommt aus dem GitHub-Secret `EXPO_PUBLIC_VAPID_PUBLIC_KEY` und geht als Build-Arg in `docker-publish.yml` in den Build. Ohne das Build-Arg ist Push im Web stumm, auch wenn der Server konfiguriert ist.
- **Prüfen, ob der Schlüssel im Live-Bundle steckt:** Die `entry-*.js` von `https://www.recipedeckapp.de/` nach den ersten Zeichen des Public Keys durchsuchen.
- Mehr in [pwa-runbook.md](pwa-runbook.md).

## Server-seitige Domain-Logik

Beides steht in `src/index.ts`:
- **Host-Middleware:** Anfragen an `recipedeckapp.de` gehen an `https://www.recipedeckapp.de`. GET und HEAD bekommen `301`, andere Methoden `308`. Pfad und Query bleiben erhalten. Tests: `test/unit/canonical-host-and-liveness.test.ts`.
- **`ALLOWED_ORIGINS` (CORS):** www, Apex und code.run, die alte Adresse vorerst noch als Übergang.

Die native App nutzt standardmäßig `mobile/utils/server-url.ts` (`PRODUCTION_URL`).

## Bekannte Stolpersteine

- Ein CNAME auf `@` ist nur mit Flattening möglich. INWX kann das nicht, deshalb der Umzug zu Cloudflare.
- Die URL-Weiterleitung von INWX funktioniert nur über HTTP.
- Der Auto-Mode-Classifier von Claude Code blockiert Merges, das Schreiben von Secrets sowie DNS- und Domain-Änderungen, solange der Nutzer sie nicht ausdrücklich freigegeben hat.
- Im CI-Job `supabase-rls-smoke` ist `toomanyrequests: Data limit exceeded` ein Registry-Limit. Den Job einfach erneut starten.
- Login-Session, Offline-Cache, Push-Abo und PWA-Installation hängen an der jeweiligen Adresse. Bei einem Adresswechsel müssen sich Nutzer neu anmelden, neu installieren und Push neu einschalten.
