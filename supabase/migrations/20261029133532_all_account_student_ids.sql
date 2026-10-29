-- Every managed account receives a stable login ID, including administrators.
-- Keep previously issued IDs, Auth UUIDs, credentials, roles, and report ownership.
CREATE OR REPLACE FUNCTION public.osas_assign_student_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  saved_id text;
  candidate text;
  number bigint;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.student_id IS DISTINCT FROM OLD.student_id THEN
      RAISE EXCEPTION 'Student IDs are generated automatically and cannot be edited.' USING ERRCODE = '23514';
    END IF;
    saved_id := OLD.student_id;
  ELSE
    SELECT student_id INTO saved_id FROM public.users WHERE id = NEW.id;
    IF NEW.student_id IS NOT NULL AND NEW.student_id IS DISTINCT FROM saved_id THEN
      RAISE EXCEPTION 'Student IDs are generated automatically and cannot be supplied.' USING ERRCODE = '23514';
    END IF;
  END IF;

  NEW.student_id := saved_id;
  IF NEW.student_id IS NULL THEN
    -- Serialize missing-ID assignment and skip any existing issued value if a
    -- restored/imported sequence happens to lag behind the saved profiles.
    PERFORM pg_catalog.pg_advisory_xact_lock(68567925002);
    LOOP
      number := nextval('public.osas_student_id_sequence');
      candidate := 's' || to_char(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila', 'YY')
        || lpad(number::text, 7, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.users WHERE student_id = candidate);
    END LOOP;
    NEW.student_id := candidate;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.osas_assign_student_id() FROM PUBLIC, anon, authenticated;

-- Auth accounts can predate profile sync, have legacy roles, or be administrators.
-- Preserve existing profile fields; only repair a missing profile or missing ID.
DO $$
DECLARE account record;
BEGIN
  FOR account IN SELECT * FROM auth.users ORDER BY created_at, id LOOP
    INSERT INTO public.users (id, email, full_name, role, created_at)
    VALUES (account.id, account.email,
      COALESCE(NULLIF(account.raw_user_meta_data->>'name', ''), account.email, 'Account'),
      CASE WHEN account.raw_app_meta_data->>'role' = 'admin' THEN 'admin' ELSE 'staff' END,
      account.created_at)
    ON CONFLICT (id) DO UPDATE SET student_id = public.users.student_id;
  END LOOP;
END;
$$;

ALTER TABLE public.users ALTER COLUMN student_id SET NOT NULL;
COMMENT ON COLUMN public.users.student_id IS
  'Auto-generated immutable login ID for every account, including administrators. Not an official enrollment number. Password and email OTP are still required.';
