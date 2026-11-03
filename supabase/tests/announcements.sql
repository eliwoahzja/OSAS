
BEGIN;
SELECT set_config('osas.test_admin_id', (SELECT id::text FROM public.users WHERE role = 'admin' LIMIT 1), true);
SELECT set_config('osas.test_student_id', (SELECT id::text FROM public.users WHERE role <> 'admin' LIMIT 1), true);
SELECT set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('osas.test_admin_id'), 'role', 'authenticated', 'app_metadata', jsonb_build_object('role', 'admin'))::text, true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE saved public.announcements%ROWTYPE;
BEGIN
  INSERT INTO public.announcements(title, body) VALUES ('  Announcement test  ', '  A school update  ') RETURNING * INTO saved;
  PERFORM set_config('osas.test_announcement_id', saved.id::text, true);
  IF saved.title <> 'Announcement test' OR saved.body <> 'A school update'
    OR saved.author_id <> auth.uid() OR saved.author_name IS NULL
    OR saved.created_at <> saved.updated_at THEN RAISE EXCEPTION 'Attribution/timestamps failed'; END IF;
  BEGIN
    INSERT INTO public.announcements(title, body, author_name) VALUES ('Spoof', 'Message', 'Fake admin');
    RAISE EXCEPTION 'Author spoof was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE public.announcements SET created_at = '1900-01-01' WHERE id = saved.id;
    RAISE EXCEPTION 'Timestamp spoof was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO public.announcements(title, body) VALUES (' ', 'Message');
    RAISE EXCEPTION 'Empty title was allowed';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.announcements(title, body) VALUES ('Title', repeat('x', 5001));
    RAISE EXCEPTION 'Oversize message was allowed';
  EXCEPTION WHEN check_violation THEN NULL; END;
END;
$$;
RESET ROLE;

SELECT set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('osas.test_student_id'), 'role', 'authenticated', 'app_metadata', jsonb_build_object('role', 'client'), 'user_metadata', jsonb_build_object('role', 'admin'))::text, true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE affected integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.announcements WHERE id = current_setting('osas.test_announcement_id')::uuid) THEN RAISE EXCEPTION 'Student could not read announcement'; END IF;
  BEGIN
    INSERT INTO public.announcements(title, body) VALUES ('Student post', 'Must fail');
    RAISE EXCEPTION 'Student published an announcement';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  UPDATE public.announcements SET body = 'Tampered' WHERE id = current_setting('osas.test_announcement_id')::uuid;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Student edited announcement'; END IF;
  DELETE FROM public.announcements WHERE id = current_setting('osas.test_announcement_id')::uuid;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Student deleted announcement'; END IF;
END;
$$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SET LOCAL ROLE anon;
DO $$ BEGIN
  BEGIN
    PERFORM 1 FROM public.announcements;
    RAISE EXCEPTION 'Anonymous read was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END; $$;
RESET ROLE;
SELECT set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('osas.test_admin_id'), 'role', 'authenticated', 'app_metadata', jsonb_build_object('role', 'admin'))::text, true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE saved public.announcements%ROWTYPE; affected integer;
BEGIN
  UPDATE public.announcements SET title = 'Edited announcement', body = 'Edited message'
    WHERE id = current_setting('osas.test_announcement_id')::uuid RETURNING * INTO saved;
  IF saved.title <> 'Edited announcement' OR saved.author_id <> auth.uid() THEN RAISE EXCEPTION 'Admin edit failed'; END IF;
  DELETE FROM public.announcements WHERE id = saved.id;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'Admin deletion failed'; END IF;
END;
$$;
RESET ROLE;
ROLLBACK;
SELECT 'Announcement read, admin CRUD, attribution, validation, and student/anonymous denial passed' AS result;
