ALTER TABLE public.incidents
  ADD COLUMN IF NOT EXISTS reference_images jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.incidents
  ADD CONSTRAINT incidents_reference_images_max_two
  CHECK (jsonb_typeof(reference_images) = 'array' AND jsonb_array_length(reference_images) <= 2);

DROP POLICY IF EXISTS incident_reference_images_admin_only ON public.incidents;

CREATE POLICY incident_reference_images_admin_only
  ON public.incidents
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin()) OR reference_images = '[]'::jsonb);
