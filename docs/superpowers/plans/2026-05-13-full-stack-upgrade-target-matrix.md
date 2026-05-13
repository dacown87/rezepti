# Full-Stack Upgrade Target Matrix (2026-05-13)

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
| Runtime | npm | `>=11` | `11.14.1` | `11.14.1` | Sinnvoll als CI-/Dev-Basis, aber kein akuter Blocker. |
| Mobile-Plattform | Expo SDK | `55.0.24` | stabile SDK-Linie `55` | `55.x` aktuell halten | Nicht gegen Expo upgraden; naechster grosser Schritt ist der spaetere SDK-56-Block. |
| Mobile-Plattform | React | `19.2.0` | `19.2.6` | bei SDK `55` auf `19.2.0` bleiben | `npm latest` ist hier nicht die Entscheidungsinstanz; Expo 55 dokumentiert `19.2.0`. |
| Mobile-Plattform | React DOM | `19.2.0` | `19.2.6` | bei SDK `55` auf `19.2.0` bleiben | Gleiche Begruendung wie bei `react`. |
| Mobile-Plattform | React Native | `0.83.6` | `0.85.3` | bei SDK `55` auf `0.83.x` bleiben | React Native direkt hochziehen waere im Expo-Projekt die falsche Upgrade-Achse. |
| Mobile-Plattform | React Native Web | `~0.21.0` | `0.21.2` | mit naechstem Expo-SDK-Block ziehen | Bleibt bewusst in der Expo-Achse; keine Sonderregel vor dem SDK-Track. |
| Backend | `hono` | `4.12.18` | `4.12.18` | `4.12.18` | Bereits aktuell. |
| Backend | `@hono/node-server` | `1.19.14` | `2.0.2` | `2.0.2` | Kleinster offener Major, da lokal nur an einer Start-Stelle genutzt. |
| Tooling | Root `typescript` | `6.0.3` | `6.0.3` | `6.0.3` | Bereits aktuell. |
| Tooling | Mobile `typescript` | `~5.9.2` | `6.0.3` | `6.0.3` | Sinnvollster offener Compiler-Schritt; Root laeuft bereits auf TS 6. |
| Tooling | `vite` | `8.0.12` | `8.0.12` | `8.0.12` | Bereits aktuell. |
| Tooling | `vitest` | `3.2.4` | `4.1.6` | `4.1.6` | Stabile Major-Linie; betrifft Root und Mobile gleichzeitig. |
| Tooling | `@vitest/coverage-v8` | `3.2.4` | `4.1.6` | `4.1.6` | Mit `vitest` gemeinsam ziehen. |
| Tooling | `@vitest/ui` | `3.2.4` | `4.1.6` | `4.1.6` | Mit `vitest` gemeinsam ziehen. |
| Mobile-Data | `@tanstack/react-query` | `5.100.10` | `5.100.10` | `5.100.10` | Bereits aktuell. |
| Mobile-Data | `@tanstack/react-query-persist-client` | `5.100.10` | `5.100.10` | `5.100.10` | Bereits aktuell. |
| Mobile-Data | `@tanstack/query-async-storage-persister` | `5.100.10` | `5.100.10` | `5.100.10` | Bereits aktuell. |
| Mobile-Infra | `@react-navigation/native` | `7.2.4` | `7.2.4` | `7.2.4` | Bereits aktuell. |
| Mobile-Infra | `@react-native-async-storage/async-storage` | `2.2.0` | `3.0.2` | `3.0.2` | Updatebar, aber nur mit Persistenz-/Offline-Regressionstests. |
| Mobile-Animation | `react-native-reanimated` | `4.2.1` | `4.3.1` | vorerst `4.2.1` | `4.3.x` verlangt `react-native-worklets@0.8.x`; unter SDK 55 aktuell blockiert. |
| Mobile-Animation | `react-native-worklets` | `0.7.4` | `0.8.3` | vorerst `0.7.4` | Harter Expo-/Peer-Blocker fuer den Reanimated-Schritt. |
| Mobile-Infra | `react-native-gesture-handler` | `~2.30.0` | `2.31.2` | mit naechstem Expo-SDK-Block ziehen | Lieber nicht einzeln vor der SDK-Linie. |
| Mobile-Infra | `react-native-safe-area-context` | `~5.6.0` | `5.7.0` | mit naechstem Expo-SDK-Block ziehen | Expo-gesteuert. |
| Mobile-Infra | `react-native-screens` | `~4.23.0` | `4.25.0` | mit naechstem Expo-SDK-Block ziehen | Expo-gesteuert. |
| Mobile-Infra | `react-native-svg` | `15.15.3` | `15.15.5` | mit naechstem Expo-SDK-Block ziehen | Expo-gesteuert. |
| Mobile-Test | `react-test-renderer` | `19.2.0` | `19.2.6` | mittelfristig entfernen statt nur patchen | Die eigentliche Richtung bleibt `@testing-library/react-native`. |
| Styling | `nativewind` | `4.2.3` | `4.2.3` | `4.2.3` | Stabile Linie ist weiter v4; v5-Doku ist noch ausdruecklich `pre-release`. |
| Styling | `tailwindcss` | `3.4.19` | `4.3.0` | vorerst `3.4.19` | Tailwind 4 ist stabil, aber der NativeWind-v5-Pfad dafuer ist noch nicht produktionsreif. |
| Mobile-Test | `@testing-library/react-native` | `13.3.3` | `13.3.3` | `13.3.3` | Bereits aktuell. |
| Backend/Data | `drizzle-orm` | `0.45.2` | `0.45.2` | `0.45.2` | Bereits aktuell. |
| Backend/Data | `drizzle-kit` | `0.31.10` | `0.31.10` | `0.31.10` | Bereits aktuell. |
| Backend/API | `openai` | `6.37.0` | `6.37.0` | `6.37.0` | Bereits aktuell. |
| Backend/API | `zod` | `4.4.3` | `4.4.3` | `4.4.3` | Bereits aktuell. |
| Backend/API | `supabase` CLI-Paket | `2.98.2` | `2.98.2` | `2.98.2` | Bereits aktuell. |
| Build/Test | `lighthouse` | `13.3.0` | `13.3.0` | `13.3.0` | Bereits aktuell. |
| Build/Test | `tsx` | `4.21.0` | `4.21.0` | `4.21.0` | Bereits aktuell. |
| UI | `lucide-react-native` | `1.14.0` | `1.14.0` | `1.14.0` | Bereits aktuell. |

## Kurzfazit zum Snapshot

Die Matrix oben ist die einzige Wahrheitsquelle. Auf dem Snapshot vom `2026-05-13` sind viele Root- und Mobile-Linien bereits aktuell; offen bleiben vor allem gezielte Major-Spruenge, die CI-Runtime-Hygiene und die bewusst Expo-/SDK-gebundenen Mobile-Pakete.

Wichtig:

- `react`, `react-dom`, `react-native`, `react-native-web` und mehrere `react-native-*` Pakete sind **nicht** deshalb offen, weil wir sie vergessen haben, sondern weil Expo die gueltige Upgrade-Achse vorgibt.

## Empfehlung nach Upgrade-Batches

### Batch 0: CI Runtime Hygiene

Ziel:

- Die GitHub-Warnung `Node.js 20 is deprecated ... forced to run on Node.js 24` aus den Delivery-Workflows entfernen oder auf einen explizit dokumentierten Upstream-Sonderfall reduzieren.
- Delivery- und Changelog-Workflows auf aktuelle stabile Action-Linien bringen, bevor Code-Majors folgen.

Betroffene Workflows:

- [docker-publish.yml](/home/patrick/Projekte/rezepti/.github/workflows/docker-publish.yml)
- [changelog-update.yml](/home/patrick/Projekte/rezepti/.github/workflows/changelog-update.yml)

Zielversionen:

- `actions/checkout` `v4 -> v6`
- `actions/setup-node` `v4 -> v6`
- `docker/login-action` `v3 -> v4`
- `docker/build-push-action` `v6 -> v7`
- `northflank/deploy-to-northflank` bleibt vorerst `v1`

Warum so:

- `checkout`, `setup-node`, `docker/login-action` und `docker/build-push-action` haben heute stabile Node-24-Linien.
- `northflank/deploy-to-northflank` ist aktuell der Sonderfall: oeffentlich ist weiter nur `v1.0.0` sichtbar. Das Paket bleibt deshalb dokumentiert auf `v1`, bis es eine aktualisierte Runtime-Linie oder einen besseren Deploy-Pfad gibt.
- `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` bleibt ein Uebergangs-Hebel, nicht das Endziel.

Verifikation / Exit-Kriterien:

- `docker-publish.yml` und `changelog-update.yml` laufen nach dem Versionszug weiter erfolgreich.
- `push -> Update Changelog & Version -> Build & Push Docker Image` bleibt funktional intakt.
- Die Node-20-Deprecation-Warnung verschwindet fuer die first-party- und Docker-Actions.
- Falls die Warnung nur noch vom Northflank-Action kommt, wird das explizit als dokumentierter Upstream-Sonderfall akzeptiert.
- `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` kann entfernt werden, sobald keine kompatibilitaetsrelevanten Alt-Actions mehr davon abhaengen.

### Batch 1: Kleinster Code-Track nach Batch 0

- `@hono/node-server` `1.19.14 -> 2.0.2`
- `mobile/typescript` `5.9.x -> 6.0.3`

Warum zuerst:

- kleinster Blast Radius
- sauber verifizierbar
- bringt den Stack auf modernere stabile Linien ohne Expo-Achse anzufassen
- ist bewusst **nach** Batch 0 geplant, damit Delivery-Probleme und Code-/Compiler-Probleme nicht vermischt werden

### Batch 2: Danach als Tooling-Welle

- `vitest` `3.2.4 -> 4.1.6`
- `@vitest/coverage-v8` `3.2.4 -> 4.1.6`
- `@vitest/ui` `3.2.4 -> 4.1.6`

Warum separat:

- betrifft Root und Mobile gleichzeitig
- Test-Runner-Migrationen sollte man nicht mit Runtime-/API-Upgrades vermischen

### Batch 3: Mobile Persistenz bewusst separat

- `@react-native-async-storage/async-storage` `2.2.0 -> 3.0.2`

Gate:

- Offline-/Persistenztests
- Query-Cache-Restore
- PDF-/Theme-/Settings-/Server-URL-Pfade

### Batch 4: Warten auf stabilen Styling-Stack

- `tailwindcss` `3.4.19 -> 4.x`
- `nativewind` `4.2.3 -> 5.x`

Entscheidung:

- Noch **nicht** jetzt.
- Tailwind 4 ist stabil, aber der relevante NativeWind-v5-Pfad ist laut offizieller Doku weiter `pre-release`.

### Batch 5: Nächster Expo-SDK-Block

Mit dem naechsten stabilen Expo-SDK gemeinsam:

- `react`
- `react-dom`
- `react-native`
- `react-native-web`
- `react-native-gesture-handler`
- `react-native-safe-area-context`
- `react-native-screens`
- `react-native-svg`
- `react-native-worklets`
- `react-native-reanimated`
- mehrere `expo-*` Pakete

Entscheidung:

- Nicht als nackte Einzelupdates fahren.
- Immer ueber `expo install`, `expo-doctor`, `build:web`, Mobile-Typecheck und Mobile-Tests absichern.
- `react-native-web` bleibt ausdruecklich in diesem Block und wird nicht vorgezogen.

## Offene Risiken

- `northflank/deploy-to-northflank@v1` ist aktuell der schwaechste Punkt im CI-Hygiene-Track; moeglicherweise bleibt hier vorerst nur Dokumentation oder ein spaeterer Deploy-Mechanismus-Wechsel.
- `tailwindcss@4` ist zwar selbst stabil, aber fuer unser React-Native-Setup noch nicht die beste Produktionsentscheidung.
- `react-native-reanimated@4.3.x` ist aktuell kein normales Paket-Update, sondern durch `react-native-worklets@0.8.x` an die Expo-Kompatibilitaetslinie gekoppelt.
- `vitest@4` ist wahrscheinlich gut machbar, aber wegen zweier Testwelten (`root` und `mobile`) bewusst als eigener Batch zu behandeln.

## Ausfuehrungsregel

- `Batch 0` und `Batch 1` laufen **strictly sequential**, nicht parallel.
- Erst wenn `Batch 0` abgeschlossen und verifiziert ist, startet `Batch 1`.
- Diese Trennung ist bewusst boring: Workflow-/Deploy-Fehler und App-/Compiler-Fehler sollen nicht im selben Schritt debuggt werden.

## Konkrete naechste Aktion

Wenn wir den modernsten **stabilen** Startpunkt nehmen, ist die Reihenfolge:

1. `Batch 0`: CI Runtime Hygiene in `docker-publish.yml` und `changelog-update.yml`
2. `Batch 1`: `@hono/node-server` auf `2.0.2`
3. `Batch 1`: `mobile/typescript` auf `6.0.3`
4. `Batch 2`: `vitest`-Stack auf `4.1.6`
5. `Batch 3`: `@react-native-async-storage/async-storage` auf `3.0.2`
6. Expo-SDK-Upgrade separat planen
