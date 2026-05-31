-- Supabase Advisor core remediation.
--
-- Covers:
--   - Security Advisor: function_search_path_mutable
--   - Performance Advisor: unindexed_foreign_keys
--   - Data API hardening: revoke RPC execute from internal trigger helpers
--
-- Deliberately not covered here:
--   - rls_enabled_no_policy: kept as the current backend-only Data API block.
--   - extension_in_public: requires a separate dependency inventory.
--   - unused_index: requires usage and redundancy proof before dropping.

ALTER FUNCTION public.auto_enable_rls() SET search_path = public, pg_temp;
ALTER FUNCTION public.notify_minion_job_change() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_chunk_search_vector() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_page_search_vector() SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.auto_enable_rls() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.notify_minion_job_change() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_chunk_search_vector() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_page_search_vector() FROM anon, authenticated, public;

CREATE INDEX IF NOT EXISTS idx_code_edges_chunk_source_id
ON public.code_edges_chunk (source_id);

CREATE INDEX IF NOT EXISTS idx_facts_superseded_by
ON public.facts (superseded_by);

CREATE INDEX IF NOT EXISTS idx_oauth_codes_client_id
ON public.oauth_codes (client_id);

CREATE INDEX IF NOT EXISTS idx_subagent_rate_leases_owner_job_id
ON public.subagent_rate_leases (owner_job_id);

CREATE INDEX IF NOT EXISTS idx_take_nudge_log_source_id
ON public.take_nudge_log (source_id);
