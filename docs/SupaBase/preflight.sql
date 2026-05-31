-- Supabase Advisor remediation preflight.
--
-- Run with:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f docs/SupaBase/preflight.sql

\echo '== runtime role =='
select current_user, session_user;

\echo '== role flags =='
select rolname, rolsuper, rolbypassrls
from pg_roles
where rolname in (current_user, 'postgres', 'anon', 'authenticated', 'service_role')
order by rolname;

\echo '== target function signatures/search_path =='
select
  n.nspname as schema,
  p.oid::regprocedure as signature,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as args,
  r.rolname as owner,
  p.prosecdef as security_definer,
  p.proconfig
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_roles r on r.oid = p.proowner
where n.nspname = 'public'
  and p.proname in (
    'auto_enable_rls',
    'notify_minion_job_change',
    'update_chunk_search_vector',
    'update_page_search_vector'
  )
order by p.proname;

\echo '== data api table grants for public tables =='
select
  table_schema,
  table_name,
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated', 'service_role')
order by table_name, grantee, privilege_type;

\echo '== data api schema usage grants =='
select
  nspname as schema_name,
  grantee,
  privilege_type
from pg_namespace n
cross join (values ('anon'), ('authenticated'), ('service_role')) as g(grantee)
cross join (values ('USAGE'), ('CREATE')) as p(privilege_type)
where nspname in ('public', 'storage')
  and has_schema_privilege(g.grantee, n.oid, p.privilege_type)
order by schema_name, grantee, privilege_type;

\echo '== data api sequence grants =='
select
  n.nspname as schema,
  c.relname as sequence_name,
  g.grantee,
  p.privilege_type
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
cross join (values ('anon'), ('authenticated'), ('service_role')) as g(grantee)
cross join (values ('USAGE'), ('SELECT'), ('UPDATE')) as p(privilege_type)
where c.relkind = 'S'
  and n.nspname in ('public', 'storage')
  and has_sequence_privilege(g.grantee, c.oid, p.privilege_type)
order by schema, sequence_name, grantee, privilege_type;

\echo '== data api function execute grants in public =='
select
  n.nspname as schema,
  p.oid::regprocedure as function_signature,
  g.grantee,
  has_function_privilege(g.grantee, p.oid, 'EXECUTE') as can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
cross join (values ('anon'), ('authenticated'), ('service_role')) as g(grantee)
where n.nspname = 'public'
  and has_function_privilege(g.grantee, p.oid, 'EXECUTE')
order by p.oid::regprocedure::text, grantee;

\echo '== rls policies =='
select schemaname, tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

\echo '== target foreign keys =='
select
  con.conname,
  con.conrelid::regclass as table_name,
  array_agg(att.attname order by ord.ordinality) as fk_columns
from pg_constraint con
join unnest(con.conkey) with ordinality as ord(attnum, ordinality) on true
join pg_attribute att
  on att.attrelid = con.conrelid
 and att.attnum = ord.attnum
where con.contype = 'f'
  and con.conname in (
    'code_edges_chunk_source_id_fkey',
    'facts_superseded_by_fkey',
    'oauth_codes_client_id_fkey',
    'subagent_rate_leases_owner_job_id_fkey',
    'take_nudge_log_source_id_fkey'
  )
group by con.conname, con.conrelid
order by con.conname;

\echo '== target foreign key index coverage =='
select
  con.conname,
  con.conrelid::regclass as table_name,
  idx.indexrelid::regclass as index_name,
  idx.indisvalid,
  idx.indisready,
  idx.indkey::text as index_attnums,
  con.conkey::text as fk_attnums
from pg_constraint con
left join pg_index idx
  on idx.indrelid = con.conrelid
 and idx.indisvalid
 and idx.indisready
 and (idx.indkey::int2[])[0:array_length(con.conkey, 1) - 1] = con.conkey
where con.contype = 'f'
  and con.conname in (
    'code_edges_chunk_source_id_fkey',
    'facts_superseded_by_fkey',
    'oauth_codes_client_id_fkey',
    'subagent_rate_leases_owner_job_id_fkey',
    'take_nudge_log_source_id_fkey'
  )
order by con.conname, index_name;

\echo '== index usage snapshot =='
select
  schemaname,
  relname as table_name,
  indexrelname as index_name,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
from pg_stat_user_indexes
where schemaname = 'public'
order by idx_scan asc, relname, indexrelname;
