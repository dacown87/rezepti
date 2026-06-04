-- Multi-user household auth skeleton.
--
-- Scope:
--   - DB-backed app role source for server authorization.
--   - Household and membership basis for shopping/planner scoping.
--   - household_id on shopping_list and meal_plan.
--   - Narrow RLS/grants for household, shopping_list, and meal_plan only.
--
-- Deliberately not opened here:
--   - recipes authenticated CRUD.
--   - api_keys or ingredient_dictionary Data API access.
--   - broad admin data visibility.

CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  app_role text NOT NULL DEFAULT 'user' CHECK (app_role IN ('user', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.household_memberships (
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT household_memberships_pkey PRIMARY KEY (household_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.shopping_list (
  id serial PRIMARY KEY,
  recipe_id integer,
  household_id uuid REFERENCES public.households(id) ON DELETE CASCADE,
  canonical_name text NOT NULL,
  quantity text,
  unit text,
  checked boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  user_id uuid
);

CREATE TABLE IF NOT EXISTS public.meal_plan (
  id serial PRIMARY KEY,
  recipe_id integer NOT NULL,
  household_id uuid REFERENCES public.households(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL,
  week_start integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  user_id uuid
);

CREATE INDEX IF NOT EXISTS user_profiles_app_role_idx
ON public.user_profiles (app_role);

CREATE INDEX IF NOT EXISTS household_memberships_user_idx
ON public.household_memberships (user_id);

CREATE INDEX IF NOT EXISTS household_memberships_household_idx
ON public.household_memberships (household_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'shopping_list'
      AND column_name = 'household_id'
  ) THEN
    ALTER TABLE public.shopping_list ADD COLUMN household_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'meal_plan'
      AND column_name = 'household_id'
  ) THEN
    ALTER TABLE public.meal_plan ADD COLUMN household_id uuid;
  END IF;
END $$;

ALTER TABLE public.shopping_list
  DROP CONSTRAINT IF EXISTS shopping_list_user_recipe_name_uidx;

CREATE UNIQUE INDEX IF NOT EXISTS shopping_list_household_recipe_name_uidx
ON public.shopping_list (household_id, recipe_id, canonical_name) NULLS NOT DISTINCT;

CREATE INDEX IF NOT EXISTS shopping_list_household_idx
ON public.shopping_list (household_id);

CREATE INDEX IF NOT EXISTS meal_plan_household_week_idx
ON public.meal_plan (household_id, week_start);

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM anon, authenticated;

CREATE OR REPLACE FUNCTION private.prevent_user_id_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'user_id cannot be changed'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_shopping_list_user_id_change ON public.shopping_list;
CREATE TRIGGER prevent_shopping_list_user_id_change
BEFORE UPDATE OF user_id ON public.shopping_list
FOR EACH ROW
EXECUTE FUNCTION private.prevent_user_id_change();

DROP TRIGGER IF EXISTS prevent_meal_plan_user_id_change ON public.meal_plan;
CREATE TRIGGER prevent_meal_plan_user_id_change
BEFORE UPDATE OF user_id ON public.meal_plan
FOR EACH ROW
EXECUTE FUNCTION private.prevent_user_id_change();

ALTER TABLE public.shopping_list
  DROP CONSTRAINT IF EXISTS shopping_list_household_id_fkey,
  ADD CONSTRAINT shopping_list_household_id_fkey
    FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;

ALTER TABLE public.meal_plan
  DROP CONSTRAINT IF EXISTS meal_plan_household_id_fkey,
  ADD CONSTRAINT meal_plan_household_id_fkey
    FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;

-- This slice assumes current shopping/planner data is disposable test data.
-- If rows exist before applying to staging/prod, bootstrap or reset them first,
-- then run the NOT NULL statements below.
ALTER TABLE public.shopping_list
  ALTER COLUMN household_id SET NOT NULL;

ALTER TABLE public.meal_plan
  ALTER COLUMN household_id SET NOT NULL;

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_plan ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.user_profiles TO authenticated;
GRANT SELECT ON public.households TO authenticated;
GRANT SELECT ON public.household_memberships TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shopping_list TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meal_plan TO authenticated;

GRANT USAGE, SELECT ON SEQUENCE public.shopping_list_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.meal_plan_id_seq TO authenticated;

DROP POLICY IF EXISTS "user_profiles_select_self" ON public.user_profiles;
CREATE POLICY "user_profiles_select_self"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "households_select_memberships" ON public.households;
CREATE POLICY "households_select_memberships"
ON public.households
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.household_memberships hm
    WHERE hm.household_id = households.id
      AND hm.user_id = (select auth.uid())
  )
);

DROP POLICY IF EXISTS "household_memberships_select_self" ON public.household_memberships;
CREATE POLICY "household_memberships_select_self"
ON public.household_memberships
FOR SELECT
TO authenticated
USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "shopping_list_select_household_members" ON public.shopping_list;
CREATE POLICY "shopping_list_select_household_members"
ON public.shopping_list
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.household_memberships hm
    WHERE hm.household_id = shopping_list.household_id
      AND hm.user_id = (select auth.uid())
  )
);

DROP POLICY IF EXISTS "shopping_list_insert_household_members" ON public.shopping_list;
CREATE POLICY "shopping_list_insert_household_members"
ON public.shopping_list
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = (select auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.household_memberships hm
    WHERE hm.household_id = shopping_list.household_id
      AND hm.user_id = (select auth.uid())
  )
);

DROP POLICY IF EXISTS "shopping_list_update_household_members" ON public.shopping_list;
CREATE POLICY "shopping_list_update_household_members"
ON public.shopping_list
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.household_memberships hm
    WHERE hm.household_id = shopping_list.household_id
      AND hm.user_id = (select auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.household_memberships hm
    WHERE hm.household_id = shopping_list.household_id
      AND hm.user_id = (select auth.uid())
  )
);

DROP POLICY IF EXISTS "shopping_list_delete_household_members" ON public.shopping_list;
CREATE POLICY "shopping_list_delete_household_members"
ON public.shopping_list
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.household_memberships hm
    WHERE hm.household_id = shopping_list.household_id
      AND hm.user_id = (select auth.uid())
  )
);

DROP POLICY IF EXISTS "meal_plan_select_household_members" ON public.meal_plan;
CREATE POLICY "meal_plan_select_household_members"
ON public.meal_plan
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.household_memberships hm
    WHERE hm.household_id = meal_plan.household_id
      AND hm.user_id = (select auth.uid())
  )
);

DROP POLICY IF EXISTS "meal_plan_insert_household_members" ON public.meal_plan;
CREATE POLICY "meal_plan_insert_household_members"
ON public.meal_plan
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = (select auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.household_memberships hm
    WHERE hm.household_id = meal_plan.household_id
      AND hm.user_id = (select auth.uid())
  )
);

DROP POLICY IF EXISTS "meal_plan_update_household_members" ON public.meal_plan;
CREATE POLICY "meal_plan_update_household_members"
ON public.meal_plan
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.household_memberships hm
    WHERE hm.household_id = meal_plan.household_id
      AND hm.user_id = (select auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.household_memberships hm
    WHERE hm.household_id = meal_plan.household_id
      AND hm.user_id = (select auth.uid())
  )
);

DROP POLICY IF EXISTS "meal_plan_delete_household_members" ON public.meal_plan;
CREATE POLICY "meal_plan_delete_household_members"
ON public.meal_plan
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.household_memberships hm
    WHERE hm.household_id = meal_plan.household_id
      AND hm.user_id = (select auth.uid())
  )
);
