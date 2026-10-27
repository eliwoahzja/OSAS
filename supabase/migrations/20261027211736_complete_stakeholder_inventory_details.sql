-- Preserve existing inventory while recording the pack descriptions in the reference.
ALTER TABLE public.supplies ADD COLUMN IF NOT EXISTS description text;
COMMENT ON COLUMN public.supplies.description IS 'Optional item description or pack size, e.g. Box of 100 pcs.';

-- Audit snapshots contain operational and personal data. Only administrators read them.
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS read_all ON public.audit_log;
DROP POLICY IF EXISTS read_admin ON public.audit_log;
CREATE POLICY read_admin ON public.audit_log
  FOR SELECT TO authenticated USING ((SELECT public.is_admin()));
GRANT SELECT ON public.audit_log TO authenticated;
REVOKE ALL ON public.audit_log FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.audit_log FROM authenticated;

-- Existing triggers write the history. Clients must not call the definer directly.
ALTER FUNCTION public.audit_log_trigger() SET search_path = pg_catalog, public;
REVOKE EXECUTE ON FUNCTION public.audit_log_trigger() FROM PUBLIC, anon, authenticated;
