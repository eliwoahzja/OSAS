-- Record when the server receives a report. Client clocks and editable payloads
-- cannot change its submission time; existing incident history is not rewritten.
CREATE OR REPLACE FUNCTION public.osas_attribute_incident_submitter()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  reported_at timestamptz;
BEGIN
  IF TG_OP = 'INSERT' THEN
    reported_at := statement_timestamp();
    NEW.created_at := reported_at;
    NEW.date := (reported_at AT TIME ZONE 'Asia/Manila')::date;
    NEW.time := to_char(reported_at AT TIME ZONE 'Asia/Manila', 'HH12:MI AM');
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
    NEW.created_at := OLD.created_at;
    NEW.date := OLD.date;
    NEW.time := OLD.time;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.osas_attribute_incident_submitter() FROM PUBLIC, anon, authenticated;
