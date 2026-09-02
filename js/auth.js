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
  if (s) localStorage.setItem(AUTH_KEY, JSON.stringify(s));
  else localStorage.removeItem(AUTH_KEY);
  listeners.forEach((fn) => fn(s));
}

async function getClient() {
  if (client) return client;
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.OSAS;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  const mod = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  client = mod.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}

function decodeClaims(token) {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(escape(atob(part))));
  } catch {
    return null;
  }
}

function injectedSession() {
  const t = window.OSAS && window.OSAS.accessToken;
  if (!t) return null;
  const claims = decodeClaims(t) || {};
  const role = claims.user_metadata && claims.user_metadata.role === 'admin' ? 'admin' : 'staff';
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

function devSession() {
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

export function hasRealSession() {
  return Boolean(session && (session.provider === 'supabase' || session.provider === 'injected'));
}

export async function currentAccessToken() {
  const s = session;
  if (!s) return window.OSAS.SUPABASE_ANON_KEY || null;
  if (s.provider === 'injected') return s.access_token || null;
  if (s.provider !== 'supabase') return window.OSAS.SUPABASE_ANON_KEY || null;
  const sb = await getClient();
  if (!sb) return s.access_token || null;
  const { data } = await sb.auth.getSession();
  if (data.session && data.session.access_token) {
    if (data.session.access_token !== s.access_token) {
      saveSession({
        ...s,
        access_token: data.session.access_token,
        user: {
          email: data.session.user.email,
          role: data.session.user.user_metadata?.role || 'staff',
          name: data.session.user.user_metadata?.name || data.session.user.email,
        },
      });
    }
    return data.session.access_token;
  }
  return s.access_token || null;
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

export function setSession(s) {
  saveSession(s);
}

export async function restore() {
  const inj = injectedSession();
  if (inj) {
    saveSession(inj);
    return;
  }
  const sb = await getClient();
  if (!sb) {
    if (!session) saveSession(devSession());
    return;
  }
  const { data } = await sb.auth.getSession();
  if (data.session) {
    saveSession({
      provider: 'supabase',
      user: {
        email: data.session.user.email,
        role: data.session.user.user_metadata?.role || 'staff',
        name: data.session.user.user_metadata?.name || data.session.user.email,
      },
      access_token: data.session.access_token,
    });
    return;
  }
  if (!session) saveSession(devSession());
}
