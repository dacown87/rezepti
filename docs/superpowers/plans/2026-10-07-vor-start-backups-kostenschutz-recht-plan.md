# Plan: Backups, Kostenschutz, Recht (vor oeffentlicher Registrierung)

Stand: 2026-10-07. Bezug: `TODO.md` → „Vor dem oeffentlichen Start". Rahmen: Supabase bleibt **Free** (keine Projekt-Backups, keine PITR), Repo ist **oeffentlich**.

> **Aenderungen 2026-10-09 (Betreiber):** Projekt ist unentgeltlich, werbefrei, Open Source (AGPL-3.0). Dadurch: **D4b (Kontaktformular) entfaellt, D9 nur noch als statische Seite ohne Zustimmungs-Gate (D9-light), D7 nur noch als Offenlegung (DM-3-light)**; Details in den Paket-Plaenen R und DM. **A bleibt schlank** (siehe dort). Feste Regel: keine Monetarisierung (Werbung, Bezahl-Tier, Spenden mit Gegenleistung), sonst Wiedervorlage der gestrichenen Teile.

Drei unabhaengige Pakete, je ein PR. Reihenfolge: **A Backups → B Kostenschutz → C Recht**. C (Recherche) ist **erledigt**; die Ergebnisse sind in A eingearbeitet und haben die Folgepakete in **D** ergeben.

---

## A — Backups (pg_dump + Restore-Test)

**Ziel:** Taeglich ein verschluesseltes, logisches Backup der Production-DB ausserhalb von Supabase, mit dokumentiertem und einmal getestetem Restore.

**Warum nicht GitHub-Artifacts im Klartext:** Das Repo ist oeffentlich; Artifacts sind fuer jeden GitHub-Account herunterladbar. Der Dump enthaelt personenbezogene Daten. → Verschluesselung ist Pflicht, unabhaengig vom Ablageort.

### Entscheidungen (Betreiber)
| Frage | Empfehlung | Alternative |
|---|---|---|
| Ablageort | **Cloudflare R2** (Free: 10 GB, Account existiert schon, EU-Jurisdiktion waehlbar) | GitHub-Artifact (verschluesselt, max. 90 Tage, oeffentlich abrufbar) |
| Verschluesselung | **`age`** mit Public Key im Workflow, Private Key nur offline beim Betreiber | `gpg --symmetric` mit Passphrase-Secret |
| Aufbewahrung | **14 taegliche + 4 woechentliche → Hoechstfrist 35 Tage** (so auch in der Datenschutzerklaerung, nicht „ca. 30") | — |
| Umfang | Schemas `public`, `private`, `auth` (Nutzerkonten!) | nur `public` (Restore dann ohne Logins) |
| **Ausfuehrungsort (entschieden: Northflank)** | **Northflank-Cron-Job** (wie `gmail-brevo-probe`) — Daten bleiben bei einem bestehenden Auftragsverarbeiter | GitHub-Actions-Runner (USA, fuer Free-Accounts **kein DPA**; dann in der Datenschutzerklaerung nennen) |

Aufbewahrung ist auch eine **DSGVO-Frage**: geloeschte Konten (Art. 17) leben bis zum Ablauf im Backup weiter. Laut Recherche (C, Abschnitt 5) gibt es keine Hoechstfrist, verlangt werden aber eine **feste Frist** und ein **Loesch-Nachlauf nach jedem Restore**.

**Hinweis Ausfuehrungsort:** Die Recherche empfiehlt Northflank statt GitHub. Northflank hat aber selbst noch keinen AVV (siehe C) — der muss ohnehin beschafft werden. Bei Northflank wird Schritt 1 unten ein Cron-Job mit kleinem eigenen Image (`postgres:<major>`-Client + `age` + S3-Client) statt eines Workflows; Secrets dann als Northflank-Job-Variablen (Achtung: Env-Update ersetzt die komplette Environment, siehe Runbook).

**Schlank-Prinzip (2026-10-09):** nur das Noetige. Ein Job, ein Ziel (R2), eine Rotation (14 taeglich + 4 woechentlich, Hoechstfrist 35 Tage, genau so in der Datenschutzerklaerung), ein einmaliger realer Restore-Test. Keine eigene Loesch-Logik fuer Backups (R2-Lifecycle), kein zweites Backup-Ziel, keine Monitoring-Infrastruktur ueber den roten Cron-Lauf hinaus. Die read-only Rolle ist **optional** (Verbesserung, kein Muss). Der Loesch-Nachlauf nach Restore bleibt, weil die Recherche (EDPB-CEF-Bericht 2025) ihn verlangt; er ist ein Protokoll plus ein Runbook-Schritt, kein Dienst.

### Umsetzung
1. **Workflow `.github/workflows/db-backup.yml`** — `schedule` taeglich ~03:30 UTC + `workflow_dispatch`, `permissions: {}`.
   - `pg_dump` in der Major-Version des Supabase-Postgres (vorher `select version()` pruefen; Postgres-Client aus dem offiziellen apt-Repo bzw. `postgres:<major>`-Container).
   - Verbindung ueber den **Session-Pooler** (IPv4; GitHub-Runner haben kein IPv6 zur Direct-Connection). Neues Secret `BACKUP_DATABASE_URL`, idealerweise mit einer eigenen **read-only Rolle** statt `postgres`.
   - `pg_dump --format=custom --no-owner --no-privileges -n public -n private -n auth | age -r "$AGE_RECIPIENT" > rezepti-<datum>.dump.age`
   - Upload nach R2 per `aws s3 cp --endpoint-url` (S3-kompatibel); Secrets `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_BUCKET`.
   - Plausibilitaetscheck: Dump-Groesse > Mindestwert, sonst Lauf rot.
2. **Rotation** per R2-Lifecycle-Regel (Objekte unter `daily/` nach 14 Tagen loeschen, `weekly/` nach 35 Tagen) statt eigener Loesch-Logik.
3. **Restore-Runbook `docs/db-backup-restore-runbook.md`:** Download, `age -d -i key.txt`, `pg_restore --clean --if-exists` gegen **Staging** (nie direkt Production), danach Smoke (`/api/v1/health`, Login mit Testkonto, Rezeptanzahl).
   - **Korrektur 2026-10-09 (siehe [Paket L](2026-10-09-paket-l-loeschpfad-migration-detailplan.md), Abschnitt 0):** Ein Protokoll nur in der DB geht beim Restore mit verloren. Deshalb zusaetzlich eine `stdout`-Zeile `[account-deleted] hash=… at=…` (Northflank-Logs) und HMAC-Hash mit offline gesichertem Pepper.
   - **Loesch-Nachlauf:** Nach einem Restore muessen Konten, die nach dem Backup-Zeitpunkt geloescht wurden, erneut geloescht werden. Dafuer ein Protokoll geloeschter User-IDs (nur gehashte ID + Zeitpunkt, im `private`-Schema, 35 Tage) in `private.delete_user_account` mitschreiben und im Runbook einen Schritt „Loeschungen seit Backup-Zeitpunkt nachziehen" aufnehmen. Neue Tabelle → Account-Deletion-Smoke beachten. **Schema-Teil gebuendelt in [Paket L](2026-10-09-paket-l-loeschpfad-migration-detailplan.md).**
4. **Restore-Test einmal real gegen `rezepti-staging`** durchspielen und im Runbook mit Datum protokollieren. Staging darf dabei ueberschrieben werden (Betreiber, 2026-10-07).
5. `TODO.md` + `CLAUDE.md` (Production-Abschnitt) nachziehen.

**Akzeptanz:** ein gruener Dispatch-Lauf, Datei in R2, Restore auf Staging erfolgreich, Runbook mit Testprotokoll.

**Risiken:** `auth`-Schema-Restore kann an Supabase-eigenen Rollen/Grants scheitern → Restore-Test zeigt das; notfalls `auth.users` getrennt per `COPY` sichern. Free-Plan-Pooler-Limits sind fuer einen naechtlichen Dump unkritisch.

---

## B — Kostenschutz fuer Importe auf dem Server-Key

**Ist-Zustand:** Importe ohne BYOK laufen auf `GROQ_API_KEY`. Es gibt nur Concurrency-Limits (6 global / 3 pro Nutzer, `src/routes/extraction.ts:49`) und ein IP-Limit fuer Facebook. Kein Tages- oder Nutzerkontingent, kein Signup-Schutz. Ein einzelnes Konto kann den Server-Key also rund um die Uhr auslasten; bei Groq-Free-Tier heisst das: Rate-Limit fuer **alle** Nutzer.

### Entscheidungen (Betreiber)
| Frage | Empfehlung |
|---|---|
| Modell | **Tageskontingent pro Nutzer fuer Server-Key-Importe**, BYOK ausgenommen. Keine BYOK-Pflicht (zu hohe Einstiegshuerde). |
| Hoehe | **15 Importe/Tag pro Nutzer** (`IMPORT_DAILY_LIMIT_PER_USER`), dazu **globaler Notschalter** `IMPORT_DAILY_LIMIT_SERVER` (z. B. 300/Tag) |
| Zaehlzeitpunkt | beim **Job-Start** (Kosten entstehen auch bei Fehlschlag); Rueckgabe nur, wenn der Job vor dem ersten LLM-Aufruf scheitert |
| CAPTCHA beim Signup | **Phase 2, erst bei Missbrauch.** Supabase Auth + Cloudflare Turnstile ist moeglich, braucht aber ein Widget in Web *und* nativ |

### Umsetzung
1. **Migration** `import_quota_usage(user_id uuid, day date, count int, primary key(user_id, day))`, RLS an, keine Policies (Backend-only, wie `bug_report_submission_rate_limits`). Global-Zaehler als Zeile mit fester Sentinel-ID oder eigene Tabelle.
   - **Pflicht laut CLAUDE.md:** neue User-ID-Spalte in `private.delete_user_account` **und** in `COVERED_USER_COLUMNS` (`scripts/supabase/account-deletion-smoke.ts`) aufnehmen, sonst CI rot. Eintrag in der RLS-no-policy-Klassifizierung ergaenzen. **Migration und Loeschfunktion gebuendelt in [Paket L](2026-10-07-grob-loeschpfad-migration.md);** dieser PR bringt dann nur noch Schritte 2–7.
2. **`src/db-react.ts`:** `consumeImportQuota(userId, { perUser, global })` als atomares `INSERT … ON CONFLICT DO UPDATE SET count = count + 1 … RETURNING count` mit Bedingung, damit parallele Requests das Limit nicht ueberholen. Muster: bestehender Bug-Report-Rate-Limiter (`db-react.ts:2184`). Alte Tage beim Cleanup-Timer mit loeschen.
3. **`src/config.ts`:** zwei neue Knobs mit Defaults; `0` = aus.
4. **`src/routes/extraction.ts`:** in allen drei POST-Einstiegen **nach** BYOK-Erkennung und Concurrency-Check: nur wenn kein BYOK-Key → Kontingent pruefen. Antwort `429` mit `scope: "daily_user"` bzw. `"daily_server"`, `limit`, `resetAt` und deutscher Meldung inkl. Hinweis auf eigenen Groq-Key. Beim Photo-Import vor dem Einlesen des Uploads (wie der Concurrency-Check).
5. **Mobile:** `extract.tsx` zeigt den neuen `429`-Fall mit CTA „Eigenen Groq-Schluessel hinterlegen" → Settings. Optional: Restkontingent in `/auth/me` oder `/extract/jobs` mitliefern.
6. **Tests:** Unit fuer `consumeImportQuota` (Grenze, Parallelitaet, Tageswechsel), Route-Tests fuer alle drei Endpunkte inkl. BYOK-Ausnahme, Mobile-Test fuer die Meldung. RLS-Smoke + Account-Deletion-Smoke gruen.
7. Doku: CLAUDE.md (Endpoint-Tabelle, Route-Auth-Inventory, Configuration), TODO.

**Akzeptanz:** 16. Server-Key-Import am Tag → `429 daily_user`; BYOK-Import danach geht durch; Konto-Loeschung hinterlaesst keine Quota-Zeilen.

**Bewusst nicht drin:** Job-Persistenz, IP-basierte Limits, CAPTCHA (Phase 2).

---

## C — Recherche Impressum & Datenschutz (kein Code)

**Ziel:** Faktengrundlage, damit der Betreiber `mobile/utils/legal-operator.ts` fuellen und `/impressum` + `/datenschutz` final machen kann. **Keine Rechtsberatung** — Ergebnis ist eine Quellen-Sammlung mit offenen Fragen; bei Unsicherheit Anwalt/Verbraucherzentrale bzw. Generator (z. B. eRecht24) gegenpruefen.

### Fragen (aus `TODO.md`, ergaenzt)
1. **Impressumspflicht:** § 5 DDG bei unentgeltlichem Open-Source-Angebot ohne Gewinnabsicht — greift er, oder nur § 18 Abs. 1 MStV? Ist eine ladungsfaehige Privatanschrift noetig, oder sind c/o- bzw. Impressums-Services zulaessig?
2. **DSGVO-Grundlagen:** Pflichtangaben nach Art. 13; ist ein Verzeichnis nach Art. 30 noetig (Ausnahme Abs. 5 greift bei regelmaessiger Verarbeitung meist nicht)?
3. **Auftragsverarbeitung:** AVV/DPA-Status je Dienstleister — Supabase, Northflank, Brevo, Groq, Cloudflare (DNS, kuenftig R2), GitHub (Backups/Logs). Die Datenschutzerklaerung behauptet einen AVV mit Supabase und Brevo → **nachweisen**, wo er liegt.
4. **Drittland Groq (USA):** EU-US Data Privacy Framework-Zertifizierung pruefen, sonst SCC.
5. **Loeschung vs. Backups:** zulaessige Aufbewahrungsfrist geloeschter Konten in Backups und Formulierung in der Datenschutzerklaerung (Input fuer A).
6. **Selbstloeschung nach Art. 17** — ist mit PR #74 umgesetzt; pruefen, ob die Erklaerung das korrekt beschreibt.
7. **Aufsichtsbehoerde** nach Wohnsitz des Betreibers.

### Vorgehen
1. Quellen: Gesetzestexte (gesetze-im-internet.de, DSGVO-Text), Behoerden-FAQ (BfDI, Landesbehoerde), DPF-Liste (dataprivacyframework.gov), DPA-Seiten der Anbieter.
2. Ergebnis als `docs/legal/2026-10-impressum-datenschutz-recherche.md`: je Frage Antwort, Quelle mit Datum, Sicherheit (klar / auslegungsbeduerftig), konkreter Handlungsbedarf.
3. Abgleich mit `mobile/app/datenschutz.tsx` und `impressum.tsx` → Liste der noetigen Textaenderungen.
4. Betreiber fuellt `legal-operator.ts`; danach Text-PR, `LEGAL_PLACEHOLDERS_OPEN` wird automatisch `false`.

**Akzeptanz:** Recherche-Dokument mit Quellen, AVV-Nachweise abgelegt oder als offen markiert, Platzhalter gefuellt (Betreiber).

### Ergebnis der Recherche (2026-10-07)
Vollstaendig mit Quellen und Sicherheitsgrad je Aussage, **in drei unabhaengigen Durchgaengen gegen live abgerufene Primaerquellen faktengeprueft** (31 Aussagen korrigiert, 10 als nicht verifiziert markiert; Protokolle unter `docs/legal/faktencheck/`): [docs/legal/2026-10-impressum-datenschutz-recherche.md](../../legal/2026-10-impressum-datenschutz-recherche.md). **Keine Rechtsberatung** — vor dem Start den fertigen Text gegenlesen lassen.

| Thema | Befund | Sicherheit |
|---|---|---|
| Impressum | § 18 Abs. 1 MStV gilt sicher → **Name + ladungsfaehige Anschrift** noetig. Ob zusaetzlich § 5 DDG greift (unentgeltlich, privat), ist offen. Reiner Postweiterleitungsdienst ist fuer natuerliche Personen **keine** ladungsfaehige Anschrift (BGH V ZR 210/22) → c/o nur mit schriftlicher Zustellvollmacht (§ 171 ZPO), sonst Privatanschrift. Verstoss gegen § 18 MStV ist bussgeldbewehrt (§ 115 MStV, bis 50.000 €). Vorsorglich E-Mail **plus** zweiter Kontaktweg (Formular ohne Login oder Telefon). OS-Plattform-Link entfaellt (abgeschaltet 20.07.2025). | klar / umstritten |
| Northflank | **Kein oeffentlicher AVV**, ToS ohne Art.-28-Regelung → aktiv anfordern (`legal@northflank.com` / trust.northflank.com). UK: Angemessenheitsbeschluss bis 27.12.2031. | klar |
| Supabase, Brevo, Groq, Cloudflare | DPA automatisch ueber AGB → Fassung mit Datum als PDF archivieren (Supabase: DPA + TIA aus dem Dashboard). Supabase-Vertragspartner ist **Supabase Pte. Ltd. (Singapur)**, nicht „Supabase Inc."; die SCC gelten schon fuer diese Uebermittlung (Singapur ohne Angemessenheitsbeschluss). Brevo: Vertragspartner evtl. Brevo GmbH (Berlin) — im Konto pruefen | klar |
| Groq | **Nicht DPF-zertifiziert** (DPF-Liste am 07.10.2026 abgefragt). Vertragspartner Groq UK Ltd., Verarbeitung USA, Grundlage **SCC** im DPA. Standardmaessig keine Speicherung, bis 30 Tage nur bei Fehleranalyse/Missbrauchsverdacht; Zero Data Retention in der Groq-Console schaltet auch das ab. | klar |
| DPF allgemein | gilt weiter, Risiko gestiegen (Rechtsmittel C-703/25 P anhaengig, EDPB-Pruefbitte 31.07.2026). Fuer RecipeDeck unkritisch, SCC als Rueckfallebene. | beobachten |
| Backups | keine Hoechstfrist vorgegeben, aber feste Frist + Loesch-Nachlauf nach Restore → in A eingearbeitet (35 Tage). | h. M. |
| Cookies/Speicher | **Kein Consent-Banner noetig** (Session, Offline-Cache, SW, IndexedDB = unbedingt erforderlich, § 25 Abs. 2 Nr. 2 TDDDG). Aber: Rezeptbilder werden direkt von Fremdservern geladen → IP geht an Dritte. | h. M. |
| Pflichten | Verzeichnis nach Art. 30 **noetig** (intern). Kein DSB, voraussichtlich keine DSFA. | h. M. |
| Sonstiges | BFSG nicht anwendbar. DSA umstritten → Meldeweg fuer rechtswidrige Inhalte billig. Nutzungsbedingungen empfohlen (Mindestalter 16, Haftungsbegrenzung). | umstritten |

Konkrete Textaenderungen mit Zeilenbezug fuer `legal-operator.ts`, `impressum.tsx`, `datenschutz.tsx`: Recherche-Dokument Abschnitt 11. Nebenbefund: `CLAUDE.md` nennt eine Unsplash-Bildsuche, der Code fragt die Chefkoch-API ab — CLAUDE.md korrigieren.

---

## D — Folgepakete aus der Recherche (neu)

Nicht Teil der urspruenglichen drei Punkte, aber vor der oeffentlichen Registrierung noetig oder dringend empfohlen. Je ein eigener PR bzw. Betreiber-Schritt. Gebuendelt in [Paket R – Rechtstexte und Kontakt](2026-10-07-grob-rechtstexte-und-kontakt.md) (D2, D3, D4, D9; [Detailplan](2026-10-07-paket-r-rechtstexte-detailplan.md)) und [Paket DM – Datenminimierung](2026-10-07-grob-datenminimierung.md) (D6, D7, D8; [Detailplan](2026-10-07-paket-dm-datenminimierung-detailplan.md)).

| # | Paket | Wer | Prioritaet |
|---|---|---|---|
| D1 | **AVV Northflank anfordern**, alle uebrigen DPAs als PDF ablegen (ausserhalb des oeffentlichen Repos) | Betreiber | P1 |
| D2 | **Verzeichnis von Verarbeitungstaetigkeiten** (Art. 30) als internes Dokument — Claude kann eine Vorlage aus der Recherche erstellen | Claude + Betreiber | P1 |
| D3 | **Text-PR Impressum/Datenschutz** nach Abschnitt 11 der Recherche (nachdem der Betreiber `legal-operator.ts` gefuellt hat); inkl. Backups 35 Tage, Groq-SCC, Supabase Pte. Ltd., Art. 21 separat, Aufsichtsbehoerde | Claude, Daten vom Betreiber | P1 |
| D4 | **Kontaktadresse** `kontakt@recipedeckapp.de` statt Gmail (Cloudflare-Mail-Routing). **Zweiter Kontaktweg/Formular entfaellt (2026-10-09)** | Betreiber | P2 |
| D5 | **Groq Zero Data Retention** in der Console einschalten | Betreiber | P2 |
| D6 | **EXIF-Daten** aus Foto-Uploads serverseitig entfernen, bevor sie an Groq gehen und gespeichert werden (Web/PWA behaelt EXIF sicher, nativ nur zufaellig nicht) | Claude | P2 |
| D7 | **Fremdbilder: in der Erklaerung offenlegen (entschieden 2026-10-09)**; kein Speichern, kein Proxy (Vollvariante im Archiv des DM-Plans) | Claude (Text) | P2 |
| D8 | **Bug-Reports nach Kontoloeschung vollstaendig anonymisieren** (`metadata_json`: `activeHouseholdId`, `userAgent`, `lastFailureSnapshot` mit `submittedUrl`/`errorMessage`/`jobId`; Spalte `route`) + feste Loeschfrist | Claude | P2 |
| D9 | **Nutzungsbedingungen als kurze statische Seite** (Mindestalter 16, unentgeltlich ohne Verfuegbarkeitszusage, Haftung § 309 Nr. 7 BGB, Inhalte/Urheberrecht, Meldeweg), **ohne Zustimmungs-Gate** (2026-10-09) | Claude-Entwurf, Betreiber prueft | P3 |

---

## Entscheidungen (Betreiber, 2026-10-07)
1. **A:** angenommen — Cloudflare R2, `age`, 14 taegliche + 4 woechentliche (Hoechstfrist 35 Tage), `public` + `private` + `auth` sichern, Staging darf fuer den Restore-Test ueberschrieben werden. Ausfuehrungsort: **Northflank-Cron-Job** (Betreiber, 2026-10-07, wie empfohlen) — Schritt 1 wird damit ein Cron-Job statt eines GitHub-Workflows.
2. **B:** angenommen — 15 Server-Key-Importe pro Nutzer/Tag, 300/Tag global, BYOK ausgenommen; CAPTCHA erst Phase 2.
3. **C:** angenommen — gruendliche Recherche durch Claude als Teil der Planung, Platzhalter fuellt der Betreiber.

Status: **nur Plan, noch keine Umsetzung.** Umsetzung erst auf ausdrueckliche Freigabe.
