CREATE TABLE IF NOT EXISTS public.recipe_share_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_recipe_id integer NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL,
  recipient_email text NOT NULL,
  token_hash text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  accepted_by_user_id uuid NULL,
  accepted_recipe_id integer NULL REFERENCES public.recipes(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz NULL,
  CONSTRAINT recipe_share_invites_status_check CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  CONSTRAINT recipe_share_invites_accepted_shape_check CHECK (
    (status = 'accepted' AND accepted_by_user_id IS NOT NULL AND accepted_at IS NOT NULL)
    OR
    (status <> 'accepted' AND accepted_by_user_id IS NULL AND accepted_recipe_id IS NULL AND accepted_at IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS recipe_share_invites_token_hash_uidx
  ON public.recipe_share_invites (token_hash);

CREATE INDEX IF NOT EXISTS recipe_share_invites_sender_idx
  ON public.recipe_share_invites (sender_user_id);

CREATE INDEX IF NOT EXISTS recipe_share_invites_recipient_email_idx
  ON public.recipe_share_invites (recipient_email);

CREATE INDEX IF NOT EXISTS recipe_share_invites_source_recipe_idx
  ON public.recipe_share_invites (source_recipe_id);

CREATE INDEX IF NOT EXISTS recipe_share_invites_expires_at_idx
  ON public.recipe_share_invites (expires_at);

ALTER TABLE public.recipe_share_invites ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.recipe_share_invites FROM anon, authenticated;
