// Runtime config. Static site: the browser talks to Supabase directly.
// The anon key is public by design; the service key only lives in Edge
// Function secrets. accessToken lets the companion app inject a session.
window.OSAS = Object.assign({
  SUPABASE_URL: 'https://rwqaeabxusivkyjgskko.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3cWFlYWJ4dXNpdmt5amdza2tvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1MjU4NzksImV4cCI6MjEwMjEwMTg3OX0.ViayPqKemu2fY3xPRifbnkdqfTOXz6RuN1nRbXEHfk0',

  NOTIFY_FN_URL: 'https://rwqaeabxusivkyjgskko.functions.supabase.co/send-notification',
  accessToken: '',
}, window.OSAS || {});
