# Web Persistenz Abnahme

Datum: 2026-06-15

Umgebung: Production Web (`https://p01--rezepti-app--2s7hvlwm5zc5.code.run`)

Testnutzer-Typ: bestaetigter Public-Inbox-Testnutzer (E-Mail/Passwort-Login, eigener Workspace)

## Scope

Geprueft wurde die offene TODO-Abnahme fuer Web-Persistenz nach Multi-Auth-Stabilisierung:

- Session bleibt nach Reload erhalten
- Session bleibt in einem neuen Tab derselben Browser-Session erhalten
- Frische Browser-Session startet abgemeldet
- Theme-Persistenz funktioniert
- Settings-Persistenz fuer Foto-Import-Zaehlwert funktioniert
- PDF-Pfad bleibt nach Reload und im neuen Tab nutzbar

## Durchgefuehrte Schritte

1. Mit bestaetigtem Testkonto in `Account & Workspace` eingeloggt.
2. Per authentifiziertem API-Call ein eigenes Testrezept erzeugt (`QA Persist Pasta 2`), damit der PDF-Pfad verifizierbar ist.
3. In `Einstellungen` Theme auf `Dunkel` gesetzt.
4. In `Einstellungen` den Foto-Import-Wert auf `16` gesetzt.
5. `Einstellungen` neu geladen.
6. Rezeptdetailseite des Testrezepts nach Reload geoeffnet und PDF exportiert.
7. Neuen Tab in derselben Browser-Session geoeffnet, dort `Einstellungen` und Rezeptdetail erneut geprueft und PDF erneut exportiert.
8. Frische Browser-Session geoeffnet und verifiziert, dass keine Session uebernommen wird.
9. Testrezept wieder geloescht.

## Ergebnisse

| Fall | Erwartung | Ergebnis |
|---|---|---|
| Login / Bootstrap | Session aktiv, Workspace bereit | PASS |
| Settings nach Setzen | Theme `dark`, Foto-Import `16`, Account aktiv | PASS |
| Reload auf `settings` | Theme `dark` bleibt, `image_search_count=16`, Account bleibt aktiv | PASS |
| Reload auf Rezeptdetail / PDF | Rezept bleibt sichtbar, `PDF`-Export funktioniert | PASS |
| Neuer Tab derselbe Browser | Theme `dark`, `image_search_count=16`, Account bleibt aktiv | PASS |
| Neuer Tab / Rezeptdetail / PDF | Rezept bleibt sichtbar, `PDF`-Export funktioniert | PASS |
| Neue Browser-Session | `Nicht angemeldet` / `Ohne Session` | PASS |
| Neue Browser-Session / direktes Rezept | Kein Zugriff auf authentifizierten Rezeptinhalt | PASS |

## Notizen

- Verifiziert wurde ein echter Browser-Flow mit Headless Chrome gegen die deployte Production-URL, nicht nur Vitest-/Storage-Mocks.
- Die PDF-Verifikation erfolgte ueber erfolgreiche Download-Events mit Dateiname `QA_Persist_Pasta_2.pdf`.
- Theme-Persistenz wurde sowohl sichtbar (`document.documentElement.classList.contains('dark')`) als auch ueber den gespeicherten Zustand validiert.
- Settings-Persistenz wurde ueber den gespeicherten Wert `image_search_count=16` validiert.
