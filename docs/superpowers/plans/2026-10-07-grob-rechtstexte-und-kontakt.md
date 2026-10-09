# Grobplan: Rechtstexte und Kontakt (Paket R)

> **Status: GROBPLAN — ausgearbeitet im [Detailplan Paket R](2026-10-07-paket-r-rechtstexte-detailplan.md) (wartet auf Freigabe).** Kein Code, bevor der Detailplan freigegeben ist.

Stand: 2026-10-07. Bezug: [TODO.md](../../../TODO.md) → „Vor dem oeffentlichen Start" → Betreiber-Schritte aus der Rechtsrecherche; [Vor-Start-Plan](2026-10-07-vor-start-backups-kostenschutz-recht-plan.md) Abschnitt D (D2, D3, D4, D9). Fachliche Grundlage: [Rechtsrecherche](../../legal/2026-10-impressum-datenschutz-recherche.md) (keine Rechtsberatung).

## Ziel
Impressum, Datenschutzerklaerung und Nutzungsbedingungen sind vollstaendig und korrekt, ein zweiter Kontaktweg existiert, und ein internes Verzeichnis der Verarbeitungstaetigkeiten liegt vor — Voraussetzung fuer die offene Registrierung.

## Grober Umfang
1. **D2 Verzeichnis von Verarbeitungstaetigkeiten (Art. 30)** — internes Dokument, **nicht** im oeffentlichen Repo; Entwurf aus Recherche Abschnitt 2/10, Betreiber prueft.
2. **D4 Kontakt** — nur Kontaktadresse auf eigener Domain (z. B. `kontakt@recipedeckapp.de`, Cloudflare Email Routing o. ae.). **Zweiter Kontaktweg/Formular entfaellt (2026-10-09).**
3. **D3 Text-PR** — `mobile/utils/legal-operator.ts` (Daten vom Betreiber), `mobile/app/impressum.tsx`, `mobile/app/datenschutz.tsx` gemaess Recherche Abschnitt 11; Platzierung der Links nicht nur unter Einstellungen.
4. **D9-light Nutzungsbedingungen** — kurze statische Seite (Mindestalter 16, unentgeltlich ohne Verfuegbarkeitszusage, Haftung § 309 Nr. 7 BGB, Inhalte/Urheberrecht, Meldeweg), nur Hinweis mit Link im Signup, **kein Zustimmungs-Gate, keine Migration** (2026-10-09).
6. **Lizenz** — AGPL-3.0, siehe Detailplan Abschnitt 8. **Monetarisierungs-Grenze** als feste Regel, siehe Detailplan Abschnitt 0a.
5. Gegenlesen durch Dritte (Betreiber).

## Offene Fragen (fuer den Detailplan)
- Wo liegt das VVT (Vault, privates Repo)?
- Reihenfolge: haengt an den Betreiber-Daten (Anschrift, Bundesland, Region Northflank, Brevo-Vertragspartner).

## Abhaengigkeiten
Betreiber-Schritte in der TODO (AVV Northflank, DPAs, `legal-operator.ts`-Daten); Backup-Frist aus Paket A; Datenminimierung (Paket DM) fuer die finale Formulierung.
