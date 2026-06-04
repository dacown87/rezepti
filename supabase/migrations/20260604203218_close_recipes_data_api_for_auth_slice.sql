-- Keep recipes out of the Slice-1 Supabase Data API surface.
--
-- Shopping and planner are the only authenticated Data API tables in this
-- auth slice. Recipes keep their existing server-side API path because global
-- defaults and future household/user ownership need a separate privacy model.

DO $$
BEGIN
  IF to_regclass('public.recipes') IS NOT NULL THEN
    ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS recipes_select_authenticated ON public.recipes;
    DROP POLICY IF EXISTS recipes_insert_authenticated ON public.recipes;
    DROP POLICY IF EXISTS recipes_update_authenticated ON public.recipes;
    DROP POLICY IF EXISTS recipes_delete_authenticated ON public.recipes;

    REVOKE ALL ON TABLE public.recipes FROM anon, authenticated;
  END IF;

  IF to_regclass('public.recipes_id_seq') IS NOT NULL THEN
    REVOKE ALL ON SEQUENCE public.recipes_id_seq FROM anon, authenticated;
  END IF;
END $$;
