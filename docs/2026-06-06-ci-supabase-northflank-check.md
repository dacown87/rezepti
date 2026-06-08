# CI / Supabase / Northflank Check

Stand: 2026-06-08

Diese Datei sammelt den aktuellen Betriebsbefund fuer GitHub CI, Supabase und Northflank sowie den naechsten Vorgehensplan.

## Kurzfazit

- Der akute CI-Blocker im `mobile-release-gate` ist lokal behoben.
- Die Expo-SDK-56-Patch-Drift im Mobile-Projekt wurde auf die von `expo-doctor` erwarteten Versionen angehoben.
- Der Mobile-Coverage-Upload ist nach aktuellem Repo-Stand kein eigener Defekt, sondern nur ein Folgefehler des fruehen Abbruchs vor `Run mobile coverage`.
- Supabase Staging ist weiter gruen; Northflank bleibt funktional gruen.
- Der fruehere GitHub-Actions-Warnfall rund um `northflank/deploy-to-northflank@v1` wurde am 2026-06-08 durch einen direkten API-Deploy in `.github/workflows/docker-publish.yml` entfernt.

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

Folgende lokale Verifikation lief am 2026-06-06 erfolgreich durch:

- `npm --prefix mobile ci`
- `cd mobile && CI=1 npx expo-doctor`
- `npm run test:mobile:rntl-guard`
- `npm --prefix mobile run typecheck`
- `npm --prefix mobile run build:web`
- `npm --prefix mobile run test:coverage`

Ergebnis:

- `expo-doctor`: gruen, `21/21 checks passed`
- Mobile-Typecheck: gruen
- Mobile-Web-Export: gruen
- Mobile-Coverage: gruen, `92/92` Tests bestanden
- `artifacts/coverage/mobile/**` wurde lokal erzeugt

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
