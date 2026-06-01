# Supabase Advisor Follow-up Tracks

Stand: 2026-06-01

## Decision

Die Kern-Remediation ist abgeschlossen. Die verbleibenden Advisor-Findings
bleiben bewusst als getrennte Follow-up-Tracks offen:

- `extension_in_public`: erledigt; Dependency-Inventar, Staging-Test,
  produktive Wartungsaktion, Runtime-Smoke und Advisor-Verify sind gruen.
- `unused_index`: erst Nutzungs-/Redundanznachweis, dann gezielte Drops.

`unused_index` wird nicht direkt aus dem Advisor-Hinweis heraus gefixt. Das
folgt der Supabase-Advisor-Dokumentation: ungenutzte Indexe koennen
Write-Overhead erzeugen, sollen aber vor dem Drop gegen kuenftige Nutzung und
repraesentative Query-Pfade validiert werden.

## Agent Review

Zwei kosteneffiziente Read-only-Agenten (`gpt-5.4-mini`) wurden parallel
eingesetzt:

- Agent A pruefte `vector`/`pg_trgm`: Empfehlung `erst inventarisieren`, danach
  Staging-Smoke vor produktiver Wartungsaktion.
- Agent B pruefte `unused_index`: Empfehlung `nicht droppen ohne
  Nutzungs-/Redundanznachweis`; die frisch angelegten FK-Indexes muessen
  bleiben.
- Ein weiterer Read-only-Explorer bestaetigte am 2026-06-01 fuer
  `unused_index`: Status bleibt `hold`; keine Drops ohne Nutzungsperiode,
  Redundanzanalyse und `EXPLAIN (ANALYZE, BUFFERS)` pro betroffenem Query-Pfad.

## Extension Track

Aktueller Production-Stand 2026-06-01:

- `vector` liegt in `extensions`.
- `pg_trgm` liegt in `extensions`.
- `extension_in_public` ist auf WARN-Level nicht mehr vorhanden.

Staging-Stand 2026-06-01:

- Supabase-Projekt `rezepti-staging` wurde in Org `dlwezlxtfbkbwvzbrzix`
  angelegt, Region `eu-west-1`, Ref `abnukbzgfodzhqflgxiw`.
- Lokale `.env` enthaelt `STAGING_DATABASE_URL`.
- Staging-DB-Verbindung wurde mit `psql` verifiziert.
- Basic Extension-Move-Probe auf Staging ist gruen:
  `vector` und `pg_trgm` wurden angelegt, per
  `alter extension ... set schema extensions` in `extensions` verschoben und
  `grant usage on schema extensions to authenticated, service_role` wurde
  gesetzt.
- Supabase Security Advisor gegen Staging meldete danach `No issues found`.
- Danach wurde das Production-`public`-Schema per schema-only Dump nach
  Staging gespiegelt, ohne Nutzerdaten zu kopieren.
- Production-nahe Extension-Move-Probe ist gruen: nach Restore des Schemas
  konnten `vector` und `pg_trgm` erneut nach `extensions` verschoben werden.
  Verifiziert: 52 `public`-Tabellen, 8 relevante Search-/Vector-Indexe und
  beide Extensions in `extensions`.
- Runtime-Smoke auf Staging ist gruen und wurde per Transaktion vollstaendig
  zurueckgerollt: `pages`- und `content_chunks`-Search-Vector-Trigger,
  `vector`-Dimensionen fuer `content_chunks`-Embeddings und ein
  `pg_trgm`-Operatorpfad funktionieren mit beiden Extensions in `extensions`.
- Security Advisor und Performance Advisor melden auf WARN-Level gegen Staging
  keine Findings. INFO-Level enthaelt weiterhin die erwarteten
  `rls_enabled_no_policy`-Eintraege aus dem separaten Multi-User/Data-API-Track.
- Eine produktive Ops-/Migration-Datei liegt bereit:
  `db/migrations/2026-06-01-move-supabase-extensions-out-of-public.sql`.
- Einschraenkung: Die Probe deckt Schema-, Index-, Trigger- und
  Funktionsabhaengigkeiten sowie einfache Runtime-Pfade ab, aber keine
  datenabhaengigen Query-Plaene oder realen Nutzungsstatistiken.

Lokales Code-Inventar:

- Keine direkte App-Callsite fuer Postgres-`vector` oder `pg_trgm` gefunden.
- Rezepti-Ingredient-Aehnlichkeit laeuft aktuell in TypeScript, nicht ueber
  `pg_trgm`.

Live-DB-Inventar fuer Extension-Typ-Spalten:

| Extension | Table | Column | Type |
|---|---|---|---|
| `vector` | `public.content_chunks` | `embedding` | `vector` |
| `vector` | `public.content_chunks` | `embedding_image` | `vector` |
| `vector` | `public.content_chunks` | `embedding_multimodal` | `vector` |
| `vector` | `public.facts` | `embedding` | `halfvec` |
| `vector` | `public.query_cache` | `embedding` | `halfvec` |
| `vector` | `public.takes` | `embedding` | `vector` |

Abhaengige Index-/Search-Objekte wurden ebenfalls gefunden, u.a.
`idx_chunks_embedding`, `idx_chunks_embedding_image`,
`idx_chunks_embedding_null`, `idx_facts_embedding_hnsw`,
`idx_query_cache_embedding_hnsw`, `idx_takes_embedding_hnsw`,
`idx_pages_trgm`, `idx_pages_search` und Search-Vector-Triggerfunktionen.

Produktive Wartungsaktion 2026-06-01:

- Migration/Ops-Datei wurde gegen Production ausgefuehrt:
  `db/migrations/2026-06-01-move-supabase-extensions-out-of-public.sql`.
- Vorher: `pg_trgm` und `vector` lagen in `public`.
- Nachher: `pg_trgm` und `vector` liegen in `extensions`.
- Produktiver Runtime-Smoke wurde per Transaktion ausgefuehrt und mit
  `ROLLBACK` beendet:
  `db/ops/prod-extension-runtime-smoke-2026-06-01.sql`.
- Geprueft wurden `pages`- und `content_chunks`-Search-Vector-Trigger,
  `extensions.vector_dims(...)` und ein `pg_trgm`-Operatorpfad.
- Nachweise liegen unter
  `docs/SupaBase/advisor-output/post-extension-move-2026-06-01.md`.
- Security Advisor und Performance Advisor melden auf WARN-Level gegen
  Production jeweils `No issues found`.

Ergebnis:

- Extension-Track ist abgeschlossen.
- Rollback bleibt symmetrisch moeglich:
   - `alter extension vector set schema public;`
   - `alter extension pg_trgm set schema public;`

## Unused Index Track

Aktueller Advisor-Stand:

- 88 `unused_index` Findings.
- Nach dem FK-Fix sind darin auch die 5 neu angelegten FK-Support-Indexes
  enthalten.

Diese 5 Indexes sind bewusst angelegt und trotz `idx_scan = 0` keine
Drop-Kandidaten:

| Table | Index | Reason |
|---|---|---|
| `public.code_edges_chunk` | `idx_code_edges_chunk_source_id` | FK-Support |
| `public.facts` | `idx_facts_superseded_by` | FK-Support |
| `public.oauth_codes` | `idx_oauth_codes_client_id` | FK-Support |
| `public.subagent_rate_leases` | `idx_subagent_rate_leases_owner_job_id` | FK-Support |
| `public.take_nudge_log` | `idx_take_nudge_log_source_id` | FK-Support |

Advisor-Findings nach Tabelle:

| Count | Table |
|---:|---|
| 9 | `public.content_chunks` |
| 7 | `public.pages` |
| 6 | `public.takes` |
| 5 | `public.minion_jobs` |
| 5 | `public.facts` |
| 4 | `public.take_nudge_log` |
| 4 | `public.code_edges_chunk` |
| 3 | `public.query_cache` |
| 3 | `public.files` |
| 3 | `public.code_edges_symbol` |
| 3 | `public.calibration_profiles` |

Die restlichen Tabellen haben je 1-2 gemeldete Indexes.

Drop-Regel:

Der Advisor meldet `unused_index` nur als Kandidatenhinweis. Fuer Rezepti
gelten FK-Support-, Search-, Vector-, Cleanup- und seltene Admin-Indexes als
geschuetzt, bis eine repraesentative Nutzungsperiode vorliegt, Redundanz pro
Tabelle nachgewiesen ist und die betroffenen Query-Pfade per Plananalyse
bestaetigt wurden.

Ein Index darf erst entfernt werden, wenn alle Punkte erfuellt sind:

1. kein Primary-Key-, Unique-, Constraint- oder FK-Support-Index,
2. kein frisch angelegter Migrationsindex,
3. keine erwartete seltene Admin-, Cleanup-, Search- oder Vector-Nutzung,
4. `pg_stat_user_indexes` und `supabase inspect db index-stats` bleiben ueber
   eine repraesentative Nutzungsperiode unauffaellig,
5. betroffene Query-Pfade wurden mit `EXPLAIN (ANALYZE, BUFFERS)` geprueft,
6. Drop erfolgt einzeln mit dokumentiertem Rollback.

Fuer produktive Drops bevorzugt:

```sql
drop index concurrently if exists public.<index_name>;
```

`DROP INDEX CONCURRENTLY` darf nicht innerhalb einer expliziten Transaktion
laufen. Jeder Drop braucht deshalb eine eigene Migrations-/Ops-Entscheidung.

## Next Gates

- Extension-Track: abgeschlossen; nur bei Regression Rollback-Statements oben
  verwenden.
- Index-Track: mindestens eine Nutzungsperiode sammeln, dann Redundanzanalyse
  pro Tabelle starten. Aktuell kein Drop.
- Multi-User-Track: vor Data-API-Oeffnung erneut Extension-Grants, RLS-Policies
  und Function-Execute-Rechte pruefen.
