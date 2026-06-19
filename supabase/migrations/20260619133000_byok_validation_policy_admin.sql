CREATE TABLE IF NOT EXISTS public.byok_validation_policies (
  singleton_key      text PRIMARY KEY,
  window_minutes     integer     NOT NULL,
  max_requests       integer     NOT NULL,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  updated_by_user_id uuid,
  CONSTRAINT byok_validation_policies_window_minutes_check CHECK (window_minutes >= 1 AND window_minutes <= 1440),
  CONSTRAINT byok_validation_policies_max_requests_check CHECK (max_requests >= 1 AND max_requests <= 1000)
);

CREATE INDEX IF NOT EXISTS byok_validation_policies_updated_by_idx
  ON public.byok_validation_policies (updated_by_user_id);

ALTER TABLE public.byok_validation_policies ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.byok_validation_policies FROM anon, authenticated;
