# Plan: Pinterest- und Facebook-Connectors

**Stand:** 2026-08-07, überarbeitet nach `/plan-eng-review` · **Status:** ENTWURF

> **Was sich in der Review geändert hat.** Die erste Fassung plante zuerst den
> Credential-Stack und schob eine Sicherheitslücke hinter zwei offene
> Entscheidungen. Das ist umgedreht. Außerdem hat die Prüfung eine Behauptung
> der ersten Fassung widerlegt (siehe „Korrektur").

---

## Warum der Zustand so ist

Beide Connectors waren implementiert (`68d89f6` Pinterest, `088d4ac` + `2621f92`
Facebook). Am 2026-06-09 hat `a6614e7` **die Routen** im Zuge der
Multi-User-Umstellung auf `501` gesetzt: beide legten einen globalen
Credential-Satz auf Disk ab. Am 2026-08-07 hat `8f57b08` einen Teil der
Disk-Helfer entfernt.

### Korrektur zur ersten Fassung

Die erste Fassung schrieb, die Fetcher „laufen also, nur ohne Credentials", und
`8f57b08` habe „die verwaisten Disk-Helfer entfernt". Beides ist zu optimistisch.

`a6614e7` hat **nur die Routen** angefasst. Die Fetcher lesen die globalen
Dateien bis heute:

| Ort | Was |
|---|---|
| `src/fetchers/pinterest.ts:12-16` | `CREDENTIALS_FILE = data/pinterest-credentials.json` |
| `src/fetchers/pinterest.ts:28-41` | `loadCredentialsFromDisk` + `getPinterestCredentials`, prozessweit gecacht |
| `src/fetchers/pinterest.ts:312-315` | `fetchFromPinterestApi` nutzt sie für **jeden** Nutzer |
| `src/fetchers/facebook.ts:12-15, 88` | `COOKIE_PATH = data/facebook-cookies.txt`, an yt-dlp gehängt |

`8f57b08` hat laut eigener Commit-Message `getPinterestCredentials` und den
Disk-Loader **ausdrücklich behalten** („Kept but unexported — these are live
internals").

`docker-compose.yml` mountet `./data:/app/data`. Läge eine der beiden Dateien
in Production, **importierte jeder Nutzer mit fremden Credentials** — genau das
Loch, das `a6614e7` schließen sollte, nur eine Ebene tiefer.

**Production geprüft am 2026-08-07** (`northflank exec service --projectId
rezepti --serviceId rezepti-app`): `/app/data` **existiert dort gar nicht**,
also auch keine der beiden Dateien. Das Loch ist **nicht scharf**. Slice 0 ist
damit kein Hotfix, sondern Vorsorge: der Codepfad ist da, und ein später
gemountetes Volume oder eine lokale Kopie beim Debuggen würde ihn öffnen.

Zusätzlich: `data/facebook-cookies.txt` steht **nicht** in `.gitignore` (dort
stehen nur `data/*.db`, `cookidoo-session.json`, `client_secret_*.json`,
`gmail-oauth-token.json`). Eine versehentlich abgelegte Cookie-Datei wird
committet — das ist eine vollständige Facebook-Session im Git-Verlauf.

---

## Gemessener Ist-Stand (2026-08-07)

### Pinterest: anonymes Scraping ist tot

Zwei echte Pins (`/pin/1055599405112143/`, `/pin/61713443933/`):

| Messung | Ergebnis |
|---|---|
| HTTP | 200, ~1,08 MB — für beide Pins nahezu identisch (App-Shell) |
| `og:*`-Tags | **keine** |
| `"link":"…"` | nicht vorhanden |
| `__PWS_DATA__` | 80 KB, nur `context`/`experiments`/`routeTree`, **keine Pin-Daten** |
| yt-dlp 2024.04.09 | `HTTP Error 403: Forbidden` |

Pinterest rendert Pin-Inhalte für anonyme Besucher vollständig client-seitig.
Es gibt keinen Scraping-Pfad, den man reparieren könnte.

### Pinterest: der Fetcher importiert heute JavaScript als Rezept

`fetchPinterest` liefert für beide Test-Pins:

```
url:         https://s.pinimg.com/webapp/www/_/_/accessibility-be939e6aa4c84056.mjs
textContent: (self.modernJsonp=self.modernJsonp||[]).push([[25550],{868529(e,t,n){…
             — 6000 Zeichen minifiziertes JavaScript
```

Ursache: der Guard ist `!url.includes("pinterest.")`, und `s.pinimg.com`
enthält diese Zeichenkette nicht. Der Guard ist **dreimal dupliziert**:

- `findOriginalUrl` (`pinterest.ts:89`)
- `extractLinkFromJson` (`pinterest.ts:149`)
- `extractImagesFromHtml` (`pinterest.ts:234`)

> Welche der vier Strategien den CDN-Treffer produziert hat, ist **nicht
> gemessen**. Strategie 3 (`"link":"https://…"`-Regex über rohes HTML,
> `:120-123`) kann Inline-Bundle-JSON genauso treffen wie Strategie 4. Der Fix
> muss alle Stellen abdecken, nicht die vermutete.

Zweiter Bug: das `__PWS_DATA__`-Muster sucht die Zuweisungsform
`__PWS_DATA__ = {…}`; ausgeliefert wird `<script id="__PWS_DATA__"
type="application/json">`. Der Zweig ist wirkungslos.

### Facebook: erst die Version prüfen

Lokal läuft yt-dlp **2024.04.09**, aktuell ist **2026.7.4**. Das Dockerfile
installiert mit `--upgrade`, Production weicht also ab. Facebook ist der
versionsempfindlichste Extractor. `scripts/ytdlp-health-check.ts` deckt
Facebook und Pinterest nicht ab und hängt an keinem npm-Script.

---

## Slices

> **Slice 0, 0a und 0c sind für Pinterest am 2026-08-07 umgesetzt.** Der
> Facebook-Anteil von Slice 0 bleibt bewusst offen — das Entfernen des
> Disk-Pfads würde den einzigen funktionierenden Weg kappen, bevor der
> verschlüsselte DB-Pfad steht. Slice 0b (yt-dlp) ist offen. Der Rest liegt
> als Backlog in `TODO.md`.

### Slice 0 — Die Lücke schließen (sofort, blockiert durch nichts)

Das Einzige in diesem Plan, das ein Sicherheitsproblem ist.

- `CREDENTIALS_FILE`, `loadCredentialsFromDisk`, `getPinterestCredentials`,
  `cachedCredentials` und `fetchFromPinterestApi` aus `pinterest.ts` entfernen
- `COOKIE_PATH`, `hasFacebookCookies` und den `--cookies`-Zweig aus
  `facebook.ts` entfernen
- `data/pinterest-credentials.json` und `data/facebook-cookies.txt` in
  `.gitignore`
- Best-effort-Löschung beim Start, analog zu `removeLegacyCookidooFiles()`
  (`cookidoo.ts:39-48`, aufgerufen aus `platforms.ts:17,29,56,73,103`) — eine
  vergessene Datei auf einem Volume soll verschwinden, nicht liegen bleiben

~15 Zeilen netto Löschung.

### Slice 0a — Ehrlich scheitern statt Müll importieren

- Guard durch eine **Host-Denylist** ersetzen (`pinterest.*`, `pinimg.com`),
  an **allen drei** Stellen; zusätzlich Asset-Endungen (`.mjs`, `.js`, `.css`,
  `.json`) und Nicht-HTTP-Schemata ausschließen
- `__PWS_DATA__`-Muster um die Script-Tag-Form ergänzen
- Ohne verwertbaren Originallink oder Text: **Fehler werfen** —
  „Pinterest liefert ohne Anmeldung keine Pin-Daten mehr. Bitte den verlinkten
  Artikel direkt importieren."
- Tests in `test/unit/pinterest.test.ts`: CDN-URL abgelehnt (alle drei
  Codepfade), Script-Tag-Form geparst, leeres Ergebnis wirft

### Slice 0b — yt-dlp-Realität herstellen

- Lokal `pip3 install --upgrade yt-dlp`, **danach** Facebook neu bewerten
- `scripts/ytdlp-health-check.ts` um Facebook und Pinterest erweitern, als
  npm-Script `ytdlp:health`, in den Nightly-CI-Lauf

### Slice 0c — Den Zustand dokumentieren

ADR in `Projekte/RecipeDeck/Entscheidungen.md`: die `501`-Routen sind kein
Halbzustand mehr, sondern eine Entscheidung mit Begründung. Roadmap in
`CLAUDE.md` und `docs/CODEMAPS/FETCHERS.md` nachziehen.

**Nach Slice 0–0c ist der Halbzustand beendet.** Aufwand: ein halber Tag.

---

## Optional: der Credential-Stack

Nur bauen, wenn die Messung unten trägt. Bis dahin ist der Zielzustand
„dokumentiert eingestellt", nicht „gleich kommt der Umbau".

### Vorgelagerte Messung (10 Minuten, braucht einen Pinterest-Developer-Account)

Gibt `GET https://api.pinterest.com/v5/pins/{id}` mit einem echten Token auch
**fremde** öffentliche Pins heraus, oder nur eigene? Die v5-API ist auf Pins
ausgelegt, auf die der Account Zugriff hat. Fällt das durch, ist der gesamte
Credential-Aufbau für den eigentlichen Anwendungsfall wertlos.

Ein Pin trägt außerdem selten das Rezept selbst — er verlinkt auf eine
Rezeptseite, die der generische Web-Fetcher bereits beherrscht. Der ganze
Aufbau kauft im Kern **ein Feld**: die `link`-Property.

### Entscheidung B — ENTSCHIEDEN am 2026-08-07: verschlüsselt at rest

Facebook-Cookies sind eine vollwertige Session — wer sie hat, ist eingeloggt.
`cookidoo_credentials.password` liegt heute im Klartext.

**Entscheidung: Credentials werden verschlüsselt gespeichert, und Cookidoo
wandert im selben Zug mit.** Kein Klartext-Credential bleibt in der Datenbank
zurück.

Begründung: Ein Datenbank-Dump — Backup, Fehlkonfiguration, kompromittierter
Pooler — ist bei Klartext gleichbedeutend mit der Übernahme fremder
Facebook-Accounts. Das ist der eine Datenverlust, der sich nicht reparieren
lässt. Der Aufwand ist ein halber Tag, und da ohnehin eine Tabelle angefasst
wird, ist der Grenzaufwand für Cookidoo nahe null.

Verworfen:
- *Klartext wie bisher* — konsistent, aber ein DB-Leak wird zur Account-Übernahme
- *Cookies nur im Client, pro Job mitgeschickt* — sicher, aber der Nutzer müsste
  sie bei jedem Import erneut einfügen, und sie landeten im Request-Body und
  potenziell in Logs
- *Facebook einstellen* — nicht gewünscht

### Slice E — Verschlüsselung (Voraussetzung für Slice 1)

- `CREDENTIAL_ENCRYPTION_KEY` als Env-Variable (32 Byte, base64), **nicht** in
  der Datenbank. In Northflank als Runtime-Secret, lokal in `.env`,
  in `.env.example` dokumentiert.
- AES-256-GCM über `node:crypto`, keine neue Dependency. Format
  `v1:<iv>:<authTag>:<ciphertext>`, versioniert für spätere Rotation.
- Ein Modul `src/credential-crypto.ts` mit `encryptCredential` /
  `decryptCredential`. **Einzige** Stelle, die den Key liest.
- Migration: bestehende `cookidoo_credentials`-Zeilen einmalig verschlüsseln.
  Idempotent — am `v1:`-Präfix erkennbar, was schon verschlüsselt ist.
- Fehlender Key beim Start: **fail fast** mit klarer Meldung, nicht stillschweigend
  auf Klartext zurückfallen.
- Tests: Round-Trip, manipuliertes `authTag` wirft, Migration ist idempotent,
  fehlender Key wirft beim Start.

> **Betriebsrisiko, das benannt gehört:** Geht der Key verloren, sind alle
> gespeicherten Credentials unbrauchbar. Das ist kein Datenverlust im engeren
> Sinn — die Nutzer tragen ihre Credentials neu ein — aber es gehört ins
> Runbook und der Key gehört in denselben Secret-Speicher wie `BREVO_API_KEY`.

**ToS-Hinweis:** Es geht um den eigenen Account des Nutzers. Automatisiertes
Abrufen verstößt trotzdem gegen die Facebook-ToS, und Facebook sperrt Accounts,
die auffallen. Der Code loggt die Warnung bereits (`facebook.ts:255`); sie
gehört zusätzlich sichtbar in die UI.

### Slice 1 — **Eine** Credential-Tabelle

Die erste Fassung wollte eine neue generische Tabelle **neben**
`cookidoo_credentials`. Das wäre halb-DRY: zwei Formen für dasselbe Problem,
und der nächste Connector muss raten. Stattdessen `cookidoo_credentials` um
eine `platform`-Spalte erweitern, bestehende Zeilen auf `'cookidoo'` migrieren,
Tabelle umbenennen. Unique-Indizes werden `(platform, user_id)` bzw.
`(platform, household_id)`.

Aus der Review zusätzlich:
- FK `user_id → auth.users(id) on delete cascade` — fehlt heute auch bei
  `cookidoo_credentials`; ein gelöschter Nutzer hinterlässt sonst
  Klartext-Credentials
- `created_by`-Index mitnehmen (existiert bei Cookidoo als
  `cookidoo_credentials_created_by_idx`)
- `enable row level security` + `revoke all … from anon, authenticated`

> **Was das Deny-all wirklich ist.** Der Server verbindet über `DATABASE_URL`
> als Rolle `postgres` (`.env.example:41`) und **umgeht RLS**. Das
> Cookidoo-„Hardening" (`20260619113000_…`) ist RLS-aktiviert **ohne Policies**
> plus Revoke — also ein Deny-all für die PostgREST-Data-API, kein
> Per-User-Scoping. Für Credentials ist das genau richtig, aber es darf nicht
> als „RLS scopet pro Nutzer" beschrieben werden. Die Grenze, die zählt, ist
> die Server-API.
>
> Folglich ist „Nutzer A sieht die Credentials von B nicht" **kein** taugliches
> rls-smoke-Kriterium — beide sehen nichts, der Test bestünde vakuum. Die
> Owner-Grenze gehört in einen **Server-Contract-Test mit zwei echten Tokens**.

### Slice 2 — Resolver und Routen

`savePlatformCredentials`, `deletePlatformCredentials`,
`resolvePlatformCredentials`, `getPlatformStatus`, Share/Unshare — gebaut wie
die Cookidoo-Funktionen, mit `platform` als erstem Parameter. Cookidoo-Aufrufer
auf die neue Signatur umstellen.

Die `501`-Stubs in `routes/platforms.ts` ersetzen. Beim Speichern
**validieren**: Pinterest-Token gegen einen API-Ping, Facebook-Cookies auf
Netscape-Format und Anwesenheit von `c_user`/`xs`. Ungültiges nicht persistieren.

### Slice 3 — Fetcher auf den Auth-Kontext

**Zuerst die Kontextform festlegen** — die erste Fassung erfand einen Typnamen,
ohne die Form zu entscheiden. Es gibt drei bestehende Shapes:

| Typ | userId | memberships | activeHouseholdId |
|---|---|---|---|
| `RecipeAuthContext` (`db-react.ts:61`) | ✓ | ✓ | ✗ |
| `CookidooAuthContext` (`db-react.ts:1667`) | ✓ | ✓ | ✓ |
| `PipelineOptions` (`pipeline.ts:30`) | ✓ | ✗ | ✓ |

`pipeline.ts:85-89` baut den Cookidoo-Kontext mit **`memberships: []`**
hardcoded. Das geht nur gut, weil `resolveCookidooCredentials` ausschließlich
`userId` und `activeHouseholdId` liest.

**Entscheidung: `resolvePlatformCredentials` darf `memberships` nicht
benutzen.** Sonst liefert der Vordergrundpfad (`GET /status`) eine Credential
und der Hintergrundpfad `null` — Settings zeigt „verbunden", der Import sagt
„keine Credentials". Auflösung strikt `user → activeHousehold → null`. Wenn
Memberships-Fallback gewünscht ist, muss `PipelineOptions` sie mitschleppen —
dann in einem eigenen Slice, bewusst.

Weiter: prozessweiten Cache streichen, Cookie-Datei pro Job in ein
Temp-Verzeichnis und im `finally` löschen, `pipeline.ts` reicht den Kontext
durch.

### Slice 4 — Mobile-UI

Zwei Abschnitte in `settings.tsx` analog zum Cookidoo-Block, mit Status-Badge,
Trennen, Household-Freigabe für Owner — und für Facebook einem sichtbaren
ToS-/Sperrrisiko-Hinweis.

---

## Ausdrücklich nicht im Scope

- **Die Disk-Helfer aus `8f57b08` zurückholen.** Sie waren die globale Variante.
- **Eine zweite Credential-Tabelle** neben `cookidoo_credentials`.
- **Slice 1–4 vor der Messung.** Zehn Minuten sparen mehrere Stunden.
- **Facebook und Pinterest in einem PR.** Nach Slice 1 zwei unabhängige Stränge
  mit sehr unterschiedlichem Risiko.

## Aufwand

| Teil | Umfang |
|---|---|
| Slice 0 + 0a + 0b + 0c | **~4 h, der realistische Zielzustand** |
| Slice E (Verschlüsselung inkl. Cookidoo) | ~4 h, entschieden, unabhängig von Pinterest |
| Messung Pinterest | 10 min Messung — Vorlauf siehe unten |
| Slice 1–4 (nur falls Messung trägt) | ~10 h |

**Slice E steht nicht unter dem Pinterest-Vorbehalt.** Die Verschlüsselung
lohnt sich allein wegen `cookidoo_credentials.password` und kann direkt nach
Slice 0 laufen, auch wenn Pinterest und Facebook nie kommen.

### Vorlauf für die Pinterest-Messung

Die zehn Minuten gelten für die Messung selbst, nicht für den Zugang. Nötig ist:

1. Ein Pinterest-**Business**-Account (kostenlos, ein privater lässt sich umstellen)
2. Eine App auf `developers.pinterest.com` → `client_id` / `client_secret`
3. Das ergibt **Trial access**: niedrigere Rate-Limits, und erzeugte Pins/Boards
   sind Sandbox-Objekte, die nur der Ersteller sieht
4. Für echten Betrieb **Standard access** — Antrag mit **Video-Aufnahme** der
   App im OAuth-Flow, den Pinterest prüft

Ob `GET /v5/pins/{id}` fremde öffentliche Pins herausgibt, steht in der
Dokumentation **nicht** — genau deshalb die Messung. Der Review-Vorbehalt
verschärft sich dadurch: selbst bei erfolgreicher Messung unter Trial access
steht zwischen uns und der Produktion ein Pinterest-Review mit Videonachweis.

## Verwandte Dokumente

- [Master-Plan](2026-08-07-connectors-and-job-persistence-master-plan.md)
- [Job-Persistenz](2026-08-07-job-persistence-plan.md)
- `src/fetchers/CLAUDE.md` — das Cookidoo-Muster
- `supabase/migrations/20260615170413_…` und `20260619113000_…`
