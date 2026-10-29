-- Run in a disposable database after the administrator PIN migration.
-- All synthetic Auth/profile/PIN rows are rolled back.
BEGIN;
INSERT INTO auth.users (id, email, raw_app_meta_data)
VALUES
  ('95000000-0000-4000-8000-000000000001', 'pin-admin@example.invalid', '{"role":"admin"}'),
  ('95000000-0000-4000-8000-000000000002', 'pin-student@example.invalid', '{"role":"client"}');
-- An upgraded project's profile-sync trigger already creates these rows.
INSERT INTO public.users (id,email,full_name,role)
VALUES
  ('95000000-0000-4000-8000-000000000001','pin-admin@example.invalid','PIN Admin','admin'),
  ('95000000-0000-4000-8000-000000000002','pin-student@example.invalid','PIN Student','staff')
ON CONFLICT (id) DO NOTHING;

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
DO $$
DECLARE
  account_id uuid := '95000000-0000-4000-8000-000000000001';
  result jsonb;
  n integer;
BEGIN
  IF public.osas_admin_pin_action(account_id, 'status')->>'has_pin' <> 'false' THEN RAISE EXCEPTION 'New admin unexpectedly has a PIN'; END IF;
  IF public.osas_admin_pin_action(account_id, 'verify', '0123')->>'code' <> 'pin_not_set' THEN RAISE EXCEPTION 'Missing setup not reported'; END IF;
  IF public.osas_admin_pin_action(account_id, 'setup', '123')->>'code' <> 'invalid_pin' THEN RAISE EXCEPTION 'Malformed PIN accepted'; END IF;
  IF public.osas_admin_pin_action(account_id, 'setup', '0123')->>'ok' <> 'true' THEN RAISE EXCEPTION 'First PIN setup failed'; END IF;
  IF public.osas_admin_pin_action(account_id, 'setup', '9999')->>'code' <> 'already_configured' THEN RAISE EXCEPTION 'Existing PIN could be replaced'; END IF;
  IF public.osas_admin_pin_action(account_id, 'status') <> '{"has_pin":true}'::jsonb THEN RAISE EXCEPTION 'Status exposes private PIN data'; END IF;
  IF public.osas_admin_pin_action(account_id, 'verify', '0123')->>'ok' <> 'true' THEN RAISE EXCEPTION 'Correct PIN rejected'; END IF;
  FOR n IN 1..4 LOOP
    IF public.osas_admin_pin_action(account_id, 'verify', '9999')->>'code' <> 'incorrect_pin' THEN RAISE EXCEPTION 'Incorrect PIN attempt not recorded'; END IF;
  END LOOP;
  result := public.osas_admin_pin_action(account_id, 'verify', '9999');
  IF result->>'code' <> 'locked' OR (result->>'retry_after')::int < 899 THEN RAISE EXCEPTION 'Fifth failure did not lock PIN'; END IF;
  IF public.osas_admin_pin_action(account_id, 'verify', '0123')->>'code' <> 'locked' THEN RAISE EXCEPTION 'Correct PIN bypassed lockout'; END IF;
  IF public.osas_admin_pin_action('95000000-0000-4000-8000-000000000002', 'setup', '0123')->>'code' <> 'admin_only' THEN RAISE EXCEPTION 'Student configured an administrator PIN'; END IF;
END;
$$;
RESET ROLE;
UPDATE osas_private.admin_pins SET locked_until = now() - interval '1 minute'
WHERE user_id = '95000000-0000-4000-8000-000000000001';
SET LOCAL ROLE service_role;
DO $$
DECLARE result jsonb;
BEGIN
  result := public.osas_admin_pin_action('95000000-0000-4000-8000-000000000001', 'verify', '0123');
  IF result->>'ok' <> 'true' THEN RAISE EXCEPTION 'PIN did not unlock after cooldown'; END IF;
END;
$$;
RESET ROLE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM osas_private.admin_pins WHERE failed_attempts <> 0 OR locked_until IS NOT NULL) THEN RAISE EXCEPTION 'Success did not clear attempts and lock'; END IF;
  IF has_table_privilege('authenticated', 'osas_private.admin_pins', 'SELECT') OR has_table_privilege('anon', 'osas_private.admin_pins', 'SELECT') THEN RAISE EXCEPTION 'PIN table exposed to clients'; END IF;
  IF has_function_privilege('authenticated', 'public.osas_admin_pin_action(uuid,text,text)', 'EXECUTE') OR has_function_privilege('anon', 'public.osas_admin_pin_action(uuid,text,text)', 'EXECUTE') THEN RAISE EXCEPTION 'PIN RPC exposed to clients'; END IF;
  IF NOT has_function_privilege('service_role', 'public.osas_admin_pin_action(uuid,text,text)', 'EXECUTE') THEN RAISE EXCEPTION 'PIN RPC missing service-role permission'; END IF;
END $$;
ROLLBACK;
