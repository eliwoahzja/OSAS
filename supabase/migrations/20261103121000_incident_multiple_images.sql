-- Keep the existing single-photo column for backwards compatibility.
-- New reports store every attachment in photo_paths and use photo_path as the
-- primary image so existing integrations continue to work.
ALTER TABLE public.incidents
  ADD COLUMN IF NOT EXISTS photo_paths text[] NOT NULL DEFAULT ARRAY[]::text[];

UPDATE public.incidents
SET photo_paths = ARRAY[photo_path]
WHERE photo_path IS NOT NULL AND cardinality(photo_paths) = 0;

ALTER TABLE public.incidents
  ADD CONSTRAINT incidents_photo_paths_max_eight
  CHECK (cardinality(photo_paths) <= 8);

ALTER TABLE public.incidents
  ADD CONSTRAINT incidents_primary_photo_in_paths
  CHECK (photo_path IS NULL OR photo_path = ANY(photo_paths));

-- A student must attach between one and eight photos belonging to their own
-- private Storage folder. Older reports remain unaffected by INSERT policies.
CREATE POLICY incident_photo_paths_insert_owner
ON public.incidents AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (
  (SELECT public.is_admin())
  OR (
    cardinality(photo_paths) BETWEEN 1 AND 8
    AND photo_paths[1] = photo_path
    AND NOT EXISTS (
      SELECT 1
      FROM unnest(photo_paths) AS evidence(path)
      WHERE evidence.path IS NULL
        OR evidence.path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}[.](jpg|png|webp)$'
        OR split_part(evidence.path, '/', 1) IS DISTINCT FROM (SELECT auth.uid())::text
    )
  )
);

-- Do not delete a saved image just because it is not the first photo.
ALTER POLICY incident_evidence_delete_unlinked ON storage.objects
USING (
  bucket_id = 'incident-evidence'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  AND NOT EXISTS (
    SELECT 1 FROM public.incidents i
    WHERE i.photo_path = objects.name
       OR i.photo_paths @> ARRAY[objects.name]::text[]
  )
);
