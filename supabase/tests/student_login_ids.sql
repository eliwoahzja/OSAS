-- Fixture changes are fully rolled back. Sequence gaps after rollback are
-- expected: issued IDs must never be reused.
BEGIN;
DO $$
DECLARE
  first_id uuid := '93000000-0000-4000-8000-000000000001';
  second_id uuid := '93000000-0000-4000-8000-000000000002';
  admin_id uuid := '93000000-0000-4000-8000-000000000003';
  delayed_id uuid := '93000000-0000-4000-8000-000000000004';
  saved_id text;
  other_id text;
BEGIN
  INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
    VALUES (first_id, 'osas-id-first@example.invalid', '{"role":"client"}', '{"name":"Student ID Test"}');
  SELECT student_id INTO saved_id FROM public.users WHERE id = first_id;
  IF saved_id IS NULL OR saved_id !~ '^s[0-9]{9}$' THEN RAISE EXCEPTION 'Student ID not automatically assigned'; END IF;

  INSERT INTO auth.users (id, email, raw_app_meta_data)
    VALUES (second_id, 'osas-id-second@example.invalid', '{"role":"client","student_id":"s230118648"}');
  SELECT student_id INTO other_id FROM public.users WHERE id = second_id;
  IF other_id IS NULL OR other_id = saved_id OR other_id = 's230118648' THEN RAISE EXCEPTION 'ID uniqueness or generation failed'; END IF;

  UPDATE auth.users SET email = 'osas-id-changed@example.invalid', raw_user_meta_data = '{"name":"Renamed Student","student_id":"s230118648"}' WHERE id = first_id;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = first_id AND student_id = saved_id AND email = 'osas-id-changed@example.invalid') THEN RAISE EXCEPTION 'Email/name edit changed ID'; END IF;
  UPDATE auth.users SET raw_app_meta_data = '{"role":"client","student_id":"s230118648","username":"changed-name"}' WHERE id = first_id;
  IF (SELECT student_id FROM public.users WHERE id = first_id) <> saved_id THEN RAISE EXCEPTION 'Metadata overwrote ID'; END IF;

  BEGIN
    UPDATE public.users SET student_id = saved_id WHERE id = second_id;
    RAISE EXCEPTION 'Duplicate/overwritten student ID accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE public.users SET student_id = NULL WHERE id = first_id;
    RAISE EXCEPTION 'Student ID removal accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  INSERT INTO auth.users (id, email, raw_app_meta_data)
    VALUES (admin_id, 'osas-id-admin@example.invalid', '{"role":"admin"}');
  IF (SELECT student_id FROM public.users WHERE id = admin_id) IS NOT NULL THEN RAISE EXCEPTION 'Administrator received student ID'; END IF;

  -- Mirrors GoTrue creating the Auth row before applying admin app_metadata.
  INSERT INTO auth.users (id, email, raw_app_meta_data)
    VALUES (delayed_id, 'osas-id-delayed@example.invalid', '{}');
  IF (SELECT student_id FROM public.users WHERE id = delayed_id) IS NOT NULL THEN RAISE EXCEPTION 'ID issued before student role was assigned'; END IF;
  UPDATE auth.users SET raw_app_meta_data = '{"role":"client"}' WHERE id = delayed_id;
  IF (SELECT student_id FROM public.users WHERE id = delayed_id) IS NULL THEN RAISE EXCEPTION 'Final student role did not generate ID'; END IF;
END;
$$;
ROLLBACK;
