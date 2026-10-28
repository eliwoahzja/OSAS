-- Accounts must be created by manage-accounts using trusted app_metadata.
-- Public signup cannot supply app_metadata. Existing accounts remain unchanged.
CREATE OR REPLACE FUNCTION public.osas_require_managed_account()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF COALESCE(NEW.raw_app_meta_data ->> 'role', '') NOT IN ('admin', 'client') THEN
    RAISE EXCEPTION 'Student accounts must be created by an administrator.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.osas_require_managed_account() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS osas_managed_accounts_only ON auth.users;
CREATE TRIGGER osas_managed_accounts_only BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.osas_require_managed_account();

