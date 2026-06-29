CREATE TABLE IF NOT EXISTS public.recipe_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type text NOT NULL,
  owner_user_id uuid NULL,
  household_id uuid NULL,
  kind text NOT NULL,
  name text NOT NULL,
  slug text NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recipe_collections_owner_type_check CHECK (owner_type IN ('user', 'household')),
  CONSTRAINT recipe_collections_kind_check CHECK (kind IN ('favorites', 'custom')),
  CONSTRAINT recipe_collections_owner_shape_check CHECK (
    (owner_type = 'user' AND owner_user_id IS NOT NULL AND household_id IS NULL)
    OR
    (owner_type = 'household' AND owner_user_id IS NULL AND household_id IS NOT NULL)
  )
);

-- Exactly one favorites collection per user.
CREATE UNIQUE INDEX IF NOT EXISTS recipe_collections_user_favorites_uidx
  ON public.recipe_collections (owner_user_id)
  WHERE kind = 'favorites' AND owner_type = 'user';

-- Exactly one favorites collection per household.
CREATE UNIQUE INDEX IF NOT EXISTS recipe_collections_household_favorites_uidx
  ON public.recipe_collections (household_id)
  WHERE kind = 'favorites' AND owner_type = 'household';

CREATE INDEX IF NOT EXISTS recipe_collections_owner_user_created_at_idx
  ON public.recipe_collections (owner_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS recipe_collections_household_created_at_idx
  ON public.recipe_collections (household_id, created_at DESC);

ALTER TABLE public.recipe_collections ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.recipe_collections FROM anon, authenticated;
