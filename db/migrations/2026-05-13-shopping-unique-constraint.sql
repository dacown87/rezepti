-- Idempotency guard for shopping_list inserts.
--
-- Problem: addToShoppingList did a plain INSERT, so rapid double-clicks on
-- "Zur Einkaufsliste" or retry paths could create duplicate rows for the same
-- (user_id, recipe_id, canonical_name) tuple.
--
-- Fix:
--   1. Remove existing duplicates (keep the row with the highest id per tuple).
--   2. Add a composite unique constraint with NULLS NOT DISTINCT so that NULL
--      user_id / recipe_id values are treated as equal (Postgres 15+).
--      This matches the Drizzle schema declaration in src/schema.ts.
--
-- Run once in the Supabase SQL Editor (or via drizzle-kit push --force locally).

-- Step 1: Dedup — delete all but the latest row per (user_id, recipe_id, canonical_name).
DELETE FROM public.shopping_list
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, recipe_id, canonical_name) id
  FROM public.shopping_list
  ORDER BY user_id, recipe_id, canonical_name, id DESC
);

-- Step 2: Create the composite unique constraint if it does not exist yet.
-- NULLS NOT DISTINCT ensures (NULL, NULL, 'Tomate') conflicts with itself,
-- which is required while user_id is globally NULL (pre-Multi-User phase).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'shopping_list_user_recipe_name_uidx'
      AND conrelid = 'public.shopping_list'::regclass
  ) THEN
    IF to_regclass('public.shopping_list_user_recipe_name_uidx') IS NOT NULL THEN
      EXECUTE 'DROP INDEX public.shopping_list_user_recipe_name_uidx';
    END IF;

    ALTER TABLE public.shopping_list
      ADD CONSTRAINT shopping_list_user_recipe_name_uidx
      UNIQUE NULLS NOT DISTINCT (user_id, recipe_id, canonical_name);
  END IF;
END
$$;
