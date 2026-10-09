window.OSAS = Object.assign({
  SUPABASE_URL: getConfig('SUPABASE_URL', 'https://rwqaeabxusivkyjgskko.supabase.co'),
  SUPABASE_ANON_KEY: getConfig('SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3cWFlYWJ4dXNpdmt5amdza2tvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1MjU4NzksImV4cCI6MjEwMjEwMTg3OX0.ViayPqKemu2fY3xPRifbnkdqfTOXz6RuN1nRbXEHfk0'),

  NOTIFY_FN_URL: getConfig('NOTIFY_FN_URL', 'https://rwqaeabxusivkyjgskko.functions.supabase.co/send-notification'),
  accessToken: '',
  MAILEROO_API_KEY: getConfig('MAILEROO_API_KEY', ''),
  SMTP_HOST: getConfig('SMTP_HOST', ''),
  SMTP_USER: getConfig('SMTP_USER', ''),
  SMTP_FROM: getConfig('SMTP_FROM', ''),
  PIN_ACCOUNTS: getConfig('PIN_ACCOUNTS', {
    'admin@saac.ph': 'aefae39c478dd0d0c461d6463e22bd7a14639a473bf020dfb24dfd21703f1dc3',
  }),
}, window.OSAS || {});

window.OSAS.toggleSidebar = () => {
  document.getElementById('sidebar').classList.toggle('-translate-x-full');
  document.getElementById('sidebar-backdrop').classList.toggle('hidden');
};

function getConfig(key, fallback) {
  try {
    if (key in window.OSAS && window.OSAS[key] !== undefined && window.OSAS[key] !== null) return window.OSAS[key];
  } catch {}
  if (typeof process !== 'undefined' && process.env && key in process.env && process.env[key] !== undefined) return process.env[key];
  if (typeof Deno !== 'undefined' && Deno.env && Deno.env.get(key) !== undefined) return Deno.env.get(key);
  return fallback;
}
