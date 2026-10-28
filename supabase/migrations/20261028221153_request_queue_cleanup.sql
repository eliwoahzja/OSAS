-- Removing a reviewed request from the queue must not invalidate its active link.
ALTER TABLE public.password_reset_requests ADD COLUMN archived_at timestamptz;
