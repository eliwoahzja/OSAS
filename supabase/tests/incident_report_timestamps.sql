-- Run as postgres in a disposable database after the incident migrations.
-- All fixtures roll back; this does not rewrite historical incident timestamps.
BEGIN;
SET LOCAL TIME ZONE 'Pacific/Honolulu';

INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
VALUES
  ('97000000-0000-4000-8000-000000000001', 'timestamp-student@example.invalid', '{"role":"client"}', '{"name":"Timestamp Student"}'),
  ('97000000-0000-4000-8000-000000000002', 'timestamp-other@example.invalid', '{"role":"client"}', '{"name":"Other Student"}'),
  ('97000000-0000-4000-8000-000000000003', 'timestamp-admin@example.invalid', '{"role":"admin"}', '{"name":"Timestamp Admin"}');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"97000000-0000-4000-8000-000000000001","email":"timestamp-student@example.invalid","app_metadata":{"role":"client"},"user_metadata":{"name":"Timestamp Student","role":"admin"}}', true);

DO $$
DECLARE
  reported public.incidents%ROWTYPE;
  minimal public.incidents%ROWTYPE;
  changed integer;
BEGIN
  -- The database overrides a forged clock and attribution from an old client.
  INSERT INTO public.incidents (id, description, reporter, status, date, time, created_at, submitted_by)
  VALUES ('97100000-0000-4000-8000-000000000001', '__qa_timestamp_forged__', 'Another reporter', 'resolved', '1900-01-01', '12:00 AM', '1900-01-01 00:00:00+00', '97000000-0000-4000-8000-000000000002')
  RETURNING * INTO reported;
  IF reported.created_at <> statement_timestamp()
     OR reported.date <> (statement_timestamp() AT TIME ZONE 'Asia/Manila')::date
     OR reported.time <> to_char(statement_timestamp() AT TIME ZONE 'Asia/Manila', 'HH12:MI AM') THEN
    RAISE EXCEPTION 'Report timestamp must use the server submission time in Asia/Manila';
  END IF;
  IF reported.submitted_by <> auth.uid() OR reported.reporter <> 'Timestamp Student' OR reported.status <> 'open' THEN
    RAISE EXCEPTION 'Automatic timestamps must preserve account attribution and student status rules';
  END IF;

  -- A report requires no date or time fields from its browser.
  INSERT INTO public.incidents (id, description, reporter, status)
  VALUES ('97100000-0000-4000-8000-000000000002', '__qa_timestamp_minimal__', 'Timestamp Student', 'open')
  RETURNING * INTO minimal;
  IF minimal.created_at IS NULL OR minimal.date IS NULL OR minimal.time IS NULL THEN
    RAISE EXCEPTION 'Minimal report submission did not receive an automatic date and time';
  END IF;

  -- Another student cannot see the timestamped reports.
  PERFORM set_config('request.jwt.claims', '{"sub":"97000000-0000-4000-8000-000000000002","app_metadata":{"role":"client"}}', true);
  IF EXISTS (SELECT 1 FROM public.incidents WHERE id IN (reported.id, minimal.id)) THEN
    RAISE EXCEPTION 'Automatic timestamp change opened another student''s reports';
  END IF;

  -- Admin status review must not alter the original submission timestamp.
  PERFORM set_config('request.jwt.claims', '{"sub":"97000000-0000-4000-8000-000000000003","app_metadata":{"role":"admin"}}', true);
  UPDATE public.incidents
    SET status = 'resolved', created_at = '2099-12-31 23:59:59+00', date = '2099-12-31', time = '11:59 PM', submitted_by = '97000000-0000-4000-8000-000000000002'
    WHERE id = reported.id;
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 1 OR NOT EXISTS (
    SELECT 1 FROM public.incidents
    WHERE id = reported.id AND status = 'resolved'
      AND created_at = reported.created_at AND date = reported.date AND time = reported.time
      AND submitted_by = reported.submitted_by
  ) THEN RAISE EXCEPTION 'Admin review rewrote the report submission time or owner'; END IF;
END;
$$;

RESET ROLE;
SELECT 'PASS: server date/time, forged client clock ignored, minimal form, student privacy, and immutable submission time during admin review' AS timestamp_checks;
ROLLBACK;
