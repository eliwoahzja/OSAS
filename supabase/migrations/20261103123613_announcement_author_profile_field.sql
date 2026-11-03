-- Use the existing full_name profile column for announcement attribution.
CREATE OR REPLACE FUNCTION public.osas_stamp_announcement()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  NEW.title := btrim(NEW.title);
  NEW.body := btrim(NEW.body);
  IF TG_OP = 'INSERT' THEN
    NEW.author_id := auth.uid();
    SELECT COALESCE(NULLIF(btrim(u.full_name), ''), 'OSAS Administrator')
      INTO NEW.author_name FROM public.users u WHERE u.id = auth.uid();
    NEW.author_name := COALESCE(NEW.author_name, 'OSAS Administrator');
    NEW.created_at := statement_timestamp();
  ELSE
    -- Author ID cannot be changed through client column grants. Leave it alone
    -- here so deleting an account can set the foreign key to NULL.
    NEW.author_name := OLD.author_name;
    NEW.created_at := OLD.created_at;
  END IF;
  NEW.updated_at := statement_timestamp();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.osas_stamp_announcement() FROM PUBLIC, anon, authenticated;
