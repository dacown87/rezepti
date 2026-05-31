# RNTL Migration Phase 0 Inventory

Stand: 2026-05-31

## Ergebnis

Phase 0 ist inventarisiert. Phase 1 Real-RNTL-Spike hat Gate C ergeben: Vitest kann echte `@testing-library/react-native` derzeit nicht laden, weil der echte React-Native-Entry roh in Node landet und an Flow-Syntax (`import typeof`) scheitert. Der Compat-Layer bleibt deshalb bewusst aktiv, bis ein separater Runtime-Fix entschieden ist.

## Direkte `react-test-renderer`-Imports

Aktive Altdateien: keine.

Bewusste Infrastruktur-Ausnahme:

- `mobile/test/testing-library-rn-compat.ts`

Migriert nach Phase 0/1:

- `mobile/test/recipe-detail-fallbacks.test.tsx`
- `mobile/test/recipe-list-screen-fallbacks.test.tsx`
- `mobile/test/shopping-screen-fallbacks.test.tsx`
- `mobile/test/mobile-workflow-list-detail-shopping-ui.test.tsx`
- `mobile/test/planner-screen-fallbacks.test.tsx`

## `@testing-library/react-native`-Consumer

- `mobile/test/recipe-detail-fallbacks.test.tsx`
- `mobile/test/recipe-list-screen-fallbacks.test.tsx`
- `mobile/components/__tests__/StyledText-test.js`

## Compat-only API-Nutzung

- `renderAsync`: keine aktive Nutzung mehr in Mobile-Testdateien.
- string-basierte `UNSAFE_queryAllByType(...)`:
  - `mobile/test/recipe-detail-fallbacks.test.tsx`
  - `mobile/test/recipe-list-screen-fallbacks.test.tsx`
  - `mobile/test/shopping-screen-fallbacks.test.tsx`
  - `mobile/test/mobile-workflow-list-detail-shopping-ui.test.tsx`
  - `mobile/test/planner-screen-fallbacks.test.tsx`

## Runtime-Spike

Aktuelle Alias-Lage:

- `mobile/vitest.config.ts` aliasiert `@testing-library/react-native` auf `mobile/test/testing-library-rn-compat.ts`.
- `mobile/tsconfig.json` spiegelt diesen Alias fuer den Typchecker.
- `mobile/vitest.config.ts` aliasiert `react-native` auf `mobile/test/react-native-shim.ts`.
- `mobile/test/setup.ts` mockt Router, AsyncStorage, Reanimated und Safe-Area, aber nicht RNTL selbst.

Reproduktion:

- Mit bestehendem Alias laeuft der fokussierte Detail-Test gruen.
- Ohne `@testing-library/react-native`-Alias bricht der Suite-Start vor Testausfuehrung mit `SyntaxError: Unexpected token 'typeof'` ab.
- Derselbe Fehler tritt bei direktem Import des echten `react-native`-Entrypoints auf; `mobile/node_modules/react-native/index.js` enthaelt Flow-Imports wie `import typeof`.

Gate-Entscheidung:

- **Gate C: Vitest/RN-Runtime ungeeignet ohne separaten Runtime-Fix.**
- Keine weiteren File-Migrationen gegen echte RNTL, bevor React-Native-Resolution/Transform explizit geloest ist.
- File-Migrationen duerfen nur gegen den eingefrorenen Compat-API-Subset weiterlaufen.

## Guardrail

Der Guard laeuft ueber:

```bash
npm run test:mobile:rntl-guard
```

Er blockiert neue direkte `react-test-renderer`-Imports in Mobile-Testdateien. Die Legacy-Allowlist ist leer; alle verbleibenden Renderer-Nutzungen muessen in der Compat-Infrastruktur bleiben.

## Naechster Schritt

Der File-Migrationsslice ist abgeschlossen und `renderAsync` ist entfernt. Naechster Schritt ist entweder ein separater Runtime-Fixpfad fuer echte RNTL unter Vitest oder der Abbau der noch dokumentierten `UNSAFE_queryAllByType`-Zugriffe. Die Explorer-Inventur vom 2026-05-31 stuft Spinner-/Skeleton-Strukturchecks als vorerst vertretbare Ausnahmen ein; Planner-, Workflow- und RefreshControl-Zugriffe brauchen fuer einen sauberen Abbau eher Accessibility-Labels oder gezielte `testID`s.
