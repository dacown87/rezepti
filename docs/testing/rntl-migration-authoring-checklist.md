# RNTL Migration Authoring Checklist

Stand: 2026-05-31
Scope: Phase 0 der Mobile-Test-Migration von `react-test-renderer` zu `@testing-library/react-native`

Inventur/Gate-Entscheidung: [`rntl-migration-phase-0-inventory.md`](rntl-migration-phase-0-inventory.md)

## Ziel

Diese Checkliste gilt fuer neue oder angefasste Mobile-Tests nach der RNTL-Runtime-Migration. Sie blockiert Backsliding und haelt Testauthoring auf sichtbares Verhalten ausgerichtet.

## Kanonische Imports

- Nutze `render`, `screen`, `fireEvent`, `waitFor` aus `@testing-library/react-native`.
- Importiere `react-test-renderer` nicht direkt in Testdateien.
- Der alte lokale Compat-Layer ist entfernt; `mobile/test/testing-library-rn-real.ts` ist nur ein duennes Real-RNTL-Runtime-Modul.

## Query-Reihenfolge

1. Sichtbarer Text oder `placeholder`
2. `accessibilityLabel` oder `accessibilityRole`
3. semantisches `testID`
4. `UNSAFE_*` nur nach expliziter Inventar-Ergaenzung und mit kurzer Begruendung direkt im Test

Wenn eine Komponente keine robuste Nutzer-Query anbietet, zuerst eine kleine Accessibility- oder `testID`-Ergaenzung pruefen. Keine neuen `className`-, `hitSlop`- oder Icon-Struktur-Selektoren einfuehren.

## Async-Regel

- Nutze `waitFor` fuer asynchrone Zustandswechsel, nicht manuelle Promise-Flush-Loops.
- Vermeide `renderAsync`, sobald ein Test auf echte RNTL-API umgestellt ist.
- Nach Interaktionen nur dann erneut pruefen, wenn der beobachtete UI-Zustand wirklich asynchron entsteht.

## Mock-Ownership

- Zentrale, wiederverwendbare Mocks gehoeren nach `mobile/test/setup.ts`.
- Testlokale Mocks bleiben fuer eng begrenzte, dateispezifische Faelle reserviert.
- Neue Mocks sollen nicht in einzelnen Tests dupliziert werden, wenn sie eigentlich Infrastruktur sind.

## Uebergangs-API

Erlaubt:

- `render`, `screen`, `fireEvent`, `waitFor`

Der Runtime-Wrapper enthaelt noch Uebergangstypen fuer RNTL-`UNSAFE_*`-APIs, damit echte RNTL-Typen durchgereicht werden koennen. Das ist keine Einladung fuer neue Strukturqueries.

Verboten fuer neue Tests und neue Migrationsslices:

- direkte `react-test-renderer`-Imports
- `renderAsync`
- string-basierte `UNSAFE_queryAllByType`-Hosttyp-Suchen als Standardmuster

## Guard-Command

Vor dem Einchecken neuer Mobile-Testaenderungen ausfuehren:

```bash
npm run test:mobile:rntl-guard
```

Erwartung:

- Der Guard darf keinen direkten `react-test-renderer`-Import in Mobile-Testdateien melden.
- `UNSAFE_*`-Nutzung in Mobile-Testdateien muss als Ausnahme im Inventory dokumentiert sein; Stand 2026-05-31 gibt es in den migrierten Tests keine aktiven `UNSAFE_queryAllByType`-Strukturzugriffe mehr.
