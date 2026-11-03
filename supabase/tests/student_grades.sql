
BEGIN;
SELECT set_config('osas.grade_admin', (SELECT id::text FROM public.users WHERE role = 'admin' LIMIT 1), true);
SELECT set_config('osas.grade_student', (SELECT id::text FROM public.users WHERE role <> 'admin' LIMIT 1), true);
SELECT set_config('osas.grade_other', (SELECT id::text FROM public.users WHERE role <> 'admin' LIMIT 1 OFFSET 1), true);
SELECT set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('osas.grade_admin'), 'role', 'authenticated', 'app_metadata', jsonb_build_object('role', 'admin'))::text, true);
SET LOCAL ROLE authenticated;
INSERT INTO public.student_grades(user_id, grade_level) VALUES
  (current_setting('osas.grade_student')::uuid, 10), (current_setting('osas.grade_other')::uuid, 11)
  ON CONFLICT(user_id) DO UPDATE SET grade_level = excluded.grade_level;
DO $$ BEGIN
  BEGIN
    UPDATE public.student_grades SET grade_level = 13 WHERE user_id = current_setting('osas.grade_student')::uuid;
    RAISE EXCEPTION 'Out-of-range grade accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
END; $$;
RESET ROLE;
SELECT set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('osas.grade_student'), 'role', 'authenticated', 'app_metadata', jsonb_build_object('role', 'client'), 'user_metadata', jsonb_build_object('role', 'admin'))::text, true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE affected integer;
BEGIN
  IF (SELECT grade_level FROM public.student_grades WHERE user_id = auth.uid()) IS DISTINCT FROM 10 THEN RAISE EXCEPTION 'Own grade not readable'; END IF;
  IF EXISTS(SELECT 1 FROM public.student_grades WHERE user_id = current_setting('osas.grade_other')::uuid) THEN RAISE EXCEPTION 'Other student grade leaked'; END IF;
  UPDATE public.student_grades SET grade_level = 12 WHERE user_id = auth.uid();
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Student changed own grade'; END IF;
  DELETE FROM public.student_grades WHERE user_id = auth.uid();
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Student deleted own grade'; END IF;
  BEGIN
    INSERT INTO public.student_grades(user_id, grade_level) VALUES (auth.uid(), 12) ON CONFLICT(user_id) DO UPDATE SET grade_level = excluded.grade_level;
    RAISE EXCEPTION 'Student assigned own grade';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SET LOCAL ROLE anon;
DO $$ BEGIN
  BEGIN
    PERFORM 1 FROM public.student_grades;
    RAISE EXCEPTION 'Anonymous grade access allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END; $$;
RESET ROLE;
SELECT set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('osas.grade_admin'), 'role', 'authenticated', 'app_metadata', jsonb_build_object('role', 'admin'))::text, true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  UPDATE public.student_grades SET grade_level = 12 WHERE user_id = current_setting('osas.grade_student')::uuid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Admin grade update failed'; END IF;
  DELETE FROM public.student_grades WHERE user_id = current_setting('osas.grade_other')::uuid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Admin grade deletion failed'; END IF;
END; $$;
RESET ROLE;
ROLLBACK;
SELECT 'Student grade isolation, admin assignment, and range checks passed' AS result;
