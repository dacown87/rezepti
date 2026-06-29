CREATE TABLE IF NOT EXISTS public.recipe_collection_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES public.recipe_collections(id) ON DELETE CASCADE,
  recipe_id integer NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS recipe_collection_items_collection_recipe_uidx
  ON public.recipe_collection_items (collection_id, recipe_id);

CREATE INDEX IF NOT EXISTS recipe_collection_items_recipe_idx
  ON public.recipe_collection_items (recipe_id);

ALTER TABLE public.recipe_collection_items ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.recipe_collection_items FROM anon, authenticated;
