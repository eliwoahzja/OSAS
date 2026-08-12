// Mock data for the OSAS (Office of Student Affairs and Services) dashboard.
// These values are placeholders until the backend + database are connected.

export const currentDate = 'Friday, July 24, 2026';
export const currentTime = '1:40 PM';
export const todayLabel = 'Jul 24, 2026';
export const topbarWeather = 'Mostly cloudy · 29°C';

export const sidebarMenu = [
  { id: 'dashboard', label: 'Dashboard', icon: 'border-all' },
  { id: 'emergency', label: 'Emergency Contacts', icon: 'phone' },
  { id: 'drills', label: 'Drill Scheduling', icon: 'person-running' },
  { id: 'evacuation', label: 'Evacuation Map & Plans', icon: 'map' },
  { id: 'incidents', label: 'Incident Logging', icon: 'report' },
  { id: 'inspections', label: 'Safety Inspections', icon: 'fact_check' },
  { id: 'risk', label: 'Risk Assessment', icon: 'security' },
  { id: 'notifications', label: 'Parent Notifications', icon: 'notifications' },
  { id: 'safety-reports', label: 'Safety Reports', icon: 'assessment' },
  { id: 'emergency-roles', label: 'Emergency Roles', icon: 'groups' },
  { id: 'supplies', label: 'First Aid Supplies', icon: 'medical_services' },
];

// ==========================================================================
// OSAS safety modules — mock records. Each module's KPI card and dashboard
// chart reads from these same arrays, so counts stay consistent.
// ==========================================================================

// 1. Emergency Contact Database — per-student guardians + school-wide responders
const STUDENT_GUARDIAN_ROWS = [
  ['Abella', 'Luzviminda', 'Mother'], ['Aguilar', 'Ramon', 'Father'],
  ['Bautista', 'Cristina', 'Mother'], ['Castillo', 'Edgar', 'Father'],
  ['Dela Cruz', 'Marites', 'Guardian'], ['Domingo', 'Fernando', 'Father'],
  ['Fernandez', 'Gloria', 'Mother'], ['Garcia', 'Nestor', 'Father'],
  ['Hernandez', 'Rowena', 'Mother'], ['Lopez', 'Antonio', 'Father'],
  ['Mendoza', 'Liza', 'Mother'], ['Navarro', 'Ricardo', 'Father'],
  ['Ocampo', 'Teresita', 'Guardian'], ['Pascual', 'Miguel', 'Father'],
  ['Quinto', 'Analyn', 'Mother'], ['Ramos', 'Benjamin', 'Father'],
  ['Reyes', 'Cecilia', 'Mother'], ['Salazar', 'Dante', 'Father'],
  ['Torres', 'Elena', 'Mother'], ['Villanueva', 'Gregorio', 'Father'],
  ['Yap', 'Hazel', 'Mother'], ['Zamora', 'Irene', 'Guardian'],
  ['Alvarez', 'Jose', 'Father'], ['Beltran', 'Karen', 'Mother'],
  ['Chua', 'Lorenzo', 'Father'], ['De Guzman', 'Marietta', 'Mother'],
  ['Espino', 'Nicanor', 'Father'], ['Flores', 'Odessa', 'Mother'],
  ['Gonzales', 'Paolo', 'Father'], ['Ignacio', 'Quennie', 'Mother'],
  ['Jimenez', 'Roberto', 'Father'], ['Lacson', 'Sandra', 'Mother'],
  ['Manalo', 'Tomas', 'Father'], ['Nolasco', 'Ursula', 'Guardian'],
  ['Ong', 'Victor', 'Father'], ['Pineda', 'Winnie', 'Mother'],
  ['Rosales', 'Xander', 'Father'], ['Soriano', 'Yolanda', 'Mother'],
  ['Tan', 'Zandro', 'Father'],
];

export const studentGuardians = STUDENT_GUARDIAN_ROWS.map(([last, first, relationship], i) => ({
  id: `GC-${1001 + i}`,
  name: `${first} ${last}`,
  relationship,
  phone: `0917 555 ${String(2000 + i * 17).padStart(4, '0')}`,
  email: `${first.toLowerCase()}${last.toLowerCase().replace(/[^a-z]/g, '')}@gmail.com`,
  priority: (i % 3) + 1,
}));

export const schoolContacts = [
  { id: 'SC-1', role: 'School Nurse', name: 'Ms. Corazon Dela Peña', phone: '0917 555 0001', email: 'nurse@saac.edu.ph' },
  { id: 'SC-2', role: 'Security Head', name: 'Mr. Reynaldo Cruz', phone: '0917 555 0002', email: 'security@saac.edu.ph' },
  { id: 'SC-3', role: 'Nearest Police Station', name: 'Caloocan City Police Station 1', phone: '(02) 8-364-1234', email: 'cpd1@ncrpo.pnp.gov.ph' },
  { id: 'SC-4', role: 'Nearest Fire Station', name: 'Caloocan Fire Station (BFP)', phone: '911 / (02) 8-364-9111', email: 'bfp.caloocan@bfp.gov.ph' },
  { id: 'SC-5', role: 'Nearest Hospital', name: 'Caloocan Medical Center', phone: '(02) 8-961-3000', email: 'info@caloocanmed.ph' },
  { id: 'SC-6', role: 'Barangay Emergency Response', name: 'Barangay 71 Emergency Team', phone: '0917 555 0006', email: 'barangay71@saac.edu.ph' },
];

// 2. Drill Scheduling
const DRILL_TYPES = {
  fire: 'Fire',
  earthquake: 'Earthquake',
  lockdown: 'Lockdown',
  evacuation: 'Evacuation',
};

export const drills = [
  { id: 'DR-001', type: DRILL_TYPES.fire, date: '2026-02-18', time: '9:00 AM', building: 'Main Building', personInCharge: 'Mr. Lim', status: 'completed', notes: 'Evacuated 1,204 students in 4 min 30 s; all accounted for.' },
  { id: 'DR-002', type: DRILL_TYPES.earthquake, date: '2026-03-20', time: '10:30 AM', building: 'Science Wing', personInCharge: 'Ms. Villar', status: 'upcoming', notes: '' },
  { id: 'DR-003', type: DRILL_TYPES.lockdown, date: '2026-04-02', time: '2:00 PM', building: 'Admin Building', personInCharge: 'Mr. Santos', status: 'upcoming', notes: '' },
  { id: 'DR-004', type: DRILL_TYPES.evacuation, date: '2026-05-15', time: '8:45 AM', building: 'Gymnasium', personInCharge: 'Ms. Rivera', status: 'completed', notes: 'Assembly-point drill for PE classes; all sections reported in.' },
  { id: 'DR-005', type: DRILL_TYPES.fire, date: '2026-05-28', time: '11:00 AM', building: 'Main Building', personInCharge: 'Mr. Dela Peña', status: 'cancelled', notes: 'Cancelled due to heavy rain flooding the evacuation area.' },
];

// 3. Evacuation Map & Plans
const EXITS = {
  main1: 'Exit A (Front), Exit B (North), Exit C (Southeast)',
  main2: 'Exit B (North stairs), Exit C (Southeast stairs)',
  science: 'Exit D (West), Exit E (East ramp)',
  gym: 'Exit F (Main doors), Exit G (Rear service door)',
};

const ROUTES = {
  main1: 'R1 via Front Lobby · R2 via North Corridor · R3 via Cafeteria',
  main2: 'R2 via North Stairwell · R3 via Southeast Stairwell',
  science: 'R4 via West Exit · R5 via East Ramp',
  gym: 'R6 via Main Doors · R7 via Rear Service',
};

export const evacuationPlans = [
  { id: 'EP-01', building: 'Main Building', floor: 'Ground Floor', exits: EXITS.main1, routes: ROUTES.main1, assemblyPoint: 'Quadrangle — Zone 1', version: 'v2.1', updated: '2026-06-15' },
  { id: 'EP-02', building: 'Main Building', floor: '2nd Floor', exits: EXITS.main2, routes: ROUTES.main2, assemblyPoint: 'Quadrangle — Zone 1', version: 'v2.1', updated: '2026-06-15' },
  { id: 'EP-03', building: 'Science Wing', floor: 'All Floors', exits: EXITS.science, routes: ROUTES.science, assemblyPoint: 'Covered Court — Zone 2', version: 'v1.4', updated: '2026-05-02' },
  { id: 'EP-04', building: 'Gymnasium', floor: 'Ground Floor', exits: EXITS.gym, routes: ROUTES.gym, assemblyPoint: 'Open Field — Zone 3', version: 'v1.2', updated: '2026-04-21' },
];

// 4. Incident Logging
const INCIDENT_TYPES = {
  medical: 'medical',
  slips: 'slips/falls',
  fire: 'fire-related',
  security: 'security',
  equipment: 'equipment failure',
};

export const incidents = [
  { id: 'INC-001', date: '2026-07-15', time: '9:12 AM', type: INCIDENT_TYPES.medical, location: 'Gymnasium', description: 'Student fainted during PE warm-up; dizziness and rapid breathing.', reporter: 'Ms. Rivera', severity: 'medium', status: 'resolved' },
  { id: 'INC-002', date: '2026-07-22', time: '3:40 PM', type: INCIDENT_TYPES.slips, location: 'Main Building — 2F Hallway', description: 'Wet floor near the drinking fountain; Grade 7 student slipped.', reporter: 'Mr. Santos', severity: 'low', status: 'resolved' },
  { id: 'INC-003', date: '2026-07-29', time: '10:05 AM', type: INCIDENT_TYPES.fire, location: 'Science Wing — Lab 2', description: 'Smoke from an electrical outlet; power to the lab cut off.', reporter: 'Ms. Villar', severity: 'high', status: 'open' },
  { id: 'INC-004', date: '2026-08-01', time: '7:55 AM', type: INCIDENT_TYPES.security, location: 'Main Gate', description: 'Unauthorized visitor attempted entry without a visitor pass.', reporter: 'Security — Mr. Cruz', severity: 'medium', status: 'resolved' },
  { id: 'INC-005', date: '2026-08-05', time: '11:20 AM', type: INCIDENT_TYPES.medical, location: 'Grade 8-B Classroom', description: 'Student with an asthma attack; nebulizer administered in the clinic.', reporter: 'Nurse — Ms. Dela Peña', severity: 'medium', status: 'resolved' },
  { id: 'INC-006', date: '2026-08-08', time: '2:15 PM', type: INCIDENT_TYPES.security, location: '2F Restroom', description: 'Graffiti found on a restroom wall; CCTV review in progress.', reporter: 'Janitorial Staff', severity: 'low', status: 'open' },
  { id: 'INC-007', date: '2026-08-10', time: '8:30 AM', type: INCIDENT_TYPES.equipment, location: 'Library', description: 'Air-conditioning unit leaking water onto the bookshelves.', reporter: 'Librarian', severity: 'low', status: 'open' },
  { id: 'INC-008', date: '2026-08-11', time: '1:50 PM', type: INCIDENT_TYPES.slips, location: 'Covered Court', description: 'Student tripped over a loose floor tile during recess.', reporter: 'PE Instructor', severity: 'medium', status: 'resolved' },
];

// 5. Safety Inspection Checklist
const INSPECTION_STATUS = { passed: 'passed', pending: 'pending', overdue: 'overdue' };

export const inspections = [
  { id: 'INS-001', item: 'Fire extinguishers', area: 'Main Building', frequency: 'Monthly', lastInspected: '2026-07-25', status: INSPECTION_STATUS.passed, inspector: 'Mr. Dela Peña', notes: 'All 24 units charged and within expiry.' },
  { id: 'INS-002', item: 'Emergency exits & signage', area: 'Main Building', frequency: 'Monthly', lastInspected: '2026-07-25', status: INSPECTION_STATUS.passed, inspector: 'Mr. Dela Peña', notes: 'Exit lights operational.' },
  { id: 'INS-003', item: 'First aid kits — classrooms', area: 'All Buildings', frequency: 'Quarterly', lastInspected: '2026-06-10', status: INSPECTION_STATUS.pending, inspector: 'Nurse — Ms. Dela Peña', notes: 'Replenishment scheduled.' },
  { id: 'INS-004', item: 'Electrical panels & wiring', area: 'Science Wing', frequency: 'Semi-annual', lastInspected: '2026-01-30', status: INSPECTION_STATUS.overdue, inspector: 'External Electrician', notes: 'Follow-up needed after the July smoke incident.' },
  { id: 'INS-005', item: 'Playground equipment', area: 'Elementary Yard', frequency: 'Monthly', lastInspected: '2026-07-28', status: INSPECTION_STATUS.passed, inspector: 'Facilities Staff', notes: 'Loose bolt on the swing replaced.' },
  { id: 'INS-006', item: 'Emergency lighting', area: 'Main Building', frequency: 'Quarterly', lastInspected: '2026-06-18', status: INSPECTION_STATUS.passed, inspector: 'Mr. Dela Peña', notes: '' },
  { id: 'INS-007', item: 'Fire alarm system test', area: 'All Buildings', frequency: 'Monthly', lastInspected: '2026-08-01', status: INSPECTION_STATUS.passed, inspector: 'Building Admin', notes: 'Alarm audible on all floors.' },
  { id: 'INS-008', item: 'Stairwell handrails & anti-slip', area: 'Main Building', frequency: 'Quarterly', lastInspected: '2026-07-12', status: INSPECTION_STATUS.passed, inspector: 'Facilities Staff', notes: '' },
  { id: 'INS-009', item: 'Water supply & drinking fountains', area: 'All Buildings', frequency: 'Monthly', lastInspected: '2026-07-30', status: INSPECTION_STATUS.passed, inspector: 'Maintenance', notes: '' },
  { id: 'INS-010', item: 'Fire exit routes clear of obstruction', area: 'All Buildings', frequency: 'Weekly', lastInspected: '2026-08-11', status: INSPECTION_STATUS.passed, inspector: 'Security — Mr. Cruz', notes: '' },
  { id: 'INS-011', item: 'CCTV system coverage', area: 'Main Building & Gates', frequency: 'Monthly', lastInspected: '2026-07-20', status: INSPECTION_STATUS.pending, inspector: 'IT Staff', notes: 'Camera 7 angle needs adjustment.' },
  { id: 'INS-012', item: 'Chemical storage — science labs', area: 'Science Wing', frequency: 'Semi-annual', lastInspected: '2026-02-14', status: INSPECTION_STATUS.passed, inspector: 'Ms. Villar', notes: '' },
];

// 6. Risk Assessment
const LIKELIHOOD = { low: 'Low', medium: 'Medium', high: 'High' };
const IMPACT = { low: 'Low', medium: 'Medium', high: 'High' };
const RISK_LEVELS = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' };

export const risks = [
  { id: 'RS-001', hazard: 'Electrical wiring in Science Wing Lab 2', likelihood: LIKELIHOOD.high, impact: IMPACT.high, riskLevel: RISK_LEVELS.critical, mitigation: 'Immediate panel inspection; isolate the outlet; schedule rewiring.', owner: 'Mr. Dela Peña', reviewDate: '2026-08-15' },
  { id: 'RS-002', hazard: 'Unsecured chemicals in science storage', likelihood: LIKELIHOOD.medium, impact: IMPACT.high, riskLevel: RISK_LEVELS.high, mitigation: 'Locked cabinets, inventory log, and staff training.', owner: 'Ms. Villar', reviewDate: '2026-08-30' },
  { id: 'RS-003', hazard: 'Wet floors during rainy season', likelihood: LIKELIHOOD.high, impact: IMPACT.low, riskLevel: RISK_LEVELS.medium, mitigation: 'Anti-slip mats at entrances, signage, mopping schedule.', owner: 'Facilities Staff', reviewDate: '2026-08-20' },
  { id: 'RS-004', hazard: 'Unauthorized entry at the main gate', likelihood: LIKELIHOOD.medium, impact: IMPACT.medium, riskLevel: RISK_LEVELS.medium, mitigation: 'Strict visitor log, ID checks, and CCTV monitoring.', owner: 'Mr. Cruz', reviewDate: '2026-08-25' },
  { id: 'RS-005', hazard: 'Earthquake structural risk — gym roof', likelihood: LIKELIHOOD.low, impact: IMPACT.high, riskLevel: RISK_LEVELS.medium, mitigation: 'Annual structural inspection; adjust evacuation routing.', owner: 'Building Admin', reviewDate: '2026-09-10' },
  { id: 'RS-006', hazard: 'Overcrowding at cafeteria exits', likelihood: LIKELIHOOD.medium, impact: IMPACT.medium, riskLevel: RISK_LEVELS.medium, mitigation: 'Staggered lunch breaks and exit marshals.', owner: 'Student Affairs', reviewDate: '2026-08-18' },
];

// 7. Parent Notifications
const NOTIFICATION_TYPES = { drill: 'drill notice', incident: 'incident alert', closure: 'closure', reminder: 'reminder' };
const DELIVERY_STATUS = { sent: 'sent', delivered: 'delivered', read: 'read' };

export const notifications = [
  { id: 'NT-001', type: NOTIFICATION_TYPES.drill, audience: 'Parents of Grades 7–8', content: 'Earthquake drill on March 20, 10:30 AM. Students will practice duck-cover-hold and evacuate to assembly areas.', sent: '2026-03-16', delivery: DELIVERY_STATUS.delivered },
  { id: 'NT-002', type: NOTIFICATION_TYPES.incident, audience: 'School Community', content: 'Smoke detected in Science Wing Lab 2. The area was isolated and classes relocated. Investigation ongoing.', sent: '2026-07-29', delivery: DELIVERY_STATUS.delivered },
  { id: 'NT-003', type: NOTIFICATION_TYPES.closure, audience: 'All Parents', content: 'Classes suspended on August 14 due to Typhoon Signal No. 2. School premises closed until further notice.', sent: '2026-08-13', delivery: DELIVERY_STATUS.read },
  { id: 'NT-004', type: NOTIFICATION_TYPES.drill, audience: 'Parents of Grade 7', content: 'Fire drill rescheduled to May 15, 8:45 AM. Please have students wear rubber-soled shoes.', sent: '2026-05-12', delivery: DELIVERY_STATUS.delivered },
  { id: 'NT-005', type: NOTIFICATION_TYPES.reminder, audience: 'Faculty & Staff', content: 'Update your emergency contact details in the OSAS portal by Friday.', sent: '2026-08-10', delivery: DELIVERY_STATUS.sent },
  { id: 'NT-006', type: NOTIFICATION_TYPES.incident, audience: 'Parents of Grade 8-B', content: 'A student was attended to for an asthma episode. The student is stable and has returned to class.', sent: '2026-08-05', delivery: DELIVERY_STATUS.read },
];

// 8. Compliance Reports — generated-report history
const REPORT_FORMATS = { pdf: 'PDF', excel: 'Excel' };

export const generatedReports = [
  { id: 'RP-001', name: 'Monthly Safety Compliance Summary — July 2026', generated: '2026-08-01', format: REPORT_FORMATS.pdf, scope: 'All modules' },
  { id: 'RP-002', name: 'Inspection Checklist Report — Q2 2026', generated: '2026-07-05', format: REPORT_FORMATS.excel, scope: 'Safety Inspections' },
  { id: 'RP-003', name: 'Incident Log Export — July 2026', generated: '2026-08-01', format: REPORT_FORMATS.excel, scope: 'Incident Logging' },
];

// 9. Emergency Role Assignment
const ROLES = {
  warden: 'Fire Warden',
  marshal: 'Evacuation Marshal',
  firstAider: 'First Aider',
  liaison: 'Security Liaison',
  floorWarden: 'Floor Warden',
  medical: 'Medical Response',
};

export const emergencyRoles = [
  { id: 'RL-001', role: ROLES.warden, staff: 'Mr. Dela Peña', zone: 'Main Building — Floors 1–2', backup: 'Mr. Lim' },
  { id: 'RL-002', role: ROLES.marshal, staff: 'Ms. Rivera', zone: 'Quadrangle Assembly — Zone 1', backup: 'Mr. Santos' },
  { id: 'RL-003', role: ROLES.firstAider, staff: 'Nurse — Ms. Dela Peña', zone: 'Clinic & Grounds', backup: 'Ms. Villar' },
  { id: 'RL-004', role: ROLES.warden, staff: 'Ms. Villar', zone: 'Science Wing', backup: 'Librarian' },
  { id: 'RL-005', role: ROLES.marshal, staff: 'Mr. Lim', zone: 'Covered Court — Zone 2', backup: 'PE Instructor' },
  { id: 'RL-006', role: ROLES.liaison, staff: 'Mr. Cruz', zone: 'Main Gate & Perimeter', backup: 'Janitorial Head' },
];

// 10. First Aid Supplies Monitor
const SUPPLY_UNITS = { box: 'boxes', pack: 'packs', bottle: 'bottles', blister: 'blisters', piece: 'pcs' };

export const supplies = [
  { id: 'SU-001', item: 'Adhesive bandages', quantity: 12, unit: SUPPLY_UNITS.box, location: 'Clinic Cabinet A', expiry: '2027-06-30', reorderThreshold: 5, lastRestocked: '2026-07-20' },
  { id: 'SU-002', item: 'Sterile gauze pads (4x4)', quantity: 3, unit: SUPPLY_UNITS.pack, location: 'Clinic Cabinet A', expiry: '2027-03-15', reorderThreshold: 5, lastRestocked: '2026-05-18' },
  { id: 'SU-003', item: 'Antiseptic solution (250 mL)', quantity: 6, unit: SUPPLY_UNITS.bottle, location: 'Clinic Cabinet B', expiry: '2026-12-01', reorderThreshold: 4, lastRestocked: '2026-06-02' },
  { id: 'SU-004', item: 'Paracetamol (blister)', quantity: 40, unit: SUPPLY_UNITS.blister, location: 'Clinic Cabinet B', expiry: '2027-01-10', reorderThreshold: 20, lastRestocked: '2026-07-11' },
  { id: 'SU-005', item: 'Disposable gloves', quantity: 5, unit: SUPPLY_UNITS.box, location: 'Clinic Cabinet A', expiry: '2027-08-01', reorderThreshold: 3, lastRestocked: '2026-04-25' },
  { id: 'SU-006', item: 'CPR face masks', quantity: 8, unit: SUPPLY_UNITS.piece, location: 'Emergency Bag — Main Office', expiry: '2026-11-30', reorderThreshold: 6, lastRestocked: '2026-03-08' },
  { id: 'SU-007', item: 'Splint boards', quantity: 6, unit: SUPPLY_UNITS.piece, location: 'Clinic Storage', expiry: 'N/A', reorderThreshold: 2, lastRestocked: '2026-01-15' },
  { id: 'SU-008', item: 'Instant cold packs', quantity: 2, unit: SUPPLY_UNITS.piece, location: 'Emergency Bag — Main Office', expiry: '2026-10-20', reorderThreshold: 4, lastRestocked: '2026-02-10' },
];

// ==========================================================================
// Computed dashboard figures — KPI cards and charts read from the arrays above.
// ==========================================================================

const countBy = (arr, pred) => arr.filter(pred).length;

const passedInspections = countBy(inspections, (i) => i.status === 'passed');
const overdueInspections = countBy(inspections, (i) => i.status === 'overdue');
export const complianceScore = Math.round(
  (passedInspections / Math.max(1, passedInspections + overdueInspections)) * 100
);

export const stats = [
  {
    key: 'incidents',
    label: 'Total Incidents',
    hint: 'Reported safety\nincidents',
    value: String(incidents.length),
    color: 'pink',
    icon: 'warning',
  },
  {
    key: 'inspections',
    label: 'Pending Inspections',
    hint: 'Scheduled safety\nchecks',
    value: String(countBy(inspections, (i) => i.status === 'pending')),
    color: 'blue',
    icon: 'checklist',
  },
  {
    key: 'drills',
    label: 'Active Drills',
    hint: 'Ongoing evacuation\nexercises',
    value: String(countBy(drills, (d) => d.status === 'upcoming')),
    color: 'emerald',
    icon: 'emergency',
  },
  {
    key: 'supplies',
    label: 'Low Supplies',
    hint: 'First aid items\nneeding restock',
    value: String(countBy(supplies, (s) => s.quantity <= s.reorderThreshold)),
    color: 'amber',
    icon: 'medical_services',
  },
  {
    key: 'contacts',
    label: 'Emergency Contacts',
    hint: 'Verified responder\nprofiles',
    value: String(studentGuardians.length + schoolContacts.length),
    color: 'red',
    icon: 'contacts',
  },
  {
    key: 'compliance',
    label: 'Compliance Score',
    hint: 'Overall safety\nrating',
    value: `${complianceScore}%`,
    color: 'purple',
    icon: 'verified_user',
  },
];

// Dashboard donut charts
const INCIDENT_TYPE_COLORS = {
  medical: '#f43f5e',
  'slips/falls': '#f59e0b',
  'fire-related': '#ef4444',
  security: '#3b82f6',
  'equipment failure': '#8b5cf6',
};

const titleCase = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());

export const incidentTypeBreakdown = Object.entries(
  incidents.reduce((acc, inc) => {
    acc[inc.type] = (acc[inc.type] || 0) + 1;
    return acc;
  }, {})
)
  .map(([type, value]) => ({
    label: titleCase(type),
    value,
    color: INCIDENT_TYPE_COLORS[type] || '#94a3b8',
  }))
  .sort((a, b) => b.value - a.value);

export const inspectionStatusBreakdown = [
  { label: 'Passed', value: countBy(inspections, (i) => i.status === 'passed'), color: '#10b981' },
  { label: 'Pending', value: countBy(inspections, (i) => i.status === 'pending'), color: '#f59e0b' },
  { label: 'Overdue', value: countBy(inspections, (i) => i.status === 'overdue'), color: '#ef4444' },
];

// Shared date formatter for module tables
export const formatDate = (iso) => {
  if (!iso || iso === 'N/A') return iso || '—';
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const weeklyTrend = [
  { day: 'Mon', present: 1048 },
  { day: 'Tue', present: 1102 },
  { day: 'Wed', present: 1130 },
  { day: 'Thu', present: 1096 },
  { day: 'Fri', present: 1104 },
];

export const todayDistribution = [
  { label: 'Present', value: 1104, color: '#10b981' },
  { label: 'Late', value: 38, color: '#f59e0b' },
  { label: 'Absent', value: 87, color: '#ef4444' },
  { label: 'Excused', value: 19, color: '#0ea5e9' },
];

// ---- Attendance Monitoring view ------------------------------------------
// Sections (class rosters) used by the attendance module. Placeholder data
// until the backend + database are connected.

export const attendanceSections = [
  {
    id: 'gr7-a',
    name: 'Grade 7 – Section A',
    grade: 7,
    adviser: 'Ms. Rivera',
    time: '7:30 AM – 8:30 AM',
    roster: [
      { id: '1', name: 'Abella, Maria Clara', lrn: '136547890001', status: 'present' },
      { id: '2', name: 'Aguilar, Jose Miguel', lrn: '136547890002', status: 'present' },
      { id: '3', name: 'Bautista, Andrea Nicole', lrn: '136547890003', status: 'late' },
      { id: '4', name: 'Castillo, Luis Gabriel', lrn: '136547890004', status: 'present' },
      { id: '5', name: 'Dela Cruz, Sofia Isabel', lrn: '136547890005', status: 'absent' },
      { id: '6', name: 'Domingo, Rafael Angelo', lrn: '136547890006', status: 'present' },
      { id: '7', name: 'Fernandez, Camille Anne', lrn: '136547890007', status: 'excused' },
      { id: '8', name: 'Garcia, Nathan Paul', lrn: '136547890008', status: 'present' },
      { id: '9', name: 'Hernandez, Bianca Ysabel', lrn: '136547890009', status: 'late' },
      { id: '10', name: 'Lopez, Matthew James', lrn: '136547890010', status: 'present' },
      { id: '11', name: 'Mendoza, Kyla Marie', lrn: '136547890011', status: 'present' },
      { id: '12', name: 'Navarro, Ethan Carl', lrn: '136547890012', status: 'absent' },
    ],
  },
  {
    id: 'gr7-b',
    name: 'Grade 7 – Section B',
    grade: 7,
    adviser: 'Mr. Santos',
    time: '8:30 AM – 9:30 AM',
    roster: [
      { id: '1', name: 'Ocampo, Hannah Grace', lrn: '136547890013', status: 'present' },
      { id: '2', name: 'Pascual, Adrian Vincent', lrn: '136547890014', status: 'present' },
      { id: '3', name: 'Quinto, Lianne Bea', lrn: '136547890015', status: 'late' },
      { id: '4', name: 'Ramos, Joshua Daniel', lrn: '136547890016', status: 'present' },
      { id: '5', name: 'Reyes, Althea Jane', lrn: '136547890017', status: 'excused' },
      { id: '6', name: 'Salazar, Marco Luis', lrn: '136547890018', status: 'present' },
      { id: '7', name: 'Torres, Alyssa Mae', lrn: '136547890019', status: 'present' },
      { id: '8', name: 'Villanueva, Kristine Joy', lrn: '136547890020', status: 'absent' },
      { id: '9', name: 'Yap, Lorenzo Miguel', lrn: '136547890021', status: 'present' },
      { id: '10', name: 'Zamora, Chloe Anne', lrn: '136547890022', status: 'present' },
    ],
  },
  {
    id: 'gr8-a',
    name: 'Grade 8 – Section A',
    grade: 8,
    adviser: 'Ms. Villar',
    time: '9:30 AM – 10:30 AM',
    roster: [
      { id: '1', name: 'Alvarez, Patricia Denise', lrn: '136547890023', status: 'present' },
      { id: '2', name: 'Beltran, Francis Rafael', lrn: '136547890024', status: 'present' },
      { id: '3', name: 'Chua, Samantha Lian', lrn: '136547890025', status: 'late' },
      { id: '4', name: 'De Guzman, Paolo Vincent', lrn: '136547890026', status: 'present' },
      { id: '5', name: 'Espino, Trisha Anne', lrn: '136547890027', status: 'present' },
      { id: '6', name: 'Flores, Carlo Andrei', lrn: '136547890028', status: 'absent' },
      { id: '7', name: 'Gonzales, Erika Nicole', lrn: '136547890029', status: 'present' },
      { id: '8', name: 'Ignacio, Andres Miguel', lrn: '136547890030', status: 'excused' },
    ],
  },
  {
    id: 'gr8-b',
    name: 'Grade 8 – Section B',
    grade: 8,
    adviser: 'Mr. Lim',
    time: '10:30 AM – 11:30 AM',
    roster: [
      { id: '1', name: 'Jimenez, Danica Rose', lrn: '136547890031', status: 'present' },
      { id: '2', name: 'Lacson, Troy Matthew', lrn: '136547890032', status: 'present' },
      { id: '3', name: 'Manalo, Bianca Alexis', lrn: '136547890033', status: 'late' },
      { id: '4', name: 'Nolasco, Kenneth Ray', lrn: '136547890034', status: 'present' },
      { id: '5', name: 'Ong, Francine Claire', lrn: '136547890035', status: 'absent' },
      { id: '6', name: 'Pineda, Rafael Joaquin', lrn: '136547890036', status: 'present' },
      { id: '7', name: 'Rosales, Nina Andrea', lrn: '136547890037', status: 'present' },
      { id: '8', name: 'Soriano, Keanu Lewis', lrn: '136547890038', status: 'present' },
    ],
  },
];

// ---- User Management view -------------------------------------------------

export const students = [
  { id: 'S-1001', name: 'Abella, Maria Clara', lrn: '136547890001', section: 'Grade 7 – A', status: 'active', joined: 'Jun 2025' },
  { id: 'S-1002', name: 'Aguilar, Jose Miguel', lrn: '136547890002', section: 'Grade 7 – A', status: 'active', joined: 'Jun 2025' },
  { id: 'S-1003', name: 'Bautista, Andrea Nicole', lrn: '136547890003', section: 'Grade 7 – A', status: 'active', joined: 'Jun 2025' },
  { id: 'S-1004', name: 'Castillo, Luis Gabriel', lrn: '136547890004', section: 'Grade 7 – A', status: 'active', joined: 'Jun 2025' },
  { id: 'S-1005', name: 'Dela Cruz, Sofia Isabel', lrn: '136547890005', section: 'Grade 7 – A', status: 'inactive', joined: 'Jun 2024' },
  { id: 'S-1006', name: 'Ocampo, Hannah Grace', lrn: '136547890013', section: 'Grade 7 – B', status: 'active', joined: 'Jun 2025' },
  { id: 'S-1007', name: 'Pascual, Adrian Vincent', lrn: '136547890014', section: 'Grade 7 – B', status: 'active', joined: 'Jun 2025' },
  { id: 'S-1008', name: 'Alvarez, Patricia Denise', lrn: '136547890023', section: 'Grade 8 – A', status: 'active', joined: 'Jun 2024' },
  { id: 'S-1009', name: 'Beltran, Francis Rafael', lrn: '136547890024', section: 'Grade 8 – A', status: 'active', joined: 'Jun 2024' },
  { id: 'S-1010', name: 'Jimenez, Danica Rose', lrn: '136547890031', section: 'Grade 8 – B', status: 'inactive', joined: 'Jun 2023' },
];

export const teachers = [
  { id: 'T-2001', name: 'Ms. Rivera', lrn: 'TCH-2001', subject: 'Mathematics', section: 'Grade 7 – A', status: 'active', joined: 'Jun 2021' },
  { id: 'T-2002', name: 'Mr. Santos', lrn: 'TCH-2002', subject: 'English', section: 'Grade 7 – B', status: 'active', joined: 'Aug 2022' },
  { id: 'T-2003', name: 'Ms. Villar', lrn: 'TCH-2003', subject: 'Science', section: 'Grade 8 – A', status: 'active', joined: 'Jun 2020' },
  { id: 'T-2004', name: 'Mr. Lim', lrn: 'TCH-2004', subject: 'Filipino', section: 'Grade 8 – B', status: 'active', joined: 'Mar 2023' },
  { id: 'T-2005', name: 'Ms. Cruz', lrn: 'TCH-2005', subject: 'History', section: 'Grade 9 – A', status: 'inactive', joined: 'Jun 2019' },
  { id: 'T-2006', name: 'Mr. Dela Peña', lrn: 'TCH-2006', subject: 'Physical Education', section: 'Grade 9 – B', status: 'active', joined: 'Jun 2024' },
  { id: 'T-2007', name: 'Ms. Ramos', lrn: 'TCH-2007', subject: 'Values Education', section: 'Grade 10 – A', status: 'active', joined: 'Jun 2022' },
];

// View metadata for each sidebar module.
export const viewMeta = {
  emergency: {
    title: 'Emergency Contacts',
    subtitle: 'Manage verified emergency responder profiles and hotlines.',
    icon: 'phone',
  },
  drills: {
    title: 'Drill Scheduling',
    subtitle: 'Plan and track evacuation drills and safety exercises.',
    icon: 'person-running',
  },
  evacuation: {
    title: 'Evacuation Map & Plans',
    subtitle: 'View and maintain evacuation routes and assembly points.',
    icon: 'map',
  },
  incidents: {
    title: 'Incident Logging',
    subtitle: 'Log and review reported safety incidents.',
    icon: 'report',
  },
  inspections: {
    title: 'Safety Inspections',
    subtitle: 'Track scheduled safety inspections and compliance checks.',
    icon: 'fact_check',
  },
  risk: {
    title: 'Risk Assessment',
    subtitle: 'Evaluate and manage campus safety risks.',
    icon: 'security',
  },
  notifications: {
    title: 'Parent Notifications',
    subtitle: 'Send and manage parent alerts and announcements.',
    icon: 'notifications',
  },
  'safety-reports': {
    title: 'Safety Reports',
    subtitle: 'Generate safety and compliance reports.',
    icon: 'assessment',
  },
  'emergency-roles': {
    title: 'Emergency Role Assignment',
    subtitle: 'Assign fire wardens, marshals, and first aiders to zones.',
    icon: 'groups',
  },
  supplies: {
    title: 'First Aid Supplies',
    subtitle: 'Monitor first aid inventory and restock needs.',
    icon: 'medical_services',
  },
};
