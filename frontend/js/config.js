// ============================================================
// OSAS runtime configuration (static site — no build step).
//
// Supabase-native architecture: the browser talks to Supabase
// directly (PostgREST for data, Storage for files, Auth for
// sessions). There is no PHP backend.
//
//   SUPABASE_URL / SUPABASE_ANON_KEY — the Supabase project
//       (anon key is public by design; the service key lives
//       only in server-side env vars / Edge Function secrets).
//   NOTIFY_FN_URL — the send-notification Edge Function that
//       delivers alerts (email via Resend, SMS/call via Twilio
//       when configured).
//   accessToken — OPTIONAL. The companion shell (the app that
//       owns the login page) can inject a signed-in user's
//       Supabase access token here before this module boots.
//       If unset, this module picks up a shared supabase-js
//       session from localStorage automatically, and falls back
//       to a demo session only when no real session exists.
// ============================================================
window.OSAS = Object.assign({
  SUPABASE_URL: 'https://rwqaeabxusivkyjgskko.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3cWFlYWJ4dXNpdmt5amdza2tvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1MjU4NzksImV4cCI6MjEwMjEwMTg3OX0.ViayPqKemu2fY3xPRifbnkdqfTOXz6RuN1nRbXEHfk0',

  // Send-notification Edge Function (deployed via `supabase functions deploy send-notification`).
  NOTIFY_FN_URL: 'https://rwqaeabxusivkyjgskko.functions.supabase.co/send-notification',

  // Companion shell may set this before the module boots.
  accessToken: '',
}, window.OSAS || {});
