# Detailplan: Go-Live-Betrieb (Paket G)

> **Status: Detailplan — wartet auf Freigabe.** Überwiegend Betreiber-Schritte in Dashboards und APIs, kein Code außer einer Dokumentation. Zugangsdaten, API-Aufrufe und Stolpersteine: [domain-mail-infra-runbook.md](../../domain-mail-infra-runbook.md) und [gmail-production-monitor-runbook.md](../../gmail-production-monitor-runbook.md).

Stand: 2026-10-09. Grobplan: [2026-10-07-grob-go-live-betrieb.md](2026-10-07-grob-go-live-betrieb.md). Bezug: [TODO.md](../../../TODO.md) („Offene Punkte“, Punkt 7 Gmail-Monitor, DMARC), [Paket R](2026-10-07-paket-r-rechtstexte-detailplan.md) (D4a, D3a).

**Wirkung der Reduzierung vom 2026-10-09:** Das Kontaktformular entfällt, damit gibt es **keine** Brevo-Kontingent-Teilung mit einem Formular. D4a (Kontaktadresse) bleibt und ist die einzige DNS-Änderung, an die G anschließt. Alle Schritte bleiben, werden aber in zwei Sitzungen und mit klaren Prüfbefehlen festgelegt.

---

## 0. Ausgangslage (aus Runbook und TODO)
- DNS liegt bei **Cloudflare** (Zone `recipedeckapp.de`, Nameserver `casey`/`daphne`), alle Records **ohne** Proxy. Registrar INWX (Unterzugang `recipedeck-dns`); die **alte INWX-Zone ist wirkungslos**.
- Aktuelle Mail-Records: SPF `v=spf1 include:spf.brevo.com ~all` auf `@`; DMARC `v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com` auf `_dmarc`.
- Brevo: API-Key mit **IP-Allowlist** (nur IPv4); Cron-Job `gmail-brevo-probe` pausiert, erste Probe scheiterte an `34.91.8.145` (Egress-IP des Jobs). Fremder Domain-Eintrag `recipedeck.app` in Brevo ist eine Altlast.
- Cloudflare-Token hat zu viele Rechte (Zone Edit + DNS Edit, ursprünglich auch für den Registrar-Umzug).

## 1. Zwei Sitzungen

### G1 — Konten-Sitzung (früh, zusammen mit Paket R / D4a)
Alles DNS und Konten, keine Abhängigkeit vom Start. Reihenfolge (jeweils mit Prüfschritt; DNS-Export **vorher** sichern):

| # | Schritt | Prüfung | Abbruchkriterium |
|---|---|---|---|
| G1.1 | **DNS-Export sichern** (`GET .../dns_records?per_page=100` nach `~/.config/` oder Vault, nicht ins Repo) | Datei vorhanden, Anzahl Records plausibel | – |
| G1.2 | **D4a:** Email Routing für `kontakt@recipedeckapp.de` (oder EU-Postfach nach R-E3). MX-Records anlegen, **SPF zu einem einzigen Record zusammenführen** (`v=spf1 include:spf.brevo.com include:_spf.mx.cloudflare.net ~all` bzw. Anbieter-Include) | `dig +short TXT recipedeckapp.de @casey.ns.cloudflare.com` zeigt **genau einen** `v=spf1`; Testmail an `kontakt@` kommt an | Brevo-Test (G1.3) fällt durch → Export zurückspielen |
| G1.3 | **Brevo-Versand prüfen** (Einladung an Testadresse und Supabase-Passwort-Reset): SPF/DKIM `pass` im Header | Header der empfangenen Mail | doppelter SPF → sofort korrigieren |
| G1.4 | `RECIPE_INVITE_EMAIL_REPLY_TO` auf `kontakt@` umstellen (**Achtung Env-Ersatz:** `northflank update service runtime-environment` ersetzt die komplette Environment; zuerst die aktuelle Liste lesen, dann alle Werte inkl. der geänderten zurückschreiben) | `/api/v1/health` `200`; Einladung enthält Reply-To `kontakt@` | – |
| G1.5 | **Brevo aufräumen:** Domain-Eintrag `recipedeck.app` löschen | Brevo-Domainliste enthält nur `recipedeckapp.de` | – |
| G1.6 | **Alte INWX-Zone leeren** (`nameserver.info` → `nameserver.deleteRecord` je Record; Zone selbst **nicht** löschen, Delegation läuft über Cloudflare) | `dig NS recipedeckapp.de @a.nic.de +noall +authority` zeigt weiter Cloudflare; Website und Mail unverändert | Website down → Delegation prüfen |
| G1.7 | **Cloudflare-Token reduzieren** auf *Zone → Zone → Edit* + *Zone → DNS → Edit* (Registrar-/Account-Rechte entfernen); neuen Token in `.env` und `~/.config/` ersetzen, alten widerrufen | ein DNS-GET mit dem neuen Token klappt, mit dem alten `401` | – |
| G1.8 | Runbook ergänzen: Abschnitt „Eingehende Mail“ und der reduzierte Token | Diff im PR | – |

**Akzeptanz G1:** Mail an `kontakt@` kommt an; Brevo-Mails bestehen SPF und DKIM; genau ein SPF-Record; alte INWX-Zone leer; Token reduziert; Runbook aktuell.
**Aufwand:** M (eine Sitzung, ca. 1–2 h).

### G2 — zum Produktionsstart (vor „Registrierung öffnen“)
| # | Schritt | Voraussetzung | Prüfung |
|---|---|---|---|
| G2.1 | **Brevo-IP-Allowlist festlegen** (Entscheidung 1) | Egress-IPs von Web-Service und Cron-Job bekannt | Versand-Smoke aus Production (echte Einladung) und `curl -4` mit API-Key von erlaubter IP; Home-IPs (IPv4 **und** IPv6) entfernt |
| G2.2 | **Gmail-Monitor** (Entscheidung 2: optional) | finale `/datenschutz` live (R D3a); OAuth-Zustimmungsbildschirm auf *In production* | `npm run gmail:authorize` lokal, Refresh-Token als Northflank-Secret, **eine** manuelle Probe (`node dist/gmail-brevo-probe.js`), erst dann den Cron aktivieren |
| G2.3 | **DMARC `p=none` → `p=quarantine`** | G1 ≥ 4 Wochen her, Berichte (`rua`) ohne Auffälligkeit; SPF und DKIM `aligned` für alle Absender (Brevo-Versand, Supabase-Auth-Mails über Brevo-SMTP, ggf. Postfach-Anbieter) | `dig +short TXT _dmarc.recipedeckapp.de @casey.ns.cloudflare.com`; danach Testmail an ein fremdes Konto: Posteingang |
| G2.4 | **Rest-QA einmalig** (siehe [Test-Session](../../testing/manuelle-test-session.md)): Passwort-Reset, Web-Push, jsQR in Firefox | – | Abhaken in der Session-Datei |
| G2.5 | **Registrierung öffnen** — Checkliste unten | alle Pakete S, L, A, B, R, DM erledigt | Checkliste |

**Akzeptanz G2:** Versand aus Production funktioniert mit der gewählten Allowlist-Variante; (falls gewählt) Gmail-Probe grün und Cron aktiv; DMARC `quarantine` ohne Zustellprobleme; Checkliste unten abgehakt.
**Aufwand:** M, verteilt über mehrere Tage (DMARC-Beobachtung).

---

## 2. Start-Checkliste „Registrierung öffnen“ (Betreiber, abhaken im TODO)
1. **Sicherheit:** Paket S in Production (Proxy nur mit Login, Import-Guard); manueller Smoke eines Imports je Plattform.
2. **Daten:** Paket L (Migration) in Production; Account-Löschung auf Staging getestet; Paket A: ein Backup-Lauf grün **und** Restore-Test auf Staging protokolliert; `age`-Schlüssel und Pepper offline gesichert.
3. **Kosten:** Paket B aktiv (Tageslimit), Groq-Console-Limits/Zero-Data-Retention gesetzt.
4. **Recht:** `legal-operator.ts` gefüllt (`LEGAL_PLACEHOLDERS_OPEN === false`); Impressum/Datenschutz/Nutzungsbedingungen online und von außen ohne Login erreichbar; Northflank-AVV vorhanden; DPAs abgelegt; Text gegengelesen; Impressum-Satz „nicht kommerzielles Open-Source-Projekt“ + Lizenz-Link vorhanden.
5. **Betrieb:** Supabase-Keep-Alive läuft (letzte Läufe grün), Liveness-Probe aktiv, `/api/v1/health` `200`; Brevo-Versand geprüft (G2.1).
6. **Auth-Mails:** Signup- und Reset-Mail end-to-end in Production (Absender `noreply@recipedeckapp.de`, Link auf `www`).
7. **Monetarisierungs-Regel** (Paket R 0a) bewusst bestätigt.
8. **Rückfall:** Wenn etwas schiefgeht, Registrierung wieder schließen: Supabase-Auth-Einstellung „Allow new users to sign up“ bzw. Gate laut `supabase-auth-config.yml` (Betreiber legt vorab fest, wie die Registrierung kurzfristig geschlossen wird, und dokumentiert es im Runbook).

---

## 3. Betreiber-Entscheidungen
| # | Frage | Empfehlung |
|---|---|---|
| 1 | **Brevo-IP-Schutz:** (a) feste Northflank-Egress-IP (kostenpflichtig, Verfügbarkeit im Dashboard prüfen), (b) Allowlist der **beobachteten** Egress-IPs von Service und Cron-Job, (c) Allowlist abschalten und stattdessen Key rotieren/geheim halten | **(b)**; bei häufig wechselnden IPs (c) mit Key-Rotation; (a) nur wenn kostenlos. Egress-IP-Stabilität über ein paar Tage beobachten (Brevo-Fehlermeldung nennt die IP) |
| 2 | **Gmail-Monitor überhaupt aktivieren?** Er prüft, ob Brevo-Mails im Gmail-Postfach ankommen; mit eigener Kontaktadresse (R-E3) und Brevo-Logs ist er ein Nice-to-have | **optional, nicht blockierend.** Wenn aktiviert: OAuth-Bildschirm *In production* (Hinweis: ein „restricted scope“ ohne Google-Verifizierung zeigt eine Warnung und ist auf 100 Nutzer begrenzt, für ein einziges Konto unkritisch; Verhalten der Token-Laufzeit beim ersten Authorize prüfen) |
| 3 | **DMARC-Beobachtungsdauer** | 4 Wochen nach der letzten DNS-Änderung aus G1.2 |
| 4 | **Wie wird die Registrierung im Notfall geschlossen** | vorab festlegen und im Runbook dokumentieren (Checkliste Punkt 8) |
| 5 | **Reihenfolge G1** | direkt nach Bestätigung von R-E3 (Kontaktadresse), parallel zu Paket S |

## 4. Doku-Nachzug
`docs/domain-mail-infra-runbook.md` (Eingehende Mail, reduzierter Token, Registrierung schließen, Brevo-Allowlist-Entscheidung), `docs/gmail-production-monitor-runbook.md` (falls aktiviert), TODO.md (Pakete G1/G2 abhaken).

## 5. Risiken
- **Doppelter SPF-Record** bricht die Zustellung aller Brevo-Mails → G1.2/G1.3 mit Rückspiel-Export.
- **Env-Ersatz bei Northflank** (komplette Environment wird überschrieben) → vorher lesen, alle Werte zurückschreiben.
- **DMARC zu früh verschärft** → Mails an Gmail/Outlook landen im Spam → deshalb Beobachtungszeit und Testmail.
- **IP-Allowlist verschiebt sich** (Deployments können die Egress-IP ändern) → Versand-Smoke nach jedem größeren Infra-Wechsel und rot werdender Gmail-Probe/Keep-Alive als Alarm.

**Aufwand gesamt:** G1 M, G2 M.
