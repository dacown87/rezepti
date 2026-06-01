-- Supabase Advisor follow-up: move trusted extensions out of public.
--
-- Covers:
--   - Security Advisor: extension_in_public for vector and pg_trgm
--
-- Staging verification before production:
--   - schema-only production public restore completed on rezepti-staging
--   - vector and pg_trgm moved to extensions successfully
--   - page/content_chunks search-vector triggers passed rollback smoke
--   - vector dimensions for content_chunks embeddings passed rollback smoke
--   - pg_trgm operator resolution passed rollback smoke
--   - security/performance advisors have no WARN+ findings
--
-- Rollback, if needed:
--   ALTER EXTENSION vector SET SCHEMA public;
--   ALTER EXTENSION pg_trgm SET SCHEMA public;

CREATE SCHEMA IF NOT EXISTS extensions;

ALTER EXTENSION vector SET SCHEMA extensions;
ALTER EXTENSION pg_trgm SET SCHEMA extensions;

GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;
