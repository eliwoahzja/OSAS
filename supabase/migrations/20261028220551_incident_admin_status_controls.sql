-- Students report incidents and read their status; administrators review status changes.
DROP POLICY IF EXISTS update_staff ON public.incidents;
DROP POLICY IF EXISTS update_admin ON public.incidents;
CREATE POLICY update_admin ON public.incidents FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));
DROP POLICY IF EXISTS read_all ON public.incidents;
DROP POLICY IF EXISTS read_authenticated ON public.incidents;
CREATE POLICY read_authenticated ON public.incidents FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS write_staff ON public.incidents;
CREATE POLICY write_staff ON public.incidents FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin()) OR (status='open' AND submitted_by=(SELECT auth.uid())));
