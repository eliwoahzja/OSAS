-- ============================================================
-- OSAS · live_fixes.sql  (safe to run more than once; does NOT drop data)
-- Run in the Supabase SQL editor on the LIVE project.
-- Do NOT re-run schema.sql on live data: it drops every table.
-- ============================================================

-- 1. Roles: trust app_metadata (server-side only), not user_metadata --------
--    user_metadata can be edited by the signed-in user, so an "admin" role
--    stored there could be self-granted. Copy existing roles across once.
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
                        || jsonb_build_object('role', raw_user_meta_data ->> 'role')
WHERE raw_user_meta_data ? 'role'
  AND (raw_app_meta_data ->> 'role') IS NULL;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
$$;

-- To make someone an admin later (no user_metadata involved):
--   UPDATE auth.users
--   SET raw_app_meta_data = COALESCE(raw_app_meta_data,'{}'::jsonb) || '{"role":"admin"}'
--   WHERE email = 'admin@yourschool.edu.ph';

-- 2. Reads: signed-in users only (removes the public "anon" read) -----------
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

-- 3. Writes: make sure the staff/admin policies exist -----------------------
DO $$
DECLARE t text;
BEGIN
    FOR t IN SELECT unnest(ARRAY['incidents','inspections','drills','emergency_contacts'])
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "write_staff"  ON %I;', t);
        EXECUTE format('DROP POLICY IF EXISTS "update_staff" ON %I;', t);
        EXECUTE format('CREATE POLICY "write_staff"  ON %I FOR INSERT WITH CHECK (auth.role() = ''authenticated'');', t);
        EXECUTE format('CREATE POLICY "update_staff" ON %I FOR UPDATE USING (auth.role() = ''authenticated'');', t);
    END LOOP;
END $$;

-- Notifications are written only by the send-notification function (service role),
-- so a signed-in user cannot insert a fake "sent" notification directly.
DROP POLICY IF EXISTS "write_staff"  ON notifications;
DROP POLICY IF EXISTS "update_staff" ON notifications;

-- 4. Risk assessment columns (the wizard saves all of these) ----------------
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

-- 5. Guardian link + notification kinds -------------------------------------
ALTER TABLE emergency_contacts ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES students(id);

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_notif_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_notif_type_check
  CHECK (notif_type IN ('incident_alert', 'event_notice', 'alert'));
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS chk_alert;
ALTER TABLE notifications ADD CONSTRAINT chk_alert
  CHECK (notif_type <> 'alert' OR (priority = 'urgent' AND contact_method = 'email'));

-- 6. Clean up old low-stock alerts that were stored as fake "incident alerts"
--    for a placeholder student. They become proper 'alert' rows.
UPDATE notifications
SET notif_type = 'alert', student_id = NULL
WHERE student_id = '11111111-1111-4111-8111-111111111111'
  AND notif_type = 'incident_alert'
  AND (title ~* 'restock|supplies|stock|inventory|shortage'
       OR audience_group ~* 'clinic|custodian');
