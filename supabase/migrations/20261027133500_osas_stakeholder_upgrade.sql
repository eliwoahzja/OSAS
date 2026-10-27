-- OSAS stakeholder upgrade. Additive changes only. Do not execute schema.sql on a live project.
-- Review and apply on the OSAS Supabase project after a backup, never an unrelated project.
BEGIN;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
$$;

ALTER TABLE public.emergency_contacts
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

ALTER TABLE public.inspections
  ADD COLUMN IF NOT EXISTS risk_level varchar(20),
  ADD COLUMN IF NOT EXISTS corrective_actions text;

ALTER TABLE public.supplies
  ADD COLUMN IF NOT EXISTS category varchar(80);

ALTER TABLE public.emergency_roles
  ADD COLUMN IF NOT EXISTS evacuation_plan_id uuid REFERENCES public.evacuation_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS building varchar(255),
  ADD COLUMN IF NOT EXISTS floor varchar(100),
  ADD COLUMN IF NOT EXISTS staff_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS backup_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Permit legacy role rows with no map association, but prohibit duplicate
-- coverage for newly linked plan/zone/responsibility assignments.
CREATE UNIQUE INDEX IF NOT EXISTS emergency_roles_plan_zone_role_unique
  ON public.emergency_roles (evacuation_plan_id, lower(zone), lower(role))
  WHERE evacuation_plan_id IS NOT NULL;

-- Preserve historical reporter text. A separate authenticated submitter ID
-- is populated server-side. No backfill or rewrite of existing incidents.
ALTER TABLE public.incidents
  ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.osas_attribute_incident_submitter()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.submitted_by := auth.uid();
  ELSE
    NEW.submitted_by := OLD.submitted_by;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS osas_incident_submitter ON public.incidents;
CREATE TRIGGER osas_incident_submitter
  BEFORE INSERT OR UPDATE ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.osas_attribute_incident_submitter();

-- Student/client accounts may read the permitted contact directory,
-- but all changes must be authorized by the database itself.
ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "write_anon" ON public.emergency_contacts;
DROP POLICY IF EXISTS "update_anon" ON public.emergency_contacts;
DROP POLICY IF EXISTS "delete_anon" ON public.emergency_contacts;
DROP POLICY IF EXISTS "write_staff" ON public.emergency_contacts;
DROP POLICY IF EXISTS "update_staff" ON public.emergency_contacts;
DROP POLICY IF EXISTS "write_admin" ON public.emergency_contacts;
DROP POLICY IF EXISTS "update_admin" ON public.emergency_contacts;
DROP POLICY IF EXISTS "delete_admin" ON public.emergency_contacts;
CREATE POLICY "write_admin" ON public.emergency_contacts
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "update_admin" ON public.emergency_contacts
  FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "delete_admin" ON public.emergency_contacts
  FOR DELETE TO authenticated USING (public.is_admin());

ALTER TABLE public.emergency_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "write_admin" ON public.emergency_roles;
DROP POLICY IF EXISTS "update_admin" ON public.emergency_roles;
DROP POLICY IF EXISTS "delete_admin" ON public.emergency_roles;
CREATE POLICY "write_admin" ON public.emergency_roles
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "update_admin" ON public.emergency_roles
  FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "delete_admin" ON public.emergency_roles
  FOR DELETE TO authenticated USING (public.is_admin());

-- Inspection and stock management must remain admin-only at the API layer,
-- not simply behind hidden navigation controls.
DO $
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['inspections', 'supplies']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "read_all" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "write_staff" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "update_staff" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "write_anon" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "update_anon" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "delete_anon" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "read_admin" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "write_admin" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "update_admin" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "delete_admin" ON public.%I', t);
    EXECUTE format('CREATE POLICY "read_admin" ON public.%I FOR SELECT TO authenticated USING (public.is_admin())', t);
    EXECUTE format('CREATE POLICY "write_admin" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_admin())', t);
    EXECUTE format('CREATE POLICY "update_admin" ON public.%I FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())', t);
    EXECUTE format('CREATE POLICY "delete_admin" ON public.%I FOR DELETE TO authenticated USING (public.is_admin())', t);
  END LOOP;
END $;

COMMIT;
