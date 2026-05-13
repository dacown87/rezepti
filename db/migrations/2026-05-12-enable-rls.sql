-- Enable Row-Level Security on all public tables.
--
-- The backend connects as the `postgres` superuser via DATABASE_URL, which
-- bypasses RLS automatically. Enabling RLS without any policies therefore
-- blocks only anon/authenticated access via the Supabase REST API
-- (PostgREST), which is exactly what we want — the app keeps working,
-- public REST access is denied.
--
-- Run once in the Supabase SQL Editor.

ALTER TABLE public.recipes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredient_dictionary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_list         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_plan             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys              ENABLE ROW LEVEL SECURITY;

-- Optional hardening: also revoke direct table grants from anon/authenticated
-- so even if RLS is later disabled by mistake, REST access stays denied.
REVOKE ALL ON public.recipes               FROM anon, authenticated;
REVOKE ALL ON public.ingredient_dictionary FROM anon, authenticated;
REVOKE ALL ON public.shopping_list         FROM anon, authenticated;
REVOKE ALL ON public.meal_plan             FROM anon, authenticated;
REVOKE ALL ON public.api_keys              FROM anon, authenticated;

-- Supabase ships an event trigger function `rls_auto_enable()` that
-- auto-enables RLS on newly created public tables. The function itself is
-- a SECURITY DEFINER and exposed via PostgREST RPC, so Supabase Advisor
-- flags it. The event trigger keeps working without REST execute grants,
-- so we revoke REST execute to close the Advisor warning.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated, public;
