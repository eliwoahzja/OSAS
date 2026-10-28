ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS read_all ON public.notifications;
DROP POLICY IF EXISTS read_admin ON public.notifications;
REVOKE ALL ON public.notifications FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.notifications FROM authenticated;
GRANT SELECT ON public.notifications TO authenticated;
CREATE POLICY read_admin ON public.notifications FOR SELECT TO authenticated USING ((SELECT public.is_admin()));
