# RNTL Migration Phase 0 Inventory

Stand: 2026-05-31

## Ergebnis

Phase 0 ist inventarisiert und der Runtime-Follow-up vom 2026-05-31 ist abgeschlossen. Echte `@testing-library/react-native` laeuft unter Vitest, weil der RNTL-Import gezielt optimiert wird und `react-native` weiter auf den lokalen Test-Shim zeigt. Der alte Compat-Layer ist entfernt; aktiv bleibt nur ein duennes Real-RNTL-Modul fuer den live weitergereichten `screen`-Export und Uebergangstypen.

## Direkte `react-test-renderer`-Imports

Aktive Altdateien: keine.

Bewusste Infrastruktur-Ausnahme: keine direkte `react-test-renderer`-Ausnahme mehr.

Migriert nach Phase 0/1:

- `mobile/test/recipe-detail-fallbacks.test.tsx`
- `mobile/test/recipe-list-screen-fallbacks.test.tsx`
- `mobile/test/shopping-screen-fallbacks.test.tsx`
- `mobile/test/mobile-workflow-list-detail-shopping-ui.test.tsx`
- `mobile/test/planner-screen-fallbacks.test.tsx`

## `@testing-library/react-native`-Consumer

- `mobile/test/recipe-detail-fallbacks.test.tsx`
- `mobile/test/recipe-list-screen-fallbacks.test.tsx`
- `mobile/test/shopping-screen-fallbacks.test.tsx`
- `mobile/test/mobile-workflow-list-detail-shopping-ui.test.tsx`
- `mobile/test/planner-screen-fallbacks.test.tsx`
- `mobile/components/__tests__/StyledText-test.js`
- `mobile/test/testing-library-rn-real.ts`

## Compat-only API-Nutzung

- `renderAsync`: keine aktive Nutzung mehr in Mobile-Testdateien.
- string-basierte `UNSAFE_queryAllByType(...)`: keine aktive Nutzung mehr in den migrierten Mobile-Testdateien.

Abgebaut am 2026-05-31:

- Loading-/Skeleton-Pruefungen laufen ueber sichtbare Skeleton-`testID`s oder konkrete Lade-`testID`s.
- Header-/Remove-/Add-Aktionen laufen ueber Accessibility-Labels oder gezielte `testID`s.
- Workflow-Rezeptkarten laufen ueber stabile `recipe-card-*`-`testID`s.
- RefreshControl-Testzugriff wird ueber die lokale FlatList-Testshim-Oberflaeche statt Hosttyp-Inspektion ausgeloest.

## Runtime-Spike

Aktuelle Alias-Lage:

- `mobile/vitest.config.ts` aliasiert `@testing-library/react-native` exakt auf `mobile/test/testing-library-rn-real.ts`.
- `mobile/tsconfig.json` spiegelt diesen Alias fuer den Typchecker.
- `mobile/vitest.config.ts` aliasiert `react-native` auf `mobile/test/react-native-shim.ts`.
- `mobile/vitest.config.ts` aktiviert den SSR-Optimizer gezielt fuer `@testing-library/react-native`, damit der echte RNTL/RN-Importpfad nicht roh am Flow-Entrypoint scheitert.
- `mobile/test/setup.ts` mockt Router, AsyncStorage, Reanimated und Safe-Area, aber nicht RNTL selbst.

Reproduktion:

- Mit dem alten Compat-Alias lief der fokussierte Detail-Test gruen.
- Ohne RNTL-Optimizer brach der Suite-Start vor Testausfuehrung mit `SyntaxError: Unexpected token 'typeof'` ab.
- Derselbe Fehler tritt bei direktem Import des echten `react-native`-Entrypoints auf; `mobile/node_modules/react-native/index.js` enthaelt Flow-Imports wie `import typeof`.
- Mit dem Runtime-Fix laeuft `npm --prefix mobile run test:unit` mit `87 passed` und `npm --prefix mobile run typecheck` gruen.
- Nach dem Strukturquery-Abbau laeuft der fokussierte Slice `npm --prefix mobile run test:unit -- recipe-detail-fallbacks recipe-list-screen-fallbacks shopping-screen-fallbacks planner-screen-fallbacks mobile-workflow-list-detail-shopping-ui` mit `22 passed`.

Bekannte Warnungen nach Real-RNTL:

- `react-test-renderer is deprecated` aus dem RNTL/React-19-Renderpfad.
- React-`act(...)`-Warnungen in async Retry-/Error-Pfaden.
- `key`-Prop-Warnungen aus lokalen `FlatList`-Testshims.

Diese Warnungen sind Test-Infrastruktur-Rest und kein Hinweis auf direkte Renderer-Imports oder den alten Compat-Layer.

Gate-Entscheidung:

- **Gate C ist geschlossen:** React-Native-Resolution/Transform ist fuer den Vitest-Pfad explizit geloest.
- Neue Mobile-UI-Tests duerfen `@testing-library/react-native` direkt importieren.
- Neue direkte `react-test-renderer`-Imports bleiben verboten.

## Guardrail

Der Guard laeuft ueber:

```bash
npm run test:mobile:rntl-guard
```

Er blockiert neue direkte `react-test-renderer`-Imports in Mobile-Testdateien. Die Legacy-Allowlist ist leer.

## Naechster Schritt

Der File-Migrationsslice, `renderAsync`-Abbau, Runtime-Fixpfad und Abbau der dokumentierten `UNSAFE_queryAllByType`-Zugriffe sind abgeschlossen. Naechster Schritt ist keine RNTL-Blockade mehr, sondern eine separate Warnungs-Triage fuer `react-test-renderer`-Deprecation, `act(...)`-Warnungen und `FlatList`-Shim-Keys.
