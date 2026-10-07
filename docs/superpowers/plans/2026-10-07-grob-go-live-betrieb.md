# Grobplan: Go-Live-Betrieb (Paket G — Betreiber-Schritte zum Produktionsstart)

> **Status: GROBPLAN — muss vor der Umsetzung ausgearbeitet werden** (Reihenfolge, genaue API-Aufrufe, Pruefschritte). Ueberwiegend Betreiber-Schritte in Dashboards/APIs, kaum Code.

Stand: 2026-10-07. Bezug: [TODO.md](../../../TODO.md) → „Offene Punkte (Stand 2026-09-29)" → *Aufraeumen / Konten* und *Pruefen / manuell testen* (DMARC) sowie Punkt 7 (Gmail-Monitor). Werkzeug und Stolpersteine: [domain-mail-infra-runbook.md](../../domain-mail-infra-runbook.md), [gmail-production-monitor-runbook.md](../../gmail-production-monitor-runbook.md).

## Warum buendeln
Diese Punkte sind einzeln klein, wurden aber alle bewusst „bis zum Produktionsstart" zurueckgestellt und beruehren dieselben Konten (Brevo, Cloudflare, Northflank, Google). In einer Sitzung erledigt, muss man jedes Dashboard nur einmal oeffnen und kann die Wechselwirkungen (SPF/DMARC, Egress-IPs) zusammen pruefen.

## Umfang
1. **Brevo-IP-Allowlist** — Entscheidung feste Northflank-Egress-IP (kostenpflichtig) oder Allowlist auf die tatsaechlich genutzten Egress-IPs von Web-Service und Cron-Job; Home-IPs (IPv4 + IPv6) entfernen.
2. **Brevo aufraeumen** — fremden Domain-Eintrag `recipedeck.app` loeschen.
3. **Gmail-Monitor aktivieren** — OAuth-App auf *In production* (setzt die deployte `/datenschutz` voraus), `npm run gmail:authorize`, Refresh-Token als Northflank-Secret, eine manuelle Probe, dann Cron `gmail-brevo-probe` aktivieren.
4. **DMARC** `p=none` → `p=quarantine` (Cloudflare-TXT `_dmarc`), nach Durchsicht der Berichte.
5. **Cloudflare-Token** auf *Zone → Zone → Edit* + *Zone → DNS → Edit* reduzieren (Registrar-Rechte entfernen).
6. **Alte INWX-Zone** leeren.

## Aufteilung in zwei Sitzungen (zweite Buendelung, 2026-10-07)
- **G1 — Konten-Sitzung, frueh:** zusammen mit [Paket R](2026-10-07-paket-r-rechtstexte-detailplan.md) **D4a** (Kontaktadresse, MX/SPF bei Cloudflare): Brevo-Domain `recipedeck.app` loeschen (2), INWX-Zone leeren (6), danach Cloudflare-Token reduzieren (5). Alles DNS/Konten, keine Abhaengigkeit vom Start.
- **G2 — zum Produktionsstart:** Brevo-IP-Allowlist (1), Gmail-Monitor (3), DMARC `quarantine` (4, fruehestens ca. 4 Wochen nach G1).

## Reihenfolge und Abhaengigkeiten
- **Nach Paket R, Schritt D4a** (Kontaktadresse/Email Routing): D4a fuegt MX- und SPF-Eintraege hinzu. DMARC erst verschaerfen, wenn der zusammengefuehrte SPF-Eintrag laeuft und die Berichte danach sauber sind.
- **Nach Paket R, Schritt D3a** (finale `/datenschutz`): Voraussetzung fuer die Google-OAuth-Freigabe des Gmail-Monitors.
- **Entscheidung R-E3 beachten:** Zieht das Betreiber-Postfach von Gmail zu einem EU-Anbieter um, muss geklaert werden, ob der Gmail-Monitor (prueft Zustellung in ein Gmail-Postfach) bleibt oder angepasst wird.
- Cloudflare-Token zuletzt reduzieren — D4a und DMARC brauchen ihn vorher noch mit DNS-Rechten (Registrar-Rechte sind dafuer nicht noetig, also auch frueher moeglich).
- Punkte 2, 5 und 6 haben keine Abhaengigkeiten.

## Offene Fragen (fuer den Detailplan)
- Kosten und Verfuegbarkeit einer festen Egress-IP bei Northflank.
- Sind die Egress-IPs von Web-Service und Cron-Job identisch/stabil?
- Wie lange DMARC-Berichte beobachten (Vorschlag: 4 Wochen nach der letzten DNS-Aenderung)?
