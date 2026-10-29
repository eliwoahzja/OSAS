-- Reports belong to the submitting account. Legacy reports without attribution
-- remain visible to admins; names are never used to guess ownership.
CREATE INDEX IF NOT EXISTS incidents_submitted_by_created_idx ON public.incidents (submitted_by, created_at DESC);
DROP POLICY IF EXISTS read_authenticated ON public.incidents;
DROP POLICY IF EXISTS read_all ON public.incidents;
CREATE POLICY read_own_or_admin ON public.incidents FOR SELECT TO authenticated
USING ((SELECT public.is_admin()) OR submitted_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS read_authenticated ON public.emergency_roles;
CREATE POLICY read_admin ON public.emergency_roles FOR SELECT TO authenticated
USING ((SELECT public.is_admin()));

-- Students describe the incident; classification is recorded during admin review.
-- NULL means not yet recorded, rather than inventing a medical/medium/location value.
ALTER TABLE public.incidents ALTER COLUMN type DROP NOT NULL;
ALTER TABLE public.incidents ALTER COLUMN severity DROP NOT NULL;
ALTER TABLE public.incidents ALTER COLUMN location DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.osas_attribute_incident_submitter()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.submitted_by := auth.uid();
    IF NOT public.is_admin() AND auth.uid() IS NOT NULL THEN
      NEW.reporter := left(COALESCE(NULLIF(btrim(auth.jwt()->'user_metadata'->>'name'), ''), auth.jwt()->>'email', 'Student'), 255);
      NEW.status := 'open';
      NEW.type := NULL;
      NEW.severity := NULL;
      NEW.location := NULL;
      NEW.student_id := NULL;
      IF NULLIF(btrim(NEW.description), '') IS NULL OR length(NEW.description) > 10000 THEN
        RAISE EXCEPTION 'Enter an incident description of up to 10000 characters.' USING ERRCODE = '23514';
      END IF;
    END IF;
  ELSE
    NEW.submitted_by := OLD.submitted_by;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.osas_attribute_incident_submitter() FROM PUBLIC, anon, authenticated;
