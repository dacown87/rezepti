# Faktencheck 2 – Auftragsverarbeiter / Drittland (Abschnitte 3, 4.1, 4.2, 10)

Geprüftes Dokument: `docs/legal/2026-10-impressum-datenschutz-recherche.md`
Abrufdatum aller Quellen: **07.10.2026** (live abgerufen per curl/Firecrawl mit maxAge 0; DPF über die API, die dataprivacyframework.gov selbst nutzt: `https://dpfapi.azurewebsites.net/api/participants`, vollständige Listen Active = 3.677 und Inactive = 3.954 Einträge heruntergeladen und lokal durchsucht, inkl. „Covered Entities“).

Urteile: **bestätigt** / **teilweise** / **falsch** / **nicht verifizierbar**

---

## A. Supabase

| # | Behauptung (Dok.) | Urteil | Wörtliches Zitat | URL | Korrekte Aussage |
|---|---|---|---|---|---|
| S1 | DPA „supplements and forms part of the Supabase Terms of Service“, Version 1 – 01.08.2026 | bestätigt | „Version 1 — August 1, 2026 … This Data Processing Addendum (the “DPA”) supplements and forms part of the Supabase Terms of Service …“ | https://supabase.com/legal/customer-resources/data-processing-addendum | – |
| S2 | Terms § 7(b): „The Parties agree to comply with the Data Processing Addendum, which is incorporated into this Agreement.“ | bestätigt | § 7 „Personal Information“, lit. b „Customer Data“: „The Parties agree to comply with the Data Processing Addendum, which is incorporated into this Agreement.“ | https://supabase.com/terms | – |
| S3 | Terms Stand 05.10.2026 | bestätigt | „Version 4 — October 5, 2026“ | https://supabase.com/terms | – |
| S4 | DPA wird automatisch einbezogen (Annahme ToS = Abschluss) | bestätigt | DPA § 12.2: „The Parties agree that acceptance of the Agreement shall have the same effect as signing the SCCs.“ Terms: „THIS AGREEMENT TAKES EFFECT WHEN YOU CLICK THE "I ACCEPT" BUTTON BELOW OR BY ACCESSING OR USING THE SERVICES“ | wie S1/S2 | – |
| S5 | DPA nennt Supabase Pte. Ltd. (Singapur) | bestätigt | „…between the Customer and Supabase Pte. Ltd (“Supabase”)“; Schedule 2, 1.7(c): „the data importer is Supabase Pte. Ltd whose offices are located at 65 Chulia Street #38-02/03, OCBC Centre, Singapore 049513“ | S1 | – |
| S6 | „Terms nennen ‚Supabase, Inc. or Supabase Pte. Ltd.‘“ / Tabelle 10: „(Terms: auch Supabase, Inc., USA)“; 4.2: „ggf. Supabase Inc. (USA)“ | **teilweise** | Terms § 1(j): „the Supabase entity contracting with Customer hereunder will be (i) Supabase, Inc. … if Customer is purchasing via a cloud service provider marketplace, or (ii) Supabase Pte. Ltd. … if Customer is not purchasing via a cloud service provider marketplace.“ | https://supabase.com/terms | Bei direkter Registrierung (kein AWS-/Cloud-Marketplace) ist der Vertragspartner **ausschließlich Supabase Pte. Ltd., Singapur**. Supabase, Inc. nur bei Marketplace-Kauf. |
| S7 | 4.2: SCC nur „für Zugriffe aus Drittländern (Support, Unterauftragsverarbeiter)“; Zitat „The Standard Contractual Clauses shall … apply to the transfer of any Covered Data … to the extent that the GDPR … appl[ies]“ | **teilweise** | § 12.1: „The Standard Contractual Clauses shall, as further set out in Schedule 2, apply to the transfer of any Covered Data **from Customer to Supabase**, and form part of this DPA, to the extent that: (a) the GDPR or Swiss Data Protection Laws apply to the Customer when making that transfer“; Modul 2 (C2P), Recht/Gerichte Irland | S1 | Zitat korrekt (gekürzt). Aber: Die SCC greifen schon für die Übermittlung **an den Vertragspartner selbst** (Supabase Pte. Ltd., Singapur – Drittland ohne Angemessenheitsbeschluss), nicht nur für Support-/Unterauftragsverarbeiter-Zugriffe. Für die Erklärung: „Übermittlung an Supabase Pte. Ltd. (Singapur) auf Grundlage von EU-SCC (Modul 2), Daten werden in der EU-Region gespeichert“. |
| S8 | Supabase kein DPF-Eintrag | bestätigt | DPF-API-Suche „Supabase“: Active 0, Inactive 0; Volltext beider Listen ohne Treffer | https://www.dataprivacyframework.gov/list (API s. o.) | – |
| S9 | Projektdaten AWS EU (Irland) „laut Betreiber“ | nicht verifizierbar (projektspezifisch) | Supabase allgemein: „Projects hosted in EU regions keep your primary database data in-region“; DPA § 6.1: „Where Customer directs Supabase to Process Covered Data in a specific geographical region, Supabase shall ensure that such Covered Data is stored and primarily Processed in that region“ | https://supabase.com/security · S1 | Region nur im Dashboard prüfbar; Grundsatz „in-region“ bestätigt. |
| S10 | DPA + TIA im Dashboard unter *Organization → Legal Documents* | nicht verifizierbar (Login nötig) | Öffentlich nur: „A Data Processing Agreement (DPA) is available … Request or view the DPA.“ Keine öffentliche Erwähnung einer TIA gefunden | https://supabase.com/security | Vom Betreiber im Dashboard bestätigen; TIA/„Supabase Inc. als Importeur“ beruht nur auf Nutzerhinweis. Hinweis: Wenn die TIA Supabase Inc. als Importeur nennt, widerspricht das dem DPA (Importeur = Pte. Ltd.) → klären. |
| S11 | GitHub-Discussion #2341 als Quelle | teilweise (veraltet) | Antwort vom 11.05.2022: „We do actually have a DPA now … You can open a ticket in your dashboard to request it“ | https://github.com/orgs/supabase/discussions/2341 | Quelle von 2022, durch das öffentliche DPA (v1, 01.08.2026) überholt; als Beleg entbehrlich. |

## B. Northflank

| # | Behauptung | Urteil | Zitat | URL | Korrektur |
|---|---|---|---|---|---|
| N1 | Kein öffentlicher DPA | bestätigt | Legal-Bereich enthält nur Terms, Privacy, Cookies; `northflank.com/legal/dpa` und `/dpa` → HTTP 404; Sitemap (4.958 URLs) enthält unter `legal` nur `/legal/terms`, `/legal/privacy`, `/legal/cookies`, keine URL mit „dpa“/„data-processing“; Websuche „Northflank DPA“ ohne Northflank-DPA-Treffer | https://northflank.com/legal/terms · https://northflank.com/sitemap.xml | – |
| N2 | ToS Effective 01.03.2021 | bestätigt | „Effective Date: **1 March 2021**“ | https://northflank.com/legal/terms | – |
| N3 | Privacy Policy regelt nur Northflank als Verantwortlichen | bestätigt | „If you are a resident in the European Economic Area, the "data controller" of your personal information is Northflank Ltd.“ (Privacy Policy, Effective Date: 1 March 2021); kein Abschnitt zu Northflank als Processor | https://northflank.com/legal/privacy | – |
| N4 | Trust Center (Vanta) nur nach Zugangsanfrage | bestätigt | trust.northflank.com zeigt nur ein Formular: „Northflank's Trust Center … Request access … Already have access? Reclaim access“ (og:image auf app.vanta.com). Security-Seite: „Request access to our trust center here: trust.northflank.com“ | https://trust.northflank.com/ · https://northflank.com/security | Ergänzend: BAAs nur „Under an Enterprise contract“; DPA-Verfügbarkeit für Self-Serve nirgends öffentlich zugesagt. |
| N5 | Kontakt legal@northflank.com | bestätigt | „contact us via email on legal@northflank.com“ | Terms | – |
| N6 | Northflank Ltd., 20-22 Wenlock Road, London N1 7GU | bestätigt | „Northflank Ltd, 20-22 Wenlock Road, London, N1 7GU, United Kingdom“; Footer: „Company 11918540“ | Terms / Privacy | – |
| N7 | Datenort „Region Westeuropa“ | teilweise / nicht verifizierbar | Terms: „Our Services are hosted in the United Kingdom“; Regionsseite listet „Europe - West“, „Europe - West - Frankfurt“, „Europe - West - Netherlands“, „Europe - West - Zurich“ | https://northflank.com/legal/terms · https://northflank.com/cloud/northflank/regions | Welche Region/Cloud konkret genutzt wird, nur im Account prüfbar. Achtung: „europe-west-zurich“ wäre Schweiz (eigener Angemessenheitsbeschluss). Der ToS-Satz „hosted in the United Kingdom“ (Stand 2021) passt nicht zur Regionsauswahl → beim DPA-Anfordern Region + Unterauftragsverarbeiter erfragen. |
| N8 | Northflank kein DPF-Eintrag | bestätigt | DPF-API „Northflank“: Active 0, Inactive 0 | DPF-API | – |

## C. Brevo

| # | Behauptung | Urteil | Zitat | URL | Korrektur |
|---|---|---|---|---|---|
| B1 | DPA ist Appendix 3 der ToS (Stand 01.10.2025) | bestätigt | „Brevo Terms of Service Version : October 1st, 2025 … Appendix 3: Data Processing Agreement (DPA)“; „This Data Processing Agreement and its Annex (collectively, the “DPA”) is part of the Terms of Service between You and Us“ | https://www.brevo.com/legal/termsofuse/ | – |
| B2 | gilt mit Kontoannahme | bestätigt | „The Brevo Terms of Service constitute a binding agreement that governs all customer use of the Brevo Services. This agreement is comprised of … Appendix 3: Data Processing Agreement (DPA)“ | dito | – |
| B3 | Hilfeartikel verweist auf DPA in den ToS | bestätigt | „You can find the DPA in Brevo's Terms of Service, under the Data Processing Agreement (DPA) section.“ | https://help.brevo.com/hc/en-us/articles/15403782599570 | – |
| B4 | Vertragspartner Sendinblue SAS, 9-17 rue Salneuve, 75017 Paris | **teilweise** | Allgemein: „Sendinblue, a simplified joint-stock company … registered office at 9-17, rue Salneuve 75017 Paris“. **Aber** Appendix 2: „For Users incorporated in Germany, Switzerland or Austria, the following supplemental terms will apply: Brevo. **Brevo GmbH**, … HRB 133191 … Köpenicker Str. 126, 10179 Berlin, Germany … is the signatory and billing entity under these supplemental terms.“ Unterauftragsverarbeiter-Liste: „Sendinblue SAS (Brevo France) … acting as sub-processor if You have contracted with another Brevo entity“ | https://www.brevo.com/legal/termsofuse/ | Für in Deutschland ansässige Kunden ist Vertragspartner voraussichtlich **Brevo GmbH, Berlin**; Sendinblue SAS dann Unterauftragsverarbeiter. Ob „incorporated in Germany“ auch eine Privatperson erfasst, ist unklar → Vertragspartner aus Rechnung/Account ablesen. In beiden Fällen EU. |
| B5 | Datenort Frankreich/Belgien | bestätigt | „OVH Hosting France France N/A Google Cloud Platform (GCP) Hosting France Belgium …“ | dito (Annex Sub-Processors) | – |
| B6 | Support-Zugriff Brevo Inc. (USA) über DPF + SCC | bestätigt | „Sendinblue Inc. Group Company … Customer experience & Maintenance USA France and Belgium EU-US Data Privacy Framework Standard Contractual Clauses and supplementary measures“ | dito | – |
| B7 | (implizit) einziger US-Bezug ist Brevo Inc.-Support | **teilweise** | Weitere US-Unterauftragsverarbeiter u. a.: „Cloudflare Content Delivery Network & WAF USA USA/EU EU-US Data Privacy Framework Standard Contractual Clauses …“, „Zendesk Ticketing/support tool USA EU/USA BCR Standard Contractual Clauses“; DPA: „We may rely on the EU-US Data Privacy Framework for transfers to the US, as long as this framework remains valid.“ | dito | Erklärung: „Hosting in FR/BE; einzelne Unterauftragsverarbeiter (u. a. Support, CDN) in den USA auf Basis DPF/SCC“. |
| B8 | DPF: Brevo, Inc. ID 10010, Legal Name „Seninblue, Inc.“, Austin TX, Active, gültig bis 26.02.2027, nur Support, „does not involve any hosting … in the US“ | bestätigt | API participant 10010: `LegalName: "Seninblue, Inc."`, `PublicDisplayName: "Brevo, Inc."`, Austin TX; EU-US „Active“, InstallDate 2026-02-26, UsageEndDate 2027-02-26; Purpose: „The specific part of service provided by Brevo Inc. is customer support … This processing does not involve any hosting of personal data by Brevo, Inc. in the US.“ | https://www.dataprivacyframework.gov/participant/10010 | „gültig bis“ = Datum der fälligen Re-Zertifizierung, kein Ablaufdatum im strengen Sinn. Schreibfehler „Seninblue“ steht so im Register. Suche „Sendinblue“: 0 Treffer. |

## D. Groq

| # | Behauptung | Urteil | Zitat | URL | Korrektur |
|---|---|---|---|---|---|
| G1 | DPA „is incorporated into and made part of the Groq Services Agreement“ | bestätigt | „This Data Processing Addendum (“DPA”) is incorporated into and made part of the Groq Services Agreement between the Groq Contracting Party and Customer“ | https://console.groq.com/docs/legal/customer-data-processing-addendum | – |
| G2 | „Customer’s electronic acceptance of the Services Agreement constitutes Customer’s signature to the DPA.“ | bestätigt | wörtlich in Schedule A, Annex I.A | dito | – |
| G3 | DPA vom 15.10.2025 | bestätigt | „Effective: October 15, 2025“ | dito | – |
| G4 | Services Agreement vom 22.06.2026 | bestätigt | „Last Modified: June 22, 2026“ | https://console.groq.com/docs/legal/services-agreement | – |
| G5 | Vertragspartner EWR: Groq UK Limited | bestätigt | „“Groq Contracting Party” means (a) Groq LLC for Customers domiciled outside the European Economic Area, Switzerland, or the Kingdom of Saudi Arabia; (b) **Groq UK Limited for Customers domiciled in the European Economic Area or Switzerland**“; Adresse „Groq UK Limited 3 Hammersmith Grove, London W6 0ND, UK“, Recht England & Wales | dito | – |
| G6 | Verarbeitung durch Groq LLC (USA) | teilweise / nicht wörtlich belegt | DPA § 8.1: „Groq may transfer and Process Personal Data to and in the United States and other countries where Groq or its Subprocessors maintain Processing operations.“ | DPA | USA-Verarbeitung bestätigt; dass konkret **Groq LLC** verarbeitet, steht nirgends ausdrücklich. Formulierung: „Verarbeitung (auch) in den USA“. |
| G7 | GCP-Buckets „located in the United States“ | bestätigt | „All customer data is retained in Google Cloud Platform (GCP) buckets located in the United States.“ | https://console.groq.com/docs/your-data | – |
| G8 | „Weiter in die USA: EU-SCC (+ UK-Addendum) im Groq-DPA“ | **teilweise** | § 8.2: „To the extent legally required, by entering into the Agreement, Customer and Groq are deemed to have signed the EU SCCs … Module 2 of the EU SCCs applies to transfers of Personal Data from Customer (as a Controller) to Groq (as a Processor)“; § 8.3: UK Addendum „For transfers of Personal Data subject to the UK GDPR“; § 8.1: „Where Groq engages in an onward transfer of Personal Data, Groq will ensure that a lawful data transfer mechanism is in place“ | DPA | SCC und UK-Addendum sind im DPA enthalten, aber zwischen **Kunde und Groq-Vertragspartei** (Modul 2), und nur „to the extent legally required“. Die Weiterübermittlung UK→USA sichert Groq selbst über § 8.1 zu (bzw. SCC-Klausel 8.7 als Onward-Transfer). Das UK-Addendum betrifft UK-GDPR-Exporte, nicht EU-Exporte. Formulierung: „EU-SCC im DPA mit Groq; Groq verpflichtet sich, für Weiterübermittlungen in die USA geeignete Garantien zu schaffen.“ Groq selbst: „Where applicable, Customers can rely on standard contractual clauses (SCCs) for transfers between third countries and the U.S.“ |
| G9 | Groq kein DPF-Eintrag (weder aktiv noch inaktiv) | bestätigt | DPF-API „Groq“: Active 0, Inactive 0; Volltextsuche beider Listen ohne Treffer. DPA erwähnt das DPF nicht („Data Privacy Framework“: 0 Treffer) | DPF-API · DPA | – |
| G10 | Unterauftragsverarbeiter u. a. Google Cloud, Cloudflare (trust.groq.com/subprocessors) | bestätigt | „Google Cloud Platform • Cloud provider Mountain View, CA“; „CloudFlare • Cloud Connectivity Provides web application firewall (WAF) and content delivery network (CDN) services“ (18 Einträge, u. a. Stytch, Stripe, Intercom) | https://trust.groq.com/subprocessors | – |
| G11 | Zero Data Retention in der Console aktivierbar (Data Controls) | bestätigt | „All customers may enable Zero Data Retention (ZDR) in Data Controls settings. When ZDR is enabled, Groq will not retain customer data for system reliability and abuse monitoring.“ | https://console.groq.com/docs/your-data | – |
| G12 | Standard-Aufbewahrung 30 Tage (Dok. Z. 38: „Sonst speichert Groq Anfragen bis zu 30 Tage zur Missbrauchserkennung“) | **teilweise** | „Customer data : not retained by default.“ „inference requests are not retained by default. We may temporarily log inputs and outputs only when: Troubleshooting errors … or Investigating suspected abuse … These logs are retained for up to 30 days, unless legally required to retain longer.“ | dito | Keine pauschale 30-Tage-Speicherung: Standard ist **keine** Speicherung; nur anlassbezogenes Logging (Fehleranalyse/Missbrauchsverdacht) bis zu 30 Tage, ggf. länger bei gesetzlicher Pflicht. Batch-Dateien 30 Tage (nicht genutzt). Die Formulierung in Z. 504 („grundsätzlich nicht, kann sie aber bis zu 30 Tage … aufbewahren“) ist korrekt; Z. 38 sollte so angepasst werden. |

## E. Cloudflare

| # | Behauptung | Urteil | Zitat | URL | Korrektur |
|---|---|---|---|---|---|
| C1 | Standard-DPA „incorporated by reference into our Self-Serve Subscription Agreement“; „no action is required“ | bestätigt | „These representations are contained in our standard DPA, which is incorporated by reference into our Self-Serve Subscription Agreement. To the extent the personal data transfer requires the SCCs, then our DPA incorporates the SCCs for this data. Therefore, no action is required …“ | https://www.cloudflare.com/trust-hub/gdpr/ | – |
| C2 | Vertragspartner Cloudflare, Inc., San Francisco | bestätigt | „Cloudflare Data Processing Addendum Version 6.4, effective April 3, 2026 Cloudflare, Inc. (“Cloudflare”) and the counterparty …“; Importeur: „Cloudflare, Inc. Address: 101 Townsend Street San Francisco, CA 94107 USA“ | https://www.cloudflare.com/cloudflare-customer-dpa/ | – |
| C3 | DPF + SCC im DPA | bestätigt | Trust Hub: „we have also certified our compliance with the EU-U.S. Data Privacy Framework … These representations are contained in our standard DPA“; DPA definiert „Data Privacy Framework“ und „EU SCCs“ | C1/C2 | – |
| C4 | R2: nur Jurisdiktion `eu` garantiert, Location Hints „best effort“ | bestätigt | „Location Hints are a best effort and not a guarantee“; „Jurisdictional Restrictions guarantee objects in a bucket are stored within a specific jurisdiction. … including local regulations such as the GDPR“; verfügbare Jurisdiktionen: „eu European Union, fedramp FedRAMP, us United States“ | https://developers.cloudflare.com/r2/reference/data-location/ (Last updated Aug 19, 2026) | – |
| C5 | DPF Cloudflare, Inc. ID 5666, „Active – Re-certification under Review“, bis 15.09.2027 | bestätigt | API 5666: EU-US „Active - Re-certification under Review“, UsageEndDate 2027-09-15 | https://www.dataprivacyframework.gov/participant/5666 | – |
| C6 | DNS ohne Proxy: Nutzer-Traffic läuft nicht über Cloudflare | bestätigt (technisch, keine Anbieterquelle nötig) | – | – | Ergänzung: DNS-Anfragen der Resolver landen weiterhin bei Cloudflare (meist Resolver-IP, nicht Nutzer-IP). |

## F. GitHub / Microsoft

| # | Behauptung | Urteil | Zitat | URL | Korrektur |
|---|---|---|---|---|---|
| H1 | GitHub-DPA gilt nur für „GitHub Enterprise Cloud, GitHub Enterprise (Unified), GitHub Teams, and GitHub Copilot“ | bestätigt | „The GitHub DPA applies to the processing of data for GitHub Enterprise Cloud, GitHub Enterprise (Unified), GitHub Teams, and GitHub Copilot.“ DPA selbst: „“Online Services” means any service or software that GitHub provides You under a written and executed agreement.“ | https://github.com/customer-terms · https://github.com/customer-terms/github-data-protection-agreement | (curl lieferte zeitweise HTTP 500; per Firecrawl abgerufen.) |
| H2 | Free-Konto: Verweis auf Privacy Statement + ToS, keine Art.-28-Vereinbarung | bestätigt | „The GitHub General Privacy Statement applies to the personal data that GitHub processes as the “data controller” when you interact with GitHub websites, applications, and services.“ | https://github.com/customer-terms · https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement (Effective date: April 27, 2026) | Ergänzung: Verantwortlicher ist „GitHub, Inc. or GitHub B.V.“ (Amsterdam). |
| H3 | Runner in Azure-Rechenzentren (USA) | **teilweise** | „Windows and Ubuntu runners are hosted in Azure … macOS runners are hosted in GitHub's own macOS cloud.“ | https://docs.github.com/en/actions/reference/runners/github-hosted-runners | Azure bestätigt, **Standort USA nicht dokumentiert** → „Azure-Rechenzentren, Standort nicht festgelegt (Drittland möglich)“. |
| H4 | DPF GitHub ID 6174, Active, bis 03.08.2027 | bestätigt | API 6174: LegalName „GitHub“, EU-US „Active“, UsageEndDate 2027-08-03 (nur NonHRData) | https://www.dataprivacyframework.gov/participant/6174 | GitHub hat einen **eigenen** Eintrag; Microsoft Corporation (ID 6474) ist separat „Active - Re-certification under Review“ bis 31.08.2027. Privacy Statement: „GitHub also complies with the EU-U.S. Data Privacy Framework“. |
| H5 | GitHub DPA sieht DPF und/oder SCC vor | bestätigt (Zusatz) | „subject to GitHub’s self-certification to the EU-US Data Privacy Framework … and/or ii. through the Standard Contractual Clauses.“ | GitHub DPA | gilt nur für die DPA-Pläne, nicht Free. |

## G. Google

| # | Behauptung | Urteil | Zitat | URL | Korrektur |
|---|---|---|---|---|---|
| GO1 | Consumer-Gmail ohne AVV, Google eigener Verantwortlicher | bestätigt | Privacy Policy (Effective October 1, 2026): „the data controller responsible for processing your information depends on where you are based: Google Ireland Limited for users of Google services based in the European Economic Area or Switzerland“ | https://policies.google.com/privacy | – |
| GO2 | Tabelle 10: Vertragspartner „Google LLC, USA“ (4.2: „Google LLC bzw. Google Ireland“) | **teilweise** | Terms: „In the European Economic Area (EEA) and Switzerland, Google services are provided by: Google Ireland Limited … Gordon House, Barrow Street Dublin 4 Ireland“ | https://policies.google.com/terms | Für das Gmail-Konto eines Betreibers in DE: Anbieter und Verantwortlicher ist **Google Ireland Limited**; Google LLC (USA) ist Empfänger der Weiterübermittlung. |
| GO3 | DPF Google LLC ID 5780, Active, bis 13.09.2027 | bestätigt | API 5780: EU-US „Active“, UsageEndDate 2027-09-13 | https://www.dataprivacyframework.gov/participant/5780 | – |

## H. Sonstige DPF-Angaben (4.1)

| # | Behauptung | Urteil | Beleg |
|---|---|---|---|
| D1 | Apple Inc., Mozilla Corp.: kein Eintrag | bestätigt | Volltextsuche „apple inc“/„mozilla“ in Active + Inactive: nur „SP & Big Apple Inc.“ (inaktiv, irrelevant); kein Apple-/Mozilla-Eintrag |
| D2 | Öffentliche Ansicht /list und /participant/5666 | bestätigt | Beide URLs liefern die SPA (HTTP 200); Daten kommen von `https://dpfapi.azurewebsites.net/api/participants[/<id>]` |

## I. UK-Angemessenheitsbeschluss

| # | Behauptung | Urteil | Zitat | URL | Korrektur |
|---|---|---|---|---|---|
| U1 | Erneuert am 19.12.2025 | bestätigt | „Commission Implementing Decision (EU) 2025/2574 of 19 December 2025 amending Commission Implementing Decision (EU) 2021/1772 … (notified under document C(2025) 8771)“; „OJ L, 2025/2574, 23.12.2025“ | https://eur-lex.europa.eu/eli/dec_impl/2025/2574/oj/eng | Im Amtsblatt veröffentlicht am 23.12.2025. |
| U2 | Gültig bis 27.12.2031 | bestätigt | Art. 4 (neu): „This Decision shall expire on 27 December 2031, unless extended in accordance with the procedure referred to in Article 93(2) of Regulation (EU) 2016/679.“ ErwGr. 131: „six years“ | dito; ICO: „Both adequacy decisions last until 27 December 2031.“ | – |
| U3 | „Halbzeitprüfung nach 4 Jahren“ | **teilweise** | ErwGr. 127: „Such evaluations should take place **at least every four years**“ | EUR-Lex | Keine „Halbzeitprüfung“, sondern periodische Überprüfung **mindestens alle vier Jahre** (Art. 45 Abs. 3 DSGVO), zusätzlich laufendes Monitoring mit Möglichkeit der Aussetzung. |
| U4 | Zwischenschritt | bestätigt (Zusatz) | Zwischenverlängerung Durchführungsbeschluss (EU) 2025/1226 vom 24.06.2025 bis 27.12.2025 (Sekundärquelle bratby.law, eucrim) | https://eucrim.eu/news/commission-renewed-adequacy-decisions-for-data-transfers-to-the-uk/ | – |

---

## Zusammenfassung der Abweichungen

**Falsch:** keine harte Falschaussage gefunden.

**Teilweise (korrigieren):**
1. **Supabase-Vertragspartner (S6):** Bei direkter Registrierung ist nur Supabase Pte. Ltd. (Singapur) Vertragspartner; Supabase, Inc. nur bei Marketplace-Kauf.
2. **Supabase-SCC (S7):** Die SCC (Modul 2) gelten schon für die Übermittlung an die Pte. Ltd. selbst (Singapur hat keinen Angemessenheitsbeschluss), nicht nur für Zugriffe durch Support oder Unterauftragsverarbeiter.
3. **Brevo-Vertragspartner (B4):** Für Kunden, die in DE/AT/CH „incorporated“ sind, ist Brevo GmbH (Berlin) Vertragspartner, Sendinblue SAS dann Unterauftragsverarbeiter. Ob das für eine Privatperson gilt, ist unklar; am Konto bzw. an der Rechnung prüfen.
4. **Brevo-US-Bezug (B7):** Neben dem Support durch Brevo Inc. gibt es weitere US-Unterauftragsverarbeiter (Cloudflare CDN/WAF, Zendesk u. a.), jeweils über DPF/SCC/BCR.
5. **Groq-SCC (G8):** Die SCC laufen zwischen Kunde und Groq UK Ltd. und gelten nur „to the extent legally required“. Die Weiterübermittlung UK→USA sichert Groq über § 8.1 zu; das UK-Addendum betrifft UK-Exporte.
6. **Groq-Verarbeiter (G6):** „Groq LLC“ als verarbeitende Stelle ist nicht ausdrücklich belegt, belegt ist nur die Verarbeitung in den USA.
7. **Groq-Aufbewahrung (G12):** Standard ist keine Speicherung. Nur anlassbezogen (Fehleranalyse, Missbrauchsverdacht) bis zu 30 Tage. Z. 38 des Dokuments anpassen.
8. **GitHub-Runner (H3):** Azure ist belegt, der Standort USA nicht dokumentiert.
9. **Gmail (GO2):** Für EWR-Nutzer sind Google Ireland Limited Anbieter und Verantwortlicher, nicht Google LLC.
10. **UK-Angemessenheit (U3):** Keine „Halbzeitprüfung“, sondern eine Überprüfung mindestens alle vier Jahre.
11. **Northflank-Datenort (N7):** Die ToS sagen „hosted in the United Kingdom“, angeboten werden aber Regionen in DE, NL und CH. Die konkrete Region ist offen.

**Nicht verifizierbar (Login bzw. Betreiberwissen nötig):**
- Supabase: Dashboard-Bereich *Legal Documents*, die TIA und deren Importeur „Supabase Inc.“ (S10). Ein Widerspruch zum DPA (Importeur Pte. Ltd.) wäre möglich.
- Supabase-Projektregion Irland (S9).
- Northflank: konkrete Region und Cloud-Unterauftragsverarbeiter (N7). Ob Northflank einem Self-Serve-Kunden auf Anfrage einen DPA gibt, ist offen.

**Bestätigt (Auswahl):**
- Northflank hat keinen öffentlichen DPA, das Trust Center ist gated (Vanta).
- Supabase-DPA v1 vom 01.08.2026, Einbeziehung über ToS § 7(b), ToS-Version 4 vom 05.10.2026.
- Groq: DPA-Zitate, Daten 15.10.2025 und 22.06.2026, Groq UK Limited, ZDR, GCP-US, Unterauftragsverarbeiter.
- Cloudflare: DPA-Einbeziehung, R2-Jurisdiktion `eu`.
- GitHub: DPA nur für Enterprise, Teams und Copilot.
- Alle DPF-Einträge (IDs, Status, Daten) und das Fehlen von Groq, Supabase, Northflank, Apple und Mozilla.
- UK-Angemessenheitsbeschluss vom 19.12.2025, gültig bis 27.12.2031.
