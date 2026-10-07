# RecipeDeck – Recherche Impressum & Datenschutz (Stand 07.10.2026)

> **Keine Rechtsberatung.** Dieses Dokument ist eine Quellensammlung mit Einordnung für den Betreiber. Es ersetzt keine anwaltliche Prüfung. Wo die Rechtslage offen ist, steht das dabei. Vor dem öffentlichen Start sollte der fertige Text von einer fachkundigen Stelle gegengelesen werden (Anwalt, Verbraucherzentrale oder mindestens ein Abgleich mit einem Generator wie eRecht24 bzw. Datenschutz-Generator.de).

> **Faktencheck 07.10.2026.** Alle Aussagen dieses Dokuments wurden in drei unabhängigen Durchgängen gegen live abgerufene Primärquellen geprüft (Gesetzestexte, EUR-Lex, Anbieter-AGB und -DPAs, DPF-Register-API, Behördenseiten, Urteile bzw. deren Fundstellen, Repo-Code). Ergebnis: **31 Aussagen korrigiert** (1 falsch, 30 teilweise zutreffend), **rund 30 bestätigte Aussagen präzisiert** (Fundstellen, Zitatherkunft, Daten), **7 Ergänzungen** eingearbeitet, **10 Punkte** als „(nicht verifiziert, Stand 07.10.2026)“ markiert. Die Prüfprotokolle mit wörtlichen Zitaten und URLs liegen unter `docs/legal/faktencheck/` (`verify-1-impressum.md`, `verify-2-processors.md`, `verify-3-dsgvo.md`). Was nur der Betreiber klären kann, steht gesammelt in Abschnitt 12.

> **Sicherheitsgrade:** **klar** = Gesetzeswortlaut oder gefestigte Rechtsprechung · **h. M.** = herrschende Meinung / Behördenpraxis · **umstritten** = offene Rechtsfrage, Restrisiko.
>
> **Abrufdatum aller Quellen:** 07.10.2026, sofern nicht anders angegeben. Den DPF-Status hat der Bearbeiter am 07.10.2026 direkt über die öffentliche Such-API der DPF-Liste (`dpfapi.azurewebsites.net/api/participants`, die Datenquelle hinter dataprivacyframework.gov/list) abgefragt.
>
> **Geprüfte Repo-Dateien:** `mobile/utils/legal-operator.ts`, `mobile/app/impressum.tsx`, `mobile/app/datenschutz.tsx`, Plan `docs/superpowers/plans/2026-10-07-vor-start-backups-kostenschutz-recht-plan.md` (Abschnitt C und „Entscheidungen“), `TODO.md` (Eintrag „Recherche: rechtliche Pflichten …“) sowie zur Faktenprüfung `src/schema.ts`, `src/routes/extraction.ts`, `src/utils/image-search.ts`, `src/job-manager.ts`, `mobile/components/BugReportModal.tsx`, `mobile/app/(tabs)/extract.tsx`, `mobile/utils/image-compress.ts`, `supabase/migrations/20261007120000_account_deletion.sql`.

---

## 0. Kurzfazit – was der Betreiber tun muss (priorisiert)

### P1 – vor der öffentlichen Registrierung (Pflicht oder hohes Risiko)

1. **Name und ladungsfähige Anschrift ins Impressum.** Das ist unabhängig vom Streit um § 5 DDG nötig: § 18 Abs. 1 MStV verlangt *Name und Anschrift* von jedem Telemedienanbieter, dessen Angebot nicht *ausschließlich persönlichen oder familiären Zwecken* dient. Eine öffentlich zugängliche App mit Registrierung für Dritte erfüllt das (**klar**; Subsumtion plausibel, aber nicht verifiziert, Stand 07.10.2026). Ein Verstoß ist selbst eine Ordnungswidrigkeit mit Geldbuße bis 50.000 € (§ 115 Abs. 1 Satz 2 Nr. 1, Abs. 2 MStV).
   - Möglich ist die Privatanschrift oder eine c/o-Anschrift **nur mit schriftlicher Zustellvollmacht** (§ 171 ZPO).
   - **BGH, Urt. v. 07.07.2023 – V ZR 210/22:** Die Adresse eines Postdienstleisters, der lediglich mit der Weiterleitung der Post beauftragt ist, ist für eine natürliche Person **keine** ladungsfähige Anschrift (Prozessrecht, Klageschrift). Ein reiner Postweiterleitungsdienst scheidet damit praktisch aus.
   - Ob ein Impressums-Service **mit** Zustellvollmacht für Privatpersonen genügt, hat der BGH offengelassen (**umstritten**).
2. **E-Mail plus zweiter schneller Kontaktweg** (Kontaktformular ohne Login oder Telefonnummer). Pflicht nur, wenn § 5 DDG greift, und das ist bei RecipeDeck offen (**umstritten**). Weil es wenig kostet, wird es vorsorglich empfohlen.
3. **AVV mit Northflank beschaffen.** Northflank veröffentlicht keinen DPA. Die ToS (Stand 2021) enthalten keine Regelung nach Art. 28 DSGVO. Anfordern über `legal@northflank.com` oder das Trust Center (trust.northflank.com). Bei der Anfrage auch die konkrete Region und die Unterauftragsverarbeiter erfragen (siehe 4.2). Bis dahin fehlt für das Hosting eine Grundlage nach Art. 28 Abs. 3 DSGVO (**klar**).
4. **AVV-Nachweise ablegen** (Art. 5 Abs. 2, Art. 28 Abs. 9 DSGVO). Supabase, Brevo, Groq und Cloudflare binden ihren DPA automatisch über die AGB ein. Trotzdem die jeweilige Fassung mit Datum als PDF archivieren. Bei Supabase zusätzlich die Dokumente unter *Organization → Legal Documents* (DPA, TIA) herunterladen (Dashboard-Inhalt nicht verifiziert, Stand 07.10.2026; nur mit Login einsehbar).
5. **Datenschutzerklärung korrigieren und ergänzen** (Details in Abschnitt 11):
   - Groq-Platzhalter ersetzen: Groq ist **nicht** DPF-zertifiziert. Grundlage sind die **EU-Standardvertragsklauseln** (Modul 2) im DPA zwischen dem Kunden und Groq UK Limited (Vertragspartner für Kunden im EWR). Für Weiterübermittlungen in die USA verpflichtet sich Groq, geeignete Garantien zu schaffen (DPA § 8.1).
   - Supabase-Vertragspartner korrigieren: Bei direkter Registrierung (nicht über einen Cloud-Marketplace) ist laut Terms § 1(j) **ausschließlich Supabase Pte. Ltd., Singapur** Vertragspartner, nicht „Supabase Inc.“. Die SCC (Modul 2) gelten bereits für die Übermittlung **an Supabase Pte. Ltd. selbst**, weil Singapur keinen Angemessenheitsbeschluss hat.
   - Northflank: Sitz UK, Angemessenheitsbeschluss bis 27.12.2031. Konkrete Region offen (ToS: „hosted in the United Kingdom“, angeboten werden auch Frankfurt, Niederlande, Zürich).
   - Brevo: Vertragspartner für in Deutschland ansässige Kunden voraussichtlich **Brevo GmbH, Berlin** (nicht Sendinblue SAS). Am Konto bzw. an der Rechnung prüfen.
   - Fehlende Rechtsgrundlagen, Speicherfristen und Empfänger ergänzen.
   - **Direkt geladene Rezeptbilder von Fremdservern** offenlegen: Die IP-Adresse geht an Dritte.
   - Fehlerbericht-Metadaten und deren Speicherfrist nennen, einschließlich der Spalte `route` und bei Import-Fehlern des `lastFailureSnapshot` (`submittedUrl`, `errorMessage`, `jobId`).
   - Backups mit maximaler Frist aufnehmen.
   - Widerspruchsrecht (Art. 21) getrennt hervorheben.
   - Konkrete Aufsichtsbehörde nennen.
6. **Verzeichnis von Verarbeitungstätigkeiten (Art. 30 DSGVO) anlegen.** Die Ausnahme für Stellen unter 250 Beschäftigten greift nicht, weil die Verarbeitung „nicht nur gelegentlich“ erfolgt (**h. M.**, DSK-Kurzpapier Nr. 1). Ein internes Dokument reicht, es wird nicht veröffentlicht. Zur geplanten Änderung durch das Omnibus-IV-Paket siehe P3 Nr. 14.
7. **Backups: feste Höchstfrist und Lösch-Nachlauf.** Der Plan sieht 14 tägliche und 4 wöchentliche Sicherungen mit **35 Tagen** Höchstfrist vor. In der Erklärung deshalb „spätestens 35 Tage“ angeben, nicht „ca. 30“. Zusätzlich ein Verfahren festlegen, das Löschungen nach einem Restore erneut ausführt (EDPB-CEF-Bericht 2025, angenommen 10.02.2026, Abschnitt 4.2.6).

### P2 – dringend empfohlen

8. **Nutzungsbedingungen** (gesetzlich nicht vorgeschrieben, aber sinnvoll). Inhalt: Mindestalter 16 (Art. 8 DSGVO für die einwilligungsbasierte Push-Funktion), unentgeltlicher Dienst ohne Verfügbarkeitszusage, Haftungsbegrenzung im Rahmen von § 309 Nr. 7 BGB, Pflichten der Nutzer bei Inhalten und Urheberrecht, Meldeweg für rechtswidrige Inhalte (DSA Art. 14/16, Anwendbarkeit **umstritten**; Wortlaut von Art. 14/16 nicht verifiziert, Stand 07.10.2026).
9. **Datenminimierung technisch:**
   - Bei Groq **Zero Data Retention** einschalten. Standardmäßig speichert Groq Anfragen **nicht**. Nur anlassbezogen (Fehleranalyse, Verdacht auf Missbrauch) können Ein- und Ausgaben bis zu 30 Tage protokolliert werden, länger nur bei gesetzlicher Pflicht. Mit ZDR entfällt auch dieses Logging.
   - **EXIF-Daten** (z. B. GPS) aus Foto-Uploads entfernen, bevor sie an Groq gehen und als Rezeptbild gespeichert werden. Serverseitig wird EXIF nie entfernt; im Web/PWA bleibt es sicher erhalten. In nativen Builds gehen EXIF-Daten bei der Neukodierung meist verloren, aber nicht garantiert (siehe 9.6).
   - **Fremdbilder serverseitig cachen** oder über einen Proxy laden statt per Hotlink.
10. **Fehlerberichte nach Kontolöschung wirklich anonymisieren.** `metadata_json` behält `activeHouseholdId`, `userAgent` und Ähnliches, bei Import-Fehlern außerdem den `lastFailureSnapshot` mit `submittedUrl` (vom Nutzer importierte URL), `errorMessage` und `jobId`. Die Route bleibt in der eigenen Spalte `route` erhalten. Dazu eine feste Löschfrist für Fehlerberichte festlegen.
11. **Kontaktadresse auf die eigene Domain umstellen** (z. B. `kontakt@recipedeckapp.de`) statt Consumer-Gmail. Für ein privates Gmail-Konto gibt es keinen AVV; Anbieter und Verantwortlicher ist für Nutzer im EWR **Google Ireland Limited** (**umstritten**, ob nötig – siehe Abschnitt 3).
12. **Backup-Lauf als Northflank-Cron-Job** – vom Betreiber am 07.10.2026 so entschieden (Plan, Abschnitt „Entscheidungen“ Nr. 1). Die frühere Alternative GitHub-Actions-Runner entfällt damit. Voraussetzung bleibt der Northflank-AVV (Nr. 3).

### P3 – beobachten

13. **Lage des EU-US-DPF:**
    - EuG hat die Klage am 03.09.2025 abgewiesen (T-553/23), das Rechtsmittel C-703/25 P ist anhängig (Stand 17.09.2026).
    - noyb hat am 29.06.2026 eine eigene Klage angekündigt. Bis 17.09.2026 war keine solche Klage als eingereicht bekannt (Faegre Drinker).
    - Der US Supreme Court hat in *Trump v. Slaughter* am 29.06.2026 (6:3) den Kündigungsschutz der FTC-Kommissare für verfassungswidrig erklärt und *Humphrey’s Executor* aufgegeben.
    - Der EDPB hat die Kommission am 31.07.2026 um eine genaue Prüfung („closely assess“) gebeten. Die Kommission analysiert nach eigener Aussage die Folgen („carefully analysing“).
    - Für RecipeDeck ist das wenig kritisch: Groq läuft ohnehin über SCC. Cloudflare, GitHub, Google und Brevo haben SCC als Rückfallebene.
14. **Omnibus-IV-Paket (Art. 30 Abs. 5 DSGVO):** Der Kommissionsvorschlag vom 21.05.2025 würde die Schwelle auf 750 Beschäftigte anheben und ein VVT nur noch bei voraussichtlich hohem Risiko verlangen. Im Juni 2026 lag er noch im Rat. Ob er bis 07.10.2026 verabschiedet wurde: nicht verifiziert, Stand 07.10.2026. Bis dahin gilt Nr. 6.

---

## 1. Impressum

### 1.1 Gilt § 5 DDG für ein unentgeltliches Open-Source-Angebot ohne Gewinnabsicht?

**Wortlaut:** § 5 Abs. 1 DDG erfasst „geschäftsmäßige, in der Regel gegen Entgelt angebotene digitale Dienste“. „Digitaler Dienst“ ist nach § 1 Abs. 4 Nr. 1 DDG ein Dienst im Sinne von Art. 1 Abs. 1 lit. b RL (EU) 2015/1535. Das ist der Begriff des Dienstes der Informationsgesellschaft, der seinerseits auf eine „in der Regel gegen Entgelt“ erbrachte Leistung abstellt.

**Auslegung (Rechtsprechung, h. M.):** Das OLG Hamburg (Beschl. v. 03.04.2007 – 3 W 64/07) hat zu § 5 TMG entschieden. Der Wortlaut ist nicht identisch: § 5 TMG sprach von „Telemedien“, § 5 DDG spricht von „digitalen Diensten“. Gleich ist das Tatbestandsmerkmal „geschäftsmäßig, in der Regel gegen Entgelt“. Das Gericht stützt sich auf die Gesetzesbegründung (BR-Drs. 556/06, S. 15, 20; BT-Drs. 16/3078, S. 14):

> „Vielmehr zeigt die Entstehungsgeschichte der Norm, dass mit diesem Tatbestandselement lediglich Internetangebote von privaten Anbietern und von Idealvereinen, mithin nicht-kommerzielle Angebote, aus dem Anwendungsbereich der Impressumspflicht ausgenommen werden sollten.“

Kern des Beschlusses ist allerdings, dass die Norm **nicht auf kostenpflichtige Dienste beschränkt** ist: „Somit ist die Norm dahingehend auszulegen, dass sämtliche kommerziellen Telemediendienste den Anforderungen des § 5 TMG unterliegen.“ Der Fall betraf ein kommerzielles Angebot (UWG-Verfahren). Als Beleg für eine Ausnahme zugunsten von RecipeDeck trägt die Entscheidung deshalb nur mittelbar.

Kostenlose Angebote mit kommerziellem Hintergrund fallen darunter, etwa Werbung, Affiliate-Links oder Kundenbindung. Die Begründung zum EGG (2001, zu § 6 TDG) definierte „geschäftsmäßig“ als nachhaltige Tätigkeit mit oder ohne Gewinnerzielungsabsicht: „Geschäftsmäßig handelt ein Diensteanbieter, wenn er Teledienste aufgrund einer nachhaltigen Tätigkeit mit oder ohne Gewinnerzielungsabsicht erbringt.“ (zitiert im IT-Recht-Onlinekommentar). Nach Auffassung der IT-Recht Kanzlei begründet schon jedes Setzen eines Links gegen Entgelt die Geschäftsmäßigkeit: „Die Höhe etwaig gezahlter Prämien ist unbeachtlich, sodass jedes Setzen eines Links gegen Entgelt die Geschäftsmäßigkeit bedingt …“. Eine Gerichtsentscheidung dazu nennt die Kanzlei an dieser Stelle nicht.

**Einordnung RecipeDeck:**

| Gegen § 5 DDG | Für § 5 DDG |
|---|---|
| Unentgeltlich, keine Werbung, kein Affiliate, Open Source, Privatperson, keine Gewinnabsicht | Dauerhaftes, auf unbestimmt viele Dritte ausgerichtetes Angebot mit eigener Domain und Marke („RecipeDeck“), Registrierung, Push, App-Charakter. Die EGG-Begründung 2001 ließ eine nachhaltige Tätigkeit auch ohne Gewinnerzielungsabsicht genügen. Kostet den Betreiber Geld (Infrastruktur), das spricht aber eher gegen Kommerzialität |

→ **umstritten.** Nach der Linie OLG Hamburg / Gesetzesbegründung spricht mehr dafür, dass § 5 DDG **nicht** greift, solange keinerlei Monetarisierung erfolgt: keine Spendenbuttons mit Gegenleistung, keine Werbung, kein Bezahl-Tier. Die EGG-Definition (nachhaltig, mit oder ohne Gewinnabsicht) ist das stärkste Gegenargument. Ändert sich die Monetarisierung, greift § 5 DDG sicher.

**§ 18 Abs. 1 MStV greift in jedem Fall** (**klar**). Wortlaut in der Fassung des Siebten Medienänderungsstaatsvertrags (in Kraft seit 01.12.2025): „(1) Anbieter von Telemedien, die nicht ausschließlich persönlichen oder familiären Zwecken dienen, haben folgende Informationen leicht erkennbar, unmittelbar erreichbar und ständig verfügbar zu halten: 1. Name und Anschrift sowie 2. bei juristischen Personen auch Name und Anschrift des Vertretungsberechtigten.“ Eine öffentlich nutzbare App ist nicht ausschließlich persönlich oder familiär (Subsumtion plausibel, deckt sich mit Schwenke; keine Quelle prüft den konkreten Fall – nicht verifiziert, Stand 07.10.2026).

**§ 18 Abs. 2 MStV** (Verantwortlicher für journalistisch-redaktionelle Angebote) greift nicht: RecipeDeck bietet keine redaktionellen Inhalte, Nutzerrezepte sind nicht öffentlich (**h. M.**).

**Sanktionen:**
- Bußgeld nach § 33 Abs. 2 Nr. 1 i. V. m. Abs. 6 Nr. 3 DDG bis 50.000 € bei Verstoß gegen § 5 DDG. In der Praxis werden Verstöße „fast nie als Ordnungswidrigkeit verfolgt“ (IHK München).
- **Auch der Verstoß gegen § 18 Abs. 1 MStV ist eine Ordnungswidrigkeit:** § 115 Abs. 1 Satz 2 Nr. 1 MStV („… entgegen § 18 Abs. 1 bei Telemedien den Namen oder die Anschrift … nicht oder nicht richtig verfügbar hält“), Geldbuße bis 50.000 € (§ 115 Abs. 2). Zuständig ist die Landesmedienanstalt (§ 115 Abs. 3).
- Wettbewerbsrechtliche Abmahnungen setzen eine geschäftliche Handlung voraus, das Risiko ist bei einem rein privaten, nicht kommerziellen Angebot gering (**h. M.**; ohne Quelle, nicht verifiziert, Stand 07.10.2026).
- Der MStV wird von den Landesmedienanstalten durchgesetzt (§ 109 Abs. 1, § 115 Abs. 3 MStV).

**Quellen:**
- § 5 DDG: https://www.gesetze-im-internet.de/ddg/__5.html
- § 1 DDG (Begriff digitaler Dienst): https://www.gesetze-im-internet.de/ddg/__1.html
- § 33 DDG: https://www.gesetze-im-internet.de/ddg/__33.html
- RL (EU) 2015/1535, Art. 1 Abs. 1 lit. b: https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32015L1535
- MStV (§ 18, § 109, § 115) in der Fassung des Siebten MÄStV, in Kraft seit 01.12.2025, offizielle nichtamtliche Textfassung der Medienanstalten: https://www.die-medienanstalten.de/fileadmin/user_upload/Rechtsgrundlagen/Gesetze_Staatsvertraege/Medienstaatsvertrag_MStV.pdf (gegengeprüft: https://bravors.brandenburg.de/vertraege/mstv/5)
- OLG Hamburg 3 W 64/07, zitiert in: https://www.it-recht-onlinekommentar.de/%C2%A7-5-tmg-allgemeine-informationspflichten/ · dejure: https://dejure.org/dienste/vernetzung/rechtsprechung?Gericht=OLG%20Hamburg&Datum=03.04.2007&Aktenzeichen=3%20W%2064/07 (openjur-Volltext per CAPTCHA gesperrt)
- IT-Recht Kanzlei, Impressum-FAQ: https://www.it-recht-kanzlei.de/impressum.html
- IHK München, Impressum: https://www.ihk-muenchen.de/ratgeber/recht/internetrecht/impressum/
- Schwenke, Ratgeber Impressum (Letzte Aktualisierung 06.05.2025, Metadaten 06.05.2026): https://datenschutz-generator.de/ratgeber-impressum/ – „Wer dagegen das eigene Onlineangebot ohne jeglichen kommerziellen Bezug betreibt, der muss neben Angaben zur Person und Namen (§ 18 Abs. 1 MStV) keine Kontaktmöglichkeiten und damit auch keine E-Mail-Adresse angeben.“ Außerdem: „Apps, sei es mobile Applikationen oder Web-Applikationen, stellen digitale Dienste dar und müssen ebenfalls ein Impressum bereithalten“; „Das Impressum kann in der App ausgeschrieben oder verlinkt werden“. Links, die erst in Untermenüs wie „Einstellungen“ zu finden sind, hält Schwenke für „nicht einfach erkennbar“ (siehe 11.2).

### 1.2 Welche Angaben genau?

| Angabe | § 18 Abs. 1 MStV (sicher) | § 5 DDG (falls anwendbar) | RecipeDeck |
|---|---|---|---|
| Vor- und Nachname | ja | ja (Nr. 1) | Pflicht |
| Anschrift (ladungsfähig) | ja | ja (Nr. 1) | Pflicht |
| E-Mail | nein | ja (Nr. 2) | vorhanden, beibehalten |
| zweiter schneller, unmittelbarer Kontaktweg | nein | ja (Nr. 2, EuGH C-298/07) | **fehlt**, ergänzen (empfohlen) |
| Register, USt-IdNr., Aufsichtsbehörde, Kammer | – | nur wenn vorhanden | entfällt |
| Verantwortlicher nach § 18 Abs. 2 MStV | – | – | entfällt (kein redaktionelles Angebot) |
| Hinweis Verbraucherschlichtung (§ 36 VSBG) | – | – | **nicht nötig**: § 36 gilt nur für „Unternehmer“. Die Ausnahme für Unternehmer mit zehn oder weniger Beschäftigten (Stichtag 31.12. des Vorjahres) gilt nur für Abs. 1 **Nr. 1**; die Hinweispflicht nach Nr. 2 bleibt. Für RecipeDeck folgenlos, weil kein Unternehmer. Darf als freiwilliger Satz bleiben |
| Link auf EU-OS-Plattform | – | – | **nicht mehr nötig**: Die VO (EU) Nr. 524/2013 ist mit Wirkung vom 20.07.2025 aufgehoben, die Plattform eingestellt (VO (EU) 2024/3228); Beschwerden waren schon seit 20.03.2025 nicht mehr möglich. Einen fortbestehenden Verweis hält wbs.legal für „unzulässig“ (UWG-Irreführung) – das ist eine Kanzleimeinung zu geschäftlichen Handlungen, keine Norm (**h. M.**) |

**Quellen:**
- § 36 VSBG: https://www.gesetze-im-internet.de/vsbg/__36.html
- VO (EU) 2024/3228: https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=OJ:L_202403228 · Kommission: https://consumer-redress.ec.europa.eu/site-relocation_en
- wbs.legal zur OS-Plattform: https://www.wbs.legal/it-und-internet-recht/eu-streitbeilegungsplattform-os-plattform-eingestellt-jetzt-impressum-aktualisieren-83428/

### 1.3 Privatanschrift, c/o-Adresse, Impressums-Service

- **Ladungsfähig** heißt: An der Adresse muss eine förmliche Zustellung (§§ 166 ff. ZPO) tatsächlich möglich sein. Ein Postfach genügt nicht (**klar**). eRecht24 hält auch eine „virtuelle Adresse“ für unzureichend: „Es darf sich nicht nur um ein Postfach oder gar um eine virtuelle Adresse handeln.“
- **OLG Frankfurt a. M., Urt. v. 18.02.2021 – 6 U 150/19:** Eine Briefkastenadresse reicht. In der Zusammenfassung der IT-Recht Kanzlei heißt es, maßgeblich sei, „dass gerichtlicher Schriftverkehr korrekt und ordnungsgemäß zugestellt werden kann. Nicht zwangsweise erforderlich ist, dass die impressumspflichtige Person unter der angegeben Adresse auch tatsächlich anzutreffen ist.“ Der Fall betraf eine US-Gesellschaft (LLC). Das Zitat stammt aus der Kanzlei-Zusammenfassung; der Urteilsvolltext wurde nicht abgerufen (nicht verifiziert, Stand 07.10.2026).
- **OLG Hamm, Beschl. v. 07.05.2015 – I-27 W 51/15:** „Ein c/o-Zusatz in der Geschäftsanschrift einer GmbH ist nicht schlechthin unzulässig“. Das betrifft Registerrecht (GmbHG/HGB), kein Impressumsrecht.
- **BGH, Urt. v. 07.07.2023 – V ZR 210/22** (amtlicher Leitsatz): „Eine ordnungsgemäße Klageerhebung setzt grundsätzlich die Angabe der ladungsfähigen Anschrift des Klägers voraus; die Adresse eines Postdienstleisters, der lediglich mit der Weiterleitung der an den Kläger gerichteten Post beauftragt ist, reicht hierfür nicht aus.“ Der Fall betraf eine **natürliche Person** (Prozessrecht). Offen gelassen hat der BGH nur, ob die Ausnahmen für juristische Personen (wirksame Zustellung über Bevollmächtigte) auf natürliche Personen übertragbar sind (Rn. 12: „Ob sich die in diesen Entscheidungen aufgestellten Grundsätze auch auf die Klage einer natürlichen Person wie der Klägerin übertragen lassen (zweifelnd …)“). Das spricht deutlich **gegen** Impressums-Services ohne echte Zustellvollmacht.
- **Für Impressen natürlicher Personen gibt es keine BGH-Entscheidung zur c/o- bzw. Impressums-Service-Lösung mit Zustellvollmacht** (**umstritten**). zerodox schreibt: „Für natürliche Personen hat der BGH ausdrücklich offengelassen, ob dieselben Grundsätze übertragbar sind — eine abschließende höchstrichterliche Klärung steht insoweit noch aus.“ und beruft sich dabei auf V ZR 210/22: „eine bloße Postweiterleitung genügt hierfür nach dieser Rechtsprechung ausdrücklich nicht“.
- eRecht24 (Stand 27.02.2025, aktualisiert 04/2026) rät – in einem Artikel, der sich an „Unternehmer oder Selbstständige“ richtet – „auf Nummer sicher“ zur Privatadresse oder zu angemieteten Büro- bzw. Co-Working-Räumen. Schwenke hält virtuelle Briefkästen nach OLG Frankfurt für vertretbar: „Auch hier muss den Anbietern eine Empfangsvollmacht erteilt werden“.
- **Wenn ein Impressums-Service:** Er muss eine echte Empfangs- bzw. Zustellvollmacht übernehmen, und zwar **schriftlich** (§ 171 ZPO: „An den rechtsgeschäftlich bestellten Vertreter kann mit gleicher Wirkung wie an den Vertretenen zugestellt werden. Der Vertreter hat eine schriftliche Vollmacht vorzulegen.“), und Post fristwahrend weiterleiten. Bloße Postweiterleitung reicht nicht (BGH V ZR 210/22). Darstellung: „Vorname Nachname, c/o [Dienstleister], Straße, PLZ Ort“. Restrisiko einer Abmahnung oder Beanstandung bleibt; es ist nach V ZR 210/22 höher als bei der Privatanschrift. Bei einem nicht kommerziellen Angebot ist es wirtschaftlich gering, aber nicht null (Landesmedienanstalt, § 115 MStV).

**Quellen:**
- BGH V ZR 210/22: https://www.jura.uni-hannover.de/studium/im-studium/e-learning-angebote/rechtsprechung-kompakt/detailansicht/news/bgh-urteil-vom-772023-v-zr-210-22 · https://dejure.org/dienste/vernetzung/rechtsprechung?Gericht=BGH&Datum=07.07.2023&Aktenzeichen=V%20ZR%20210/22
- § 171 ZPO: https://www.gesetze-im-internet.de/zpo/__171.html
- OLG Frankfurt 6 U 150/19: https://www.it-recht-kanzlei.de/olg-frankfurt-briefkastenadresse-impressum.html
- OLG Hamm I-27 W 51/15: https://www.justiz.nrw.de/nrwe/olgs/hamm/j2015/27_W_51_15_Beschluss_20150507.html
- eRecht24 c/o: https://www.e-recht24.de/impressum/8369-impressum-c-o-adresse.html
- eRecht24 ladungsfähige Anschrift (Stand 15.12.2025): https://www.e-recht24.de/impressum/13082-ladungsfaehige-anschrift.html
- zerodox (Anbieterseite, nur als Beleg für den offenen Stand): https://zerodox.de/ladungsfaehige-anschrift-impressum

### 1.4 E-Mail plus zweiter Kontaktweg?

- **EuGH, Urt. v. 16.10.2008 – C-298/07** (*deutsche internet versicherung*): Neben der E-Mail muss ein weiterer schneller, unmittelbarer und effizienter Kommunikationsweg angeboten werden. Eine **elektronische Anfragemaske** (Kontaktformular) genügt, eine Telefonnummer ist nicht zwingend. Einen nicht elektronischen Weg muss der Anbieter nur anbieten, wenn ein Nutzer nach elektronischer Kontaktaufnahme „keinen Zugang zum elektronischen Netz hat“ und um einen anderen, nicht elektronischen Kommunikationsweg ersucht. Der EuGH legt Art. 5 Abs. 1 lit. c RL 2000/31/EG aus („vor Vertragsschluss“), den § 5 Abs. 1 Nr. 2 DDG umsetzt. Die Übertragung auf § 5 DDG ist vertretbar, gilt aber nur, wenn § 5 DDG überhaupt greift.
- Schwenke verlangt, eingehende Nachrichten „zu üblichen Geschäftszeiten zumindest stündlich“ zu sichten, „was im Zweifel nachzuweisen ist (EuGH 2008)“. Ein Kontaktformular ersetzt laut Schwenke **nicht** die E-Mail, eignet sich aber als Alternative zum Telefon.
- **Für RecipeDeck:** Das In-App-Formular „Problem melden“ setzt einen Login voraus und reicht als öffentlicher zweiter Kanal nicht. Empfehlung: ein öffentlich erreichbares Kontaktformular oder eine Telefonnummer. Pflicht nur, wenn § 5 DDG greift (**umstritten**, siehe 1.1).
- Quellen: https://infocuria.curia.europa.eu/tabs/document?source=document&docid=66600&doclang=DE · https://dejure.org/dienste/vernetzung/rechtsprechung?Text=C-298/07 · https://www.damm-legal.de/eugh-keine-pflicht-zur-angabe-einer-telefonnummer-im-impressum-wenn-kontaktformular-vorhanden-ist (HTTP 401 beim Abruf, nicht verifiziert, Stand 07.10.2026; Inhalt über curia belegt)

---

## 2. DSGVO-Grundlagen

### 2.1 Anwendbarkeit

Die Haushaltsausnahme (Art. 2 Abs. 2 lit. c DSGVO) greift nicht, sobald Dritte sich registrieren. Der Betreiber ist Verantwortlicher (Art. 4 Nr. 7) (**klar**).

### 2.2 Pflichtangaben nach Art. 13 DSGVO – Checkliste

| Art. 13 | Inhalt | Status in `datenschutz.tsx` |
|---|---|---|
| Abs. 1 lit. a | Name/Kontakt Verantwortlicher | vorhanden (Platzhalter) |
| Abs. 1 lit. b | Kontakt DSB | entfällt (kein DSB, s. 2.4). Ein klarstellender Satz ist optional |
| Abs. 1 lit. c | Zwecke + Rechtsgrundlage **je Verarbeitung** | teilweise. **Fehlt** für KI-Import (§ 6), Cookidoo (§ 7), Einladungen und Mails (§ 8), Fehlerberichte, Bildvorschläge, Backups |
| Abs. 1 lit. d | berechtigtes Interesse konkret | nur bei Hosting (§ 5). Ergänzen bei Einladungs-E-Mail an Dritte, Fehlerbericht-Metadaten, Backups, Ratenbegrenzung |
| Abs. 1 lit. e | Empfänger/Kategorien | lückenhaft. Fehlen: Cloudflare (R2/DNS), Google (E-Mail-Postfach), Cobalt (Import-Fallback), Quell-Websites (Bilder), Vorwerk/Cookidoo als Empfänger. GitHub entfällt als Empfänger des Backup-Laufs (Northflank-Cron-Job, siehe P2 Nr. 12) |
| Abs. 1 lit. f | Drittlandübermittlung + Garantie | **fehlt fast ganz**. Groq als Platzhalter; Supabase (Singapur, SCC), Northflank (UK), Brevo (Support und einzelne Unterauftragsverarbeiter in den USA, DPF/SCC/BCR), Push-Dienste (USA), Cloudflare/Google (USA, DPF) |
| Abs. 2 lit. a | Speicherdauer/Kriterien | teilweise. Fehlen: Backups, Fehlerberichte, Einladungen, Groq-Aufbewahrung, Push-Abos, BYOK-Ratenlimits |
| Abs. 2 lit. b | Rechte Art. 15–18, 20, 21 | vorhanden. Art. 21 muss **getrennt und ausdrücklich** erscheinen (Art. 21 Abs. 4) |
| Abs. 2 lit. c | Widerruf der Einwilligung | vorhanden |
| Abs. 2 lit. d | Beschwerderecht | vorhanden, Behörde konkret benennen |
| Abs. 2 lit. e | Pflicht zur Bereitstellung / Folgen | **fehlt** („E-Mail und Passwort sind für ein Konto erforderlich; ohne sie keine Nutzung.“) |
| Abs. 2 lit. f | automatisierte Entscheidung/Profiling | **fehlt** („findet nicht statt“) |
| Art. 14 | Information von Dritten (eingeladene Person) | in der Einladungs-Mail kurz informieren + Link zur Erklärung |

Quelle DSGVO: https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32016R0679 (**klar**)

### 2.3 Rechtsgrundlagen je Zweck (Vorschlag)

| Zweck | Rechtsgrundlage | Sicherheit |
|---|---|---|
| Konto, Login, Sitzung, Passwort-Reset-Mails | Art. 6 Abs. 1 lit. b | klar |
| Rezepte, Notizen, Sammlungen, Planer, Einkaufsliste, Haushalt | Art. 6 Abs. 1 lit. b | klar |
| KI-Import (Groq: Text, Untertitel, Audio, Bild, Foto) | Art. 6 Abs. 1 lit. b (vom Nutzer ausgelöste Funktion) | h. M. |
| Bildvorschläge (Rezeptname an Chefkoch-API) | Art. 6 Abs. 1 lit. b; kein Personenbezug im Request | h. M. |
| Anzeige von Rezeptbildern von Fremdservern (IP an Dritte) | Art. 6 Abs. 1 lit. f – **besser vermeiden** (Proxy/Cache), siehe 11 | umstritten (vgl. LG München I, Urt. v. 20.01.2022 – 3 O 17493/20, Google Fonts) |
| Cookidoo-Verbindung | Art. 6 Abs. 1 lit. b (optionaler Zusatzdienst auf Wunsch); Vorwerk erhält Login als eigener Verantwortlicher | h. M. |
| Rezept-Einladung: Daten der eingeladenen Person | Art. 6 Abs. 1 lit. f (Interesse von Nutzer und Betreiber am Teilen) + Information nach Art. 14 in der Mail | h. M. |
| Push-Benachrichtigungen | Art. 6 Abs. 1 lit. a (Einwilligung) und § 25 TDDDG | klar |
| Server- und Anbieter-Logs, Ratenbegrenzung (IP kurzzeitig im RAM bei Facebook-Import) | Art. 6 Abs. 1 lit. f | h. M. |
| Fehlerberichte inkl. technischer Metadaten | Art. 6 Abs. 1 lit. f (Fehlerbehebung), alternativ lit. b | h. M. |
| Backups | Art. 6 Abs. 1 lit. f bzw. Art. 32 (Verfügbarkeit, Wiederherstellbarkeit) | h. M. |
| E-Mail-Kontakt mit dem Betreiber | Art. 6 Abs. 1 lit. b bzw. f | h. M. |

### 2.4 Verzeichnis nach Art. 30, DSB, DSFA

- **VVT (Art. 30):** Die Ausnahme in Art. 30 Abs. 5 für Stellen unter 250 Beschäftigten greift nicht, wenn die Verarbeitung „nicht nur gelegentlich“ erfolgt. Die DSK nennt als Beispiel „die regelmäßige Verarbeitung von Kunden- oder Beschäftigtendaten“. Bei einer App mit Nutzerkonten ist das der Fall → **VVT führen** (**h. M.**). Muster: DSK-Muster für Verantwortliche. Nur auf Anfrage der Behörde vorzulegen, nicht zu veröffentlichen.
  - **Beobachtungspunkt Omnibus IV:** Der Kommissionsvorschlag vom 21.05.2025 würde Art. 30 Abs. 5 ändern (Schwelle 750 Beschäftigte, VVT nur noch bei voraussichtlich hohem Risiko). Er lag im Juni 2026 noch im Rat (Antici-Gruppe); eine Verabschiedung bis 07.10.2026 ist nicht verifiziert (Stand 07.10.2026). Bis dahin gilt die geltende Fassung.
  - DSK-Kurzpapier Nr. 1: https://www.datenschutzkonferenz-online.de/media/kp/dsk_kpnr_1.pdf
  - DSK-Muster: https://www.datenschutzkonferenz-online.de/media/ah/201802_ah_muster_verantwortliche.pdf
- **Datenschutzbeauftragter:** **nicht nötig** (**klar**). § 38 Abs. 1 BDSG erst ab „in der Regel mindestens 20 Personen ständig mit der automatisierten Verarbeitung“, oder bei DSFA-Pflicht bzw. geschäftsmäßiger Übermittlung. Art. 37 Abs. 1 lit. b/c DSGVO (umfangreiche systematische Überwachung, Art.-9-Daten als Kerntätigkeit) trifft nicht zu.
  - § 38 BDSG: https://www.gesetze-im-internet.de/bdsg_2018/__38.html
- **DSFA (Art. 35):** voraussichtlich **nicht nötig** (**h. M.**, Einzelfall). Kein Tatbestand der DSK-Muss-Liste trifft zu. Nr. 11 („Einsatz von künstlicher Intelligenz … zur Steuerung der Interaktion mit den Betroffenen oder zur Bewertung persönlicher Aspekte“) passt nicht, weil die KI Rezepte extrahiert und keine Personen bewertet (Wertung; die Beispiele der Liste sind Callcenter-Stimmungsanalyse und Kundenberatungs-Chatbot). Empfehlung: eine kurze dokumentierte Schwellwertprüfung im VVT, z. B. zum Foto-Upload (mögliche Personenabbildungen, EXIF-GPS).
  - DSK-Muss-Liste v1.1: https://www.datenschutzkonferenz-online.de/media/ah/20181017_ah_DSK_DSFA_Muss-Liste_Version_1.1_Deutsch.pdf

---

## 3. Auftragsverarbeitung – Status je Dienstleister

**Grundsatz:** Art. 28 Abs. 3 DSGVO verlangt einen Vertrag. Nach Art. 28 Abs. 9 genügt elektronische Form. Click-through-Einbeziehung über AGB und DPA-Anhang ist anerkannte Praxis (**h. M.**). Der Betreiber muss den Abschluss **nachweisen** können (Art. 5 Abs. 2) → jeweils PDF der DPA-Fassung mit Datum und Nachweis der Kontoanlage oder Annahme ablegen, z. B. in `docs/legal/avv/` außerhalb des öffentlichen Repos oder privat.

| Dienstleister | Abschlussweg | Was konkret tun | Quelle |
|---|---|---|---|
| **Supabase** | DPA „supplements and forms part of the Supabase Terms of Service“ (Version 1 – 01.08.2026). Terms § 7(b): „The Parties agree to comply with the Data Processing Addendum, which is incorporated into this Agreement.“ DPA § 12.2: „acceptance of the Agreement shall have the same effect as signing the SCCs.“ Laut Nutzerhinweis zusätzlich im Dashboard unter *Organization → Legal Documents* abrufbar, inkl. TIA (öffentlich nur DPA belegt; TIA nicht verifiziert, Stand 07.10.2026) | DPA-PDF + TIA aus dem Dashboard laden, archivieren. Aussage „Mit Supabase besteht ein AVV“ ist damit **belegbar**. Vertragspartner: Terms § 1(j) – bei Kauf über einen Cloud-Marketplace Supabase, Inc., sonst **Supabase Pte. Ltd. (Singapur)**; bei direkter Registrierung also nur die Pte. Ltd. Nennt die TIA Supabase Inc. als Importeur, widerspricht das dem DPA (Importeur Pte. Ltd.) → klären (Abschnitt 12) | https://supabase.com/legal/customer-resources/data-processing-addendum · https://supabase.com/terms (Version 4, 05.10.2026) |
| **Northflank** | **Kein öffentlicher DPA.** ToS (Effective 01.03.2021) und Privacy Policy regeln nur Northflank als Verantwortlichen für Kontodaten. Trust Center (Vanta) nur nach Zugangsanfrage. BAAs gibt es nur „Under an Enterprise contract“; ob Self-Serve-Kunden einen DPA erhalten, sagt Northflank öffentlich nicht zu | **DPA anfordern** (legal@northflank.com bzw. Trust-Center-Anfrage), dabei Region und Unterauftragsverarbeiter erfragen. Bis zum Eingang **offen** | https://northflank.com/legal/terms · https://northflank.com/legal/privacy · https://trust.northflank.com/ · https://northflank.com/security |
| **Brevo** | DPA ist **Appendix 3 der Brevo Terms of Service** (Stand 01.10.2025) und gilt mit Kontoannahme. Vertragspartner allgemein Sendinblue SAS, 9-17 rue Salneuve, 75017 Paris. **Aber** Appendix 2: „For Users incorporated in Germany, Switzerland or Austria … Brevo GmbH, … Köpenicker Str. 126, 10179 Berlin, Germany … is the signatory and billing entity“; Sendinblue SAS ist dann Unterauftragsverarbeiter | ToS-PDF mit Datum archivieren. Aussage „AVV mit Brevo“ ist **belegbar**. Vertragspartner (Brevo GmbH oder Sendinblue SAS) aus Rechnung/Konto ablesen – ob „incorporated in Germany“ eine Privatperson erfasst, ist unklar. In beiden Fällen EU | https://www.brevo.com/legal/termsofuse/ · https://help.brevo.com/hc/en-us/articles/15403782599570 |
| **Groq** | „This Data Processing Addendum … is incorporated into and made part of the Groq Services Agreement“; „Customer’s electronic acceptance of the Services Agreement constitutes Customer’s signature to the DPA.“ (DPA vom 15.10.2025; Services Agreement vom 22.06.2026). Vertragspartner für Kunden mit Sitz im EWR: **Groq UK Limited** | DPA + Services Agreement archivieren. In der Console **Zero Data Retention** aktivieren (Data Controls) | https://console.groq.com/docs/legal/customer-data-processing-addendum · https://console.groq.com/docs/legal/services-agreement · https://console.groq.com/docs/your-data |
| **Cloudflare** (DNS, künftig R2) | Standard-DPA „incorporated by reference into our Self-Serve Subscription Agreement“; „no action is required“ | DPA-PDF archivieren. R2-Bucket mit **Jurisdiktion `eu`** anlegen (nur so garantiert; Location Hints sind „best effort“) | https://www.cloudflare.com/cloudflare-customer-dpa/ · https://www.cloudflare.com/trust-hub/gdpr/ · https://developers.cloudflare.com/r2/reference/data-location/ |
| **GitHub** (Repo) | GitHub-DPA gilt laut GitHub nur für „GitHub Enterprise Cloud, GitHub Enterprise (Unified), GitHub Teams, and GitHub Copilot“. Für persönliche Free-Konten verweist GitHub auf Privacy Statement + ToS (keine Art.-28-Vereinbarung im engeren Sinn; Verantwortlicher „GitHub, Inc. or GitHub B.V.“) | Backup läuft **nicht** über GitHub-Runner, sondern als Northflank-Cron-Job (Betreiberentscheidung 07.10.2026). Damit entfällt die AVV-Frage für den Backup-Lauf | https://github.com/customer-terms · https://github.com/customer-terms/github-data-protection-agreement |
| **Google (Gmail)** – Betreiberpostfach `recipedeckapp@gmail.com` | Consumer-Gmail hat keinen AVV. Für Nutzer im EWR ist **Google Ireland Limited** (Gordon House, Barrow Street, Dublin 4) Anbieter und Verantwortlicher; Google LLC (USA) ist Empfänger der Weiterübermittlung | Empfehlung: Postfach auf eigener Domain bei einem EU-Anbieter mit AVV. Sonst in der Erklärung nennen. Ob ein privater Betreiber Support-Mails über Consumer-Gmail empfangen darf, ist **umstritten** | https://policies.google.com/privacy · https://policies.google.com/terms |

**Kein Auftragsverarbeiter, aber Empfänger** (in der Erklärung als Empfänger nennen):
- **Browser-Push-Dienste** (Google FCM, Mozilla Autopush, Apple Push): Der Browser des Nutzers wählt sie aus. Die Payload ist nach RFC 8291 Ende-zu-Ende-verschlüsselt, der Dienst sieht nur Endpoint und Metadaten.
- **Vorwerk/Cookidoo**: eigener Verantwortlicher, Login erfolgt im Auftrag des Nutzers.
- **Chefkoch-API**: nur der Rezeptname.
- **Cobalt** (`api.cobalt.tools`, Fallback beim Instagram-/Facebook-Import, `src/config.ts`): nur die Quell-URL. Prüfen, ob in Production aktiv.
- **Quell-Websites/CDNs**: Der Browser lädt `image_url` direkt (`mobile/app/(tabs)/index.tsx` Z. 86/141, `recipe/[id].tsx` Z. 720, `collection/[id].tsx` Z. 168), dabei geht die IP an Dritte. Der Proxy `/api/v1/proxy/image` wird nur im PDF-Export (Web) genutzt.

**Hinweis CLAUDE.md:** Dort wird eine „Unsplash-Bildsuche“ erwähnt. Im Code (`src/utils/image-search.ts`) wird jedoch **die Chefkoch-API** abgefragt, die Datenschutzerklärung (Z. 62–65) ist insoweit korrekt.

---

## 4. Drittlandübermittlung

### 4.1 DPF-Status (Abfrage der offiziellen DPF-Liste am 07.10.2026)

| Organisation | DPF-Eintrag | Status EU-US | gültig bis* |
|---|---|---|---|
| **Groq** (Inc./LLC) | **kein Eintrag** (weder aktiv noch inaktiv) | – | – |
| **Supabase** | **kein Eintrag** | – | – |
| Northflank | kein Eintrag (nicht nötig, UK) | – | – |
| Cloudflare, Inc. | ID 5666 | „Active – Re-certification under Review“ | 15.09.2027 |
| GitHub | ID 6174 (eigener Eintrag; Microsoft Corporation separat unter ID 6474) | Active | 03.08.2027 |
| Brevo, Inc. (Legal Name „Seninblue, Inc.“ – Schreibweise so im Register, Austin TX) | ID 10010 | Active (nur Kundensupport-Zugriff, „does not involve any hosting … in the US“) | 26.02.2027 |
| Google LLC | ID 5780 | Active | 13.09.2027 |
| Apple Inc., Mozilla Corp. | kein Eintrag gefunden | – | – |

\* „gültig bis“ ist das Datum der fälligen Re-Zertifizierung, kein Ablaufdatum im strengen Sinn.

Öffentliche Ansicht: https://www.dataprivacyframework.gov/list (Einzelseiten z. B. https://www.dataprivacyframework.gov/participant/5666). Der Betreiber sollte das vor dem Start einmal manuell gegenprüfen und einen Screenshot mit Datum ablegen.

### 4.2 Je Anbieter

| Anbieter | Sitz Vertragspartner | Datenort | Übermittlungsgrundlage | Sicherheit |
|---|---|---|---|---|
| **Groq** | Groq UK Limited (UK) für EWR-Kunden. Verarbeitung (auch) in den USA (DPA § 8.1: „Groq may transfer and Process Personal Data to and in the United States …“); GCP-Buckets „located in the United States“. Dass konkret Groq LLC verarbeitet, ist nicht ausdrücklich belegt | USA | EU→UK: Angemessenheitsbeschluss UK. **EU-SCC (Modul 2)** im DPA zwischen Kunde und Groq UK Limited (§ 8.2, „to the extent legally required“). Für Weiterübermittlungen in die USA verpflichtet sich Groq, geeignete Garantien zu schaffen (§ 8.1: „Where Groq engages in an onward transfer of Personal Data, Groq will ensure that a lawful data transfer mechanism is in place“). Das UK-Addendum (§ 8.3) betrifft UK-GDPR-Exporte, nicht EU-Exporte. **Kein DPF.** Unterauftragsverarbeiter u. a. Google Cloud, Cloudflare (Liste: trust.groq.com/subprocessors) | klar (SCC); Transfer-Impact-Bewertung gehört ins VVT (h. M.) |
| **Supabase** | Supabase Pte. Ltd. (Singapur) bei direkter Registrierung; Supabase, Inc. (USA) nur bei Kauf über einen Cloud-Marketplace (Terms § 1(j)) | Projektdaten AWS EU (Irland, laut Betreiber; Grundsatz „in-region“ bestätigt, konkrete Region nicht verifiziert, Stand 07.10.2026) | **EU-SCC (Modul 2)** schon für die Übermittlung an Supabase Pte. Ltd. selbst (Singapur ohne Angemessenheitsbeschluss): DPA § 12.1 „The Standard Contractual Clauses shall, as further set out in Schedule 2, apply to the transfer of any Covered Data from Customer to Supabase …, to the extent that: (a) the GDPR … appl[ies]“; Recht/Gerichte Irland. Laut Nutzerhinweis gibt es eine TIA im Dashboard mit Supabase Inc. als Importeur (nicht verifiziert, Stand 07.10.2026; Widerspruch zum DPA möglich). Kein DPF | h. M. |
| **Northflank** | Northflank Ltd., 20-22 Wenlock Road, London N1 7GU (UK), Company 11918540 | **offen:** ToS „Our Services are hosted in the United Kingdom“; Regionsseite bietet u. a. „Europe - West“, „Europe - West - Frankfurt“, „Europe - West - Netherlands“, „Europe - West - Zurich“ (Zürich wäre Schweiz, eigener Angemessenheitsbeschluss). Genutzte Region nur im Account prüfbar (nicht verifiziert, Stand 07.10.2026) | **Angemessenheitsbeschluss UK**, erneuert am **19.12.2025** (Durchführungsbeschluss (EU) 2025/2574, ABl. vom 23.12.2025), gültig bis **27.12.2031**. Überprüfung „at least every four years“ (ErwGr. 127), zusätzlich laufendes Monitoring mit Möglichkeit der Aussetzung | klar |
| **Brevo** | Brevo GmbH (Berlin) für in DE „incorporated“ Kunden, sonst Sendinblue SAS (Paris) – am Konto prüfen | Frankreich/Belgien (OVH, Google Cloud Platform) | EU. Support-Zugriff Brevo Inc. (USA) über DPF + SCC. Weitere US-Unterauftragsverarbeiter u. a. Cloudflare (CDN/WAF, DPF/SCC) und Zendesk (Ticketing, BCR/SCC). DPA: „We may rely on the EU-US Data Privacy Framework for transfers to the US, as long as this framework remains valid.“ | klar |
| **Cloudflare** | Cloudflare, Inc. (USA) | DNS weltweit; R2 mit Jurisdiktion `eu` in der EU | DPF + SCC im DPA. DNS ohne Proxy: Nutzer-Traffic läuft nicht über Cloudflare (DNS-Anfragen der Resolver landen weiterhin bei Cloudflare, meist mit Resolver-IP) | klar |
| **GitHub** | GitHub, Inc. (USA) | Runner in Azure-Rechenzentren, Standort nicht festgelegt (Drittland möglich). Für RecipeDeck ohne Belang, seit das Backup als Northflank-Cron-Job läuft | DPF (aktiv) | klar (DPF); AVV-Frage siehe 3 |
| **Google** (Gmail, FCM-Push) | Gmail: Google Ireland Limited (Anbieter und Verantwortlicher im EWR); Weiterübermittlung an Google LLC (USA) | weltweit | DPF (Google LLC) | klar |
| **Apple Push** | Apple Inc. (USA) | USA | Kein DPF-Eintrag gefunden; Payload verschlüsselt. Übermittlung erfolgt durch den Browser des Nutzers | umstritten (Zurechnung) |

### 4.3 Status des DPF (Oktober 2026)

- **EuG, Urt. v. 03.09.2025 – T-553/23 (Latombe/Kommission):** Klage abgewiesen, DPF gültig (belegt über Sekundärquellen; die CURIA-Seite lieferte keinen abrufbaren Text).
- **Rechtsmittel beim EuGH: C-703/25 P**, eingelegt am 31.10.2025, anhängig (Stand 17.09.2026). Microsoft ist als Streithelfer zugelassen (Microsoft-Erklärung vom 28.06.2026: Gericht sah ein „direct and existing interest“). Das Beschlussdatum 04.06.2026 ließ sich in keiner abrufbaren Quelle belegen (nicht verifiziert, Stand 07.10.2026). Stand September 2026 ist kein Verhandlungstermin bekannt.
- **US Supreme Court, *Trump v. Slaughter*, No. 25–332, entschieden 29.06.2026 (6:3):** „Held: The FTC’s for-cause removal provision is contrary to the separation of powers enshrined in the Constitution.“ Zu *Humphrey’s Executor*: „If anything more is left of Humphrey’s, we overrule it.“ Der Angemessenheitsbeschluss 2023/1795 stützt sich ausdrücklich auf die Unabhängigkeit der FTC und den Kündigungsschutz ihrer Kommissare (ErwGr. 58–60).
- **noyb** hat am 29.06.2026 – also vor dem EDPB-Schreiben – eine eigene Klage angekündigt („*noyb* will also file a lawsuit in the coming weeks“) und fordert den „orderly“ Rückzug des Beschlusses. Bis 17.09.2026 war keine auf *Slaughter* gestützte noyb-Klage als eingereicht bekannt (Faegre Drinker).
- **EDPB-Schreiben an die Kommission (Kommissar Michael McGrath) vom 31.07.2026:** Die Kommission soll „closely assess whether this development affects the functioning of Commission Implementing Decision EU 2023/1795“. Eine Aussetzung wird nicht gefordert. Eine formelle Antwort auf das Schreiben ist nicht dokumentiert; allgemein „has taken note of the ruling, is carefully analysing its implications, and continues to monitor the DPF“ (Faegre Drinker, Stand 17.09.2026).
- Außerdem ist das PCLOB seit Januar 2025 ohne Quorum.
- **Bewertung:** Der DPF gilt derzeit (**klar**), das Aufhebungsrisiko ist gestiegen (**umstritten**). Für RecipeDeck ist das kaum entscheidend: Groq stützt sich auf SCC, und die DPF-Anbieter haben SCC im DPA als Rückfallebene. In der Erklärung deshalb bei US-Anbietern „DPF **und/oder** SCC“ formulieren.

**Quellen:**
- EuG T-553/23: https://dejure.org/dienste/vernetzung/rechtsprechung?Gericht=EuG&Datum=03.09.2025&Aktenzeichen=T-553%2F23
- InfoCuria: https://infocuria.curia.europa.eu/tabs/redirect/juris/liste.jsf?num=T-553/23
- Heuking: https://www.heuking.de/de/news-events/newsletter-fachbeitraege/artikel/eug-bestaetigt-wirksamkeit-des-eu-us-data-privacy-framework.html
- WilmerHale (Rechtsmittel 31.10.2025): https://www.wilmerhale.com/en/insights/blogs/wilmerhale-privacy-and-cybersecurity-law/20251201-european-court-of-justice-to-review-challenge-to-eu-us-data-privacy-framework
- Microsoft als Streithelfer: https://www.dutchitchannel.nl/news/754552/microsoft-verdedigt-dataverkeer-eu-vs · DataGuidance (Paywall, kein Inhalt abrufbar): https://www.dataguidance.com/news/eu-cjeu-admits-microsoft-intervener-appeal-concerning
- *Trump v. Slaughter* (Opinion): https://www.supremecourt.gov/opinions/25pdf/25-332_qn12.pdf
- Skadden zu Slaughter (07/2026): https://www.skadden.com/insights/publications/2026/07/supreme-court-decision-raises-new-questions
- noyb (29.06.2026): https://noyb.eu/en/us-supreme-court-just-blew-eu-us-data-transfers
- Hunton zum EDPB-Brief: https://www.hunton.com/privacy-and-cybersecurity-law-blog/edpb-calls-for-review-of-eu-u-s-data-privacy-framework-after-u-s-supreme-court-decision-on-ftc-independence
- EDPB-Brief: https://www.edpb.europa.eu/documents/edpb-correspondence/edpb-letter-to-the-european-commission-on-us-supreme-court-judgment_en · PDF: https://www.edpb.europa.eu/system/files/2026-08/edpb_letter_20260731_us_supremecourt_judgment_trump_v_slaughter_en.pdf
- Faegre Drinker (17.09.2026): https://www.faegredrinker.com/en/insights/publications/2026/9/trump-v-slaughter-implications-of-the-us-supreme-court-ruling-for-eu-us-data-transfers-and-the-data-privacy-framework
- UK-Adequacy: Durchführungsbeschluss (EU) 2025/2574 https://eur-lex.europa.eu/eli/dec_impl/2025/2574/oj/eng · Kommission https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/adequacy-decisions_en · ICO https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/international-transfers/receiving-personal-information-from-the-eea/ · eucrim https://eucrim.eu/news/commission-renewed-adequacy-decisions-for-data-transfers-to-the-uk/

---

## 5. Löschung vs. Backups

**Rechtslage:**
- Art. 17 DSGVO verlangt Löschung „unverzüglich“. Die Löschpflicht erstreckt sich grundsätzlich auch auf Sicherungskopien.
- Der BayLfD (Orientierungshilfe „Das Recht auf Löschung“, Version 1.0, Stand 01.06.2022, Rn. 54) schreibt: „Sollten Daten auf mehreren Datenträgern gespeichert worden sein, bezieht sich die Löschungspflicht auf alle Kopien, auch etwa auf Sicherungskopien. Sicherungs- oder Backupsysteme sollten daher technisch möglichst so organisiert werden, dass endgültige Löschungen einzelner Datensätze möglich sind, ohne die Funktionsfähigkeit des Backupsystems im Ganzen zu gefährden.“ Die Hilfe richtet sich an öffentliche Stellen in Bayern, gilt inhaltlich aber als Auslegungshilfe (**h. M.**).

**EDPB, Coordinated Enforcement Action 2025 „Implementation of the right to erasure by controllers“, angenommen 10.02.2026, Abschnitt 4.2.6 (Issue 6: Deletion of personal data in the context of back-ups):**
- „Depending on the technical settings and risks, it might not always be advisable to modify or delete information from back-ups. But, in that case, organisations should have appropriate procedures to keep track of erasure requests and comply with them on restored systems as much as possible, in case of a data breach affecting the integrity of the organisation’s system.“
- Als beobachtete Praxis von Verantwortlichen (keine Empfehlung): Backups werden „at set intervals, for instance, one month“ gelöscht oder überschrieben. Eine Aufsichtsbehörde kritisierte fehlende konkrete Fristen und lange, inkrementelle Löschzyklen, weil sich dann nicht beurteilen lässt, ob „without undue delay“ eingehalten ist.
- Empfehlungen: „Follow established standards to erase and destroy data in a secure and structured manner.“ / „Verify that erasure has been carried out and be able to demonstrate such erasure.“
- Eine konkrete Höchstfrist nennt der EDPB **nicht**. Weitere Leitlinien zieht der EDPB nur in Betracht („may consider … Providing more guidance and recommendations“); angekündigt sind sie nicht.

**Bewertung für RecipeDeck** (**h. M.**):
- Ein Verbleib gelöschter Konten in **verschlüsselten**, nicht produktiv genutzten Backups bis zum Ablauf einer **kurzen, festen Rotationsfrist** ist vertretbar, wenn
  1. die Frist feststeht und automatisch durchgesetzt wird (R2-Lifecycle),
  2. Backups nicht anderweitig genutzt werden,
  3. Zugriff stark beschränkt ist (`age`, Private Key offline),
  4. bei einem Restore die seit dem Backup erfolgten Löschungen **erneut ausgeführt** werden, etwa über ein Lösch-Protokoll mit gelöschten User-IDs und Zeitpunkt. Das protokolliert nur pseudonyme IDs und ist minimal zu halten.
- Nach dem Plan (A: 14 tägliche + 4 wöchentliche Sicherungen, Ausführung als Northflank-Cron-Job) ist die **maximale Verweildauer 35 Tage** nach der Löschung.

**Formulierungsvorschlag (Datenschutzerklärung):**

> „Zum Schutz vor Datenverlust erstellen wir täglich verschlüsselte Sicherungskopien der Datenbank. Sie werden bei Cloudflare (Cloudflare, Inc.) in einem Speicher mit Standort in der EU abgelegt, sind nur mit einem offline verwahrten Schlüssel lesbar und werden automatisch nach spätestens 35 Tagen gelöscht. Löschst du dein Konto, sind deine Daten deshalb noch bis zu 35 Tage in diesen Sicherungen enthalten. Sie werden in dieser Zeit nicht verwendet. Müssten wir eine Sicherung zurückspielen, löschen wir deine Daten dabei erneut. Rechtsgrundlage ist unser berechtigtes Interesse an einem sicheren, wiederherstellbaren Betrieb (Art. 6 Abs. 1 lit. f DSGVO, Art. 32 DSGVO).“

**Quellen:**
- EDPB-Bericht (PDF): https://www.edpb.europa.eu/system/files/documents/2026-02/edpb_cef-report_2025_right-to-erasure_en.pdf
- EDPB-Seite: https://www.edpb.europa.eu/our-work-tools/our-documents/other/coordinated-enforcement-action-implementation-right-erasure_en
- BayLfD OH Löschung: https://www.datenschutz-bayern.de/datenschutzreform2018/OH_Loeschung.pdf

---

## 6. Selbstlöschung (Art. 17) und Betroffenenrechte – Prüfung von `datenschutz.tsx`

- **Reicht „per E-Mail anfordern“?** Ja. Die DSGVO verlangt keine Self-Service-Funktion. Art. 12 Abs. 2 verlangt, die Ausübung zu *erleichtern*, Art. 12 Abs. 3 eine Antwort binnen eines Monats (**klar**). Die Selbstlöschung (PR #74) übererfüllt das.
- **Beschreibung Z. 101–105 im Wesentlichen korrekt.** Präzisierungen:
  1. **Fehlerberichte** (Z. 103–104, „bleiben ohne Bezug zu deinem Konto erhalten“): Die Löschfunktion setzt `user_id` und `household_id` auf `NULL` (Migration `20261007120000_account_deletion.sql`, Z. 68–70). Erhalten bleiben aber:
     - in `metadata_json` u. a. `activeHouseholdId`, `userAgent`, `osVersion`, Viewport, App-Version, Plattform und Zeitstempel (`BugReportModal.tsx` Z. 60–73);
     - bei Import-Fehlern zusätzlich in `metadata_json` der `lastFailureSnapshot` mit `submittedUrl` (vom Nutzer importierte URL), `errorMessage`, `jobId` und Zeitstempel (`BugReportModal.tsx` Z. 72; `mobile/app/(tabs)/extract.tsx` Z. 171–183, Z. 963);
     - die Route in der **eigenen Spalte `route`** (`BugReportModal.tsx` Z. 79; `src/schema.ts` Z. 248), nicht in `metadata_json`.

     Der Freitext kann personenbezogene Angaben enthalten. Das ist eher **pseudonymisiert als anonym**. Empfehlung: `metadata_json` bei Löschung bereinigen (mindestens `activeHouseholdId` und `lastFailureSnapshot.submittedUrl`), eine **Löschfrist** für Fehlerberichte festlegen (z. B. 12 Monate nach Erledigung) und den Text so fassen, dass er keine Anonymität verspricht.
  2. **Haushalt mit weiteren Mitgliedern** (Z. 104–105): Anfragen per E-Mail müssen binnen eines Monats erledigt werden (Art. 12 Abs. 3). Den Satz ergänzen: „Wir erledigen deine Anfrage innerhalb eines Monats.“
  3. **Geteilte Kopien:** Angenommene Einladungen erzeugen eine eigene Kopie im Konto der empfangenden Person. Diese bleibt beim Löschen des Absenders erhalten. Das sollte drinstehen.
  4. **Backups** und Restore-Nachlöschung ergänzen (siehe 5).
  5. **Dienstleister-Logs** (Supabase-Auth-Logs mit IP, Northflank-Logs): „in der Regel nach wenigen Tagen“ ist vage. Besser die tatsächlichen Fristen aus den Anbieter-Einstellungen nennen oder „nach den Fristen der Anbieter, derzeit höchstens X Tage“.
- **Rechte-Liste Z. 109–118:** vollständig hinsichtlich Art. 15–18, 20, 7 Abs. 3. Es fehlen:
  - Art. 21 muss nach **Art. 21 Abs. 4** „ausdrücklich … in einer verständlichen und von anderen Informationen getrennten Form“ erscheinen → eigener, hervorgehobener Absatz „Widerspruchsrecht“ (**klar**).
  - Art. 77 (Beschwerde) ist als Fließtext vorhanden, die Behörde konkret benennen.
  - Hinweis, wie Art. 20 umgesetzt wird (Export auf Anfrage per E-Mail, maschinenlesbar).

---

## 7. Cookies, Local Storage, Service Worker, IndexedDB – § 25 TDDDG

**Norm:** § 25 Abs. 1 TDDDG verlangt eine Einwilligung für jede Speicherung oder jeden Zugriff auf Informationen im Endgerät. Das ist technologieneutral und gilt auch für Local Storage, Cache Storage und IndexedDB.
- Ausnahme Abs. 2 Nr. 2: „unbedingt erforderlich …, damit der Anbieter eines digitalen Dienstes einen vom Nutzer ausdrücklich gewünschten digitalen Dienst zur Verfügung stellen kann“.
- § 25 TDDDG entspricht inhaltlich § 25 TTDSG (Umbenennung 14.05.2024 durch Art. 8 G v. 06.05.2024; dabei wurde „Telemedien“ durch „digitale Dienste“ ersetzt, ohne Änderung in der Sache).

**DSK-Orientierungshilfe Digitale Dienste (Version 1.2, Nov. 2024):**
- Prüfung pro Funktion. Rn. 74 zählt Zusatzdienste und Funktionen auf, die „grundsätzlich unabhängig von der Kategorie des digitalen Dienstes sind“, u. a. „Spracheinstellungen, Chatboxen, Kontaktformulare, Push-Nachrichten, … Log-in Bereiche inkl. Authentifizierung, Werbung, … Merklisten oder Favoritenlisten“. Rn. 74 erklärt sie aber **nicht** zu gewünschten Funktionen (die Liste enthält sogar „Werbung“).
- Rn. 76: „Nutzer:innen ‚wünschen‘ die beispielhaft genannten Zusatzdienste und -funktionen erst, wenn sie diese explizit in Anspruch nehmen“. Für RecipeDeck trägt das: Login, Push und Favoriten werden aktiv genutzt.
- Rn. 80: „Eine regelmäßige Nutzung des digitalen Dienstes durch bestimmte Endnutzer:innen kann grundsätzlich nur dann unterstellt werden, wenn es sich um einen anmeldepflichtigen Dienst handelt.“ Das ist eine notwendige, keine hinreichende Bedingung für längere Speicherung; ansonsten gilt grundsätzlich Session-Dauer.
- Rn. 81: Für das Speichern von Einstellungen (z. B. Sprache, Hintergrundfarbe) ist kein eindeutiges Identifizierungsmerkmal erforderlich; es reicht eine nicht identifizierende Angabe.
- Rn. 83: Nutzerorientierte Sicherheitsmechanismen, die das Login-System vor Missbrauch schützen (z. B. Erkennen wiederholt fehlgeschlagener Anmeldeversuche), sind erfasst. Für die Login-Sitzung selbst sind Rn. 74/76 maßgeblich.

**Einordnung je Speicherung:**

| Speicherung | Zweck | Ausnahme § 25 Abs. 2 Nr. 2? |
|---|---|---|
| Supabase-Session (Local Storage) | Login, vom Nutzer aktiv in Anspruch genommen (Rn. 76) | ja (**h. M.**) |
| TanStack-Query-Persistenz pro Nutzer | Offline-Lesen der eigenen Rezeptliste | ja, die PWA-/Offline-Funktion ist Kern des Dienstes (**h. M.**) |
| Service-Worker + Cache Storage (`rd-shell`, `rd-assets`, `rd-user-*`, `rd-user-meta`) | App-Shell offline, Rezeptdetails offline | ja (**h. M.**) |
| IndexedDB-Mutationsqueue | Offline-Änderungen nachreichen | ja (**h. M.**) |
| Einstellungen (Theme, Ansicht), Hinweis-Status, Bildsuche-Zähler | Komfort, keine ID | ja (Rn. 81) |
| Eigener Groq-Schlüssel (BYOK) | vom Nutzer gewünscht | ja |
| Push-Subscription | Benachrichtigungen | Einwilligung wird ohnehin aktiv eingeholt; mindestens ausdrücklich gewünscht → ja |
| Analytics/Tracking | – | nicht vorhanden |

→ **Kein Consent-Banner nötig**, solange keine Analytics, kein Tracking und keine Drittanbieter-Einbindungen mit Endgerätezugriff hinzukommen (**h. M.**). Die DSE (Z. 89–95) sollte die Speicherungen aufzählen und **„§ 25 Abs. 2 Nr. 2 TDDDG“** zitieren statt „§ 25 Abs. 2“.

**Achtung, separates Thema (DSGVO, nicht TDDDG):** Rezeptbilder werden im Browser direkt von Fremdservern geladen (`image_url`, z. B. Chefkoch-CDN, Instagram/YouTube-Thumbnails, beliebige Rezeptseiten). Der Server reicht nur `data:`-URLs über den eigenen Endpunkt aus, Fremd-URLs gehen unverändert an den Client (`src/db-react.ts` Z. 276–278). Dabei gehen IP-Adresse und User-Agent des Nutzers an Dritte. Nach LG München I (20.01.2022 – 3 O 17493/20, Google Fonts) ist eine solche Weitergabe ohne Rechtsgrundlage angreifbar (**umstritten**, Einzelfallentscheidung). Empfehlung: Bilder beim Import serverseitig laden und speichern (Projektregel „max. 250 KB“) oder über den eigenen Server ausliefern. Sonst offenlegen.

**Quellen:**
- § 25 TDDDG: https://www.gesetze-im-internet.de/ttdsg/__25.html
- DSK-OH Digitale Dienste v1.2: https://www.datenschutzkonferenz-online.de/media/oh/OH_Digitale_Dienste.pdf
- LG München I 3 O 17493/20 (Sekundärquelle): https://www.ihk.de/bergische/recht-und-steuern/wettbewerbsrecht/google-fonts-5646176

---

## 8. Zuständige Aufsichtsbehörde

**Bestimmung:** Für nichtöffentliche Stellen ist die nach Landesrecht zuständige Behörde zuständig (§ 40 Abs. 1 BDSG). § 40 Abs. 2 BDSG (entsprechende Anwendung von Art. 4 Nr. 16 DSGVO) gilt nur, wenn der Verantwortliche **mehrere inländische Niederlassungen** hat, und passt daher nicht auf eine Privatperson mit einem Wohnsitz. Für eine Privatperson als Betreiber richtet sich die Zuständigkeit nach Landesrecht und Wohnsitz bzw. Ort der Tätigkeit (**h. M.**; ohne eigene Primärquelle, nicht verifiziert, Stand 07.10.2026). **In Bayern** gibt es eine Besonderheit: Für den privaten Bereich ist das **BayLDA (Ansbach)** zuständig (Art. 18 BayDSG), **nicht** der BayLfD.

Quelle § 40 BDSG: https://www.gesetze-im-internet.de/bdsg_2018/__40.html · Liste: https://www.datenschutzkonferenz-online.de/datenschutzaufsichtsbehoerden.html · BayLDA: https://www.lda.bayern.de/de/informationen.html

| Land | Behörde (privater Bereich) | URL |
|---|---|---|
| Baden-Württemberg | Landesbeauftragter für den Datenschutz und die Informationsfreiheit BW | https://www.baden-wuerttemberg.datenschutz.de/ |
| **Bayern (privat)** | **Bayerisches Landesamt für Datenschutzaufsicht (BayLDA)** | https://www.lda.bayern.de/ |
| Berlin | Berliner Beauftragte für Datenschutz und Informationsfreiheit | https://www.datenschutz-berlin.de/ |
| Brandenburg | Landesbeauftragte für den Datenschutz und für das Recht auf Akteneinsicht Brandenburg | http://www.lda.brandenburg.de/ |
| Bremen | Die Landesbeauftragte für Datenschutz und Informationsfreiheit der Freien Hansestadt Bremen | https://www.datenschutz.bremen.de/ |
| Hamburg | Hamburgischer Beauftragter für Datenschutz und Informationsfreiheit | https://www.datenschutz-hamburg.de/ |
| Hessen | Hessischer Datenschutzbeauftragter | https://www.datenschutz.hessen.de/ |
| Mecklenburg-Vorpommern | Landesbeauftragter für Datenschutz und Informationsfreiheit M-V | https://www.datenschutz-mv.de/ |
| Niedersachsen | Landesbeauftragter für den Datenschutz Niedersachsen | https://www.lfd.niedersachsen.de/ |
| Nordrhein-Westfalen | Landesbeauftragte für Datenschutz und Informationsfreiheit NRW | https://www.ldi.nrw.de/ |
| Rheinland-Pfalz | Landesbeauftragter für den Datenschutz und die Informationsfreiheit RLP | https://www.datenschutz.rlp.de/de/startseite |
| Saarland | Unabhängiges Datenschutzzentrum Saarland – Landesbeauftragte für Datenschutz und Informationsfreiheit | https://datenschutz.saarland.de/ |
| Sachsen | Sächsische Datenschutz- und Transparenzbeauftragte | https://www.datenschutz.sachsen.de/ |
| Sachsen-Anhalt | Landesbeauftragte für den Datenschutz Sachsen-Anhalt | https://datenschutz.sachsen-anhalt.de/ |
| Schleswig-Holstein | Unabhängiges Landeszentrum für Datenschutz Schleswig-Holstein (ULD) | https://www.datenschutzzentrum.de/ |
| Thüringen | Thüringer Landesbeauftragter für den Datenschutz und die Informationsfreiheit | https://www.tlfdi.de/ |

(Der BfDI ist die Aufsichtsbehörde über alle öffentlichen Stellen des Bundes und bestimmte Träger der sozialen Sicherung; außerdem beaufsichtigt er die Finanzbehörden sowie Telekommunikations- und Postdienstunternehmen, soweit sie solche Dienste erbringen. Für RecipeDeck ist er nicht zuständig.)

In `legal-operator.ts` Z. 12 die konkrete Behörde mit Anschrift oder URL eintragen. Beim BayLDA ist Promenade 18, 91522 Ansbach die Haus- bzw. Besucheranschrift; die Postanschrift lautet **Postfach 1349, 91504 Ansbach** (https://www.lda.bayern.de/de/kontakt.html). In der Datenschutzerklärung ist beides üblich. Betroffene dürfen sich nach Art. 77 zwar bei jeder Behörde beschweren („insbesondere in dem Mitgliedstaat ihres gewöhnlichen Aufenthaltsorts, ihres Arbeitsplatzes oder des Orts des mutmaßlichen Verstoßes“), die Erklärung sollte aber die zuständige nennen.

---

## 9. Sonstiges

### 9.1 Nutzungsbedingungen / AGB

- **Gesetzlich nicht vorgeschrieben** (**klar**). Empfohlen, weil sie Folgendes regeln:
  1. **Vertragsgrundlage** für Art. 6 Abs. 1 lit. b (unentgeltlicher Nutzungsvertrag).
  2. **Mindestalter 16** (siehe 9.4).
  3. **Haftung:** Bei unentgeltlicher Leistung gelten Wertungen wie bei Schenkung/Leihe (§§ 521, 599 BGB: Haftung nur für Vorsatz und grobe Fahrlässigkeit, **umstritten**, ob analog auf Online-Dienste anwendbar). In AGB ist nach § 309 Nr. 7 BGB unwirksam: ein Ausschluss **oder eine Begrenzung** der Haftung für Schäden aus der Verletzung von Leben, Körper oder Gesundheit, die auf einer **fahrlässigen** (also auch leicht fahrlässigen) Pflichtverletzung beruhen (lit. a), sowie für sonstige Schäden aus grob fahrlässiger Pflichtverletzung (lit. b).
  4. Keine Verfügbarkeitsgarantie, Recht zur Einstellung des Dienstes.
  5. Nutzerpflichten (keine rechtswidrigen Inhalte, Urheberrecht).
  6. Meldeweg und Moderationsregeln (DSA Art. 14, sofern anwendbar; Wortlaut nicht verifiziert, Stand 07.10.2026).
  7. Hinweis auf BYOK: Groq-Konto des Nutzers, Groq-AGB.
- **Open-Source-Lizenz ≠ Haftungsausschluss für den Dienst.** Der Disclaimer der Softwarelizenz („AS IS“) betrifft die Weitergabe des Codes, nicht den Betrieb der gehosteten App gegenüber Nutzern. Das beantwortet TODO-Frage (5) (**h. M.**).
- Groq-Services-Agreement: „You must be 18 years of age or older“ und „not for consumer use“. Das betrifft den Betreiber als Kunden, nicht die Endnutzer. RecipeDeck reicht Groq aber an Verbraucher durch → die Groq Acceptable Use Policy beachten (https://console.groq.com/docs/legal/ai-policy).
- Quelle § 309 BGB: https://www.gesetze-im-internet.de/bgb/__309.html

### 9.2 Urheberrecht an importierten Rezepten und Bildern

- **Zutatenliste und Zubereitungsschritte** sind als Idee bzw. Anleitung meist nicht schutzfähig. Konkrete **Texte** mit eigener Formulierung können als Sprachwerk geschützt sein (§ 2 Abs. 1 Nr. 1 UrhG) (**h. M.**).
- **Fotos** sind immer mindestens als Lichtbild geschützt (§ 72 UrhG, 50 Jahre) (**klar**).
- **Kopie auf dem Server für den Nutzer:** § 53 Abs. 1 S. 2 UrhG erlaubt Vervielfältigung zum privaten Gebrauch durch einen anderen, „sofern dies unentgeltlich geschieht“. RecipeDeck ist unentgeltlich, das spricht für Zulässigkeit (**umstritten** bei Cloud-Diensten, vgl. EuGH C-433/20 *Austro-Mechana*: Cloud-Kopien fallen unter die Privatkopie-Schranke).
- **Teilen im Haushalt** (persönlich verbundener Kreis) ist eher unproblematisch. **Einladungen und QR an Dritte** außerhalb des privaten Kreises sind riskanter (**umstritten**).
- **Hotlinking/Einbettung** frei zugänglicher Bilder ist urheberrechtlich nach EuGH C-466/12 *Svensson* / C-392/19 *VG Bild-Kunst* eher zulässig, löst aber das Datenschutzproblem aus Abschnitt 7 aus.
- **Empfehlung:**
  - Quelle immer verlinken (vorhanden).
  - Notice-and-takedown über die Kontaktadresse.
  - In den Nutzungsbedingungen klarstellen, dass Nutzer nur für den privaten Gebrauch importieren.
  - Rezeptbilder auf das Nötige verkleinern (250-KB-Regel).
- Quellen: https://www.gesetze-im-internet.de/urhg/__53.html · https://www.gesetze-im-internet.de/urhg/__72.html

### 9.3 Haftung für Nutzerinhalte (DSA / DDG)

- RecipeDeck speichert von Nutzern bereitgestellte Informationen in deren Auftrag → **Hostingdienst** im Sinne des DSA (VO (EU) 2022/2065, Art. 3 lit. g iii: „ein ‚Hosting‘-Dienst, der darin besteht, von einem Nutzer bereitgestellte Informationen in dessen Auftrag zu speichern“), sofern es ein „Dienst der Informationsgesellschaft“ ist (Art. 3 lit. a verweist auf RL 2015/1535). Der Begriff setzt eine „in der Regel gegen Entgelt“ erbrachte Leistung voraus. Bei einem völlig unentgeltlichen, werbefreien Privatangebot ist die Anwendbarkeit **umstritten**. Das ist dieselbe Frage wie bei § 5 DDG.
- **Kein „Online-Plattform“-Fall:** Die Inhalte werden nicht öffentlich verbreitet, nur im Haushalt oder per Einladung. Die Art. 19 ff. greifen daher nicht.
- Falls der DSA greift, gelten auch für Kleinstanbieter (Zuordnung nach dem Aufbau des DSA; Art. 11/12/14 für alle Vermittlungsdienste, Art. 16–18 im Abschnitt Hostingdienste. Der Wortlaut von Art. 14 und 16 wurde nicht abgerufen – nicht verifiziert, Stand 07.10.2026):
  - Art. 11/12: Kontaktstelle für Behörden und Nutzer (E-Mail reicht).
  - Art. 14: Moderationsregeln in den AGB.
  - Art. 16: Meldeverfahren für rechtswidrige Inhalte („Melde- und Abhilfeverfahren“).
  - Art. 17: Begründung bei Sperrung.
  - Art. 18: Meldung von Straftaten mit Lebensgefahr.
- Die Haftungsprivilegierung folgt aus Art. 6 DSA (Hosting: keine Haftung ohne „tatsächliche Kenntnis“, unverzügliches Handeln nach Kenntnis).
- **Empfehlung:** geringer Aufwand → im Impressum bzw. in den AGB eine Kontaktstelle „Meldung rechtswidriger Inhalte“ (E-Mail) und einen Satz zum Verfahren aufnehmen.
- Quelle: https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32022R2065

### 9.4 Jugendschutz / Mindestalter

- **Art. 8 DSGVO** greift nur bei Verarbeitung auf Grundlage einer **Einwilligung** bei einem Dienst der Informationsgesellschaft, der Kindern direkt angeboten wird. Deutschland hat die Altersgrenze von 16 nicht abgesenkt (Wissenschaftliche Dienste des Bundestags, WD 10 - 3000 - 019/23 vom 17.05.2023). Bei RecipeDeck betrifft das die Push-Einwilligung. Konto und Inhalte laufen über Art. 6 Abs. 1 lit. b, dort zählt das Vertragsrecht (§§ 106 ff. BGB, beschränkte Geschäftsfähigkeit) (**h. M.**).
- **Empfehlung:** Mindestalter 16 in den Nutzungsbedingungen, ein Satz in der Erklärung. Northflank selbst verlangt 16+ für seine Kunden, das ist für Endnutzer irrelevant.
- **JMStV/JuSchG:** Keine entwicklungsbeeinträchtigenden Inhalte vom Anbieter, Nutzerinhalte nicht öffentlich → keine besonderen Pflichten (**h. M.**).
- Quelle WD: https://www.bundestag.de/resource/blob/959324/WD-10-019-23-pdf.pdf

### 9.5 Barrierefreiheitsstärkungsgesetz (BFSG)

- Das BFSG gilt seit 28.06.2025 u. a. für „Dienstleistungen im elektronischen Geschäftsverkehr“ für Verbraucher (§ 1 Abs. 3 Nr. 5).
- **§ 2 Nr. 26 BFSG** definiert „Dienstleistungen im elektronischen Geschäftsverkehr“ als Dienste, die „auf individuelle Anfrage eines Verbrauchers im Hinblick auf den Abschluss eines Verbrauchervertrags“ angeboten werden. Das ist das stärkste Argument gegen die Anwendbarkeit auf RecipeDeck.
- „Dienstleistung“ meint nach § 2 Nr. 3 BFSG eine Dienstleistung im Sinne von Art. 4 Nr. 1 RL 2006/123/EG, also „jede von Artikel 50 des Vertrags erfasste selbstständige Tätigkeit, die in der Regel gegen Entgelt erbracht wird“.
- Zudem gilt nach § 3 Abs. 3 BFSG: „Absatz 1 gilt nicht für Kleinstunternehmen, die Dienstleistungen anbieten oder erbringen.“ (Kleinstunternehmen nach § 2 Nr. 17: weniger als zehn Personen und höchstens 2 Mio. € Umsatz oder Bilanzsumme.)
- → **Nicht anwendbar** auf ein unentgeltliches Privatprojekt (**klar** bis **h. M.**). Barrierefreiheit bleibt gute Praxis.
- Quellen: https://www.gesetze-im-internet.de/bfsg/__1.html · https://www.gesetze-im-internet.de/bfsg/__2.html · https://www.gesetze-im-internet.de/bfsg/__3.html · https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32006L0123

### 9.6 Sonstige Fundstellen im Code (datenschutzrelevant)

- **EXIF/GPS in Foto-Uploads:** Serverseitig wird EXIF nicht entfernt (`src/routes/extraction.ts` Z. 265–353: Upload → Base64-Data-URL → `photoDataStore` → Groq, ggf. als Rezeptbild gespeichert).
  - **Web/PWA (Hauptkanal):** EXIF bleibt sicher erhalten, weil `compressIfNeeded` auf Web die Original-URI zurückgibt (`mobile/utils/image-compress.ts` Z. 8).
  - **Native Builds:** `expo-image-manipulator` kodiert Dateien über 256 KB neu (`image-compress.ts` Z. 14–16), `ImagePicker` läuft mit `quality: 0.85` (`extract.tsx` Z. 445, 461). Dabei gehen EXIF-Daten in der Regel verloren, aber nicht garantiert (Dateien ≤ 256 KB werden nicht neu kodiert).
  - Empfehlung: vor Weitergabe serverseitig entfernen (Art. 25 DSGVO).
- **IP-Adresse** wird beim Facebook-Import kurzzeitig im Arbeitsspeicher für die Ratenbegrenzung genutzt (`extraction.ts` Z. 109–112). In der Erklärung unter Hosting oder Missbrauchsschutz erwähnen.
- **Import-Jobs** speichern User-Agent und URL sowie `userId` und `activeHouseholdId` bis zu 7 Tage im Arbeitsspeicher (`job-manager.ts`, `JOB_CLEANUP_DAYS`). Das ist mit „Laufende Import-Aufträge werden nach spätestens sieben Tagen gelöscht“ (Z. 99–100) abgedeckt.

---

## 10. Tabelle Dienstleister

| Dienstleister | Vertragspartner / Sitz | Rolle | Daten | DPA/AVV-Link | Abschlussweg | Drittland-Grundlage | DPF (07.10.2026) |
|---|---|---|---|---|---|---|---|
| Supabase | Supabase Pte. Ltd., Singapur (bei direkter Registrierung; Supabase, Inc., USA, nur bei Cloud-Marketplace-Kauf) | Auftragsverarbeiter (DB, Auth) | Konto, Inhalte, Auth-Logs/IP | https://supabase.com/legal/customer-resources/data-processing-addendum | automatisch via ToS § 7(b); PDF und TIA laut Nutzerhinweis im Dashboard „Legal Documents“ (nicht verifiziert) | Daten in EU-Region (Irland laut Betreiber); Übermittlung an Supabase Pte. Ltd. (Singapur): EU-SCC Modul 2 im DPA | nein |
| Northflank | Northflank Ltd., London, UK | Auftragsverarbeiter (Hosting) | gesamter App-Traffic, Logs, IP | **nicht öffentlich** – anfordern | **aktiv anfordern** (legal@northflank.com / trust.northflank.com) | UK-Angemessenheitsbeschluss (bis 27.12.2031); Region offen (UK laut ToS vs. Frankfurt/NL/Zürich) | n/a |
| Brevo | Brevo GmbH, Berlin (für in DE „incorporated“ Kunden) oder Sendinblue SAS, Paris – am Konto prüfen | Auftragsverarbeiter (Transaktionsmails, Auth-Mails, Einladungen) | E-Mail-Adressen, Mailinhalt | https://www.brevo.com/legal/termsofuse/ (Appendix 3) | automatisch via ToS | EU-Hosting (FR/BE); Support Brevo Inc. und weitere Unterauftragsverarbeiter (u. a. Cloudflare, Zendesk) in den USA: DPF/SCC/BCR | ja (Brevo, Inc.) |
| Groq | Groq UK Limited (EWR-Kunden); Verarbeitung (auch) in den USA | Auftragsverarbeiter (LLM, Whisper, Vision) | Import-Inhalte, Fotos, Audio | https://console.groq.com/docs/legal/customer-data-processing-addendum | automatisch: „electronic acceptance … constitutes Customer’s signature to the DPA“ | EU-SCC (Modul 2) im DPA mit Groq UK Limited; Weiterübermittlung in die USA: Groq-Zusage nach DPA § 8.1 | **nein** |
| Cloudflare | Cloudflare, Inc., San Francisco, USA | DNS (kaum Personenbezug); R2: Auftragsverarbeiter (verschlüsselte Backups) | verschlüsselte DB-Dumps | https://www.cloudflare.com/cloudflare-customer-dpa/ | automatisch via Self-Serve Subscription Agreement | DPF + SCC; R2-Jurisdiktion `eu` | ja |
| GitHub | GitHub, Inc., San Francisco, USA | Code-Hosting (Backup-Lauf nicht mehr auf GitHub, sondern Northflank-Cron-Job) | Quellcode, Secrets des Repos | https://github.com/customer-terms/github-data-protection-agreement (nur Enterprise/Team/Copilot) | für Free-Konto **kein DPA** | DPF | ja |
| Google | Gmail: Google Ireland Limited, Dublin (Anbieter/Verantwortlicher im EWR); FCM-Push und Weiterübermittlung: Google LLC, USA | Betreiberpostfach (Gmail); FCM-Push (Chrome) | Kontakt-Mails; Push-Endpoint/Metadaten | – (Consumer-Gmail ohne AVV) | – | DPF (Google LLC) | ja |
| Mozilla / Apple Push | Mozilla Corp. / Apple Inc., USA | Push-Zustellung, vom Browser gewählt | Endpoint, verschlüsselte Payload | – | – | Übermittlung durch Browser des Nutzers | nein (kein Eintrag gefunden) |
| Chefkoch (API) | Chefkoch GmbH, DE | Empfänger (Bildvorschläge) | Rezeptname, keine personenbezogenen Daten; Bilder direkt im Browser → IP | – | – | EU | n/a |
| Cobalt (`api.cobalt.tools`) | Betreiber prüfen | Empfänger (Import-Fallback Instagram/Facebook) | Quell-URL | – | – | prüfen | – |
| Vorwerk (Cookidoo) | Vorwerk, DE | eigener Verantwortlicher | Cookidoo-Login des Nutzers | – | – | EU | n/a |
| Quell-Websites / CDNs | diverse | Empfänger beim Bildabruf | IP, User-Agent | – | – | ggf. Drittland | – |

---

## 11. Konkrete Textänderungen (mit Zeilenbezug)

### 11.1 `mobile/utils/legal-operator.ts`

| Zeile | Ist | Änderung |
|---|---|---|
| 1 | Kommentar „Impressum (§ 5 DDG)“ | „Impressum (§ 18 Abs. 1 MStV, vorsorglich § 5 DDG)“ |
| 6–8 | Platzhalter Name/Straße/Ort | Echte Angaben. Bei Impressums-Service (nur mit schriftlicher Zustellvollmacht, siehe 1.3): zusätzliche Zeile `careOf: 'c/o …'` vorsehen und in beiden Seiten rendern. Achtung: `LEGAL_PLACEHOLDERS_OPEN` (Z. 17) prüft `value.startsWith('[')` über alle Werte; neue optionale Felder (`careOf`, `phone`) so befüllen, dass der Check weiter stimmt |
| 10 | `recipedeckapp@gmail.com` | Empfehlung: Domain-Adresse (z. B. `kontakt@recipedeckapp.de`) |
| neu | – | Feld für zweiten Kontaktweg: `contactFormUrl` (öffentlich, ohne Login) **oder** `phone` |
| 12 | Platzhalter Aufsichtsbehörde | Konkrete Behörde mit URL, z. B. „Bayerisches Landesamt für Datenschutzaufsicht (BayLDA), Promenade 18, 91522 Ansbach (Postanschrift: Postfach 1349, 91504 Ansbach), www.lda.bayern.de“ – nur falls Wohnsitz in Bayern |
| 15 | `LEGAL_LAST_UPDATED` | beim Text-PR aktualisieren und auf beiden Seiten anzeigen („Stand: …“) |

### 11.2 `mobile/app/impressum.tsx`

| Zeile | Ist | Änderung |
|---|---|---|
| 7 | „Angaben gemäß § 5 DDG“ | „Angaben gemäß § 18 Abs. 1 MStV und § 5 DDG“ (oder neutral „Anbieter“) |
| 8–16 | Name/Adresse | ggf. c/o-Zeile ergänzen; sonst unverändert |
| 18–19 | nur E-Mail | zweiten Kontaktweg ergänzen: „Kontaktformular: …“ oder „Telefon: …“ |
| 21–25 | Verbraucherstreitbeilegung | **optional entfernen**: keine Pflicht (§ 36 VSBG gilt nur für Unternehmer; die Ausnahme für ≤ 10 Beschäftigte betrifft nur Abs. 1 Nr. 1). Wenn behalten: unschädlich. Keinen OS-Plattform-Link einfügen |
| 27–32 | „Haftung für Inhalte und Links“ | umformulieren in „Inhalte von Nutzerinnen und Nutzern / Meldung rechtswidriger Inhalte“: Rezepte werden von Nutzern importiert und sind nur für sie bzw. ihren Haushalt sichtbar; Meldungen rechtswidriger Inhalte an [E-Mail]; Prüfung und Entfernung nach Kenntnis (Art. 6, 16 DSA). Die pauschale Distanzierung von verlinkten Seiten kann als kurzer Satz bleiben |
| neu (Ende) | – | Optional: „RecipeDeck ist ein nicht kommerzielles Open-Source-Projekt (Quellcode: [GitHub-Link], Lizenz: …).“ Belegt die fehlende Geschäftsmäßigkeit und stärkt die Linie aus 1.1. Beim Wechsel zu Werbung oder Bezahl-Tier neu prüfen |
| Platzierung | – | Impressum und Datenschutzerklärung **nicht nur unter „Einstellungen“** verlinken: Schwenke hält Links, die erst in Untermenüs wie „Einstellungen“ zu finden sind, für „nicht einfach erkennbar“. Erreichbarkeit auch für nicht angemeldete Besucher (Login-Seite) sicherstellen |

### 11.3 `mobile/app/datenschutz.tsx`

| Zeile(n) | Ist | Änderung |
|---|---|---|
| 9–14 | Verantwortlicher | ggf. c/o-Zeile; optional: „Ein Datenschutzbeauftragter ist nicht benannt, da keine Pflicht besteht (Art. 37 DSGVO, § 38 BDSG).“ |
| 16–21 | Überblick | ergänzen: „RecipeDeck ist ein nicht kommerzielles Open-Source-Projekt.“ und „Eine automatisierte Entscheidungsfindung einschließlich Profiling (Art. 22 DSGVO) findet nicht statt.“ (Art. 13 Abs. 2 lit. f) |
| 25 | „Passwort (nur als verschlüsselter Hash)“ | „Passwort (nur als kryptografischer Hash, nie im Klartext)“ – Hash ≠ Verschlüsselung |
| 25–27 | Konto | ergänzen: „Die Angabe von E-Mail und Passwort ist für ein Konto erforderlich; ohne sie kannst du die App nicht nutzen.“ (Art. 13 Abs. 2 lit. e). Außerdem: „Mindestalter 16 Jahre.“ |
| 29–32 | „Supabase Inc. … Server in der EU (Irland). Mit Supabase besteht ein Vertrag zur Auftragsverarbeitung.“ | „Supabase Pte. Ltd., Singapur [mit Dashboard-Dokumenten abgleichen] (Datenbank und Anmeldung). Die Daten werden in der EU-Region (Irland) gespeichert. Mit Supabase besteht ein Vertrag zur Auftragsverarbeitung (Data Processing Addendum als Teil der Nutzungsbedingungen). Die Übermittlung an Supabase Pte. Ltd. in Singapur ist durch EU-Standardvertragsklauseln (Art. 46 Abs. 2 lit. c DSGVO) abgesichert.“ |
| 34–40 | Inhalte | ergänzen: (a) Rezeptbilder (bei Foto-Import dein Foto); (b) Fehlerberichte inkl. technischer Angaben (App-Version, Betriebssystem, Browser/User-Agent, Bildschirmgröße, aufgerufene Seite, Zeitpunkt; bei Import-Fehlern zusätzlich die importierte Adresse, Fehlermeldung und Auftragsnummer) – Rechtsgrundlage Art. 6 Abs. 1 lit. f (Fehlerbehebung), Speicherdauer [X Monate]; (c) Hinweis, dass Einladungsempfänger eine eigene Kopie erhalten |
| neu nach 40 | – | **Rezeptbilder von anderen Websites:** Wenn kein Proxy/Cache umgesetzt wird: „Rezeptbilder werden teils direkt von der Website geladen, aus der das Rezept stammt. Dabei erhält der Betreiber dieser Website deine IP-Adresse und Browserinformationen.“ (Rechtsgrundlage lit. f). **Besser technisch beheben** (Abschnitt 7) und den Satz dann weglassen |
| 44 | „Northflank Ltd. auf Servern in Westeuropa“ | „Northflank Ltd., London (Vereinigtes Königreich), auf Servern in [konkrete Region – vom Betreiber zu klären, siehe Abschnitt 12]. Für das Vereinigte Königreich besteht ein Angemessenheitsbeschluss der EU-Kommission (Art. 45 DSGVO). Mit Northflank besteht ein Vertrag zur Auftragsverarbeitung.“ – **erst schreiben, wenn der AVV vorliegt** |
| 45–48 | Server-Logs | ergänzen: „Beim Import von Facebook-Links nutzen wir deine IP-Adresse kurzzeitig im Arbeitsspeicher, um Missbrauch zu begrenzen; sie wird nicht gespeichert.“ Log-Frist der Anbieter konkret nennen |
| 52–54 | „an Groq, Inc. (USA) übermittelt“ | „an Groq übermittelt (Vertragspartner: Groq UK Limited, London; Verarbeitung auch auf Servern in den USA). Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.“ |
| 54 | „Groq verarbeitet die Daten nur zur Beantwortung der Anfrage.“ | präzisieren: bei aktivierter Zero Data Retention: „Groq speichert die Anfragen nicht.“ Sonst: „Groq speichert Anfragen standardmäßig nicht. Nur zur Fehleranalyse oder bei Verdacht auf Missbrauch können Anfragen bis zu 30 Tage protokolliert werden, sofern keine längere gesetzliche Aufbewahrungspflicht besteht.“ |
| 55 | Platzhalter „[EU-US Data Privacy Framework bzw. Standardvertragsklauseln – prüfen]“ | „Grundlage sind EU-Standardvertragsklauseln (Art. 46 Abs. 2 lit. c DSGVO), die Teil des Auftragsverarbeitungsvertrags mit Groq sind. Für die Weiterübermittlung in die USA hat sich Groq verpflichtet, geeignete Garantien zu schaffen. Groq ist nicht unter dem EU-US Data Privacy Framework zertifiziert.“ |
| 55–56 | Foto-Hinweis | ergänzen: „Standortdaten (EXIF) entfernen wir vor der Übermittlung.“ – **erst nach technischer Umsetzung** (serverseitig; im Web bleibt EXIF derzeit erhalten, siehe 9.6) |
| 58–61 | BYOK | ergänzen: „Nutzt du einen eigenen Schlüssel, läuft die Anfrage über dein eigenes Groq-Konto; es gelten zusätzlich die Bedingungen von Groq.“ |
| 62–65 | Chefkoch | ok. Falls Bilder direkt geladen werden: „Die vorgeschlagenen Bilder lädt dein Gerät direkt von Chefkoch; dabei wird deine IP-Adresse an Chefkoch übermittelt.“ |
| neu (§ 6) | – | Cobalt-Fallback nennen, falls in Production aktiv: „Bei manchen Instagram-/Facebook-Links wird nur der Link an den Dienst cobalt.tools übermittelt.“ |
| 69–71 | Cookidoo | ergänzen: Rechtsgrundlage Art. 6 Abs. 1 lit. b; „Die Anmeldung bei Cookidoo erfolgt in deinem Auftrag; Vorwerk verarbeitet die Daten als eigener Verantwortlicher.“; „AES-256“ → „AES-256-GCM“ |
| 76–78 | Brevo (Sendinblue SAS) | Vertragspartner aus Konto/Rechnung übernehmen: für in Deutschland ansässige Kunden voraussichtlich **Brevo GmbH, Berlin** (Sendinblue SAS dann Unterauftragsverarbeiter). Ergänzen: „Die Daten werden in Frankreich und Belgien gespeichert; einzelne Unterauftragsverarbeiter (u. a. Support, CDN) sitzen in den USA und sind über das EU-US Data Privacy Framework bzw. Standardvertragsklauseln abgesichert.“ Rechtsgrundlage für Mails an dich lit. b; für die eingeladene Person lit. f (berechtigtes Interesse am Teilen), Speicherdauer der Einladung (Ablaufdatum) und Löschung nach Ablauf. Einladungs-Mail um Kurzhinweis plus Link zur Erklärung ergänzen (Art. 14) |
| 83–85 | Push | ergänzen: „Der Inhalt der Benachrichtigung ist verschlüsselt; der Push-Dienst sieht nur technische Zustelldaten. Push-Dienste können ihren Sitz in den USA haben (z. B. Google LLC).“ Und: „Wir speichern die Push-Adresse, bis du Benachrichtigungen abschaltest oder dein Konto löschst.“ |
| 91–94 | Gerätespeicher | aufzählen: Anmeldesitzung (Local Storage), Einstellungen (Design, Ansicht), ggf. eigener Groq-Schlüssel, Offline-Zwischenspeicher (Service Worker / Cache Storage), Warteschlange für Offline-Änderungen (IndexedDB). „(§ 25 Abs. 2 TDDDG)“ → „(§ 25 Abs. 2 Nr. 2 TDDDG)“; Umbruch Z. 93/94 glätten. Ergänzen: „Beim Abmelden löschen wir den Offline-Zwischenspeicher.“ |
| neu (vor § 11) | – | **Abschnitt „Datensicherung“** mit dem Formulierungsvorschlag aus Abschnitt 5 (Cloudflare, EU-Speicher, verschlüsselt, ≤ 35 Tage, Nachlöschung bei Restore). Die Sicherung läuft als Northflank-Cron-Job (Betreiberentscheidung 07.10.2026); ein gesonderter Satz zu GitHub entfällt |
| neu | – | **Abschnitt „Kontakt per E-Mail“:** Verarbeitung der Mail zur Bearbeitung (lit. b/f), Speicherdauer; bei Gmail: Google Ireland Limited als Anbieter, Weiterübermittlung an Google LLC (USA, DPF) |
| neu | – | **Abschnitt „Empfänger und Übermittlung in Drittländer“** (Art. 13 Abs. 1 lit. e/f): kurze Übersicht der Tabelle aus Abschnitt 10 |
| 99 | „solange dein Konto besteht“ | ok |
| 100–101 | „in der Regel nach wenigen Tagen“ | konkrete Höchstfristen der Anbieter nennen |
| 103–104 | „Von dir gesendete Fehlerberichte bleiben ohne Bezug zu deinem Konto erhalten.“ | „Von dir gesendete Fehlerberichte bleiben ohne Verknüpfung mit deinem Konto bis zu [X Monate] erhalten. Den Text, den du selbst eingegeben hast, löschen wir auf Wunsch.“ (vorher Code: `metadata_json` bereinigen, inkl. `activeHouseholdId` und `lastFailureSnapshot`; Spalte `route` berücksichtigen) |
| 104–105 | Haushalt mit Mitgliedern | ergänzen: „Wir bearbeiten deine Anfrage innerhalb eines Monats.“ und „Kopien von Rezepten, die andere über eine Einladung übernommen haben, gehören zu deren Konten und bleiben erhalten.“ |
| neu (§ 11) | – | Backup-Satz: „In Sicherungskopien sind deine Daten noch bis zu 35 Tage enthalten (siehe Datensicherung).“ |
| 109–118 | Rechte-Liste | Art.-21-Eintrag aus der Liste nehmen und als **eigenen, hervorgehobenen Absatz** setzen („Widerspruchsrecht: Verarbeitungen, die wir auf unser berechtigtes Interesse stützen (Art. 6 Abs. 1 lit. f), kannst du jederzeit aus Gründen widersprechen, die sich aus deiner besonderen Situation ergeben …“). Ergänzen: Datenübertragbarkeit „auf Anfrage als maschinenlesbare Datei“ |
| 120–121 | „zum Beispiel bei: {supervisoryAuthority}“ | „Zuständig ist: {Behörde, Anschrift, URL}“ – das „zum Beispiel“ kann bleiben, weil Art. 77 die Wahl lässt |
| Ende | – | „Stand: {LEGAL_LAST_UPDATED}“ anzeigen; Satz zu Änderungen der Erklärung |

---

## 12. Vom Betreiber zu klären

Zusammengeführt aus den bisherigen offenen Punkten und den im Faktencheck nicht verifizierbaren Angaben. Nur der Betreiber kann diese Punkte klären.

**Angaben und Entscheidungen**

1. **Bundesland / Aufsichtsbehörde:** Wohnsitz bzw. Bundesland bestimmt die zuständige Behörde (Abschnitt 8). Bei Bayern: BayLDA mit Postanschrift Postfach 1349, 91504 Ansbach.
2. **Anschrift vs. c/o mit Zustellvollmacht:** Privatanschrift oder Impressums-Service. Ein Service kommt nur mit **schriftlicher** Zustellvollmacht (§ 171 ZPO) in Frage; ein reiner Postweiterleitungsdienst genügt nach BGH V ZR 210/22 nicht (Abschnitt 1.3).
3. **Zweiter Kontaktweg:** öffentliches Formular oder Telefonnummer.

**Northflank**

4. **Northflank-Region:** Welche Region bzw. Cloud wird genutzt? Die ToS sagen „hosted in the United Kingdom“, angeboten werden auch Frankfurt, Niederlande und Zürich (Schweiz). Nur im Account prüfbar.
5. **Northflank-DPA** anfordern (legal@northflank.com / Trust Center). Dabei Region und Unterauftragsverarbeiter (Cloud-Anbieter) erfragen. Ob Northflank Self-Serve-Kunden einen DPA gibt, ist offen.

**Brevo**

6. **Brevo-Vertragspartner:** Aus Konto bzw. Rechnung ablesen, ob Brevo GmbH (Berlin) oder Sendinblue SAS (Paris) Vertragspartner ist. Ob „incorporated in Germany“ eine Privatperson erfasst, ist unklar.

**Supabase**

7. **Supabase-Dashboard-Dokumente:** Unter *Organization → Legal Documents* DPA und TIA herunterladen und ablegen. Prüfen, wen die TIA als **Importeur** nennt: Steht dort Supabase Inc., widerspricht das dem DPA (Importeur Supabase Pte. Ltd.). Außerdem den Vertragspartner (Pte. Ltd. bei direkter Registrierung) bestätigen.
8. **Supabase-Projektregion:** Dass das Projekt in der EU-Region Irland liegt, im Dashboard bestätigen.

**Technik und Betrieb**

9. **Groq-Console:** ZDR aktivieren und Screenshot ablegen.
10. **Cobalt:** Ist Cobalt in Production aktiv (`COBALT_API_URL`/`COBALT_API_KEY` in der Northflank-Env)?
11. **Backup:** Der Ausführungsort ist entschieden (Northflank-Cron-Job, 07.10.2026). Offen: R2-Bucket mit Jurisdiktion `eu` anlegen.
12. **Fehlerberichte:** Löschfrist festlegen. Bereinigung von `metadata_json` (`activeHouseholdId`, `lastFailureSnapshot`) umsetzen und die Spalte `route` berücksichtigen.

**Für die Gegenlese offen (nicht verifiziert, Stand 07.10.2026)**

13. Beschlussdatum 04.06.2026 der Zulassung Microsofts als Streithelfer in C-703/25 P (Zulassung selbst belegt).
14. Stand des Omnibus-IV-Pakets zu Art. 30 Abs. 5 DSGVO.
15. Wortlaut von DSA Art. 14 und 16 (Zuordnung nur systematisch geprüft).
16. Urteilsvolltext OLG Frankfurt 6 U 150/19 (Zitat nur aus Kanzlei-Zusammenfassung).
17. Subsumtion von RecipeDeck unter § 18 Abs. 1 MStV sowie das Abmahnrisiko (UWG) – plausibel, aber ohne Quelle für den konkreten Fall.
18. **Gegenlesen des fertigen Textes** (Anwalt oder Generator-Abgleich).
