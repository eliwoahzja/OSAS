-- Grade assignments are private account data, separate from the student roster.
-- Only administrators assign grades; each student can read their own assignment.
CREATE TABLE public.student_grades (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  grade_level smallint CHECK (grade_level BETWEEN 7 AND 12)
);
ALTER TABLE public.student_grades ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.student_grades FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_grades TO authenticated;
GRANT ALL ON public.student_grades TO service_role;
CREATE POLICY student_grades_read ON public.student_grades FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));
CREATE POLICY student_grades_insert_admin ON public.student_grades FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY student_grades_update_admin ON public.student_grades FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY student_grades_delete_admin ON public.student_grades FOR DELETE TO authenticated
  USING ((SELECT public.is_admin()));
