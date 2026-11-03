-- All signed-in students can read school announcements; only admins manage them.
CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 5000),
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT statement_timestamp()
);
CREATE INDEX announcements_newest_idx ON public.announcements(created_at DESC, id DESC);
CREATE INDEX announcements_author_idx ON public.announcements(author_id);
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.announcements FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON public.announcements TO authenticated;
GRANT INSERT (title, body), UPDATE (title, body) ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;

CREATE POLICY announcements_read ON public.announcements
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY announcements_create_admin ON public.announcements
  FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_admin()) AND author_id = (SELECT auth.uid()));
CREATE POLICY announcements_update_admin ON public.announcements
  FOR UPDATE TO authenticated USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY announcements_delete_admin ON public.announcements
  FOR DELETE TO authenticated USING ((SELECT public.is_admin()));

CREATE FUNCTION public.osas_stamp_announcement()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  NEW.title := btrim(NEW.title);
  NEW.body := btrim(NEW.body);
  IF TG_OP = 'INSERT' THEN
    NEW.author_id := auth.uid();
    SELECT COALESCE(NULLIF(btrim(u.name), ''), 'OSAS Administrator')
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
CREATE TRIGGER announcements_stamp BEFORE INSERT OR UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.osas_stamp_announcement();
