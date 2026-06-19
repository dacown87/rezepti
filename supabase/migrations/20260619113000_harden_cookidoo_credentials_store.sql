ALTER TABLE public.cookidoo_credentials ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.cookidoo_credentials FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.cookidoo_credentials_id_seq FROM anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'cookidoo_credentials_household_id_fkey'
      AND conrelid = 'public.cookidoo_credentials'::regclass
  ) THEN
    ALTER TABLE public.cookidoo_credentials
      ADD CONSTRAINT cookidoo_credentials_household_id_fkey
      FOREIGN KEY (household_id)
      REFERENCES public.households(id)
      ON DELETE CASCADE;
  END IF;
END $$;
