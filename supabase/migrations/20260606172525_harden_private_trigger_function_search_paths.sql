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
