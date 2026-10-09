# Detailplan: Nativer Testbuild nach Expo SDK 57 (Paket N)

> **Status: Detailplan — wartet auf Freigabe.** Es wird nichts gebaut, bevor der Betreiber die Entscheidungen am Ende bestätigt hat. Builds laufen **in der EAS-Cloud, nie lokal** (schwere lokale Läufe haben den Rechner des Betreibers zum Absturz gebracht).

Stand: 2026-10-09. Grobplan: [2026-10-07-grob-nativer-testbuild.md](2026-10-07-grob-nativer-testbuild.md). Bezug: [TODO.md](../../../TODO.md) („Nativer Testbuild nach Expo SDK 57“), [Test-Session](../../testing/manuelle-test-session.md) Block 3.

**Ziel:** Nachweis, dass die App nach dem Upgrade auf Expo SDK 57 / React Native 0.86 nativ (Android) startet und die Kernpfade funktionieren. Bisher ist nur der Web-Export verifiziert. **Kein Store-Release**, kein iOS-Build im Testumfang.

---

## 1. Ist-Zustand (geprüft 2026-10-09)

| Befund | Quelle | Folge |
|---|---|---|
| EAS ist eingerichtet: `projectId` `19e500e1-…`, `owner` `dacowns-organization`, eingeloggt als `dacown` (Role Owner in beiden Accounts) | `mobile/app.json`, `eas whoami` | Cloud-Build ohne Zusatzschritt möglich |
| Profil `preview` (APK, internal) existiert, **ohne `env`-Block** | `mobile/eas.json` | siehe nächste Zeile |
| **Die EAS-Umgebung `preview` enthält keine Variablen** (`eas env:list --environment preview` → „No variables found“) | EAS-CLI | Ein Build ohne `EXPO_PUBLIC_SUPABASE_URL` und `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` startet, aber **Login scheitert** (`mobile/utils/auth.ts:9-11`). Das wäre ein Fehlschlag aus Konfigurationsgründen, kein Befund zu SDK 57. **Variablen vorher setzen** |
| Der native Client nutzt `PRODUCTION_URL = https://www.recipedeckapp.de` als Server, solange kein anderer Wert gespeichert ist | `mobile/utils/server-url.ts` | Der Testbuild arbeitet gegen **Production** (mit Testkonto) oder gegen Staging, wenn die Server-URL im Gerät gesetzt wird (Entscheidung 2) |
| `submit.production.ios` enthält Platzhalter (`APPLE_ID_PLACEHOLDER`, `APP_STORE_CONNECT_APP_ID_PLACEHOLDER`) | `mobile/eas.json` | iOS und Store-Submit sind **nicht** Teil dieses Pakets |
| Android-Berechtigungen: `CAMERA`, `RECORD_AUDIO`; Plugin `expo-sqlite` (laut CLAUDE.md nie importiert) | `mobile/app.json` | `RECORD_AUDIO` und `expo-sqlite` auf Nutzen prüfen (Folgenotiz, nicht blockierend) |
| Auth-Speicher: `authStorage` (Supabase-Session) | `mobile/utils/auth-storage.ts` | Smoke: Sitzung übersteht App-Neustart |
| Web-Push ist PWA-only; nativ gibt es keinen Push | CLAUDE.md | Push gehört **nicht** in die Smoke-Liste |
| Die Standard-Supabase-Anmeldung (Passwort) braucht keinen Deep Link; **Passwort-Reset und E-Mail-Bestätigung** führen auf die Web-URL | `supabase-auth-config.yml` | Deep-Link-Tests gehören zu Paket O (OAuth/Magic Link), nicht hierher |

---

## 2. Schritte

### N1 — Vorbereitung (Betreiber + Claude, ca. 30 min)
1. **EAS-Variablen anlegen** (Umgebung `preview`, Sichtbarkeit `plaintext`/`sensitive` je Variable; `EXPO_PUBLIC_*` landet ohnehin im Client-Bundle und ist **kein Geheimnis**): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (die Werte stehen im Repo-`.env`/Northflank-Build-Args; **nicht** in Chat oder Repo kopieren), `EXPO_PUBLIC_LOGIN_FIRST_ACCOUNT_GATE` (wie Production), `EXPO_PUBLIC_VAPID_PUBLIC_KEY` nicht nötig. Befehl: `npx eas-cli env:create --environment preview --name … --value … --visibility plaintext` (einzeln, Wert nur im Terminal des Betreibers).
2. In `mobile/eas.json` beim Profil `preview` `"environment": "preview"` setzen, damit die EAS-Variablen verwendet werden. Einzige Codeänderung des Pakets (ein kleiner PR, nicht mit anderen Änderungen mischen).
3. **Vorabprüfung ohne Build:** `cd mobile && npx expo-doctor` (21/21 erwartet) und `npx eas-cli build:inspect`/`eas config --platform android --profile preview`, um die aufgelösten Werte zu sehen.
4. **Testkonto** in Production anlegen (z. B. `recipedeckapp+native@gmail.com`), Passwort im Passwortmanager; ein Rezept anlegen, damit Liste/Detail testbar sind.

### N2 — Build (EAS-Cloud, Betreiber stößt an)
- `cd mobile && npx eas-cli build --platform android --profile preview --non-interactive` (Cloud; ein Lauf, nicht parallel wiederholen).
- Erwartung: Build-Dauer 10–20 min (Free-Tier-Queue kann länger dauern). Ergebnis: APK-Link und QR im EAS-Dashboard.
- **Abbruch-/Fehlerbilder:** (a) Gradle/Hermes-Fehler → Log im Dashboard sichern, nicht lokal reproduzieren; (b) `expo-sqlite`-Plugin-Fehler → Plugin entfernen (nie importiert) als eigener Mini-PR; (c) Signing: `preview` nutzt einen von EAS verwalteten Debug-Keystore, keine Eingabe nötig.

### N3 — Installation und Smoke (Betreiber, Android-Gerät, ca. 30 min)
APK vom Link laden und installieren (Installation aus unbekannter Quelle erlauben). **Smoke-Liste** (jede Zeile: Ergebnis ✅/❌ + Notiz):

| # | Test | Erwartung |
|---|---|---|
| 1 | App startet, kein roter Fehlerbildschirm, Splash → Login | Login-Screen erscheint (Login-first) |
| 2 | Login mit Testkonto | Rezeptliste lädt |
| 3 | App komplett schließen, neu öffnen | Sitzung bleibt bestehen (kein erneuter Login) |
| 4 | Rezeptdetail öffnen, Portionen skalieren, Kochmodus | Anzeige korrekt, Bildschirm bleibt wach |
| 5 | **URL-Import** (ein Chefkoch-Rezept) mit Job-Polling | Job läuft durch, Rezept erscheint |
| 6 | **Foto-Import** (Kamera, dann Galerie) | Berechtigungsdialog, Rezept entsteht; Foto > 4 MB testen (Bezug DM-2) |
| 7 | **QR-Scanner** (Kamera, Barcode lesen und QR erzeugen) | Code wird erkannt |
| 8 | Planner und Einkaufsliste (anlegen, abhaken) | Änderungen bleiben nach Neustart |
| 9 | Offline: Flugmodus, Liste ansehen | Cache-Anzeige bzw. verständlicher Offline-Hinweis; Rezept anlegen im Flugmodus schlägt kontrolliert fehl oder wird eingereiht (Verhalten **notieren**, nativ gibt es keinen Service Worker) |
| 10 | Einstellungen: BYOK-Key speichern, Account & Workspace, **Konto-löschen-Dialog nur öffnen und abbrechen** | Dialoge funktionieren, nichts wird gelöscht |
| 11 | PDF-Export/Teilen eines Rezepts | Share-Sheet öffnet; Bild im PDF vorhanden (Bezug SSRF-Plan S: Proxy nur mit Login) |
| 12 | Bug-Report absenden (Modal) | Erfolgsmeldung |
| 13 | Rechtsseiten: Impressum, Datenschutz erreichbar | Seiten laden (nativ) |

### N4 — Auswertung und Doku
- Ergebnis als Tabelle in [docs/TEST_STATUS.md](../../TEST_STATUS.md) (Abschnitt „Nativer Testbuild 2026-10-xx“) und in der Test-Session abhaken; Haken im TODO.
- Jeder Fehlschlag wird ein eigener, kleiner TODO-Eintrag mit Plattform, Gerät, Android-Version, Reproduktion. **Kein Fix im selben PR** wie die Doku.
- Notizen zu `RECORD_AUDIO`/`expo-sqlite` (Nutzen prüfen) in den Eintrag aufnehmen.

---

## 3. Akzeptanzkriterien
- EAS-Preview-Build erfolgreich (APK-Link vorhanden), gebaut mit den EAS-Variablen aus N1.
- Die Smoke-Liste 1–8, 10 und 13 sind auf einem echten Android-Gerät grün; Abweichungen bei 9, 11 und 12 sind dokumentiert (nicht zwingend grün).
- Ergebnisprotokoll in `docs/TEST_STATUS.md`, TODO-Haken gesetzt, Fehlschläge als eigene Einträge.

## 4. Risiken
- **Fehlende Variablen** → Login scheitert (Konfigurations-, nicht SDK-Fehler): N1 vorher.
- **Build-Kosten/-Queue:** EAS Free-Tier hat Build-Kontingent pro Monat; ein Lauf genügt, kein „Probieren“ in Serie.
- **Test gegen Production:** Es entstehen echte Datensätze eines Testkontos; danach per Konto-Löschung bereinigen (nutzt zugleich den Löschpfad, aber erst nach Paket L testen, falls möglich).
- **Native Einschränkungen** (kein Service Worker, kein Web Push, kein Offline-Detail-Cache) sind **bekannt und kein Befund**; nur das tatsächliche Verhalten festhalten.

## 5. Entscheidungen für den Betreiber
| # | Frage | Empfehlung |
|---|---|---|
| 1 | Nur Android (APK) jetzt | **ja**; iOS erst mit Apple-Developer-Zugang (99 €/Jahr), sonst nicht Teil des Starts |
| 2 | Testserver | **Production mit Testkonto** (einfachster Weg, `PRODUCTION_URL` ist Standard); Staging nur, wenn die Server-URL im Gerät umgestellt werden kann (Aufwand unklar, nicht nötig) |
| 3 | Wann bauen | **jederzeit** parallel (unabhängig von allen anderen Paketen); idealerweise nach Paket S, damit PDF/Proxy (Zeile 11) den Login-Weg testet |
| 4 | EAS-Variablen anlegen | Betreiber führt die `env:create`-Befehle selbst aus (Werte nicht über den Chat) |
| 5 | `RECORD_AUDIO`/`expo-sqlite` entfernen | **erst nach dem Test** prüfen; nicht in diesem Paket |

**Aufwand:** S–M (ca. 2 h Betreiberzeit inklusive Gerätetest).
