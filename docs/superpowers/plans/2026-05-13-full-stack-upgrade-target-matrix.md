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
- Mobile bleibt auf Expo SDK 55. `npm outdated` zeigt SDK-56-/React-/React-Native-Latest-Versionen, aber `expo install --check` meldet fuer SDK 55 keine noetigen Aenderungen.
- Mobile-TypeScript bleibt auf `5.9.3`; der fruehere Zielwert `6.0.3` wurde wegen Expo-SDK-55-Kompatibilitaet verworfen.
- AsyncStorage bleibt auf `2.2.0`; der fruehere Zielwert `3.x` wurde ebenfalls wegen Expo-SDK-55-Kompatibilitaet verworfen.
- Supabase CLI ist inzwischen lokal `2.102.0`.
- Offen sind nur kleine Root-/Mobile-Patches innerhalb bestehender Linien und separate Spaeter-Tracks: Northflank-Deploy-Pfad, Expo-SDK-56-Block, Tailwind-4/NativeWind-5, Reanimated/Worklets.

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
| Mobile-Plattform | Expo SDK | `55.0.26` | `56.0.8` laut npm latest | `55.x` aktuell halten | `expo install --check` ist gruen; SDK 56 ist ein eigener Upgrade-Block. |
| Mobile-Plattform | React | `19.2.0` | `19.2.6` | bei SDK `55` auf `19.2.0` bleiben | `npm latest` ist hier nicht die Entscheidungsinstanz; Expo 55 dokumentiert `19.2.0`. |
| Mobile-Plattform | React DOM | `19.2.0` | `19.2.6` | bei SDK `55` auf `19.2.0` bleiben | Gleiche Begruendung wie bei `react`. |
| Mobile-Plattform | React Native | `0.83.6` | `0.85.3` | bei SDK `55` auf `0.83.x` bleiben | React Native direkt hochziehen waere im Expo-Projekt die falsche Upgrade-Achse. |
| Mobile-Plattform | React Native Web | `~0.21.0` | `0.21.2` | mit naechstem Expo-SDK-Block ziehen | Bleibt bewusst in der Expo-Achse; keine Sonderregel vor dem SDK-Track. |
| Backend | `hono` | `4.12.18` | `4.12.23` | Patch optional | Kleiner Root-Patch-Slice. |
| Backend | `@hono/node-server` | `2.0.2` | `2.0.4` | Patch optional | Major ist erledigt; Patch kann in kleinem Root-Patch-Slice mitlaufen. |
| Tooling | Root `typescript` | `6.0.3` | `6.0.3` | `6.0.3` | Bereits aktuell. |
| Tooling | Mobile `typescript` | `5.9.3` | `6.0.3` | `5.9.x` bei SDK 55 halten | TS 6 wurde als Ziel verworfen, weil Expo-SDK-55-Kompatibilitaet wichtiger ist. |
| Tooling | `vite` | `8.0.12` | `8.0.14` | Patch optional | Kleiner Root-Patch-Slice, kein Framework-Block. |
| Tooling | `vitest` | `4.1.6` | `4.1.7` | Patch optional | Major ist erledigt; Patch nur zusammen mit Root/Mobile-Test-Gates. |
| Tooling | `@vitest/coverage-v8` | `4.1.6` | `4.1.7` | Patch optional | Mit `vitest` gemeinsam ziehen. |
| Tooling | `@vitest/ui` | `4.1.6` | `4.1.7` | Patch optional | Mit `vitest` gemeinsam ziehen. |
| Mobile-Data | `@tanstack/react-query` | `5.100.10` | `5.100.14` | Patch optional | Kleiner Mobile-Patch-Slice innerhalb SDK 55. |
| Mobile-Data | `@tanstack/react-query-persist-client` | `5.100.10` | `5.100.14` | Patch optional | Mit TanStack gemeinsam ziehen. |
| Mobile-Data | `@tanstack/query-async-storage-persister` | `5.100.10` | `5.100.14` | Patch optional | Mit TanStack gemeinsam ziehen. |
| Mobile-Infra | `@react-navigation/native` | `^7.1.33`, installiert `7.2.4` | `7.2.5` | Patch optional, nur mit Mobile-Gates | Der vorherige direkte Versionssprung wurde fuer Expo-Kompatibilitaet begrenzt. |
| Mobile-Infra | `@react-native-async-storage/async-storage` | `2.2.0` | `3.1.1` | `2.2.0` bei SDK 55 halten | 3.x bleibt nicht Ziel dieses Tracks; Expo-Doctor-/SDK-Kompatibilitaet gewinnt. |
| Mobile-Animation | `react-native-reanimated` | `4.2.1` | `4.4.0` | vorerst `4.2.1` | Neuere Linien haengen an neuerem Worklets-/Expo-Track. |
| Mobile-Animation | `react-native-worklets` | `0.7.4` | `0.9.1` | vorerst `0.7.4` | Harter Expo-/Peer-Blocker fuer den Reanimated-Schritt. |
| Mobile-Infra | `react-native-gesture-handler` | `~2.30.0`, installiert `2.30.1` | `3.0.0` | mit naechstem Expo-SDK-Block ziehen | Nicht einzeln vor der SDK-Linie. |
| Mobile-Infra | `react-native-safe-area-context` | `~5.6.0`, installiert `5.6.2` | `5.8.0` | mit naechstem Expo-SDK-Block ziehen | Expo-gesteuert. |
| Mobile-Infra | `react-native-screens` | `~4.23.0` | `4.25.2` | mit naechstem Expo-SDK-Block ziehen | Expo-gesteuert. |
| Mobile-Infra | `react-native-svg` | `15.15.3` | `15.15.5` | mit naechstem Expo-SDK-Block ziehen | Expo-gesteuert. |
| Mobile-Test | `react-test-renderer` | `19.2.0` | `19.2.6` | mittelfristig entfernen statt nur patchen | Die eigentliche Richtung bleibt `@testing-library/react-native`. |
| Styling | `nativewind` | `4.2.3` | `4.2.4` | Patch optional, v5 spaeter | Stabile Produktionslinie bleibt v4; v5/Tailwind-4 bleibt eigener Track. |
| Styling | `tailwindcss` | `3.4.19` | `4.3.0` | vorerst `3.4.19` | Tailwind 4 ist stabil, aber der NativeWind-v5-Pfad dafuer ist noch nicht produktionsreif. |
| Mobile-Test | `@testing-library/react-native` | `13.3.3` | `13.3.3` | `13.3.3` | Bereits aktuell. |
| Backend/Data | `drizzle-orm` | `0.45.2` | `0.45.2` | `0.45.2` | Bereits aktuell. |
| Backend/Data | `drizzle-kit` | `0.31.10` | `0.31.10` | `0.31.10` | Bereits aktuell. |
| Backend/API | `openai` | `6.37.0` | `6.39.1` | Patch optional | Kleiner Root-Patch-Slice; nicht mit Auth-Umbau vermischen. |
| Backend/API | `zod` | `4.4.3` | `4.4.3` | `4.4.3` | Bereits aktuell. |
| Backend/API | `supabase` CLI-Paket | `2.102.0` | `2.102.0` lokal verifiziert | `2.102.x` halten | Wurde fuer Advisor-Arbeit aktualisiert und ist aktueller Repo-Stand. |
| Build/Test | `lighthouse` | `13.3.0` | `13.3.0` | `13.3.0` | Bereits aktuell. |
| Build/Test | `tsx` | `4.21.0` | `4.22.4` | Patch optional | Kleiner Root-Patch-Slice. |
| UI | `lucide-react-native` | `1.14.0` | `1.17.0` | Patch optional | Kleiner Mobile-Patch-Slice mit visueller Smoke-Pruefung. |

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

Status nach Nachpruefung am 2026-05-31:

- `@hono/node-server` `1.19.14 -> 2.0.2` ist erledigt.
- Mobile-TypeScript wurde bewusst **nicht** auf `6.0.3` gehalten, sondern fuer Expo-SDK-55-Kompatibilitaet auf `5.9.3` zurueckgefuehrt.
- Offener Rest ist nur ein kleiner Root-Patch-Slice (`@hono/node-server` `2.0.4`, `hono` `4.12.23`, `vite` `8.0.14`, `tsx` `4.22.4`, `openai` `6.39.1`, `@types/node` `25.9.1`) mit normalen Root-Gates.

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

- technischer 3.x-Versuch wurde spaeter fuer Expo-SDK-55-Kompatibilitaet zurueckgenommen
- aktueller Zielzustand ist `@react-native-async-storage/async-storage` `2.2.0`
- dokumentarisch bleibt nur die manuelle App-Neustart-Pruefung fuer Settings/Theme/PDF offen

- kein 3.x-Update in diesem Track

Gate:

- Offline-/Persistenztests
- Query-Cache-Restore
- PDF-/Theme-/Settings-/Server-URL-Pfade
- manuelle Neustart-Pruefung auf einem realen App-Lauf

### Batch 4: Warten auf stabilen Styling-Stack

- `tailwindcss` `3.4.19 -> 4.x`
- `nativewind` `4.2.3 -> 5.x`

Entscheidung:

- Noch **nicht** jetzt.
- Tailwind 4 ist stabil, aber der relevante NativeWind-v5-Pfad ist laut offizieller Doku weiter `pre-release`.

### Batch 5: Naechster Expo-SDK-Block

Status 2026-05-31:

- `npm --prefix mobile outdated --depth=0` zeigt Expo-SDK-56-Latest-Versionen.
- `cd mobile && npx expo install --check` meldet fuer den aktuellen SDK-55-Stand: Dependencies are up to date.
- Deshalb bleibt SDK 56 ein eigener spaeterer Block, nicht Teil kleiner Patch-Wellen.

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
- `react-native-reanimated@4.4.x` ist aktuell kein normales Paket-Update, sondern durch `react-native-worklets` an die Expo-Kompatibilitaetslinie gekoppelt.
- Kleine Root- und Mobile-Patches duerfen nur mit den bestehenden Gates laufen; sie sollen nicht mit Multi-User/Auth vermischt werden.

## Ausfuehrungsregel

- `Batch 0` und `Batch 1` laufen **strictly sequential**, nicht parallel.
- Urspruengliche Regel: Erst wenn `Batch 0` abgeschlossen und verifiziert ist, startet `Batch 1`.
- Ist-Stand 2026-05-31: Die Reihenfolge ist historisch nachgezogen; GitHub-eigene Workflow-Actions sind modernisiert, der Northflank-Sonderfall bleibt separat.
- Diese Trennung ist bewusst boring: Workflow-/Deploy-Fehler und App-/Compiler-Fehler sollen nicht im selben Schritt debuggt werden.

## Konkrete naechste Aktion

Wenn wir vom Stand 2026-05-31 weiter modernisieren, ist die Reihenfolge:

1. Kleiner Root-Patch-Slice: `hono`, `@hono/node-server`, `vite`, `vitest`/`@vitest/*`, `tsx`, `openai`, `@types/node`.
2. Kleiner Mobile-Patch-Slice innerhalb SDK 55: TanStack-Patches, `@react-navigation/native`, `nativewind` v4-Patch, `lucide-react-native`, Vitest-Patch.
3. Northflank-Deploy-Pfad separat neu bewerten.
4. Expo-SDK-56-Upgrade separat planen, inklusive React/RN, Expo-Paketen, Reanimated/Worklets und Web-Build.
5. Tailwind-4/NativeWind-5 erst nach stabiler NativeWind-v5-Produktionslinie anfassen.
