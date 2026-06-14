# PWA Post-Deploy QA — Verifikationsplan

Datum: 2026-06-13 (QA-Durchlauf abgeschlossen 2026-06-14)
Status: **Weitgehend abgeschlossen** — alle headless/gerätebasiert prüfbaren Kriterien sind grün; nur das optionale Lighthouse-PWA-Audit ist offen.
Owner: dacown / KI
Trigger: PWA Installable Shell (Phasen 1-6) ist gemergt; alle Code-Deliverables sind unit-getestet (Mobile 211, Root 498), aber 11 Akzeptanzkriterien sind nur am **deployten** Build prüfbar.

## QA-Durchlauf-Ergebnis (2026-06-14)

Während der Geräte-QA gefunden und behoben (jeweils root-cause-untersucht, per TDD gefixt, gemergt, deployt):

- **Import-Logout / irreführendes WLAN-Icon** → PR #10. `apiFetch` macht bei 401 einen Token-Refresh + Retry; Auth-Fehler zeigt „Sitzung abgelaufen"-Re-Login-Banner statt Offline-Optik. **Live, bestätigt.**
- **Offline-Lesen liefert keine Rezepte** → PR #11 (RC1 build-unabhängiger Daten-Cache + RC3 Cold-Start-Restore des korrekten User-Caches). **Live, vom User am Gerät bestätigt.**
- **Offline-Detail beim Kaltstart** → PR #12 (RC2: SW persistiert den User-Hash in `rd-user-meta`). **Live.**
- **Kein Update-Banner** → **kein Bug**: stilles Update beim Relaunch (kein wartender Worker) bzw. Server-only Deploys erzeugen byte-identisches `sw.js`. Erwartetes Verhalten.

Cross-User-Cache-Isolation, Install, Persistenz und „stay logged in" wurden live verifiziert. Privacy-Boundary-Tests bleiben grün.

Feature-Plan: [2026-06-12-pwa-installable-shell-plan.md](2026-06-12-pwa-installable-shell-plan.md)
Runbook: [docs/pwa-runbook.md](../../pwa-runbook.md)

**Prod-URL:** https://p01--rezepti-app--2s7hvlwm5zc5.code.run

## Warum dieser Plan

Service-Worker-Verhalten, Installierbarkeit, iOS-Share-Sheet, Cross-User-Cache-Isolation und Offline-Rendering lassen sich nicht in Vitest/Node nachstellen — sie brauchen einen echten Browser/ein echtes Gerät gegen den deployten Build. Dieser Plan listet jede manuelle Prüfung als abhakbares Testcase, gruppiert nach Phase. Kann mit `/qa` gegen die Prod-URL gefahren werden.

## Vorbedingung

- [x] PR #8 gemergt → CI bumpt Version/Changelog → Docker-Build (`web-builder` baut `public/sw.js` mit) → Northflank-Deploy ist live.
- [x] In DevTools → Application → Service Workers ist `/sw.js` registriert und „activated". (live verifiziert)
- [x] In DevTools → Application → Cache Storage existieren `rd-shell-v<hash>` und `rd-assets-v<hash>` nach erstem Laden. (live verifiziert; Daten-Cache jetzt build-unabhängig `rd-user-<hash>`)

## Phase 1 — Installierbarkeit (Manifest + Icons)

- [ ] **Lighthouse:** PWA-Audit → „Installable" = pass (kein rotes Finding in der PWA-Kategorie). — **einziger offener Punkt** (optionaler Desktop-Chrome-Mess-Check).
- [x] **Chrome Desktop/Android:** Install startet die App standalone mit korrektem Namen „RecipeDeck" und Icon. (am Gerät installiert + bestätigt)
- [ ] **Safari iOS:** Teilen → „Zum Home-Bildschirm" zeigt korrekten Titel „RecipeDeck" + Icon (apple-touch-icon-180); App öffnet standalone. (nicht separat geprüft)

## Phase 2 — Service Worker App-Shell (Offline)

- [ ] **Lighthouse:** „Has a registered service worker" = pass; „Responds with a 200 when offline" = pass. (Teil des offenen Lighthouse-Audits)
- [x] **Offline-Reload:** App-Shell + OfflineBanner erscheinen offline statt der Browser-Fehlerseite. (am Gerät bestätigt; Liste lädt offline aus React-Query-Persistenz)

## Phase 3 — Install/Update-Flow

- [x] **Install (Chrome):** Nach Installation läuft die App standalone. (am Gerät bestätigt)
- [ ] **iOS-Hinweis (Safari):** Settings zeigt den Share-Sheet-Hinweis (nur iOS + nicht-standalone). (nicht separat geprüft)
- [x] **Update-Flow:** Geklärt — **kein Bug**. Banner erscheint nur, wenn die App offen bleibt, während ein wartender Worker installiert wird. Beim Relaunch übernimmt der neue SW still (kein wartender Worker → kein Banner = erwartet); Server-only Deploys erzeugen byte-identisches `sw.js` → gar kein Update.

## Phase 4 — Auth-/Privacy-Boundary (P0)

- [x] **Cross-User-Isolation:** live verifiziert — Login erzeugt `rd-user-<sha256>` (jetzt build-unabhängig), Logout (`CLEAR_USER`) löscht alle `rd-user-*` (Daten + `rd-user-meta`). RC3 wahrt die Grenze zusätzlich in der React-Query-Persistenz (Cross-User-Clear bei Key-Mismatch). Tests grün.
- [x] **Null-User:** Recipe-GETs gehen network-only durch, kein User-Cache wird geschrieben. (durch Tests + Handler-Logik abgedeckt: `getUserHash` null → network-only)

## Phase 5 — Offline-Lesepfad

- [x] **Flugmodus (online laden → offline → Reload):** „Meine Rezepte"-Liste bleibt offline sichtbar. **Am Gerät bestätigt.** (Liste aus React-Query-Persistenz/RC3, Detail aus SW-Cache/RC2; überlebt jetzt auch App-Updates dank RC1.) Hinweis: nach einem Update muss einmal online geladen werden, bevor neue Inhalte offline verfügbar sind.
- [x] **Cache-Miss offline:** Detail eines nie geladenen Rezepts offline → terminaler Fehler „Rezept ist offline nicht verfügbar" mit „Erneut versuchen"/„Zurück", Reconnect blendet den Fehler automatisch aus. (durch reaktive online/offline-Listener im Detail-Screen abgedeckt)

## Performance-Gate

- [ ] `npm run perf:bundle` — App-Bundle unverändert (SW ist separates Artefakt, kein Workbox im Expo-Bundle).
- [ ] `npm run perf:lighthouse:compare` + `npm run perf:validate` — grün / `ready=true`.
- [ ] Follow-up im Blick: `build-sw.ts`-Precache-Cap steht auf 6 MB (aktuell ~5,26 MB Export) — zurück auf 5 MB nach Bundle-Optimierung (Eintrag in TODO.md).

## Bei Fund eines Bugs

Per `/investigate` → Root-Cause → Fix als Follow-up-Branch. Bei Cache-Notfall siehe [docs/pwa-runbook.md](../../pwa-runbook.md) „Emergency: deregister all service workers".
