-- Recipes ownership core.
--
-- Hard migration by product decision:
--   - recipes.user_id IS NULL rows are legacy/test data and are removed.
--   - remaining user-owned rows become private recipes.
--   - no public/global recipe owner remains.
--   - recipes stays closed to anon/authenticated Data API access.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM public, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.recipes (
  id serial PRIMARY KEY,
  name text NOT NULL,
  emoji text,
  source_url text,
  image_url text,
  servings text,
  duration text,
  calories integer,
  tags text,
  category text,
  ingredients text NOT NULL,
  steps text NOT NULL,
  transcript text,
  equipment text,
  nutrition_info text,
  ingredient_groups text,
  tried boolean DEFAULT false,
  rating integer,
  notes text,
  pdf_created boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  user_id uuid
);

DO $$
BEGIN
  IF to_regclass('public.recipes') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'recipes' AND column_name = 'owner_type'
    ) THEN
      ALTER TABLE public.recipes ADD COLUMN owner_type text;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'recipes' AND column_name = 'owner_user_id'
    ) THEN
      ALTER TABLE public.recipes ADD COLUMN owner_user_id uuid;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'recipes' AND column_name = 'household_id'
    ) THEN
      ALTER TABLE public.recipes ADD COLUMN household_id uuid;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'recipes' AND column_name = 'created_by'
    ) THEN
      ALTER TABLE public.recipes ADD COLUMN created_by uuid;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'recipes' AND column_name = 'updated_at'
    ) THEN
      ALTER TABLE public.recipes ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
    END IF;
  END IF;
END $$;

-- Existing null-owner recipes are disposable legacy/test rows.
DELETE FROM public.shopping_list sl
USING public.recipes r
WHERE sl.recipe_id = r.id
  AND r.user_id IS NULL;

DELETE FROM public.meal_plan mp
USING public.recipes r
WHERE mp.recipe_id = r.id
  AND r.user_id IS NULL;

DELETE FROM public.recipes
WHERE user_id IS NULL;

UPDATE public.recipes
SET
  owner_type = 'user',
  owner_user_id = user_id,
  household_id = NULL,
  created_by = user_id
WHERE user_id IS NOT NULL;

ALTER TABLE public.recipes
  DROP CONSTRAINT IF EXISTS recipes_owner_type_check,
  DROP CONSTRAINT IF EXISTS recipes_owner_shape_check,
  DROP CONSTRAINT IF EXISTS recipes_owner_user_id_fkey,
  DROP CONSTRAINT IF EXISTS recipes_created_by_fkey,
  DROP CONSTRAINT IF EXISTS recipes_household_id_fkey;

ALTER TABLE public.recipes
  ALTER COLUMN owner_type SET NOT NULL,
  ADD CONSTRAINT recipes_owner_type_check
    CHECK (owner_type IN ('user', 'household')),
  ADD CONSTRAINT recipes_owner_shape_check
    CHECK (
      (owner_type = 'user' AND owner_user_id IS NOT NULL AND household_id IS NULL)
      OR
      (owner_type = 'household' AND owner_user_id IS NULL AND household_id IS NOT NULL)
    ),
  ADD CONSTRAINT recipes_owner_user_id_fkey
    FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD CONSTRAINT recipes_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD CONSTRAINT recipes_household_id_fkey
    FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;

ALTER TABLE public.recipes
  DROP COLUMN IF EXISTS user_id;

CREATE INDEX IF NOT EXISTS recipes_owner_user_idx
ON public.recipes (owner_user_id, created_at DESC, id)
WHERE owner_type = 'user';

CREATE INDEX IF NOT EXISTS recipes_household_idx
ON public.recipes (household_id, created_at DESC, id)
WHERE owner_type = 'household';

CREATE INDEX IF NOT EXISTS recipes_created_by_idx
ON public.recipes (created_by);

-- Remove dangling planner/shopping references before adding FKs.
DELETE FROM public.meal_plan mp
WHERE NOT EXISTS (
  SELECT 1 FROM public.recipes r WHERE r.id = mp.recipe_id
);

UPDATE public.shopping_list sl
SET recipe_id = NULL
WHERE recipe_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.recipes r WHERE r.id = sl.recipe_id
  );

ALTER TABLE public.meal_plan
  DROP CONSTRAINT IF EXISTS meal_plan_recipe_id_fkey,
  ADD CONSTRAINT meal_plan_recipe_id_fkey
    FOREIGN KEY (recipe_id) REFERENCES public.recipes(id) ON DELETE CASCADE;

ALTER TABLE public.shopping_list
  DROP CONSTRAINT IF EXISTS shopping_list_recipe_id_fkey,
  ADD CONSTRAINT shopping_list_recipe_id_fkey
    FOREIGN KEY (recipe_id) REFERENCES public.recipes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS meal_plan_recipe_idx
ON public.meal_plan (recipe_id);

CREATE INDEX IF NOT EXISTS shopping_list_recipe_idx
ON public.shopping_list (recipe_id);

CREATE OR REPLACE FUNCTION private.recipe_belongs_to_household(
  target_recipe_id integer,
  target_household_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.recipes r
    WHERE r.id = target_recipe_id
      AND r.owner_type = 'household'
      AND r.household_id = target_household_id
  );
$$;

REVOKE ALL ON FUNCTION private.recipe_belongs_to_household(integer, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.recipe_belongs_to_household(integer, uuid) TO authenticated;

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
  AND (
    recipe_id IS NULL
    OR private.recipe_belongs_to_household(recipe_id, household_id)
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
  AND (
    recipe_id IS NULL
    OR private.recipe_belongs_to_household(recipe_id, household_id)
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
  AND private.recipe_belongs_to_household(recipe_id, household_id)
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
  AND private.recipe_belongs_to_household(recipe_id, household_id)
);

ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.recipes FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.recipes_id_seq FROM anon, authenticated;
