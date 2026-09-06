-- Fix RLS: allow anon role to read all tables (dashboard needs public read access)
DO $$
DECLARE t text;
BEGIN
    FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'users'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "read_all" ON %I;', t);
        EXECUTE format('CREATE POLICY "read_all" ON %I FOR SELECT USING (auth.role() IN (''anon'', ''authenticated''));', t);
    END LOOP;
END $$;

-- Users table: keep own-profile read, add anon read
DROP POLICY IF EXISTS "read_own" ON users;
CREATE POLICY "read_own" ON users FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "read_anon" ON users;
CREATE POLICY "read_anon" ON users FOR SELECT USING (true);
