-- Restore the missing administrator delete paths without granting student writes.
CREATE POLICY evacuation_plans_delete_admin ON public.evacuation_plans
  FOR DELETE TO authenticated USING ((SELECT public.is_admin()));
CREATE POLICY risks_delete_admin ON public.risks
  FOR DELETE TO authenticated USING ((SELECT public.is_admin()));

-- These files belong to administrator-managed workspaces. Student incident
-- evidence keeps its separate owner-scoped policy and is not changed here.
ALTER POLICY upload_evacuation_maps ON storage.objects TO authenticated
  WITH CHECK (bucket_id = 'evacuation-maps' AND (SELECT public.is_admin()));
ALTER POLICY upload_inspection_photos ON storage.objects TO authenticated
  WITH CHECK (bucket_id = 'inspection-photos' AND (SELECT public.is_admin()));
