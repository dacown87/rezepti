# Detailplan: SSRF-Härtung ausgehender Abrufe (Paket S)

> **Status: Detailplan — wartet auf Freigabe.** Kein Code, bevor der Betreiber die Entscheidungen am Ende bestätigt hat.

Stand: 2026-10-09. Grobplan: [2026-10-07-grob-ssrf-haertung.md](2026-10-07-grob-ssrf-haertung.md). Bezug: [TODO.md](../../../TODO.md) („Vor dem oeffentlichen Start“, Punkt SSRF). Herkunft: Nebenbefunde aus dem [DM-Plan](2026-10-07-paket-dm-datenminimierung-detailplan.md). Rahmen: keine schweren lokalen Läufe (nur `npx tsc` und gezielte Vitest-Dateien lokal, `mobile:release-gate` in CI).

**Wirkung der Reduzierung vom 2026-10-09:** DM-3 (Bild-Speicherung) und DM-3b (Proxy-Allowlist) sind gestrichen. Paket S hängt deshalb an nichts mehr und blockiert nichts mehr außer dem öffentlichen Start. Eine Host-Allowlist für den Proxy gibt es nicht (der PDF-Export braucht beliebige Bildhosts); der Guard ist die Schutzmaßnahme.

---

## 1. Befunde (am Code bestätigt, 2026-10-09)

| # | Befund | Stelle | Ausnutzbar durch |
|---|---|---|---|
| 1 | **Proxy ohne Auth, schwacher Guard:** nur Regex auf den Hostnamen-String (kein DNS, keine Sonderformen wie `0.0.0.0`, `100.64/10`, IPv4-mapped IPv6, Dezimal-/Hex-IPs), `fetch` folgt Weiterleitungen **ungeprüft**, Größenprüfung erst nach komplettem Download (`arrayBuffer()`), `Cache-Control: public` | `src/routes/platforms.ts:147-202` | **jeder Anonyme** (SSRF-Relay, Bandbreite) |
| 2 | **Import-URL: keine Adressprüfung.** `POST /extract/react` prüft nur `new URL(url)` (akzeptiert `file:`, `ftp:`, `http://127.0.0.1`, Credentials in der URL) | `src/routes/extraction.ts:94-110` | jeder angemeldete Nutzer, bei offener Registrierung jeder |
| 3 | **Classifier ist nicht auf den Hostnamen verankert:** `/instagram\.com\//i` trifft auch `http://10.0.0.5/x?u=instagram.com/`. Dadurch landet **jede** beliebige URL bei einem Plattform-Fetcher; YouTube/TikTok/Instagram/Facebook/Pinterest geben sie an **`yt-dlp`** (externer Prozess, folgt eigenen Weiterleitungen und kennt viele Extraktoren) | `src/classifier.ts:3-11`; `src/fetchers/{youtube,tiktok,instagram,facebook,pinterest}.ts` | wie 2 |
| 4 | **Web-Fetcher und andere Abrufe folgen Weiterleitungen** ohne Prüfung: `web/index.ts:17-23`, `chefkoch.ts:104-110`, `pinterest.ts:77-83`, `cookidoo.ts:269-279` und `:528-533`, `instagram.ts:139`/`:184`, `facebook.ts:214` | siehe links | wie 2 |
| 5 | **Cobalt-Medien-URLs** (`downloadFirstCobaltMedia`) werden ohne Prüfung geladen | `src/fetchers/cobalt.ts:104` | indirekt (nur wenn Cobalt aktiv ist; offen laut TODO) |
| 6 | Die Antwort des Imports zeigt Teile des abgerufenen Inhalts (Rezepttext, Fehlermeldungen) → **Antwort-basierte SSRF** möglich (Inhalt interner Seiten als „Rezept“), nicht nur blind | Pipeline | wie 2 |

**Interne Ziele, die erreichbar bleiben müssen:** `CF_SCRAPER_URL` (Cookidoo, Default `http://localhost:3001`) und die Cobalt-API-URL aus der Konfiguration. Diese Aufrufe haben **feste, vom Betreiber gesetzte** URLs und laufen **nicht** durch den neuen Guard. Der Guard gilt nur für Abrufe, deren Ziel ein Nutzer beeinflusst. Damit braucht es keine Allowlist-Ausnahmen.

**Schweregrad:** hoch, sobald die Registrierung offen ist (Metadaten-Endpunkte, interne Dienste, Northflank-Netz). Heute durch geschlossene Registrierung gemildert, **Befund 1 ist es nicht** (kein Login nötig).

---

## 2. Design

### 2.1 `src/utils/ip-guard.ts`
- `isPublicAddress(ip: string): boolean` mit `node:net` `BlockList` (keine neue Abhängigkeit): `0.0.0.0/8`, `10.0.0.0/8`, `100.64.0.0/10`, `127.0.0.0/8`, `169.254.0.0/16`, `172.16.0.0/12`, `192.0.0.0/24`, `192.0.2.0/24`, `192.168.0.0/16`, `198.18.0.0/15`, `198.51.100.0/24`, `203.0.113.0/24`, `224.0.0.0/4`, `240.0.0.0/4`; IPv6: `::/128`, `::1/128`, `fc00::/7`, `fe80::/10`, `ff00::/8`, `2001:db8::/32`, **IPv4-mapped (`::ffff:0:0/96`) auf die eingebettete IPv4 zurückführen und dort prüfen**, ebenso `64:ff9b::/96` (NAT64).
- Alles, was `net.isIP` nicht als gültige IP erkennt, ist **nicht** öffentlich.

### 2.2 `src/utils/safe-fetch.ts`
- Basis: **`undici`** (steht bereits als direkte Abhängigkeit, `^7.25.0`). `safeFetch(url, init?)` erstellt pro Aufruf einen `Agent` mit eigener `connect.lookup`, die **jede** aufgelöste Adresse mit `isPublicAddress` prüft und sonst mit einem Fehler (`SsrfBlockedError`) abbricht. Der Check läuft **beim Verbindungsaufbau jedes Hops**. Damit sind DNS-Rebinding (Zeitfenster zwischen Prüfung und Verbindung) und Weiterleitungen auf interne Adressen abgedeckt, ohne dass die Prüfung vor dem Fetch dupliziert werden muss.
- Zusätzlich vorab `assertSafeUrl(url)`: nur `http:`/`https:`; keine Credentials (`user:pass@`); Port nur 80/443 (Entscheidung 3); IP-Literale direkt gegen `isPublicAddress`; Hostname `localhost`, `*.localhost`, `*.internal`, `*.local`, `metadata.google.internal` sofort ablehnen (billige erste Schranke und bessere Fehlermeldung).
- `redirect: "manual"`, höchstens 5 Hops, **jeder Hop** durchläuft `assertSafeUrl`; Weiterleitung von `https:` auf `http:` ablehnen.
- Timeout (Default 15 s, pro Aufruf überschreibbar), Body-Größenlimit per Stream-Abbruch (Default 5 MB; Proxy 5 MB, Web-Fetcher 3 MB, anpassbar).
- Rückgabe: ein `Response`-kompatibles Objekt, damit die vorhandenen `response.text()`/`response.json()`/`headers`-Aufrufe der Fetcher unverändert bleiben. Fehler: `SsrfBlockedError` (Klasse, ohne Zieladresse in der Nutzermeldung).
- Logging: nur Host und Blockgrund, keine volle URL und keine IP-Auflösung in Nutzerantworten.

### 2.3 `validateImportUrl` (Einstieg)
- Neue Funktion neben dem Guard, **vor** `classifyURL` und vor der Job-Erstellung in allen URL-Pfaden (`extraction.ts:94-110`): `assertSafeUrl`, danach `400` mit deutscher Meldung („Diese Adresse kann nicht importiert werden.“), ohne Detailgrund.
- Das ist die frühe Schranke für **yt-dlp**, wo kein Node-Guard greift: Nur URLs, die den Syntax-Check bestehen **und** deren Hostname zu einer Plattform gehört (2.4), erreichen yt-dlp.

### 2.4 Classifier auf den Hostnamen verankern
- `classifyURL` bestimmt den Typ aus `new URL(url).hostname` (kleingeschrieben, ohne führendes `www.`/`m.`): exakter Treffer oder Suffix mit Punkt (`.youtube.com`, `youtu.be`, `.instagram.com`, `.tiktok.com`, `cookidoo.de`/`.cookidoo.de`, `chefkoch.de` zusätzlich Pfad `/rezepte/`, `.pinterest.com`/`.pinterest.de`/`pin.it`, `.facebook.com`/`fb.watch`, wenn es sie heute schon gibt; die Hostliste wird **aus den bestehenden Regexen und `test/unit/classifier.test.ts` abgeleitet**, nicht neu erfunden).
- Alles andere wird `web` (nur noch `safeFetch`, nie yt-dlp).
- yt-dlp-Aufrufe bekommen vor der URL ein `--`, damit eine URL nie als Option gelesen werden kann (Defense in depth; `new URL` verhindert führende `-` ohnehin).
- Risiko: Kurzlinks (`vm.tiktok.com`, `fb.watch`, `pin.it`, `youtu.be`) und `m.`-Varianten dürfen nicht regressieren → Testmatrix aus der bestehenden Testdatei übernehmen und ergänzen.

### 2.5 Umstellung der Abrufe
| Stelle | Änderung |
|---|---|
| `src/routes/platforms.ts` Proxy | `safeFetch`, Stream-Größenlimit (statt `arrayBuffer()`), `Cache-Control: private`, **`requireUserAuth()`** (Entscheidung 1), Magic-Bytes-Prüfung zusätzlich zum Content-Type |
| `src/fetchers/web/index.ts`, `chefkoch.ts`, `pinterest.ts`, `cookidoo.ts` (Nutzer-URL-Pfade `:269`, `:528`), `instagram.ts:139/:184`, `facebook.ts:214` | `fetch(url, …)` → `safeFetch(url, …)` |
| `src/fetchers/cobalt.ts:104` | `downloadFirstCobaltMedia` über `safeFetch` (die Cobalt-API-URL selbst bleibt unverändert) |
| `src/fetchers/cookidoo.ts` Login-Flow (`:107`, manueller Redirect-Folger) | **nicht ändern** (feste Vorwerk-/Cookidoo-Hosts); nur prüfen, dass kein Nutzer-String einfließt |
| `src/utils/image-search.ts`, `CF_SCRAPER_URL`, Supabase, Brevo, Groq | **nicht ändern** (feste URLs) |

### 2.6 Client
- `mobile/utils/pdf-export.web.ts:14-31`: `fetch(proxyUrl)` → `apiFetch` (Bearer). Native PDF-Export nutzt den Proxy nicht (bettet `image_url` direkt ein) und bleibt unberührt.
- Bildvorschläge (Chefkoch-Hotlinks) bleiben direkt (DM-3-light) und brauchen den Proxy nicht.

---

## 3. Schritte (zwei PRs)

### PR S1 — Proxy + Guard (sofort, weil ohne Login erreichbar)
1. `ip-guard.ts`, `safe-fetch.ts`, Tests.
2. Proxy umstellen und hinter `requireUserAuth()` legen; Client `pdf-export.web.ts` auf `apiFetch`.
3. Docs: CLAUDE.md (Endpunkt-Tabelle und Route Auth Inventory: Proxy „user-scoped, SSRF-guarded“; die Zeile „unauthenticated by design“ und die Notiz im Frontend-Teil entfernen), TODO.

### PR S2 — Import-Pfad
1. Classifier verankern, `validateImportUrl` an allen Einstiegen (URL-Extraktion; Cookidoo/Chefkoch laufen über denselben Einstieg), `--` bei yt-dlp.
2. Fetcher auf `safeFetch` umstellen (Tabelle 2.5).
3. Fehlerabbildung: `SsrfBlockedError` → `toUserFriendlyError` mit neutraler Meldung; Job schlägt fehl, kein Detail im Log über die Zieladresse.
4. Docs: CLAUDE.md (Route Auth Inventory „extraction jobs create“: SSRF-Guard), `docs/PROJECT_LEARNINGS.md` („Nutzer-URLs nie roh an `fetch`/`yt-dlp`“), `docs/CODEMAPS/BACKEND.md`.

## 4. Tests
- `test/unit/ip-guard.test.ts`: alle Bereiche je mit Beispiel (inkl. `0.0.0.0`, `100.64.0.1`, `169.254.169.254`, `::1`, `fd00::1`, `::ffff:127.0.0.1`, `::ffff:7f00:1`, `64:ff9b::7f00:1`, öffentliche `1.1.1.1`, `2606:4700:4700::1111`).
- `test/unit/safe-fetch.test.ts` (lokaler Test-HTTP-Server auf `127.0.0.1`; `lookup` gemockt): direkter IP-Literal-Treffer, Hostname → privat, Hostname → privat+öffentlich gemischt (blockiert), Weiterleitung auf privat, Weiterleitung `https`→`http`, Hop-Limit, Größenabbruch, Timeout, Credentials, Port ≠ 80/443, `file:`/`ftp:`.
- `test/unit/classifier.test.ts` erweitern: `http://10.0.0.5/?u=instagram.com/` → `web`; alle bisherigen Plattformvarianten unverändert.
- Route-Tests: Proxy 401 ohne Token, 400 bei interner URL, 200 bei Test-Bild (gemockt), Import mit `http://127.0.0.1`, `file:///etc/passwd`, `http://localhost:3001` → 400 ohne Job.
- Bestehende Proxy-Tests in `test/unit/cookidoo-credentials.test.ts` anpassen.
- `mobile/test`: Test des PDF-Exports mit `apiFetch`-Aufruf (falls vorhanden anpassen), danach `npm run test:mobile:rntl-guard`.
- Verifikation: `npx tsc` und `npm test -- --run --exclude="test/e2e/**"` komplett, ungepiped; `mobile:release-gate` nur in CI.

## 5. Akzeptanzkriterien
- Anonymer Aufruf von `/api/v1/proxy/image` → `401`.
- Weder Proxy noch Import erreichen Loopback, private, Link-local- oder Metadaten-Adressen, auch nicht über Hostnamen, Weiterleitungen oder IPv6-Sonderformen.
- `http://169.254.169.254/?x=instagram.com/` wird als `web` klassifiziert und scheitert am Guard, erreicht nie yt-dlp.
- Alle bisherigen Plattform-Importe (YouTube, TikTok, Instagram, Facebook, Chefkoch, Cookidoo, Pinterest-Link) funktionieren weiter (Testmatrix + manueller Smoke auf Staging, siehe [Test-Session](../../testing/manuelle-test-session.md)).
- PDF-Export mit Bild funktioniert im Web nach dem Wechsel auf `apiFetch`.

## 6. Risiken
- **Falsch-Positive bei legitimen Seiten** (Rezeptseiten auf nicht-Standard-Ports oder hinter IPv6-only-DNS) → Port-Entscheidung 3, Meldung klar, Log mit Host/Grund zum Nachschärfen.
- **yt-dlp bleibt eine Restfläche** (eigene Weiterleitungen/Extraktoren): Durch das Verankern auf Plattform-Hosts erreicht nur noch deren Hostname yt-dlp; ein Redirect dieser Plattformen auf interne Ziele ist unrealistisch. Zusätzliche Netzwerk-Egress-Regeln bei Northflank sind nicht verfügbar/geplant (Betreiber-Info, siehe Entscheidung 4).
- **`undici`-Agent pro Aufruf**: Verbindungs-Overhead leicht erhöht; bei Bedarf Agent pro Fetcher cachen (Lookup-Check bleibt).
- **Classifier-Regression bei Kurzlink-Varianten** → durch Testmatrix abgedeckt.
- **Antwort-basierte Ausnutzung** (Befund 6) wird durch den Guard geschlossen, nicht durch Antwortfilter.

## 7. Entscheidungen für den Betreiber
| # | Frage | Empfehlung |
|---|---|---|
| 1 | Proxy nur für Angemeldete (`requireUserAuth`) | **ja** — Login-first macht ihn ohnehin zur Pflicht; nur das Web-PDF nutzt ihn und kann den Header senden |
| 2 | Guard-Technik | **`undici`-Agent mit Connect-Time-Lookup** (deckt Rebinding und Redirects ab) statt Vorab-DNS-Check |
| 3 | Erlaubte Ports | **nur 80/443** (Rezeptseiten nutzen nichts anderes); Ausnahmen erst nach konkretem Fall |
| 4 | Reicht der Anwendungs-Guard oder zusätzlich Egress-Filter auf Netzebene bei Northflank | **Guard reicht für den Start**; Netzfilter prüfen, falls Northflank ihn anbietet (Betreiber, nicht blockierend) |
| 5 | Zwei PRs (S1 sofort, S2 danach) | **ja**, weil Befund 1 ohne Login ausnutzbar ist |
| 6 | Zeitpunkt | **vor allen anderen Paketen** (Schritt 1 der Reihenfolge) |

**Aufwand:** S1 S–M, S2 M.
