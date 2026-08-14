<?php
// ============================================================
// Auth — Express-style middleware for the PHP API.
//   * Bearer token verified as an HS256 JWT against
//     SUPABASE_JWT_SECRET when configured.
//   * Dev mode (no secret): requests default to the admin role;
//     X-OSAS-Role: staff may be set for testing staff gating.
// ============================================================

final class Auth
{
    private static ?array $user = null;

    private static function env(string $key, ?string $default = null): ?string
    {
        $v = getenv($key);
        return $v === false || $v === '' ? $default : $v;
    }

    public static function user(): ?array
    {
        return self::$user;
    }

    public static function role(): string
    {
        return self::$user['role'] ?? 'staff';
    }

    public static function requireAuth(): void
    {
        self::resolve();
        if (self::$user === null) {
            self::abort(401, 'Authentication required.');
        }
    }

    public static function requireAdmin(): void
    {
        self::requireAuth();
        if (self::$user['role'] !== 'admin') {
            self::abort(403, 'Admin role required.');
        }
    }

    /** Resolve the current user from the Authorization header. */
    private static function resolve(): void
    {
        if (self::$user !== null) {
            return;
        }
        $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        $secret = (string) self::env('SUPABASE_JWT_SECRET', '');
        if ($secret !== '' && preg_match('/^Bearer\s+(.+)$/i', $header, $m)) {
            $payload = self::verifyJwt($m[1], $secret);
            if ($payload !== null) {
                $role = $payload['user_metadata']['role'] ?? $payload['role'] ?? 'staff';
                self::$user = [
                    'sub' => $payload['sub'] ?? 'unknown',
                    'email' => $payload['email'] ?? 'unknown',
                    'role' => $role === 'admin' ? 'admin' : 'staff',
                ];
                return;
            }
            self::$user = null; // invalid token → 401
            return;
        }

        // Dev mode: no secret configured → default admin (matches the
        // frontend dev session). X-OSAS-Role lets tests act as staff.
        $devRole = $_SERVER['HTTP_X_OSAS_ROLE'] ?? 'admin';
        self::$user = [
            'sub' => 'dev-user',
            'email' => 'admin@saac.ph',
            'role' => $devRole === 'staff' ? 'staff' : 'admin',
        ];
    }

    private static function verifyJwt(string $jwt, string $secret): ?array
    {
        $parts = explode('.', $jwt);
        if (count($parts) !== 3) {
            return null;
        }
        [$h, $p, $sig] = $parts;
        $expected = hash_hmac('sha256', "$h.$p", $secret, true);
        $sigBin = self::base64UrlDecode($sig);
        if (!hash_equals($expected, $sigBin)) {
            return null;
        }
        $payload = json_decode(self::base64UrlDecode($p), true);
        if (!is_array($payload)) {
            return null;
        }
        if (isset($payload['exp']) && time() > (int) $payload['exp']) {
            return null;
        }
        return $payload;
    }

    private static function base64UrlDecode(string $s): string
    {
        return base64_decode(strtr($s, '-_', '+/'), true) ?: '';
    }

    private static function abort(int $status, string $msg): void
    {
        http_response_code($status);
        header('Content-Type: application/json');
        echo json_encode(['error' => $msg]);
        exit;
    }
}
