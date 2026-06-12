# PWA Installable Shell — Plan

Datum: 2026-06-12
Status: Reviewed — bereit zur Umsetzung (Phasen 1–3)
Owner: dacown / KI
Trigger: TODO.md → „Progressive Web App (PWA) einbauen" (Naechste Reihenfolge, Punkt 1)

## Scope-Entscheidung (D1 — review-entschieden)

**Dieser PR: Phasen 1–3** (Manifest+Icons, SW App-Shell, Install/Update-UI).
**Follow-up-PR: Phasen 4–6** (Auth-Boundary + API-Cache, Offline-Lesepfad, Doku/Cleanup).

## Kontext (Ist-Stand)

- Web-Frontend ist Expo Router Web Static Export, der Hono-Server in [src/index.ts](../../../src/index.ts) liefert die Dateien aus `public/`.
- In [mobile/app/+html.tsx](../../../mobile/app/+html.tsx#L45-L50) wird aktiv jeder vorhandene Service Worker deregistriert (Legacy-Cleanup nach altem Vite-PWA-Build). Es laeuft also **gar kein SW**.
- Es existiert **kein** `manifest.webmanifest`. Der Server hat den MIME-Typ `application/manifest+json` allerdings bereits eingetragen ([src/index.ts](../../../src/index.ts#L39)).
- [mobile/components/OfflineBanner.tsx](../../../mobile/components/OfflineBanner.tsx) wertet ausschliesslich `navigator.onLine` aus und zeigt ein Banner. Es gibt **keinen** Cache-Pfad fuer Offline-Daten.
- [mobile/app/(tabs)/settings.tsx](../../../mobile/app/(tabs)/settings.tsx#L75) deklariert in der Roadmap „PWA (Web): 100 %" — das ist faktisch falsch und Teil dieses Plans zu korrigieren.
- Auth-Onboarding/Recipes-Ownership und das Query-Cache-Namespacing pro `userId` (PR #7) sind frisch gelandet. Ein SW darf das **nicht** unterlaufen (kein Cross-User-Leak ueber persistenten Cache).
- Strict-Performance-Gate ist scharf (`mobile-release-gate`, Bundle-/Lighthouse-Budgets). Jeder SW-Footprint zaehlt.

Asset-Inventur:

- Icons: `mobile/assets/images/icon.png`, `favicon.png`, `splash-icon.png`, `adaptive-icon.png`. Es fehlen: 192x192, 512x512, maskable, apple-touch-icon (180x180).
- Audit-Shell in [mobile/app/+html.tsx](../../../mobile/app/+html.tsx) ist bereits ein guter Vor-Hydration-Frame fuer `/shopping` und `/recipe/*` — die SW-Navigation-Fallback-Strategie kann darauf aufsetzen.

## Ziel (Definition of Done)

Eine Web-Nutzerin kann die App auf Android (Chromium) und iOS (Safari) zum Homescreen hinzufuegen, sieht beim Start einen App-Shell-Frame ohne Browser-Chrome, und die App laeuft **mindestens lesend** offline (App-Shell + Static Assets + zuletzt geladene Rezepte/Listen). Beim Logout und beim User-Wechsel bleibt **kein** anderer User-Cache erreichbar. Strict-Performance-Gate bleibt gruen.

Konkret:

1. `manifest.webmanifest` ausgeliefert, validiert von Lighthouse als „Installable".
2. Service Worker registriert, Precache fuer App-Shell + Expo-Hash-Assets, Runtime-Cache fuer `GET /api/v1/recipes` (Liste + Detail).
3. Install-Affordance (Settings-Banner + iOS-Hinweis) sichtbar; `beforeinstallprompt` korrekt eingefangen.
4. Update-Flow mit nutzerseitiger „Neue Version" Aktion, kein stiller `skipWaiting()` im Hintergrund.
5. Auth-Boundary: SW-Caches sind pro Session benannt; Logout (`auth state change` → `SIGNED_OUT`) leert die User-Caches; keine `Authorization`-Header werden gecached.
6. Lighthouse PWA-Kategorie: keine roten Findings; Performance-Gate (`npm run perf:validate`) gruen; Bundle-Budgets unveraendert.
7. Roadmap in Settings korrigiert (100 % → realer Stand nach Slice).

Explizit **nicht** im Scope:

- Background Sync / Push Notifications.
- Schreibender Offline-Pfad fuer Shopping/Planner (das ist ein eigener spaeterer Slice — Mutations-Queue, Konfliktloesung).
- Native iOS/Android App-Wrapper (separater Track).
- Edge-Function-/CDN-Aenderungen ueber Northflank hinaus.

## Risiken / Constraints

- **Auth-/Privacy-Risiko (P0):** Ein falsch konfigurierter SW kann den frisch gelandeten Query-Cache-Namespacing-Schutz aushebeln. Mitigation: nur `GET` ohne `Authorization` cachen; Cache-Name enthaelt `userId`-Hash; Auth-State-Listener loescht User-Caches.
- **Performance:** Workbox-Runtime kostet ~10–15 kB gz. Das ist gegen die strict-Budgets zu vermessen. Mitigation: SW als separater eigenstaendiger JS-Build (nicht im Hauptbundle), Workbox-Module gezielt importieren, ggf. handgerollter Mini-SW als Alternative haben.
- **Cache-Korrektheit:** Expo-Web liefert HTML mit `no-cache` und gehashte Assets mit `immutable` ([src/index.ts](../../../src/index.ts#L82-L95)). SW muss diese Semantik respektieren: HTML immer Network-First mit kurzem Fallback, Hash-Assets Cache-First.
- **iOS-Limits:** Safari-PWA hat Cache-Quoten und kein Install-Prompt-Event. Eigene UI-Hinweise (Share-Sheet → „Zum Home-Bildschirm") sind noetig.
- **Legacy-SW-Unregister:** Der bestehende Unregister-Snippet in [+html.tsx](../../../mobile/app/+html.tsx#L45-L50) muss durch ein gezieltes „neue SW registrieren, fremde unregistrieren" ersetzt werden — sonst loescht die App ihren eigenen frisch installierten SW beim naechsten Reload.
- **CI/Strict-Gate:** Der `mobile-release-gate` und Lighthouse-Strict koennten ueber zusaetzliche Requests in den 95-Perzentil-Werten kippen. Wir messen vor Merge.

## Phasen

Jede Phase ist eigenstaendig mergebar und ergibt sichtbaren Mehrwert. Phasen 1–3 sind der Pflicht-Pfad zur „installable PWA", Phasen 4–6 hebeln den realen Nutzen.

### Phase 1 — Manifest + Icons + iOS-Meta (klein, sichtbar)

Ziel: App ist nach Lighthouse „installable", auch ohne SW-Caching.

Aufgaben:

- `mobile/public/manifest.webmanifest` anlegen mit `name`, `short_name`, `start_url=/`, `scope=/`, `display=standalone`, `background_color=#fff8ef`, `theme_color=#c84b31` (Brand aus Audit-Shell), `icons[]` (192, 512, maskable 512).
- Icons **einmalig generieren und ins Repo committen** (PNG-Dateien ~50–100 KB total): `mobile/public/icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, `apple-touch-icon-180.png` aus `mobile/assets/images/icon.png`. Script `scripts/pwa/generate-icons.ts` (Sharp-basiert) bleibt als optionales Werkzeug im Repo, wird aber **nicht** als Build-Step ausgefuehrt — kein Sharp in der CI-Pipeline ([Cross-C]: vermeidet zweite native Dep wie `better-sqlite3`).
- In [mobile/app/+html.tsx](../../../mobile/app/+html.tsx) Head erweitern:
  - `<link rel="manifest" href="/manifest.webmanifest">`
  - `<meta name="theme-color" content="#c84b31">`
  - `<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon-180.png">`
  - `<meta name="apple-mobile-web-app-capable" content="yes">`
  - `<meta name="apple-mobile-web-app-status-bar-style" content="default">`
  - `<meta name="apple-mobile-web-app-title" content="RecipeDeck">`
- Server-Route fuer `/manifest.webmanifest`: der vorhandene Wildcard-Handler in [src/index.ts](../../../src/index.ts) liefert `.webmanifest`-Dateien bereits korrekt mit `application/manifest+json` (MIME_TYPES ist explizit eingetragen — verifiziert).
- `npm run build:mobile` kopiert `mobile/public/` ins finale `public/` — kein Build-Step-Eingriff noetig fuer Icons/Manifest.

Akzeptanz:

- Lighthouse Web App → „Installable: pass".
- Chrome zeigt Install-Icon in der Adressleiste.
- Safari iOS Share-Sheet zeigt korrekten Titel + Icon nach „Zum Home-Bildschirm".

### Phase 2 — Service Worker fuer App-Shell + Static Assets

Ziel: App startet ohne Netz, App-Shell ist sofort sichtbar.

Review-Entscheidungen die in diese Phase einfliessen:
- **[A1]** API-Runtime-Cache aus Phase 2 entfernt — SW cached **nur Shell + Hash-Assets, keine API-Antworten**. Eliminiert Cross-User-Leak-Risiko vor Phase-4-Merge.
- **[A2]** SW-Build-Step in `build:mobile` integriert via `postbuild` in `package.json`.
- **[CQ1]** SW-Registrierung: `register('/sw.js')` zuerst, Legacy-Unregister im `.then()`-Callback.
- **[PERF1]** Precache-Umfang: nur Entry-JS + CSS + `/index.html`, Bilder explizit ausgeschlossen.
- **[Cross-A]** Navigation-Route: `networkTimeoutSeconds: 3` (kein 30-Sekunden-Haenger).
- **[Cross-B]** Entry-Point-Identifikation: glob `_expo/static/js/web/*.js`, alle Chunks, Cap 5 MB total.
- **[Cross-D]** Phase-2-Offline-State explizit akzeptiert: App-Shell laeuft + OfflineBanner + leere Listen mit Hinweistext. API-Daten erst ab Phase 4 verfuegbar.

Aufgaben:

- Entscheidung: **Workbox** (`workbox-precaching`, `workbox-routing`, `workbox-strategies`).
- `scripts/pwa/build-sw.ts`: esbuild bundlet `mobile/sw/sw.ts` → `public/sw.js`. Versionierungs-Hash aus Expo-Build-Datum oder Content-Hash.
- Precache (in `build-sw.ts` zur Build-Zeit injiziert):
  - `/index.html` (offline-Fallback)
  - Alle `_expo/static/js/web/*.js` Chunks (glob, Cap 5 MB total)
  - Alle `_expo/static/css/**/*.css` Dateien
  - Bilder und andere Assets: **nicht precachen** (Runtime-Cache ab Phase 4)
- SW-Routing in `mobile/sw/sw.ts`:
  - Navigation (`/`, `/(tabs)/*`, `/recipe/*`, `/shopping`, ...): `NetworkFirst({ networkTimeoutSeconds: 3, cacheName: 'rd-shell-v<hash>' })` → Fallback `/index.html` aus Precache.
  - Hash-Assets `_expo/static/**`: `CacheFirst` (Inhalte sind immutable).
  - Alles andere: unbehandelt (kein SW-Eingriff, kein API-Caching).
- Routing-Logik als **pure Funktionen** extrahieren (`isNavigationRequest(req)`, `isHashAsset(url)`) — testbar ohne SW-Mock ([T2]).
- Registrierung in [mobile/app/+html.tsx](../../../mobile/app/+html.tsx): bestehenden „unregister all"-Block ersetzen durch:

```js
// CQ1: Erst registrieren, dann Legacy-SWs aufraumen
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then(function() {
    navigator.serviceWorker.getRegistrations().then(function(regs) {
      regs.forEach(function(r) {
        if (!r.scriptURL.endsWith('/sw.js')) r.unregister();
      });
    });
  });
}
```

- **SW im Dev-Modus (`npm run dev`) deaktiviert** — Register-Script nur wenn `process.env.NODE_ENV === 'production'` (oder via `__DEV__`-Flag in +html.tsx). Verhindert Dev-DX-Probleme durch gecachte Builds.
- `package.json`: `"build:mobile"` → `"expo export --platform web --output-dir ../public && node scripts/pwa/build-sw.js"` (postbuild-Integration).

Akzeptanz:

- Offline-Reload auf `/`, `/(tabs)/index`, `/shopping`, `/recipe/<id>` zeigt App-Shell + OfflineBanner + leere Listen mit Hinweistext (Phase-2-Offline-State ist akzeptiert).
- Lighthouse PWA: „Has a registered service worker", „Responds with 200 when offline" → pass.
- Bundle-/Performance-Gate gruen (`npm run perf:bundle`, `npm run perf:lighthouse:compare`, `npm run perf:validate`).

### Phase 3 — Update-Flow + Install-Affordance UI

Ziel: Nutzerin merkt Updates und kann installieren.

Review-Entscheidungen die in diese Phase einfliessen:
- **[CQ2]** iOS-Installed-Detection: `window.matchMedia('(display-mode: standalone)').matches` statt `navigator.standalone` (cross-browser).
- **[T1]** Beide Hooks bekommen Vitest-Unit-Tests im selben PR.

Aufgaben:

- `mobile/hooks/usePwaUpdate.ts`: lauscht auf `waiting` SW-State, exponiert `{ updateReady, applyUpdate() }`. `applyUpdate` schickt `SKIP_WAITING` an wartenden SW und reloadet kontrolliert. Cleanup beim Unmount.
- `mobile/hooks/usePwaInstall.ts`: faengt `beforeinstallprompt` ab, speichert deferred Event, exponiert `{ canInstall, install(), showIOSHint, platform }`.
  - iOS-Erkennung:
    ```ts
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    const showIOSHint = isIOS && !isStandalone
    ```
- Tests `mobile/test/usePwaUpdate.test.ts` + `usePwaInstall.test.ts` mit gemocktem `navigator.serviceWorker` und `window.matchMedia`.
- UI in [mobile/app/(tabs)/settings.tsx](../../../mobile/app/(tabs)/settings.tsx):
  - „App installieren" Button (Android/Desktop, falls `canInstall`).
  - iOS-Hinweis-Karte mit Share-Icon-Beschreibung (falls `showIOSHint`).
  - „Neue Version verfuegbar — jetzt anwenden" Banner (sobald `updateReady`).
- Roadmap-Eintrag „PWA (Web)" auf realen Stand korrigieren (z. B. 60 % nach Phase 3, 100 % nach Phase 5).

Akzeptanz:

- Manueller Test Chrome: Install-Button funktioniert, App startet standalone.
- Manueller Test Safari iOS: Hinweis sichtbar; nach „Zum Home-Bildschirm" oeffnet App standalone.
- Update-Flow: neuer SW → Banner → Apply → Reload mit neuem Build.
- `npm run test:mobile` gruen.

### Phase 4 — Auth-/Privacy-Boundary fuer SW-Caches

Ziel: Kein Cross-User-Leak ueber SW-Caches; Logout leert User-Daten.

Aufgaben:

- Cache-Name-Schema: `rd-shell-v<buildHash>`, `rd-assets-v<buildHash>`, `rd-user-<userIdHash>-v<buildHash>`. User-Caches sind getrennt vom Shell-/Asset-Cache.
- SW-Message-API: `{ type: 'SET_USER', userId }` und `{ type: 'CLEAR_USER' }` aus dem Auth-Listener (siehe Hook neben `watchAuthQueryCache`).
- API-Runtime-Cache (nur lesend, nur GET) fuer:
  - `GET /api/v1/recipes` (Liste)
  - `GET /api/v1/recipes/:id` (Detail)
  - `GET /api/v1/recipes/:id/image`
  - Strategie: Stale-While-Revalidate, Cap z. B. 200 Eintraege.
- **Nicht** cachen: alles mit `Authorization`-Header. Auth-Token gelangen ueber `getSession` aus Supabase-Client, der Cache-Key ist trotzdem die URL — also pruefen, ob die Antwort sensible Daten enthaelt; bei Recipes ist Owner-Filter serverseitig erzwungen, also unkritisch solange Cache pro `userId` getrennt ist.
- Logout-Path verifizieren: bei `SIGNED_OUT` werden User-Caches geloescht.

Akzeptanz:

- Manueller Test User A → Logout → User B → kein A-Rezept im B-Cache (DevTools → Application → Cache Storage).
- Automatisierter Test in `mobile/test/sw-auth-boundary.test.ts`: Cache-Name-Funktion und Loesch-Logik isoliert getestet (SW-Code ist plain TS, fuer Vitest faehig).
- Bestehender `query-client-auth-cache.test.ts`-Pfad bleibt gruen.

### Phase 5 — Offline-Lesepfad fuer Liste + Detail (sichtbarer Nutzen)

Ziel: Im Flugzeug oeffne ich „meine Rezepte" und sehe die zuletzt geladenen.

Aufgaben:

- Recipe-Liste und -Detail nutzen schon React Query mit AsyncStorage-Persistenz (siehe vorhandener `query-client`-Pfad). Mit dem API-Runtime-Cache aus Phase 4 ist das Offline-Verhalten zweistufig abgesichert (RQ-Persistenz fuer Daten, SW-Cache fuer Roh-Response inkl. Bilder).
- [OfflineBanner](../../../mobile/components/OfflineBanner.tsx) kompletter machen: „Offline — zuletzt geladene Rezepte werden angezeigt". Kein neuer Hook, nur Text-/State-Polish.
- Recipe-Detail: bei Offline + Cache-Hit Banner „aus Cache"; bei Offline + Cache-Miss klare Fehlermeldung statt Spinner.
- Bilder-Fallback: bei `assets/**`-Miss ein generisches Placeholder-PNG (bereits vorhanden? sonst hinzufuegen).

Akzeptanz:

- Manueller Test: App online laden → DevTools Offline → Reload → Liste + Detail bleiben sichtbar inkl. Bilder.
- Mobile-Test (Vitest, RNTL) erweitert: Offline-Fall fuer Recipe-Detail zeigt Cache-Banner.

### Phase 6 — Doku, Roadmap, Telemetrie, Cleanup

Ziel: Plan ist abgeschlossen und auditierbar.

Aufgaben:

- [CLAUDE.md](../../../CLAUDE.md) erweitern: PWA-Setup, SW-Build-Skript, wann `public/sw.js` neu gebaut werden muss.
- [TODO.md](../../../TODO.md) aktualisieren: PWA-Punkt schliessen, Folgeslices (Background Sync, Mutations-Queue, Push) als neue Eintraege.
- Roadmap in [mobile/app/(tabs)/settings.tsx](../../../mobile/app/(tabs)/settings.tsx) auf realen Stand bringen.
- Optional: kleines `pwa-telemetry`-Pingen (z. B. `display-mode: standalone` ja/nein) — **nur** wenn DSGVO/Settings-Toggle dazu vorhanden ist; sonst weglassen.
- Runbook `docs/pwa-runbook.md` mit: „SW neu builden", „Cache-Versionen tauschen", „Notfall: alle SW deregistrieren".

Akzeptanz:

- Doku-Links existieren und sind in CLAUDE.md verlinkt.
- Roadmap zeigt korrekten Stand.

## Reihenfolge / Abhaengigkeiten

```
Phase 1 (Manifest+Icons)  →  Phase 2 (SW App-Shell)  →  Phase 3 (Install/Update UI)
                                       ↓
                              Phase 4 (Auth-Boundary)  →  Phase 5 (Offline-Lesepfad)
                                                                   ↓
                                                          Phase 6 (Doku/Cleanup)
```

Phase 1 ist ein eigenstaendiger PR (sichtbar, low-risk). Phase 2 + 4 koennen technisch zusammenfallen, aber wir trennen sie wegen Reviewbarkeit — Phase 2 ohne Auth-Beruehrung, Phase 4 dann sauber als Privacy-Slice.

## Tests / Gates pro Phase

| Phase | Manuell | Automatisiert | Performance |
|-------|---------|---------------|-------------|
| 1     | Chrome Install-Icon, iOS Share-Sheet | — | `npm run perf:bundle` (unveraendert erwartet) |
| 2     | Offline-Reload Chrome | SW-Build-Skript hat eigenen Unit-Test | `npm run perf:lighthouse:compare`, `npm run perf:validate` |
| 3     | Install + Update-Banner Chrome/iOS | Hooks-Tests `usePwaInstall`/`usePwaUpdate` | — |
| 4     | User-Wechsel ohne Cross-Leak | `sw-auth-boundary.test.ts` + Re-Run `query-client-auth-cache.test.ts` | — |
| 5     | Flugmodus → Liste + Detail | RNTL-Test Offline-Banner | — |
| 6     | Doku-Review | — | `npm run perf:validate:strict` (sollte ready=true bleiben) |

## Offene Fragen (vor Phase-Start zu entscheiden)

1. **Workbox oder handgerollt?** Default Workbox; falls Bundle-Budget knapp wird, switch.
2. **Theme-Color final?** Aus dem aktuellen Brand (Audit-Shell nutzt `#c84b31`) — bestaetigen.
3. **Maskable-Icon-Quelle:** Re-Use `adaptive-icon.png` oder eigenes Asset? Vermutlich Re-Use.
4. **Soll der SW im Dev-Modus (`npm run dev:mobile` / Expo dev) aktiv sein?** Empfehlung: nein, nur im Static-Export — sonst Dev-DX-Probleme.
5. **Settings-Roadmap-Prozent:** Wollen wir die Skala beibehalten oder umstellen auf „in Arbeit / fertig"?

## Risiken-Register kurz

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|--------|--------------------|--------|------------|
| Cross-User-Leak ueber SW-Cache | mittel | hoch | Phase 4 explizit, automatisierter Test |
| Strict-Performance-Gate kippt | mittel | mittel | Workbox-Module gezielt, Bundle-Budget vorher messen |
| iOS-Limits (Quote, kein Prompt) | hoch | niedrig | Eigene Hinweis-UI, dokumentierte Erwartung |
| Veralteter SW haengt fest | niedrig | mittel | Cache-Name mit Build-Hash; Notfall-Runbook |
| Auth-Token im Response-Cache | niedrig | hoch | Strikt nur GET ohne `Authorization` cachen; Whitelist statt Blacklist |

## Naechste Schritte

1. ~~Diesen Plan reviewen lassen~~ ✅ Review abgeschlossen (2026-06-12).
2. Phase 1 als eigenen PR starten (klein, low-risk, sichtbarer Lighthouse-Win).
3. TODO.md: PWA-Punkt mit Link auf diesen Plan annotieren.

---

## Was bereits existiert (Reuse-Inventur)

| Existierende Ressource | Wie der Plan sie nutzt |
|------------------------|------------------------|
| `MIME_TYPES[".webmanifest"]` in [src/index.ts](../../../src/index.ts#L39) | Manifest wird ohne neuen Server-Code korrekt ausgeliefert |
| `mobile/app/+html.tsx` Skript-Block | Ersetzt bestehenden unregister-Block; kein Neubau des Frameworks |
| `mobile/components/OfflineBanner.tsx` | Wird im Phase-2-Offline-State direkt genutzt (kein Umbau) |
| `watchAuthQueryCache`-Muster in hooks | Phase 4 (Follow-up) knoepft hier den SW-Message-Listener an |
| `mobile/public/` als Metro Static-Verzeichnis | Manifest + Icons landen automatisch im Expo-Export ohne Build-Step-Aenderung |
| Strict-Performance-Gate (`perf:validate`) | Bestehende Gate-Infrastruktur wird wiederverwendet, kein neuer CI-Job |

---

## Nicht im Scope (bewertet und explizit ausgeschlossen)

| Thema | Begruendung |
|-------|-------------|
| API-Runtime-Cache in Phase 2 | Cross-User-Leak-Risiko ohne Auth-Boundary; in Phase 4 (Follow-up-PR) |
| Schreibender Offline-Pfad (Shopping/Planner) | Mutations-Queue + Konfliktloesung sind eigener Slice |
| Background Sync / Push Notifications | Eigener Slice nach Phase 5 |
| Native iOS/Android App-Wrapper | Separater Track |
| Edge-Function-/CDN-Aenderungen | Kein Northflank-Eingriff noetig |
| Sharp als Build-Dep | Icons werden einmalig generiert und committet; kein CI-Footprint |
| SW im Dev-Modus aktiv | Dev-DX-Probleme; nur Static-Export-Build |

---

## Implementation Tasks

Synthesized from this review's findings. Run with Claude Code; checkbox as you ship.

- [ ] **T1 (P1, CC: ~20min)** — Phase 1: Manifest + Theme-Color — `mobile/public/manifest.webmanifest` mit `theme_color=#c84b31`, `background_color=#fff8ef`, `display=standalone`, Icons-Array anlegen.
  - Verify: Lighthouse Web App Installable pass; `GET /manifest.webmanifest` liefert `Content-Type: application/manifest+json`

- [ ] **T2 (P1, CC: ~10min)** — Phase 1: Icons einmalig generieren + committen — `icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, `apple-touch-icon-180.png` in `mobile/public/`.
  - Surfaced by: Cross-C (Sharp native dep vermeiden)
  - Verify: Dateien im Repo; `mobile/public/` korrekt in Expo-Export-Output

- [ ] **T3 (P1, CC: ~15min)** — Phase 1: +html.tsx Head-Tags — manifest link, theme-color, apple-touch-icon, apple-mobile-web-app-* Meta-Tags.
  - Files: `mobile/app/+html.tsx`
  - Verify: `npm run build:mobile` erzeugt HTML mit allen Tags

- [ ] **T4 (P1, CC: ~30min)** — Phase 2: SW-Routing als pure Funktionen — `isNavigationRequest(req)`, `isHashAsset(url)` aus `sw.ts` extrahieren.
  - Surfaced by: T2 (Vitest-Testbarkeit ohne SW-Mock)
  - Files: `mobile/sw/sw.ts`
  - Verify: Funktionen sind direkt von Vitest importierbar

- [ ] **T5 (P1, CC: ~45min)** — Phase 2: Service Worker (`mobile/sw/sw.ts`) — Workbox, Precache (Glob `_expo/static/js/web/*.js` + CSS, Cap 5 MB), NetworkFirst-Navigation mit `networkTimeoutSeconds: 3`, CacheFirst fuer Hash-Assets.
  - Surfaced by: Cross-A (Timeout), Cross-B (Glob-Strategie), A1 (kein API-Cache)
  - Files: `mobile/sw/sw.ts`, `scripts/pwa/build-sw.ts`
  - Verify: Offline-Reload zeigt App-Shell; Lighthouse „Responds with 200 when offline"

- [ ] **T6 (P1, CC: ~20min)** — Phase 2: SW-Registrierung in +html.tsx — `register('/sw.js')` first, dann Legacy-Unregister im `.then()`-Callback; Dev-Mode-Guard.
  - Surfaced by: CQ1 (Reihenfolge), A2 (Integration)
  - Files: `mobile/app/+html.tsx`
  - Verify: Nach Reload kein Legacy-SW mehr registriert; eigener SW bleibt aktiv

- [ ] **T7 (P1, CC: ~15min)** — Phase 2: postbuild-Integration in package.json — `build:mobile` ruft nach Expo-Export `node scripts/pwa/build-sw.js` auf.
  - Surfaced by: A2
  - Files: `package.json`, `scripts/pwa/build-sw.ts`
  - Verify: `npm run build:mobile` erzeugt `public/sw.js`

- [ ] **T8 (P2, CC: ~30min)** — Phase 3: `usePwaUpdate.ts` + Tests — waiting-Detection, `applyUpdate()`, Cleanup. Tests: updateReady=true bei waiting SW; applyUpdate sendet SKIP_WAITING.
  - Surfaced by: T1
  - Files: `mobile/hooks/usePwaUpdate.ts`, `mobile/test/usePwaUpdate.test.ts`
  - Verify: `npm run test:mobile` gruen

- [ ] **T9 (P2, CC: ~30min)** — Phase 3: `usePwaInstall.ts` + Tests — beforeinstallprompt, iOS-Detection via matchMedia, `install()`. Tests: canInstall=true bei Prompt; showIOSHint nur wenn iOS+!standalone.
  - Surfaced by: T1, CQ2
  - Files: `mobile/hooks/usePwaInstall.ts`, `mobile/test/usePwaInstall.test.ts`
  - Verify: `npm run test:mobile` gruen

- [ ] **T10 (P2, CC: ~20min)** — Phase 3: Settings-UI (Install-Button, iOS-Hint, Update-Banner) + Roadmap-Korrektur auf 60 %.
  - Files: `mobile/app/(tabs)/settings.tsx`
  - Verify: Manuell Chrome Install + iOS Share-Sheet; Update-Banner erscheint bei neuem SW

- [ ] **T11 (P2, CC: ~20min)** — SW-Routing Vitest-Tests fuer pure Funktionen.
  - Surfaced by: T2
  - Files: `mobile/test/sw-routing.test.ts`
  - Verify: `npm run test:mobile` gruen; isNavigationRequest/isHashAsset alle Pfade abgedeckt

---

## GSTACK REVIEW REPORT

| Section | Status | Key Findings |
|---------|--------|-------------|
| Architecture | Issues found + resolved | A1: API-Cache aus Phase 2 (Cross-User-Leak); A2: SW-Build postbuild-Integration |
| Code Quality | Issues found + resolved | CQ1: SW-Register-vor-Unregister-Reihenfolge; CQ2: matchMedia statt navigator.standalone |
| Tests | Issues found + resolved | T1: Hooks-Tests im PR; T2: Pure SW-Routing-Funktionen fuer Vitest |
| Performance | Issues found + resolved | PERF1: Precache-Umfang begrenzt (Entry-JS+CSS+HTML, kein Bilder-Precache) |
| Outside Voice | 4 genuine findings | Cross-A: networkTimeoutSeconds:3; Cross-B: Glob-Strategie; Cross-C: Sharp commit statt Build; Cross-D: Phase-2-Offline-State dokumentiert |

VERDICT: **PLAN APPROVED for Phases 1–3.** Alle P0/P1-Findings sind im Plan adressiert. Phases 4–6 folgen als separater PR nach Merge.

NO UNRESOLVED DECISIONS
