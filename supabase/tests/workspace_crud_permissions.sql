-- Run with a database owner connection. All fixture writes and audit events are
-- rolled back in the inner subtransaction, even when a permission check fails.
-- No Auth accounts, Storage objects, emails or SMS messages are created.
DO $verify$
DECLARE
  admin_claims jsonb;
  student_claims jsonb;
  spec jsonb;
  payload jsonb;
  columns_sql text;
  table_name text;
  target_id uuid;
  count_rows integer;
  denied boolean;
  results jsonb := '[]'::jsonb;
  row_result jsonb;
  original_role text := current_user;
BEGIN
  SELECT jsonb_build_object('sub',id,'role','authenticated','app_metadata',raw_app_meta_data)
    INTO admin_claims FROM auth.users WHERE raw_app_meta_data->>'role'='admin' LIMIT 1;
  SELECT jsonb_build_object('sub',id,'role','authenticated','app_metadata',raw_app_meta_data,
      'user_metadata',jsonb_build_object('name','Permission verification'))
    INTO student_claims FROM auth.users WHERE raw_app_meta_data->>'role'='client' LIMIT 1;
  IF admin_claims IS NULL OR student_claims IS NULL THEN
    RAISE EXCEPTION 'Verification requires an existing administrator and student';
  END IF;
  BEGIN
    FOR spec IN SELECT value FROM jsonb_array_elements('[
      {"table":"emergency_contacts","public_to_students":true,"payload":{"category":"school","name":"Permission verification","phone":"00000000000"},"patch":{"active":false}},
      {"table":"evacuation_plans","public_to_students":true,"payload":{"building":"Permission verification","floor":"Ground","version":"v1.0","current":true},"patch":{"floor":"First"}},
      {"table":"drills","public_to_students":false,"payload":{"type":"Fire","date":"2026-11-04","building":"Permission verification","person_in_charge":"Verification","status":"upcoming"},"patch":{"status":"completed"}},
      {"table":"inspections","public_to_students":false,"payload":{"item":"Permission verification","area":"Verification room","frequency":"monthly","status":"pending"},"patch":{"status":"passed"}},
      {"table":"supplies","public_to_students":false,"payload":{"item":"Permission verification","quantity":10,"location":"Verification room","reorder_threshold":2},"patch":{"quantity":9}},
      {"table":"risks","public_to_students":false,"payload":{"hazard":"Permission verification","likelihood":"Low","impact":"Low","risk_level":"Low"},"patch":{"mitigation":"Verification control"}},
      {"table":"reports","public_to_students":false,"payload":{"name":"Permission verification"},"patch":{"name":"Permission verification updated"}},
      {"table":"announcements","public_to_students":true,"payload":{"title":"Permission verification","body":"Temporary verification fixture"},"patch":{"body":"Temporary verification updated"}},
      {"table":"incidents","public_to_students":false,"payload":{"description":"Permission verification","status":"open"},"patch":{"status":"resolved"}}
    ]'::jsonb)
    LOOP
      table_name := spec->>'table'; payload := spec->'payload';
      SELECT string_agg(format('%I',key),',' ORDER BY key) INTO columns_sql FROM jsonb_object_keys(payload) key;
      PERFORM set_config('request.jwt.claims',admin_claims::text,true);
      PERFORM set_config('role','authenticated',true);
      EXECUTE format('INSERT INTO public.%I (%s) SELECT %s FROM jsonb_populate_record(NULL::public.%I,$1) RETURNING id',table_name,columns_sql,columns_sql,table_name)
        INTO target_id USING payload;
      row_result := jsonb_build_object('table',table_name,'admin_create',target_id IS NOT NULL);
      EXECUTE format('SELECT count(*) FROM public.%I WHERE id=$1',table_name) INTO count_rows USING target_id;
      row_result := row_result || jsonb_build_object('admin_view',count_rows=1);
      SELECT string_agg(format('%1$I=p.%1$I',key),',' ORDER BY key) INTO columns_sql FROM jsonb_object_keys(spec->'patch') key;
      EXECUTE format('UPDATE public.%I t SET %s FROM jsonb_populate_record(NULL::public.%I,$1) p WHERE t.id=$2',table_name,columns_sql,table_name)
        USING spec->'patch',target_id;
      GET DIAGNOSTICS count_rows = ROW_COUNT;
      row_result := row_result || jsonb_build_object('admin_update',count_rows=1);

      PERFORM set_config('request.jwt.claims',student_claims::text,true);
      EXECUTE format('SELECT count(*) FROM public.%I WHERE id=$1',table_name) INTO count_rows USING target_id;
      row_result := row_result || jsonb_build_object('student_read_scope',count_rows=CASE WHEN (spec->>'public_to_students')::boolean THEN 1 ELSE 0 END);
      EXECUTE format('UPDATE public.%I t SET %s FROM jsonb_populate_record(NULL::public.%I,$1) p WHERE t.id=$2',table_name,columns_sql,table_name)
        USING spec->'patch',target_id;
      GET DIAGNOSTICS count_rows = ROW_COUNT;
      row_result := row_result || jsonb_build_object('student_update_blocked',count_rows=0);
      EXECUTE format('DELETE FROM public.%I WHERE id=$1',table_name) USING target_id;
      GET DIAGNOSTICS count_rows = ROW_COUNT;
      row_result := row_result || jsonb_build_object('student_delete_blocked',count_rows=0);
      denied := false;
      BEGIN
        SELECT string_agg(format('%I',key),',' ORDER BY key) INTO columns_sql FROM jsonb_object_keys(payload) key;
        EXECUTE format('INSERT INTO public.%I (%s) SELECT %s FROM jsonb_populate_record(NULL::public.%I,$1)',table_name,columns_sql,columns_sql,table_name) USING payload;
      EXCEPTION WHEN insufficient_privilege OR check_violation THEN denied := true;
      END;
      row_result := row_result || jsonb_build_object('student_foreign_create_blocked',denied);
      PERFORM set_config('request.jwt.claims','{"role":"anon"}',true);
      PERFORM set_config('role','anon',true);
      BEGIN
        EXECUTE format('DELETE FROM public.%I WHERE id=$1',table_name) USING target_id;
        GET DIAGNOSTICS count_rows = ROW_COUNT;
      EXCEPTION WHEN insufficient_privilege THEN count_rows := 0;
      END;
      row_result := row_result || jsonb_build_object('anonymous_delete_blocked',count_rows=0);
      PERFORM set_config('role','authenticated',true);
      PERFORM set_config('request.jwt.claims',admin_claims::text,true);
      EXECUTE format('DELETE FROM public.%I WHERE id=$1',table_name) USING target_id;
      GET DIAGNOSTICS count_rows = ROW_COUNT;
      results := results || jsonb_build_array(row_result || jsonb_build_object('admin_delete',count_rows=1));
    END LOOP;
    -- A student can create and read their own evidence-backed incident. The
    -- supplied path tests metadata ownership only; no Storage object is written.
    PERFORM set_config('role','authenticated',true);
    PERFORM set_config('request.jwt.claims',student_claims::text,true);
    INSERT INTO public.incidents(description,status,photo_path,photo_paths)
      VALUES ('Permission verification own incident','open',
        (student_claims->>'sub') || '/00000000-0000-4000-8000-000000000001.png',
        ARRAY[(student_claims->>'sub') || '/00000000-0000-4000-8000-000000000001.png']) RETURNING id INTO target_id;
    SELECT count(*) INTO count_rows FROM public.incidents WHERE id=target_id;
    row_result := jsonb_build_object('table','student_incident','own_create_and_view',count_rows=1);
    UPDATE public.incidents SET status='resolved' WHERE id=target_id;
    GET DIAGNOSTICS count_rows = ROW_COUNT;
    row_result := row_result || jsonb_build_object('student_status_change_blocked',count_rows=0);
    PERFORM set_config('request.jwt.claims',admin_claims::text,true);
    SELECT count(*) INTO count_rows FROM public.incidents WHERE id=target_id;
    row_result := row_result || jsonb_build_object('admin_sees_student_incident',count_rows=1);
    UPDATE public.incidents SET status='resolved' WHERE id=target_id;
    GET DIAGNOSTICS count_rows = ROW_COUNT;
    results := results || jsonb_build_array(row_result || jsonb_build_object('admin_can_resolve',count_rows=1));
    table_name := 'profiles';
    -- Account/profile and grade visibility use the same existing Auth identities.
    SELECT count(*) INTO count_rows FROM public.users WHERE id=(student_claims->>'sub')::uuid;
    row_result := jsonb_build_object('table','profiles','admin_views_student',count_rows=1);
    PERFORM set_config('request.jwt.claims',student_claims::text,true);
    SELECT count(*) INTO count_rows FROM public.users WHERE id=(student_claims->>'sub')::uuid;
    row_result := row_result || jsonb_build_object('student_views_own',count_rows=1);
    SELECT count(*) INTO count_rows FROM public.users WHERE id<>(student_claims->>'sub')::uuid;
    results := results || jsonb_build_array(row_result || jsonb_build_object('student_cannot_view_other_accounts',count_rows=0));
    PERFORM set_config('request.jwt.claims',admin_claims::text,true);
    table_name := 'student_grades';
    INSERT INTO public.student_grades(user_id,grade_level) VALUES ((student_claims->>'sub')::uuid,9)
      ON CONFLICT(user_id) DO UPDATE SET grade_level=excluded.grade_level;
    SELECT count(*) INTO count_rows FROM public.student_grades WHERE user_id=(student_claims->>'sub')::uuid AND grade_level=9;
    row_result := jsonb_build_object('table','student_grades','admin_assigns_grade',count_rows=1);
    PERFORM set_config('request.jwt.claims',student_claims::text,true);
    SELECT count(*) INTO count_rows FROM public.student_grades WHERE user_id=(student_claims->>'sub')::uuid;
    row_result := row_result || jsonb_build_object('student_views_own_grade',count_rows=1);
    UPDATE public.student_grades SET grade_level=10 WHERE user_id=(student_claims->>'sub')::uuid;
    GET DIAGNOSTICS count_rows = ROW_COUNT;
    row_result := row_result || jsonb_build_object('student_cannot_change_grade',count_rows=0);
    DELETE FROM public.student_grades WHERE user_id=(student_claims->>'sub')::uuid;
    GET DIAGNOSTICS count_rows = ROW_COUNT;
    results := results || jsonb_build_array(row_result || jsonb_build_object('student_cannot_remove_grade',count_rows=0));
    table_name := 'notifications';
    -- Notification writes deliberately go through the verified server function.
    -- Seeding under the owner here invokes only the transactional audit trigger.
    PERFORM set_config('role',original_role,true);
    PERFORM set_config('request.jwt.claims',admin_claims::text,true);
    INSERT INTO public.notifications(notif_type,priority,message,contact_method)
      VALUES ('alert','urgent','Permission verification','email') RETURNING id INTO target_id;
    PERFORM set_config('role','authenticated',true);
    SELECT count(*) INTO count_rows FROM public.notifications WHERE id=target_id;
    row_result := jsonb_build_object('table','notifications','admin_views_notifications',count_rows=1);
    PERFORM set_config('request.jwt.claims',student_claims::text,true);
    SELECT count(*) INTO count_rows FROM public.notifications WHERE id=target_id;
    row_result := row_result || jsonb_build_object('student_cannot_view_notifications',count_rows=0);
    BEGIN
      UPDATE public.notifications SET delivery_status='sent' WHERE id=target_id;
      GET DIAGNOSTICS count_rows = ROW_COUNT;
    EXCEPTION WHEN insufficient_privilege THEN count_rows := 0;
    END;
    results := results || jsonb_build_array(row_result || jsonb_build_object('student_cannot_spoof_delivery',count_rows=0));
    -- Evaluate the exact live upload policy expressions without writing Storage
    -- metadata or files. New file keys are used by the UI, so no upsert is needed.
    FOR spec IN SELECT value FROM jsonb_array_elements('[
      {"policy":"upload_evacuation_maps","bucket":"evacuation-maps"},
      {"policy":"upload_inspection_photos","bucket":"inspection-photos"}
    ]'::jsonb)
    LOOP
      SELECT with_check INTO columns_sql FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname=spec->>'policy';
      IF columns_sql IS NULL THEN RAISE EXCEPTION 'Missing upload policy %',spec->>'policy'; END IF;
      PERFORM set_config('request.jwt.claims',admin_claims::text,true);
      EXECUTE format('SELECT (%s) FROM (SELECT $1::text AS bucket_id) object',columns_sql) INTO denied USING spec->>'bucket';
      row_result := jsonb_build_object('table',spec->>'bucket','admin_upload_allowed',denied);
      PERFORM set_config('request.jwt.claims',student_claims::text,true);
      EXECUTE format('SELECT (%s) FROM (SELECT $1::text AS bucket_id) object',columns_sql) INTO denied USING spec->>'bucket';
      results := results || jsonb_build_array(row_result || jsonb_build_object('student_upload_blocked',NOT denied));
    END LOOP;
    -- Force rollback of every fixture, including generated audit log rows.
    RAISE EXCEPTION 'verification rollback' USING ERRCODE='ZV001';
  EXCEPTION
    WHEN SQLSTATE 'ZV001' THEN NULL;
    WHEN OTHERS THEN
      results := results || jsonb_build_array(jsonb_build_object('failure',SQLERRM,'sqlstate',SQLSTATE,'table',table_name));
  END;
  PERFORM set_config('role',original_role,true);
  PERFORM set_config('request.jwt.claims','{}',true);
  PERFORM set_config('osas.permission_verification',results::text,true);
END;
$verify$;
SELECT current_setting('osas.permission_verification')::jsonb AS verification;
