
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
                        || jsonb_build_object('role', raw_user_meta_data ->> 'role')
WHERE raw_user_meta_data ? 'role'
  AND (raw_app_meta_data ->> 'role') IS NULL;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
$$;

DO $$
DECLARE t text;
BEGIN
    FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'users'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "read_all" ON %I;', t);
        EXECUTE format('CREATE POLICY "read_all" ON %I FOR SELECT USING (auth.role() = ''authenticated'');', t);
    END LOOP;
END $$;

DROP POLICY IF EXISTS "read_anon" ON users;
DROP POLICY IF EXISTS "read_own" ON users;
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
        EXECUTE format('DROP POLICY IF EXISTS "update_anon"  ON %I;', t);
        EXECUTE format('DROP POLICY IF EXISTS "write_anon"   ON %I;', t);
        EXECUTE format('CREATE POLICY "write_admin"  ON %I FOR INSERT WITH CHECK (public.is_admin());', t);
        EXECUTE format('CREATE POLICY "update_admin" ON %I FOR UPDATE USING (public.is_admin());', t);
    END LOOP;
END $$;

DROP POLICY IF EXISTS "write_staff"  ON notifications;
DROP POLICY IF EXISTS "update_staff" ON notifications;

ALTER TABLE risks ADD COLUMN IF NOT EXISTS threat SMALLINT CHECK (threat BETWEEN 1 AND 5);
ALTER TABLE risks ADD COLUMN IF NOT EXISTS vulnerability SMALLINT CHECK (vulnerability BETWEEN 1 AND 5);
ALTER TABLE risks ADD COLUMN IF NOT EXISTS exploit_likelihood SMALLINT CHECK (exploit_likelihood BETWEEN 1 AND 5);
ALTER TABLE risks ADD COLUMN IF NOT EXISTS exploit_impact SMALLINT CHECK (exploit_impact BETWEEN 1 AND 5);
ALTER TABLE risks ADD COLUMN IF NOT EXISTS asset_value SMALLINT CHECK (asset_value BETWEEN 1 AND 5);
ALTER TABLE risks ADD COLUMN IF NOT EXISTS security_controls SMALLINT CHECK (security_controls BETWEEN 1 AND 5);
ALTER TABLE risks ADD COLUMN IF NOT EXISTS risk_score INT;
ALTER TABLE risks ADD COLUMN IF NOT EXISTS custom_reason TEXT;
ALTER TABLE risks DROP CONSTRAINT IF EXISTS risks_risk_level_check;
ALTER TABLE risks ADD CONSTRAINT risks_risk_level_check
  CHECK (risk_level IN ('Low', 'Medium', 'Moderate', 'High', 'Critical'));

ALTER TABLE emergency_contacts ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES students(id);

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_notif_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_notif_type_check
  CHECK (notif_type IN ('incident_alert', 'event_notice', 'alert'));
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS chk_alert;
ALTER TABLE notifications ADD CONSTRAINT chk_alert
  CHECK (notif_type <> 'alert' OR (priority = 'urgent' AND contact_method = 'email'));

UPDATE notifications
SET notif_type = 'alert', student_id = NULL
WHERE student_id = '11111111-1111-4111-8111-111111111111'
  AND notif_type = 'incident_alert'
  AND (title ~* 'restock|supplies|stock|inventory|shortage'
       OR audience_group ~* 'clinic|custodian');
