<?php
// ============================================================
// Router for PHP's built-in web server (dev / preview):
//   php -S 127.0.0.1:5173 -t . backend/router.php
// Serves the static frontend from the docroot and routes /api/*
// to the PHP REST API controller. Production (Render) uses the
// Dockerfile instead — this file is dev-only.
// ============================================================

$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

if (str_starts_with($uri, '/api/')) {
    require __DIR__ . '/public/index.php';
    return true;
}

// Let the built-in server serve real static files (css/js/assets/…).
return false;
