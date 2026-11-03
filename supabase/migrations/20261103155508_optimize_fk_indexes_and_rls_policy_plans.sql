-- OSAS capstone performance hardening.
-- Add indexes for seven foreign keys; no rows or constraints are changed.
CREATE INDEX IF NOT EXISTS audit_log_changed_by_idx ON public.audit_log (changed_by);
CREATE INDEX IF NOT EXISTS emergency_contacts_student_id_idx ON public.emergency_contacts (student_id);
CREATE INDEX IF NOT EXISTS emergency_roles_backup_user_id_idx ON public.emergency_roles (backup_user_id);
CREATE INDEX IF NOT EXISTS emergency_roles_staff_user_id_idx ON public.emergency_roles (staff_user_id);
CREATE INDEX IF NOT EXISTS incidents_student_id_idx ON public.incidents (student_id);
CREATE INDEX IF NOT EXISTS notifications_related_incident_id_idx ON public.notifications (related_incident_id);
CREATE INDEX IF NOT EXISTS notifications_student_id_idx ON public.notifications (student_id);

-- Evaluate the session role once per statement rather than once per row.
-- Preserve the legacy role predicate exactly for the five read_all policies.
ALTER POLICY read_all ON public.drills
  USING ((SELECT auth.role()) = ANY (ARRAY['anon'::text, 'authenticated'::text]));
ALTER POLICY read_all ON public.students
  USING ((SELECT auth.role()) = ANY (ARRAY['anon'::text, 'authenticated'::text]));
ALTER POLICY read_all ON public.evacuation_plans
  USING ((SELECT auth.role()) = ANY (ARRAY['anon'::text, 'authenticated'::text]));
ALTER POLICY read_all ON public.reports
  USING ((SELECT auth.role()) = ANY (ARRAY['anon'::text, 'authenticated'::text]));
ALTER POLICY read_all ON public.risks
  USING ((SELECT auth.role()) = ANY (ARRAY['anon'::text, 'authenticated'::text]));

-- Consolidate three redundant permissive account-read policies into one.
-- Effective read access stays own account OR administrator; the restrictive
-- workspace_account_read_scope policy remains as independent protection.
ALTER POLICY read_own ON public.users
  USING (id = (SELECT auth.uid()) OR (SELECT public.is_admin()));
DROP POLICY IF EXISTS read_anon ON public.users;
DROP POLICY IF EXISTS read_all ON public.users;
