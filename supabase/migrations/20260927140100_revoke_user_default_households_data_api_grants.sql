-- user_default_households kept the Supabase default table grants for anon and
-- authenticated (incl. TRUNCATE, which RLS does not cover). RLS without policy
-- already denies row access, and the table is backend-only: the server and the
-- smoke scripts connect as `postgres`. Align it with every other multi-user
-- table, which revoke Data API grants explicitly.

REVOKE ALL ON TABLE public.user_default_households FROM anon, authenticated;
