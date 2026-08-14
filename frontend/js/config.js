// ============================================================
// OSAS runtime configuration (static site — no build step).
// For production, set these values here or inject them at
// deploy time. Leave SUPABASE_* empty to run against the
// PHP API in its built-in mock mode (no credentials needed).
// ============================================================
window.OSAS = {
  // Base URL of the PHP REST API. '/api' works when served behind
  // the Vite dev proxy or a reverse proxy; use the full Render
  // URL in production, e.g. 'https://osas-api.onrender.com/api'.
  API_URL: '/api',

  // Supabase project credentials (Supabase Auth is client-side).
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
};
