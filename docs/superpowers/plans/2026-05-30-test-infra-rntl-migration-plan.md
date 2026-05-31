<!-- /autoplan restore point: /home/patrick/.gstack/projects/dacown87-rezepti/main-autoplan-restore-20260530-220619.md -->
# Test-Infra RNTL Migration Plan (2026-05-30)

Status: Reviewed with changes via `/autoplan` am 2026-05-30.

## Ziel

Die Mobile-UI-nahen Tests sollen schrittweise von direkter `react-test-renderer`-Tree-Inspektion auf die `@testing-library/react-native`-API migriert werden.

Langfristiges Ziel:

- Tests pruefen sichtbares Verhalten und Nutzerinteraktionen statt interne Render-Tree-Struktur.
- `react-test-renderer` verschwindet aus direkten Testdatei-Imports. Die Package-Dependency darf bleiben, solange `@testing-library/react-native` sie als Peer/Runtime-Dependency braucht.
- Der lokale Compat-Layer `mobile/test/testing-library-rn-compat.ts` wird entfernt.
- `@testing-library/react-native` laeuft unter Vitest ohne Alias auf den Compat-Layer.

## Aktueller Stand

Bereits erledigt:

- `mobile/test/recipe-list-screen-fallbacks.test.tsx` importiert und nutzt `@testing-library/react-native`.
- `mobile/test/recipe-detail-fallbacks.test.tsx` importiert und nutzt `@testing-library/react-native`.
- Direkte `react-test-renderer`-Imports sind aus diesen beiden Dateien entfernt.
- Der lokale Compat-Layer kapselt `react-test-renderer` weiterhin als Uebergangsbruecke.
- Verifikation nach erstem Slice:
  - `npm --prefix mobile run typecheck`
  - `npm --prefix mobile run test:unit` (`87 passed`)

Noch offen:

- `mobile/test/shopping-screen-fallbacks.test.tsx`
- `mobile/test/mobile-workflow-list-detail-shopping-ui.test.tsx`
- `mobile/test/planner-screen-fallbacks.test.tsx`
- Vitest/RN-Transform-Blocker fuer echte RNTL-Laufzeit
- Entfernung aller compat-only API-Nutzung aus bereits migrierten Tests (`renderAsync`, string-basierte `UNSAFE_queryAllByType`-Hosttyp-Suchen)
- Entfernung von `mobile/test/testing-library-rn-compat.ts`
- Entfernung direkter `react-test-renderer`-Imports aus dem Mobile-Testpfad; Entfernung der Dependency nur, wenn `npm ls @testing-library/react-native react-test-renderer` beweist, dass sie nicht mehr benoetigt wird.

## Nicht-Ziele

- Keine Produkt-UI-Aenderungen nur fuer Tests.
- Kein Expo-SDK-Upgrade in diesem Track.
- Keine gleichzeitige NativeWind-/Styling-Migration.
- Keine grossen Screen-Refactors, ausser eine sehr kleine Testbarkeitsergaenzung ist nachweislich notwendig.
- Kein Blindwechsel auf Jest. Ziel bleibt Vitest, solange der Runtime-Blocker loesbar ist.

## Leitplanken

- Jeder Slice muss Mobile-Typecheck und Mobile-Unit-Tests gruen halten.
- Tests duerfen waehrend der Uebergangsphase weiter ueber `@testing-library/react-native` importieren, auch wenn dieser Import per Alias auf den Compat-Layer zeigt.
- Neue Tests duerfen keine direkten `react-test-renderer`-Imports mehr einfuehren; das wird per Guard-Command geprueft.
- Der Compat-Layer ist eingefroren: keine neuen Exports ausser den explizit geplanten Shopping-Events (`changeText`, `submitEditing`) und nur, wenn sie RNTL-Semantik nachbilden.
- Query-Reihenfolge ist verbindlich: sichtbarer Text oder Placeholder zuerst, dann Accessibility-Label/-Role, dann semantisches `testID`, zuletzt `UNSAFE_*` nur mit Begruendung im Test.
- Keine neuen `className`-, `hitSlop`- oder Icon-Struktur-Selektoren.
- Wenn eine Komponente keine robuste Nutzer-Query erlaubt, bevorzugt kleine Accessibility-/TestID-Ergaenzung statt tiefer Tree-Inspektion.

## Vorgehen

### Phase 0: Inventory, Guardrails und Runtime-Blocker dokumentieren

Ziel: Der aktuelle Zustand ist vollstaendig inventarisiert, Backsliding ist blockiert, und der Grund fuer den Compat-Layer ist reproduzierbar.

Aufgaben:

1. Vollstaendiges Inventory erfassen:
   - Direkte `react-test-renderer`-Imports.
   - Alle `@testing-library/react-native`-Consumer, inklusive `mobile/components/__tests__/StyledText-test.js`.
   - Alle Compat-only API-Nutzungen (`renderAsync`, string-basierte `UNSAFE_queryAllByType`-Hosttyp-Suchen).
2. Guard-Command als verbindlichen Preflight definieren und spaeter in CI oder `test:unit`-Preflight einhaengen:
   ```bash
   rg "from 'react-test-renderer'|from \"react-test-renderer\"" mobile/test mobile/components --glob '*.{test,spec}.{ts,tsx,js,jsx}' --glob '!mobile/test/testing-library-rn-compat.ts'
   ```
   Erwartung bis Abschluss: nur die noch offenen Altdateien duerfen matchen; nach Abschluss kein Match.
3. Kurztest ohne `@testing-library/react-native`-Alias in `mobile/vitest.config.ts` lokal reproduzieren.
4. Exakte Fehlermeldung dokumentieren: echte RNTL importiert React Native, Vitest stoesst auf untranspilierten Flow-Import (`import typeof`).
5. Die `react-native`-Alias-/Mock-Frage explizit erfassen. `mobile/vitest.config.ts` aliasiert aktuell `react-native` auf `mobile/test/react-native-shim.ts`; echte RNTL ist erst bewiesen, wenn auch diese Runtime-Entscheidung absichtlich getroffen wurde.
6. Kandidaten fuer Fixpfade festhalten:
   - Vite/Vitest-Transform fuer `react-native` und betroffene RN-Dependencies.
   - zentraler RN-Mock, der mit echter RNTL kompatibel ist.
   - separates Test-Environment oder Prebundle-Regel.
   - falls Vitest dauerhaft ungeeignet: spaeterer Jest-Track als explizite Entscheidung, nicht als Nebenprodukt.
7. Kurze Test-Autoren-Checkliste anlegen:
   - kanonische Imports,
   - Query-Reihenfolge,
   - Async-Regel (`waitFor` statt manueller Promise-Flush-Loops),
   - Mock-Ownership (`mobile/test/setup.ts` vs. testlokale Mocks),
   - erlaubte und verbotene Compat-APIs.

Exit-Kriterium:

- Ein Planleser kann den Blocker reproduzieren oder anhand der Doku verstehen, warum die Alias-Kombination noch existiert.
- Ein Guard-Command verhindert neue direkte `react-test-renderer`-Imports.
- Das Inventory umfasst alle Mobile-Test-Consumer, nicht nur `mobile/test`.

### Phase 1: Real-RNTL Spike und Entscheidungsgate

Ziel: Vor weiteren File-Migrationen klaeren, ob der restliche Umbau direkt gegen echte RNTL laufen kann oder ob der Compat-Pfad bewusst begrenzt bleibt.

Aufgaben:

1. Einen minimalen Smoke-Test gegen echte `@testing-library/react-native` versuchen:
   - `@testing-library/react-native`-Alias entfernen.
   - TypeScript-Path-Alias entfernen.
   - `react-native`-Resolution bewusst waehlen: echter RN-Transform, zentraler RNTL-kompatibler RN-Mock oder dokumentierter Abbruch.
2. Ergebnis dokumentieren:
   - **Gate A: Runtime-Fix klein und lokal** -> Runtime-Fix zuerst umsetzen, danach File-Migrationen direkt gegen echte RNTL fortsetzen.
   - **Gate B: Runtime-Fix gross/unsicher** -> Compat-Layer eingefroren lassen, File-Migrationen nur innerhalb des dokumentierten API-Subsets fortsetzen, separaten Runtime-Track anlegen.
   - **Gate C: Vitest ungeeignet** -> keinen heimlichen Jest-Wechsel; separaten Jest-Plan schreiben.

Exit-Kriterium:

- Eine ausdrueckliche Gate-Entscheidung steht im Plan oder in einer verlinkten Notiz.
- Es ist klar, ob Phase 2-4 gegen echte RNTL oder gegen den eingefrorenen Compat-Layer laufen.

### Phase 2: Shopping-Fallbacktests migrieren

Datei:

- `mobile/test/shopping-screen-fallbacks.test.tsx`

Warum zuerst:

- Mehr Interaktion als Recipe List/Detail, aber noch klar auf einen Screen begrenzt.
- Gute Bruecke fuer `TextInput`, Retry, Toggle und Offline-Recovery.

Aufgaben:

1. Direkte `react-test-renderer`-Imports entfernen.
2. `render`, `screen`, `fireEvent`, `waitFor` aus `@testing-library/react-native` nutzen.
3. Tree-Suchen nach Text durch `screen.getByText` / `screen.queryByText` ersetzen.
4. Direkte `onPress`-Aufrufe durch `fireEvent.press` ersetzen.
5. `TextInput`-Interaktionen ueber `fireEvent.changeText` und Submit-Event abbilden. Falls Gate B aktiv ist, darf der Compat-Layer genau fuer `changeText` und `submitEditing` erweitert werden.
6. Refresh-Control explizit abdecken; wenn echte RNTL keinen guten High-Level-Pfad bietet, den aktuellen Handlerzugriff als begruendete Ausnahme isolieren.
7. Nach async Render/Event keine manuellen `Promise.resolve()`-Loops mehr in migrierten Tests; stattdessen `waitFor`.

Exit-Kriterium:

- `shopping-screen-fallbacks.test.tsx` hat keinen direkten `react-test-renderer`-Import mehr.
- Fokustest und komplette Mobile-Suite sind gruen.
- Der Guard-Command zeigt keinen neuen Backslide.

Verifikation:

```bash
npm --prefix mobile run typecheck
npm --prefix mobile run test:unit -- test/shopping-screen-fallbacks.test.tsx
npm --prefix mobile run test:unit
```

### Phase 3: Workflow-UI-Test migrieren

Datei:

- `mobile/test/mobile-workflow-list-detail-shopping-ui.test.tsx`

Warum vor Planner:

- Der Test ist nutzernaeher und linearer: Liste -> Detail -> Shopping.
- Er zeigt, ob die neuen Query-/Event-Patterns ueber Screen-Grenzen funktionieren.

Aufgaben:

1. Direkte `react-test-renderer`-Imports entfernen.
2. Navigations- und Press-Flows ueber Testing-Library-API ausdruecken.
3. Strukturchecks auf sichtbare Nutzerzustaende umstellen.
4. Bei Async-Flows konsequent `waitFor` nutzen.
5. Den Test korrekt klassifizieren:
   - Wenn er weiter List und Detail getrennt mountet, heisst er Two-Step-Smoke und behauptet keinen echten Router-Tree.
   - Wenn er echter Cross-Screen-Smoke bleiben soll, einen minimalen Router-Harness einplanen.

Exit-Kriterium:

- Workflow-Test hat keinen direkten `react-test-renderer`-Import mehr.
- Test ist entweder ehrlich als Two-Step-Smoke dokumentiert oder nutzt einen Router-Harness fuer einen echten list -> detail -> shopping Flow.

Verifikation:

```bash
npm --prefix mobile run typecheck
npm --prefix mobile run test:unit -- test/mobile-workflow-list-detail-shopping-ui.test.tsx
npm --prefix mobile run test:unit
```

### Phase 4: Planner-Fallbacktests in kleinere Slices migrieren

Datei:

- `mobile/test/planner-screen-fallbacks.test.tsx`

Warum zuletzt:

- Groesster Blast Radius im verbleibenden Set.
- Kombiniert Week-Load, Picker, QR-Scanner-Mock, Add/Remove-Retry, Shopping-Aggregation und mehrere Fehlerzustaende.

Aufgaben:

1. Vor der Migration eine Selector-/Testability-Inventur schreiben:
   - Day-Add-Aktionen,
   - Remove-Aktion,
   - Retry-Aktionen,
   - Recipe-Picker-Optionen,
   - Scanner-Trigger,
   - QR-Scanner-Mock.
2. Kleine semantische Labels oder TestIDs nur dort ergaenzen, wo der Nutzerzustand sonst nicht stabil abfragbar ist.
3. Datei in Slices migrieren:
   - Loading/empty/load-error.
   - QR-Fehlerpfad.
   - Shopping-Aggregation und Retry.
   - Recipe-Picker-Load-Error.
   - Add-Mutation-Retry.
   - Remove-Mutation-Retry.
4. Direkte `react-test-renderer`-Imports erst entfernen, wenn alle Slices in der Datei auf RNTL-/Compat-API laufen.
5. Bestehende Fehler- und Retry-Assertions erhalten; keine Abdeckung fuer QR-Fehler, Add-Retry, Remove-Retry oder Picker-Error verlieren.

Exit-Kriterium:

- Planner-Fallbacktests haben keinen direkten `react-test-renderer`-Import mehr.
- Keine Abdeckung fuer QR-Fehler, Add-Retry, Remove-Retry oder Picker-Error geht verloren.
- Keine neuen `className.includes(...)`- oder `hitSlop`-Selektoren bleiben als Migrationsmuster uebrig.

Verifikation:

```bash
npm --prefix mobile run typecheck
npm --prefix mobile run test:unit -- test/planner-screen-fallbacks.test.tsx
npm --prefix mobile run test:unit
```

### Phase 5: Compat-only API aus allen migrierten Tests entfernen

Dateien:

- `mobile/test/recipe-list-screen-fallbacks.test.tsx`
- `mobile/test/recipe-detail-fallbacks.test.tsx`
- alle in Phase 2-4 migrierten Tests

Aufgaben:

1. `renderAsync` entfernen und durch `render` + `waitFor` ersetzen.
2. String-basierte Hosttyp-Suchen ueber `UNSAFE_queryAllByType('Pressable')`, `UNSAFE_queryAllByType('ActivityIndicator')` usw. entfernen oder als klar begruendete Ausnahme markieren.
3. Imports aus `@testing-library/react-native` gegen echte RNTL-Exports abgleichen.
4. `rg "renderAsync|UNSAFE_queryAllByType\\('" mobile/test mobile/components` als Abschlusscheck nutzen.

Exit-Kriterium:

- Migrierte Tests verwenden keine projektspezifischen RNTL-Schattenexports mehr.
- Ein Wechsel auf echte RNTL scheitert nicht mehr an `renderAsync` oder stringbasierter `UNSAFE_queryAllByType`-Signatur.

### Phase 6: Echte RNTL-Laufzeit aktivieren

Dateien:

- `mobile/vitest.config.ts`
- `mobile/tsconfig.json`
- `mobile/test/setup.ts`
- ggf. neue kleine Test-Setup-Helfer unter `mobile/test/`

Aufgaben:

1. Alias von `@testing-library/react-native` auf `mobile/test/testing-library-rn-compat.ts` testweise entfernen.
2. TypeScript-Path-Alias ebenfalls entfernen.
3. `react-native`-Alias und `mobile/test/setup.ts`-Mocks bewusst behandeln:
   - echter RN-Transform,
   - oder zentraler RNTL-kompatibler RN-Mock,
   - oder dokumentierter Abbruch in separaten Runtime-Track.
4. Alle Mobile-Tests gegen echte RNTL ausfuehren.
5. Falls der Fix zu breit wird, explizit abbrechen, Migration einfrieren und separaten Runtime-Plan schreiben.

Exit-Kriterium:

- `@testing-library/react-native` resolved auf das echte Package.
- `npm --prefix mobile run typecheck` ist gruen.
- `npm --prefix mobile run test:unit` ist gruen.
- Bei Aenderungen an RN-/Expo-/Transform-Setup: `cd mobile && CI=1 npx expo-doctor` ist gruen.

### Phase 7: Compat-Layer entfernen und Dependency-Status klaeren

Dateien:

- `mobile/test/testing-library-rn-compat.ts`
- `mobile/vitest.config.ts`
- `mobile/tsconfig.json`
- `mobile/package.json`
- `mobile/package-lock.json`

Aufgaben:

1. `mobile/test/testing-library-rn-compat.ts` entfernen.
2. Verbleibende `react-test-renderer`-Imports suchen und entfernen.
3. Dependency pruefen:
   ```bash
   npm --prefix mobile ls @testing-library/react-native react-test-renderer
   ```
   `react-test-renderer` bleibt als alignte DevDependency, wenn RNTL es weiter braucht.
4. Lockfile aktualisieren.
5. Doku und TODO auf abgeschlossen setzen.

Exit-Kriterium:

- `rg "from 'react-test-renderer'|from \"react-test-renderer\"" mobile/test mobile/components --glob '*.{test,spec}.{ts,tsx,js,jsx}'` findet keine aktive direkte Testnutzung mehr.
- `rg "testing-library-rn-compat|renderAsync|UNSAFE_queryAllByType\\('" mobile/test mobile/components mobile/vitest.config.ts mobile/tsconfig.json` findet keine aktive Compat-Nutzung mehr.
- `npm --prefix mobile ci` ist gruen.
- `npm --prefix mobile run typecheck` ist gruen.
- `npm --prefix mobile run test:unit` ist gruen.
- `cd mobile && CI=1 npx expo-doctor` ist gruen, falls Dependency-/Transform-Setup geaendert wurde.

## Risiken und Gegenmassnahmen

| Risiko | Auswirkung | Gegenmassnahme |
| --- | --- | --- |
| Echte RNTL bleibt unter Vitest blockiert | Compat-Layer kann nicht entfernt werden | Phase 1 als harte Gate-Entscheidung; bei grossem Fix separaten Runtime-Track schreiben |
| `react-native`-Alias macht Fake-Erfolg moeglich | Tests laufen, aber nicht gegen realistische RNTL/RN-Resolution | Phase 1 und Phase 6 behandeln `react-native`-Alias und Setup-Mocks explizit |
| Compat-Layer wird zur dauerhaften Schattenbibliothek | Neue Tests lernen falsche API und machen den spaeteren Wechsel teurer | Compat API einfrieren, Test-Autoren-Checkliste schreiben, compat-only API vor Phase 6 entfernen |
| Tests werden durch `UNSAFE_queryAllByType` nur scheinbar besser | Migration bleibt strukturell fragil | Sichtbare Queries und Accessibility bevorzugen; compat-only `UNSAFE_*` vor echter RNTL entfernen |
| Planner-Migration wird zu gross | Lange rote Phase, schwer reviewbar | Planner zuletzt und in explizite Slices teilen |
| Accessibility-/TestID-Ergaenzungen veraendern Produktcode | Unnoetiger Produkt-Diff | Nur kleine, semantisch sinnvolle Labels/TestIDs; keine UI-Logik aendern |
| Entfernen von `react-test-renderer` kollidiert mit RNTL-Peer-Dependency | Lockfile-/Toolchain-Risiko | Direkte Imports entfernen; Package nur entfernen, wenn `npm ls` beweist, dass es unbenoetigt ist |

## Akzeptanzkriterien Gesamt

- Keine direkte `react-test-renderer`-Nutzung mehr in Mobile-Testdateien unter `mobile/test` und `mobile/components/**/__tests__`.
- `@testing-library/react-native` wird nicht mehr auf den Compat-Layer aliasiert.
- Der Compat-Layer ist entfernt.
- Keine compat-only API-Nutzung (`renderAsync`, projektspezifische stringbasierte `UNSAFE_queryAllByType`-Signaturen) bleibt in Tests.
- Mobile-Typecheck ist gruen.
- Mobile-Unit-Suite ist gruen.
- Expo Doctor ist gruen, falls Runtime-/Dependency-Setup geaendert wurde.
- TODO und Test-Status-Doku spiegeln den Abschluss.

## Review-Plan

Dieser Plan wurde am 2026-05-30 mit `/autoplan` reviewed. Die Review hat mehrere High-Findings in den Plan eingearbeitet:

- Runtime-Proof vor weiteren Migrationen.
- `react-native`-Alias/Mokes explizit in die Runtime-Entscheidung aufnehmen.
- Compat-Layer einfrieren und compat-only API vor echter RNTL entfernen.
- Guard gegen neue direkte `react-test-renderer`-Imports.
- Vollstaendiges Inventory aller Mobile-Test-Consumer.
- Planner in kleinere Slices teilen.

Noch sinnvoll vor Umsetzung der naechsten Code-Slices:

1. Engineering-Review gegen Scope und Reihenfolge:
   - Ist Shopping -> Workflow -> Planner die richtige Reihenfolge?
   - Sind die Exit-Kriterien eng genug?
   - Ist Phase 4 bewusst genug vom Testdatei-Umbau getrennt?
2. Test-Infra-Review gegen Runtime-Blocker:
   - Ist Vitest weiter die richtige Zielumgebung?
   - Gibt es einen kleineren Transform-Fix fuer echte RNTL?
   - Muss Jest als separater Fallback-Track ernsthaft bewertet werden?
3. Nach Phase 1 Gate-Entscheidung Plan erneut kurz aktualisieren.

## Naechster Schritt

Phase 0 dokumentieren, Phase 1 Real-RNTL-Spike ausfuehren und erst danach `shopping-screen-fallbacks` als naechsten kleinen Code-Slice umsetzen.

## GSTACK REVIEW REPORT

### /autoplan Summary

Review-Status: **Reviewed with changes**.

UI scope: skipped als Produkt-Design-Review. Der Plan betrifft Test-Infrastruktur, nicht sichtbare UI-Gestaltung.

DX scope: ja. Der Plan beeinflusst Test-Autoren, lokale Commands, CI-Gates und kuenftige Migrationsergonomie.

### CEO Review

Premises:

| Premise | Bewertung | Entscheidung |
| --- | --- | --- |
| Ziel ist Verhaltenstests statt Tree-Inspektion | Gueltig | Beibehalten |
| File-by-file-Migration reicht als Hauptpfad | Zu schwach | Runtime-Gate vorziehen |
| `react-test-renderer` kann komplett entfernt werden | Teilweise falsch | Direkte Imports entfernen; Dependency nur bei belegter Entbehrlichkeit entfernen |

Existing leverage:

| Subproblem | Vorhandene Basis |
| --- | --- |
| Mobile-Test-Runner | `mobile/vitest.config.ts`, `mobile/test/setup.ts` |
| RNTL-Uebergang | `mobile/test/testing-library-rn-compat.ts` |
| Bereits migrierte Tests | `recipe-list-screen-fallbacks`, `recipe-detail-fallbacks` |
| Noch direkte Renderer-Nutzung | Shopping, Planner, Workflow |

Dream state:

```text
CURRENT
  RNTL importiert teilweise, aber per Alias auf Compat-Layer.
  Drei Testdateien nutzen noch direkt react-test-renderer.
  Bereits migrierte Tests nutzen noch compat-only API.

THIS PLAN AFTER REVIEW
  Runtime-Gate zuerst.
  Guardrails gegen Backsliding.
  File-Migration in kleinen Slices.
  Compat-only API wird vor echter RNTL entfernt.

12-MONTH IDEAL
  Echte RNTL unter Vitest oder bewusst dokumentierter alternativer Runner.
  Keine Testdatei kennt react-test-renderer direkt.
  Neue Mobile-Tests folgen einer klaren Authoring-Checkliste.
```

CEO dual voices consensus:

| Dimension | Subagent | Codex | Consensus |
| --- | --- | --- | --- |
| Premises valid? | Teilweise | Teilweise | Confirmed: Runtime-Premise war zu schwach |
| Right problem? | Ja | Ja | Confirmed |
| Scope calibration? | Zu eng | Zu eng | Confirmed |
| Alternatives explored? | Zu wenig Runtime-Alternativen | Zu wenig Runtime-Alternativen | Confirmed |
| 6-month trajectory? | Risiko Schattenbibliothek | Risiko Schattenbibliothek | Confirmed |

CEO outcome: Plan bleibt strategisch richtig, aber nur mit Runtime-Gate und Compat-Freeze.

### Design Review

Skipped. Keine produktseitige UI-/Visual-Design-Aenderung. Die im Plan erwaehnten Screens sind Testziele, nicht neue Nutzeroberflaechen.

### Engineering Review

Architecture diagram:

```text
mobile tests
  -> import @testing-library/react-native
    -> current alias: mobile/test/testing-library-rn-compat.ts
      -> react-test-renderer
  -> app screens/components
    -> react-native
      -> current alias: mobile/test/react-native-shim.ts
        -> react-native-web

target
  mobile tests
    -> real @testing-library/react-native
      -> explicit RN test runtime decision
```

Findings:

| Severity | Finding | Plan change |
| --- | --- | --- |
| High | Phase 4 war zu spaet; echte RNTL muss frueher bewiesen oder bewusst verschoben werden | Phase 1 Real-RNTL Spike und Gate eingefuehrt |
| High | `react-native`-Alias/Mokes waren nicht Teil der Runtime-Entscheidung | Phase 1 und Phase 6 erweitert |
| High | Abschluss-Greps waren zu eng und uebersahen `mobile/components/__tests__` | Inventory und Acceptance Criteria erweitert |
| High | Kein Guard gegen neue direkte Renderer-Imports | Guard-Command in Phase 0 eingefuehrt |
| Medium | Bereits migrierte Tests nutzen compat-only API | Neue Phase 5 eingefuehrt |
| Medium | Shopping braucht `changeText`/Submit-Event im Compat-Layer | Phase 2 explizit gemacht |
| Medium | Workflow-Test ist eher Two-Step-Smoke als echter Router-Flow | Phase 3 reklassifiziert oder Router-Harness gefordert |
| Medium | Planner ist zu gross fuer einen Slice | Phase 4 in kleinere Slices geteilt |

Test diagram:

| Codepath / UX flow | Existing coverage | Plan requirement |
| --- | --- | --- |
| Recipe List loading/error/offline | Migriert, aber noch `UNSAFE_queryAllByType` | Compat-only API entfernen |
| Recipe Detail skeleton/loading/not-found/retry | Migriert, aber `renderAsync`/`UNSAFE` | `render` + `waitFor`, echte RNTL-Exports |
| Shopping loading/error/manual add/toggle/refresh | Direkt `react-test-renderer` | Phase 2 migrieren, `changeText`/submit/refresh abdecken |
| Workflow list -> detail -> shopping | Direkt `react-test-renderer`, getrennte Mounts | Phase 3 migrieren und korrekt klassifizieren |
| Planner loading/empty/QR/picker/add/remove/shopping retry | Direkt `react-test-renderer`, viele Strukturselektoren | Phase 4 in Slices + Selector-Inventur |
| Runtime switch to real RNTL | Nicht geloest | Phase 1 Spike, Phase 6 Aktivierung |

Failure Modes Registry:

| Failure mode | Severity | Mitigation |
| --- | --- | --- |
| Compat-Layer wird dauerhaft | High | API einfrieren, Phase 5 compat-only API entfernen |
| Real-RNTL scheitert spaet | High | Phase 1 Gate vor File-Migration |
| Backsliding durch kopierte alte Tests | High | Guard-Command und spaeter CI-Preflight |
| Planner bleibt halb migriert | Medium | Slices statt Big-Bang |
| Dependency-Removal bricht RNTL peer | Medium | `npm ls` vor Package-Removal |

### DX Review

DX score: 7/10 nach Plan-Aenderungen. Vor Review lag der Plan bei ca. 5/10, weil Guardrails und Autoren-Checkliste fehlten.

Developer journey:

| Stage | Erwartung |
| --- | --- |
| Find plan | TODO verlinkt auf diesen Plan |
| Understand current state | Inventory in Phase 0 |
| Add/migrate test | Authoring-Checkliste nutzen |
| Avoid backslide | Guard-Command laufen lassen |
| Debug runtime blocker | Canonical repro + erwarteter Fehler |
| Verify slice | Fokus-Test, Typecheck, komplette Mobile-Suite |
| Finish migration | Compat-only API-Grep, Alias removal, package check |

DX findings:

| Severity | Finding | Plan change |
| --- | --- | --- |
| High | Kein harter Guard gegen neue Renderer-Imports | Guard-Command in Phase 0 |
| High | Kein kanonischer Runtime-Repro | Phase 0 erweitert |
| Medium | Keine Test-Autoren-Checkliste | Phase 0 erweitert |
| Medium | Unklarer Freeze-/Runtime-Entscheidungspunkt | Phase 1 Gate und Phase 6 Abbruchregel |

### Cross-Phase Themes

**Theme: Runtime first** — alle Stimmen haben markiert, dass der echte RNTL/RN-Pfad vor oder sehr frueh in der Migration entschieden werden muss.

**Theme: Compat-Layer risk** — alle Stimmen sehen die Gefahr einer dauerhaften Schatten-Testbibliothek.

**Theme: Scope inventory** — mehrere Stimmen haben darauf hingewiesen, dass Abschlusskriterien alle Mobile-Test-Consumer einschliessen muessen.

### Decision Audit Trail

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|---|---|---|---|---|---|
| 1 | CEO | Plan bleibt eigener Test-Infra-Track, nicht Multi-User-Block | Mechanical | Pragmatic | Migration ist wichtig, aber nicht fachlich Teil von Auth/RLS | In Multi-User Login mischen |
| 2 | CEO/Eng | Runtime-Gate vor weitere File-Migration ziehen | Mechanical | Completeness | Verhindert spaete Erkenntnis, dass Compat-API nicht RNTL-kompatibel ist | Drei Dateien weiter blind migrieren |
| 3 | Eng | `react-native`-Alias/Mokes explizit pruefen | Mechanical | Explicit over clever | Nur RNTL-Alias zu entfernen beweist keine echte Runtime | Nur `@testing-library/react-native`-Alias betrachten |
| 4 | Eng | `react-test-renderer`-Dependency nicht pauschal entfernen | Mechanical | Pragmatic | RNTL braucht sie weiter als Peer/Runtime-Abhaengigkeit | Package-Removal als fixes Ziel |
| 5 | Eng/DX | Compat-Layer einfrieren und compat-only API spaeter entfernen | Mechanical | DRY | Verhindert eine zweite hausgemachte Testing-Library | Compat-Layer beliebig erweitern |
| 6 | DX | Guard gegen neue direkte Renderer-Imports einfuehren | Mechanical | Bias toward action | Ein schneller Grep verhindert Backsliding mit niedrigen Kosten | Nur Leitplanke im Text |
| 7 | Eng | Planner in kleinere Slices teilen | Mechanical | Pragmatic | Reduziert rote Zwischenzustaende und Review-Risiko | Planner-Datei als Big-Bang migrieren |

### Implementation Tasks

- [ ] **P1 — Runtime Gate**: Phase 0 Inventory und Phase 1 Real-RNTL Spike ausfuehren.
- [ ] **P1 — Guardrail**: direkten `react-test-renderer`-Import-Guard als Script oder CI-Preflight einhaengen.
- [ ] **P1 — Compat Cleanup Prep**: `renderAsync` und compat-only `UNSAFE_queryAllByType` aus bereits migrierten Tests entfernen.
- [ ] **P2 — Shopping Slice**: `shopping-screen-fallbacks` mit `changeText`, submit und refresh migrieren.
- [ ] **P2 — Workflow Slice**: Workflow-Test migrieren und als Two-Step-Smoke oder echter Router-Harness klassifizieren.
- [ ] **P2 — Planner Slices**: Planner in den sechs benannten Slices migrieren.

### Final Gate

Keine User Challenges. Alle Review-Stimmen bestaetigen die Richtung, aber mit zwingenden Plan-Korrekturen. Taste Decisions: keine offenen; die Aenderungen sind technische Guardrails, keine Geschmacksfragen.
