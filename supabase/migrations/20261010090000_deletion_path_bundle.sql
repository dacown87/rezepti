-- Deletion-path bundle: deletion log, import quota tables, bug-report
-- anonymisation, and a single new version of private.delete_user_account.
--
-- Basis: 20261007120000_account_deletion.sql. The deletion function is NOT
-- overloaded via CREATE OR REPLACE (which would leave the old `(uuid)` variant
-- executable); it is dropped and recreated with the new signature
-- `(uuid, text DEFAULT NULL)`. The DEFAULT keeps old `(uuid)` callers working.
--
--   A  private.deleted_accounts_log              (deletion log, two-track)
--   B  public.import_quota_usage / _global       (import quota counters)
--   DM-1  bug_reports.anonymised_at + private.anonymise_bug_report_metadata
--
-- Production migrations run ONLY via the "Apply Supabase Migrations" workflow.

-- A — deletion log -----------------------------------------------------------

CREATE TABLE private.deleted_accounts_log (
  user_hash  text        NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX deleted_accounts_log_deleted_at_idx
  ON private.deleted_accounts_log (deleted_at);

REVOKE ALL ON TABLE private.deleted_accounts_log FROM PUBLIC, anon, authenticated;

-- B — import quota counters --------------------------------------------------

CREATE TABLE public.import_quota_usage (
  user_id uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day     date    NOT NULL,
  count   integer NOT NULL DEFAULT 0 CHECK (count >= 0),
  PRIMARY KEY (user_id, day)
);

ALTER TABLE public.import_quota_usage ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.import_quota_global (
  day   date    PRIMARY KEY,
  count integer NOT NULL DEFAULT 0 CHECK (count >= 0)
);

ALTER TABLE public.import_quota_global ENABLE ROW LEVEL SECURITY;

-- DM-1 — bug-report anonymisation -------------------------------------------

ALTER TABLE public.bug_reports ADD COLUMN IF NOT EXISTS anonymised_at timestamptz NULL;

-- Whitelist anonymisation: keeps only keys that are useful for debugging and
-- free of personal data. `route`, `userAgent`, `osVersion`, `viewport`,
-- `timestamp`, `sourceUrl`, `sourceType`, `jobId`, `errorMessage` and the bulk
-- of `lastFailureSnapshot` (incl. `submittedUrl`) are dropped.
CREATE OR REPLACE FUNCTION private.anonymise_bug_report_metadata(m jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT jsonb_strip_nulls(jsonb_build_object(
    'appVersion',     m->'appVersion',
    'platform',       m->'platform',
    'importMode',     m->'importMode',
    'jobStatus',      m->'jobStatus',
    'currentStage',   m->'currentStage',
    'errorHint',      m->'errorHint',
    'qualityWarnings', m->'qualityWarnings',
    'snapshotMode',   m->'lastFailureSnapshot'->'mode'
  ));
$$;

REVOKE ALL ON FUNCTION private.anonymise_bug_report_metadata(jsonb) FROM PUBLIC, anon, authenticated;

-- The deletion function — one new version -----------------------------------

DROP FUNCTION private.delete_user_account(uuid);

CREATE FUNCTION private.delete_user_account(p_user_id uuid, p_user_hash text DEFAULT NULL)
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

  -- Deletion log (two-track with the stdout line the server emits): only written
  -- when a hash was supplied, so Art. 17 deletion never fails on a missing
  -- DELETION_LOG_PEPPER.
  IF p_user_hash IS NOT NULL AND p_user_hash <> '' THEN
    INSERT INTO private.deleted_accounts_log (user_hash) VALUES (p_user_hash);
  END IF;

  -- Bug reports stay, but lose their link to the person (whitelist-anonymised).
  UPDATE public.bug_reports
     SET user_id = NULL,
         household_id = NULL,
         route = NULL,
         metadata_json = private.anonymise_bug_report_metadata(metadata_json),
         anonymised_at = now(),
         updated_at = now()
   WHERE user_id = p_user_id OR household_id = ANY (v_household_ids);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('bug_reports_anonymised', v_n);

  DELETE FROM public.import_quota_usage WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('import_quota_usage', v_n);

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

REVOKE ALL ON FUNCTION private.delete_user_account(uuid, text) FROM PUBLIC, anon, authenticated;

-- One-time backfill: reports already anonymised by 20261007120000 (user_id IS
-- NULL) get the new anonymisation applied so they carry no leftover personal
-- metadata either.
UPDATE public.bug_reports
   SET route = NULL,
       metadata_json = private.anonymise_bug_report_metadata(metadata_json),
       anonymised_at = now(),
       updated_at = now()
 WHERE user_id IS NULL AND anonymised_at IS NULL;
