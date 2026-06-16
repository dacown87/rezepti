# CI / Supabase / Northflank Check

Stand: 2026-06-16

Diese Datei sammelt den aktuellen Betriebsbefund fuer GitHub CI, Supabase und Northflank sowie den naechsten Vorgehensplan. Der detaillierte Arbeitsplan zum aktuellen Stand liegt in [2026-06-15-ci-supabase-northflank-execution-plan.md](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-06-15-ci-supabase-northflank-execution-plan.md).

## Kurzfazit

- PR #19 `v1.0.166 fix(ci): restore root and mobile release gates` wurde am 2026-06-16 gemergt.
- Der zuvor offene Push-CI-Track ist damit remote verifiziert: PR-Checks `27599696794` und Push-CI auf `main` `27599914223` waren gruen.
- Die nachgelagerten Docker-/Deploy-Runs `27599914284` und `27599929657` waren ebenfalls gruen; Northflank bleibt nach aktuellem Remote-Stand funktional gruen.
- `supabase-rls-smoke` ist im relevanten PR-/Push-Lauf gruen.
- Der fruehere Deploy-Hygiene-Follow-up `post-deploy health poll` ist jetzt umgesetzt; der sichtbare Workflow-Step `Poll Northflank health` nutzt dafuer das GitHub-Secret `NORTHFLANK_HEALTHCHECK_URL`.

## Update 2026-06-16

### Remote-Nachweis abgeschlossen

- PR: [#19](https://github.com/dacown87/rezepti/pull/19) `v1.0.166 fix(ci): restore root and mobile release gates`
- Merge-Zeit: `2026-06-16T06:55:44Z`
- PR-Checks Run: `27599696794`
  - `test`: gruen
  - `mobile-release-gate`: gruen
  - `supabase-rls-smoke`: gruen
  - `performance-audit`: gruen
  - `e2e`: gruen
  - `e2e-legacy-soak`: beim PR erwartbar skipped
- Push-CI auf `main`: `27599914223` gruen
- Docker Build/Push + Northflank Deploy auf `main`: `27599914284` gruen
- Nachgelagerter `workflow_run`-Deploy: `27599929657` gruen

### Konsequenz

- Der bisher offene CI-/Supabase-/Northflank-Remote-Beweis ist erbracht.
- Northflank ist fuer diesen Track nicht mehr blockierend.
- Der fruehere Infra-Polish ist jetzt umgesetzt: Nach dem Northflank-Deploy-API-Call pollt der Workflow `/api/v1/health` mit Retry-Schleife, statt nur auf ein API-`2xx` zu vertrauen.

### Update 2026-06-16 — Health Poll umgesetzt

- GitHub-Secret `NORTHFLANK_HEALTHCHECK_URL` wurde fuer die aktuelle Prod-URL gesetzt.
- `.github/workflows/docker-publish.yml` nutzt das Secret jetzt im separaten Workflow-Step `Poll Northflank health`.
- Nach erfolgreichem Northflank-API-Call prueft der Workflow die Health-URL bis zu 10 Mal mit je 15 Sekunden Abstand.
- Fehlt das Secret oder bleibt der Health-Endpunkt rot/nicht erreichbar, failt der Deploy-Job explizit.

## Update 2026-06-15

### Remote-Stand

- Lokaler `main` ist aktuell `ahead 2, behind 1` gegen `origin/main`.
- `origin/main` steht auf `9006fae` (`chore: v1.0.165 [skip ci]`).
- Der aktuelle CI-Track darf deshalb nicht nur gegen den lokalen Stand bewertet werden; der Remote-Beweis bleibt notwendig.

### Letzter roter Push-Run

- Run: `27566390926`
- Trigger: `push`
- Zeit: `2026-06-15T18:08:43Z`

Rote Jobs:

- `test`
  - failt in `Run unit coverage`
  - `Upload root coverage artifacts` ist Folgefehler
- `mobile-release-gate`
  - failt in `Run Expo Doctor`
  - `Upload mobile coverage artifacts` ist Folgefehler

Gruene Jobs:

- `supabase-rls-smoke`
- `performance-audit`
- `e2e`

### Letzter roter Scheduled-Run

- Run: `27529833799`
- Trigger: `schedule`
- Zeit: `2026-06-15T07:06:42Z`

Rote Jobs:

- `performance-audit`
  - failt in `Validate performance status`
- `e2e-legacy-soak`
  - failt in `Run E2E legacy soak`

Gruene Jobs:

- `test`
- `mobile-release-gate`
- `supabase-rls-smoke`
- `e2e`

### Lokale Reproduktion

- `npm run test:coverage` ist am 2026-06-15 lokal reproduzierbar rot.
- Konkreter Fehler:
  - `test/unit/photo-extraction.test.ts`
  - die Erwartung fuer `mockCreateJob` ist veraltet
  - aktuell kommt ein zusaetzliches fuenftes Argument `null`
- Das ist derzeit die direkt reproduzierbare Hauptursache im Push-CI-Track.

### Arbeitsentscheidung

- Push-CI-Fixes zuerst:
  - `test`-Job lokal wieder gruen bekommen
  - `mobile-release-gate` danach gezielt gegen den aktuellen Stand verifizieren
- Nightly-/Schedule-Themen separat behandeln:
  - `performance-audit` strict
  - `e2e-legacy-soak`
- Supabase und Northflank bleiben aktuell Beobachtungspfade, nicht primaere Fix-Baustellen.

## GitHub CI

### Aktueller roter Run

- Workflow: `CI`
- Run: `27069886762`
- Branch: `main`
- Datum: 2026-06-06
- Roter Job: `mobile-release-gate`

### Harte Ursache

`expo-doctor` blockiert den Job wegen SDK-Patch-Drift im Mobile-Projekt:

- `expo` erwartet `~56.0.9`, gefunden `56.0.8`
- `expo-constants` erwartet `~56.0.17`, gefunden `56.0.16`
- `expo-image-manipulator` erwartet `~56.0.17`, gefunden `56.0.16`
- `expo-image-picker` erwartet `~56.0.16`, gefunden `56.0.15`
- `expo-router` erwartet `~56.2.9`, gefunden `56.2.8`
- `expo-sharing` erwartet `~56.0.16`, gefunden `56.0.15`

### Umgesetzter Fix

In [mobile/package.json](/home/patrick/Projekte/rezepti/mobile/package.json) und [mobile/package-lock.json](/home/patrick/Projekte/rezepti/mobile/package-lock.json) wurden die betroffenen Expo-Pakete auf die erwarteten Patch-Versionen angehoben:

- `expo` -> `~56.0.9`
- `expo-constants` -> `~56.0.17`
- `expo-image-manipulator` -> `~56.0.17`
- `expo-image-picker` -> `~56.0.16`
- `expo-router` -> `~56.2.9`
- `expo-sharing` -> `~56.0.16`

### Verifikation nach Fix

Folgende lokale Verifikation lief am 2026-06-08 erfolgreich durch:

- `npm --prefix mobile ci`
- `cd mobile && npx expo install --check`
- `cd mobile && CI=1 npx expo-doctor`
- `npm run test:mobile:rntl-guard`
- `npm --prefix mobile run typecheck`
- `npm --prefix mobile run build:web`
- `npm --prefix mobile run test:coverage`
- `npm run mobile:release-gate`

Ergebnis:

- `expo-doctor`: gruen, `21/21 checks passed`
- `expo install --check`: `Dependencies are up to date`
- Mobile-Typecheck: gruen
- Mobile-Web-Export: gruen
- Mobile-Coverage: gruen, `102/102` Tests bestanden
- Lokales `mobile-release-gate`: gruen
- `artifacts/coverage/mobile/**` wurde lokal erzeugt

### Separater Dependency-Patch-Slice (2026-06-08)

Safe Patch-Upgrades, bewusst ohne neue Expo-/SDK-Linie:

- Root: `@supabase/supabase-js` `2.108.0`, `@vitest/coverage-v8` `4.1.8`, `@vitest/ui` `4.1.8`, `concurrently` `10.0.3`, `happy-dom` `20.10.2`, `hono` `4.12.24`, `openai` `6.42.0`, `supabase` `2.105.0`, `vite` `8.0.16`, `vitest` `4.1.8`
- Mobile: `@supabase/supabase-js` `2.108.0`, `@tanstack/query-async-storage-persister` `5.101.0`, `@tanstack/react-query` `5.101.0`, `@tanstack/react-query-persist-client` `5.101.0`, `@vitest/coverage-v8` `4.1.8`, `vitest` `4.1.8`

Nicht gezogen:

- Expo-/SDK-gebundene Latest-Linien
- `react` / `react-dom` / `react-test-renderer` `19.2.7`
- `@react-native-async-storage/async-storage` `3.1.1`
- `tailwindcss` `4.x`
- `nativewind` Patch bleibt separater Styling-Track

Lokale Verifikation fuer diesen Slice:

- `npx tsc --noEmit`
- `npm run test:auth`
- `cd mobile && npx expo install --check`
- `cd mobile && CI=1 npx expo-doctor`
- `npm run mobile:release-gate`

### Sekundaere Hinweise

- `Upload mobile coverage artifacts` failt im roten Run nur deshalb, weil `Run Expo Doctor` den Job vor `Run mobile coverage` stoppt und der Upload danach mit `if: always()` trotzdem ausgefuehrt wird.
- `npm --prefix mobile ci` meldet:
  - `text-encoding@0.7.0` deprecated
  - `12 moderate severity vulnerabilities`
- GitHub Actions meldete im Workflow-Kontext Node-20-Deprecation fuer einzelne Third-Party-Actions; die verbleibende Northflank-spezifische Warnquelle wurde am 2026-06-08 aus dem Deploy-Workflow entfernt.

### Historischer Kontext

Der vorherige rote CI-Run `27069239704` hatte zusaetzlich E2E-Vertragsfehler aus der alten oeffentlichen API-Erwartung. Dieser Teil wurde im Repo bereits korrigiert und ist nicht mehr der primaere Live-Blocker.

## Supabase

### Live-Pruefung 2026-06-06

- `npm run supabase:rls-smoke:staging`: gruen
- `npx supabase db advisors --db-url "$STAGING_DATABASE_URL" --type security --level warn --fail-on none --output-format json`: `No issues found`
- `npx supabase db advisors --db-url "$STAGING_DATABASE_URL" --type performance --level warn --fail-on none --output-format json`: `No issues found`

### Einordnung

- Kein aktueller Staging-Fehler auf WARN-Level.
- Keine aktuelle RLS-Regression im abgesicherten Staging-Smoke sichtbar.
- Die aelteren `unused_index`- und `rls_enabled_no_policy`-Artefakte bleiben Dokumentations-/Hold-Themen und sind aktuell kein akuter WARN-Level-Befund.

### Operative Warnung

- Lokale Supabase CLI ist veraltet: installiert `v2.102.0`, verfuegbar `v2.105.0`.
- Kein akuter Handlungsbedarf in diesem Slice; Upgrade bleibt getrennte Maintenance-Arbeit, solange keine neuen CI-/Runtime-Signale auftauchen.

## Northflank

### Update 2026-06-08

- `.github/workflows/docker-publish.yml` deployt nicht mehr ueber `northflank/deploy-to-northflank@v1`.
- Der Workflow ruft Northflank jetzt direkt per `curl` gegen `POST /v1/projects/{projectId}/services/{serviceId}/deployment` auf.
- Hintergrund: Die Northflank-Action war upstream weiter auf `runs.using: node16` festgelegt und erzeugte dadurch die GitHub-Warnung zur Node-20-Deprecation / Node-24-Erzwingung.
- Folge: Der dokumentierte Northflank-Node-Runtime-Sonderfall ist fuer den aktuellen Workflow entfernt; offen bleibt nur normale Deploy-Hygiene.

### Live-Pruefung 2026-06-06

- Service: `rezepti-app`
- Deployment-Status: `COMPLETED`
- API-seitige `warnings`: `null`
- API-seitige `errors`: `null`

### Beobachtungen

- Runtime-Logs der letzten 24 Stunden zeigen keine echten App-`error`-/`warn`-Zeilen.
- Sichtbar sind mehrere kurze `Process terminated.`-Eintraege mit anschliessendem Neustart und erfolgreichem App-Start.
- Das Muster sieht eher nach Redeploy/Container-Rotation als nach fachlichem Runtime-Crash aus.
- `healthChecks` sind fuer den Service aktuell `null`.

### Deploy-Pfad / CI-Hygiene

Der GitHub-Deploy-Workflow ist funktional gruen. Der fruehere Action-Wrapper wurde entfernt; damit entfallen fuer diesen Pfad:

- `northflank/deploy-to-northflank@v1`
- GitHub-Warnung zur Node-20-Deprecation / Node-24-Erzwingung aus dieser Action
- Soft-Fehler beim Versionscheck der Northflank-Action

Weiter beobachten:

- echte Northflank-API-Fehler
- Auth-/Secret-Probleme im Workflow
- Runtime-Warnungen oder rote Deploys

### Entscheidung

- Northflank-Workflow-Fix ist umgesetzt.
- Begruendung: Der veraltete JavaScript-Action-Wrapper war die letzte dokumentierte Node-Runtime-Sonderquelle in diesem Deploy-Pfad.
- Naechster Schritt fuer Northflank nur noch bei echten Deploy-, API-, Secret- oder Runtime-Signalen.

## Abschlussstatus

1. Mobile-Paketdrift fuer Expo SDK 56: erledigt.
   - Patch-Versionen angehoben.
   - Lokale Gate-Bausteine erfolgreich verifiziert.
   - Der erfolgreiche Web-Export hat die getrackten `public/`-Artefakte neu erzeugt.

2. Mobile-Coverage-Artefaktpfad: bewertet, kein separater Fix noetig.
   - Nach gruenem Lauf wird `artifacts/coverage/mobile/**` korrekt erzeugt.
   - Der rote Upload war nur ein Folgefehler des fruehen Job-Abbruchs.

3. Northflank-Deploy-Pfad: am 2026-06-08 bereinigt.
   - Direkter API-Deploy ersetzt den veralteten Action-Wrapper.
   - Kein akuter Release- oder Runtime-Blocker sichtbar.

4. Supabase-Stand: keine Aenderung in diesem Slice.
   - Staging-Pruefungen bleiben gruen.
   - CLI-Upgrade ist kein kritischer Pfad und bleibt getrennte Maintenance-Arbeit.
