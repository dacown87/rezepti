# Supabase Advisor Follow-up Tracks

Stand: 2026-05-31

## Decision

Die Kern-Remediation ist abgeschlossen. Die verbleibenden Advisor-Findings
bleiben bewusst als getrennte Follow-up-Tracks offen:

- `extension_in_public`: erst Extension-Dependency-Inventar und Staging-Test,
  dann optionaler Move.
- `unused_index`: erst Nutzungs-/Redundanznachweis, dann gezielte Drops.

Keine der beiden Kategorien wird direkt aus dem Advisor-Hinweis heraus
gefixt. Das folgt der Supabase-Advisor-Dokumentation: ungenutzte Indexe koennen
Write-Overhead erzeugen, sollen aber vor dem Drop gegen kuenftige Nutzung und
reprasentative Query-Pfade validiert werden. Supabase empfiehlt Extensions
ausserhalb von `public`, weist aber zugleich auf Extension-Schema- und
Zugriffsimplikationen hin.

## Agent Review

Zwei kosteneffiziente Read-only-Agenten (`gpt-5.4-mini`) wurden parallel
eingesetzt:

- Agent A pruefte `vector`/`pg_trgm`: Empfehlung `erst inventarisieren, nicht
  jetzt migrieren`.
- Agent B pruefte `unused_index`: Empfehlung `nicht droppen ohne
  Nutzungs-/Redundanznachweis`; die frisch angelegten FK-Indexes muessen
  bleiben.

## Extension Track

Aktueller Advisor-Stand:

- `vector` liegt in `public`.
- `pg_trgm` liegt in `public`.

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

Empfehlung:

1. Extension-Move nicht in der laufenden Kern-Remediation ausfuehren.
2. In Staging pruefen:
   - `create schema if not exists extensions;`
   - `alter extension vector set schema extensions;`
   - `alter extension pg_trgm set schema extensions;`
   - passende `grant usage on schema extensions ...`
3. Danach Search-Trigger, Vector-/HNSW-Indexes, Textsuche und Advisor erneut
   pruefen.
4. Erst danach eine produktive Migration schreiben.

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

- Extension-Track: Staging-Probe mit Rollback und Advisor-Rerun.
- Index-Track: mindestens eine Nutzungsperiode sammeln, dann Redundanzanalyse
  pro Tabelle starten.
- Multi-User-Track: vor Data-API-Oeffnung erneut Extension-Grants, RLS-Policies
  und Function-Execute-Rechte pruefen.
