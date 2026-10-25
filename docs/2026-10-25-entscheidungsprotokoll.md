# Entscheidungsprotokoll 2026-10-25

Stand: 2026-10-25. Gemeinsamer Durchgang der offenen Vor-Start-Punkte zwischen Betreiber und KI.
Dieses Protokoll ergänzt die Detailpläne und `TODO.md`; bei Widerspruch gilt dieses Protokoll (Entscheidungen des Betreibers). Keine Rechtsberatung.

## 1. Freigabe-Status

| Paket | Status |
|---|---|
| **S** — SSRF-Härtung | ✅ freigegeben |
| **L** — Löschpfad-Migration | ✅ freigegeben |
| **DM** — Datenminimierung | ✅ freigegeben |
| **R** — Rechtstexte | ✅ freigegeben |
| **G** — Go-Live-Betrieb | ✅ freigegeben |
| **A** — Backups | ✅ bestätigt (wie 2026-10-07) |
| **B** — Kostenschutz | ✅ bestätigt (wie 2026-10-07) |
| **N** — Nativer Testbuild | ⏸️ geparkt („erstmal keine App“) |

## 2. Betreiber-Daten (für R/D3a und `mobile/utils/legal-operator.ts`)

- **Name/Anschrift:** Patrick Hofmann, Aschaffenburgerstr. 37, 64739 Höchst, Hessen
- **Aufsichtsbehörde:** Der Hessische Beauftragte für Datenschutz und Informationsfreiheit (HBDI), Postfach 3163, 65021 Wiesbaden, datenschutz.hessen.de
- **Kontaktadresse (R E3 = A):** `kontakt@recipedeckapp.de` über Cloudflare Email Routing an ein bestehendes Gmail-Postfach → DSE nennt Google Ireland / Google LLC (DPF). `legal-operator.ts.email` → `kontakt@recipedeckapp.de`.
- **Supabase:** Region Irland; Vertragspartner Supabase Pte. Ltd. (Singapur); TIA-Importeur Supabase Pte. Ltd.; Grundlage SCC.
- **Brevo:** Vertragspartner **Brevo Inc., 823 Congress Ave. Ste 300, Austin, TX 78701, USA** — *final über den Privacy-Policy-Link einer Brevo-Mail bestätigen (offener Follow-up)*. Speicherorte FR/BE; Drittlandübermittlung USA (DPF/SCC).
- **Cobalt:** nicht aktiv in Production → keine Aufnahme in die Dienstleisterliste.

## 3. Fristen

- Fehlerberichte (bug_reports): **12 Monate** ab Eingang (harte Obergrenze, DM-1).
- Kontakt-Mails: **6 Monate** („bis zur abschließenden Bearbeitung, max. 6 Monate“).
- Northflank-Runtime-Logs: **≈ 30 Tage** (Query-Limit 30 Tage) → **kürzer als die 35-Tage-Frist**.

## 4. Bestätigte Entscheidungen je Paket

**S (1–6):** Proxy nur für Angemeldete (`requireUserAuth`); Guard über undici-Agent mit Connect-Time-Lookup; Ziel-Ports nur 80/443; App-Guard reicht für den Start (kein Egress-Filter Pflicht); zwei PRs (S1 sofort, S2 danach); Zeitpunkt vor allen anderen Paketen.

**L (1–6):** Zwei-Spuren-Löschprotokoll (DB-Tabelle + `stdout`); `DELETION_LOG_PEPPER` als Northflank-Secret **und** offline neben dem `age`-Schlüssel; globale Import-Zähler als eigene Tabelle; Löschung auch ohne Pepper zulassen (Art. 17 geht vor); DM-Entscheidungen 1+2 vor L bestätigt (hiermit erledigt).

**DM (1, 2, 8, 9):** Fehlerberichte 12 Monate ab Eingang; Whitelist-Anonymisierung (Text bleibt); Chefkoch-Bildvorschläge direkt laden und in der DSE offenlegen; abgelaufene Einladungen mit in DM-1 (≈ 30 Tage nach Ablauf/Annahme). (3–7 entfallen durch DM-3-light.)

**R:** E1 Privatanschrift; E2 Daten geliefert; E3 = A (Cloudflare Routing → Gmail); E5 HBDI; E10 VSBG-Satz raus, „nicht kommerzielles Open-Source-Projekt“ rein, Überschrift „§ 18 MStV und § 5 DDG“; E11 Ablage Vault `Projekte/RecipeDeck/Recht/`; E12 Fristen siehe Abschnitt 3; E13 Rechtslinks im Footer + Share-Invite-Seite; E14 D3 in zwei Stufen. E15/E16 bereits erledigt/beschlossen.

**G (1–5):** Brevo-IP-Schutz Variante (b) Allowlist der beobachteten Egress-IPs; Gmail-Monitor optional; DMARC-Beobachtung 4 Wochen; Notfall-Schließung der Registrierung vorab festlegen; G1 direkt nach R-E3, parallel zu S.

**A (bestätigt):** Cloudflare R2 (EU); `age` mit Private Key nur offline; 14 täglich + 4 wöchentlich (max. 35 Tage); Umfang `public`+`private`+`auth`; Northflank-Cron-Job.

**B (bestätigt):** Tageskontingent pro Nutzer für Server-Key-Importe, BYOK ausgenommen; 15/Nutzer/Tag + globaler Notschalter 300/Tag; Zählzeitpunkt Job-Start; CAPTCHA Phase 2.

## 5. Neue offene Follow-ups aus diesem Durchgang

- [ ] **Brevo-Vertragspartner final bestätigen** (Brevo Inc. USA vs. andere) über den Privacy-Policy-Link.
- [ ] **Löschprotokoll zusätzlich nach R2 ablegen** (Paket A): Northflank-Logs (30 Tage) decken die 35-Tage-Frist nicht ab → `[account-deleted]`-Zeilen bzw. das Löschprotokoll zusätzlich außerhalb der DB und außerhalb der Runtime-Logs sichern.

## 6. Noch offene Betreiber-Aufgaben (ohne Code)

- [ ] AVV bei Northflank anfordern; DPAs von Supabase/Brevo/Groq/Cloudflare datiert ablegen (nicht im öffentlichen Repo).
- [ ] Groq Zero Data Retention einschalten (Screenshot).
- [ ] VVT-Entwurf (Art. 30) prüfen und freigeben.
- [ ] Cloudflare R2 vorbereiten (Bucket EU, Token nur für diesen Bucket); `age`-Schlüsselpaar und `DELETION_LOG_PEPPER` erzeugen und offline sichern.
- [ ] Texte (Impressum/Datenschutz/Nutzungsbedingungen) gegenlesen lassen.
- [ ] G1.2: Email Routing für `kontakt@` einrichten + SPF zu einem Record zusammenführen (E3 = A).

## 7. Offene manuelle Tests

- Account-Löschung gegen Staging inkl. Offline-Queue A→B.
- Passwort-Reset end-to-end in Production.
- Web-Push „Rezept fertig“ end-to-end.
- jsQR-Fallback in Firefox.
- Lokaler PWA-Off-/Online-Smoke gegen Staging.
- iOS Logout-/Cross-User-Privacy auf Hardware.
- Foto-Thumbnail-Bug in der Rezeptliste bestätigen/ausschließen.

## 8. Umsetzungs-Reihenfolge und Branch-Regel

**Regel:** Für jedes Arbeitspaket (PR) ein **eigener Branch**, der **immer vom aktuellen (vorherigen) Branch** abgezweigt wird — nie direkt von `main` (gestapelte Branches). Der jeweils aktuelle Branch ist die Basis des nächsten.

Reihenfolge (Vorschlag):

1. `paket/s1-ssrf-proxy-guard` — Proxy hinter Login + `ip-guard`/`safe-fetch`
2. `paket/s2-ssrf-import` — Classifier-Hostverankerung + Import-Validierung + Fetcher
3. `paket/l-loeschpfad-migration` — Bündel-Migration + Schema + Smoke
4. `paket/dm1-bug-report-anonymisierung` — DM-1 + DM-1b
5. `paket/b-kostenschutz` — Import-Kontingent
6. `paket/a-backups` — Backup-Job/R2/Runbook (+ Löschprotokoll nach R2)
7. `paket/dm2-exif` — `sharp`, EXIF/GPS entfernen
8. `paket/dm3-light-fremdbilder` — DSE-Satz + Thumbnail-Bug + `PATCH imageUrl`
9. `paket/r-d3a-rechtstexte` — Impressum/Datenschutz
10. `paket/r-d9-light-nutzungsbedingungen` — statische Nutzungsbedingungen
11. `paket/r-d3b-text-nachzug` — Text-Nachzug nach A/DM/D1/D5

N ist geparkt. G1/G2 sind überwiegend Betreiber-Schritte mit wenig Code.
