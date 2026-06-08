# Full-Stack Upgrade Target Matrix (2026-05-13)

## Nachtrag 2026-05-31

Diese Matrix wurde gegen den aktuellen Repo-Stand und frische Paket-Signale aktualisiert.

Geprueft:

- `package.json` und `mobile/package.json`
- `npm outdated --depth=0`
- `npm --prefix mobile outdated --depth=0`
- `cd mobile && npx expo install --check`
- `npx supabase --version`
- Workflow-Action-Versionen in `.github/workflows/`

Aktueller Befund:

- Runtime-/Tooling-Batches 0-3 sind technisch erledigt oder bewusst zurueckgenommen, wo Expo-SDK-55 es verlangt.
- GitHub-eigene Actions und Docker-Actions laufen auf Node-24-kompatiblen Linien; `northflank/deploy-to-northflank@v1` bleibt der separate Infra-Sonderfall.
- Historischer Stand am 2026-05-31: Mobile blieb noch auf Expo SDK 55. Dieser Punkt wurde am 2026-06-01 durch den SDK-56-Core-Slice abgeloest.
- Mobile-TypeScript bleibt auf `5.9.3`; der fruehere Zielwert `6.0.3` wurde wegen Expo-SDK-55-Kompatibilitaet verworfen.
- AsyncStorage bleibt auf `2.2.0`; der fruehere Zielwert `3.x` wurde ebenfalls wegen Expo-SDK-55-Kompatibilitaet verworfen.
- Supabase CLI ist inzwischen lokal `2.102.0`.
- Historisch offen waren kleine Root-/Mobile-Patches und separate Spaeter-Tracks. Stand 2026-06-01 sind Root-/Mobile-Patches, Expo-SDK-56 und Reanimated/Worklets erledigt; offen bleiben Northflank-Deploy-Pfad und Tailwind-4/NativeWind-5.

## Nachtrag 2026-06-01

Der zuvor vertagte Expo-SDK-Block ist abgeschlossen. Mobile steht jetzt auf Expo SDK 56 (`expo@~56.0.8`, `expo-router@~56.2.8`), React `19.2.3`, React Native `0.85.3`, Reanimated `4.3.1`, Worklets `0.8.3` und TypeScript `~6.0.3`. Der SDK-56-Router-Blocker wurde durch `expo-router/react-navigation` geloest, die direkte `@react-navigation/native`-Dependency wurde entfernt, und die alte Top-Level-`splash`-Konfiguration ist in das `expo-splash-screen`-Config-Plugin gewandert.

Restupdates nach dem SDK-Sprung sind ebenfalls erledigt: Root `concurrently@10.0.1`, Mobile `@types/react@19.2.15` und exakt gepinntes `react-test-renderer@19.2.3`. `npm outdated --depth=0` ist im Root leer. Mobile zeigt nur noch bewusst nicht gezogene Latest-Linien:

- React/React DOM/Renderer `19.2.6` und neuere `react-native-*` Linien bleiben SDK-gebunden; Expo SDK 56 erwartet React `19.2.3`.
- `@react-native-async-storage/async-storage@3.x` bleibt vertagt, solange Expo die 2.2-Linie erwartet.
- Tailwind 4 bleibt an den NativeWind-v5-Track gekoppelt. Stand 2026-06-01: `nativewind@latest` ist `4.2.4`, `nativewind@preview` ist `5.0.0-preview.4`; kein Produktions-Update.

Damit ist der Upgrade-Punkt abgeschlossen. Offen bleiben nur der separate Styling-Resttrack (Tailwind 4/NativeWind 5 nach stabiler v5-Linie), der Northflank-Infra-Track und fachliche Produktarbeit.

## Ziel

Diese Matrix beantwortet fuer den gesamten Stack drei Fragen:

1. Welche Version haben wir aktuell im Repo?
2. Welche neueste stabile Version ist offiziell verfuegbar?
3. Auf welche Zielversion sollten wir real gehen, wenn die Regel lautet: **maximal modern, wenn stabil**?

Entscheidungsregel:

- Runtime-/Framework-Anker schlagen nacktes `npm latest`.
- Expo-Projekte upgraden `react`, `react-native` und `react-native-*` nicht isoliert, sondern ueber die Expo-SDK-Kompatibilitaetslinie.
- Major-Upgrades mit breitem Blast Radius werden nur dann empfohlen, wenn die Linie stabil ist und der Migrationsaufwand vertretbar bleibt.

## Quellenbasis

- Repo-Stand aus [package.json](/home/patrick/Projekte/rezepti/package.json) und [mobile/package.json](/home/patrick/Projekte/rezepti/mobile/package.json)
- `npm outdated --depth=0` fuer Root und `mobile/`
- `npm view <paket> version` fuer Registry-`latest`
- Offizielle Release-Quellen:
  - Node.js Releases: <https://nodejs.org/en/about/releases/>
  - Expo SDK reference: <https://docs.expo.dev/versions/latest/>
  - React Native versions: <https://reactnative.dev/versions>
  - React 19.2: <https://react.dev/blog/2025/10/01/react-19-2>
  - TypeScript 6.0: <https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/>
  - Vitest 4: <https://vitest.dev/blog/vitest-4>
  - Tailwind CSS v4: <https://tailwindcss.com/blog/tailwindcss-v4>
  - Tailwind CSS v4.1: <https://tailwindcss.com/blog/tailwindcss-v4-1>
  - NativeWind v5 docs: <https://www.nativewind.dev/v5/core-concepts/tailwindcss>
  - GitHub Actions Node 20 deprecation: <https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/>
  - actions/checkout releases: <https://github.com/actions/checkout/releases>
  - actions/setup-node releases: <https://github.com/actions/setup-node/releases>
  - docker/build-push-action releases: <https://github.com/docker/build-push-action/releases>
  - docker/login-action releases: <https://github.com/docker/login-action/releases>

## Zielmatrix

| Bereich | Paket / Linie | Aktuell im Repo | Neueste stabile Version | Empfohlenes Ziel | Entscheidung |
| --- | --- | --- | --- | --- | --- |
| Runtime | Node.js | `>=24.15.0 <25` | Node `24` ist `Active LTS`; Node `25` ist `Current` | Node `24.x` aktuell halten | Nicht auf `25` springen; modern genug und deutlich stabiler fuer Prod. |
| Runtime | npm | `>=11`, lokal `11.12.1` | `11.x` | `>=11` beibehalten | Kein akuter Blocker; Node-24-Engine ist der harte Anker. |
| Mobile-Plattform | Expo SDK | `~56.0.8` | `56.0.8` laut installiertem SDK-56-Stand | `56.x` halten | SDK-56-Core-Slice abgeschlossen; `expo install --check` und `expo-doctor` (`21/21`) sind gruen. |
| Mobile-Plattform | React | `19.2.3` | `19.2.6` | bei SDK `56` auf `19.2.3` bleiben | `npm latest` ist hier nicht die Entscheidungsinstanz; Expo SDK 56 erwartet React `19.2.3`. |
| Mobile-Plattform | React DOM | `19.2.3` | `19.2.6` | bei SDK `56` auf `19.2.3` bleiben | Gleiche Begruendung wie bei `react`. |
| Mobile-Plattform | React Native | `0.85.3` | `0.85.3` | `0.85.3` halten | SDK-56-Linie ist erreicht; nicht isoliert ausserhalb Expo ziehen. |
| Mobile-Plattform | React Native Web | `~0.21.0` | `0.21.2` | SDK-56-kompatible Linie halten | Keine Sonderregel vor der naechsten Expo-SDK-Linie. |
| Backend | `hono` | `4.12.18` | `4.12.23` | Patch optional | Kleiner Root-Patch-Slice. |
| Backend | `@hono/node-server` | `2.0.2` | `2.0.4` | Patch optional | Major ist erledigt; Patch kann in kleinem Root-Patch-Slice mitlaufen. |
| Tooling | Root `typescript` | `6.0.3` | `6.0.3` | `6.0.3` | Bereits aktuell. |
| Tooling | Mobile `typescript` | `~6.0.3` | `6.0.3` | `~6.0.3` halten | Mit SDK 56 erledigt. |
| Tooling | `vite` | `8.0.12` | `8.0.14` | Patch optional | Kleiner Root-Patch-Slice, kein Framework-Block. |
| Tooling | `vitest` | `4.1.6` | `4.1.7` | Patch optional | Major ist erledigt; Patch nur zusammen mit Root/Mobile-Test-Gates. |
| Tooling | `@vitest/coverage-v8` | `4.1.6` | `4.1.7` | Patch optional | Mit `vitest` gemeinsam ziehen. |
| Tooling | `@vitest/ui` | `4.1.6` | `4.1.7` | Patch optional | Mit `vitest` gemeinsam ziehen. |
| Mobile-Data | `@tanstack/react-query` | `5.100.10` | `5.100.14` | Patch optional | Kleiner Mobile-Patch-Slice innerhalb SDK 55. |
| Mobile-Data | `@tanstack/react-query-persist-client` | `5.100.10` | `5.100.14` | Patch optional | Mit TanStack gemeinsam ziehen. |
| Mobile-Data | `@tanstack/query-async-storage-persister` | `5.100.10` | `5.100.14` | Patch optional | Mit TanStack gemeinsam ziehen. |
| Mobile-Infra | `@react-navigation/native` | entfernt | n/a | entfernt halten | SDK 56 / Expo Router erwartet keine direkte App-Dependency; Theme-Imports laufen ueber `expo-router/react-navigation`. |
| Mobile-Infra | `@react-native-async-storage/async-storage` | `2.2.0` | `3.1.1` | `2.2.0` bei SDK 56 halten | 3.x bleibt nicht Ziel dieses Tracks; Expo-Doctor-/SDK-Kompatibilitaet gewinnt. |
| Mobile-Animation | `react-native-reanimated` | `4.3.1` | `4.4.0` | SDK-56-Linie halten | Reanimated wurde mit Worklets gemeinsam ueber Expo gezogen; nicht einzeln auf Latest. |
| Mobile-Animation | `react-native-worklets` | `0.8.3` | `0.9.1` | SDK-56-Linie halten | Peer-/Expo-gebunden. |
| Mobile-Infra | `react-native-gesture-handler` | `~2.31.1`, installiert `2.31.2` | `3.0.0` | SDK-56-Linie halten | Nicht einzeln vor der naechsten SDK-Linie. |
| Mobile-Infra | `react-native-safe-area-context` | `~5.7.0` | `5.8.0` | SDK-56-Linie halten | Expo-gesteuert. |
| Mobile-Infra | `react-native-screens` | `4.25.2` | `4.25.2` | `4.25.2` halten | Expo-SDK-56-Linie erreicht. |
| Mobile-Infra | `react-native-svg` | `15.15.4` | `15.15.5` | SDK-56-Linie halten | Expo-gesteuert. |
| Mobile-Test | `react-test-renderer` | `19.2.3` | `19.2.6` | exakt `19.2.3` halten | Muss zu React `19.2.3` passen; RNTL braucht den Renderer weiter. |
| Styling | `nativewind` | `4.2.4` | `4.2.4` (`preview`: `5.0.0-preview.4`) | `4.2.4` halten, v5 spaeter | Stabile Produktionslinie bleibt v4; v5/Tailwind-4 bleibt eigener Track. |
| Styling | `tailwindcss` | `3.4.19` | `4.3.0` | vorerst `3.4.19` | Tailwind 4 ist stabil, aber der NativeWind-v5-Pfad dafuer ist noch nicht produktionsreif. |
| Mobile-Test | `@testing-library/react-native` | `13.3.3` | `13.3.3` | `13.3.3` | Bereits aktuell. |
| Backend/Data | `drizzle-orm` | `0.45.2` | `0.45.2` | `0.45.2` | Bereits aktuell. |
| Backend/Data | `drizzle-kit` | `0.31.10` | `0.31.10` | `0.31.10` | Bereits aktuell. |
| Backend/API | `openai` | `6.39.1` | `6.39.1` | `6.39.1` halten | Patch-Slice erledigt. |
| Backend/API | `zod` | `4.4.3` | `4.4.3` | `4.4.3` | Bereits aktuell. |
| Backend/API | `supabase` CLI-Paket | `2.102.0` | `2.102.0` lokal verifiziert | `2.102.x` halten | Wurde fuer Advisor-Arbeit aktualisiert und ist aktueller Repo-Stand. |
| Build/Test | `lighthouse` | `13.3.0` | `13.3.0` | `13.3.0` | Bereits aktuell. |
| Build/Test | `tsx` | `4.22.4` | `4.22.4` | `4.22.4` halten | Patch-Slice erledigt. |
| UI | `lucide-react-native` | `1.17.0` | `1.17.0` | `1.17.0` halten | Patch-Slice erledigt. |

## Kurzfazit zum Snapshot

Die Matrix oben ist die einzige Wahrheitsquelle. Auf dem Snapshot vom `2026-05-13` sind viele Root- und Mobile-Linien bereits aktuell; offen bleiben vor allem gezielte Major-Spruenge, die CI-Runtime-Hygiene und die bewusst Expo-/SDK-gebundenen Mobile-Pakete.

Wichtig:

- `react`, `react-dom`, `react-native`, `react-native-web` und mehrere `react-native-*` Pakete sind **nicht** deshalb offen, weil wir sie vergessen haben, sondern weil Expo die gueltige Upgrade-Achse vorgibt.

## Empfehlung nach Upgrade-Batches

### Batch 0: CI Runtime Hygiene

Status nach Nachpruefung am 2026-05-31:

- GitHub-eigene Actions und Docker-Actions sind auf Node-24-kompatiblen Linien.
- `ci.yml`, `docker-publish.yml` und `changelog-update.yml` nutzen `actions/checkout@v5` bzw. `actions/setup-node@v5`, wo relevant.
- `docker/login-action@v4` und `docker/build-push-action@v7` sind gesetzt.
- `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` bleibt nur noch als Uebergangs-/Absicherungshebel.
- Der Node-Runtime-Sonderfall rund um `northflank/deploy-to-northflank@v1` bleibt offen und gehoert in den separaten Northflank-Infra-Track.

Ziel:

- Die GitHub-Warnung `Node.js 20 is deprecated ... forced to run on Node.js 24` aus den Delivery-Workflows entfernen oder auf einen explizit dokumentierten Upstream-Sonderfall reduzieren.
- Delivery- und Changelog-Workflows auf aktuelle stabile Action-Linien bringen, bevor Code-Majors folgen.

Betroffene Workflows:

- [docker-publish.yml](/home/patrick/Projekte/rezepti/.github/workflows/docker-publish.yml)
- [changelog-update.yml](/home/patrick/Projekte/rezepti/.github/workflows/changelog-update.yml)

Zielversionen:

- `actions/checkout` `v4 -> v5` als risikoaermere Node-24-Linie fuer die zuerst angefassten Workflows
- `actions/setup-node` `v4 -> v5` als risikoaermere Node-24-Linie fuer die zuerst angefassten Workflows
- `docker/login-action` `v3 -> v4`
- `docker/build-push-action` `v6 -> v7`
- `northflank/deploy-to-northflank` bleibt vorerst `v1`

Warum so:

- `checkout`, `setup-node`, `docker/login-action` und `docker/build-push-action` haben heute stabile Node-24-Linien.
- `northflank/deploy-to-northflank` ist aktuell der Sonderfall: oeffentlich ist weiter nur `v1.0.0` sichtbar. Das Paket bleibt deshalb dokumentiert auf `v1`, bis es eine aktualisierte Runtime-Linie oder einen besseren Deploy-Pfad gibt.
- `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` bleibt ein Uebergangs-Hebel, nicht das Endziel.

Verifikation / Exit-Kriterien:

- `ci.yml`, `docker-publish.yml` und `changelog-update.yml` laufen nach dem Versionszug weiter erfolgreich.
- `push -> Update Changelog & Version -> Build & Push Docker Image` bleibt funktional intakt.
- Die Node-20-Deprecation-Warnung verschwindet fuer die first-party- und Docker-Actions in **allen relevanten Workflows**, nicht nur in `docker-publish.yml` und `changelog-update.yml`.
- Falls die Warnung danach nur noch vom Northflank-Action kommt, wird das explizit als dokumentierter Upstream-Sonderfall akzeptiert.
- `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` kann entfernt werden, sobald keine kompatibilitaetsrelevanten Alt-Actions mehr davon abhaengen.

### Batch 1: Kleinster Code-Track nach Batch 0

Status nach Nachpruefung am 2026-06-01:

- `@hono/node-server` `1.19.14 -> 2.0.2` ist erledigt.
- Mobile-TypeScript wurde damals fuer Expo-SDK-55-Kompatibilitaet auf `5.9.3` zurueckgefuehrt; mit SDK 56 ist TypeScript `~6.0.3` wieder erledigt.
- Der kleine Root-Patch-Slice (`@hono/node-server` `2.0.4`, `hono` `4.12.23`, `vite`, `tsx` `4.22.4`, `openai` `6.39.1`, `@types/node` `25.9.1`) ist erledigt. Nach dem Restupdate auf `concurrently@10.0.1` meldet `npm outdated --depth=0` im Root keine offenen Pakete.

Warum zuerst:

- kleinster Blast Radius
- sauber verifizierbar
- bringt den Stack auf modernere stabile Linien ohne Expo-Achse anzufassen
- ist bewusst **nach** Batch 0 geplant, damit Delivery-Probleme und Code-/Compiler-Probleme nicht vermischt werden

### Batch 2: Danach als Tooling-Welle

Status nach Umsetzung am 2026-05-14:

- technisch umgesetzt und am 2026-05-24/31 nachgehaertet
- API-E2E-Contract-Gate bootet inzwischen einen echten Server
- Coverage-Floors wurden nach der Vitest-4-Migration wieder auf mindestens `30` angezogen
- aktuelle Patchlinie ist `vitest`/`@vitest/*` `4.1.7`; das ist ein kleiner Patch-Slice, kein neuer Major-Track

- umgesetzt: `vitest` `3.2.4 -> 4.1.6`
- umgesetzt: `@vitest/coverage-v8` `3.2.4 -> 4.1.6`
- umgesetzt: `@vitest/ui` `3.2.4 -> 4.1.6`

Warum separat:

- betrifft Root und Mobile gleichzeitig
- Test-Runner-Migrationen sollte man nicht mit Runtime-/API-Upgrades vermischen

### Batch 3: Mobile Persistenz bewusst separat

Status nach Umsetzung am 2026-05-14:

- technischer 3.x-Versuch wurde spaeter fuer Expo-Kompatibilitaet zurueckgenommen
- aktueller Zielzustand ist `@react-native-async-storage/async-storage` `2.2.0`
- dokumentarisch bleibt nur die manuelle Web-Persistenz-Pruefung fuer Settings/Theme/PDF offen; sie ist erst sinnvoll, wenn der Multi-Auth-Web-Flow fuer normale Nutzung belastbar funktioniert

- kein 3.x-Update in diesem Track

Gate:

- Offline-/Persistenztests
- Query-Cache-Restore
- PDF-/Theme-/Settings-/Server-URL-Pfade
- manuelle Persistenz-Pruefung im realen Web-Lauf erst nach belastbarer Multi-Auth-Web-Nutzung

### Batch 4a: Expo-SDK-56-Core-Slice

Status nach Umsetzung am 2026-06-01:

- Expo SDK 56, React `19.2.3`, React Native `0.85.3`, Reanimated `4.3.1`, Worklets `0.8.3`, TypeScript `~6.0.3`
- Expo Router SDK-56-Migration erledigt (`expo-router/react-navigation`, direkte `@react-navigation/native`-Dependency entfernt)
- Splash-Config-Migration ins `expo-splash-screen`-Config-Plugin erledigt
- `react-test-renderer` exakt auf `19.2.3` gepinnt
- Verifiziert mit Mobile-Typecheck, Mobile-Unit-Tests, RNTL-Guard, Expo-Gates, Web-Build, Root-Typecheck und Root-Unit-Tests

### Batch 4b: Warten auf stabilen Styling-Stack

- `tailwindcss` `3.4.19 -> 4.x`
- `nativewind` `4.2.4 -> 5.x`
- `react-native-css`

Entscheidung:

- Noch **nicht** jetzt.
- Tailwind 4 ist stabil, aber der relevante NativeWind-v5-Pfad ist am 2026-06-01 weiter `preview` (`5.0.0-preview.4`), waehrend `nativewind@latest` `4.2.4` ist.

### Batch 5: Naechster Expo-SDK-Block

Status 2026-06-01:

- Der SDK-56-Block ist erledigt.
- Naechste Expo-/React-/React-Native-Latest-Abweichungen werden erst mit der naechsten Expo-SDK-Kompatibilitaetslinie gezogen.
- React `19.2.6`, React DOM `19.2.6`, `react-test-renderer@19.2.6` und neuere `react-native-*` Latest-Linien sind keine Einzelupdates im aktuellen SDK-56-Stand.

Mit dem naechsten stabilen Expo-SDK gemeinsam werden wieder `react`, `react-dom`, `react-native`, `react-native-web`, `react-native-*` und mehrere `expo-*` Pakete bewertet.

Entscheidung:

- Nicht als nackte Einzelupdates fahren.
- Immer ueber `expo install`, `expo-doctor`, `build:web`, Mobile-Typecheck und Mobile-Tests absichern.
- `react-native-web` bleibt ausdruecklich in diesem Block und wird nicht vorgezogen.

## Offene Risiken

- `northflank/deploy-to-northflank@v1` ist aktuell der schwaechste Punkt im CI-Hygiene-Track; moeglicherweise bleibt hier vorerst nur Dokumentation oder ein spaeterer Deploy-Mechanismus-Wechsel.
- `tailwindcss@4` ist zwar selbst stabil, aber fuer unser React-Native-Setup noch nicht die beste Produktionsentscheidung.
- `react-native-reanimated@4.4.x` und `react-native-worklets@0.9.x` sind aktuell keine normalen Paket-Updates, sondern an die Expo-Kompatibilitaetslinie gekoppelt.
- Weitere Root- und Mobile-Patches duerfen nur mit den bestehenden Gates laufen; sie sollen nicht mit Multi-User/Auth vermischt werden.

## Ausfuehrungsregel

- `Batch 0` und `Batch 1` laufen **strictly sequential**, nicht parallel.
- Urspruengliche Regel: Erst wenn `Batch 0` abgeschlossen und verifiziert ist, startet `Batch 1`.
- Ist-Stand 2026-06-01: Die Reihenfolge ist historisch nachgezogen; GitHub-eigene Workflow-Actions sind modernisiert, der SDK-56-Core-Slice ist erledigt, der Northflank-Sonderfall bleibt separat.
- Diese Trennung ist bewusst boring: Workflow-/Deploy-Fehler und App-/Compiler-Fehler sollen nicht im selben Schritt debuggt werden.

## Konkrete naechste Aktion

Wenn wir vom Stand 2026-06-01 weiter modernisieren, ist die Reihenfolge:

1. Northflank-Deploy-Pfad separat neu bewerten.
2. Tailwind-4/NativeWind-5 erst nach stabiler NativeWind-v5-Produktionslinie anfassen.
3. Naechste Expo-/React-/React-Native-Linien erst mit einer neuen Expo-SDK-Kompatibilitaetslinie ziehen.
4. Multi-User/Auth fachlich separat umsetzen; nicht mit weiteren Upgrade-Resten vermischen.
