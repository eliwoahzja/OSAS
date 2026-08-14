-- ============================================================
-- OSAS Dashboard · Supabase / PostgreSQL schema
-- Run this in the Supabase SQL editor (or `psql`) before seed.php.
-- Role-based RLS: all authenticated users may read; writes are
-- gated by the admin/staff helper below (mirrors the PHP API).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------- drop (idempotent re-runs) ----------
DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS reports CASCADE;
DROP TABLE IF EXISTS evacuation_plans CASCADE;
DROP TABLE IF EXISTS supplies CASCADE;
DROP TABLE IF EXISTS emergency_roles CASCADE;
DROP TABLE IF EXISTS risks CASCADE;
DROP TABLE IF EXISTS inspections CASCADE;
DROP TABLE IF EXISTS incidents CASCADE;
DROP TABLE IF EXISTS drills CASCADE;
DROP TABLE IF EXISTS emergency_contacts CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ---------- role helper used by RLS policies ----------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'admin';
$$;

-- ---------- 1. users (profiles mirroring auth.users) ----------
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'staff')),
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- 2. students (Grades 7–12) ----------
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    grade INT CHECK (grade BETWEEN 7 AND 12),
    section VARCHAR(50),
    phone VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- 3. emergency_contacts ----------
CREATE TABLE emergency_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category VARCHAR(20) NOT NULL CHECK (category IN ('student', 'school')),
    name VARCHAR(255) NOT NULL,
    relationship VARCHAR(100),
    role VARCHAR(100),
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    priority INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- 4. drills ----------
CREATE TABLE drills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(20) NOT NULL CHECK (type IN ('Fire', 'Earthquake', 'Lockdown', 'Evacuation')),
    date DATE NOT NULL,
    time VARCHAR(20),
    building VARCHAR(255) NOT NULL,
    person_in_charge VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('upcoming', 'completed', 'cancelled')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- 5. incidents ----------
CREATE TABLE incidents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    time VARCHAR(20),
    type VARCHAR(30) NOT NULL CHECK (type IN ('medical', 'slips/falls', 'fire-related', 'security', 'equipment failure')),
    location VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    reporter VARCHAR(255),
    severity VARCHAR(10) NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
    status VARCHAR(10) NOT NULL CHECK (status IN ('open', 'resolved')),
    student_id UUID REFERENCES students(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- 6. inspections ----------
CREATE TABLE inspections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item VARCHAR(255) NOT NULL,
    area VARCHAR(255) NOT NULL,
    frequency VARCHAR(50) NOT NULL,
    last_inspected DATE,
    status VARCHAR(10) NOT NULL CHECK (status IN ('passed', 'pending', 'overdue', 'fail')),
    inspector VARCHAR(255),
    notes TEXT,
    photo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- 7. risks ----------
CREATE TABLE risks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hazard TEXT NOT NULL,
    likelihood VARCHAR(10) NOT NULL CHECK (likelihood IN ('Low', 'Medium', 'High')),
    impact VARCHAR(10) NOT NULL CHECK (impact IN ('Low', 'Medium', 'High')),
    risk_level VARCHAR(15) NOT NULL CHECK (risk_level IN ('Low', 'Medium', 'High', 'Critical')),
    mitigation TEXT,
    owner VARCHAR(255),
    review_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- 8. emergency_roles ----------
CREATE TABLE emergency_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role VARCHAR(100) NOT NULL,
    staff VARCHAR(255) NOT NULL,
    zone VARCHAR(255) NOT NULL,
    backup VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- 9. supplies ----------
CREATE TABLE supplies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item VARCHAR(255) NOT NULL,
    quantity INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    unit VARCHAR(20),
    location VARCHAR(255) NOT NULL,
    expiry DATE,
    reorder_threshold INT NOT NULL DEFAULT 0,
    last_restocked DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- 10. evacuation_plans (with version history) ----------
CREATE TABLE evacuation_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    building VARCHAR(255) NOT NULL,
    floor VARCHAR(100) NOT NULL,
    exits TEXT,
    routes TEXT,
    assembly_point VARCHAR(255),
    version VARCHAR(20) NOT NULL,
    updated DATE DEFAULT CURRENT_DATE,
    file_url TEXT,
    current BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- 11. reports ----------
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    scope VARCHAR(100),
    format VARCHAR(10),
    generated DATE DEFAULT CURRENT_DATE,
    url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- 12. notifications (business-rule CHECK constraints) ----------
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    notif_type VARCHAR(20) NOT NULL CHECK (notif_type IN ('incident_alert', 'event_notice')),
    priority VARCHAR(20) NOT NULL CHECK (priority IN ('urgent', 'informational')),
    student_id UUID REFERENCES students(id),
    related_incident_id UUID REFERENCES incidents(id),
    audience_group VARCHAR(100),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    event_start_at TIMESTAMPTZ,
    event_end_at TIMESTAMPTZ,
    contact_method VARCHAR(10) NOT NULL CHECK (contact_method IN ('app', 'sms', 'call', 'email')),
    sent_at TIMESTAMPTZ,
    delivery_status VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'failed', 'delivered', 'read')),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- incident_alert ⇒ student required, urgent, call/sms
    CONSTRAINT chk_incident_alert CHECK (
        notif_type <> 'incident_alert'
        OR (student_id IS NOT NULL AND priority = 'urgent' AND contact_method IN ('call', 'sms'))
    ),
    -- event_notice ⇒ audience + event window required, informational, app/email
    CONSTRAINT chk_event_notice CHECK (
        notif_type <> 'event_notice'
        OR (audience_group IS NOT NULL AND event_start_at IS NOT NULL AND event_end_at IS NOT NULL
            AND priority = 'informational' AND contact_method IN ('app', 'email'))
    ),
    CONSTRAINT chk_event_window CHECK (event_end_at IS NULL OR event_start_at IS NULL OR event_end_at > event_start_at)
);

-- ---------- 13. audit_log ----------
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(100) NOT NULL,
    record_id TEXT NOT NULL,
    action VARCHAR(10) NOT NULL CHECK (action IN ('insert', 'update', 'delete')),
    old_value JSONB,
    new_value JSONB,
    changed_by UUID REFERENCES auth.users(id),
    changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- Realtime (dashboard KPIs + donuts update live) ----------
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;
ALTER PUBLICATION supabase_realtime ADD TABLE incidents, inspections, supplies, notifications;

-- ---------- Row Level Security ----------
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE drills ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE risks ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplies ENABLE ROW LEVEL SECURITY;
ALTER TABLE evacuation_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read every table.
DO $$
DECLARE t text;
BEGIN
    FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'users'
    LOOP
        EXECUTE format('CREATE POLICY "read_all" ON %I FOR SELECT USING (auth.role() = ''authenticated'');', t);
    END LOOP;
END $$;

-- Everyone authenticated can read their own profile row.
CREATE POLICY "read_own" ON users FOR SELECT USING (auth.uid() = id);

-- Writes: staff may write to the operational tables; everything
-- else (risks, emergency_roles, reports, users) is admin-only.
DO $$
DECLARE t text;
BEGIN
    FOR t IN SELECT unnest(ARRAY['incidents','inspections','drills','emergency_contacts','notifications'])
    LOOP
        EXECUTE format('CREATE POLICY "write_staff" ON %I FOR INSERT WITH CHECK (auth.role() = ''authenticated'');', t);
        EXECUTE format('CREATE POLICY "update_staff" ON %I FOR UPDATE USING (auth.role() = ''authenticated'');', t);
    END LOOP;
END $$;

-- Admin-only writes (risk assessment, roles, reports, users, supplies, plans, audit).
DO $$
DECLARE t text;
BEGIN
    FOR t IN SELECT unnest(ARRAY['risks','emergency_roles','reports','supplies','evacuation_plans','audit_log','users'])
    LOOP
        EXECUTE format('CREATE POLICY "write_admin" ON %I FOR INSERT WITH CHECK (public.is_admin());', t);
        EXECUTE format('CREATE POLICY "update_admin" ON %I FOR UPDATE USING (public.is_admin());', t);
        EXECUTE format('CREATE POLICY "delete_admin" ON %I FOR DELETE USING (public.is_admin());', t);
    END LOOP;
END $$;

-- Deletes on the staff-writable tables are admin-only too.
DO $$
DECLARE t text;
BEGIN
    FOR t IN SELECT unnest(ARRAY['incidents','inspections','drills','emergency_contacts','notifications'])
    LOOP
        EXECUTE format('CREATE POLICY "delete_admin" ON %I FOR DELETE USING (public.is_admin());', t);
    END LOOP;
END $$;

-- ---------- Storage buckets ----------
INSERT INTO storage.buckets (id, name, public)
VALUES ('evacuation-maps', 'evacuation-maps', TRUE),
       ('inspection-photos', 'inspection-photos', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users may upload to both buckets.
CREATE POLICY "upload_evacuation_maps"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'evacuation-maps');

CREATE POLICY "upload_inspection_photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'inspection-photos');

CREATE POLICY "read_objects"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id IN ('evacuation-maps', 'inspection-photos'));
