# Grobplan: SSRF-Haertung ausgehender Abrufe (Paket S)

> **Status: GROBPLAN — ausgearbeitet im [Detailplan](2026-10-09-paket-s-ssrf-haertung-detailplan.md) (2026-10-09, wartet auf Freigabe).** Kein Code, bevor der Detailplan freigegeben ist.

Stand: 2026-10-07. Herkunft: Nebenbefunde beim Ausarbeiten von [Detailplan DM](2026-10-07-paket-dm-datenminimierung-detailplan.md) (DM-3, Ist-Zustand Proxy und „Nicht Teil dieses Pakets"). Bezug: [TODO.md](../../../TODO.md) → „Nebenbefunde aus den Detailplaenen".

## Befunde (per Code-Lesen bzw. grep, noch nicht durch Test bestaetigt)
1. **`GET /api/v1/proxy/image`** (`src/routes/platforms.ts:147-202`, ohne Auth): Der Guard prueft nur den Hostnamen-String per Regex (ab Z. 159). Keine DNS-Aufloesung (Hostname, der auf eine private IP zeigt, kommt durch), keine IPv4-Sonderformen / IPv4-mapped-IPv6 / `100.64.0.0/10` / `0.0.0.0`, und `fetch` (Z. 179) **folgt Weiterleitungen ungeprueft** — eine Weiterleitung auf z. B. `http://169.254.169.254/` wuerde befolgt. Groessenpruefung erst nach vollstaendigem Download.
2. **Import-URLs** (`POST /api/v1/extract/react`, `requireUserAuth`): Per grep keine Pruefung auf private/interne Adressen gefunden (weder in `src/routes/extraction.ts` noch in `classifier.ts`/`pipeline.ts`). Der Web-Fetcher (`src/fetchers/web/index.ts:17-23`, `redirect: "follow"`) und die Fetcher fuer Chefkoch (`chefkoch.ts:104-110`), Pinterest (`pinterest.ts:77-83`), Cookidoo (`cookidoo.ts:269-279`, `:528-533`), Instagram (`instagram.ts:139`, `:184`) und Facebook (`facebook.ts:214`) rufen die vom Nutzer gelieferte URL bzw. Weiterleitungen ohne Adresspruefung ab. Mit Login nutzbar → bei offener Registrierung fuer jeden. **Zuerst bestaetigen** (z. B. Unit-Test mit `http://127.0.0.1:…` gegen die Route), ob irgendwo doch ein Filter greift.
3. **yt-dlp-Pfade** (YouTube/TikTok/Instagram/Facebook) rufen URLs ueber einen externen Prozess ab — dort greift ein Node-Guard nicht; pruefen, ob der Classifier nur die erwarteten Hosts an yt-dlp gibt.
4. Interne Ziele, die bewusst erreichbar bleiben muessen: `CF_SCRAPER_URL` (Cookidoo, Default `http://localhost:3001`) und Cobalt — Allowlist statt Blockade.

## Grober Umfang
1. Zentrales Modul `src/utils/safe-fetch.ts` (Grundlage fuer das in DM-3 geplante `safeFetchImage`): nur `http(s)`, DNS-Aufloesung und Pruefung **jeder** Adresse (`isPublicAddress`: private, Loopback, Link-local, CGNAT, `0.0.0.0/8`, Multicast, IPv6-ULA/Link-local, IPv4-mapped), `redirect: "manual"` mit max. N Hops und Pruefung jedes Ziels, Timeout, Groessenlimit per Stream. Optional DNS-Rebinding-Schutz per undici-`Agent` mit eigenem `lookup`.
2. Proxy `/proxy/image` darauf umstellen (sofort, unabhaengig von DM-3); Host-Allowlist entfaellt (DM-3b ist mit DM-3-light gestrichen, der PDF-Export braucht beliebige Hosts); der SSRF-Guard ist die Schutzmassnahme.
3. Import-Einstieg: URL vor Jobstart pruefen (`400` mit deutscher Meldung); alle Fetcher mit Nutzer-URL auf `safeFetch` umstellen.
4. Tests: private IPs, Hostname → private IP (gemockter `lookup`), Redirect auf privat, Redirect-Limit, Groessenabbruch; Route-Test fuer Import mit interner URL.
5. Doku: CLAUDE.md (Route Auth Inventory: Proxy-Zeile praezisieren, Import-Zeile), `PROJECT_LEARNINGS`.

## Reihenfolge / Abhaengigkeiten
- **Vor dem oeffentlichen Start** und **vor DM-3**: DM-3 baut `safeFetchImage` dann auf `safe-fetch.ts` auf, statt einen eigenen Guard einzufuehren (DM-3 Schritt A3 entsprechend verkleinern).
- Unabhaengig von Paket L, R und B.

## Offene Fragen (fuer den Detailplan)
- Befund 2 bestaetigen; wie weit reicht die Ausnutzbarkeit auf Northflank (erreichbare interne Dienste, Metadaten-Endpunkt)?
- Wie weit ist yt-dlp betroffen (Befund 3)?
- Ein PR (Proxy + Import) oder zwei (Proxy zuerst, weil ohne Auth)?
