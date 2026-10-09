# Detailplan: Rechtstexte und Kontakt (Paket R: D2, D4a, D3, D9-light)

> **Status: Detailplan — wartet auf Freigabe.** Kein Code und keine Texte im Repo ändern, bevor der Betreiber diesen Plan freigegeben hat.

Stand: 2026-10-07. Bezug: [Grobplan Paket R](2026-10-07-grob-rechtstexte-und-kontakt.md) · [TODO.md](../../../TODO.md) („Vor dem oeffentlichen Start“) · [Vor-Start-Plan](2026-10-07-vor-start-backups-kostenschutz-recht-plan.md) Abschnitt D · Fachgrundlage: [Rechtsrecherche](../../legal/2026-10-impressum-datenschutz-recherche.md) mit [Faktencheck](../../legal/faktencheck/). **Keine Rechtsberatung.** Alle Rechtsaussagen in diesem Plan stammen aus der Recherche (Abschnittsnummern in Klammern). Was dort nicht steht, ist als „Gegenlesen“ markiert und keine Rechtsaussage.

> **Umfang reduziert am 2026-10-09 (Entscheidung Betreiber):** Das Projekt ist unentgeltlich, werbefrei und Open Source (AGPL-3.0, siehe Abschnitt 8). Darauf gestützt (Recherche 1.1, 9.3, 9.5):
> - **D4b Kontaktformular entfällt.** Nur die E-Mail-Adresse bleibt (D4a). Ein zweiter Kontaktweg ist nur Pflicht, wenn § 5 DDG greift, und das ist ohne Monetarisierung unwahrscheinlich.
> - **D9 ist abgespeckt** auf eine kurze statische Seite `/nutzungsbedingungen`. **Keine Migration, kein Zustimmungs-Gate, keine Checkbox.** Im Signup nur ein Hinweis mit Link.
> - **Monetarisierungs-Grenze** (Abschnitt 0a) ist ab jetzt eine feste Regel: Sie trägt die Annahme „§ 5 DDG, DSA und BFSG greifen wahrscheinlich nicht“.
> - Die ursprünglichen Fassungen von D4b und D9 stehen als Archiv am Dokumentende (Abschnitt 9), falls ein Trigger eintritt.

---

## 0. Reihenfolge und Begründung

| Schritt | Teilpaket | Art | Blockiert durch | Aufwand |
|---|---|---|---|---|
| 1 | **D2** VVT-Entwurf | Betreiber-Schritt (Claude schreibt den Entwurf außerhalb des Repos) | nichts | M |
| 2 | **D4a** Kontaktadresse `kontakt@recipedeckapp.de` | Betreiber-Schritt (DNS/Postfach) | Betreiber-Entscheidung E3 | S |
| 3 | ~~**D4b** Kontaktformular~~ | **entfällt** (2026-10-09), siehe Abschnitt 0a und 9 | – | – |
| 4 | **D3a** Text-PR, sofort belegbare Teile | PR | Betreiber-Daten (E1, E2, E5), D4 | M |
| 5 | **D9-light** Nutzungsbedingungen als statische Seite | PR (nur Text + Link, keine Migration) | D3a (Anbieterangaben, Kontakt, Meldeweg) | S |
| 6 | **D3b** Text-Nachzug | PR | D1 Northflank-AVV, Paket A live, Paket DM (D6/D7/D8), D5 ZDR | S |
| 7 | Gegenlesen durch Dritte | Betreiber | D3b + D9-light | – |

**Warum diese Reihenfolge:**
- **D2 zuerst:** keine Abhängigkeiten. Das VVT ist die Liste aller Verarbeitungen mit Zweck, Rechtsgrundlage, Empfängern und Fristen (Recherche 2.3, 10). Die Datenschutzerklärung (D3) bildet genau diese Liste ab. Lücken im VVT, etwa fehlende Löschfristen, zeigen früh, welche Platzhalter D3 noch haben wird.
- **D4 vor D3:** `legal-operator.ts` braucht die endgültige Kontaktadresse und das Feld für den zweiten Kontaktweg (Recherche 11.1, Z. 10 und „neu“). Der Text-PR soll diese Werte nicht zweimal anfassen.
- **D3 in zwei Stufen:** Die Datenschutzerklärung darf nichts behaupten, was noch nicht stimmt. Die Recherche sagt das ausdrücklich: Northflank-AVV „erst schreiben, wenn der AVV vorliegt“, EXIF-Satz „erst nach technischer Umsetzung“ (11.3). D3a korrigiert alles, was heute belegt ist. D3b zieht nach, sobald A, DM und D1 erledigt sind.
- **D9-light zuletzt:** Die Nutzungsbedingungen verweisen auf Anbieter, Kontakt, Meldeweg und Datenschutzerklärung. Es gibt keine Schemaänderung mehr im Paket.

---

## 0a. Monetarisierungs-Grenze (feste Regel seit 2026-10-09)

Die Annahmen dieses Plans stützen sich darauf, dass RecipeDeck **nicht kommerziell** betrieben wird (Recherche 1.1: OLG Hamburg / Gesetzesbegründung; 9.3 DSA; 9.5 BFSG). Das gilt nur, solange **alle** drei Punkte stimmen:

- keine Werbung und keine Affiliate-Links,
- kein Bezahl-Tier und keine kostenpflichtigen Funktionen,
- keine Spenden **mit Gegenleistung** (z. B. Extra-Funktionen für Spender).

**Folge, wenn einer davon eintritt:** § 5 DDG greift sicher, der DSA ist wahrscheinlich anwendbar, und die vorsorglich gestrichenen Teile (zweiter Kontaktweg, Meldeverfahren, ggf. Zustimmungsnachweis) müssen vor dem Start der Monetarisierung wieder aufgenommen werden (Archiv in Abschnitt 9). Die Regel steht auch in `CLAUDE.md` und `TODO.md`, damit sie bei Feature-Entscheidungen auffällt. Reine Spenden ohne Gegenleistung gelten nach Recherche-Linie als unkritisch, sind aber beim Gegenlesen (Abschnitt 6) ausdrücklich zu bestätigen.

---

## 1. Ist-Zustand (geprüft am Code, 2026-10-07)

| Thema | Fundstelle | Befund |
|---|---|---|
| Betreiberdaten | `mobile/utils/legal-operator.ts:1-17` | Platzhalter in `[...]`. Kommentar Z. 1 nennt „§ 5 DDG“. E-Mail Z. 10 `recipedeckapp@gmail.com`. `LEGAL_PLACEHOLDERS_OPEN` (Z. 17) ruft `startsWith('[')` auf **alle** Werte auf, deshalb führt ein optionales Feld mit `undefined` zum Absturz |
| Impressum | `mobile/app/impressum.tsx:7` | „Angaben gemäß § 5 DDG“. Z. 18–19 nur E-Mail. Z. 21–25 Verbraucherstreitbeilegung. Z. 27–32 „Haftung für Inhalte und Links“ |
| Datenschutz | `mobile/app/datenschutz.tsx:1-125` | 12 Abschnitte. Die Zeilenbezüge der Recherche 11.3 stimmen mit dem aktuellen Stand überein (z. B. Z. 25 „verschlüsselter Hash“, Z. 30 „Supabase Inc.“, Z. 55 DPF/SCC-Platzhalter, Z. 93 „§ 25 Abs. 2 TDDDG“, Z. 115 Art. 21 innerhalb der Liste) |
| Seitenrahmen | `mobile/components/LegalPage.tsx:11-41` | Zeigt den Platzhalter-Hinweis (Z. 29–35) und „Stand: LEGAL_LAST_UPDATED“ (Z. 37). Es gibt nur ein gemeinsames Datum für alle Rechtsseiten |
| Links | `LegalPage.tsx:69-80` (`LegalLinks`) | Eingebunden in `mobile/app/account.tsx:630`, außerhalb der Signed-in-Bedingung (also sowohl anonym als auch angemeldet sichtbar), und in `mobile/app/(tabs)/settings.tsx:1324` |
| Anonyme Erreichbarkeit | `mobile/utils/login-first-routing.ts:27-33`, Guard `mobile/app/_layout.tsx:191-201`, `:227-229` | `/account`, `/impressum`, `/datenschutz`, `/+not-found` und `/share-invite/*` sind öffentlich. Stack-Screens `_layout.tsx:302-303`. Web-Export `"output": "static"` (`mobile/app.json:28`), die Seiten werden also als HTML vorgerendert |
| Sichtbarkeit für Angemeldete | `mobile/app/(tabs)/_layout.tsx:75-87` | Im Login-first-Modus zeigt der Header angemeldeten Nutzern nur den Bug-Button. `/account` ist nur über die Einstellungen erreichbar (`settings.tsx:763`). Damit liegen die Rechtslinks für Angemeldete faktisch **nur unter „Einstellungen“**, was die Recherche 11.2 (Platzierung, Schwenke) als „nicht einfach erkennbar“ einordnet |
| Doku-Drift | `CLAUDE.md` Abschnitt „Login-first gate“ | Dort steht „only `/account` itself stays directly reachable“. Das ist veraltet, siehe oben. Außerdem fehlen Impressum und Datenschutz in der Routes-Tabelle, und die Unsplash-Angabe ist falsch (Recherche 3, Hinweis CLAUDE.md) |
| Test-Drift | `mobile/test/root-layout-login-first.test.tsx:98` | Der Mock von `isPublicLoginFirstPath` kennt nur `/account` und `/+not-found` |
| Signup | `mobile/app/account.tsx:228-273` (`handleSignUp`), Formular `:515-605` | E-Mail, Passwort, Bestätigung, Button. Keine Checkbox. `signUpWithPassword` (`mobile/utils/auth.ts:149-188`) übergibt nur `emailRedirectTo`, kein `options.data` |
| Bootstrap | `src/routes/auth.ts:24-90` | Ruft `ensureUserProfile` (`src/db-react.ts:2339-2348`, Insert mit `onConflictDoNothing`), `ensureDefaultHouseholdForUser` und `getAccountBootstrapStatus` (`db-react.ts:2579ff`) auf. Clientseitig nur in `account.tsx:115-138`, aufgerufen bei Login, Signup und im Effect `:181-191` des Account-Screens, **nicht** beim App-Start |
| JWT-Prüfung | `src/auth.ts:146-161` | `supabase.auth.getUser()`. Zurückgegeben werden nur `id` und `email`. `user_metadata` und `created_at` wären verfügbar |
| Profiltabelle | `src/schema.ts:171-179` | `user_profiles(user_id PK, email, app_role, created_at, updated_at)`. RLS ist an, `authenticated` darf nur lesen (Migration `20260604135550…sql:159-175`), Schreibzugriff nur durch den Server |
| Konto-Löschung | `supabase/migrations/20261007120000_account_deletion.sql:110-111` | `user_profiles` wird per Cascade über `DELETE FROM auth.users` entfernt |
| Deletion-Smoke | `scripts/supabase/account-deletion-smoke.ts:130-162`, `:215-220` | Findet `uuid`-Spalten in `public`, die `user_id`, `created_by` oder `*_user_id` heißen. Jede neue Spalte dieser Art muss in die Löschfunktion **und** in `COVERED_USER_COLUMNS` |
| Mailversand | `src/mail.ts:27-47`, `:96-141` | Nur Einladungen. Brevo-Transactional-API, Konfiguration über `RECIPE_INVITE_EMAIL_*`. HTML wird escaped (`:87-94`) |
| Rate-Limits | `src/db-react.ts:2176-2220` (Bug-Reports, DB, pro User), `src/middleware/facebook-rate-limit.ts` (In-Memory, pro IP), IP-Ermittlung `src/routes/extraction.ts:110-113` | Zwei bestehende Muster: DB-basiert pro User und In-Memory pro IP |
| Router-Mount | `src/api-react.ts:25-35` | Elf Router |
| Mail-DNS | `docs/domain-mail-infra-runbook.md:56-64`, `:125-138` | **Keine MX-Records.** SPF `v=spf1 include:spf.brevo.com ~all`. Absender `einladung@` mit Reply-To Gmail und `noreply@`. Brevo Free: 300 Mails/Tag, Einladungen und Auth zusammen |
| Einladungen | `src/db-react.ts:1396` | Der Ablauf wird nur als Status abgeleitet. Per grep habe ich keinen Löschpfad für abgelaufene Einladungen gefunden (inkl. Empfänger-E-Mail). Für VVT und D3 relevant |

---

## 2. D2 — Verzeichnis von Verarbeitungstätigkeiten (Art. 30)

**Rechtlicher Rahmen (Recherche 0 P1 Nr. 6, 2.4):** Ein VVT ist nötig (h. M., DSK-Kurzpapier Nr. 1). Es ist ein internes Dokument, das nur auf Anfrage der Behörde vorgelegt wird. Als Muster nennt die Recherche das DSK-Muster für Verantwortliche. Beobachtungspunkt Omnibus IV (P3 Nr. 14): bis zu einer verifizierten Änderung gilt die aktuelle Fassung.

### Ablageort — Optionen
| Option | Vorteile | Nachteile |
|---|---|---|
| **A. Obsidian-Vault** `/home/patrick/Vault/Projekte/RecipeDeck/Recht/VVT.md` (+ datierter PDF-Export) | Nicht öffentlich, dort liegen schon ADRs und Phasenplan, Claude kann direkt schreiben | Versionierung und Backup hängen an der Vault-Synchronisierung (Betreiber prüfen) |
| B. Privates GitHub-Repo `rezepti-legal` | Versioniert, Review per PR möglich | Weiterer Empfänger (GitHub, DPF laut Recherche 4.1), eigenes Repo pflegen |
| C. Gitignored-Ordner im öffentlichen Repo | Nah am Code | Risiko eines versehentlichen Commits, geht bei frischem Clone verloren. **Nicht empfohlen** |

**Empfehlung: A.** Im selben Ordner `Recht/avv/` auch die DPA-PDFs aus D1 ablegen (Recherche 3: „außerhalb des öffentlichen Repos oder privat“). Im öffentlichen Repo steht nur ein Verweis auf den Ablageort, ohne Inhalt.

### Gliederung des VVT (an das DSK-Muster angelehnt; Feldliste beim Anlegen gegen das Muster abgleichen)
**Teil A — Stammdaten:** Verantwortlicher (aus `legal-operator.ts`), Kontakt, Hinweis „kein DSB benannt“ (Recherche 2.4), zuständige Aufsichtsbehörde (Recherche 8), Stand und Änderungsprotokoll.

**Teil B — Verarbeitungstätigkeiten.** Je Eintrag: Zweck · Rechtsgrundlage (Recherche 2.3) · betroffene Personen · Datenkategorien · Empfänger/Auftragsverarbeiter (Recherche 10) · Drittland und Garantie (Recherche 4.2) · Löschfrist · Fundstelle im Code · Status (belegt / offen).

| # | Verarbeitung | Rechtsgrundlage (2.3) | Empfänger | Frist (Stand) |
|---|---|---|---|---|
| 1 | Nutzerkonto, Login, Sitzung, Passwort-/Bestätigungsmails | lit. b | Supabase (Pte. Ltd., SCC), Brevo (SMTP) | bis Kontolöschung; Auth-Logs nach Anbieterfrist [offen, im Dashboard prüfen] |
| 2 | Inhalte: Rezepte, Notizen, Bewertungen, Favoriten, Sammlungen, Planer, Einkaufsliste, Haushalt | lit. b | Supabase, Northflank | bis Kontolöschung; Haushaltsinhalte siehe Recherche 6 |
| 3 | KI-Import (URL, Text, Foto, Audio; yt-dlp-Abruf; Job-Daten mit User-Agent/URL im RAM) | lit. b (h. M.) | Groq UK Ltd. (SCC, USA), ggf. Cobalt [Betreiber prüfen] | Jobs ≤ 7 Tage RAM (Recherche 9.6); Groq standardmäßig keine Speicherung, ≤ 30 Tage anlassbezogen, mit ZDR keine (D5). **TIA Groq** als Anhang (Recherche 4.2) |
| 4 | Bildvorschläge (Rezeptname an Chefkoch) | lit. b | Chefkoch | keine Speicherung beim Empfänger bekannt |
| 5 | Anzeige von Fremdbildern (IP an Quell-Websites) | lit. f, umstritten | Quell-Websites/CDNs | bis Paket DM/D7 umgesetzt ist |
| 6 | Cookidoo-Verbindung | lit. b | Vorwerk (eigener Verantwortlicher) | bis zum Trennen bzw. zur Kontolöschung |
| 7 | Rezept-Einladungen (Daten Dritter) | lit. f + Art. 14 | Brevo | **[offen: abgelaufene Einladungen werden nicht gelöscht]** |
| 8 | Push-Benachrichtigungen | lit. a + § 25 TDDDG | Push-Dienste des Browsers (Empfänger) | bis zum Abschalten bzw. zur Kontolöschung |
| 9 | Fehlerberichte inkl. Metadaten, Spalte `route`, `lastFailureSnapshot`; Rate-Limit-Tabelle | lit. f (alternativ b) | Supabase | **[offen: Frist D8]**; Rate-Limit-Zeilen ca. 24 h (`db-react.ts:2181`) |
| 10 | BYOK-Prüfung und -Ratenlimit | lit. f | Groq (Konto des Nutzers) | Rate-Limit-Zeilen kurzfristig (`db-react.ts:2543`) |
| 11 | Hosting, Server-Logs, Missbrauchsschutz (IP-Limit Facebook-Import, künftig Importkontingent Paket B, Kontaktformular D4) | lit. f | Northflank (**AVV offen, D1**) | Logs nach Anbieterfrist [offen]; IP nur im RAM |
| 12 | Backups (Paket A) | lit. f / Art. 32 | Cloudflare R2 (Jurisdiktion `eu`) | ≤ 35 Tage + Löschprotokoll (Recherche 5) |
| 13 | Kontakt per E-Mail und Kontaktformular (D4) | lit. b bzw. f | Brevo (Formular), Postfach-Anbieter (Gmail oder EU-Anbieter) | [Betreiber festlegen] |

**Teil C — Anhänge:**
- C1: Dienstleistertabelle (Recherche 10) mit Ablageort und Datum jedes DPA-PDF (D1)
- C2: TOM-Beschreibung, nur Fakten aus Repo und Plänen: RLS auf allen Nutzertabellen, AES-256-GCM für Cookidoo, `age`-verschlüsselte Backups, Request-Logger ohne IP/Inhalte, Account-Löschfunktion
- C3: DSFA-Schwellwertprüfung (Recherche 2.4: voraussichtlich nicht nötig; dokumentiert am Beispiel Foto-Upload: Personenabbildungen, EXIF-GPS)
- C4: Ablauf für Betroffenenanfragen (Art. 12 Abs. 3: ein Monat, Recherche 6)
- C5: Gerätespeicher-Übersicht (Recherche 7). Gehört streng genommen zu TDDDG, nicht ins VVT, ist aber zur Dokumentation nützlich

### Schritte
1. Claude legt den Entwurf mit allen Platzhaltern `[offen: …]` im Vault an. Repo-Dateien werden nicht berührt.
2. Der Betreiber füllt die offenen Punkte: Fristen, Cobalt, Northflank-Region, Brevo-Vertragspartner, Postfach.
3. Datierten PDF-Export ablegen. Bei jedem späteren PR, der eine neue Verarbeitung einführt (Paket B, DM, O), wird das VVT nachgezogen. Hinweis dazu in die PR-Checkliste von D3 aufnehmen.

**Akzeptanz:** Alle 13 Verarbeitungen sind erfasst. Jede offene Frist ist als `[offen]` markiert und einer Person zugeordnet. Das Dokument liegt außerhalb des öffentlichen Repos. Der Betreiber hat es freigegeben (TODO-Haken).
**Risiken:** Das VVT veraltet bei neuen Features → Pflege an D3/PR-Checkliste koppeln. Omnibus IV könnte die Pflicht später ändern; das ist kein Grund, auf das VVT zu verzichten.
**Betreiber-Daten:** E1 (Anschrift), E5 (Bundesland), Region und AVV Northflank (D1), Brevo-Vertragspartner, Cobalt-Status, Fristen für Fehlerberichte und Kontakt-Mails.
**Aufwand:** M (Entwurf ca. ½ Tag, Betreiberprüfung separat).

---

## 3. D4 — Kontaktadresse auf eigener Domain (zweiter Kontaktweg entfällt)

**Rechtlicher Rahmen (Recherche 1.4, 0 P1 Nr. 2, P2 Nr. 11):** Ein zweiter schneller Kontaktweg ist nur Pflicht, wenn § 5 DDG greift. Das ist umstritten; **entschieden 2026-10-09: nicht vorsorglich umsetzen**, solange die Monetarisierungs-Grenze (0a) hält. Die Impressums-Pflicht nach § 18 MStV (Name, Anschrift) bleibt davon unberührt; Schwenke: bei komplett nicht kommerziellen Angeboten ist nach § 18 MStV nicht einmal eine E-Mail-Adresse Pflicht. Wir geben sie trotzdem an (nötig für Meldeweg, Betroffenenrechte, Einladungs-Mails). Ein Kontaktformular genügt (EuGH C-298/07), ersetzt aber laut Schwenke nicht die E-Mail. „Problem melden“ setzt einen Login voraus und reicht deshalb nicht. Für Consumer-Gmail gibt es keinen AVV. Empfohlen wird ein Postfach auf eigener Domain bei einem EU-Anbieter mit AVV; ob das nötig ist, ist umstritten (Recherche 3).

### D4a — Kontaktadresse (Betreiber-Schritt)

| Option | Umsetzung | Datenschutz-Folge (laut Recherche) | Kosten |
|---|---|---|---|
| **A. Cloudflare Email Routing → bestehendes Gmail** | Domain im Dashboard bei Email Routing anmelden. Cloudflare legt MX-, SPF- und DKIM-Records an (Cloudflare-Doku, abgerufen 07.10.2026). Zieladresse bestätigen, Regel `kontakt@` → Gmail anlegen | Gmail bleibt Empfänger (Google Ireland, kein AVV) und muss in der Datenschutzerklärung genannt werden (Recherche 11.3 „Kontakt per E-Mail“). Cloudflare kommt als Durchleiter dazu. Ob der Cloudflare-DPA Email Routing abdeckt: **beim Gegenlesen prüfen** | 0 € |
| B. EU-Postfach-Anbieter mit AVV auf eigener Domain | MX auf den Anbieter, SPF mit Brevo zusammenführen, AVV abschließen und ablegen | Löst das Gmail-Problem vollständig (Empfehlung der Recherche 3) | wenige €/Monat |
| C. Gmail-Adresse behalten | nichts | Gmail in der Datenschutzerklärung nennen. Die Adresse auf eigener Domain bleibt offen | 0 € |

Brevo ist im aktuellen Setup nur Versender (Runbook Z. 12–13, 125–138) und kein Postfach.

**Empfehlung:** **B**, wenn der Betreiber die kleinen Kosten akzeptiert. Sonst **A** als Zwischenlösung, mit offengelegtem Gmail.

**Schritte (A):**
1. Einen kompletten DNS-Export sichern (Runbook Z. 70).
2. Email Routing anmelden.
3. **SPF prüfen:** Es darf nur **ein** `v=spf1`-Record auf `@` geben. Den bestehenden Brevo-Record mit dem Cloudflare-Include zu einem Record zusammenführen. Danach mit `dig +short TXT recipedeckapp.de @casey.ns.cloudflare.com` prüfen.
4. Alle Records `proxied:false` lassen (Runbook Z. 53; MX werden ohnehin nicht proxied).
5. Testmail von einem fremden Konto senden. Danach Brevo-Versand prüfen (Einladung und Auth-Mail landen weiter im Posteingang, DKIM/SPF pass).
6. Northflank-Variable `RECIPE_INVITE_EMAIL_REPLY_TO` auf `kontakt@` umstellen. Achtung: Ein Env-Update ersetzt die komplette Environment (Runbook Z. 108–112).
7. Runbook um den Abschnitt „Eingehende Mail“ ergänzen.

**Optional:** Antworten aus Gmail mit Absender `kontakt@` über Brevo-SMTP („Senden als“). Sonst antwortet der Betreiber von der Gmail-Adresse.

**Akzeptanz:** Eine Mail an `kontakt@recipedeckapp.de` kommt an. SPF ist ein einziger gültiger Record. Brevo-Mails bestehen weiter SPF und DKIM. Das Runbook ist aktualisiert.
**Risiken:** Ein doppelter SPF-Record bricht die Zustellung aller Brevo-Mails → Schritt 3 ist Pflicht. DMARC steht auf `p=none`; eine geplante Verschärfung (Runbook Z. 73) erst danach angehen.

### D4b — Kontaktformular: **entfällt** (2026-10-09)
Kein Endpoint `/api/v1/contact`, keine Seite `/kontakt`, kein Feld `contactFormPath`, keine neuen Northflank-Variablen. Der Plan steht im Archiv (Abschnitt 9). Wiedervorlage bei: Monetarisierung (0a), Aufforderung einer Behörde oder Anwaltskanzlei, oder wenn die Kontaktadresse nachweislich nicht ausreicht (z. B. unbeantwortete Mails durch Spamfilter).

**Aufwand:** D4a S, D4b entfällt.

---

## 4. D3 — Text-PR Impressum und Datenschutzerklärung

**Voraussetzung:** Der Betreiber füllt `legal-operator.ts` (E1, E2, E5). Danach wird `LEGAL_PLACEHOLDERS_OPEN` automatisch `false` und der Entwurfshinweis verschwindet.

**Legende Abhängigkeiten:**
- **[sofort]** heute belegt
- **[Betr]** Betreiber-Daten
- **[D4]** Kontakt
- **[D1]** Northflank-AVV/Region
- **[D5]** Groq ZDR
- **[A]** Backups live
- **[DM6/7/8]** Paket Datenminimierung
- **[B]** Importkontingent live
- **[Cob]** Cobalt-Status geklärt

Regel: Ein Satz kommt erst in den Text, wenn seine Voraussetzung erfüllt ist. Für jede Zeile mit offener Voraussetzung gibt es **D3b** (Nachzug).

### 4.1 `mobile/utils/legal-operator.ts` (Recherche 11.1)
| Zeile | Änderung | Abh. |
|---|---|---|
| 1 | Kommentar → „§ 18 Abs. 1 MStV, vorsorglich § 5 DDG“ | sofort |
| 6–8 | echte Angaben; optionales Feld `careOf` (nur bei schriftlicher Zustellvollmacht, Recherche 1.3) | Betr |
| 10 | `kontakt@recipedeckapp.de` | D4 |
| 12 | konkrete Behörde mit Anschrift/URL (Recherche 8; bei Bayern BayLDA inkl. Postanschrift Postfach 1349, 91504 Ansbach) | Betr |
| 15 | `LEGAL_LAST_UPDATED` neu setzen | sofort |
| 17 | `LEGAL_PLACEHOLDERS_OPEN` so umbauen, dass optionale bzw. leere Felder nicht abstürzen (z. B. nur über Pflichtfelder iterieren oder `typeof v === 'string' && v.startsWith('[')`) | sofort |

### 4.2 `mobile/app/impressum.tsx` (Recherche 11.2)
| Zeile | Änderung | Abh. |
|---|---|---|
| 7 | „Angaben gemäß § 18 Abs. 1 MStV und § 5 DDG“ (oder neutral „Anbieter“; Entscheidung E10) | sofort |
| 8–16 | c/o-Zeile, wenn `careOf` gesetzt ist | Betr |
| 21–25 | Verbraucherstreitbeilegung optional entfernen (keine Pflicht, unschädlich); **keinen** OS-Plattform-Link einfügen | sofort (E10) |
| 27–32 | umformulieren zu „Inhalte von Nutzerinnen und Nutzern / Meldung rechtswidriger Inhalte“ mit E-Mail und Verfahrenssatz (Art. 6, 16 DSA; Anwendbarkeit umstritten, Recherche 9.3) | sofort |
| Ende | **Satz „nicht kommerzielles Open-Source-Projekt“ + Link zu Quellcode und Lizenz (AGPL-3.0)** (Recherche 1.1; stützt die Linie aus 0a) | sofort (E10, jetzt verbindlich) |
| Platzierung | Links **nicht nur unter Einstellungen** (siehe 4.4) | sofort |

### 4.3 `mobile/app/datenschutz.tsx` (Recherche 11.3, ergänzt um Abhängigkeiten)
| Zeile(n) | Änderung (Kurzform, Wortlaut siehe Recherche 11.3) | Abh. |
|---|---|---|
| 9–14 | c/o-Zeile; optional Satz „kein DSB benannt“ | Betr |
| 16–21 | „nicht kommerzielles Open-Source-Projekt“; „keine automatisierte Entscheidung/Profiling (Art. 22)“ | sofort |
| 25 | „kryptografischer Hash, nie im Klartext“ | sofort |
| 25–27 | Pflicht zur Bereitstellung (Art. 13 Abs. 2 lit. e); „Mindestalter 16 Jahre“ | sofort (Altersangabe mit D9 abstimmen) |
| 29–32 | Supabase Pte. Ltd., Singapur; EU-Region Irland; DPA als Teil der AGB; SCC (Art. 46 Abs. 2 lit. c) | Betr (Dashboard-Dokumente, TIA-Importeur, Region bestätigen; Recherche 12 Nr. 7–8) |
| 34–40 | Rezeptbilder/Foto; Fehlerberichte mit technischen Angaben, lit. f, **Speicherdauer**; eigene Kopie bei Einladungsempfängern | Frist: DM8/Betr; Rest sofort |
| neu nach 40 | Fremdbilder: IP an Quell-Websites. **Entfällt, wenn D7 umgesetzt ist** | DM7 (solange D7 fehlt: Satz rein) |
| 44 | Northflank Ltd., London, Region, Angemessenheitsbeschluss UK, AVV | **D1** (bis dahin Z. 44 unverändert lassen) |
| 45–48 | IP kurzzeitig im RAM (Facebook-Import, **Kontaktformular**, ggf. Importkontingent); konkrete Logfristen der Anbieter | sofort; Fristen Betr; Kontingent B |
| 52–54 | Groq: Vertragspartner Groq UK Limited, Verarbeitung auch USA, lit. b | sofort |
| 54 | Groq-Speicherung: Variante mit ZDR oder Standardvariante (≤ 30 Tage anlassbezogen) | D5 (bis dahin Standardvariante) |
| 55 | SCC statt Platzhalter; „nicht DPF-zertifiziert“ | sofort |
| 55–56 | „EXIF entfernen wir …“ | **DM6** (vorher nicht schreiben) |
| 58–61 | BYOK: eigenes Groq-Konto, Groq-Bedingungen | sofort |
| 62–65 | Chefkoch: Bilder direkt geladen → IP an Chefkoch | sofort; nach DM7 anpassen |
| neu (§ 6) | Cobalt nennen, falls aktiv | Cob |
| 69–71 | Cookidoo: lit. b; Vorwerk eigener Verantwortlicher; „AES-256-GCM“ | sofort |
| 76–78 | Brevo-Vertragspartner; Speicherorte FR/BE; US-Unterauftragsverarbeiter DPF/SCC; Rechtsgrundlagen; Speicherdauer der Einladung | Vertragspartner: Betr. **Speicherdauer: Löschpfad für abgelaufene Einladungen fehlt** → Frist erst nennen, wenn umgesetzt (Vorschlag: als D8-Ergänzung in Paket DM) |
| 76–78 (Mail) | **Art.-14-Hinweis in der Einladungs-Mail** mit Link zur Erklärung → `src/mail.ts:63-85` (Text und HTML) + `test/unit/mail.test.ts` | sofort |
| 83–85 | Push: Payload verschlüsselt; Dienste ggf. USA; Speicherdauer der Push-Adresse | sofort |
| 91–94 | Speicherungen aufzählen; „§ 25 Abs. 2 Nr. 2 TDDDG“; Zeilenumbruch glätten; Offline-Cache beim Abmelden löschen | sofort |
| neu | Abschnitt „Datensicherung“ (Formulierung aus Recherche 5) | **A** (nicht vorher) |
| neu | Abschnitt „Kontakt per E-Mail“: Zweck, lit. b/f (Recherche 2.3, Zeile E-Mail-Kontakt), Speicherdauer, Postfach-Anbieter (bei Gmail: Google Ireland / Google LLC, DPF) | D4 + Betr (Frist) |
| neu | Abschnitt „Empfänger und Drittlandübermittlung“ (Kurzfassung Recherche 10) | sofort; Northflank-Zeile D1 |
| neu (Fremdbilder) | Satz zu direkt geladenen Rezeptbildern, siehe [DM-3-light](2026-10-07-paket-dm-datenminimierung-detailplan.md): „Rezeptbilder werden direkt vom Server der Quellseite geladen; dabei erhält dieser deine IP-Adresse.“ Rechtsgrundlage lit. f, Hinweis auf Widerspruch (Art. 21) | sofort |
| neu | Importkontingent (Zähler pro Tag) | **B** |
| 100–101 | konkrete Höchstfristen der Anbieter | Betr |
| 103–104 | Fehlerberichte: „ohne Verknüpfung … bis zu [X Monate]“, keine Anonymität versprechen | **DM8** + Betr (Frist) |
| 104–105 | „innerhalb eines Monats“; Kopien bei anderen bleiben bestehen | sofort |
| neu (§ 11) | Backup-Satz „bis zu 35 Tage“ | **A** |
| 109–118 | Art. 21 als eigener, hervorgehobener Absatz (Art. 21 Abs. 4); Datenübertragbarkeit „auf Anfrage maschinenlesbar“ | sofort |
| 120–121 | „Zuständig ist: …“ | Betr |
| Ende | „Stand“ ist bereits über `LegalPage` vorhanden; Satz zu Änderungen der Erklärung | sofort |

### 4.4 Platzierung der Links (Recherche 11.2 „Platzierung“)
**Optionen:**
- (a) Footer-Zeile mit `LegalLinks` unter der Rezeptliste `(tabs)/index.tsx`
- (b) Header-Eintrag oder Menü für Angemeldete in `(tabs)/_layout.tsx:75-87`
- (c) zusätzlich auf `share-invite/[token].tsx` (anonyme Empfänger)

Login-Seite (`account.tsx:630`) und Einstellungen bleiben.

**Empfehlung: (a) + (c).** Das bringt wenig UI-Risiko, und die Links sind ohne Untermenü erreichbar. `LegalLinks` bekommt zusätzlich „Nutzungsbedingungen“ (D9-light).

**Achtung:** Die Rezeptliste und `/` hängen an der statischen App-Shell (CLAUDE.md, Phase 4c). Nach der Änderung Bundle und LCP in CI messen und den LCP nicht verschieben (Footer am Listenende, nicht im Above-the-fold-Bereich).

### 4.5 Tests und Doku (D3a)
- `mobile/test/legal-pages.test.tsx`:
  - Erwartungen anpassen: Z. 38 Überschrift, Z. 39 E-Mail; der Platzhalter-Test Z. 34–41 wird nach dem Befüllen zu „kein Entwurfshinweis“.
  - Neue Fälle:
    - Art. 21 als eigener Absatz
    - c/o-Zeile nur bei gesetztem `careOf`
    - Satz „nicht kommerzielles Open-Source-Projekt“ mit Lizenz-Link auf dem Impressum
    - `LEGAL_PLACEHOLDERS_OPEN` mit optionalen Feldern
- `mobile/test/root-layout-login-first.test.tsx:98`: Mock an die echte Liste angleichen.
- `test/unit/mail.test.ts`: Art.-14-Hinweis in Text und HTML.
- `npm run test:mobile:rntl-guard`; `mobile:release-gate` und `perf:bundle` in CI.
- CLAUDE.md:
  - Login-first-Abschnitt korrigieren
  - Routes-Tabelle (`impressum`, `datenschutz`, später `nutzungsbedingungen`)
  - Unsplash → Chefkoch (Recherche 3)
- TODO.md: Haken bei „Rechtliche Platzhalter fuellen“ (nach Betreiber-Daten).

**Akzeptanz D3a:** Keine eckigen Klammern mehr. Jede Zeile aus 4.1–4.3 mit Status [sofort], [Betr] oder [D4] ist umgesetzt. Kein Satz behauptet etwas, dessen Voraussetzung noch fehlt (Review gegen die Spalte „Abh.“). Die Links sind für Angemeldete ohne Einstellungen erreichbar. CI ist grün.
**Akzeptanz D3b:** Die Zeilen [D1], [D5], [A], [DM6/7/8], [B] und [Cob] sind nachgezogen, `LEGAL_LAST_UPDATED` ist aktualisiert, das VVT ist abgeglichen.
**Risiken:**
- Text und Technik laufen auseinander → jede DM-, A- oder B-PR bekommt einen Checklistenpunkt „Datenschutztext/VVT“.
- Es gibt nur ein `LEGAL_LAST_UPDATED` für alle Seiten → beim Anlegen von `/nutzungsbedingungen` pro Seite trennen (siehe 5).

**Betreiber-Daten:** E1, E2, E5, Brevo-Vertragspartner, Supabase-Dashboard-Dokumente, Logfristen, Cobalt, Frist für Fehlerberichte.
**Aufwand:** D3a M, D3b S.

---

## 5. D9-light — Nutzungsbedingungen als statische Seite

**Entscheidung 2026-10-09:** Nutzungsbedingungen sind nicht vorgeschrieben (Recherche 9.1), ein Zustimmungsnachweis ist ohne Entgelt und ohne Vertragsrisiko entbehrlich. Es gibt deshalb **keine Migration, keine `user_profiles`-Spalten, kein `POST /auth/terms`, kein Gate, keine Checkbox, keine Versionskonstante**. Die Bestandskonten-Frage entfällt.

**Inhalte (nur aus der Recherche, bewusst kurz):**
1. unentgeltlicher Dienst, keine Verfügbarkeitszusage, Recht zur Einstellung (9.1 Nr. 4)
2. Mindestalter 16 (9.4; betrifft die Push-Einwilligung nach Art. 8 DSGVO)
3. Haftung **nur** im Rahmen von § 309 Nr. 7 BGB: keine Begrenzung bei Leben, Körper, Gesundheit und bei grober Fahrlässigkeit (Faktencheck verify-3 F1)
4. Nutzerpflichten: keine rechtswidrigen Inhalte, Urheberrecht, Import nur zum privaten Gebrauch (9.2)
5. Meldeadresse für rechtswidrige Inhalte (die Kontakt-E-Mail), ein Satz zum Verfahren (9.3, Anwendbarkeit umstritten, kostet nichts)
6. BYOK: Groq-Konto und -Bedingungen des Nutzers, Groq Acceptable Use Policy (9.1)
7. Hinweis auf AGPL-3.0: Die Lizenz betrifft den Code, nicht den Betrieb des Dienstes (9.1)

Alles darüber hinaus (anwendbares Recht, Änderungsklausel) → **Gegenlesen**, keine eigene Rechtsaussage.

### Schritte (ein kleiner PR, zusammen mit oder nach D3a)
1. `mobile/app/nutzungsbedingungen.tsx` mit `LegalPage`-Rahmen.
2. Öffentlich erreichbar: `isPublicLoginFirstPath` (`mobile/utils/login-first-routing.ts:27-33`), `Stack.Screen` in `_layout.tsx`, Eintrag in `LegalLinks` (`LegalPage.tsx:69-80`).
3. Signup (`account.tsx`, Signup-Modus): ein Hinweistext unter dem Formular, **ohne** Pflicht-Checkbox: „Mit der Registrierung gelten die [Nutzungsbedingungen]. Du musst mindestens 16 Jahre alt sein. Hinweise zur Datenverarbeitung: [Datenschutzerklärung].“ Das ist nur ein Hinweis mit Link, die Datenschutzerklärung ist keine Einwilligung (Recherche 2.3, lit. b).
4. `LegalPage` bekommt ein optionales `lastUpdated`, damit die Seiten getrennt datiert werden.
5. Tests: Seiten-Render (`mobile/test/legal-pages.test.tsx` erweitern), `login-first-routing.test.ts` um `/nutzungsbedingungen`, Signup-Hinweis sichtbar (`account-entry-and-auth.test.tsx`); danach `npm run test:mobile:rntl-guard`.
6. Doku: CLAUDE.md (Routes-Tabelle, Login-first-Abschnitt), TODO.

**Akzeptanz:** `/nutzungsbedingungen` ist anonym erreichbar, der Signup zeigt den Hinweis, kein Schema ändert sich, CI ist grün.
**Risiko:** Ohne Zustimmungsnachweis lässt sich die Geltung der Bedingungen im Streitfall schwerer belegen. Bei einem unentgeltlichen, nicht kommerziellen Dienst ist das ein akzeptiertes Restrisiko (Betreiberentscheidung); Wiedervorlage über Abschnitt 9.
**Aufwand:** S.

---

## 6. Betreiber-Entscheidungen (mit Empfehlung)

| # | Frage | Empfehlung |
|---|---|---|
| E1 | Privatanschrift oder c/o mit **schriftlicher** Zustellvollmacht (Recherche 1.3) | Privatanschrift, solange kein Service mit Zustellvollmacht vorliegt; ein reiner Postweiterleitungsdienst reicht nicht |
| E2 | Daten für `legal-operator.ts` liefern (Name, Anschrift, Bundesland) | – (Voraussetzung für D3a) |
| E3 | Kontaktadresse: EU-Postfach mit AVV (B), Cloudflare Routing → Gmail (A) oder Gmail behalten (C) | **B**; ersatzweise A mit offengelegtem Gmail |
| E4 | Zweiter Kontaktweg: Formular oder Telefon | **entfällt** (2026-10-09), nur E-Mail; Wiedervorlage über 0a |
| E5 | Aufsichtsbehörde (folgt aus dem Bundesland) | nach Recherche 8 |
| E6 | Limits Kontaktformular | **entfällt** (kein Formular) |
| E7 | Speicherung der Zustimmung | **entfällt** (kein Nachweis, 2026-10-09) |
| E8 | Bestandskonten | **entfällt** (kein Gate) |
| E9 | Zustimmung erzwingen | **entfällt**; nur Hinweis mit Link im Signup |
| E10 | Impressum: VSBG-Satz entfernen? Hinweis „nicht kommerzielles Open-Source-Projekt“ aufnehmen? Überschrift „§ 18 MStV und § 5 DDG“ oder neutral? | Satz entfernen; Hinweis **aufnehmen (verbindlich, 2026-10-09)**; Überschrift mit beiden Normen |
| E11 | Ablageort VVT und DPAs | **Vault** `Projekte/RecipeDeck/Recht/` (Backup des Vaults sicherstellen) |
| E12 | Fristen: Kontakt-Mails, Fehlerberichte (D8), Logfristen der Anbieter | vom Betreiber festlegen; ohne Frist bleibt die Zeile in D3 offen |
| E13 | Platzierung der Rechtslinks für Angemeldete | Footer unter der Rezeptliste + Share-Invite-Seite |
| E14 | D3 in zwei Stufen (D3a jetzt, D3b nach A/DM/D1) | **ja** |
| E15 | Löschpfad für abgelaufene Einladungen (Befund) | als Ergänzung zu D8 in Paket DM aufnehmen |

| E16 | Monetarisierungs-Grenze (0a) und Lizenz (Abschnitt 8) | **beschlossen 2026-10-09**; beim Gegenlesen ausdrücklich bestätigen lassen, dass Spenden ohne Gegenleistung unkritisch sind |

**Gegenlesen (Recherche 12 Nr. 18):** erst nach D3b und D9-light an eine fachkundige Stelle geben, damit ein vollständiger Stand geprüft wird. Dabei ausdrücklich fragen: (1) trägt die Annahme „§ 5 DDG greift nicht“, (2) genügt die Hotlink-Offenlegung (DM-3-light), (3) ist der Verzicht auf den Zustimmungsnachweis vertretbar.

---

## 7. Nebenbefunde (nicht Teil von R, aber beim Prüfen aufgefallen)
1. CLAUDE.md sagt, im Login-first-Modus sei nur `/account` erreichbar. Laut Code sind auch `/impressum`, `/datenschutz`, `/+not-found` und `/share-invite/*` öffentlich (`mobile/utils/login-first-routing.ts:27-33`). → Korrektur in D3a.
2. `mobile/test/root-layout-login-first.test.tsx:98` bildet `isPublicLoginFirstPath` enger nach als der echte Code. → Korrektur in D3a.
3. Abgelaufene Rezept-Einladungen (inkl. Empfänger-E-Mail) werden nicht gelöscht (`src/db-react.ts:1396`). → E15, Paket DM.
4. Der Bootstrap läuft nur im Account-Screen (`account.tsx:190`), nicht bei jedem App-Start. → mit dem Wegfall des Gates nicht mehr relevant für R; nur beachten, falls D9 später doch ein Gate bekommt (Archiv).

## Kritische Dateien für die Umsetzung
- `mobile/utils/legal-operator.ts`
- `mobile/app/datenschutz.tsx`, `mobile/app/impressum.tsx`
- `mobile/app/account.tsx` (Signup-Hinweis), `mobile/app/_layout.tsx`, `mobile/utils/login-first-routing.ts`, `mobile/app/nutzungsbedingungen.tsx` (neu)
- `src/mail.ts` (Art.-14-Hinweis in der Einladungs-Mail); DNS-Schritte für D4a in `docs/domain-mail-infra-runbook.md`

---

## 8. Lizenz (neu, 2026-10-09)

Das Repo ist öffentlich, hat aber weder `LICENSE` noch ein `license`-Feld in den `package.json`; rechtlich gilt damit „alle Rechte vorbehalten“. Beschlossen: **AGPL-3.0-or-later** (Netzwerk-Klausel passt zu einem gehosteten Dienst; verhindert geschlossene gehostete Forks). Eine Lizenz **mindert keine Betreiberpflichten** (Recherche 9.1: Lizenz-Disclaimer ≠ Haftungsausschluss für den Dienst); sie ist Voraussetzung dafür, dass andere den Code legal nutzen und selbst hosten dürfen.

Umfang (kleiner PR, unabhängig von D3):
1. `LICENSE` (offizieller AGPL-3.0-Text, unverändert).
2. `package.json` und `mobile/package.json`: `"license": "AGPL-3.0-or-later"`.
3. `README.md`: Abschnitt „Lizenz“ mit zwei Sätzen: Code unter AGPL-3.0; **Name „RecipeDeck“ und Logo sind nicht mitlizenziert**. Zweiter Satz: Die Instanz `www.recipedeckapp.de` ist ein unentgeltlicher Best-Effort-Dienst ohne Verfügbarkeitszusage; Selbst-Hosting ist möglich.
4. Vorab `npx license-checker --production --summary` (Root und `mobile/`): kein Paket mit einer zu AGPL-3.0 unverträglichen Lizenz (z. B. proprietäre oder „non-commercial“-Lizenzen). Fonts, Icons und Bildassets einzeln prüfen (`Logo.png` ausnehmen).
5. Impressum (4.2, Zeile „Ende“) verlinkt den Quellcode und die Lizenz.
6. Hinweis: Ein großer Teil des Codes ist KI-generiert (CLAUDE.md, „Origin“). Die urheberrechtliche Lage ist unklar; für die Lizenzierung genügt es, dass der Betreiber die Rechte hält, die er hat. Keine Contributor-Vereinbarung nötig, solange keine fremden PRs gemergt werden; bei der ersten externen Contribution `CONTRIBUTING.md` mit DCO-Hinweis ergänzen.

**Aufwand:** S. **Entscheidung offen:** AGPL-3.0 (empfohlen) oder MIT, falls bewusst keine Copyleft-Wirkung gewünscht ist.

---

## 9. Archiv — ursprüngliche Fassungen (nur bei Trigger wieder aufnehmen)

**Trigger:** Monetarisierung (0a), Behörden- oder Anwaltsschreiben, Plattform-/Store-Vorgaben, die ein Formular bzw. Zustimmung verlangen, oder Gegenlesen mit anderem Ergebnis.

### Archiv D4b — Öffentliches Kontaktformular (PR)

**Optionen zweiter Kontaktweg:**

| Option | Vorteile | Nachteile |
|---|---|---|
| Telefonnummer | kein Code | Private Nummer wird öffentlich. Laut Recherche nicht nötig, wenn ein Formular existiert |
| **Formular `/kontakt`** | nicht anonymisierungsbedürftig, kein Anruf-Spam | Code, Spam-Schutz, Brevo-Kontingent |

**Empfehlung:** Formular.

**Server**
- Neue Datei `src/routes/contact.ts`, eingebunden in `src/api-react.ts` (Muster Z. 25–35).
- Endpoint `POST /api/v1/contact`, **bewusst ohne Auth**.
  - Body: `{ email, name?, subject?, message, website /* Honeypot */, startedAt }`.
  - Zod-Validierung: E-Mail-Format; `message` 10–5000 Zeichen; Name/Betreff ≤ 200 Zeichen.
  - Honeypot gefüllt → `204` ohne Versand (stille Abweisung).
  - `startedAt` jünger als ca. 3 s → `204` ohne Versand.
- Rate-Limit: In-Memory pro IP (Muster `src/middleware/facebook-rate-limit.ts`, IP-Ermittlung wie `extraction.ts:110-113`), z. B. 3 pro Stunde. Zusätzlich ein globaler Tageszähler, z. B. 20 pro Tag, weil das Brevo-Kontingent von 300/Tag mit Auth und Einladungen geteilt wird. Antwort `429` mit deutscher Meldung und Verweis auf die E-Mail-Adresse.
  - Kein DB-Table. Damit entfällt die Account-Deletion-Smoke-Frage, und die IP bleibt nur im RAM. Das passt zur bestehenden Aussage in der Datenschutzerklärung.
- Versand: In `src/mail.ts` eine neue Funktion `sendContactMessage(input)` (gleiche Brevo-Grenze, Escaping wie `:87-94`).
  - `to` = feste Betreiberadresse aus der Env `CONTACT_EMAIL_TO`.
  - `sender` = `CONTACT_EMAIL_FROM` (z. B. `kontakt@` oder `noreply@`).
  - `replyTo` = die Adresse des Absenders.
  - **Keine Kopie an den Absender** (sonst nutzbar als Spam-Relay an beliebige Adressen).
- Keine Speicherung in der DB. Logs nur mit Status, ohne Inhalt oder Adresse (wie `auth.ts:120-121`).
- Konfiguration über drei neue Northflank-Variablen (Env-Ersatz-Stolperstein beachten). Ohne Konfiguration antwortet der Endpoint mit `503 contact_unavailable` und verweist auf die E-Mail.

**Mobile**
- `mobile/app/kontakt.tsx` mit `LegalPage`-Rahmen: Formular, Pflichthinweis „Mit dem Absenden verarbeiten wir deine Angaben zur Beantwortung, siehe Datenschutzerklärung“ mit Link. Text siehe D3.
- `/kontakt` in `isPublicLoginFirstPath` aufnehmen (`login-first-routing.ts:27-33`).
- `Stack.Screen name="kontakt"` in `_layout.tsx` (bei `:302-303`).
- „Kontakt“ in `LegalLinks` (`LegalPage.tsx:69-80`).
- In `legal-operator.ts` das neue Feld `contactFormPath: '/kontakt'` (Recherche 11.1 „neu“). Auf dem Impressum als Link rendern (Recherche 11.2 Z. 18–19). Das macht D3; D4b liefert nur die Seite.

**Tests**
- `test/unit/contact-routes.test.ts`:
  - Validierung (400)
  - Honeypot und Mindestdauer (204, ohne Versand)
  - IP-Limit (429)
  - Tageslimit (429)
  - Brevo nicht konfiguriert (503)
  - Erfolg (Brevo-`fetch` gemockt; `replyTo` = Absender, `to` = fest)
  - HTML-Escaping der Nachricht
- `test/unit/mail.test.ts` erweitern.
- `mobile/test/contact-page.test.tsx` (RNTL; nach dem Ändern `npm run test:mobile:rntl-guard` ausführen).
- `mobile/test/login-first-routing.test.ts` um `/kontakt` erweitern.
- Contract-Test in `test/e2e/contract-api.test.ts`: erreichbar ohne Auth, 400 bei leerem Body.
- Verifikation: `npm test -- --run --exclude="test/e2e/**"` und `npm run mobile:release-gate` (beide komplett, nicht gepipt; `mobile:release-gate` nur in CI, nicht lokal).

**Doku:** CLAUDE.md (Endpoint-Tabelle; Route Auth Inventory: Zeile `contact`, „open-by-design, IP- und Tageslimit, kein Speicher“; Routes-Tabelle; Abschnitt Login-first gate korrigieren), TODO.md.

**Akzeptanz:** Anonym ist `/kontakt` im Web und nativ erreichbar. Eine Nachricht kommt beim Betreiber an, Antworten gehen über Reply-To an den Absender. Die vierte Anfrage pro Stunde von derselben IP ergibt `429`. Im Server-Log stehen keine Inhalte. CI ist grün.
**Risiken:**
- Spam trotz Honeypot → Turnstile erst in Phase 2 (wie Paket B, CAPTCHA).
- In-Memory-Limits gehen beim Redeploy verloren; bei einer Instanz akzeptabel (siehe CLAUDE.md zum Job-Manager).
- `x-forwarded-for` ist fälschbar, falls Northflank den Header nicht überschreibt → wie beim Facebook-Limit hingenommen. Das Tageslimit ist die eigentliche Schranke.

**Betreiber-Daten:** E3 (Postfach), E4 (Formular oder Telefon), Limits (E6).
**Aufwand:** D4a S, D4b M.

### Archiv D9 — Nutzungsbedingungen mit Zustimmung beim Signup

**Rechtlicher Rahmen (Recherche 9.1–9.4):** Nutzungsbedingungen sind nicht vorgeschrieben, aber empfohlen.

**Inhalte nur aus der Recherche:**
1. unentgeltlicher Nutzungsvertrag als Grundlage für lit. b
2. Mindestalter 16 (Art. 8 DSGVO wegen der Push-Einwilligung; Konto nach §§ 106 ff. BGB)
3. Haftungsbegrenzung **nur** im Rahmen von § 309 Nr. 7 BGB: keine Begrenzung bei Leben, Körper und Gesundheit (schon bei leichter Fahrlässigkeit) und bei grober Fahrlässigkeit (Faktencheck verify-3 F1)
4. keine Verfügbarkeitszusage, Recht zur Einstellung
5. Nutzerpflichten: keine rechtswidrigen Inhalte, Urheberrecht, Import nur zum privaten Gebrauch (9.2)
6. Meldeweg und Moderation (DSA Art. 14/16, Anwendbarkeit umstritten, Wortlaut nicht verifiziert)
7. BYOK: Groq-Konto und -Bedingungen des Nutzers, Groq Acceptable Use Policy (9.1)
8. Die Open-Source-Lizenz ist kein Haftungsausschluss für den Dienst (9.1)

Alles darüber hinaus (z. B. anwendbares Recht, Änderungsklausel) → **Gegenlesen**, keine eigene Rechtsaussage.

### Optionen — Speicherung der Zustimmung
| Option | Beschreibung | Löschung / Smoke |
|---|---|---|
| **A. Spalten an `user_profiles`** | `terms_version text`, `terms_accepted_at timestamptz` + CHECK (beide null oder beide gesetzt) | Cascade über `auth.users` (Migration `20261007120000:110-111`). Keine neue User-ID-Spalte → `COVERED_USER_COLUMNS` unverändert; Smoke **trotzdem laufen lassen** |
| B. Eigene Tabelle `terms_acceptances(user_id, version, accepted_at)` mit Historie | Nachweis jeder Fassung | **Neue `user_id`-Spalte → Pflicht:** in `private.delete_user_account` aufnehmen (oder FK mit `ON DELETE CASCADE` auf `auth.users`) **und** in `COVERED_USER_COLUMNS` (`scripts/supabase/account-deletion-smoke.ts:130`), sonst wird CI rot; RLS an ohne Policies + Eintrag in der RLS-no-policy-Klassifizierung |

**Empfehlung: A.** Es reicht die zuletzt akzeptierte Fassung. Eine Historie nach dem Löschen des Kontos ist sinnlos, und das Schema bleibt minimal.

### Optionen — Zustimmung beim Signup erfassen
| Option | Problem |
|---|---|
| Checkbox nur im Client, Speicherung beim Bootstrap per Body-Feld | Bei Signup mit E-Mail-Bestätigung (`account.tsx:256-264`) geht der Client-Zustand verloren, wenn der Bestätigungslink in einem anderen Tab oder auf einem anderen Gerät geöffnet wird |
| **Checkbox → `signUp({ options: { data: { terms_version } } })` → `user_metadata` → Bootstrap übernimmt serverseitig** | übersteht die Bestätigung; der Zeitpunkt wird serverseitig gesetzt |
| Nur nachgelagertes Gate nach dem ersten Login | eine zusätzliche Hürde nach dem Signup |

**Empfehlung:** Metadaten-Weg für neue Konten **plus** Gate für Bestandskonten, neue Fassungen und OAuth (Paket O hat keinen Signup-Schritt).

### Schritte (ein PR)
1. **Migration** `supabase/migrations/<ts>_user_profiles_terms_acceptance.sql`: zwei Spalten + CHECK. `src/schema.ts:171-179` nachziehen. Optional `mobile/db/schema.ts` (Typ-Spiegel). Production nur über den Workflow *Apply Supabase Migrations*.
2. **Versionskonstante:**
   - `TERMS_VERSION` (z. B. ein Datum) in `src/legal-terms.ts` und in `mobile/utils/legal-operator.ts`.
   - Drift-Guard-Test nach dem Muster `test/unit/ingredient-category-domain-drift.test.ts` (CLAUDE.md „Erzwungene Duplikate“).
   - `LegalPage` bekommt ein optionales `lastUpdated`, damit Nutzungsbedingungen und Datenschutzerklärung getrennt datiert werden.
3. **Server:**
   - `verifyAccessToken` (`src/auth.ts:146-161`) gibt zusätzlich `user_metadata.terms_version` und `created_at` zurück, ohne Änderung an `UserAuthContext` für andere Routen; alternativ nur im Bootstrap erneut `getUser` aufrufen.
   - `ensureUserProfile` bzw. neue Funktion `recordTermsAcceptance(userId, version, acceptedAt)` in `src/db-react.ts`. Gesetzt wird nur, wenn die Version gleich der aktuellen ist und das Profil keine gleiche oder neuere Version hat. `acceptedAt` = Server-Zeit (bei Übernahme aus den Metadaten der `created_at` des Auth-Users, also nicht aus dem Client).
   - `POST /api/v1/auth/bootstrap` (`src/routes/auth.ts:24-90`) übernimmt die Metadaten-Zustimmung und liefert `terms: { acceptedVersion, currentVersion, required }`.
   - `GET /api/v1/auth/me` (`:10-19`) liefert dasselbe `terms`-Objekt.
   - Neu `POST /api/v1/auth/terms` (`requireUserAuth`): Body `{ version }`; 400, wenn die Version ungleich der aktuellen ist; idempotent.
   - Serverseitige Durchsetzung (409 `terms_required` an schreibenden Routen): **nicht in v1** (Entscheidung E9).
4. **Mobile:**
   - `mobile/app/nutzungsbedingungen.tsx` (`LegalPage`).
   - Öffentlich: `isPublicLoginFirstPath`, `Stack.Screen`, `LegalLinks`.
   - In `account.tsx` im Signup-Modus (`:586-605`) eine Checkbox („Ich bin mindestens 16 Jahre alt und akzeptiere die [Nutzungsbedingungen]“; Datenschutzerklärung nur als **Hinweis mit Link**, nicht als Einwilligung, weil die Grundlage laut Recherche 2.3 lit. b ist).
     - `Pressable` mit `accessibilityRole="checkbox"` und `accessibilityState={{checked}}`; im Repo gibt es noch keine Checkbox-Komponente.
     - `handleSignUp` (`:228`) bricht ohne Häkchen mit einer Inline-Meldung ab.
     - `signUpWithPassword` (`mobile/utils/auth.ts:149-188`) bekommt einen Parameter `termsVersion` → `options.data`.
   - `AccountBootstrapResponse` (`mobile/utils/account-bootstrap.ts:3-24`) um `terms` erweitern.
   - **Gate:** Im Root-Layout `_layout.tsx` bei `authState === 'signed_in'` einen Query auf `/api/v1/auth/me` (Cache-Key mit `mobile/utils/admin.ts:23` abstimmen). Bei `required` ein blockierendes Modal oder eine Seite mit Checkbox und drei Aktionen: „Akzeptieren“ (POST), „Abmelden“, „Konto löschen“ (→ `/account`). Öffentliche Pfade und `/account` werden nicht blockiert.
   - Offline-Verhalten: Ist `/auth/me` nicht erreichbar, nicht blockieren (Offline-Lesen bleibt möglich), beim nächsten Online-Start erneut prüfen.
5. **Tests:**
   - Unit `recordTermsAcceptance`: Erstannahme, idempotent, ältere Version wird ignoriert.
   - Route-Tests in `test/unit/auth-bootstrap-routes.test.ts`: Übernahme aus den Metadaten, `terms`-Objekt.
   - Neuer Test für `POST /auth/terms`: 401, 400 falsche Version, 200.
   - Drift-Test für die Version.
   - Mobile: Signup ohne Häkchen wird blockiert, mit Häkchen gehen `options.data` raus (`mobile/test/account-entry-and-auth.test.tsx`); Gate-Test im Root-Layout (`root-layout-login-first.test.tsx`); Seiten-Render; `login-first-routing.test.ts` um `/nutzungsbedingungen` erweitern.
   - `supabase-rls-smoke` (RLS + **Account-Deletion-Smoke**): `seedFullUser` setzt die Terms-Spalten, die Löschung hinterlässt keine `user_profiles`-Zeile (bereits über `countReferences` abgedeckt).
   - Root-Unit und RNTL-Guard lokal; `mobile:release-gate` in CI.
6. **Doku:** CLAUDE.md (Endpoints, Route Auth Inventory „`auth/terms` POST, user-scoped“, Routes), D3-Nachtrag in der Datenschutzerklärung (Zustimmungsspeicherung), VVT Nr. 1, TODO.

### Bestandskonten
Nach dem Deploy sehen alle bestehenden Konten das Gate einmal. Wer nicht zustimmt, kann sich abmelden oder das Konto löschen. Alternative: Bestandskonten pauschal behandeln wie Zustimmende. **Nicht empfohlen**, weil es keinen Nachweis gibt (Entscheidung E8).

**Akzeptanz:**
- Neues Konto mit E-Mail-Bestätigung → nach dem Bootstrap stehen `terms_version` und `terms_accepted_at` gesetzt.
- Signup ohne Häkchen ist nicht möglich.
- Ein Bestandskonto sieht das Gate genau einmal.
- Ein Versionssprung löst das Gate erneut aus.
- Nach einer Kontolöschung bleibt keine Profilzeile übrig (Smoke grün).
- `/nutzungsbedingungen` ist anonym erreichbar.

**Risiken:**
- `user_metadata` kann der Nutzer selbst schreiben → das ist unkritisch, weil es seine eigene Erklärung ist. Der Zeitpunkt kommt vom Server.
- Ein Gate-Fehler könnte die App für alle sperren → bei Netz- oder 5xx-Fehlern nicht blockieren, Feature-Konstante als Notschalter.
- Die Versionskonstante doppelt → Drift-Test.
- Paket O (OAuth) muss das Gate nutzen → im Grobplan O vermerken.

**Betreiber-Daten:** Anbieterangaben (aus D3), Prüfung und Freigabe des Textes, E7–E9.
**Aufwand:** L (Text M, Mechanik M–L).

