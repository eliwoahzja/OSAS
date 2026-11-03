
BEGIN;
SELECT set_config('qa.read_student', (SELECT id::text FROM public.users WHERE role <> 'admin' LIMIT 1), true);
SELECT set_config('qa.read_admin', (SELECT id::text FROM public.users WHERE role = 'admin' LIMIT 1), true);
SELECT set_config('qa.read_counts', jsonb_build_object(
  'users',(SELECT count(*) FROM public.users), 'students',(SELECT count(*) FROM public.students),
  'drills',(SELECT count(*) FROM public.drills), 'risks',(SELECT count(*) FROM public.risks),
  'reports',(SELECT count(*) FROM public.reports))::text, true);
SELECT set_config('request.jwt.claims', jsonb_build_object('sub',current_setting('qa.read_student'),'role','authenticated','app_metadata',jsonb_build_object('role','client'),'user_metadata',jsonb_build_object('role','admin'))::text, true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.users) <> 1 OR NOT EXISTS(SELECT 1 FROM public.users WHERE id = auth.uid()) THEN RAISE EXCEPTION 'Student own profile read failed'; END IF;
  IF EXISTS(SELECT 1 FROM public.users WHERE id <> auth.uid()) THEN RAISE EXCEPTION 'Other account data leaked'; END IF;
  IF EXISTS(SELECT 1 FROM public.students) OR EXISTS(SELECT 1 FROM public.drills)
    OR EXISTS(SELECT 1 FROM public.risks) OR EXISTS(SELECT 1 FROM public.reports)
    THEN RAISE EXCEPTION 'Student read administrator school records'; END IF;
END; $$;
RESET ROLE;
SELECT set_config('request.jwt.claims','{"role":"anon"}',true);
SET LOCAL ROLE anon;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.users) OR EXISTS(SELECT 1 FROM public.students)
    OR EXISTS(SELECT 1 FROM public.drills) OR EXISTS(SELECT 1 FROM public.risks)
    OR EXISTS(SELECT 1 FROM public.reports) THEN RAISE EXCEPTION 'Anonymous school data read allowed'; END IF;
END; $$;
RESET ROLE;
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa.read_admin'),'role','authenticated','app_metadata',jsonb_build_object('role','admin'))::text,true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE expected jsonb := current_setting('qa.read_counts')::jsonb;
BEGIN
  IF (SELECT count(*) FROM public.users) <> (expected->>'users')::bigint
    OR (SELECT count(*) FROM public.students) <> (expected->>'students')::bigint
    OR (SELECT count(*) FROM public.drills) <> (expected->>'drills')::bigint
    OR (SELECT count(*) FROM public.risks) <> (expected->>'risks')::bigint
    OR (SELECT count(*) FROM public.reports) <> (expected->>'reports')::bigint THEN RAISE EXCEPTION 'Administrator read regression'; END IF;
END; $$;
RESET ROLE;
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
SET LOCAL ROLE service_role;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.users) <> (current_setting('qa.read_counts')::jsonb->>'users')::bigint
    OR (SELECT count(*) FROM public.students) <> (current_setting('qa.read_counts')::jsonb->>'students')::bigint
    THEN RAISE EXCEPTION 'Server-side account/roster access regression'; END IF;
END; $$;
RESET ROLE;
ROLLBACK;
SELECT 'PASS: student own profile, private school tables, anonymous denial, admin access and server-role compatibility' AS result;
