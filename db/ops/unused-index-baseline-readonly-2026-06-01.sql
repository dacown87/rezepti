-- Read-only baseline for Supabase Advisor `unused_index` follow-up.
-- Intended use:
--   psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -P pager=off \
--     -f db/ops/unused-index-baseline-readonly-2026-06-01.sql
--
-- This script does not mutate database state.

\echo '== stats reset =='
select
  datname,
  stats_reset
from pg_stat_database
where datname = current_database();

\echo '== zero-scan index classification =='
with fk_cols as (
  select conrelid, conname, conkey
  from pg_constraint
  where contype = 'f'
),
idx as (
  select
    n.nspname as schema_name,
    t.relname as table_name,
    i.relname as index_name,
    am.amname,
    ix.indisprimary,
    ix.indisunique,
    exists (
      select 1
      from pg_constraint c
      where c.conindid = i.oid
    ) as is_constraint,
    exists (
      select 1
      from fk_cols fk
      where fk.conrelid = t.oid
        and ix.indkey::smallint[] @> fk.conkey
    ) as looks_fk_support,
    pg_relation_size(i.oid) as bytes,
    coalesce(s.idx_scan, 0) as idx_scan,
    coalesce(s.idx_tup_read, 0) as idx_tup_read,
    coalesce(s.idx_tup_fetch, 0) as idx_tup_fetch,
    pg_get_indexdef(i.oid) as indexdef
  from pg_class i
  join pg_index ix on ix.indexrelid = i.oid
  join pg_class t on t.oid = ix.indrelid
  join pg_namespace n on n.oid = t.relnamespace
  join pg_am am on am.oid = i.relam
  left join pg_stat_user_indexes s on s.indexrelid = i.oid
  where n.nspname = 'public'
),
classified as (
  select
    *,
    case
      when is_constraint or indisprimary or indisunique
        then 'protected_constraint_unique'
      when index_name in (
        'idx_code_edges_chunk_source_id',
        'idx_facts_superseded_by',
        'idx_oauth_codes_client_id',
        'idx_subagent_rate_leases_owner_job_id',
        'idx_take_nudge_log_source_id'
      ) or looks_fk_support
        then 'protected_fk_support'
      when amname in ('gin', 'gist', 'hnsw', 'ivfflat')
        or index_name ~ '(embedding|hnsw|search|trgm|gin|vector)'
        or indexdef ~ '(to_tsvector|tsvector|gin_trgm_ops|vector_)'
        then 'protected_search_vector_special'
      when index_name ~ '(ttl|expires|expired|purge|cleanup|delayed|timeout|unread|pending|cooldown|recent|created|date|decided|retrieved|status)'
        or indexdef ~ ' WHERE '
        then 'watch_rare_admin_cleanup_partial'
      else 'watch_needs_query_plan'
    end as category
  from idx
  where idx_scan = 0
)
select
  category,
  count(*) as indexes,
  pg_size_pretty(sum(bytes)) as total_size
from classified
group by category
order by indexes desc;

\echo '== watch_needs_query_plan candidates =='
with fk_cols as (
  select conrelid, conkey
  from pg_constraint
  where contype = 'f'
),
idx as (
  select
    t.relname as table_name,
    i.relname as index_name,
    am.amname,
    ix.indisprimary,
    ix.indisunique,
    exists (select 1 from pg_constraint c where c.conindid = i.oid) as is_constraint,
    exists (
      select 1
      from fk_cols fk
      where fk.conrelid = t.oid
        and ix.indkey::smallint[] @> fk.conkey
    ) as looks_fk_support,
    pg_relation_size(i.oid) as bytes,
    coalesce(s.idx_scan, 0) as idx_scan,
    pg_get_indexdef(i.oid) as indexdef
  from pg_class i
  join pg_index ix on ix.indexrelid = i.oid
  join pg_class t on t.oid = ix.indrelid
  join pg_namespace n on n.oid = t.relnamespace
  join pg_am am on am.oid = i.relam
  left join pg_stat_user_indexes s on s.indexrelid = i.oid
  where n.nspname = 'public'
),
classified as (
  select
    *,
    case
      when is_constraint or indisprimary or indisunique
        then 'protected_constraint_unique'
      when index_name in (
        'idx_code_edges_chunk_source_id',
        'idx_facts_superseded_by',
        'idx_oauth_codes_client_id',
        'idx_subagent_rate_leases_owner_job_id',
        'idx_take_nudge_log_source_id'
      ) or looks_fk_support
        then 'protected_fk_support'
      when amname in ('gin', 'gist', 'hnsw', 'ivfflat')
        or index_name ~ '(embedding|hnsw|search|trgm|gin|vector)'
        or indexdef ~ '(to_tsvector|tsvector|gin_trgm_ops|vector_)'
        then 'protected_search_vector_special'
      when index_name ~ '(ttl|expires|expired|purge|cleanup|delayed|timeout|unread|pending|cooldown|recent|created|date|decided|retrieved|status)'
        or indexdef ~ ' WHERE '
        then 'watch_rare_admin_cleanup_partial'
      else 'watch_needs_query_plan'
    end as category
  from idx
  where idx_scan = 0
)
select
  table_name,
  index_name,
  amname,
  pg_size_pretty(bytes) as size,
  indexdef
from classified
where category = 'watch_needs_query_plan'
order by bytes desc, table_name, index_name;

\echo '== busiest tables by writes =='
select
  relname as table_name,
  n_live_tup,
  n_dead_tup,
  seq_scan,
  seq_tup_read,
  idx_scan,
  n_tup_ins,
  n_tup_upd,
  n_tup_del
from pg_stat_user_tables
where schemaname = 'public'
order by (n_tup_ins + n_tup_upd + n_tup_del) desc
limit 20;
