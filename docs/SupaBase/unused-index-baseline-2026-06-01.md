# Supabase Unused Index Baseline

Stand: 2026-06-01

## Scope

Dieser Baseline-Slice behandelt nur den Supabase Advisor Follow-up
`unused_index`. Es wurden keine Indexe geloescht und keine Migration
ausgefuehrt.

Read-only-Abfrage:

- `db/ops/unused-index-baseline-readonly-2026-06-01.sql`

## Ergebnis

Die aktuelle Produktionsstatistik ist verwertbar: `pg_stat_database` meldet
`stats_reset = 2026-03-30 19:02:21.724308+00`.

Zero-Scan-Klassifikation aus `pg_stat_user_indexes` und Postgres-Katalogen:

| Kategorie | Indexe | Groesse |
|---|---:|---:|
| `protected_constraint_unique` | 67 | 584 kB |
| `protected_fk_support` | 36 | 320 kB |
| `watch_rare_admin_cleanup_partial` | 29 | 304 kB |
| `watch_needs_query_plan` | 12 | 96 kB |
| `protected_search_vector_special` | 11 | 4272 kB |

Interpretation:

- Die groessten Zero-Scan-Indexe sind Search-/Vector-Spezialfaelle, vor allem
  `idx_chunks_search_vector` und `idx_pages_search`. Sie bleiben geschuetzt.
- Der potenziell interessante Rest ist klein: die 12 `watch_needs_query_plan`
  Kandidaten sind je 8 kB gross.
- Der direkte Write-Overhead ist aktuell kein akuter Produktblocker. Der
  richtige naechste Schritt ist Beobachtung plus Query-Plan-Nachweis, nicht
  `DROP INDEX`.

## Schutzkategorien

Geschuetzt:

- Primary-Key-, Unique- und Constraint-Indexe.
- FK-Support-Indexe, inklusive der fuenf frisch angelegten Advisor-Fix-Indexe:
  `idx_code_edges_chunk_source_id`, `idx_facts_superseded_by`,
  `idx_oauth_codes_client_id`, `idx_subagent_rate_leases_owner_job_id`,
  `idx_take_nudge_log_source_id`.
- Search-/Vector-/Special-Indexe: `gin`, `gist`, `hnsw`, `ivfflat`,
  `embedding`, `search`, `trgm`, `to_tsvector`, `tsvector`.
- Seltene Admin-, Cleanup- und Partial-Indexe bleiben mindestens `watch`, weil
  `idx_scan = 0` fuer seltene Ops-Pfade kein ausreichender Drop-Beweis ist.

## Watch-Kandidaten

Diese 12 Indexe sind keine Sofort-Drops. Sie sind die kleinste sinnvolle Liste
fuer spaetere Query-Plan-Pruefung:

| Tabelle | Index | Groesse |
|---|---|---:|
| `code_edges_chunk` | `idx_code_edges_chunk_to_symbol` | 8192 bytes |
| `code_edges_symbol` | `idx_code_edges_symbol_to` | 8192 bytes |
| `code_traversal_cache` | `code_traversal_cache_source_idx` | 8192 bytes |
| `eval_takes_quality_runs` | `eval_takes_quality_runs_trend_idx` | 8192 bytes |
| `files` | `idx_files_hash` | 8192 bytes |
| `files` | `idx_files_page` | 8192 bytes |
| `mcp_request_log` | `idx_mcp_log_time_agent` | 8192 bytes |
| `oauth_tokens` | `idx_oauth_tokens_expiry` | 8192 bytes |
| `take_grade_cache` | `take_grade_cache_applied_idx` | 8192 bytes |
| `take_grade_cache` | `take_grade_cache_wave_idx` | 8192 bytes |
| `take_nudge_log` | `take_nudge_log_wave_idx` | 8192 bytes |
| `take_proposals` | `take_proposals_run_id_idx` | 8192 bytes |

## Decision

Status fuer Punkt 2 bleibt: `hold`, aber mit Baseline abgeschlossen.

Umgebungsentscheidung:

- Production ist die Quelle fuer echte Nutzungsstatistik. Read-only-Baselines
  werden dort ausgefuehrt, weil nur dort `pg_stat_user_indexes` und Advisor
  den realen Betrieb abbilden.
- Staging/Clone ist der vorgesehene Ort fuer `EXPLAIN (ANALYZE, BUFFERS)`,
  testweise `DROP INDEX` und Advisor-/Regression-Smokes nach simulierten
  Drops. Diese Schritte werden nicht auf Production vorgezogen, solange die
  Index-Usage-Statistik als Entscheidungsgrundlage dienen soll.
- Die bereits angelegte `rezepti-staging`-DB aus dem Extension-Track kann fuer
  diesen Probe-Track genutzt werden, sobald Schema und relevante
  Tabelleninhalte fuer die 12 Watch-Kandidaten passend gespiegelt sind.

Naechstes Gate:

1. Nach einer repraesentativen Nutzungsperiode dieselbe Read-only-Abfrage auf
   Production erneut laufen lassen oder Staging/Clone fuer Probeanalysen
   vorbereiten.
2. Nur Indexe betrachten, die erneut in `watch_needs_query_plan` bleiben.
3. Fuer jeden Kandidaten den erwarteten Query-Pfad auf Staging/Clone mit
   `EXPLAIN (ANALYZE, BUFFERS)` belegen.
4. Testweise Drops und Advisor-/Regression-Smokes auf Staging/Clone ausfuehren.
5. Erst danach einzelne Production-Ops-Dateien mit `DROP INDEX CONCURRENTLY` und
   Rollback-Notiz vorbereiten.

Aktuelle Empfehlung: keine Index-Drops am 2026-06-01.

## Re-Run 2026-06-02

Die Read-only-Baseline wurde erneut gegen Production ausgefuehrt:

- Output: `docs/SupaBase/runbook-output/unused-index-baseline-rerun-2026-06-02.txt`
- `stats_reset` blieb unveraendert: `2026-03-30 19:02:21.724308+00`
- Klassifikation blieb unveraendert:
  - `protected_constraint_unique`: 67 / 584 kB
  - `protected_fk_support`: 36 / 320 kB
  - `protected_search_vector_special`: 11 / 4272 kB
  - `watch_rare_admin_cleanup_partial`: 29 / 304 kB
  - `watch_needs_query_plan`: 12 / 96 kB
- Alle 12 `watch_needs_query_plan`-Indexe stehen weiter bei `idx_scan = 0`.
- Code-Suche in `src`, `mobile`, `test`, `scripts` und `db` fand keine
  aktiven Rezepti-App-Callsites fuer diese Watch-Kandidaten ausser vorhandener
  Supabase-Ops-/Migrationsdoku.

Bewertung:

- Der Track ist operativ vorbereitet: Baseline, Wiederholung und
  Kandidatenliste liegen vor.
- Production-Drops werden trotzdem nicht gestartet. Die Kandidaten sind sehr
  klein (insgesamt 96 kB), liegen auf Auxiliary-/gbrain-nahen Tabellen und
  haben keinen akuten Produkt- oder Write-Overhead.
- `EXPLAIN (ANALYZE, BUFFERS)` auf Production wuerde die
  `pg_stat_user_indexes`-Nutzungsstatistik fuer genau diese Indexe
  verfaelschen und ist deshalb vor einer echten Drop-Entscheidung nicht als
  Probe auf Production geeignet.

Aktuelle Empfehlung am 2026-06-02: weiter `hold`; keine Index-Drops. Der
naechste sinnvolle Arbeitsschritt ist eine dedizierte Staging-/Clone-Pruefung
oder eine spaetere Production-Baseline nach echter Nutzungsperiode.
