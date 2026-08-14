-- ============================================================
-- OSAS seed data — paste into the Supabase SQL editor AFTER
-- schema.sql. Gives the live dashboard real rows so KPIs and
-- the Resend email path can be tested end-to-end.
-- ============================================================

-- ---------- Students (fixed UUIDs so rows can reference them) ----------
INSERT INTO students (id, name, grade, section, phone) VALUES
  ('11111111-1111-4111-8111-111111111111', 'Dela Cruz, Sofia Isabel',   7,  '7-A', '0917 555 1105'),
  ('22222222-2222-4222-8222-222222222222', 'Reyes, Althea Jane',        7,  '7-B', '0917 555 1107'),
  ('33333333-3333-4333-8333-333333333333', 'Yap, Lorenzo Miguel',      10,  '10-B', '0917 555 1402');

-- ---------- Emergency contacts (parent emails — used for notifications) ----------
INSERT INTO emergency_contacts (category, name, relationship, phone, email, priority) VALUES
  ('student', 'Marco Dela Cruz',   'Father', '0917 555 2001', 'yoboieliii@gmail.com', 1),
  ('student', 'Ramon Reyes',       'Father', '0917 555 2002', 'ramon.reyes@gmail.com', 1),
  ('student', 'Grace Yap',         'Mother', '0917 555 2003', 'grace.yap@gmail.com', 1),
  ('school',  'School Nurse',      NULL,     '0917 555 0001', 'nurse@saac.edu.ph', NULL),
  ('school',  'Caloocan City Police Station 1', NULL, '(02) 8-364-1234', 'cpd1@ncrpo.pnp.gov.ph', NULL);

-- ---------- A few operational rows so the dashboard shows real numbers ----------
INSERT INTO incidents (date, time, type, location, description, reporter, severity, status, student_id) VALUES
  (CURRENT_DATE - 3, '9:12 AM', 'medical', 'Gymnasium', 'Student fainted during PE warm-up.', 'Ms. Rivera', 'medium', 'resolved', '11111111-1111-4111-8111-111111111111'),
  (CURRENT_DATE - 1, '10:05 AM', 'fire-related', 'Science Wing — Lab 2', 'Smoke from an electrical outlet; power cut off.', 'Ms. Villar', 'high', 'open', NULL);

INSERT INTO inspections (item, area, frequency, last_inspected, status, inspector, notes) VALUES
  ('Fire extinguishers', 'Main Building', 'Monthly', CURRENT_DATE - 10, 'passed', 'Mr. Dela Peña', 'All units charged.'),
  ('Electrical panels & wiring', 'Science Wing', 'Semi-annual', CURRENT_DATE - 200, 'overdue', 'External Electrician', 'Follow-up needed.');

INSERT INTO drills (type, date, time, building, person_in_charge, status, notes) VALUES
  ('Fire', CURRENT_DATE - 30, '9:00 AM', 'Main Building', 'Mr. Lim', 'completed', 'Evacuated in 4 min 30 s.'),
  ('Earthquake', CURRENT_DATE + 30, '10:30 AM', 'Science Wing', 'Ms. Villar', 'upcoming', '');

INSERT INTO supplies (item, quantity, unit, location, expiry, reorder_threshold, last_restocked) VALUES
  ('Adhesive bandages', 12, 'boxes', 'Clinic Cabinet A', CURRENT_DATE + 300, 5, CURRENT_DATE - 25),
  ('Sterile gauze pads (4x4)', 3, 'packs', 'Clinic Cabinet A', CURRENT_DATE + 200, 5, CURRENT_DATE - 90),
  ('Instant cold packs', 2, 'pcs', 'Emergency Bag', CURRENT_DATE + 60, 4, CURRENT_DATE - 180);

-- ---------- A sample event notice (proof the Resend path works) ----------
INSERT INTO notifications (notif_type, priority, audience_group, title, message, event_start_at, event_end_at, contact_method, sent_at, delivery_status) VALUES
  ('event_notice', 'informational', 'All Parents', 'Foundation Day — Schedule',
   'Foundation Day will be held on August 21 from 8:00 AM to 5:00 PM.',
   CURRENT_TIMESTAMP + INTERVAL '7 days', CURRENT_TIMESTAMP + INTERVAL '7 days' + INTERVAL '9 hours',
   'email', NOW(), 'sent');

-- ---------- Remaining modules (so no page is ever empty) ----------
INSERT INTO evacuation_plans (building, floor, exits, routes, assembly_point, version, updated, current) VALUES
  ('Main Building', 'Ground Floor', 'Exit A, Exit B, Exit C', 'R1 via Front Lobby', 'Quadrangle — Zone 1', 'v1.0', CURRENT_DATE, TRUE),
  ('Science Wing', 'All Floors', 'Exit D, Exit E', 'R4 via West Exit', 'Covered Court — Zone 2', 'v1.4', CURRENT_DATE, TRUE);

INSERT INTO risks (hazard, likelihood, impact, risk_level, mitigation, owner, review_date) VALUES
  ('Electrical wiring in Science Wing Lab 2', 'High', 'High', 'Critical', 'Immediate panel inspection; schedule rewiring.', 'Mr. Dela Peña', CURRENT_DATE + 16),
  ('Unauthorized entry at the main gate', 'Medium', 'Medium', 'Medium', 'Strict visitor log, ID checks.', 'Mr. Cruz', CURRENT_DATE + 11);

INSERT INTO emergency_roles (role, staff, zone, backup) VALUES
  ('Fire Warden', 'Mr. Dela Peña', 'Main Building — Floors 1–2', 'Mr. Lim'),
  ('First Aider', 'Nurse — Ms. Dela Peña', 'Clinic & Grounds', 'Ms. Villar');

INSERT INTO reports (name, scope, format, generated) VALUES
  ('Monthly Safety Compliance Summary — July 2026', 'All modules', 'PDF', CURRENT_DATE);
