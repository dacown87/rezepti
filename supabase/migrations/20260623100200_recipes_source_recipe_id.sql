-- Provenance of a share copy: points to the recipe this row was copied from.
-- NOT a visibility mechanism; visibility/authorization is enforced in TypeScript.
ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS source_recipe_id integer NULL
    REFERENCES public.recipes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS recipes_source_recipe_id_idx
  ON public.recipes (source_recipe_id);
