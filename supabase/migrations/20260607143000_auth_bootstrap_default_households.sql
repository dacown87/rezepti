CREATE TABLE IF NOT EXISTS public.user_default_households (
  user_id uuid PRIMARY KEY REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
  household_id uuid NOT NULL UNIQUE REFERENCES public.households(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_default_households_household_idx
ON public.user_default_households (household_id);

ALTER TABLE public.user_default_households ENABLE ROW LEVEL SECURITY;
