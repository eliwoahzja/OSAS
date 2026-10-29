CREATE TABLE IF NOT EXISTS trusted_devices (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash    VARCHAR(64) NOT NULL,
  label         VARCHAR(120),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL,
  UNIQUE (user_id, token_hash)
);
CREATE INDEX IF NOT EXISTS trusted_devices_token_idx ON trusted_devices (token_hash);
ALTER TABLE trusted_devices ENABLE ROW LEVEL SECURITY;
