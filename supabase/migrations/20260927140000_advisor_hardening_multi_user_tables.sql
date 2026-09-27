-- Advisor hardening after the 2026-09-27 production log review.
--
-- 1. function_search_path_mutable: production lost the search_path on
--    private.prevent_household_row_scope_change although
--    20260606172525_harden_private_trigger_function_search_paths is recorded
--    as applied. The function body in production is byte-identical to the
--    CREATE OR REPLACE in 20260604135550, and no migration or script re-creates
--    it, so the skeleton SQL was most likely re-run by hand afterwards
--    (CREATE OR REPLACE without SET resets proconfig). Staging is not affected.
--    Re-apply idempotently; never re-run old migration files manually.
-- 2. unindexed_foreign_keys on households.created_by and
--    recipe_share_invites.accepted_recipe_id.
-- 3. auth_rls_initplan + multiple_permissive_policies: collapse overlapping
--    FOR ALL / FOR SELECT policies into one policy per action and wrap
--    auth.uid() in a scalar subquery.
--
-- The server connects as `postgres` and bypasses RLS; these policies only
-- govern Data API access for `authenticated`. Semantics are unchanged: every
-- policy still grants exactly the rows it granted before.

ALTER FUNCTION private.prevent_household_row_scope_change()
  SET search_path = public, pg_temp;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'private'
      AND p.proname = 'prevent_user_id_change'
      AND pg_get_function_identity_arguments(p.oid) = ''
  ) THEN
    ALTER FUNCTION private.prevent_user_id_change()
      SET search_path = public, pg_temp;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS households_created_by_idx
  ON public.households (created_by);

CREATE INDEX IF NOT EXISTS recipe_share_invites_accepted_recipe_id_idx
  ON public.recipe_share_invites (accepted_recipe_id);

-- push_subscriptions: FOR ALL already covers SELECT.
DROP POLICY IF EXISTS push_subscriptions_owner_select ON public.push_subscriptions;
DROP POLICY IF EXISTS push_subscriptions_owner_modify ON public.push_subscriptions;
CREATE POLICY push_subscriptions_owner_all
  ON public.push_subscriptions
  FOR ALL
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- byok_validation_rate_limits: FOR ALL already covers SELECT.
DROP POLICY IF EXISTS byok_validation_rate_limits_owner_select ON public.byok_validation_rate_limits;
DROP POLICY IF EXISTS byok_validation_rate_limits_owner_modify ON public.byok_validation_rate_limits;
CREATE POLICY byok_validation_rate_limits_owner_all
  ON public.byok_validation_rate_limits
  FOR ALL
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- bug_reports: one SELECT policy for owner OR admin instead of two.
DROP POLICY IF EXISTS bug_reports_owner_select ON public.bug_reports;
DROP POLICY IF EXISTS bug_reports_admin_select ON public.bug_reports;
CREATE POLICY bug_reports_owner_or_admin_select
  ON public.bug_reports
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.user_id = (SELECT auth.uid())
        AND user_profiles.app_role = 'admin'
    )
  );
