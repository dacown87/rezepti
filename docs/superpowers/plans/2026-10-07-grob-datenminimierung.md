# Grobplan: Datenminimierung (Paket DM)

> **Status: GROBPLAN — ausgearbeitet im [Detailplan Paket DM](2026-10-07-paket-dm-datenminimierung-detailplan.md) (wartet auf Freigabe).** Kein Code, bevor der Detailplan freigegeben ist.

Stand: 2026-10-07. Bezug: [TODO.md](../../../TODO.md) → „Vor dem oeffentlichen Start"; [Vor-Start-Plan](2026-10-07-vor-start-backups-kostenschutz-recht-plan.md) Abschnitt D (D6, D7, D8). Befunde: [Rechtsrecherche](../../legal/2026-10-impressum-datenschutz-recherche.md) Abschnitte 6, 7, 9.6 und [Faktencheck](../../legal/faktencheck/verify-3-dsgvo.md).

## Ziel
Weniger personenbezogene Daten verarbeiten und weitergeben, damit die Datenschutzerklaerung einfacher und belastbarer wird.

## Grober Umfang (drei Teilpakete, evtl. drei PRs)
1. **D6 EXIF entfernen** — Foto-Uploads (`POST /api/v1/extract/photo`, `src/routes/extraction.ts`) serverseitig von EXIF/GPS befreien, bevor sie an Groq gehen oder als Rezeptbild gespeichert werden. Web/PWA behaelt EXIF heute sicher.
2. **D7 Fremdbilder — entschieden 2026-10-09: offenlegen statt proxyen/speichern (DM-3-light).** Urspruengliche Optionen: Rezeptbilder werden im Browser direkt von Fremdservern geladen (`src/db-react.ts` liefert Fremd-URLs unveraendert). Optionen: beim Import herunterladen und selbst ausliefern (passt zur 250-KB-Regel) oder ueber den bestehenden Proxy (`/api/v1/proxy/image`) laden. Bestandsrezepte migrieren.
3. **D8 Fehlerberichte anonymisieren** — bei Kontoloeschung auch `metadata_json` (`activeHouseholdId`, `userAgent`, `lastFailureSnapshot` mit `submittedUrl`/`errorMessage`/`jobId`) und Spalte `route` bereinigen (heute nur `user_id`/`household_id` auf NULL, Migration `20261007120000`); feste Loeschfrist fuer Fehlerberichte (Frist legt der Betreiber fest).

## Offene Fragen (fuer den Detailplan)
- Bildspeicher: DB, Supabase Storage (Free-Limits!) oder R2? Kosten/Groesse der Bestandsmigration?
- Proxy statt Speicherung: Last auf Northflank, Caching, SSRF-Guard reicht?
- EXIF-Bibliothek (z. B. `sharp`) — Image-Groesse im Docker-Build.
- Loeschfrist Fehlerberichte (z. B. 12 Monate) und Umsetzung per Cleanup-Job.

## Abhaengigkeiten
Account-Deletion-Smoke (`COVERED_USER_COLUMNS`) bei Schemaaenderungen; Ergebnis fliesst in Paket R (Datenschutztext).
