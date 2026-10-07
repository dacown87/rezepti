# Grobplan: OAuth / Magic Link (Paket O)

> **Status: GROBPLAN — muss vor der Umsetzung ausgearbeitet werden** (Provider-Wahl, Redirects, Deep Links, Akzeptanzkriterien, Tests). Kein Code, bevor der Detailplan steht und freigegeben ist.

Stand: 2026-10-07. Bezug: [TODO.md](../../../TODO.md) → Auth Onboarding Follow-ups → *Spaeter* („OAuth / Magic Link"). Vorarbeit: [auth-onboarding-deferred-followups-plan](2026-06-07-auth-onboarding-deferred-followups-plan.md) Folge-Slice 3.

## Ziel
Zusaetzliche Anmeldewege neben E-Mail + Passwort, ohne die bestehende Login-first-Logik, Bootstrap und Account-Loeschung zu brechen.

## Grober Umfang
1. Entscheidung: Magic Link (E-Mail, kein Drittanbieter) und/oder OAuth (Google, Apple — Apple ist fuer iOS-App-Store-Pflicht relevant, sobald andere Social Logins angeboten werden).
2. Supabase-Auth-Konfiguration ueber `.github/workflows/supabase-auth-config.yml` (Provider, Redirect-Allow-List inkl. `recipedeck://`).
3. Mobile: Buttons in `mobile/app/account.tsx`, Callback-Handling Web + nativ (Deep Links), Bootstrap nach erstem Login (`/api/v1/auth/bootstrap`).
4. Account-Loeschung: Re-Authentifizierung ohne Passwort (heute Passwort-Pruefung in `mobile/components/DeleteAccountSection.tsx`).
5. Datenschutztext (neue Empfaenger: Google/Apple).

## Offene Fragen (fuer den Detailplan)
- Welche Provider? Brevo-Mailbudget bei Magic Link (300/Tag fuer alles)?
- Account-Linking bei gleicher E-Mail (Passwort-Konto + OAuth)?
- Loeschbestaetigung ohne Passwort (z. B. Re-Login oder E-Mail-Code)?

## Abhaengigkeiten
Paket R (Datenschutztext; OAuth-Konten haben keinen Signup-Schritt und muessen das Nutzungsbedingungen-Gate aus [Paket R D9](2026-10-07-paket-r-rechtstexte-detailplan.md) nutzen); nativer Build (Paket N) fuer Deep-Link-Tests.
