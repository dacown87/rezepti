# npm Audit Triage Plan (2026-05-25)

Status: abgeschlossen am 2026-05-30.

## Ziel

Die aktuellen `npm audit`-Findings sollen reduziert oder sauber klassifiziert werden, ohne die bestehende Upgrade-Strategie zu brechen.

Verbindliche Leitplanke ist die bestehende Zielmatrix:

- [2026-05-13 Full-Stack Upgrade Target Matrix](./2026-05-13-full-stack-upgrade-target-matrix.md)

Wichtigste Regeln daraus:

- Runtime-/Framework-Anker schlagen nacktes `npm latest`.
- Expo-Projekte upgraden `react`, `react-native`, `react-native-*` und `expo-*` nicht isoliert, sondern ueber die Expo-SDK-Kompatibilitaetslinie.
- Major-Upgrades mit breitem Blast Radius werden nur dann empfohlen, wenn die Linie stabil ist und der Migrationsaufwand vertretbar bleibt.
- Tailwind 4 / NativeWind 5, React/RN-Patches ausserhalb der Expo-Linie, `react-native-worklets` / `reanimated` und Expo-SDK-56 bleiben separate Tracks.

## Snapshot

Stand nach frischem Node-24-Install:

- Root: `5 moderate`
- Mobile: `14 total` (`13 moderate`, `1 high`)

Node 24 selbst ist nicht blockiert. Root/Mobile Install, Typechecks, Expo Doctor, Unit-Tests und Production-Docker-Build sind gruen.

## Abschluss-Stand

Die Triage wurde am 2026-05-30 umgesetzt. Sichere nicht-erzwingende Fixes wurden in `package-lock.json` und `mobile/package-lock.json` uebernommen. Uebrig bleiben nur bewusst akzeptierte Rest-Risiken:

- Root: `drizzle-kit`/`@esbuild-kit`/`esbuild` im Dev-Tool-Pfad (`4 moderate`).
- Mobile: Expo-SDK-gebundener `uuid`/`xcode`/Expo-Cluster (`11 moderate`).

Details, Nachher-Audits und Gates stehen im Abschnitt „Umsetzungsergebnis (2026-05-30)".

## Befundgruppen

### Root

| Finding | Schwere | Ursache | Erste Bewertung |
| --- | --- | --- | --- |
| `ws` | moderate | transitive Dependency | Wahrscheinlich Lockfile-/Patch-Fix mit geringem Risiko. |
| `esbuild` | moderate | via `@esbuild-kit/core-utils` -> `@esbuild-kit/esm-loader` -> `drizzle-kit` | Nicht blind erzwingen; haengt an `drizzle-kit`. |
| `@esbuild-kit/core-utils` | moderate | transitive ueber `drizzle-kit` | Mit `drizzle-kit` gemeinsam betrachten. |
| `@esbuild-kit/esm-loader` | moderate | transitive ueber `drizzle-kit` | Mit `drizzle-kit` gemeinsam betrachten. |
| `drizzle-kit` | moderate | direkte Dev-Dependency | Audit schlaegt SemVer-Major-Pfad vor; nur mit DB-/Migration-Gates. |

### Mobile

| Finding | Schwere | Ursache | Erste Bewertung |
| --- | --- | --- | --- |
| `@xmldom/xmldom` | high | transitive Dependency | Hoechste Prioritaet; laut Audit fixbar, aber Herkunft pruefen. |
| `dompurify` | moderate | transitive Dependency | Wahrscheinlich Patch-/Lockfile-Fix moeglich. |
| `brace-expansion` | moderate | transitive Dependency | Wahrscheinlich Patch-/Lockfile-Fix moeglich. |
| Expo-Cluster: `expo`, `@expo/cli`, `@expo/config`, `@expo/config-plugins`, `@expo/metro-config`, `@expo/prebuild-config`, `@expo/local-build-cache-provider`, `expo-sharing`, `expo-splash-screen`, `xcode`, `uuid` | moderate | SDK-gebundene Expo-Abhaengigkeiten | Nicht mit `npm audit fix --force`; nur SDK-kompatibel oder als dokumentierte Ausnahme. |

## Vorgehen

### Phase 0: Baseline sichern

Ziel: Reproduzierbare Ausgangslage dokumentieren.

Aktionen:

1. `npm audit --json > artifacts/audit/root-audit-2026-05-25.json`
2. `npm --prefix mobile audit --json > artifacts/audit/mobile-audit-2026-05-25.json`
3. `npm outdated --json > artifacts/audit/root-outdated-2026-05-25.json`
4. `npm --prefix mobile outdated --json > artifacts/audit/mobile-outdated-2026-05-25.json`

Hinweis: `artifacts/` ist Arbeitsoutput, nicht zwingend zu committen.

Exit-Kriterium:

- Baseline ist vorhanden und Findings sind den Gruppen oben zugeordnet.

### Phase 1: Patchbare transitive Findings zuerst

Ziel: Sichere, nicht-strategische Patches abgreifen.

Aktionen:

1. Root: `npm audit fix`
2. Mobile: `npm --prefix mobile audit fix`
3. Danach Diff pruefen:
   - akzeptabel: nur `package-lock.json` / `mobile/package-lock.json` oder kleine Patch-Versionen innerhalb bestehender Zielmatrix
   - nicht akzeptabel: Expo-SDK-Wechsel, React/RN-Wechsel, Tailwind/NativeWind-Major, `react-native-worklets` / `reanimated`-Sprung, Mobile-TypeScript 6, AsyncStorage 3

Erwartung:

- `ws`, `@xmldom/xmldom`, `dompurify` und `brace-expansion` sind die besten Kandidaten fuer schnelle Reduktion.

Exit-Kriterium:

- Kein SDK-/Framework-Anker wurde verletzt.
- Audit-Zahl ist reduziert oder die unveraenderten Findings sind erklaert.

### Phase 2: Root `drizzle-kit` separat bewerten

Ziel: `drizzle-kit`-bezogene Findings nicht in einen allgemeinen Audit-Fix mischen.

Kontext:

- `drizzle-kit` ist direkte Dev-Dependency.
- Aktuelle Zielmatrix sagt: `drizzle-kit` ist auf der stabilen Zielversion.
- Audit meldet eine transitive `esbuild`-Kette und schlaegt einen SemVer-Major-Fixpfad vor.

Aktionen:

1. Pruefen, ob es innerhalb der erlaubten `^0.31.x`-Linie einen sicheren Patch gibt.
2. Falls nein: kein `--force`.
3. Risiko dokumentieren:
   - Dev-/CLI-Pfad, nicht Production-Runtime.
   - Relevante Nutzung: `npx drizzle-kit push`, `db:push`, CI-Schema-Push.
4. Nur falls eine sinnvolle stabile Zielversion existiert:
   - `npm install -D drizzle-kit@<ziel>`
   - `npx drizzle-kit push --force` gegen Test-DB
   - Root-Typecheck und Root-Tests

Exit-Kriterium:

- Entweder Finding geloest, oder als akzeptierte Dev-Tool-Ausnahme mit naechstem Trigger dokumentiert.

Trigger fuer spaeter:

- Neue stabile `drizzle-kit`-Linie ohne Audit-Finding.
- Aenderungen an DB-Migrations-/Push-Workflow.
- Security-Bewertung wird auf `high` oder Production-relevant hochgestuft.

### Phase 3: Expo-Cluster klassifizieren, nicht erzwingen

Ziel: Mobile-Audit sauber machen, ohne Expo-SDK-55-Kompatibilitaet zu zerstoeren.

Nicht erlaubt:

- `npm --prefix mobile audit fix --force`
- Direktes Upgrade von `expo` auf SDK 56
- Direktes Upgrade von `react`, `react-dom`, `react-native`, `react-native-web`, `react-native-*`
- Direktes Upgrade von `expo-sharing` / `expo-splash-screen` ausserhalb von `expo install`

Aktionen:

1. `cd mobile && npx expo install --check`
2. Falls Expo fuer SDK 55 kompatible Patch-Versionen anbietet:
   - `npx expo install <betroffene expo-pakete>`
   - `CI=1 npx expo-doctor`
3. Falls Audit nur durch SDK-56 geloest wuerde:
   - Finding bleibt dokumentierte SDK-gebundene Ausnahme.
   - Verweis auf spaeteren Expo-SDK-Block.

Exit-Kriterium:

- `expo-doctor` bleibt `19/19`.
- Expo-Findings sind entweder SDK-kompatibel geloest oder als SDK-bound accepted risk dokumentiert.

### Phase 4: Verifikation

Pflicht-Gates nach jeder akzeptierten Aenderung:

1. `npm ci`
2. `npm --prefix mobile ci`
3. `npx tsc --noEmit`
4. `npm --prefix mobile run typecheck`
5. `CI=1 npx expo-doctor` in `mobile/`
6. `npm run test:unit`
7. `npm --prefix mobile run test:unit`

Bei Aenderungen an Expo-/Web-Build-relevanten Paketen zusaetzlich:

8. `npm run build:mobile`
9. Optional bei groesserem Bundle-/Expo-Effekt: `npm run perf:bundle`

Bei Aenderungen an `drizzle-kit` zusaetzlich:

10. Test-DB starten/verfuegbar machen
11. `npx drizzle-kit push --force` gegen `TEST_DATABASE_URL`

## Dokumentations-Update nach Umsetzung

Nach Abschluss:

1. `TODO.md` aktualisieren:
   - geloeste Findings mit Ergebnis
   - Restfindings mit Grund und naechstem Trigger
2. Falls Exceptions bleiben, kurze Tabelle in diesem Plan nachtragen:
   - Paket
   - Advisory
   - Grund fuer Ausnahme
   - Naechster Re-Evaluation-Trigger
3. Optional `docs/TEST_STATUS.md` nur dann aktualisieren, wenn Gates oder CI-Aussagen betroffen sind.

## Umsetzungsergebnis (2026-05-30)

Ausgefuehrt:

1. Baselines geschrieben:
   - `artifacts/audit/root-audit-2026-05-30.json`
   - `artifacts/audit/mobile-audit-2026-05-30.json`
   - `artifacts/audit/root-outdated-2026-05-30.json`
   - `artifacts/audit/mobile-outdated-2026-05-30.json`
2. `npm audit fix` ohne `--force` im Root ausgefuehrt.
3. `npm --prefix mobile audit fix` ohne `--force` ausgefuehrt.
4. Nachher-Audits geschrieben:
   - `artifacts/audit/root-audit-after-fix-2026-05-30.json`
   - `artifacts/audit/mobile-audit-after-fix-2026-05-30.json`

Ergebnis:

| Bereich | Vorher | Nachher | Geloest |
| --- | ---: | ---: | --- |
| Root | `5 moderate` | `4 moderate` | `ws` |
| Mobile | `13 moderate`, `1 high` | `11 moderate` | `@xmldom/xmldom` high, `dompurify`, `brace-expansion` |

Akzeptierte Rest-Risiken:

| Paket / Cluster | Advisory / Finding | Grund fuer Ausnahme | Naechster Re-Evaluation-Trigger |
| --- | --- | --- | --- |
| Root `drizzle-kit` -> `@esbuild-kit/esm-loader` -> `@esbuild-kit/core-utils` -> `esbuild` | `esbuild <=0.24.2` moderate | Audit-Fix erfordert `npm audit fix --force` und schlaegt `drizzle-kit@0.18.1` vor. Das waere ein SemVer-Major-/Downgrade-Pfad gegen die aktuelle `drizzle-kit@0.31.x`-Linie. Betroffen ist ein Dev-/CLI-Pfad, nicht die Production-Runtime. | Neue stabile `drizzle-kit`-Linie ohne Finding, Aenderungen am DB-Push-/Migrationsworkflow oder Hochstufung auf `high`/Production-Relevanz. |
| Mobile Expo-Cluster: `expo`, `@expo/cli`, `@expo/config*`, `@expo/metro-config`, `@expo/prebuild-config`, `expo-sharing`, `expo-splash-screen`, `uuid`, `xcode` | `uuid <11.1.1` moderate ueber `xcode`/Expo Config Plugins | Der verbleibende Fixpfad ist Expo-SDK-gebunden und verlangt laut Audit Force-Updates auf nicht gewollte Expo-Linien. `npx expo install --check` meldet fuer SDK 55 keine kompatiblen Updates; `expo-doctor` bleibt `19/19`. | Naechster Expo-SDK-Upgrade-Track oder eine SDK-55-kompatible Expo-Patchlinie, die `xcode`/`uuid` aktualisiert. |

Verifikation:

| Gate | Ergebnis |
| --- | --- |
| `npm ci` | gruen |
| `npm --prefix mobile ci` | gruen |
| `npx tsc --noEmit` | gruen |
| `npm --prefix mobile run typecheck` | gruen |
| `cd mobile && CI=1 npx expo-doctor` | gruen, `19/19 checks passed` |
| `cd mobile && npx expo install --check` | gruen, Dependencies up to date |
| `npm run test:unit` | gruen, `448 passed`, `13 skipped` |
| `npm --prefix mobile run test:unit` | gruen, `87 passed` |

Kein `npm audit fix --force`, kein Expo-SDK-Upgrade, kein React-/React-Native-Ausbruch und keine `drizzle-kit`-Aenderung wurden vorgenommen.

## Empfohlene Umsetzungsreihenfolge

1. Phase 0 Baseline schreiben.
2. Phase 1 `npm audit fix` ohne `--force` fuer Root und Mobile.
3. Gates laufen lassen.
4. Root-`drizzle-kit`-Rest isoliert bewerten.
5. Expo-Cluster als SDK-bound klassifizieren oder mit `expo install` innerhalb SDK 55 patchen.
6. TODO mit finaler Restliste aktualisieren.

## Nicht-Ziele

- Kein Expo-SDK-56-Upgrade.
- Kein Tailwind-4-/NativeWind-5-Track.
- Kein React-/React-Native-Patch ausserhalb der Expo-SDK-55-Linie.
- Kein `npm audit fix --force`.
- Kein Zusammenlegen mit Multi-User Login.
