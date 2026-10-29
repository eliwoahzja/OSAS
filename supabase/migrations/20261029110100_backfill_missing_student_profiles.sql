-- Some existing Auth students may have no public profile (e.g. legacy import
-- or manual deletion). Include them without changing any existing student ID.
DO $$
DECLARE account record;
BEGIN
  FOR account IN SELECT * FROM auth.users
    WHERE raw_app_meta_data->>'role' = 'client' ORDER BY created_at, id
  LOOP
    INSERT INTO public.users (id, email, full_name, role, created_at)
    VALUES (account.id, account.email,
      COALESCE(NULLIF(account.raw_user_meta_data->>'name', ''), account.email, 'Student'),
      'staff', account.created_at)
    ON CONFLICT (id) DO UPDATE SET student_id = public.users.student_id;
  END LOOP;
END;
$$;
