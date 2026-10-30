-- OSAS AI administrative agent gateway.
-- Audit, request idempotency, and chat throttling for the n8n agent.
-- Only the service role writes these tables; administrators may read the audit trail.

CREATE TABLE IF NOT EXISTS public.agent_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Keep the audit trail if the administrator account is later removed.
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_email TEXT,
    tool TEXT NOT NULL,
    input JSONB,
    status TEXT NOT NULL CHECK (status IN ('ok', 'error')),
    record_id TEXT,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agent_audit_log_actor_time_idx
    ON public.agent_audit_log (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS agent_audit_log_time_idx
    ON public.agent_audit_log (created_at DESC);

ALTER TABLE public.agent_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_admin" ON public.agent_audit_log;
CREATE POLICY "read_admin" ON public.agent_audit_log
    FOR SELECT TO authenticated USING (public.is_admin());

-- A single n8n run may retry a write. Cache the result per actor/run/tool so a
-- retry cannot create a duplicate incident, drill, account, or notification.
CREATE TABLE IF NOT EXISTS public.agent_requests (
    actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    request_id TEXT NOT NULL,
    tool TEXT NOT NULL,
    result JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (actor_id, request_id, tool)
);

ALTER TABLE public.agent_requests ENABLE ROW LEVEL SECURITY;

-- Content-free chat usage log for per-administrator throttling.
CREATE TABLE IF NOT EXISTS public.agent_chat_log (
    id BIGSERIAL PRIMARY KEY,
    actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agent_chat_log_actor_time_idx
    ON public.agent_chat_log (actor_id, created_at DESC);

ALTER TABLE public.agent_chat_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_admin" ON public.agent_chat_log;
CREATE POLICY "read_admin" ON public.agent_chat_log
    FOR SELECT TO authenticated USING (public.is_admin());

-- Service-role writes (the agent gateway) must be able to attribute an incident
-- to the administrator who approved it. Authenticated browser writes still get
-- the signed-in user's id from auth.uid() and keep the student privacy rules:
-- a student cannot choose the reporter, status, classification, location or
-- student linked to their own report.
CREATE OR REPLACE FUNCTION public.osas_attribute_incident_submitter()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.submitted_by := COALESCE(auth.uid(), NEW.submitted_by);
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
