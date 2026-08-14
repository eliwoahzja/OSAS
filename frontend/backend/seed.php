<?php
// ============================================================
// Seed script — populates realistic demo data across all tables.
// Usage:
//   Mock mode (no Supabase keys): php seed.php            → resets
//     backend/storage/mock.json to the built-in dataset.
//   Supabase mode:  php seed.php --reset-tables          → wipes the
//     listed tables, applies schema.sql (run it in the SQL editor
//     first), inserts demo rows, and creates the demo users.
// ============================================================

require_once __DIR__ . '/src/Db.php';

$mockFile = __DIR__ . '/storage/mock.json';

if (Db::isMock()) {
    if (is_file($mockFile)) {
        unlink($mockFile);
        echo "Mock dataset reset (storage/mock.json removed — defaults restored).\n";
    } else {
        echo "Mock dataset already at defaults.\n";
    }
    echo "Seed OK (mock mode).\n";
    exit(0);
}

// ---- Supabase mode ----
$resetTables = in_array('--reset-tables', $argv, true);
$tables = ['students', 'emergency_contacts', 'drills', 'evacuation_plans', 'incidents',
    'inspections', 'risks', 'notifications', 'reports', 'emergency_roles', 'supplies', 'audit_log'];

if ($resetTables) {
    echo "Wiping tables (--reset-tables): " . implode(', ', $tables) . "\n";
    foreach ($tables as $t) {
        try { Db::delete($t, '*'); } catch (Throwable $e) { /* table may not exist yet */ }
    }
}

$students = [
    ['name' => 'Abella, Maria Clara', 'grade' => 7, 'phone' => '0917 555 1101'],
    ['name' => 'Dela Cruz, Sofia Isabel', 'grade' => 7, 'phone' => '0917 555 1105'],
    ['name' => 'Chua, Samantha Lian', 'grade' => 8, 'phone' => '0917 555 1203'],
    ['name' => 'Reyes, Althea Jane', 'grade' => 7, 'phone' => '0917 555 1107'],
    ['name' => 'Yap, Lorenzo Miguel', 'grade' => 10, 'phone' => '0917 555 1402'],
    ['name' => 'Espino, Trisha Anne', 'grade' => 12, 'phone' => '0917 555 1601'],
];

$counts = [];
$studentIds = [];
foreach ($students as $s) {
    $created = Db::insert('students', $s);
    $studentIds[] = $created['id'] ?? null;
}
$counts['students'] = count($students);

foreach ([
    ['category' => 'student', 'name' => 'Luzviminda Abella', 'relationship' => 'Mother', 'phone' => '0917 555 2000', 'email' => 'luzvimindaabella@gmail.com', 'priority' => 1],
    ['category' => 'student', 'name' => 'Ramon Aguilar', 'relationship' => 'Father', 'phone' => '0917 555 2017', 'email' => 'ramonaguilar@gmail.com', 'priority' => 2],
    ['category' => 'school', 'role' => 'School Nurse', 'name' => 'Ms. Corazon Dela Peña', 'phone' => '0917 555 0001', 'email' => 'nurse@saac.edu.ph'],
    ['category' => 'school', 'role' => 'Nearest Police Station', 'name' => 'Caloocan City Police Station 1', 'phone' => '(02) 8-364-1234', 'email' => 'cpd1@ncrpo.pnp.gov.ph'],
] as $c) { Db::insert('emergency_contacts', $c); }
$counts['emergency_contacts'] = 4;

foreach ([
    ['type' => 'Fire', 'date' => date('Y-m-d', strtotime('-30 days')), 'time' => '9:00 AM', 'building' => 'Main Building', 'person_in_charge' => 'Mr. Lim', 'status' => 'completed', 'notes' => 'Evacuated in 4 min 30 s.'],
    ['type' => 'Earthquake', 'date' => date('Y-m-d', strtotime('+14 days')), 'time' => '10:30 AM', 'building' => 'Science Wing', 'person_in_charge' => 'Ms. Villar', 'status' => 'upcoming', 'notes' => ''],
] as $d) { Db::insert('drills', $d); }
$counts['drills'] = 2;

foreach ([
    ['building' => 'Main Building', 'floor' => 'Ground Floor', 'exits' => 'Exit A, Exit B, Exit C', 'routes' => 'R1 via Front Lobby', 'assembly_point' => 'Quadrangle — Zone 1', 'version' => 'v2.1', 'updated' => date('Y-m-d'), 'current' => true],
    ['building' => 'Science Wing', 'floor' => 'All Floors', 'exits' => 'Exit D, Exit E', 'routes' => 'R4 via West Exit', 'assembly_point' => 'Covered Court — Zone 2', 'version' => 'v1.4', 'updated' => date('Y-m-d', strtotime('-30 days')), 'current' => true],
] as $p) { Db::insert('evacuation_plans', $p); }
$counts['evacuation_plans'] = 2;

foreach ([
    ['date' => date('Y-m-d', strtotime('-20 days')), 'time' => '9:12 AM', 'type' => 'medical', 'location' => 'Gymnasium', 'description' => 'Student fainted during PE warm-up.', 'reporter' => 'Ms. Rivera', 'severity' => 'medium', 'status' => 'resolved'],
    ['date' => date('Y-m-d', strtotime('-5 days')), 'time' => '10:05 AM', 'type' => 'fire-related', 'location' => 'Science Wing — Lab 2', 'description' => 'Smoke from an electrical outlet; power cut off.', 'reporter' => 'Ms. Villar', 'severity' => 'high', 'status' => 'open'],
    ['date' => date('Y-m-d'), 'time' => '11:20 AM', 'type' => 'medical', 'location' => 'Grade 8-B Classroom', 'description' => 'Student with an asthma attack; nebulizer administered.', 'reporter' => 'Nurse — Ms. Dela Peña', 'severity' => 'medium', 'status' => 'open'],
] as $i) { Db::insert('incidents', $i); }
$counts['incidents'] = 3;

foreach ([
    ['item' => 'Fire extinguishers', 'area' => 'Main Building', 'frequency' => 'Monthly', 'last_inspected' => date('Y-m-d', strtotime('-10 days')), 'status' => 'passed', 'inspector' => 'Mr. Dela Peña', 'notes' => 'All units charged.'],
    ['item' => 'First aid kits — classrooms', 'area' => 'All Buildings', 'frequency' => 'Quarterly', 'last_inspected' => date('Y-m-d', strtotime('-40 days')), 'status' => 'pending', 'inspector' => 'Nurse', 'notes' => 'Replenishment scheduled.'],
    ['item' => 'Electrical panels & wiring', 'area' => 'Science Wing', 'frequency' => 'Semi-annual', 'last_inspected' => date('Y-m-d', strtotime('-200 days')), 'status' => 'overdue', 'inspector' => 'External Electrician', 'notes' => 'Follow-up needed.'],
] as $in) { Db::insert('inspections', $in); }
$counts['inspections'] = 3;

foreach ([
    ['hazard' => 'Electrical wiring in Science Wing Lab 2', 'likelihood' => 'High', 'impact' => 'High', 'risk_level' => 'Critical', 'mitigation' => 'Immediate panel inspection; schedule rewiring.', 'owner' => 'Mr. Dela Peña', 'review_date' => date('Y-m-d', strtotime('+30 days'))],
    ['hazard' => 'Unauthorized entry at the main gate', 'likelihood' => 'Medium', 'impact' => 'Medium', 'risk_level' => 'Medium', 'mitigation' => 'Strict visitor log, ID checks.', 'owner' => 'Mr. Cruz', 'review_date' => date('Y-m-d', strtotime('+45 days'))],
] as $r) { Db::insert('risks', $r); }
$counts['risks'] = 2;

foreach ([
    ['role' => 'Fire Warden', 'staff' => 'Mr. Dela Peña', 'zone' => 'Main Building — Floors 1–2', 'backup' => 'Mr. Lim'],
    ['role' => 'First Aider', 'staff' => 'Nurse — Ms. Dela Peña', 'zone' => 'Clinic & Grounds', 'backup' => 'Ms. Villar'],
] as $rl) { Db::insert('emergency_roles', $rl); }
$counts['emergency_roles'] = 2;

foreach ([
    ['item' => 'Adhesive bandages', 'quantity' => 12, 'unit' => 'boxes', 'location' => 'Clinic Cabinet A', 'expiry' => date('Y-m-d', strtotime('+1 year')), 'reorder_threshold' => 5, 'last_restocked' => date('Y-m-d', strtotime('-10 days'))],
    ['item' => 'Sterile gauze pads (4x4)', 'quantity' => 3, 'unit' => 'packs', 'location' => 'Clinic Cabinet A', 'expiry' => date('Y-m-d', strtotime('+9 months')), 'reorder_threshold' => 5, 'last_restocked' => date('Y-m-d', strtotime('-60 days'))],
    ['item' => 'Instant cold packs', 'quantity' => 2, 'unit' => 'pcs', 'location' => 'Emergency Bag', 'expiry' => date('Y-m-d', strtotime('+2 months')), 'reorder_threshold' => 4, 'last_restocked' => date('Y-m-d', strtotime('-150 days'))],
] as $su) { Db::insert('supplies', $su); }
$counts['supplies'] = 3;foreach ([
    ['notif_type' => 'event_notice', 'priority' => 'informational', 'audience_group' => 'All Parents', 'title' => 'Foundation Day — Schedule', 'message' => 'Foundation Day will be held on August 21 from 8:00 AM to 5:00 PM.', 'event_start_at' => date('c', strtotime('+7 days 8:00')), 'event_end_at' => date('c', strtotime('+7 days 17:00')), 'contact_method' => 'app', 'delivery_status' => 'delivered'],
    ['notif_type' => 'incident_alert', 'priority' => 'urgent', 'student_id' => $studentIds[1] ?? null, 'related_incident_id' => null, 'title' => 'Medical Emergency — PE Class', 'message' => 'Sofia was attended to after fainting during PE.', 'contact_method' => 'call', 'delivery_status' => 'delivered'],
] as $n) { Db::insert('notifications', $n); }
$counts['notifications'] = 2;

// ---- Demo auth users (Supabase Auth admin API) ----
$base = rtrim((string) getenv('SUPABASE_URL'), '/');
$key = (string) getenv('SUPABASE_SERVICE_ROLE_KEY');
$users = [
    ['email' => 'admin@saac.ph', 'password' => 'admin1234', 'role' => 'admin', 'name' => 'Local Administrator'],
    ['email' => 'staff@saac.ph', 'password' => 'staff1234', 'role' => 'staff', 'name' => 'Staff Member'],
];
$counts['auth_users'] = 0;
foreach ($users as $u) {
    $ch = curl_init($base . '/auth/v1/admin/users');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['apikey: ' . $key, 'Authorization: Bearer ' . $key, 'Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode([
            'email' => $u['email'],
            'password' => $u['password'],
            'email_confirm' => true,
            'user_metadata' => ['role' => $u['role'], 'name' => $u['name']],
        ]),
    ]);
    $raw = (string) curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    $ok = $status < 400 && str_contains($raw, '"id"');
    echo ($ok ? '  + ' : '  ! ') . $u['email'] . " (" . $u['role'] . ")\n";
    if ($ok) {
        $counts['auth_users']++;
    }
}

echo "\nSeed complete:\n";
foreach ($counts as $t => $c) {
    printf("  %-20s %d\n", $t, $c);
}
