-- Supabase Auth inserts the user before applying Admin API app_metadata.
-- Check the final saved role when the creation transaction commits.
CREATE OR REPLACE FUNCTION public.osas_require_managed_account()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  managed_role text;
BEGIN
  SELECT u.raw_app_meta_data ->> 'role' INTO managed_role
  FROM auth.users AS u WHERE u.id = NEW.id;
  IF FOUND AND COALESCE(managed_role, '') NOT IN ('admin', 'client') THEN
    RAISE EXCEPTION 'Student accounts must be created by an administrator.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.osas_require_managed_account() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS osas_managed_accounts_only ON auth.users;
CREATE CONSTRAINT TRIGGER osas_managed_accounts_only
  AFTER INSERT ON auth.users DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.osas_require_managed_account();
