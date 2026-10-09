
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
$$;

DO $$
DECLARE t text;
BEGIN
    FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "write_anon"  ON %I;', t);
        EXECUTE format('DROP POLICY IF EXISTS "update_anon" ON %I;', t);
        EXECUTE format('DROP POLICY IF EXISTS "delete_anon" ON %I;', t);
    END LOOP;
END $$;

DO $$
DECLARE t text;
BEGIN
    FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'users'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "read_all" ON %I;', t);
        EXECUTE format('CREATE POLICY "read_all" ON %I FOR SELECT USING (auth.role() = ''authenticated'');', t);
    END LOOP;
END $$;
DROP POLICY IF EXISTS "read_all"   ON users;
DROP POLICY IF EXISTS "read_own"   ON users;
DROP POLICY IF EXISTS "read_admin" ON users;
CREATE POLICY "read_own"   ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "read_admin" ON users FOR SELECT USING (public.is_admin());

DO $$
DECLARE t text;
BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "write_staff"  ON incidents;';
    EXECUTE 'DROP POLICY IF EXISTS "update_staff" ON incidents;';
    EXECUTE 'CREATE POLICY "write_staff"  ON incidents FOR INSERT WITH CHECK (auth.role() = ''authenticated'');';
    EXECUTE 'CREATE POLICY "update_staff" ON incidents FOR UPDATE USING (auth.role() = ''authenticated'');';
END $$;

DO $$
DECLARE t text;
BEGIN
    FOR t IN SELECT unnest(ARRAY['drills','inspections','emergency_contacts'])
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "write_staff"  ON %I;', t);
        EXECUTE format('DROP POLICY IF EXISTS "update_staff" ON %I;', t);
        EXECUTE format('CREATE POLICY "write_admin"  ON %I FOR INSERT WITH CHECK (public.is_admin());', t);
        EXECUTE format('CREATE POLICY "update_admin" ON %I FOR UPDATE USING (public.is_admin());', t);
    END LOOP;
END $$;

DO $$
DECLARE t text;
BEGIN
    FOR t IN SELECT unnest(ARRAY['risks','emergency_roles','reports','supplies','evacuation_plans','audit_log','users'])
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "write_admin"  ON %I;', t);
        EXECUTE format('DROP POLICY IF EXISTS "update_admin" ON %I;', t);
        EXECUTE format('DROP POLICY IF EXISTS "delete_admin" ON %I;', t);
        EXECUTE format('CREATE POLICY "write_admin"  ON %I FOR INSERT WITH CHECK (public.is_admin());', t);
        EXECUTE format('CREATE POLICY "update_admin" ON %I FOR UPDATE USING (public.is_admin());', t);
        EXECUTE format('CREATE POLICY "delete_admin" ON %I FOR DELETE USING (public.is_admin());', t);
    END LOOP;
END $$;

DO $$
DECLARE t text;
BEGIN
    FOR t IN SELECT unnest(ARRAY['incidents','inspections','drills','emergency_contacts','notifications'])
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "delete_admin" ON %I;', t);
        EXECUTE format('CREATE POLICY "delete_admin" ON %I FOR DELETE USING (public.is_admin());', t);
    END LOOP;
END $$;
DROP POLICY IF EXISTS "write_staff"  ON notifications;
DROP POLICY IF EXISTS "update_staff" ON notifications;

