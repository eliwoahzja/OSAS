export const MOCK = {
  students: [
    { id: 'stu-01', name: 'Abella, Maria Clara', grade: 7, phone: '0917 555 1101' },
    { id: 'stu-05', name: 'Dela Cruz, Sofia Isabel', grade: 7, phone: '0917 555 1105' },
    { id: 'stu-09', name: 'Chua, Samantha Lian', grade: 8, phone: '0917 555 1203' },
    { id: 'stu-12', name: 'Reyes, Althea Jane', grade: 7, phone: '0917 555 1107' },
    { id: 'stu-18', name: 'Yap, Lorenzo Miguel', grade: 10, phone: '0917 555 1402' },
    { id: 'stu-23', name: 'Espino, Trisha Anne', grade: 12, phone: '0917 555 1601' },
  ],

  incidents: [
    { id: 'INC-001', date: '2026-07-15', time: '9:12 AM', type: 'medical', location: 'Gymnasium', description: 'Grade 7 student collapsed during basketball drills. Nurse administered glucose tab and cold compress; parent notified at 9:25 AM.', reporter: 'Ms. Rivera', severity: 'medium', status: 'resolved', student_id: null },
    { id: 'INC-003', date: '2026-07-29', time: '10:05 AM', type: 'fire-related', location: 'Science Wing — Lab 2', description: 'Burning smell from wall outlet near Prep station. power tripped before visible smoke. Meralco scheduled for same-day inspection.', reporter: 'Ms. Villar', severity: 'high', status: 'open', student_id: null },
    { id: 'INC-005', date: '2026-08-05', time: '11:20 AM', type: 'medical', location: 'Grade 8-B Classroom', description: 'Asthma attack during group presentation. Rescue inhaler administered by school nurse; student recovered within 15 minutes.', reporter: 'Nurse Dela Peña', severity: 'medium', status: 'resolved', student_id: 'stu-12' },
    { id: 'INC-008', date: '2026-08-11', time: '1:50 PM', type: 'slips/falls', location: 'Covered Court', description: 'Student slipped on wet tile near bleachers during lunch break. First aid applied; no fracture suspected.', reporter: 'Mr. Torres', severity: 'medium', status: 'resolved', student_id: null },

    { id: 'INC-101', date: '2023-02-10', time: '8:30 AM', type: 'medical', location: 'Clinic', description: 'Grade 9 student reported dizziness after skipping breakfast. Given fruit juice and rest in the clinic for one period.', reporter: 'Nurse Santos', severity: 'low', status: 'resolved', student_id: null },
    { id: 'INC-102', date: '2023-04-22', time: '10:15 AM', type: 'slips/falls', location: 'Main Hallway', description: 'Wet floor near water fountain caused two students to slip. Janitor placed warning sign; no injuries reported.', reporter: 'Mr. Bautista', severity: 'low', status: 'resolved', student_id: null },
    { id: 'INC-103', date: '2023-06-18', time: '2:00 PM', type: 'fire-related', location: 'Cafeteria Kitchen', description: 'Smoke alarm triggered by overheated cooking oil. Staff followed procedure; kitchen closed for the day.', reporter: 'Mrs. Garcia', severity: 'medium', status: 'resolved', student_id: null },
    { id: 'INC-104', date: '2023-09-05', time: '11:00 AM', type: 'security', location: 'Main Gate', description: 'Unregistered visitor attempted entry during dismissal. Guard intercepted; visitor claimed wrong school address.', reporter: 'Mr. Cruz', severity: 'high', status: 'resolved', student_id: null },
    { id: 'INC-105', date: '2023-11-12', time: '9:45 AM', type: 'medical', location: 'Basketball Court', description: 'Grade 11 student rolled ankle during PE basketball game. Ice pack applied; referred to orthopedic clinic.', reporter: 'Coach Ramos', severity: 'low', status: 'resolved', student_id: null },
    { id: 'INC-106', date: '2023-12-03', time: '1:30 PM', type: 'equipment failure', location: 'Science Lab', description: 'Bunsen burner gas valve stuck open after class. Maintenance shut off gas line; valve replaced same week.', reporter: 'Ms. Tan', severity: 'medium', status: 'resolved', student_id: null },

    { id: 'INC-111', date: '2024-01-15', time: '8:00 AM', type: 'medical', location: 'Grade 10-A Classroom', description: 'Student experienced seizure during morning class. Emergency protocol activated; ambulance arrived within 8 minutes.', reporter: 'Mr. Santos', severity: 'high', status: 'resolved', student_id: null },
    { id: 'INC-112', date: '2024-03-20', time: '10:30 AM', type: 'slips/falls', location: 'Main Staircase B', description: 'Grade 8 student fell three steps after rushing between floors. Bruised knee; parent picked up for clinic visit.', reporter: 'Ms. Lim', severity: 'medium', status: 'resolved', student_id: null },
    { id: 'INC-113', date: '2024-05-08', time: '12:00 PM', type: 'fire-related', location: 'Electrical Room', description: 'Overheating breaker panel detected by maintenance staff during routine check. Area cordoned; electrician replaced panel.', reporter: 'Mr. Navarro', severity: 'high', status: 'resolved', student_id: null },
    { id: 'INC-114', date: '2024-07-25', time: '9:00 AM', type: 'medical', location: 'Quadrangle', description: 'Three students showed signs of heat exhaustion during Flag Ceremony. Moved to air-conditioned clinic; hydrated and rested.', reporter: 'Nurse Dela Peña', severity: 'medium', status: 'resolved', student_id: null },
    { id: 'INC-115', date: '2024-09-10', time: '2:15 PM', type: 'security', location: 'Back Parking Lot', description: 'Chain-link fence cut near the delivery entrance. Maintenance patched temporarily; admin ordered replacement.', reporter: 'Mr. Cruz', severity: 'low', status: 'resolved', student_id: null },
    { id: 'INC-116', date: '2024-11-18', time: '11:45 AM', type: 'medical', location: 'Cafeteria', description: 'Grade 7 student broke out in hives after lunch. Antihistamine given; parent confirmed known food allergy.', reporter: 'Ms. Rivera', severity: 'medium', status: 'resolved', student_id: null },

    { id: 'INC-121', date: '2025-02-05', time: '8:45 AM', type: 'slips/falls', location: 'Covered Court', description: 'Rubber mat curled at the edge causing a Grade 10 student to trip. Mat taped down; similar mats inspected building-wide.', reporter: 'Mr. Torres', severity: 'low', status: 'resolved', student_id: null },
    { id: 'INC-122', date: '2025-04-12', time: '10:00 AM', type: 'fire-related', location: 'Science Wing — Prep Room', description: 'Strong chemical odor from improperly sealed reagent bottle. Room ventilated; MSDS review conducted with lab staff.', reporter: 'Ms. Villar', severity: 'high', status: 'resolved', student_id: null },
    { id: 'INC-123', date: '2025-06-20', time: '1:15 PM', type: 'medical', location: 'Gymnasium', description: 'Grade 12 student collapsed after basketball tournament. Dehydration suspected; IV fluids administered at the clinic.', reporter: 'Coach Ramos', severity: 'medium', status: 'resolved', student_id: null },
    { id: 'INC-124', date: '2025-08-30', time: '9:30 AM', type: 'security', location: 'Main Building Roof', description: 'Unauthorized drone spotted filming over the campus. Security escorted drone operator off property; admin filed a report.', reporter: 'Mr. Cruz', severity: 'low', status: 'resolved', student_id: null },
    { id: 'INC-125', date: '2025-10-15', time: '11:00 AM', type: 'medical', location: 'Grade 9-C Classroom', description: 'Student felt lightheaded during quiz. Moved to clinic; blood sugar normal. Likely skipped breakfast again.', reporter: 'Ms. Tan', severity: 'medium', status: 'resolved', student_id: null },
  ],

  inspections: [
    { id: 'INS-001', item: 'Fire extinguishers', area: 'Main Building', frequency: 'Monthly', last_inspected: '2026-07-25', status: 'passed', inspector: 'Mr. Dela Peña', notes: 'All 12 units charged and accessible. Two units due for hydrostatic test in October.', photo_url: null },
    { id: 'INS-003', item: 'First aid kits — classrooms', area: 'All Buildings', frequency: 'Quarterly', last_inspected: '2026-06-10', status: 'pending', inspector: 'Nurse Dela Peña', notes: 'Replenishment needed for Building C kits. Order submitted to supply office.', photo_url: null },
    { id: 'INS-004', item: 'Electrical panels & wiring', area: 'Science Wing', frequency: 'Semi-annual', last_inspected: '2026-01-30', status: 'overdue', inspector: 'Meralco Contractor', notes: 'Follow-up visit needed for panel replacement in Lab 2. Email sent to contractor.', photo_url: null },
  ],

  drills: [
    { id: 'DR-001', type: 'Fire', date: '2026-02-18', time: '9:00 AM', building: 'Main Building', person_in_charge: 'Mr. Lim', status: 'completed', notes: 'Full evacuation drill. 4 min 30 s to clear building. Two students exited via wrong route — re-briefing scheduled.' },
    { id: 'DR-002', type: 'Earthquake', date: '2026-03-20', time: '10:30 AM', building: 'Science Wing', person_in_charge: 'Ms. Villar', status: 'upcoming', notes: '' },
  ],

  supplies: [
    { id: 'SU-001', item: 'Adhesive bandages (assorted)', quantity: 12, unit: 'boxes', location: 'Clinic Cabinet A', expiry: '2027-06-30', reorder_threshold: 5, last_restocked: '2026-07-20' },
    { id: 'SU-002', item: 'Sterile gauze pads 4×4"', quantity: 3, unit: 'packs', location: 'Clinic Cabinet A', expiry: '2027-03-15', reorder_threshold: 5, last_restocked: '2026-05-18' },
    { id: 'SU-008', item: 'Instant cold packs', quantity: 2, unit: 'pcs', location: 'Emergency Bag', expiry: '2026-10-20', reorder_threshold: 4, last_restocked: '2026-02-10' },
  ],

  emergency_contacts: [
    { id: 'GC-1001', category: 'student', name: 'Marco Dela Cruz', relationship: 'Father', phone: '0917 555 2001', email: 'mdelacruz@gmail.com', priority: 1, student_id: 'stu-05' },
    { id: 'GC-1002', category: 'student', name: 'Ramon Reyes', relationship: 'Father', phone: '0917 555 2002', email: 'ramon.reyes@gmail.com', priority: 1, student_id: 'stu-12' },
    { id: 'SC-1', category: 'school', role: 'School Nurse', name: 'Ms. Corazon Dela Peña', phone: '0917 555 0001', email: 'nurse@saac.edu.ph', priority: null },
    { id: 'SC-3', category: 'school', role: 'Nearest Police Station', name: 'Caloocan City Police Station 1', phone: '(02) 8-364-1234', email: 'cpd1@ncrpo.pnp.gov.ph', priority: null },
  ],

  evacuation_plans: [
    { id: 'EP-01', building: 'Main Building', floor: 'Ground Floor', exits: 'Exit A (Front Lobby), Exit B (Rear), Exit C (East Wing)', routes: 'R1 via Front Lobby to Quadrangle Zone 1', assembly_point: 'Quadrangle — Zone 1', version: 'v2.1', updated: '2026-06-15', file_url: null, current: true },
    { id: 'EP-03', building: 'Science Wing', floor: 'All Floors', exits: 'Exit D (West Corridor), Exit E (Emergency Stairwell)', routes: 'R4 via West Exit to Covered Court Zone 2', assembly_point: 'Covered Court — Zone 2', version: 'v1.4', updated: '2026-05-02', file_url: null, current: true },
  ],

  risks: [
    { id: 'RS-001', hazard: 'Aging electrical wiring in Science Wing Lab 2', likelihood: 'High', impact: 'High', risk_level: 'Critical', mitigation: 'Immediate panel inspection completed; full rewiring scheduled for December 2026 break.', owner: 'Mr. Dela Peña', review_date: '2026-08-15' },
    { id: 'RS-004', hazard: 'Unauthorized entry via rear delivery gate', likelihood: 'Medium', impact: 'Medium', risk_level: 'Medium', mitigation: 'Strict visitor log enforced; CCTV camera installed at delivery entrance.', owner: 'Mr. Cruz', review_date: '2026-08-25' },
  ],

  notifications: [],

  emergency_roles: [
    { id: 'RL-001', role: 'Fire Warden', staff: 'Mr. Dela Peña', zone: 'Main Building — Floors 1–2', backup: 'Mr. Lim' },
    { id: 'RL-003', role: 'First Aider', staff: 'Nurse Dela Peña', zone: 'Clinic & Grounds', backup: 'Ms. Villar' },
  ],

  reports: [
    { id: 'RP-001', name: 'Monthly Safety Compliance Summary — July 2026', generated: '2026-08-01', format: 'PDF', scope: 'All modules' },
  ],
};

const ID_PREFIX = {
  incidents: 'INC', inspections: 'INS', drills: 'DR', supplies: 'SU',
  emergency_contacts: 'GC', evacuation_plans: 'EP', risks: 'RS',
  notifications: 'NT', emergency_roles: 'RL', reports: 'RP',
};

export function mockNextId(table) {
  const prefix = ID_PREFIX[table] || 'ID';
  return `${prefix}-${Date.now()}`;
}
