ALTER TABLE public.password_reset_requests ADD COLUMN request_kind text NOT NULL DEFAULT 'reset' CHECK (request_kind IN ('reset','registration'));
ALTER TABLE public.password_reset_requests ADD COLUMN submitted_name text;
ALTER TABLE public.password_reset_requests ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.password_reset_requests ADD CONSTRAINT reset_request_has_account CHECK (request_kind='registration' OR user_id IS NOT NULL);
CREATE INDEX account_requests_email_time ON public.password_reset_requests (email,requested_at DESC);

CREATE FUNCTION public.account_request_email_exists(p_email text) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE lower(email)=lower(btrim(p_email)));
$$;
REVOKE ALL ON FUNCTION public.account_request_email_exists(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.account_request_email_exists(text) TO service_role;

CREATE FUNCTION public.submit_account_request(p_email text,p_ip_hash text,p_name text,p_kind text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE request_id uuid; hits integer;
BEGIN
  IF p_kind NOT IN ('reset','registration') OR length(btrim(p_name)) NOT BETWEEN 2 AND 120
    OR length(p_email)>254 OR p_ip_hash !~ '^[a-f0-9]{64}$' THEN RETURN NULL; END IF;
  IF p_kind='reset' THEN
    request_id := public.submit_password_reset(p_email,p_ip_hash);
    IF request_id IS NOT NULL THEN
      UPDATE public.password_reset_requests SET submitted_name=btrim(p_name) WHERE id=request_id;
    END IF;
    RETURN request_id;
  END IF;
  DELETE FROM public.password_reset_rate_limits WHERE bucket<now()-interval '2 days';
  INSERT INTO public.password_reset_rate_limits AS limits (key,bucket)
  VALUES(p_ip_hash,date_trunc('hour',now())) ON CONFLICT(key) DO UPDATE
  SET attempts=CASE WHEN limits.bucket=EXCLUDED.bucket THEN limits.attempts+1 ELSE 1 END,bucket=EXCLUDED.bucket
  RETURNING attempts INTO hits;
  IF hits>5 THEN RETURN NULL; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(lower(btrim(p_email)),0));
  IF public.account_request_email_exists(p_email) THEN RETURN NULL; END IF;
  IF EXISTS(SELECT 1 FROM public.password_reset_requests WHERE email=lower(btrim(p_email))
    AND (requested_at>now()-interval '1 hour' OR status='pending'
      OR (status IN ('approved','issuing','resetting') AND expires_at>now()))) THEN RETURN NULL; END IF;
  INSERT INTO public.password_reset_requests(email,name,submitted_name,role,request_kind)
    VALUES(lower(btrim(p_email)),btrim(p_name),btrim(p_name),'client','registration') RETURNING id INTO request_id;
  RETURN request_id;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_account_request(text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.submit_account_request(text,text,text,text) TO service_role;
