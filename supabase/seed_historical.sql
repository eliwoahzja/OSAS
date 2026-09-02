-- Historical incidents for the year-over-year comparison chart
INSERT INTO incidents (date, time, type, location, description, reporter, severity, status, student_id) VALUES
  -- 2023 incidents
  ('2023-09-15', '8:45 AM', 'medical', 'Classroom 7-A', 'Student experienced an asthma attack during morning assembly. Inhaler administered, parent notified.', 'Ms. Santos', 'medium', 'resolved', '11111111-1111-4111-8111-111111111111'),
  ('2023-11-20', '11:30 AM', 'slips/falls', 'Main Building Staircase', 'Grade 10 student slipped on wet stairs after rain. Minor bruising, ice pack applied.', 'Mr. Lim', 'low', 'resolved', '22222222-2222-4222-8222-222222222222'),
  ('2024-01-10', '2:15 PM', 'fire-related', 'Canteen Kitchen', 'Small grease fire from deep fryer. Staff extinguished with fire blanket. No injuries.', 'Mr. Cruz', 'high', 'resolved', NULL),
  ('2024-03-05', '9:00 AM', 'security', 'Main Gate', 'Unauthorized individual attempted to enter campus during class hours. Security apprehended and turned over to barangay.', 'Security Office', 'high', 'resolved', NULL),
  ('2024-05-18', '10:30 AM', 'equipment failure', 'Computer Lab', 'Short circuit in power strip caused minor spark. No fire, but equipment damaged. Electrician called.', 'Ms. Reyes', 'medium', 'resolved', NULL),
  ('2024-07-22', '1:00 PM', 'medical', 'Clinic', 'Student allergic reaction to cafeteria food. Antihistamine administered, parent picked up student.', 'School Nurse', 'medium', 'resolved', '33333333-3333-4333-8333-333333333333'),
  -- 2025 incidents
  ('2025-02-14', '8:30 AM', 'medical', 'Gymnasium', 'Student fainted during PE class due to dehydration. Given fluids, recovered in 20 minutes.', 'PE Teacher', 'low', 'resolved', NULL),
  ('2025-04-28', '3:45 PM', 'slips/falls', 'Science Wing Hallway', 'Teacher slipped on spilled liquid near lab entrance. Sprained ankle, taken to clinic.', 'Ms. Villar', 'medium', 'resolved', NULL),
  ('2025-06-10', '11:00 AM', 'fire-related', 'Electrical Room', 'Tripped circuit breaker caused power outage in east wing. Maintenance reset and inspected.', 'Mr. Dela Peña', 'low', 'resolved', NULL),
  ('2025-09-03', '10:15 AM', 'security', 'Parking Area', 'Attempted theft of bicycle reported by Grade 11 student. CCTV footage reviewed.', 'Security Office', 'medium', 'resolved', NULL),
  ('2025-11-20', '1:30 PM', 'equipment failure', 'Science Wing Lab 1', 'Broken gas valve on Bunsen burner detected during pre-lab check. Lab sealed for repair.', 'Mr. Dela Peña', 'high', 'resolved', NULL)
ON CONFLICT DO NOTHING;
