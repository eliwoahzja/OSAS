-- Add restrictive guards to the legacy permissive read policies. Existing write
-- rules and service-role access are unchanged; no school records are rewritten.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspace_account_read_scope ON public.users AS RESTRICTIVE
  FOR SELECT TO PUBLIC
  USING (id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

DO $$
DECLARE school_table text;
BEGIN
  FOREACH school_table IN ARRAY ARRAY['students', 'drills', 'risks', 'reports'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', school_table);
    EXECUTE format(
      'CREATE POLICY workspace_admin_read_scope ON public.%I AS RESTRICTIVE FOR SELECT TO PUBLIC USING ((SELECT public.is_admin()))',
      school_table
    );
  END LOOP;
END;
$$;
