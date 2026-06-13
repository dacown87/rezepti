# PWA Post-Deploy QA — Verifikationsplan

Datum: 2026-06-13
Status: Offen — auszuführen NACH Deploy des PWA-Slice (PR #8)
Owner: dacown / KI
Trigger: PWA Installable Shell (Phasen 1-6) ist gemergt; alle Code-Deliverables sind unit-getestet (Mobile 211, Root 498), aber 11 Akzeptanzkriterien sind nur am **deployten** Build prüfbar.

Feature-Plan: [2026-06-12-pwa-installable-shell-plan.md](2026-06-12-pwa-installable-shell-plan.md)
Runbook: [docs/pwa-runbook.md](../../pwa-runbook.md)

**Prod-URL:** https://p01--rezepti-app--2s7hvlwm5zc5.code.run

## Warum dieser Plan

Service-Worker-Verhalten, Installierbarkeit, iOS-Share-Sheet, Cross-User-Cache-Isolation und Offline-Rendering lassen sich nicht in Vitest/Node nachstellen — sie brauchen einen echten Browser/ein echtes Gerät gegen den deployten Build. Dieser Plan listet jede manuelle Prüfung als abhakbares Testcase, gruppiert nach Phase. Kann mit `/qa` gegen die Prod-URL gefahren werden.

## Vorbedingung

- [ ] PR #8 gemergt → CI bumpt Version/Changelog → Docker-Build (`web-builder` baut `public/sw.js` mit) → Northflank-Deploy ist live.
- [ ] In DevTools → Application → Service Workers ist `/sw.js` registriert und „activated".
- [ ] In DevTools → Application → Cache Storage existieren `rd-shell-v<hash>` und `rd-assets-v<hash>` nach erstem Laden.

## Phase 1 — Installierbarkeit (Manifest + Icons)

- [ ] **Lighthouse:** PWA-Audit → „Installable" = pass (kein rotes Finding in der PWA-Kategorie).
- [ ] **Chrome Desktop/Android:** Install-Icon erscheint in der Adressleiste; Installation startet die App standalone (ohne Browser-Chrome) mit korrektem Namen „RecipeDeck" und Icon.
- [ ] **Safari iOS:** Teilen → „Zum Home-Bildschirm" zeigt korrekten Titel „RecipeDeck" + Icon (apple-touch-icon-180); App öffnet standalone.

## Phase 2 — Service Worker App-Shell (Offline)

- [ ] **Lighthouse:** „Has a registered service worker" = pass; „Responds with a 200 when offline" = pass.
- [ ] **Offline-Reload (Chrome, DevTools → Network → Offline):** `/`, `/(tabs)/index`, `/shopping`, `/recipe/<id>` zeigen die App-Shell + OfflineBanner + leere/gecachte Inhalte statt der Browser-Offline-Fehlerseite (Deep-Links via `matchPrecache('/index.html')`-Fallback).

## Phase 3 — Install/Update-Flow

- [ ] **Install (Chrome):** Settings-Karte zeigt „App installieren"; Klick triggert den nativen Prompt; nach Installation läuft die App standalone.
- [ ] **iOS-Hinweis (Safari):** Settings zeigt den Share-Sheet-Hinweis (nur iOS + nicht-standalone).
- [ ] **Update-Flow:** Neuen Build deployen → Banner „Neue Version verfügbar — jetzt anwenden" erscheint → „Anwenden" lädt mit neuem Build neu (kein stiller skipWaiting im Hintergrund).

## Phase 4 — Auth-/Privacy-Boundary (P0)

- [ ] **Cross-User-Isolation:** User A einloggen, Rezepte laden (DevTools → Cache Storage zeigt `rd-user-<hashA>-v<build>`) → Logout (Cache `rd-user-*` verschwindet) → User B einloggen → **kein A-Rezept im B-Cache**, B nutzt `rd-user-<hashB>-v<build>`.
- [ ] **Null-User:** Nach Logout (vor erneutem Login) gehen Recipe-GETs network-only durch, kein User-Cache wird geschrieben.

## Phase 5 — Offline-Lesepfad

- [ ] **Flugmodus (online laden → DevTools Offline → Reload):** „Meine Rezepte"-Liste + Detail bleiben sichtbar inkl. Bilder; Detail zeigt „Offline — Rezept aus Cache".
- [ ] **Cache-Miss offline:** Detail eines nie geladenen Rezepts offline → terminaler Fehler „Rezept ist offline nicht verfügbar" mit „Erneut versuchen"/„Zurück", kein Endlos-Spinner; Reconnect blendet den Fehler automatisch aus.

## Performance-Gate

- [ ] `npm run perf:bundle` — App-Bundle unverändert (SW ist separates Artefakt, kein Workbox im Expo-Bundle).
- [ ] `npm run perf:lighthouse:compare` + `npm run perf:validate` — grün / `ready=true`.
- [ ] Follow-up im Blick: `build-sw.ts`-Precache-Cap steht auf 6 MB (aktuell ~5,26 MB Export) — zurück auf 5 MB nach Bundle-Optimierung (Eintrag in TODO.md).

## Bei Fund eines Bugs

Per `/investigate` → Root-Cause → Fix als Follow-up-Branch. Bei Cache-Notfall siehe [docs/pwa-runbook.md](../../pwa-runbook.md) „Emergency: deregister all service workers".
