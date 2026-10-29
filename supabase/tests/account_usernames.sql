-- Transactional checks: no accounts, credentials, or profiles are retained.
BEGIN;
DO $$
DECLARE
  first_id uuid := '92000000-0000-4000-8000-000000000001';
  second_id uuid := '92000000-0000-4000-8000-000000000002';
  saved_username text;
BEGIN
  INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
  VALUES (first_id, 'osas-username-test@example.invalid', '{"role":"client","username":"OSAS-Username-Test"}', '{"name":"Username Test"}');
  SELECT username INTO saved_username FROM public.users WHERE id = first_id;
  IF saved_username <> 'osas-username-test' THEN RAISE EXCEPTION 'Username was not saved or normalized'; END IF;

  UPDATE auth.users SET email = 'osas-new-email@example.invalid' WHERE id = first_id;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = first_id AND username = saved_username AND email = 'osas-new-email@example.invalid') THEN
    RAISE EXCEPTION 'Email change broke username mapping';
  END IF;
  UPDATE auth.users SET raw_user_meta_data = '{"name":"Username Test","username":"forged-name"}' WHERE id = first_id;
  IF (SELECT username FROM public.users WHERE id = first_id) <> saved_username THEN
    RAISE EXCEPTION 'User-editable metadata changed the username';
  END IF;

  BEGIN
    INSERT INTO auth.users (id, email, raw_app_meta_data)
    VALUES (second_id, 'osas-another-email@example.invalid', '{"role":"client","username":"osas-username-test"}');
    RAISE EXCEPTION 'Duplicate username was accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = second_id) THEN RAISE EXCEPTION 'Failed creation left an orphan account'; END IF;

  INSERT INTO auth.users (id, email, raw_app_meta_data)
  VALUES (second_id, 'osas-another-email@example.invalid', '{"role":"client","username":"osas-another-name"}');
  BEGIN
    UPDATE auth.users SET raw_app_meta_data = '{"role":"client","username":"OSAS-Username-Test"}' WHERE id = second_id;
    RAISE EXCEPTION 'Duplicate rename was accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
    UPDATE auth.users SET raw_app_meta_data = '{"role":"client","username":"bad name"}' WHERE id = second_id;
    RAISE EXCEPTION 'Invalid username was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  UPDATE auth.users SET raw_app_meta_data = '{"role":"client","username":"osas-renamed-test"}' WHERE id = first_id;
  IF (SELECT username FROM public.users WHERE id = first_id) <> 'osas-renamed-test' THEN RAISE EXCEPTION 'Trusted rename failed'; END IF;
END;
$$;
ROLLBACK;
