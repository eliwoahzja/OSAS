-- Password reset requests are handled only by the Edge Function's service role.
CREATE TABLE public.password_reset_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text NOT NULL,
  role text NOT NULL,
  account_created_at timestamptz,
  last_sign_in_at timestamptz,
  requested_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','issuing','approved','resetting','completed','rejected')),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  token_hash text,
  expires_at timestamptz,
  completed_at timestamptz,
  notification_error text,
  CONSTRAINT reset_token_hash_format CHECK (token_hash IS NULL OR token_hash ~ '^[a-f0-9]{64}$')
);
CREATE INDEX password_reset_requests_user_time ON public.password_reset_requests (user_id, requested_at DESC);
CREATE INDEX password_reset_requests_queue ON public.password_reset_requests (requested_at DESC);
CREATE INDEX password_reset_requests_reviewer ON public.password_reset_requests (reviewed_by);
ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.password_reset_requests FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.password_reset_requests TO service_role;

CREATE TABLE public.password_reset_rate_limits (
  key text PRIMARY KEY,
  bucket timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 1
);
CREATE INDEX password_reset_rate_limits_bucket ON public.password_reset_rate_limits (bucket);
ALTER TABLE public.password_reset_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.password_reset_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.password_reset_rate_limits TO service_role;

-- This narrowly scoped function needs auth.users access to match an email without
-- exposing an account lookup endpoint. Only service_role receives EXECUTE.
CREATE FUNCTION public.submit_password_reset(p_email text, p_ip_hash text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  target auth.users%ROWTYPE;
  request_id uuid;
  hits integer;
BEGIN
  IF length(p_email) > 254 OR p_ip_hash !~ '^[a-f0-9]{64}$' THEN RETURN NULL; END IF;
  DELETE FROM public.password_reset_rate_limits WHERE bucket < now() - interval '2 days';
  INSERT INTO public.password_reset_rate_limits AS limits (key, bucket)
  VALUES (p_ip_hash, date_trunc('hour', now()))
  ON CONFLICT (key) DO UPDATE
  SET attempts = CASE WHEN limits.bucket = EXCLUDED.bucket THEN limits.attempts + 1 ELSE 1 END,
      bucket = EXCLUDED.bucket
  RETURNING attempts INTO hits;
  IF hits > 5 THEN RETURN NULL; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(lower(btrim(p_email)), 0));
  SELECT * INTO target FROM auth.users WHERE lower(email) = lower(btrim(p_email)) LIMIT 1;
  IF target.id IS NULL THEN RETURN NULL; END IF;
  IF EXISTS (
    SELECT 1 FROM public.password_reset_requests WHERE user_id = target.id
      AND (requested_at > now() - interval '1 hour' OR status = 'pending'
        OR (status IN ('approved','issuing','resetting') AND expires_at > now()))
  ) THEN RETURN NULL; END IF;
  INSERT INTO public.password_reset_requests (user_id,email,name,role,account_created_at,last_sign_in_at)
  VALUES (target.id, lower(target.email), COALESCE(target.raw_user_meta_data->>'name', target.email),
    CASE WHEN target.raw_app_meta_data->>'role' = 'admin' THEN 'admin' ELSE 'client' END,
    target.created_at, target.last_sign_in_at)
  RETURNING id INTO request_id;
  RETURN request_id;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_password_reset(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_password_reset(text,text) TO service_role;
