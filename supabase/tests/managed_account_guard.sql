
BEGIN;
DO $$
DECLARE test_id uuid; managed_role text; rejected boolean;
BEGIN
  
  FOREACH managed_role IN ARRAY ARRAY['client', 'admin'] LOOP
    test_id := gen_random_uuid();
    INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
    VALUES (test_id, test_id::text || '@guard-check.example.test',
      '{"provider":"email","providers":["email"]}', '{"name":"Guard verification"}');
    UPDATE auth.users SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object('role', managed_role) WHERE id=test_id;
    SET CONSTRAINTS auth.osas_managed_accounts_only IMMEDIATE;
    DELETE FROM auth.users WHERE id=test_id;
    SET CONSTRAINTS auth.osas_managed_accounts_only DEFERRED;
  END LOOP;
  
  FOREACH managed_role IN ARRAY ARRAY['', 'untrusted'] LOOP
    rejected := false;
    BEGIN
      test_id := gen_random_uuid();
      INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
      VALUES (test_id, test_id::text || '@guard-check.example.test',
        jsonb_build_object('provider','email','role',managed_role), '{"role":"admin","name":"Spoof check"}');
      SET CONSTRAINTS auth.osas_managed_accounts_only IMMEDIATE;
    EXCEPTION WHEN insufficient_privilege THEN rejected := true;
    END;
    IF NOT rejected THEN RAISE EXCEPTION 'Unmanaged account was accepted'; END IF;
    SET CONSTRAINTS auth.osas_managed_accounts_only DEFERRED;
  END LOOP;
  
  rejected := false;
  BEGIN
    test_id := gen_random_uuid();
    INSERT INTO auth.users (id, email, raw_app_meta_data)
    VALUES (test_id, test_id::text || '@guard-check.example.test', '{"role":"client"}');
    UPDATE auth.users SET raw_app_meta_data='{}' WHERE id=test_id;
    SET CONSTRAINTS auth.osas_managed_accounts_only IMMEDIATE;
  EXCEPTION WHEN insufficient_privilege THEN rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Guard used stale insert metadata'; END IF;
END $$;
SELECT 'Managed account guard checks passed' AS result;
ROLLBACK;
