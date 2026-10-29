-- Add usernames without changing account IDs, email addresses, or passwords.
ALTER TABLE public.users ADD COLUMN username text;

CREATE FUNCTION public.osas_assign_username()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  base text;
  candidate text;
  suffix integer := 0;
BEGIN
  -- Serialize assignment so simultaneous creates cannot claim the same name.
  PERFORM pg_catalog.pg_advisory_xact_lock(68567925001);
  IF TG_OP = 'UPDATE' AND NEW.username IS NULL THEN
    NEW.username := OLD.username;
  END IF;
  IF NEW.username IS NOT NULL THEN
    NEW.username := lower(btrim(NEW.username));
    IF NEW.username !~ '^[a-z0-9]([a-z0-9._-]{0,62}[a-z0-9])?$' THEN
      RAISE EXCEPTION 'Enter a valid username.' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (SELECT 1 FROM public.users WHERE username = NEW.username AND id <> NEW.id) THEN
      RAISE EXCEPTION 'Username is already taken.' USING ERRCODE = '23505';
    END IF;
  ELSE
    base := trim(both '._-' from left(regexp_replace(lower(split_part(COALESCE(NEW.email, ''), '@', 1)), '[^a-z0-9._-]', '-', 'g'), 48));
    IF base = '' THEN base := 'account'; END IF;
    candidate := base;
    WHILE EXISTS (SELECT 1 FROM public.users WHERE username = candidate AND id <> NEW.id) LOOP
      suffix := suffix + 1;
      candidate := base || '-' || suffix;
    END LOOP;
    NEW.username := candidate;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.osas_assign_username() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER osas_assign_username BEFORE INSERT OR UPDATE OF username ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.osas_assign_username();

-- Include Auth accounts that did not previously have a public profile. Assign
-- collision suffixes deterministically, retaining each original email.
DO $$
DECLARE account record;
BEGIN
  FOR account IN SELECT * FROM auth.users ORDER BY created_at, id LOOP
    INSERT INTO public.users (id, email, full_name, role, created_at)
    VALUES (account.id, account.email,
      COALESCE(NULLIF(account.raw_user_meta_data->>'name', ''), account.email, 'Account'),
      CASE WHEN account.raw_app_meta_data->>'role' = 'admin' THEN 'admin' ELSE 'staff' END,
      account.created_at)
    ON CONFLICT (id) DO UPDATE SET username = public.users.username;
  END LOOP;
END;
$$;
ALTER TABLE public.users ALTER COLUMN username SET NOT NULL;
ALTER TABLE public.users ADD CONSTRAINT users_username_format CHECK (
  username = lower(btrim(username)) AND username ~ '^[a-z0-9]([a-z0-9._-]{0,62}[a-z0-9])?$'
);
ALTER TABLE public.users ADD CONSTRAINT users_username_key UNIQUE (username);

-- Auth remains the source of truth for email and role. A username is stable
-- across email changes and can only be explicitly set through trusted app_metadata.
CREATE FUNCTION public.osas_sync_account_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE saved_username text;
BEGIN
  SELECT username INTO saved_username FROM public.users WHERE id = NEW.id;
  INSERT INTO public.users (id, email, full_name, role, username, created_at)
  VALUES (NEW.id, NEW.email,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'name', ''), NEW.email, 'Account'),
    CASE WHEN NEW.raw_app_meta_data->>'role' = 'admin' THEN 'admin' ELSE 'staff' END,
    COALESCE(NEW.raw_app_meta_data->>'username', saved_username), NEW.created_at)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email, full_name = EXCLUDED.full_name,
    role = EXCLUDED.role, username = EXCLUDED.username;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.osas_sync_account_profile() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER osas_sync_account_profile
  AFTER INSERT OR UPDATE OF email, raw_user_meta_data, raw_app_meta_data ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.osas_sync_account_profile();

-- No anonymous profile lookup: username authentication resolves mailboxes only
-- inside the Edge Function using its service-role client and existing RLS.
