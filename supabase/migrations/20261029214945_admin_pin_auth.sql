-- Private per-administrator PINs; no default/shared PIN is provisioned.
CREATE SCHEMA IF NOT EXISTS osas_private;
REVOKE ALL ON SCHEMA osas_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA osas_private TO service_role;
CREATE TABLE IF NOT EXISTS osas_private.admin_pins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pin_hash text NOT NULL,
  failed_attempts integer NOT NULL DEFAULT 0 CHECK (failed_attempts BETWEEN 0 AND 5),
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz
);
ALTER TABLE osas_private.admin_pins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON osas_private.admin_pins FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON osas_private.admin_pins TO service_role;

-- SECURITY INVOKER: service-role execution/table access is explicitly required.
-- The Edge Function verifies the JWT and supplies only its actual account ID.
CREATE OR REPLACE FUNCTION public.osas_admin_pin_action(p_user_id uuid, p_action text, p_pin text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  saved osas_private.admin_pins%ROWTYPE;
  attempts integer;
  next_lock timestamptz;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;
  -- Auth's trusted profile-sync trigger maintains this role. The Edge Function
  -- additionally checks fresh app_metadata through Auth; do not grant the
  -- service-role database connection direct access to the Auth users table.
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id AND role = 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'admin_only');
  END IF;
  IF p_action IS NULL OR p_action NOT IN ('status', 'setup', 'verify') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_action');
  END IF;
  IF p_action <> 'status' AND (p_pin IS NULL OR p_pin !~ '^[0-9]{4}$') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_pin');
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 82461029));
  SELECT * INTO saved FROM osas_private.admin_pins WHERE user_id = p_user_id FOR UPDATE;
  IF p_action = 'status' THEN RETURN jsonb_build_object('has_pin', FOUND); END IF;
  IF p_action = 'setup' THEN
    IF FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'already_configured'); END IF;
    INSERT INTO osas_private.admin_pins(user_id, pin_hash)
    VALUES (p_user_id, extensions.crypt(p_pin, extensions.gen_salt('bf', 12)));
    RETURN jsonb_build_object('ok', true);
  END IF;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'pin_not_set'); END IF;
  IF saved.locked_until > statement_timestamp() THEN
    RETURN jsonb_build_object('ok', false, 'code', 'locked', 'retry_after',
      GREATEST(1, ceil(extract(epoch FROM saved.locked_until - statement_timestamp()))::integer));
  END IF;
  attempts := CASE WHEN saved.locked_until IS NOT NULL THEN 0 ELSE saved.failed_attempts END;
  IF extensions.crypt(p_pin, saved.pin_hash) = saved.pin_hash THEN
    UPDATE osas_private.admin_pins SET failed_attempts = 0, locked_until = NULL,
      verified_at = statement_timestamp() WHERE user_id = p_user_id;
    RETURN jsonb_build_object('ok', true);
  END IF;
  attempts := attempts + 1;
  next_lock := CASE WHEN attempts >= 5 THEN statement_timestamp() + interval '15 minutes' ELSE NULL END;
  UPDATE osas_private.admin_pins SET failed_attempts = attempts, locked_until = next_lock WHERE user_id = p_user_id;
  IF attempts >= 5 THEN RETURN jsonb_build_object('ok', false, 'code', 'locked', 'retry_after', 900); END IF;
  RETURN jsonb_build_object('ok', false, 'code', 'incorrect_pin');
END;
$$;
REVOKE ALL ON FUNCTION public.osas_admin_pin_action(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.osas_admin_pin_action(uuid, text, text) TO service_role;
