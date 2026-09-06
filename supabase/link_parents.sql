-- One-time migration for the LIVE database.
-- Paste this into the Supabase SQL editor and run it once.
-- Links each guardian in emergency_contacts to their student so the
-- notification system emails the right parent.

ALTER TABLE emergency_contacts ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES students(id);

UPDATE emergency_contacts SET student_id = '11111111-1111-4111-8111-111111111111' WHERE email = 'yoboieliii@gmail.com'; -- Dela Cruz, Sofia Isabel
UPDATE emergency_contacts SET student_id = '22222222-2222-4222-8222-222222222222' WHERE email = 'ramon.reyes@gmail.com';  -- Reyes, Althea Jane
UPDATE emergency_contacts SET student_id = '33333333-3333-4333-8333-333333333333' WHERE email = 'grace.yap@gmail.com';    -- Yap, Lorenzo Miguel
