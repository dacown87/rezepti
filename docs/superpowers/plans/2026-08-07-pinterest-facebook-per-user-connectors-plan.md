# Plan: Pinterest- und Facebook-Connectors mit Per-User-Credentials

**Stand:** 2026-08-07 · **Status:** ENTWURF, wartet auf zwei Entscheidungen
**Ziel:** Jeder Nutzer hinterlegt seine eigenen Pinterest-/Facebook-Credentials,
und der Import aus beiden Quellen funktioniert wieder.

---

## Warum der Zustand so ist

Beide Connectors waren einmal implementiert (`68d89f6` Pinterest, `088d4ac` +
`2621f92` Facebook). Am 2026-06-09 hat `a6614e7` sie im Zuge der
Multi-User-Umstellung auf `501` gesetzt — zu Recht: beide legten **einen
globalen Credential-Satz** auf Disk ab (`data/pinterest-credentials.json`,
`data/facebook-cookies.txt`). In einer Mehrbenutzer-App hätte jeder Nutzer mit
dem Account eines anderen importiert. Am 2026-08-07 hat `8f57b08` die
verwaisten Disk-Helfer entfernt.

Die Fetcher selbst wurden nie deaktiviert — `pipeline.ts` ruft `fetchPinterest`
und `fetchFacebook` weiterhin auf. Sie laufen also, nur ohne Credentials.

Cookidoo hat denselben Weg schon hinter sich (globale Datei → scoped
Postgres-Zeilen mit RLS, 2026-06-15). **Dieses Muster wird hier kopiert**, nicht
neu erfunden.

---

## Messung statt Vermutung: was heute wirklich passiert

Alles unten wurde am 2026-08-07 gegen die Live-Seiten gemessen, nicht aus dem
Code abgeleitet.

### Pinterest: anonymes Scraping ist tot

Zwei echte Pins abgerufen (`/pin/1055599405112143/`, `/pin/61713443933/`):

| Messung | Ergebnis |
|---|---|
| HTTP-Status | 200 |
| HTML-Größe | ~1,08 MB — für **beide** Pins nahezu identisch (App-Shell, nicht Pin-Inhalt) |
| `og:title`, `og:description`, `og:image` | **komplett abwesend** |
| `"link":"…"` im HTML | nicht vorhanden |
| `__PWS_DATA__`-Payload | 80 KB, enthält `context`, `experiments`, `routeTree` — **keine Pin-Daten**. Kein `grid_title`, kein `seo_description`, kein `link`, kein `rich_metadata` |
| `yt-dlp` auf den Pin | `ERROR: Unable to download JSON metadata: HTTP Error 403: Forbidden` |

Pinterest rendert Pin-Inhalte für anonyme Besucher vollständig client-seitig.
**Es gibt keinen Scraping-Pfad mehr, der repariert werden könnte.** Die
Vermutung „jeder Nutzer braucht eigene Credentials" ist damit nicht nur
sauberer, sondern die einzige Option.

### Pinterest: zwei echte Bugs, unabhängig von Credentials

**Bug 1 — der Fetcher liefert aktuell Müll statt eines Fehlers.**
`fetchPinterest` gibt für beide Test-Pins zurück:

```
url:         https://s.pinimg.com/webapp/www/_/_/accessibility-be939e6aa4c84056.mjs
type:        web
textContent: (self.modernJsonp=self.modernJsonp||[]).push([[25550],{868529(e,t,n){…
             — 6000 Zeichen minifiziertes JavaScript
```

`findOriginalUrl` prüft Kandidaten mit `!url.includes("pinterest.")`.
`s.pinimg.com` enthält diese Zeichenkette nicht, rutscht also durch — und
`fetchWeb()` lädt anschließend ein JS-Bundle, das als Rezepttext ins LLM geht.
Ein Import „gelingt" damit scheinbar und produziert Unsinn, statt ehrlich zu
scheitern.

**Bug 2 — das `__PWS_DATA__`-Muster passt nicht mehr zum Markup.**
Der Fetcher sucht die Zuweisungsform:

```js
/__PWS_(?:DATA|INITIAL_PROPS)__\s*=\s*(\{.+?\})(?:\s*;|\s*<)/s
```

Ausgeliefert wird heute aber ein JSON-Script-Tag:

```html
<script id="__PWS_DATA__" type="application/json">{…}</script>
```

Der Zweig ist also seit einer Pinterest-Frontend-Änderung wirkungslos. (Selbst
mit korrigiertem Muster liefert er anonym nichts — siehe Tabelle oben —, aber
authentifiziert könnte er wieder tragen.)

### Facebook: Versionsproblem, nicht zwingend Codeproblem

| Messung | Ergebnis |
|---|---|
| `yt-dlp` auf diesem Rechner | **2024.04.09** |
| aktuelle Release (PyPI) | **2026.7.4** |
| Dockerfile | `pip3 install --upgrade yt-dlp` → Production zieht beim Build die aktuelle Version |

Der Entwicklungsrechner läuft mit einem über zwei Jahre alten Binary.
Facebook ist der versionsempfindlichste Extractor überhaupt.
**Vor jeder Codeänderung an `facebook.ts` muss lokal aktualisiert werden**,
sonst debuggt man die falsche Sache. `docs/PROJECT_LEARNINGS.md` führt
„yt-dlp veraltet" bereits als wiederkehrende Ursache.

`scripts/ytdlp-health-check.ts` existiert, testet aber nur YouTube, Instagram
und TikTok — **weder Facebook noch Pinterest** — und ist an kein npm-Script und
keinen CI-Job angeschlossen.

---

## Zwei Entscheidungen, die vor der Umsetzung fallen müssen

### Entscheidung A — Pinterest: welcher Credential-Typ?

Der bestehende Code erwartet `clientId`, `clientSecret`, `accessToken`,
`refreshToken` und ruft `GET https://api.pinterest.com/v5/pins/{id}`.

Das ist unbequem: Pinterest v5 gibt über diesen Endpunkt regulär nur Pins
zurück, auf die der authentifizierte Account **Zugriff hat** — typischerweise
eigene Pins und eigene Boards. Für einen beliebigen fremden Pin, den jemand
importieren will, ist mit `404`/`403` zu rechnen.

**Das muss verifiziert werden, bevor der Credential-Stack darauf gebaut wird.**
Ein Wegwerf-Skript mit einem echten Token gegen (a) einen eigenen Pin, (b) einen
fremden öffentlichen Pin beantwortet das in zehn Minuten. Fällt (b) durch, ist
der API-Weg für den eigentlichen Anwendungsfall wertlos und es bleiben:

| Option | Aufwand | Nutzen |
|---|---|---|
| **A1 — OAuth-App pro Nutzer** (jeder legt eine eigene Pinterest-App an, trägt Client-ID/Secret ein, wir machen den OAuth-Flow) | hoch: OAuth-Redirect, Token-Refresh, Onboarding-Doku | funktioniert nur, wenn (b) klappt |
| **A2 — eine RecipeDeck-App, Nutzer autorisiert sich** (Standard-OAuth, wir halten Client-ID/Secret serverseitig) | mittel + **Pinterest App Review** für Production-Scopes | bester UX, externe Abhängigkeit mit unklarer Dauer |
| **A3 — Session-Cookies wie bei Cookidoo** (Nutzer hinterlegt `_pinterest_sess`) | niedrig | juristisch/ToS grenzwertig, Cookies laufen ab, brüchig |
| **A4 — Pinterest fallen lassen** und stattdessen den Nutzer den Ziel-Link importieren lassen | null | Rezepte auf Pinterest sind fast immer nur Verlinkungen auf echte Rezeptseiten, die wir schon können |

> **Meine Empfehlung: erst (b) messen, dann entscheiden — und A4 ernsthaft
> gegen A2 abwägen.** Ein Pinterest-Pin trägt selten das Rezept selbst; er
> verlinkt auf eine Rezeptseite, die der generische Web-Fetcher bereits
> beherrscht. Der ganze Credential-Aufbau kauft im Kern eine Zeile: die
> `link`-Property des Pins. Wenn A2 an einem App-Review hängt, ist A4 plus ein
> guter Fehlertext („Öffne den Pin und importiere den verlinkten Artikel")
> möglicherweise das bessere Produkt.

### Entscheidung B — Facebook: Session-Cookies serverseitig speichern?

Der Facebook-Pfad braucht `--cookies` für yt-dlp. Diese Cookies sind eine
**vollwertige Facebook-Session** — wer sie hat, ist eingeloggt. Das ist eine
andere Risikoklasse als ein Cookidoo-Passwort.

Verschärfend: `cookidoo_credentials.password` liegt heute **im Klartext** in der
Datenbank. Das gleiche Muster für Facebook-Cookies zu übernehmen, heißt
Klartext-Sessionschlüssel in Postgres.

| Option | Bewertung |
|---|---|
| **B1 — wie Cookidoo, Klartext + RLS** | konsistent, aber ein DB-Leak wird zur Account-Übernahme |
| **B2 — verschlüsselt at rest** (`pgcrypto` oder App-seitig mit einem Key aus der Env) | deutlich besser, ~einen halben Tag Mehraufwand, sollte dann auch für Cookidoo gelten |
| **B3 — Cookies bleiben auf dem Client**, werden pro Job mitgeschickt und nie persistiert | am sichersten, aber der Nutzer muss sie bei jedem Import einfügen |
| **B4 — Facebook fallen lassen** | Facebook verbietet automatisiertes Scraping in den ToS; der Code loggt diese Warnung heute schon bei jedem Aufruf |

> **Meine Empfehlung: B2**, und dann Cookidoo im selben Zug mitnehmen. Wenn das
> zu viel ist: B3 für Facebook, weil es die Speicherfrage ganz vermeidet.
> B1 würde ich nicht wählen — nicht weil es heute weh tut, sondern weil ein
> Klartext-Session-Cookie das eine Datum ist, dessen Verlust nicht reparabel ist.

**Hinweis zu den ToS:** Es geht hier um den eigenen Account des Nutzers und den
eigenen Gebrauch. Trotzdem verstößt automatisiertes Abrufen gegen die
Facebook-ToS, und Facebook sperrt Accounts, die auffällig werden. Das ist eine
Entscheidung, die der Betreiber bewusst treffen sollte — der Code trägt die
Warnung bereits, sie gehört zusätzlich in die UI.

---

## Umsetzung in Slices

Slice 0 ist unabhängig von beiden Entscheidungen und sollte sofort laufen.
Slice 1–5 setzen Entscheidung A und B voraus.

### Slice 0 — Ehrliches Scheitern statt Müll (sofort, klein)

Das Wichtigste zuerst, weil es heute aktiv Schaden anrichtet: ein
Pinterest-Import produziert ein Rezept aus minifiziertem JavaScript.

- `findOriginalUrl`: Kandidaten gegen eine **Host-Denylist** prüfen statt gegen
  `includes("pinterest.")` — mindestens `pinterest.*`, `pinimg.com`,
  `s.pinimg.com`. Zusätzlich Endungen wie `.mjs`, `.js`, `.css`, `.json`
  ausschließen und nur `http(s)`-Schemata zulassen.
- Den Body-Text-Regex-Fallback (Strategie 4) entfernen. Er kann per Konstruktion
  keinen verlässlichen Treffer liefern und ist die Quelle des CDN-Treffers.
- `__PWS_DATA__`-Muster um die Script-Tag-Form ergänzen.
- Wenn am Ende weder Originallink noch verwertbarer Text vorliegt: **Fehler
  werfen** mit deutschem Klartext („Pinterest liefert ohne Anmeldung keine
  Pin-Daten mehr. Bitte den verlinkten Artikel direkt importieren."), statt ein
  leeres Bundle zurückzugeben.
- Tests in `test/unit/pinterest.test.ts`: CDN-URL wird abgelehnt, Script-Tag-Form
  wird geparst, leeres Ergebnis wirft.

**Ergebnis:** Pinterest funktioniert danach immer noch nicht — scheitert aber
sichtbar und richtig, statt still Unsinn zu speichern.

### Slice 0b — yt-dlp-Realität herstellen (sofort, klein)

- Lokal `pip3 install --upgrade yt-dlp` (2024.04.09 → 2026.7.4) und den
  Facebook-Pfad **danach erneut** bewerten. Gut möglich, dass ein Teil der
  „Facebook geht nicht"-Symptome allein davon kommt.
- `scripts/ytdlp-health-check.ts` um Facebook und Pinterest erweitern.
- Als npm-Script `ytdlp:health` verfügbar machen und in den Nightly-CI-Lauf
  hängen — Extractor-Bruch soll auffallen, bevor ein Nutzer ihn meldet.

### Slice 1 — Generische Connector-Credentials in Postgres

Cookidoo hat eine dedizierte Tabelle. Für zwei weitere Connectors lohnt eine
generische:

```sql
create table public.platform_credentials (
  id            bigserial primary key,
  platform      text not null,             -- 'pinterest' | 'facebook'
  scope_type    text not null,             -- 'user' | 'household'
  user_id       uuid null,
  household_id  uuid null references public.households(id) on delete cascade,
  payload       text not null,             -- JSON, ggf. verschlüsselt (Entscheidung B)
  created_by    uuid not null,
  expires_at    timestamptz null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint platform_credentials_platform_check
    check (platform in ('pinterest', 'facebook')),
  constraint platform_credentials_scope_type_check
    check (scope_type in ('user', 'household')),
  constraint platform_credentials_scope_shape_check
    check (
      (scope_type = 'user'      and user_id is not null and household_id is null)
      or
      (scope_type = 'household' and user_id is null and household_id is not null)
    )
);

create unique index platform_credentials_user_uidx
  on public.platform_credentials (platform, user_id) where scope_type = 'user';
create unique index platform_credentials_household_uidx
  on public.platform_credentials (platform, household_id) where scope_type = 'household';
```

Dazu zwingend, analog zu `20260619113000_harden_cookidoo_credentials_store.sql`:

```sql
alter table public.platform_credentials enable row level security;
revoke all on table public.platform_credentials from anon, authenticated;
revoke all on sequence public.platform_credentials_id_seq from anon, authenticated;
```

- `src/schema.ts` nachziehen
- `scripts/supabase/rls-smoke.ts` erweitern: Nutzer A darf die Zeile von Nutzer B
  weder lesen noch schreiben
- **Cookidoo bleibt vorerst auf seiner eigenen Tabelle.** Eine Migration dorthin
  ist ein separater Slice und kein Teil dieser Arbeit.

### Slice 2 — Resolver und Routen

In `db-react.ts`, gebaut wie die Cookidoo-Funktionen:

```
savePlatformCredentials(platform, userId, payload)
deletePlatformCredentials(platform, userId)
resolvePlatformCredentials(platform, auth)      // Priorität user > household
getPlatformStatus(platform, auth)
sharePlatformCredentialsToHousehold(platform, auth)   // nur Household-Owner
deleteHouseholdPlatformShare(platform, auth)
```

In `routes/platforms.ts` die `501`-Stubs ersetzen:

| Route | Ersetzt durch |
|---|---|
| `GET /api/v1/pinterest/status` | `scope`, `connected`, `expiresAt`, `sharedByCurrentHousehold`, `canManageHouseholdShare` |
| `POST/DELETE /api/v1/pinterest/credentials` | private Credentials des Callers |
| `POST/DELETE /api/v1/facebook/cookies` | dito, Cookie-Datei als Text im Body |
| jeweils `…/share` | Household-Freigabe, owner-only |

Beim Speichern **validieren, nicht blind ablegen**: Pinterest-Token gegen einen
API-Ping prüfen, Facebook-Cookies auf Netscape-Format und Anwesenheit der
`c_user`/`xs`-Cookies. Ungültiges gar nicht erst persistieren.

`CLAUDE.md` (Endpoint-Tabelle **und** Route Auth Inventory) im selben PR
nachziehen — die Tabellen sind gerade frisch korrekt, das soll so bleiben.

### Slice 3 — Fetcher auf den Auth-Kontext umstellen

Genau das Muster, das `fetchCookidoo` schon nutzt:

```ts
export async function fetchPinterest(
  url: string,
  tempDir?: string,
  auth?: PlatformAuthContext,
): Promise<ContentBundle>
```

- Modul-globales `cachedCredentials` in `pinterest.ts` **ersatzlos streichen** —
  ein prozessweiter Cache über Nutzergrenzen hinweg ist in einer Multi-User-App
  genau der Fehler, den `a6614e7` beseitigt hat.
- `hasFacebookCookies()` und `COOKIE_PATH` in `facebook.ts` durch den Resolver
  ersetzen. Die Cookie-Datei pro Job in ein Temp-Verzeichnis schreiben, nach dem
  Job **löschen** (`finally`), nie nach `data/`.
- `pipeline.ts`: `case "pinterest"` und `case "facebook"` bekommen den Kontext
  durchgereicht — `case "cookidoo"` zeigt, wie.
- `routes/extraction.ts` / `job-manager.ts` snapshotten `activeHouseholdId`
  bereits; für die neuen Connectors gilt dieselbe Regel, sonst greift der
  Household-Fallback im Async-Pfad ins Leere.

### Slice 4 — Mobile-UI

In `mobile/app/(tabs)/settings.tsx` zwei Abschnitte analog zum Cookidoo-Block:

- **Pinterest** — Felder je nach Entscheidung A; bei OAuth ein
  „Mit Pinterest verbinden"-Button statt Textfeldern
- **Facebook** — mehrzeiliges Feld für die Cookie-Datei, plus eine
  Kurzanleitung, wie man sie exportiert
- Beide mit Status-Badge, „Trennen", und — falls Household-Owner — dem
  Freigabe-Schalter
- Für Facebook ein **sichtbarer Warnhinweis** in der UI: eigener Account,
  gegen die Facebook-ToS, Sperrrisiko

### Slice 5 — Roadmap-Wahrheit wiederherstellen

`CLAUDE.md`, `docs/CODEMAPS/FETCHERS.md` und die Obsidian-Notizen führen beide
Connectors derzeit korrekt als „faktisch tot". Sobald Slice 3 steht, muss das
zusammen mit dem Code aktualisiert werden — nicht später.

---

## Was ich nicht empfehle

- **Die Disk-Helfer aus `8f57b08` zurückholen.** Sie waren die globale Variante;
  `git revert` würde genau das Problem wiederherstellen, das die Abschaltung
  ausgelöst hat.
- **Slice 1–4 bauen, bevor Entscheidung A verifiziert ist.** Wenn der
  Pinterest-v5-Endpunkt fremde Pins nicht herausgibt, ist die halbe Arbeit für
  eine Funktion gebaut, die es nicht gibt. Die Messung kostet zehn Minuten.
- **Facebook und Pinterest in einem PR.** Sie teilen sich nur die Tabelle aus
  Slice 1. Danach sind es zwei unabhängige Stränge mit sehr unterschiedlichem
  Risiko.

## Reihenfolge

```
Slice 0  ─┐  unabhängig, sofort
Slice 0b ─┘

           Entscheidung A messen (10 min) ─┐
           Entscheidung B treffen ─────────┤
                                           ▼
                                        Slice 1  (Tabelle + RLS)
                                           │
                              ┌────────────┴────────────┐
                              ▼                         ▼
                     Slice 2/3 Pinterest        Slice 2/3 Facebook
                              │                         │
                              └────────────┬────────────┘
                                           ▼
                                    Slice 4 (UI) → Slice 5 (Doku)
```

## Aufwandsschätzung

| Slice | Umfang |
|---|---|
| 0 | ~1 h, klein und risikoarm |
| 0b | ~1 h, davon das meiste Warten auf yt-dlp-Läufe |
| 1 | ~2 h inkl. RLS-Smoke |
| 2 | ~3 h für beide Plattformen |
| 3 | ~3 h, plus ungewisse Zeit für die tatsächliche Extraktionsqualität |
| 4 | ~3 h inkl. Tests |
| 5 | ~30 min |

Die Schätzung gilt für den mechanischen Teil. **Nicht enthalten** ist die
eigentliche Unbekannte: ob Pinterest über die API brauchbare Rezeptdaten
herausgibt und wie lange ein Facebook-Cookie-Satz in der Praxis hält.
