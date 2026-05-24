# Next Priority Work Plan

Datum: 2026-05-24
Status: Draft

## Ausgangslage

Die aktuelle `TODO.md` priorisiert drei direkte naechste Arbeiten:

1. Coverage-Gates nach der Vitest-4-Migration wieder anziehen.
2. `JobManager`-Tests wieder auf echte Laufzeitlogik ziehen.
3. Supabase Data API Readiness fuer Multi-User vorbereiten.

Es gibt bereits relevante Vorarbeit:

- [2026-05-14-upgrade-review-findings-remediation-plan.md](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-05-14-upgrade-review-findings-remediation-plan.md) beschreibt Coverage- und `JobManager`-Remediation.
- [docs/supabase-data-api-readiness.md](/home/patrick/Projekte/rezepti/docs/supabase-data-api-readiness.md) beschreibt Grants, RLS und Tabellen-Boundaries fuer die spaetere Multi-User-Phase.
- [db/templates/public-table-data-api-rls.sql](/home/patrick/Projekte/rezepti/db/templates/public-table-data-api-rls.sql) ist die wiederverwendbare SQL-Vorlage fuer Data-API-faehige Tabellen.

Dieser Plan fuehrt die naechsten drei Punkte in eine umsetzbare Reihenfolge zusammen und ordnet die zusaetzlich offenen Punkte als Abhaengigkeiten oder Follow-ups ein.

## Ziel

Nach Umsetzung dieses Plans soll der naechste Arbeitsblock sauber abgeschlossen sein:

- Coverage-Gates sind wieder bewusst streng statt migrationsbedingt weich.
- `JobManager`-Tests pruefen reale Methodenpfade und koennen Runtime-Regressionen wieder finden.
- Die Supabase Data-API-/RLS-Vorarbeit ist konkret genug, dass danach Multi-User Login ohne Sicherheits- und Scope-Unklarheiten starten kann.

## Nicht-Ziele

- Kein Multi-User Login selbst. Auth, Session-Handling, UI-Flows und App-Umstellung auf `authenticated` bleiben die naechste grosse Phase.
- Kein Northflank-Deploy-Umbau. Das bleibt ein eigener Infra-Track.
- Keine Batch-4-Upgrades. Expo-SDK, Styling-Track, `react-native-worklets` und `reanimated` bleiben vertagt.
- Keine vollstaendige Migration von `react-test-renderer` auf `@testing-library/react-native`. Das bleibt ein spaeterer Test-Infra-Follow-up.

## Reihenfolge

### Phase 1: Coverage-Gates wieder anziehen

Betroffene Dateien:

- [vitest.config.ts](/home/patrick/Projekte/rezepti/vitest.config.ts)
- [mobile/vitest.config.ts](/home/patrick/Projekte/rezepti/mobile/vitest.config.ts)
- [TODO.md](/home/patrick/Projekte/rezepti/TODO.md)
- optional [docs/TEST_STATUS.md](/home/patrick/Projekte/rezepti/docs/TEST_STATUS.md)

Aufgaben:

- Root- und Mobile-Coverage-Baselines von `25` auf mindestens `30` anheben.
- Kommentare in beiden Vitest-Configs korrigieren, sodass `25` nicht mehr als akzeptierte Ziel-Linie dokumentiert ist.
- Den vorhandenen `COVERAGE_RATCHET_MIN`-Mechanismus beibehalten.
- Coverage lokal ausfuehren und nur dann einen Floor lockern, wenn ein echter Mess- oder Teststrukturgrund dokumentiert ist.
- `TODO.md` aktualisieren, wenn der Punkt erledigt ist.

Akzeptanzkriterien:

- Root- und Mobile-Coverage haben keinen Floor unter `30`.
- `npm`-/Vitest-Coverage-Laeufe bestehen lokal.
- Die Doku beschreibt den Stand als bewusste Qualitaetsentscheidung, nicht als Vitest-4-Nebeneffekt.

Verifikation:

```bash
npm run test:coverage
npm run test:mobile:coverage
```

Falls die Skriptnamen abweichen, zuerst `package.json` und `mobile/package.json` pruefen und die repo-eigenen Coverage-Skripte verwenden.

### Phase 2: `JobManager`-Tests auf Runtime-Wert bringen

Betroffene Dateien:

- [src/job-manager.ts](/home/patrick/Projekte/rezepti/src/job-manager.ts)
- [test/unit/job-manager.test.ts](/home/patrick/Projekte/rezepti/test/unit/job-manager.test.ts)

Aufgaben:

- Einen kleinen Test-Seam fuer deterministischen Zustand schaffen, ohne Produktionspfade zu verbiegen.
- Tests direkt gegen `JobManager`-Methoden schreiben statt gegen nachgebaute Typen, Literale oder lokale Helper.
- Mindestens diese Pfade abdecken:
  - `createJob`
  - `startJob`
  - `updateJob`
  - `completeJob`
  - `failJob`
  - `getJob`
  - `getRecentJobs`
  - `getActiveJobs`
  - `isUrlProcessing`
  - `getJobEventsSince`
  - `cleanupOldJobs`
- Zeitabhaengige Assertions robust machen. Wenn noetig `vi.setSystemTime()` verwenden.

Empfohlener Test-Seam:

- Eine explizite Test-/Factory-API ist besser als Zugriff auf private Maps.
- Moegliche kleine Loesung: `static createForTest()` oder `resetForTest()` mit klarer Benennung.
- Der exportierte Singleton `jobManager` bleibt fuer Produktionscode unveraendert.

Akzeptanzkriterien:

- Ein Fehler in den echten Methoden aus `src/job-manager.ts` kann die Tests brechen.
- Der Test prueft reale Zustandsuebergaenge und Lookup-Verhalten.
- Alte Typform-/Literaltests sind entfernt oder nur noch dort vorhanden, wo sie echten Wert haben.

Verifikation:

```bash
npx vitest run test/unit/job-manager.test.ts
npm test -- --run --exclude="test/e2e/**"
```

### Phase 3: Supabase Data API Readiness fuer Multi-User konkretisieren

Betroffene Dateien:

- [docs/supabase-data-api-readiness.md](/home/patrick/Projekte/rezepti/docs/supabase-data-api-readiness.md)
- [db/templates/public-table-data-api-rls.sql](/home/patrick/Projekte/rezepti/db/templates/public-table-data-api-rls.sql)
- spaeter eine neue Migration unter `db/migrations/`

Aufgaben:

- Die Policy-Matrix aus dem Readiness-Dokument in eine konkrete Migrationsskizze ueberfuehren.
- Tabellenklassifikation festhalten:
  - `recipes`: Data API fuer `authenticated`, eigene Rezepte plus ggf. globale Default-Rezepte lesbar.
  - `shopping_list`: Data API fuer `authenticated`, nur eigene Zeilen.
  - `meal_plan`: Data API fuer `authenticated`, nur eigene Zeilen.
  - `api_keys`: backend-only, keine Data-API-Grants.
  - `ingredient_dictionary`: vorerst backend-only; spaeter maximal read-only fuer `authenticated`, wenn ein echter Clientfall entsteht.
- Grants, Sequence-Grants und RLS-Policies pro Tabelle explizit planen.
- Vor der echten Migration pruefen, ob `user_id` fuer die relevanten Tabellen ausreichend gesetzt oder migrationsfaehig ist.
- Auth-Token-Verifikation als Abnahmekriterium fuer die spaetere Multi-User-Phase definieren.

Security-Regeln:

- Keine `service_role`- oder Secret-Keys im Client.
- Keine Authorization auf `user_metadata` stuetzen.
- `UPDATE`-Policies brauchen auch passende `SELECT`-Policies.
- Keine `security definer`-Funktionen in exponierten Schemas einfuehren.

Akzeptanzkriterien:

- Es gibt eine konkrete, reviewbare RLS-/Grant-Migrationsskizze fuer `recipes`, `shopping_list` und `meal_plan`.
- Backend-only-Tabellen sind explizit vom Data-API-Scope ausgeschlossen.
- Die spaetere Multi-User-Umsetzung kann gegen diese Matrix implementieren, ohne die Sicherheitsentscheidung neu zu erfinden.

Verifikation fuer die spaetere Umsetzung:

```bash
supabase --version
supabase db advisors --help
```

Die eigentliche DB-Verifikation erfolgt erst beim Migrationsarbeitsblock mit aktueller Supabase-CLI oder MCP/SQL-Fallback.

## Zusaetzliche offene Punkte und Einordnung

### Nightly-Strict-Beobachtung

Einordnung: Betriebsroutine, kein Blocker fuer Phasen 1-3.

Aktion:

- Nightly-Runs weiter beobachten.
- Bei roten Strict-Runs Root Cause analysieren.
- Bei stabil gruenen Runs spaeter `pull_request`-Strict-Eskalation separat entscheiden.

### Test-Infra-Migration auf `@testing-library/react-native`

Einordnung: Follow-up nach Phase 2.

Warum nicht jetzt:

- Phase 2 soll den konkreten `JobManager`-Testwert reparieren.
- Ein Test-Framework-Umbau hat groesseren Blast Radius und loest den `JobManager`-Runtime-Gap nicht direkt.

### Northflank-Deploy-Pfad

Einordnung: eigener Infra-Track.

Warum nicht jetzt:

- Das Risiko liegt in einem Deploy-Pfad und Upstream-Sonderfall, nicht in Coverage, Runtime-Tests oder Supabase-Readiness.
- Eine stille Mitnahme wuerde den naechsten Arbeitsblock unnoetig verbreitern.

### Batch 4 Expo-/Styling-Track

Einordnung: bewusst vertagt.

Warum nicht jetzt:

- SDK-/Peer-Compatibility ist ein eigener Upgrade-Block.
- `react-native-worklets`/`reanimated`, Tailwind 4 und NativeWind 5 brauchen stabile Leitplanken und separate Abnahme.

### Batch 3 manuelle Persistenz-Abnahme

Einordnung: kleine manuelle Abnahme, kann nach Phase 1 oder Phase 2 eingeschoben werden.

Aktion:

- App-Neustart fuer Settings, Theme und PDF-Pfad manuell pruefen.
- Ergebnis in `TODO.md` oder `docs/TEST_STATUS.md` nachziehen.

## Empfohlene Umsetzungstakte

1. Coverage-Floors anheben und Coverage laufen lassen.
2. `JobManager`-Test-Seam und Runtime-Tests umsetzen.
3. Supabase-RLS-/Grant-Migrationsskizze als Doku oder SQL-Draft konkretisieren.
4. `TODO.md` aktualisieren.
5. Optional Batch-3-Neustartpruefung manuell nachziehen.

## Abschluss-Gates

Vor Abschluss des Arbeitsblocks:

```bash
npm run test:unit
npm test -- --run --exclude="test/e2e/**"
npm run test:coverage
npm run mobile:typecheck
npm run test:mobile
npm run test:mobile:coverage
```

Wenn ein Skriptname nicht existiert, gilt die lokale `package.json` als Quelle der Wahrheit.

## Risiken

- Coverage `>=30` kann sofort rot werden, wenn die Vitest-4-Messwerte knapper sind als dokumentiert. Dann nicht blind lockern, sondern zuerst fehlende oder entwertete Tests identifizieren.
- `JobManager` nutzt ein Singleton. Tests muessen isoliert sein, sonst entstehen Reihenfolge-Abhaengigkeiten.
- Supabase-Policies koennen bei fehlender `SELECT`-Policy Updates scheinbar still auf 0 Rows reduzieren. Das muss in der spaeteren DB-Verifikation explizit getestet werden.
- Multi-User-Datenmigration kann unklar werden, wenn bestehende globale/null-`user_id`-Daten nicht bewusst klassifiziert werden.

## Entscheidung

Dieser Plan behandelt die Punkte 1-3 als einen zusammenhaengenden Qualitaets- und Readiness-Block. Multi-User Login startet erst danach als eigene Phase.
