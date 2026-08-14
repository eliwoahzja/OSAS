<?php
// ============================================================
// Validation — per-table required-field + enum checks for every
// POST / PATCH, mirroring the DB-level CHECK constraints.
// ============================================================

final class Validation
{
    private const ENUMS = [
        'incidents.type' => ['medical', 'slips/falls', 'fire-related', 'security', 'equipment failure'],
        'incidents.severity' => ['low', 'medium', 'high'],
        'incidents.status' => ['open', 'resolved'],
        'inspections.status' => ['pass', 'fail', 'pending', 'passed', 'overdue'],
        'drills.type' => ['Fire', 'Earthquake', 'Lockdown', 'Evacuation'],
        'drills.status' => ['upcoming', 'completed', 'cancelled'],
        'risks.likelihood' => ['Low', 'Medium', 'High'],
        'risks.impact' => ['Low', 'Medium', 'High'],
        'notifications.notif_type' => ['incident_alert', 'event_notice'],
        'notifications.priority' => ['urgent', 'informational'],
        'notifications.contact_method' => ['app', 'sms', 'call', 'email'],
        'notifications.delivery_status' => ['pending', 'sent', 'failed', 'delivered', 'read'],
        'emergency_contacts.category' => ['student', 'school'],
        'students.grade' => [7, 8, 9, 10, 11, 12],
    ];

    private const REQUIRED = [
        'incidents' => ['type', 'location', 'description', 'severity', 'status'],
        'inspections' => ['item', 'area', 'frequency', 'status'],
        'drills' => ['type', 'date', 'building', 'person_in_charge', 'status'],
        'supplies' => ['item', 'quantity', 'location', 'reorder_threshold'],
        'emergency_contacts' => ['name', 'category', 'phone'],
        'evacuation_plans' => ['building', 'floor'],
        'risks' => ['hazard', 'likelihood', 'impact', 'risk_level'],
        'emergency_roles' => ['role', 'staff', 'zone'],
    ];

    /**
     * Validate a payload for a table. Returns an array of error strings
     * (empty = valid). Only checks the fields that were sent for PATCH,
     * but all required fields for POST.
     */
    public static function check(string $table, array $payload, bool $isPatch = false): array
    {
        $errors = [];

        if (!$isPatch) {
            foreach (self::REQUIRED[$table] ?? [] as $field) {
                if (!array_key_exists($field, $payload) || $payload[$field] === null || $payload[$field] === '') {
                    $errors[] = "$field is required";
                }
            }
        }

        foreach ($payload as $field => $value) {
            if ($value === null) {
                continue;
            }
            $key = "$table.$field";
            if (isset(self::ENUMS[$key])) {
                $allowed = self::ENUMS[$key];
                $ok = in_array($value, $allowed, true)
                    || in_array((string) $value, array_map('strval', $allowed), true);
                if (!$ok) {
                    $errors[] = "$field must be one of: " . implode(', ', $allowed);
                }
            }
            if ($field === 'grade' && $table === 'students') {
                $grade = (int) $value;
                if ($grade < 7 || $grade > 12) {
                    $errors[] = 'grade must be between 7 and 12';
                }
            }
        }

        return $errors;
    }
}
