# E2E Legacy Flake Inventory (Phase A)

Stand: 2026-05-15  
Scope: `test:e2e:legacy:ci` (`test/e2e/basic-api.test.ts`, `test/e2e/react-api.test.ts`, `test/e2e/smoke.test.ts`)

Status-Update: Top-5 Kandidaten wurden nach `TODO.md` als konkrete Follow-up-TODOs uebernommen (inkl. Prio, Owner TBD, naechster Aktion, Abnahmekriterium); Top-2 sind dort als `P1 (sofort)` markiert.

## Datenlage

- Lokal liegt aktuell ein Legacy-JUnit-Report vor: `artifacts/test-reports/e2e-legacy-junit.xml`.
- In diesem Report sind keine Failures/Errors enthalten, aber `basic-api` und `react-api` sind komplett `skipped` (Server nicht verfuegbar via `describe.skipIf(!serverAvailable)`).
- Eine belastbare Nightly-Fehlerhistorie ist lokal nicht vorhanden; die folgenden Kandidaten sind deshalb **struktur- und risikobasiert abgeleitet**.

## Top-5 Kandidaten (priorisiert)

| Prio | Kandidatengruppe | Evidenz (strukturell/lokal) | Klassifikation | Naechste Aktion | Owner |
|---|---|---|---|---|---|
| 1 | Server-Boot/Health-Gating fuehrt zu Voll-Skip der Legacy-Suite | `e2e-legacy-junit.xml`: `8+29` Tests skipped; `isServerAvailable()` mit 2s Timeout in `test/utils/test-helpers.ts` | infra | In Nightly jeden Skip als eigenes Triage-Signal loggen (server.log + health wait Dauer + skip count), danach Ursache pro Lauf `infra` vs echte Testausfuehrung markieren | TBD |
| 2 | Job-Polling auf asynchrone Extraktion (`pollJobStatus`) | `POLL_TIMEOUT=30000`, `maxAttempts/pollInterval` in `react-api.test.ts`; externe URL-Workflows und Queue-Latenz | test-flake | Polling pro Testgruppe vereinheitlichen (explizite Timeouts/Intervalle in Doku), Finalstatus-Assertion auf deterministische Endzustaende begrenzen und Laufzeiten im JUnit mitschreiben | TBD |
| 3 | Harte Performance-Schwellen im Legacy-E2E (`<500ms`, `<1000ms`, `<200ms avg`) | `react-api.test.ts` Bereich "Performance Testing"; CI-Runner-Latenz variiert stark | test-flake | Performance-Assertions aus Legacy-Soak entkoppeln (separates non-gating Perf-Signal) oder auf robuste Budget-Fenster statt harter Einzelrun-Grenzen umstellen | TBD |
| 4 | Shared Mutable State in DB-Operationen (`update/delete first recipe`) | `react-api.test.ts`: nimmt `listResult.data[0]`, veraendert/loescht Daten ohne isolierte Fixture pro Test | produkt-regression (potenziell) | Deterministische Test-Fixture pro Testfall anlegen und aufraeumen; bis dahin Failures hier als moegliche echte Regression priorisiert pruefen | TBD |
| 5 | Docker-/Umgebungsabhaengige Legacy-Pfade (Container, Ports, Assets) | `docker.test.ts` nutzt `docker ps/exec/stats`, feste Containernamen, Port-Fallbacks; hohe Umgebungssensitivitaet | infra | Docker-Checks klar als Umgebungsdiagnostik labeln, nicht mit API-Vertragschecks mischen; bei Rot zuerst Runtime/Host klassifizieren, dann erst Testlogik | TBD |

## Ableitungsnotiz pro Klasse

- `infra`: Runner/Server/Container/Health-Readiness beeinflusst, bevor Produktlogik belastbar geprueft wird.
- `test-flake`: Nicht-deterministische Timing- oder Schwellenwertbedingungen ohne Produktaenderung.
- `produkt-regression`: Reproduzierbare API-/Datenverhaltensaenderung bei stabiler Umgebung.

## Sofortiger Triage-Workflow fuer den naechsten roten Nightly

1. JUnit + `rezepti-server.log` sichern und zuerst auf `infra`-Signale pruefen (Boot, Health, Skip-Welle).
2. Bei laufendem Server: Failures in `polling/perf` zuerst als `test-flake` behandeln und Repro mit `npm run test:e2e:legacy:ci`.
3. DB-/API-Verhaltensabweichungen mit Repro-Schritten als `produkt-regression` erfassen und priorisiert beheben.

## P2a: Skip-Wave-Klassifikation (verbindlicher Betriebsablauf)

Ziel:
- Jeder Nightly-Lauf mit Legacy-Skips wird innerhalb eines Arbeitstags als `infra` oder `test` klassifiziert.

Signalquelle pro Nightly:
- `artifacts/test-reports/e2e-legacy-skip-signal.json`
- `artifacts/test-reports/e2e-legacy-junit.xml`
- `/tmp/rezepti-server.log`

SLA:
- Triage-Start bis spaetestens 12:00 CET am Folgetag.
- Klassifikation + Repro-Hinweis bis spaetestens 18:00 CET am Folgetag.

Entscheidungsregel (deterministisch):
1. Wenn `skipped == 0`: keine P2a-Aktion.
2. Wenn `skipped > 0` und (`failures == 0` und `errors == 0`): initiale Klasse `infra`.
3. Wenn `skipped > 0` und (`failures > 0` oder `errors > 0`): initiale Klasse `test`.
4. Initiale Klasse darf nach Log-/Repro-Pruefung angepasst werden, aber nur mit kurzer Begruendung.

Pflicht-Logeintrag pro Skip-Wave:
- Run-ID/Datum:
- Skip-Signal: `tests=<n>, skipped=<n>, failures=<n>, errors=<n>`
- Finale Klasse: `infra` oder `test`
- Repro-Command: `npm run test:e2e:legacy:ci`
- Naechste Aktion + Owner:
