-- Self-service account deletion.
--
-- A bare DELETE FROM auth.users leaves personal data behind: roughly ten tables
-- store a user id without a foreign key (verified read-only against production
-- and staging on 2026-10-07, both match the migrations). This migration
--   1. removes already orphaned recipe_collections rows and gives
--      recipe_collections.household_id the foreign key it never had,
--   2. lets bug_reports outlive their author (anonymised on deletion),
--   3. adds private.delete_user_account(uuid), which removes everything in one
--      transaction. The server calls it over DATABASE_URL (role postgres).

-- 1. recipe_collections: clean up orphans, then add the missing FK -----------

DELETE FROM public.recipe_collections c
WHERE c.household_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.households h WHERE h.id = c.household_id);

DELETE FROM public.recipe_collections c
WHERE c.owner_user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = c.owner_user_id);

ALTER TABLE public.recipe_collections
  DROP CONSTRAINT IF EXISTS recipe_collections_household_id_fkey;

ALTER TABLE public.recipe_collections
  ADD CONSTRAINT recipe_collections_household_id_fkey
  FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;

-- 2. bug_reports may outlive the account (anonymised, not deleted) -----------

ALTER TABLE public.bug_reports ALTER COLUMN user_id DROP NOT NULL;

-- 3. The deletion function ---------------------------------------------------

CREATE OR REPLACE FUNCTION private.delete_user_account(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_email text;
  v_household_ids uuid[];
  v_counts jsonb := '{}'::jsonb;
  v_n integer;
BEGIN
  SELECT lower(email) INTO v_email FROM auth.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'RD404';
  END IF;

  -- Households the user belongs to. Without an ownership transfer there is no
  -- safe way to delete an account that shares a household with someone else.
  SELECT coalesce(array_agg(DISTINCT household_id), '{}')
    INTO v_household_ids
    FROM public.household_memberships
   WHERE user_id = p_user_id;

  IF EXISTS (
    SELECT 1 FROM public.household_memberships
     WHERE household_id = ANY (v_household_ids)
       AND user_id <> p_user_id
  ) THEN
    RAISE EXCEPTION 'household_has_other_members' USING ERRCODE = 'RD409';
  END IF;

  -- Bug reports stay, but lose their link to the person.
  UPDATE public.bug_reports
     SET user_id = NULL, household_id = NULL
   WHERE user_id = p_user_id OR household_id = ANY (v_household_ids);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('bug_reports_anonymised', v_n);

  UPDATE public.byok_validation_policies
     SET updated_by_user_id = NULL
   WHERE updated_by_user_id = p_user_id;

  -- Tables that store the user id without a foreign key.
  DELETE FROM public.cookidoo_credentials
   WHERE user_id = p_user_id OR created_by = p_user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('cookidoo_credentials', v_n);

  DELETE FROM public.push_subscriptions WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('push_subscriptions', v_n);

  DELETE FROM public.byok_validation_rate_limits WHERE user_id = p_user_id;
  DELETE FROM public.bug_report_submission_rate_limits WHERE user_id = p_user_id;

  DELETE FROM public.recipe_share_invites
   WHERE sender_user_id = p_user_id
      OR accepted_by_user_id = p_user_id
      OR lower(recipient_email) = v_email;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('recipe_share_invites', v_n);

  -- Collection items cascade from the collection.
  DELETE FROM public.recipe_collections WHERE owner_user_id = p_user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('recipe_collections', v_n);

  -- Households only this user belonged to. Cascades to shopping_list,
  -- meal_plan, household recipes, household collections, household Cookidoo
  -- credentials, memberships and user_default_households.
  DELETE FROM public.households WHERE id = ANY (v_household_ids);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('households', v_n);

  -- user_profiles, private recipes and (via auth) sessions/identities cascade.
  DELETE FROM auth.users WHERE id = p_user_id;

  RETURN v_counts;
END;
$$;

REVOKE ALL ON FUNCTION private.delete_user_account(uuid) FROM PUBLIC, anon, authenticated;
