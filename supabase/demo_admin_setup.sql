-- Requested demo administrator. Preserve the existing account and password.
-- Other administrator accounts remain available.
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
WHERE lower(email) = 'tropanggala87@gmail.com';
INSERT INTO public.users (id, email, full_name, role)
SELECT id, email, COALESCE(raw_user_meta_data->>'name', email), 'admin'
FROM auth.users WHERE lower(email) = 'tropanggala87@gmail.com'
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, role = 'admin';
-- The school nurse contact already uses this address. Keep it eligible for alerts.
UPDATE public.emergency_contacts SET active = true
WHERE category = 'school' AND lower(email) = 'tropanggala87@gmail.com'
  AND (COALESCE(name,'') || ' ' || COALESCE(role,'')) ~* 'nurse|clinic|health';
