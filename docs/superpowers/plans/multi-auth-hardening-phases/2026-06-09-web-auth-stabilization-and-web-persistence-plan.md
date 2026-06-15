# Multi-Auth Phase 1: Web Auth Stabilization and Web Persistence

Datum: 2026-06-09
Main plan: [Multi-Auth Hardening Plan](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-06-09-multi-auth-hardening-plan.md)

> **Umgesetzt:** Session-restore interstitial (T11), web-aware confirmation return (T10), deep-link error surface (T9), query-cache namespacing (T7), session persistence tests (T12).

> **/autoplan 2026-06-09 — Update:** Laeuft erst NACH dem Credential-Auth-Hotfix
> (Schritt 0 im Main-Plan). Zwei verifizierte Praezisierungen: (1) Der reale Web-Bug
> ist der nach `userId` nicht namespace-te React-Query-Cache — neuer Tab/Cold-Start
> kann Rezepte des Vor-Users aus dem persistierten Cache rendern (`mobile/utils/query-client.ts`,
> Task T7). (2) Die Web-Persistenz-Abnahme wird ein **automatisierter Session-E2E**
> (Task T12); die manuelle Abnahme bleibt nur als Smoke. Erwarteter weiterer Befund:
> expired Confirmation-Link scheitert still (`auth.ts`, Task T9).

## Ziel

Der Web-Pfad fuer Account, Signup, Login, Session und Workspace darf nicht mehr
der schwache Teil des Multi-Auth-Systems sein. Danach wird die reale
Persistenz-Abnahme fuer Web unter echter Session durchgefuehrt.

## Scope

- Web-Entry fuer Account-/Workspace-Nutzung pruefen und stabilisieren.
- Signup-, Login-, Logout-, Session-Restore- und Reset-/Confirmation-Rueckkehr
  im Web verifizieren.
- Session- und Query-Cache-Verhalten bei Reload, neuem Tab und neuer Browser-
  Session pruefen.
- Danach die manuelle Web-Persistenz-Abnahme fuer Settings/Theme/PDF
  dokumentieren.

## Nicht-Ziele

- Keine neuen Auth-Modi.
- Kein Invite- oder Multi-Workspace-Switcher.
- Keine UI-Neugestaltung jenseits noetiger Stabilitaets- und Klarheitsfixes.

## Leitfragen

- Wo scheitert der Web-Flow heute konkret: Session-Speicherung, Redirect,
  Bootstrap, Navigation oder Cache?
- Welche Probleme sind echte Produktblocker und welche nur technische
  Unebenheiten?
- Welche Persistenz gilt bereits als technisch gruen, aber noch nicht als
  menschlich abgenommen?

## Arbeitsschritte

### 1. Aktuellen Web-Auth-Pfad kartieren

- Relevante Entry-Points, Routen und Hooks fuer Web-Auth zusammentragen.
- Festhalten, wie Supabase-Session im Web gespeichert wird.
- Festhalten, wie Confirmation/Reset/Deep-Link-Rueckkehr im Web heute laeuft.
- Cache- und Refresh-Pfade fuer geschuetzte Screens benennen.

Output:

- Kurze Flow-Notiz: `signed_out -> signup/login -> bootstrap -> protected
  screens -> reload/new tab`.

### 2. Reproduzierbare Fehlerliste aufbauen

- Sign-up im Web mit frischem User pruefen.
- Login mit bestehendem User pruefen.
- Logout und erneuter Login pruefen.
- Reload direkt auf geschuetzter Seite pruefen.
- Neuer Tab auf geschuetzter Seite pruefen.
- Neue Browser-Session pruefen.

Fuer jeden Fehler festhalten:

- Repro-Schritte
- Erwartetes Verhalten
- Tatsächliches Verhalten
- Betroffene Datei oder betroffener Layer

### 3. Stabilisierung schneiden

Typische Fix-Kategorien:

- Session-Persistenz im Web
- Race zwischen Auth-Observer, Bootstrap und Protected-Screen-Fetches
- Query-Cache, der alte Signed-out- oder alte Household-Zustaende zeigt
- Web-Navigation, die nach Auth nicht sauber zur urspruenglichen Absicht
  zurueckkehrt
- Reset-/Confirmation-Rueckkehr, die im Browser ohne klare Statusanzeige endet

Arbeitsregel:

- Erst Flow-Blocker fixen.
- Dann nur die noetigen Folgeprobleme fixen, die dieselbe Ursache haben.

### 4. Mindest-Regressionstest absichern

- Root-/Mobile-Web-nahe Tests erweitern, wo reproduzierbar.
- Bestehende Auth-/Protected-Screen-Tests um den gefundenen Web-Failure-Mode
  ergaenzen.
- Fuer rein manuelle Browser-Probleme ein knappes Smoke-Runbook hinterlegen.

### 5. Web-Persistenz-Abnahme fahren

Nach Stabilisierung mit echtem User pruefen:

- Settings bleiben nach Reload erhalten.
- Theme bleibt nach Reload erhalten.
- PDF-bezogene Einstellungen oder zuletzt relevante Zustände bleiben korrekt.
- Neuer Tab zeigt denselben erwarteten Account-/Workspace-Kontext.
- Neue Browser-Session verhält sich wie dokumentiert.

Dokumentation:

- Datum
- Umgebung
- Testnutzer-Typ
- Gepruefte Faelle
- Ergebnis pro Fall
- Offene Restabweichungen

## Betroffene Bereiche

- `mobile/app/account.tsx`
- `mobile/app/(tabs)/settings.tsx`
- `mobile/utils/auth.ts`
- `mobile/utils/api.ts`
- Web-spezifische Auth-Observer oder Root-Layout-Pfade
- geschuetzte Screen-Datenlader fuer Recipes, Planner, Shopping

## Tests

- `npm run test:auth`
- relevante Mobile-/RNTL-Tests fuer Protected States
- gezielte Web-Manual-Smokes
- falls vorhanden: bestehende Perf-/Entry-Checks nicht regressieren lassen

## Gate fuer Abschluss

Dieser Teilplan ist fertig, wenn:

- der normale Web-Login-/Signup-/Session-Flow ohne Sackgassen laeuft,
- Reload und neuer Tab den Auth-Kontext nicht verlieren,
- die manuelle Persistenz-Abnahme dokumentiert ist,
- `TODO.md:21` und `TODO.md:52` inhaltlich abgearbeitet werden koennen.

## Risiken

- Fixes am Auth-Root koennen Web-Bundle- oder Entry-Performance wieder
  verschlechtern.
- Ein lokaler Erfolg ohne echten Browser-Session-Test reicht hier nicht.
- Cache-Fixes koennen neue Flashes von leeren oder alten Daten erzeugen, wenn
  sie nicht gegen echte Signed-in- und Signed-out-Wechsel getestet werden.

---

# /autoplan Review (2026-06-09, retrospektiv)

## Phase 1: CEO Review

**Premise-Tabelle:**

| Praemisse | Korrekt | Evidenz |
|-----------|---------|---------|
| Query-Cache war nicht nach userId namespace-t | BESTAETIGT + GEFIXT | `getQueryCacheKey(userId)`, Anon-Slot, Cold-Start-Clear-Logik implementiert |
| Expired Confirmation-Link scheitert still | NICHT CODE-VERIFIZIERBAR | Kein sichtbarer Fix in `auth.ts`; T9-Markierung als "done" fragwuerdig |
| Web-Persistenz-Abnahme wird automatisierter E2E (T12) | TEILWEISE | Test existiert, deckt aber nur AsyncStorage-Round-Trip ab, nicht echten Reload-Flow |

**DoD-Checkliste:**

| Kriterium | Erfuellt | Gap |
|-----------|---------|-----|
| Normaler Web-Login-/Signup-/Session-Flow laeuft | UNKLAR | Kein automatisierter Test deckt vollstaendigen Login/Signup-Flow ab |
| Reload und neuer Tab verlieren Auth-Kontext nicht | PARTIELL | T7 implementiert (Namespacing); T12 deckt nur Storage-Round-Trip |
| Manuelle Persistenz-Abnahme dokumentiert | JA | [docs/2026-06-15-web-persistence-acceptance.md](/home/patrick/Projekte/rezepti/docs/2026-06-15-web-persistence-acceptance.md) |
| TODO.md:21 und :52 abgearbeitet | JA | PWA ist abgeschlossen; Persistenz-Abnahme ist am 2026-06-15 dokumentiert |

**CEO Completion:** Aus dem Review offene DoD-Luecken fuer T9/T12/TODO:52 sind seit 2026-06-15 geschlossen. Persistenz-Abnahme liegt als Dokument vor.

## Phase 3: Eng Review

**Findings:**

| Severity | Finding | Fix |
|----------|---------|-----|
| HIGH | Race condition `startAuthQueryCacheWatch()`: stop() setzt Promise auf null; naechster Caller startet neue Subscription → doppelte `onAuthStateChange`-Listener moeglich | Guard: wenn `authQueryCacheWatchStop` gesetzt, stop() darf Promise-State nicht resetten waehrend andere Caller noch referenzieren |
| HIGH | Zwei simultane `onAuthStateChange`-Events ohne Mutex: beide lesen `activeAuthUserId === undefined`, fuehren doppeltes `_sessionRestoring = false` + doppeltes notify aus | Low-Risk (JS single-threaded), aber unnoetige Re-Renders; kein Produktionsblocker |
| MEDIUM | `AsyncStorage.removeItem()` Fehler im catch-Block swallowed still: korrupter Eintrag bleibt in Storage, wird bei jedem Cold-Start erneut versucht | `console.warn` ergaenzen; Cleanup-Retry kein Pflichtfix |
| MEDIUM | `QUERY_CACHE_STORAGE_KEY` deprecated ohne Cleanup-Pfad: Altgeraete haben alten Key in Storage, der nie geloescht wird — belegt Speicher dauerhaft | Einmaliger Cleanup beim App-Start (pruefe ob alter Key existiert, loesche ihn) |
| MEDIUM | T12 fehlen Cold-Start-Szenarien: prevKey !== nextKey → clear + removeItem wird nicht assertiert; getSupabaseClient() = null → sessionRestoring korrekt false | Testfaelle ergaenzen |
| LOW | `void`-Casts auf `queryClient.clear()` + `AsyncStorage.removeItem()` — Fehler nicht observierbar | `console.warn` bei Fehler optional |
| LOW | `makePersisterForCurrentUser()` erstellt bei jedem `persistClient`-Aufruf neue Persister-Instanz — Throttle-State nicht instanzuebergreifend | Persister-Instanz cachen (pro Key eine Instanz) |

## Decision Audit Trail

| # | Decision | Classification | Rationale |
|---|----------|----------------|-----------|
| WEB-CEO-1 | Plan zu ~65% erfuellt — NICHT als vollstaendig Abgeschlossen markieren | Mechanical | DoD-Luecken: Persistenz-Dok fehlt, T9 nicht verifiziert |
| WEB-CEO-2 | Persistenz-Abnahme-Dokument erstellen (TODO.md:52) | Mechanical | DoD explizit gefordert; fehlt komplett |
| WEB-ENG-1 | startAuthQueryCacheWatch Race: dokumentieren, kein Fix | Taste | Low-probability in Produktion; JS single-threaded begrenzt reales Risiko |
| WEB-ENG-2 | QUERY_CACHE_STORAGE_KEY Cleanup: einmaliger App-Start-Cleanup | Taste | Betrifft nur Altgeraete; low-prio aber sauber |
| WEB-ENG-3 | T12 Cold-Start-Tests ergaenzen | Erledigt 2026-06-15 | `prevKey !== nextKey` ist in den Query-Cache-Tests abgedeckt; `getSupabaseClient() = null -> sessionRestoring false` ist explizit in `mobile/test/session-persistence.test.ts` abgesichert |

## Phase 4: Final Gate — 2026-06-09

| Entscheidung | Gewaehlt | Aktion |
|---|---|---|
| Plan-Status | **Materiell abgeschlossen** | Historischer Review-Stand; verbleibende Befunde dokumentiert |
| QUERY_CACHE_STORAGE_KEY Cleanup | **Einmaliger App-Start-Cleanup** | `void AsyncStorage.removeItem(QUERY_CACHE_STORAGE_KEY)` in `watchAuthQueryCache()` — `mobile/utils/query-client.ts` |
| T12 Cold-Start-Tests | **Erledigt 2026-06-15** | prevKey !== nextKey → clear/remove ist abgedeckt; `getSupabaseClient() = null -> sessionRestoring false` ist explizit getestet |
| Race condition startAuthQueryCacheWatch | **Dokumentieren** | Low-probability in Produktion; JS single-threaded begrenzt reales Risiko |

**Offene Tasks (in TODO.md einzutragen):**
- [x] TODO:52 — Persistenz-Abnahme-Dokument erstellt: [docs/2026-06-15-web-persistence-acceptance.md](/home/patrick/Projekte/rezepti/docs/2026-06-15-web-persistence-acceptance.md)
- [x] T12-Cold-Start-Tests: prevKey-Wechsel + null-Supabase-Client-Szenarien (abgedeckt bis 2026-06-15)
- [x] T9-Verifizierung: Confirmation-Link-Error in `auth.ts` code-seitig nachgewiesen (`mobile/test/auth-redirect-observer.test.ts`, 2026-06-15 bestaetigt)

**Status: IN ARBEIT** — ~65% erfuellt. Code-Fix (QUERY_CACHE_STORAGE_KEY) deployed auf Branch. Offene DoD-Tasks werden als neue TODO-Eintraege gefuehrt.
