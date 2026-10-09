-- Account lockout / unlock support for the OSAS dashboard.
-- Safe to re-run on an existing database (idempotent, never drops data).
--
-- After running this once:
--   supabase functions deploy auth-gateway
--   (see EMAIL-WIRING.md for the required secrets)

CREATE TABLE IF NOT EXISTS auth_login_attempts (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email      VARCHAR(255) NOT NULL,
  ok         BOOLEAN NOT NULL DEFAULT FALSE,
  locked     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS auth_login_attempts_user_idx
  ON auth_login_attempts (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS account_locks (
  user_id                UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                  VARCHAR(255) NOT NULL,
  failed_attempts        INT NOT NULL DEFAULT 0,
  locked_at              TIMESTAMPTZ,
  unlock_code_hash       VARCHAR(64),
  unlock_code_expires_at TIMESTAMPTZ,
  unlock_tries           INT NOT NULL DEFAULT 0,
  unlock_sent_at         TIMESTAMPTZ,
  locked_reason          VARCHAR(255),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Blocked by RLS from every non-service-role path. Rows are only written by
-- the auth-gateway Edge Function with the service-role key (which bypasses RLS).
ALTER TABLE auth_login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_locks        ENABLE ROW LEVEL SECURITY;

-- Optional: admins can list recent lock rows from the SQL editor.
-- (service_role bypasses RLS, so the function needs no policy of its own)
