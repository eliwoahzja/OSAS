-- Run after all_account_student_ids in a disposable database as postgres.
-- Account/profile fixtures roll back. Sequence gaps are expected and never reused.
BEGIN;
DO $$
DECLARE
  account_id uuid := '94000000-0000-4000-8000-000000000001';
  other_id uuid := '94000000-0000-4000-8000-000000000002';
  saved_id text;
  other_student_id text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM auth.users a LEFT JOIN public.users p ON p.id = a.id
    WHERE p.id IS NULL OR p.student_id IS NULL OR p.student_id !~ '^s[0-9]{9}$'
  ) THEN RAISE EXCEPTION 'Existing account is missing its generated login ID'; END IF;

  INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
  VALUES (account_id, 'osas-all-id-admin@example.invalid', '{"role":"admin"}', '{"name":"Admin ID Test","student_id":"s260000000"}');
  SELECT student_id INTO saved_id FROM public.users WHERE id = account_id;
  IF saved_id IS NULL OR saved_id !~ '^s[0-9]{9}$' OR saved_id = 's260000000' THEN
    RAISE EXCEPTION 'New administrator did not receive a server-generated ID';
  END IF;

  INSERT INTO auth.users (id, email, raw_app_meta_data)
  VALUES (other_id, 'osas-all-id-student@example.invalid', '{}');
  SELECT student_id INTO other_student_id FROM public.users WHERE id = other_id;
  IF other_student_id IS NULL OR other_student_id = saved_id THEN
    RAISE EXCEPTION 'New account received no unique ID before role metadata';
  END IF;
  UPDATE auth.users SET raw_app_meta_data = '{"role":"client"}' WHERE id = other_id;
  IF (SELECT student_id FROM public.users WHERE id = other_id) <> other_student_id THEN
    RAISE EXCEPTION 'Assigning a student role changed its ID';
  END IF;

  UPDATE auth.users SET raw_app_meta_data = '{"role":"client"}', email = 'osas-all-id-renamed@example.invalid', raw_user_meta_data = '{"name":"Renamed","student_id":"s260000000"}'
    WHERE id = account_id;
  IF (SELECT student_id FROM public.users WHERE id = account_id) <> saved_id THEN
    RAISE EXCEPTION 'Account email, name or role change altered its ID';
  END IF;

  BEGIN
    UPDATE public.users SET student_id = other_student_id WHERE id = account_id;
    RAISE EXCEPTION 'A generated ID could be overwritten';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE public.users SET student_id = NULL WHERE id = account_id;
    RAISE EXCEPTION 'A generated ID could be removed';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END;
$$;
ROLLBACK;
