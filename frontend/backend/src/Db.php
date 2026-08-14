<?php
// ============================================================
// Db — data access layer.
//   * Supabase configured (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
//     → talk to PostgREST over cURL.
//   * Otherwise → MockStore (in-memory, persisted to JSON).
// ============================================================

require_once __DIR__ . '/MockStore.php';

final class Db
{
    private static ?string $baseUrl = null;
    private static ?string $serviceKey = null;
    private static ?bool $isMock = null;

    private static function env(string $key, ?string $default = null): ?string
    {
        $v = getenv($key);
        return $v === false || $v === '' ? $default : $v;
    }

    public static function isMock(): bool
    {
        if (self::$isMock === null) {
            self::$baseUrl = rtrim((string) self::env('SUPABASE_URL', ''), '/');
            self::$serviceKey = (string) self::env('SUPABASE_SERVICE_ROLE_KEY', '');
            self::$isMock = self::$baseUrl === '' || self::$serviceKey === '';
        }
        return self::$isMock;
    }

    /** Supabase REST call. $method: GET/POST/PATCH/DELETE. */
    private static function rest(string $method, string $path, ?array $body = null, array $query = []): array
    {
        $url = self::$baseUrl . '/rest/v1/' . $path;
        if ($query) {
            $url .= '?' . http_build_query($query);
        }
        $ch = curl_init($url);
        $headers = [
            'apikey: ' . self::$serviceKey,
            'Authorization: Bearer ' . self::$serviceKey,
            'Content-Type: application/json',
        ];
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_TIMEOUT => 15,
        ]);
        if ($body !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
        }
        $raw = (string) curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $err = curl_error($ch);
        curl_close($ch);
        if ($status >= 400) {
            throw new RuntimeException("Supabase $method $path failed ($status): " . ($err ?: $raw));
        }
        if ($method === 'DELETE' || $raw === '') {
            return [];
        }
        $decoded = json_decode($raw, true);
        return is_array($decoded) ? $decoded : [];
    }

    // ---- Public API (mirrors the Postgres tables) ----

    public static function list(string $table, array $filters = []): array
    {
        if (self::isMock()) {
            $rows = MockStore::list($table);
            foreach ($filters as $k => $v) {
                if ($v === null || $v === '') {
                    continue;
                }
                $rows = array_values(array_filter($rows, fn($r) => stripos((string) ($r[$k] ?? ''), (string) $v) !== false));
            }
            return $rows;
        }
        return self::rest('GET', $table, null, $filters);
    }

    public static function get(string $table, string $id): ?array
    {
        if (self::isMock()) {
            return MockStore::get($table, $id);
        }
        $rows = self::rest('GET', $table, null, ['id' => 'eq.' . $id, 'limit' => '1']);
        return $rows[0] ?? null;
    }

    public static function insert(string $table, array $row): array
    {
        if (self::isMock()) {
            return MockStore::insert($table, $row);
        }
        $rows = self::rest('POST', $table, $row, ['select' => '*']);
        return $rows[0] ?? $row;
    }

    public static function update(string $table, string $id, array $patch): ?array
    {
        if (self::isMock()) {
            return MockStore::update($table, $id, $patch);
        }
        $rows = self::rest('PATCH', $table, $patch, ['id' => 'eq.' . $id, 'select' => '*']);
        return $rows[0] ?? null;
    }

    public static function delete(string $table, string $id): bool
    {
        if (self::isMock()) {
            return MockStore::delete($table, $id);
        }
        self::rest('DELETE', $table, null, ['id' => 'eq.' . $id]);
        return true;
    }

    public static function audit(string $table, string $action, ?string $recordId, ?array $old, ?array $new): void
    {
        $entry = [
            'table_name' => $table,
            'record_id' => $recordId,
            'action' => $action,
            'changed_by' => 'admin',
            'changed_at' => date('c'),
            'old_value' => $old,
            'new_value' => $new,
        ];
        if (self::isMock()) {
            MockStore::audit($table, $action, $recordId, $old, $new);
            return;
        }
        try {
            self::rest('POST', 'audit_log', $entry);
        } catch (Throwable $e) {
            // Audit logging must never break the main request.
            error_log('audit failed: ' . $e->getMessage());
        }
    }

    /** Supabase Storage upload (or local storage/ fallback). */
    public static function upload(string $bucket, string $path, string $tmpName, string $fileName): array
    {
        if (!self::isMock()) {
            $url = self::$baseUrl . '/storage/v1/object/' . rawurlencode($bucket) . '/' . rawurlencode($path);
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_CUSTOMREQUEST => 'POST',
                CURLOPT_POSTFIELDS => file_get_contents($tmpName),
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_HTTPHEADER => [
                    'apikey: ' . self::$serviceKey,
                    'Authorization: Bearer ' . self::$serviceKey,
                    'Content-Type: ' . (mime_content_type($tmpName) ?: 'application/octet-stream'),
                ],
                CURLOPT_TIMEOUT => 30,
            ]);
            $raw = (string) curl_exec($ch);
            $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
            curl_close($ch);
            if ($status >= 400) {
                throw new RuntimeException("Storage upload failed ($status): $raw");
            }
            return ['path' => $path, 'url' => self::$baseUrl . '/storage/v1/object/public/' . rawurlencode($bucket) . '/' . rawurlencode($path)];
        }

        // Local fallback: store under backend/storage/uploads/{bucket}/{path}
        $dir = __DIR__ . '/../storage/uploads/' . $bucket;
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        $dest = $dir . '/' . basename($path);
        if (!move_uploaded_file($tmpName, $dest) && !rename($tmpName, $dest) && !copy($tmpName, $dest)) {
            throw new RuntimeException('Could not store the uploaded file locally.');
        }
        return [
            'path' => $path,
            'url' => '/api/files/' . rawurlencode($bucket) . '/' . rawurlencode(basename($path)),
        ];
    }
}
