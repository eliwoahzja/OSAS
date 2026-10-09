
DO $$
DECLARE t text;
BEGIN
    FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'users'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "read_all" ON %I;', t);
        EXECUTE format('CREATE POLICY "read_all" ON %I FOR SELECT USING (true);', t);
    END LOOP;
END $$;

DROP POLICY IF EXISTS "read_own" ON users;
DROP POLICY IF EXISTS "read_admin" ON users;
DROP POLICY IF EXISTS "read_all" ON users;
CREATE POLICY "read_all" ON users FOR SELECT USING (true);

DO $$
DECLARE t text;
BEGIN
    FOR t IN SELECT unnest(ARRAY['incidents','inspections','drills','emergency_contacts','evacuation_plans','supplies','risks','emergency_roles','notifications'])
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "write_staff" ON %I;', t);
        EXECUTE format('DROP POLICY IF EXISTS "update_staff" ON %I;', t);
        EXECUTE format('DROP POLICY IF EXISTS "delete_admin" ON %I;', t);
        EXECUTE format('CREATE POLICY "write_anon" ON %I FOR INSERT WITH CHECK (true);', t);
        EXECUTE format('CREATE POLICY "update_anon" ON %I FOR UPDATE USING (true);', t);
        EXECUTE format('CREATE POLICY "delete_anon" ON %I FOR DELETE USING (true);', t);
    END LOOP;
END $$;
