# Grobplan: Nativer Testbuild nach Expo SDK 57 (Paket N)

> **Status: GROBPLAN — muss vor der Umsetzung ausgearbeitet werden** (Profil, Plattform, Testliste, Akzeptanzkriterien). Nichts bauen, bevor der Detailplan steht und freigegeben ist.

Stand: 2026-10-07. Bezug: [TODO.md](../../../TODO.md) → „Vor dem oeffentlichen Start" → „Nativer Testbuild nach Expo SDK 57".

## Ziel
Nachweis, dass die App nach dem Upgrade auf Expo SDK 57 / React Native 0.86 nativ startet und die Kernpfade funktionieren. Bisher ist nur der Web-Export verifiziert.

## Grober Umfang
1. Build per EAS CLI (Cloud-Build, **nicht** lokal — der Rechner des Betreibers ist bei schweren lokalen Laeufen abgestuerzt) mit dem vorhandenen Profil `preview` (Android-APK, internal) aus `mobile/eas.json`; iOS erst, wenn Apple-Developer-Zugang geklaert ist (`submit.production.ios` enthaelt noch Platzhalter).
2. Installation auf einem echten Android-Geraet (Betreiber).
3. Smoke-Liste: Start, Login/Logout, Rezeptliste, Detail, URL-Import mit Job-Polling, Foto-Import (Kamera), QR-Scanner, Planner, Einkaufsliste, Konto loeschen-Dialog.
4. Ergebnis in TODO/`docs/TEST_STATUS.md` protokollieren.

## Offene Fragen (fuer den Detailplan)
- EAS-Account/Projekt-ID und Env (`EXPO_PUBLIC_*`) fuer den Build vorhanden?
- Android only oder auch iOS (Apple Developer Program, Kosten)?
- Push nativ: Web Push ist PWA-only — ist das fuer den Testbuild relevant?

## Abhaengigkeiten
Keine fuer den Build selbst; Paket O (Deep Links) profitiert davon.
