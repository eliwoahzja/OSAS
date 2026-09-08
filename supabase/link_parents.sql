ALTER TABLE emergency_contacts ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES students(id);

UPDATE emergency_contacts SET student_id = '11111111-1111-4111-8111-111111111111' WHERE email = 'yoboieliii@gmail.com';
UPDATE emergency_contacts SET student_id = '22222222-2222-4222-8222-222222222222' WHERE email = 'yoboieliii@gmail.com' OR email = 'ramon.reyes@gmail.com';
UPDATE emergency_contacts SET student_id = '33333333-3333-4333-8333-333333333333' WHERE email = 'yoboieliii@gmail.com' OR email = 'grace.yap@gmail.com';
