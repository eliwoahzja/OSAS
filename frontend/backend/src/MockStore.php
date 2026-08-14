<?php
// ============================================================
// MockStore — in-memory dataset used when SUPABASE_URL /
// SUPABASE_SERVICE_ROLE_KEY are unset. Writes are persisted to
// backend/storage/mock.json so inserts survive a restart.
// ============================================================

final class MockStore
{
    private static ?array $store = null;
    private static string $file = __DIR__ . '/../storage/mock.json';

    private static function data(): array
    {
        if (self::$store !== null) {
            return self::$store;
        }
        if (is_file(self::$file)) {
            $json = json_decode((string) file_get_contents(self::$file), true);
            if (is_array($json)) {
                return self::$store = $json;
            }
        }
        return self::$store = self::seed();
    }

    private static function persist(): void
    {
        $dir = dirname(self::$file);
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        file_put_contents(self::$file, json_encode(self::$store, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }

    public static function list(string $table): array
    {
        return array_values(self::data()[$table] ?? []);
    }

    public static function get(string $table, string $id): ?array
    {
        foreach (self::data()[$table] ?? [] as $row) {
            if (($row['id'] ?? null) === $id) {
                return $row;
            }
        }
        return null;
    }

    public static function insert(string $table, array $row): array
    {
        $data = self::data();
        $record = array_merge(['id' => self::nextId($table), 'created_at' => date('c')], $row);
        if (!isset($data[$table]) || !is_array($data[$table])) {
            $data[$table] = [];
        }
        array_unshift($data[$table], $record);
        self::$store = $data;
        self::persist();
        return $record;
    }

    public static function update(string $table, string $id, array $patch): ?array
    {
        $data = self::data();
        foreach ($data[$table] ?? [] as $i => $row) {
            if (($row['id'] ?? null) === $id) {
                $data[$table][$i] = array_merge($row, $patch);
                self::$store = $data;
                self::persist();
                return $data[$table][$i];
            }
        }
        return null;
    }

    public static function delete(string $table, string $id): bool
    {
        $data = self::data();
        foreach ($data[$table] ?? [] as $i => $row) {
            if (($row['id'] ?? null) === $id) {
                array_splice($data[$table], $i, 1);
                self::$store = $data;
                self::persist();
                return true;
            }
        }
        return false;
    }

    private static function nextId(string $table): string
    {
        $prefix = [
            'incidents' => 'INC', 'inspections' => 'INS', 'drills' => 'DR', 'supplies' => 'SU',
            'emergency_contacts' => 'GC', 'evacuation_plans' => 'EP', 'risks' => 'RS',
            'notifications' => 'NT', 'emergency_roles' => 'RL', 'reports' => 'RP',
        ][$table] ?? 'ID';
        return $prefix . '-' . time() . '-' . substr((string) mt_rand(), 0, 4);
    }

    /** Audit entries are recorded in-memory (same table shape as Postgres). */
    public static function audit(string $table, string $action, ?string $recordId, ?array $old, ?array $new): void
    {
        $data = self::data();
        $data['audit_log'][] = [
            'id' => 'AUD-' . time() . '-' . substr((string) mt_rand(), 0, 4),
            'table_name' => $table,
            'record_id' => $recordId,
            'action' => $action,
            'changed_by' => 'admin',
            'changed_at' => date('c'),
            'old_value' => $old,
            'new_value' => $new,
        ];
        self::$store = $data;
        self::persist();
    }

    private static function seed(): array
    {
        return [
            'students' => [
                ['id' => 'stu-01', 'name' => 'Abella, Maria Clara', 'grade' => 7, 'phone' => '0917 555 1101'],
                ['id' => 'stu-05', 'name' => 'Dela Cruz, Sofia Isabel', 'grade' => 7, 'phone' => '0917 555 1105'],
                ['id' => 'stu-09', 'name' => 'Chua, Samantha Lian', 'grade' => 8, 'phone' => '0917 555 1203'],
                ['id' => 'stu-12', 'name' => 'Reyes, Althea Jane', 'grade' => 7, 'phone' => '0917 555 1107'],
                ['id' => 'stu-18', 'name' => 'Yap, Lorenzo Miguel', 'grade' => 10, 'phone' => '0917 555 1402'],
                ['id' => 'stu-23', 'name' => 'Espino, Trisha Anne', 'grade' => 12, 'phone' => '0917 555 1601'],
            ],
            'incidents' => [
                ['id' => 'INC-001', 'date' => '2026-07-15', 'time' => '9:12 AM', 'type' => 'medical', 'location' => 'Gymnasium', 'description' => 'Student fainted during PE warm-up.', 'reporter' => 'Ms. Rivera', 'severity' => 'medium', 'status' => 'resolved', 'student_id' => null],
                ['id' => 'INC-003', 'date' => '2026-07-29', 'time' => '10:05 AM', 'type' => 'fire-related', 'location' => 'Science Wing — Lab 2', 'description' => 'Smoke from an electrical outlet; power cut off.', 'reporter' => 'Ms. Villar', 'severity' => 'high', 'status' => 'open', 'student_id' => null],
                ['id' => 'INC-005', 'date' => '2026-08-05', 'time' => '11:20 AM', 'type' => 'medical', 'location' => 'Grade 8-B Classroom', 'description' => 'Student with an asthma attack; nebulizer administered.', 'reporter' => 'Nurse — Ms. Dela Peña', 'severity' => 'medium', 'status' => 'resolved', 'student_id' => 'stu-12'],
                ['id' => 'INC-008', 'date' => '2026-08-11', 'time' => '1:50 PM', 'type' => 'slips/falls', 'location' => 'Covered Court', 'description' => 'Student tripped over a loose floor tile.', 'reporter' => 'PE Instructor', 'severity' => 'medium', 'status' => 'resolved', 'student_id' => null],
            ],
            'inspections' => [
                ['id' => 'INS-001', 'item' => 'Fire extinguishers', 'area' => 'Main Building', 'frequency' => 'Monthly', 'last_inspected' => '2026-07-25', 'status' => 'passed', 'inspector' => 'Mr. Dela Peña', 'notes' => 'All units charged.', 'photo_url' => null],
                ['id' => 'INS-003', 'item' => 'First aid kits — classrooms', 'area' => 'All Buildings', 'frequency' => 'Quarterly', 'last_inspected' => '2026-06-10', 'status' => 'pending', 'inspector' => 'Nurse', 'notes' => 'Replenishment scheduled.', 'photo_url' => null],
                ['id' => 'INS-004', 'item' => 'Electrical panels & wiring', 'area' => 'Science Wing', 'frequency' => 'Semi-annual', 'last_inspected' => '2026-01-30', 'status' => 'overdue', 'inspector' => 'External Electrician', 'notes' => 'Follow-up needed.', 'photo_url' => null],
            ],
            'drills' => [
                ['id' => 'DR-001', 'type' => 'Fire', 'date' => '2026-02-18', 'time' => '9:00 AM', 'building' => 'Main Building', 'person_in_charge' => 'Mr. Lim', 'status' => 'completed', 'notes' => 'Evacuated in 4 min 30 s.'],
                ['id' => 'DR-002', 'type' => 'Earthquake', 'date' => '2026-03-20', 'time' => '10:30 AM', 'building' => 'Science Wing', 'person_in_charge' => 'Ms. Villar', 'status' => 'upcoming', 'notes' => ''],
            ],
            'supplies' => [
                ['id' => 'SU-001', 'item' => 'Adhesive bandages', 'quantity' => 12, 'unit' => 'boxes', 'location' => 'Clinic Cabinet A', 'expiry' => '2027-06-30', 'reorder_threshold' => 5, 'last_restocked' => '2026-07-20'],
                ['id' => 'SU-002', 'item' => 'Sterile gauze pads (4x4)', 'quantity' => 3, 'unit' => 'packs', 'location' => 'Clinic Cabinet A', 'expiry' => '2027-03-15', 'reorder_threshold' => 5, 'last_restocked' => '2026-05-18'],
                ['id' => 'SU-008', 'item' => 'Instant cold packs', 'quantity' => 2, 'unit' => 'pcs', 'location' => 'Emergency Bag', 'expiry' => '2026-10-20', 'reorder_threshold' => 4, 'last_restocked' => '2026-02-10'],
            ],
            'emergency_contacts' => [
                ['id' => 'GC-1001', 'category' => 'student', 'name' => 'Luzviminda Abella', 'relationship' => 'Mother', 'phone' => '0917 555 2000', 'email' => 'luzvimindaabella@gmail.com', 'priority' => 1],
                ['id' => 'GC-1002', 'category' => 'student', 'name' => 'Ramon Aguilar', 'relationship' => 'Father', 'phone' => '0917 555 2017', 'email' => 'ramonaguilar@gmail.com', 'priority' => 2],
                ['id' => 'SC-1', 'category' => 'school', 'role' => 'School Nurse', 'name' => 'Ms. Corazon Dela Peña', 'phone' => '0917 555 0001', 'email' => 'nurse@saac.edu.ph', 'priority' => null],
                ['id' => 'SC-3', 'category' => 'school', 'role' => 'Nearest Police Station', 'name' => 'Caloocan City Police Station 1', 'phone' => '(02) 8-364-1234', 'email' => 'cpd1@ncrpo.pnp.gov.ph', 'priority' => null],
            ],
            'evacuation_plans' => [
                ['id' => 'EP-01', 'building' => 'Main Building', 'floor' => 'Ground Floor', 'exits' => 'Exit A, Exit B, Exit C', 'routes' => 'R1 via Front Lobby', 'assembly_point' => 'Quadrangle — Zone 1', 'version' => 'v2.1', 'updated' => '2026-06-15', 'file_url' => null, 'current' => true],
                ['id' => 'EP-03', 'building' => 'Science Wing', 'floor' => 'All Floors', 'exits' => 'Exit D, Exit E', 'routes' => 'R4 via West Exit', 'assembly_point' => 'Covered Court — Zone 2', 'version' => 'v1.4', 'updated' => '2026-05-02', 'file_url' => null, 'current' => true],
            ],
            'risks' => [
                ['id' => 'RS-001', 'hazard' => 'Electrical wiring in Science Wing Lab 2', 'likelihood' => 'High', 'impact' => 'High', 'risk_level' => 'Critical', 'mitigation' => 'Immediate panel inspection; schedule rewiring.', 'owner' => 'Mr. Dela Peña', 'review_date' => '2026-08-15'],
                ['id' => 'RS-004', 'hazard' => 'Unauthorized entry at the main gate', 'likelihood' => 'Medium', 'impact' => 'Medium', 'risk_level' => 'Medium', 'mitigation' => 'Strict visitor log, ID checks.', 'owner' => 'Mr. Cruz', 'review_date' => '2026-08-25'],
            ],
            'notifications' => [
                ['id' => 'nt-1', 'notif_type' => 'event_notice', 'priority' => 'informational', 'student_id' => null, 'related_incident_id' => null, 'audience_group' => 'All Parents', 'title' => 'Foundation Day — Schedule', 'message' => 'Foundation Day will be held on August 21 from 8:00 AM to 5:00 PM.', 'event_start_at' => '2026-08-21T08:00:00+08:00', 'event_end_at' => '2026-08-21T17:00:00+08:00', 'contact_method' => 'app', 'sent_at' => '2026-08-13T09:00:00+08:00', 'delivery_status' => 'delivered', 'created_by' => 'admin'],
                ['id' => 'nt-2', 'notif_type' => 'incident_alert', 'priority' => 'urgent', 'student_id' => 'stu-05', 'related_incident_id' => 'INC-001', 'audience_group' => null, 'title' => 'Medical Emergency — PE Class', 'message' => 'Sofia was attended to after fainting during PE.', 'event_start_at' => null, 'event_end_at' => null, 'contact_method' => 'call', 'sent_at' => '2026-07-15T09:20:00+08:00', 'delivery_status' => 'delivered', 'created_by' => 'admin'],
            ],
            'emergency_roles' => [
                ['id' => 'RL-001', 'role' => 'Fire Warden', 'staff' => 'Mr. Dela Peña', 'zone' => 'Main Building — Floors 1–2', 'backup' => 'Mr. Lim'],
                ['id' => 'RL-003', 'role' => 'First Aider', 'staff' => 'Nurse — Ms. Dela Peña', 'zone' => 'Clinic & Grounds', 'backup' => 'Ms. Villar'],
            ],
            'reports' => [
                ['id' => 'RP-001', 'name' => 'Monthly Safety Compliance Summary — July 2026', 'generated' => '2026-08-01', 'format' => 'PDF', 'scope' => 'All modules'],
            ],
            'audit_log' => [],
        ];
    }
}
