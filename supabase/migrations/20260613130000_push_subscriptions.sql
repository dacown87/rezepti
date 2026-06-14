CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id          serial PRIMARY KEY,
  user_id     uuid NOT NULL,
  endpoint    text NOT NULL,
  keys        text NOT NULL,            -- JSON { p256dh, auth }
  created_at  timestamptz DEFAULT now(),
  UNIQUE (user_id, endpoint)
);
CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON public.push_subscriptions (user_id);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY push_subscriptions_owner_select ON public.push_subscriptions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY push_subscriptions_owner_modify ON public.push_subscriptions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
