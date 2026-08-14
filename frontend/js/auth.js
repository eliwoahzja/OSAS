// ============================================================
// OSAS authentication — Supabase Auth (client-side) with a dev
// session fallback when no Supabase keys are configured.
// ============================================================

const AUTH_KEY = 'osas.session.v1';

let client = null;          // supabase-js client (lazy)
let listeners = [];
let session = loadSession();

function loadSession() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(s) {
  session = s;
  if (s) localStorage.setItem(AUTH_KEY, JSON.stringify(s));
  else localStorage.removeItem(AUTH_KEY);
  listeners.forEach((fn) => fn(s));
}

async function getClient() {
  if (client) return client;
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.OSAS;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  // supabase-js v2 from CDN — only loaded when keys are configured
  await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  client = sb;
  return sb;
}

function devSession() {
  // Dev fallback session (no Supabase keys) — simulates an Admin.
  return {
    provider: 'dev',
    user: { email: 'admin@saac.ph', role: 'admin', name: 'Local Administrator' },
    access_token: 'dev-token',
  };
}

export function onAuthChange(fn) {
  listeners.push(fn);
  return () => { listeners = listeners.filter((f) => f !== fn); };
}

export function getSession() {
  return session;
}

export function isAdmin() {
  return !session || session.user.role === 'admin';
}

export function currentUser() {
  return session ? session.user : null;
}

export function usesSupabaseAuth() {
  return Boolean(window.OSAS.SUPABASE_URL && window.OSAS.SUPABASE_ANON_KEY);
}

/** Start a session (called after Supabase sign-in or in dev mode). */
export function setSession(s) {
  saveSession(s);
}

/** Email + password sign-in via Supabase Auth. */
export async function login(email, password) {
  const sb = await getClient();
  if (!sb) {
    // Dev mode: accept the demo credentials, otherwise sign in as admin.
    if (email === 'staff@saac.ph' && password) {
      saveSession({
        provider: 'dev',
        user: { email: 'staff@saac.ph', role: 'staff', name: 'Staff Member' },
        access_token: 'dev-token-staff',
      });
    } else {
      saveSession(devSession());
    }
    return { ok: true, provider: 'dev' };
  }
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: error.message };
  saveSession({
    provider: 'supabase',
    user: { email: data.user.email, role: data.user.user_metadata?.role || 'staff', name: data.user.user_metadata?.name || data.user.email },
    access_token: data.session.access_token,
  });
  return { ok: true, provider: 'supabase' };
}

/** Magic-link email sign-in via Supabase Auth. */
export async function magicLink(email) {
  const sb = await getClient();
  if (!sb) {
    return { ok: false, error: 'Supabase is not configured — use email + password (demo) instead.' };
  }
  const { error } = await sb.auth.signInWithOtp({ email });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function logout() {
  const sb = await getClient();
  if (sb) await sb.auth.signOut().catch(() => {});
  saveSession(null);
}

/** Restore a Supabase session on boot (dev mode boots straight in). */
export async function restore() {
  const sb = await getClient();
  if (!sb) {
    if (!session) saveSession(devSession());
    return;
  }
  const { data } = await sb.auth.getSession();
  if (data.session) {
    saveSession({
      provider: 'supabase',
      user: { email: data.session.user.email, role: data.session.user.user_metadata?.role || 'staff', name: data.session.user.user_metadata?.name || data.session.user.email },
      access_token: data.session.access_token,
    });
  }
}
