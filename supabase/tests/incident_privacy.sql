BEGIN;
DO $$ DECLARE ids uuid[]; admin_id uuid; BEGIN
 SELECT array_agg(id) INTO ids FROM (SELECT id FROM auth.users WHERE raw_app_meta_data->>'role'='client' ORDER BY id LIMIT 2) s;
 SELECT id INTO admin_id FROM auth.users WHERE raw_app_meta_data->>'role'='admin' ORDER BY id LIMIT 1;
 IF cardinality(ids) < 2 OR admin_id IS NULL THEN RAISE EXCEPTION 'Need two students and one admin for privacy test'; END IF;
 PERFORM set_config('qa.student_a',ids[1]::text,true); PERFORM set_config('qa.student_b',ids[2]::text,true); PERFORM set_config('qa.admin_id',admin_id::text,true);
 PERFORM set_config('request.jwt.claims', json_build_object('sub',ids[1], 'email','qa-a@example.invalid','app_metadata',json_build_object('role','client'),'user_metadata',json_build_object('name','QA Student A','role','admin'))::text,true);
END $$;
SET LOCAL ROLE authenticated;
-- Older or forged clients cannot override submitter, reporter, status or classifications.
INSERT INTO public.incidents(date, description, reporter, status, type, severity, location, submitted_by)
VALUES (current_date,'__qa_incident_privacy_a__','Forged reporter','resolved','medical','high','Forged room',current_setting('qa.student_b')::uuid);
DO $$ BEGIN
 IF (SELECT count(*) FROM public.incidents WHERE description='__qa_incident_privacy_a__' AND submitted_by=auth.uid() AND reporter='QA Student A' AND status='open' AND type IS NULL AND severity IS NULL AND location IS NULL) <> 1 THEN RAISE EXCEPTION 'Attribution or minimal report normalization failed'; END IF;
 IF EXISTS(SELECT 1 FROM public.incidents WHERE submitted_by IS DISTINCT FROM auth.uid()) THEN RAISE EXCEPTION 'Student A can see another account report'; END IF;
 IF EXISTS(SELECT 1 FROM public.emergency_roles) THEN RAISE EXCEPTION 'Student can read emergency roles'; END IF;
 PERFORM set_config('request.jwt.claims',json_build_object('sub',current_setting('qa.student_b'),'email','qa-b@example.invalid','app_metadata',json_build_object('role','client'),'user_metadata',json_build_object('name','QA Student B'))::text,true);
 IF EXISTS(SELECT 1 FROM public.incidents WHERE description='__qa_incident_privacy_a__') THEN RAISE EXCEPTION 'Student B can read A report'; END IF;
END $$;
INSERT INTO public.incidents(date, description, status) VALUES (current_date,'__qa_incident_privacy_b__','open');
DO $$ DECLARE touched integer; BEGIN
 IF (SELECT count(*) FROM public.incidents WHERE description LIKE '__qa_incident_privacy_%') <> 1 THEN RAISE EXCEPTION 'Student B report ownership failed'; END IF;
 UPDATE public.incidents SET status='resolved' WHERE description='__qa_incident_privacy_b__'; GET DIAGNOSTICS touched = ROW_COUNT;
 IF touched <> 0 THEN RAISE EXCEPTION 'Student can change report status'; END IF;
 PERFORM set_config('request.jwt.claims',json_build_object('sub',current_setting('qa.admin_id'),'app_metadata',json_build_object('role','admin'))::text,true);
 IF (SELECT count(*) FROM public.incidents WHERE description LIKE '__qa_incident_privacy_%') <> 2 THEN RAISE EXCEPTION 'Admin cannot see both student reports'; END IF;
 UPDATE public.incidents SET status='resolved',type='security',severity='low',location='QA room' WHERE description='__qa_incident_privacy_a__'; GET DIAGNOSTICS touched = ROW_COUNT;
 IF touched <> 1 THEN RAISE EXCEPTION 'Admin classification/status update failed'; END IF;
 PERFORM set_config('request.jwt.claims',json_build_object('sub',current_setting('qa.student_a'),'app_metadata',json_build_object('role','client'))::text,true);
 IF (SELECT count(*) FROM public.incidents WHERE description='__qa_incident_privacy_a__' AND status='resolved' AND type='security' AND severity='low' AND location='QA room') <> 1 THEN RAISE EXCEPTION 'Student cannot see admin update'; END IF;
END $$;
RESET ROLE;
SELECT 'PASS: two student isolation, forged ownership/display/role protection, admin review, student status visibility, emergency role access' AS privacy_checks;
ROLLBACK;
