const AUTH_KEY = 'osas.session.v1';

let client = null;
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
  try {
    if (s) localStorage.setItem(AUTH_KEY, JSON.stringify(s));
    else localStorage.removeItem(AUTH_KEY);
  } catch {}
  listeners.forEach((fn) => {
    try { fn(s); } catch {}
  });
}

export function supabaseConfigured() {
  const cfg = window.OSAS || {};
  return Boolean(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);
}

async function getClient(timeoutMs = 8000) {
  if (client) return client;
  if (!supabaseConfigured()) return null;
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.OSAS;
  try {
    const modPromise = import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Supabase client load timeout')), timeoutMs)
    );
    const mod = await Promise.race([modPromise, timeoutPromise]);
    if (mod && typeof mod.createClient === 'function') {
      client = mod.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      return client;
    }
  } catch {
    return null;
  }
  return null;
}

function decodeClaims(token) {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(escape(atob(part))));
  } catch {
    return null;
  }
}

// The role must come from app_metadata: it can only be set server-side.
// user_metadata is editable by the signed-in user, so it is never trusted.
function roleOf(user) {
  return user && user.app_metadata && user.app_metadata.role === 'admin' ? 'admin' : 'staff';
}

function toSessionUser(user) {
  return {
    email: user.email,
    role: roleOf(user),
    name: (user.user_metadata && user.user_metadata.name) || user.email,
  };
}

function injectedSession() {
  const t = window.OSAS && window.OSAS.accessToken;
  if (!t) return null;
  const claims = decodeClaims(t) || {};
  const role = claims.app_metadata && claims.app_metadata.role === 'admin' ? 'admin' : 'staff';
  return {
    provider: 'injected',
    user: {
      email: claims.email || 'signed-in@saac.ph',
      role,
      name: (claims.user_metadata && claims.user_metadata.name) || claims.email || 'Signed-in user',
    },
    access_token: t,
  };
}

function demoSession() {
  return {
    provider: 'dev',
    user: { email: 'demo@saac.ph', role: 'admin', name: 'Demo Administrator' },
    access_token: null,
  };
}

export function onAuthChange(fn) {
  listeners.push(fn);
  return () => { listeners = listeners.filter((f) => f !== fn); };
}

export function getSession() {
  return session;
}

export function isDemo() {
  return Boolean(session && session.provider === 'dev');
}

export function hasRealSession() {
  return Boolean(session && (session.provider === 'supabase' || session.provider === 'injected'));
}

export async function currentAccessToken() {
  // No login required — use the anon key directly for all API calls.
  const { SUPABASE_ANON_KEY } = window.OSAS || {};
  return SUPABASE_ANON_KEY || null;
}

// No session means no privileges.
export function isAdmin() {
  return true;
}

export function currentUser() {
  return session ? session.user : { name: 'Local Administrator', email: 'admin@saac.ph', role: 'admin' };
}

export function usesSupabaseAuth() {
  return false;
}

export async function signIn() {}

export async function signOut() {
  saveSession(null);
}

export function enterDemo() {
  saveSession(demoSession());
}

export async function restore() {
  // No login required — always enter as admin.
  saveSession({
    provider: 'local',
    user: { email: 'admin@saac.ph', role: 'admin', name: 'Local Administrator' },
    access_token: null,
  });
}
