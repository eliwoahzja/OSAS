<?php
// ============================================================
// SAAC – OSAS · PHP REST API front controller
// Routes (JSON):
//   GET    /api/health
//   GET    /api/dashboard/stats
//   GET    /api/{table}            (filters via query params)
//   POST   /api/{table}
//   GET    /api/{table}/{id}
//   PATCH  /api/{table}/{id}
//   DELETE /api/{table}/{id}
//   POST   /api/notifications/send
//   POST   /api/upload             (multipart: file, bucket, path)
//   GET    /api/files/{bucket}/{name}
// ============================================================

require_once __DIR__ . '/../src/Db.php';
require_once __DIR__ . '/../src/Auth.php';
require_once __DIR__ . '/../src/Validation.php';
require_once __DIR__ . '/../src/Notifications.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-OSAS-Role');
header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

/** Tables the API exposes (audit_log is write-only via Db::audit). */
const TABLES = [
    'students', 'emergency_contacts', 'drills', 'evacuation_plans', 'incidents',
    'inspections', 'risks', 'notifications', 'reports', 'emergency_roles', 'supplies',
];

/** Read-only for staff; writes restricted to admin except where noted. */
const STAFF_WRITABLE = ['incidents', 'inspections', 'drills', 'emergency_contacts', 'notifications'];

function jsonOut($data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function jsonError(string $msg, int $status = 400): void
{
    jsonOut(['error' => $msg], $status);
}

function readBody(): array
{
    $raw = file_get_contents('php://input');
    $data = json_decode($raw ?: '{}', true);
    return is_array($data) ? $data : [];
}

function dashboardStats(): array
{
    $incidents = Db::list('incidents');
    $inspections = Db::list('inspections');
    $drills = Db::list('drills');
    $supplies = Db::list('supplies');
    $contacts = Db::list('emergency_contacts');

    $typeCount = [];
    foreach ($incidents as $i) {
        $t = $i['type'] ?? 'other';
        $typeCount[$t] = ($typeCount[$t] ?? 0) + 1;
    }
    $statusCount = [];
    foreach ($inspections as $i) {
        $s = $i['status'] ?? 'pending';
        $statusCount[$s] = ($statusCount[$s] ?? 0) + 1;
    }
    $total = count($inspections) ?: 1;

    return [
        'incidents_total' => count($incidents),
        'incidents_open' => count(array_filter($incidents, fn($i) => ($i['status'] ?? '') === 'open')),
        'inspections_passed' => $statusCount['passed'] ?? 0,
        'inspections_pending' => $statusCount['pending'] ?? 0,
        'inspections_overdue' => $statusCount['overdue'] ?? 0,
        'drills_active' => count(array_filter($drills, fn($d) => ($d['status'] ?? '') === 'upcoming')),
        'drills_completed' => count(array_filter($drills, fn($d) => ($d['status'] ?? '') === 'completed')),
        'supplies_low' => count(array_filter($supplies, fn($s) => (int) ($s['quantity'] ?? 0) <= (int) ($s['reorder_threshold'] ?? 0))),
        'emergency_contacts_total' => count($contacts),
        'compliance_score' => (int) round(((($statusCount['passed'] ?? 0)) / $total) * 100),
        'incident_breakdown' => array_map(fn($v, $k) => ['label' => $k, 'value' => $v], array_values($typeCount), array_keys($typeCount)),
        'inspection_status' => array_map(fn($v, $k) => ['label' => $k, 'value' => $v], array_values($statusCount), array_keys($statusCount)),
    ];
}

$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$uri = '/' . ltrim($uri, '/');
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    // ---------- health ----------
    if ($uri === '/api/health') {
        jsonOut([
            'ok' => true,
            'provider' => Db::isMock() ? 'mock' : 'supabase',
            'php' => PHP_VERSION,
            'supabase' => !Db::isMock(),
        ]);
    }

    // ---------- dashboard stats ----------
    if ($uri === '/api/dashboard/stats') {
        Auth::requireAuth();
        jsonOut(dashboardStats());
    }

    // ---------- notifications ----------
    if ($uri === '/api/notifications/send' && $method === 'POST') {
        Auth::requireAuth();
        jsonOut(Notifications::send(readBody()), 201);
    }

    // ---------- upload ----------
    if ($uri === '/api/upload' && $method === 'POST') {
        Auth::requireAuth();
        $bucket = $_POST['bucket'] ?? '';
        $path = $_POST['path'] ?? '';
        if (!in_array($bucket, ['evacuation-maps', 'inspection-photos'], true)) {
            jsonError('bucket must be evacuation-maps or inspection-photos');
        }
        if (empty($_FILES['file']) || ($_FILES['file']['error'] ?? 1) !== UPLOAD_ERR_OK) {
            jsonError('No file uploaded.');
        }
        $file = $_FILES['file'];
        $name = $path !== '' ? $path : ($file['name'] ?? 'file');
        jsonOut(Db::upload($bucket, $name, $file['tmp_name'], $file['name']), 201);
    }

    // ---------- serve stored files (local fallback) ----------
    if (preg_match('#^/api/files/([^/]+)/([^/]+)$#', $uri, $m)) {
        $bucket = rawurldecode($m[1]);
        $name = rawurldecode($m[2]);
        $file = __DIR__ . '/../storage/uploads/' . $bucket . '/' . basename($name);
        if (!is_file($file)) {
            jsonError('File not found.', 404);
        }
        header('Content-Type: ' . (mime_content_type($file) ?: 'application/octet-stream'));
        header('Content-Length: ' . filesize($file));
        header('Cache-Control: public, max-age=3600');
        readfile($file);
        exit;
    }

    // ---------- generic table CRUD ----------
    if (preg_match('#^/api/([a-z_]+)(?:/([^/]+))?$#', $uri, $m)) {
        $table = $m[1];
        $id = $m[2] ?? null;

        if (!in_array($table, TABLES, true)) {
            jsonError("Unknown table: $table", 404);
        }

        Auth::requireAuth();
        $role = Auth::role();
        $isWrite = in_array($method, ['POST', 'PATCH', 'DELETE'], true);

        // Role enforcement on the backend: admin may write everything;
        // staff may write only to STAFF_WRITABLE tables.
        if ($isWrite && $role !== 'admin' && !in_array($table, STAFF_WRITABLE, true)) {
            jsonError('Staff role cannot modify ' . $table . '.', 403);
        }

        if ($method === 'GET' && $id === null) {
            $filters = array_filter($_GET, fn($v) => $v !== '', ARRAY_FILTER_USE_BOTH);
            // notifications: enrich student rows with name/grade (mock + supabase)
            $rows = Db::list($table, $filters);
            if ($table === 'notifications') {
                $rows = array_map(function ($r) {
                    if (!empty($r['student_id'])) {
                        $s = Db::get('students', (string) $r['student_id']);
                        if ($s) {
                            $r['student_name'] = $s['name'];
                            $r['student_grade'] = $s['grade'];
                        }
                    }
                    return $r;
                }, $rows);
            }
            jsonOut($rows);
        }

        if ($method === 'POST') {
            $payload = readBody();
            $errors = Validation::check($table, $payload);
            if ($errors) {
                jsonError(implode('; ', $errors), 400);
            }
            $created = Db::insert($table, $payload);
            Db::audit($table, 'insert', $created['id'] ?? null, null, $created);
            jsonOut($created, 201);
        }

        if ($id === null) {
            jsonError('Missing record id.', 404);
        }

        if ($method === 'GET') {
            $row = Db::get($table, $id);
            $row ? jsonOut($row) : jsonError('Not found.', 404);
        }

        if ($method === 'PATCH') {
            $existing = Db::get($table, $id);
            if (!$existing) {
                jsonError('Not found.', 404);
            }
            $payload = readBody();
            $errors = Validation::check($table, $payload, true);
            if ($errors) {
                jsonError(implode('; ', $errors), 400);
            }
            $updated = Db::update($table, $id, $payload);
            Db::audit($table, 'update', $id, $existing, $updated);
            jsonOut($updated);
        }

        if ($method === 'DELETE') {
            $existing = Db::get($table, $id);
            if (!$existing) {
                jsonError('Not found.', 404);
            }
            Db::delete($table, $id);
            Db::audit($table, 'delete', $id, $existing, null);
            jsonOut(['ok' => true]);
        }

        jsonError('Method not allowed.', 405);
    }

    jsonError('Not found.', 404);
} catch (InvalidArgumentException $e) {
    jsonError($e->getMessage(), 400);
} catch (Throwable $e) {
    error_log('[osas-api] ' . $e->getMessage());
    jsonError('Internal server error: ' . $e->getMessage(), 500);
}
