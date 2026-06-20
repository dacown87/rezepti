CREATE TABLE IF NOT EXISTS public.bug_reports (
  id uuid PRIMARY KEY,
  report_type text NOT NULL,
  status text NOT NULL,
  description text NOT NULL,
  user_id uuid NOT NULL,
  household_id uuid NULL,
  route text NULL,
  source_area text NOT NULL,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  admin_notes text NULL,
  resolved_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bug_reports_report_type_check CHECK (report_type IN ('general', 'import_failure')),
  CONSTRAINT bug_reports_status_check CHECK (status IN ('new', 'triaging', 'in_progress', 'resolved', 'closed')),
  CONSTRAINT bug_reports_source_area_check CHECK (source_area IN ('global_button', 'import_error'))
);

CREATE INDEX IF NOT EXISTS bug_reports_user_idx
  ON public.bug_reports (user_id);

CREATE INDEX IF NOT EXISTS bug_reports_status_idx
  ON public.bug_reports (status);

CREATE INDEX IF NOT EXISTS bug_reports_report_type_idx
  ON public.bug_reports (report_type);

CREATE INDEX IF NOT EXISTS bug_reports_created_at_idx
  ON public.bug_reports (created_at DESC, id);

CREATE INDEX IF NOT EXISTS bug_reports_user_created_at_idx
  ON public.bug_reports (user_id, created_at DESC, id);

CREATE TABLE IF NOT EXISTS public.bug_report_submission_rate_limits (
  user_id uuid NOT NULL,
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, window_start)
);

CREATE INDEX IF NOT EXISTS bug_report_submission_rate_limits_user_window_idx
  ON public.bug_report_submission_rate_limits (user_id, window_start);

ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bug_report_submission_rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.bug_reports FROM anon, authenticated;
REVOKE ALL ON TABLE public.bug_report_submission_rate_limits FROM anon, authenticated;

GRANT SELECT, INSERT ON TABLE public.bug_reports TO authenticated;
GRANT UPDATE (status, admin_notes, resolved_at, updated_at) ON TABLE public.bug_reports TO authenticated;

DROP POLICY IF EXISTS bug_reports_owner_select ON public.bug_reports;
CREATE POLICY bug_reports_owner_select
  ON public.bug_reports
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS bug_reports_owner_insert ON public.bug_reports;
CREATE POLICY bug_reports_owner_insert
  ON public.bug_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND status = 'new'
    AND admin_notes IS NULL
    AND resolved_at IS NULL
  );

DROP POLICY IF EXISTS bug_reports_admin_select ON public.bug_reports;
CREATE POLICY bug_reports_admin_select
  ON public.bug_reports
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.user_id = (SELECT auth.uid())
        AND user_profiles.app_role = 'admin'
    )
  );

DROP POLICY IF EXISTS bug_reports_admin_update ON public.bug_reports;
CREATE POLICY bug_reports_admin_update
  ON public.bug_reports
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.user_id = (SELECT auth.uid())
        AND user_profiles.app_role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.user_id = (SELECT auth.uid())
        AND user_profiles.app_role = 'admin'
    )
  );
