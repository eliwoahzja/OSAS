-- Permit administrator drill deletion without granting students delete rights.
CREATE POLICY drills_delete_admin ON public.drills
  FOR DELETE TO authenticated
  USING ((SELECT public.is_admin()));

-- Incident evidence is optional, linked by a private Storage object key.
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS photo_path text;
ALTER TABLE public.incidents ADD CONSTRAINT incidents_photo_path_format
  CHECK (photo_path IS NULL OR photo_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\\.(jpg|png|webp)$');

-- Separate, non-public evidence storage. Restrict media and size server-side.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('incident-evidence', 'incident-evidence', false, 5242880,
        ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]);

-- Reporters upload only under their own auth user ID.
CREATE POLICY incident_evidence_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'incident-evidence'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

-- Reporters see their own files; administrators see school incident evidence.
CREATE POLICY incident_evidence_read_authorized ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'incident-evidence'
    AND (
      (storage.foldername(name))[1] = (SELECT auth.uid())::text
      OR (SELECT public.is_admin())
    )
  );

-- A reporter can remove a failed upload, but not an attached report photo.
CREATE POLICY incident_evidence_delete_unlinked ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'incident-evidence'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND NOT EXISTS (
      SELECT 1 FROM public.incidents i WHERE i.photo_path = name
    )
  );

-- Limit inserted report photo keys to the uploading account, even if a
-- user knows another Storage object's path.
CREATE POLICY incident_photo_path_insert_owner ON public.incidents
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    photo_path IS NULL
    OR split_part(photo_path, '/', 1) = (SELECT auth.uid())::text
  );
