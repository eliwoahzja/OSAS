-- Optional verified address for school and agency emergency responders.
-- Existing contacts retain their original values; RLS restricts reads to school contacts.
ALTER TABLE public.emergency_contacts
  ADD COLUMN IF NOT EXISTS address text;

COMMENT ON COLUMN public.emergency_contacts.address IS
  'Verified location of the school office, responder, or emergency agency; optional.';
