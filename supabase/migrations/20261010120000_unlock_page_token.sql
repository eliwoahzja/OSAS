-- Gate the unlock page behind the emailed "Verify Now" link token + password reset after unlock.
-- Idempotent: safe to re-run.

ALTER TABLE account_locks ADD COLUMN IF NOT EXISTS page_token_hash VARCHAR(64);
ALTER TABLE account_locks ADD COLUMN IF NOT EXISTS reset_token_hash VARCHAR(64);
ALTER TABLE account_locks ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMPTZ;
