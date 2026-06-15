CREATE TABLE IF NOT EXISTS public.byok_validation_rate_limits (
  user_id       uuid        NOT NULL,
  key_hash      text        NOT NULL,
  window_start  timestamptz NOT NULL,
  request_count integer     NOT NULL DEFAULT 1,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key_hash, window_start)
);

CREATE INDEX IF NOT EXISTS byok_validation_rate_limits_user_window_idx
  ON public.byok_validation_rate_limits (user_id, window_start);

ALTER TABLE public.byok_validation_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY byok_validation_rate_limits_owner_select
  ON public.byok_validation_rate_limits
  FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY byok_validation_rate_limits_owner_modify
  ON public.byok_validation_rate_limits
  FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
