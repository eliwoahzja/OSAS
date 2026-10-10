let client = null;
let listeners = [];
let checkingPassword = false;
let pendingPassword = '';
let pendingPasswordEmail = '';
let session = null;
let pendingPin = null;
const PIN_OK_KEY = 'osas.pin.ok';
const PIN_MAX_TRIES = 5;
const PIN_LOCK_MS = 30000;
let pinTries = 0;
let pinLockedUntil = 0;

const pinAccounts = () => (window.OSAS && window.OSAS.PIN_ACCOUNTS) || {};
const needsPin = (email) => Object.prototype.hasOwnProperty.call(pinAccounts(), String(email || '').toLowerCase());

async function sha256Hex(text) {
  if (!window.crypto || !window.crypto.subtle) throw new Error('PIN sign-in needs a secure (https) connection.');
  const buf = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function pinPassed(userId) {
  try { return sessionStorage.getItem(PIN_OK_KEY) === String(userId); } catch { return false; }
}

const DEVICE_KEY = 'osas.deviceToken';

function readDeviceToken() {
  try { return localStorage.getItem(DEVICE_KEY) || ''; } catch { return ''; }
}
function writeDeviceToken(t) {
  try { t ? localStorage.setItem(DEVICE_KEY, t) : localStorage.removeItem(DEVICE_KEY); } catch {}
}
export function forgetDevice() {
  writeDeviceToken('');
}

function saveSession(s) {
  session = s;
  listeners.forEach((fn) => {
    try { fn(s); } catch {}
  });
}

const AUTH_ATTEMPTS_MAX = 5; // kept in sync with the auth-gateway function

const authFnUrl = () => (window.OSAS && window.OSAS.AUTH_FN_URL) || '';
const authFnAvailable = () => Boolean(authFnUrl());

async function authFnPost(payload, timeoutMs = 20000) {
  const url = authFnUrl();
  if (!url) return null;
  const cfg = window.OSAS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: cfg.SUPABASE_ANON_KEY },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  } catch {
    return null; // gateway unreachable — callers fall back to direct Supabase auth
  } finally {
    clearTimeout(timer);
  }
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
      client = mod.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      });
      client.auth.onAuthStateChange((_event, s) => {
        if (checkingPassword || pendingPin) return;
        if (s) saveSession(toSession(s));
        else if (session && session.provider === 'supabase') saveSession(null);
      });
      return client;
    }
  } catch {
    return null;
  }
  return null;
}

async function requireClient() {
  const c = await getClient();
  if (!c) throw new Error('Cannot reach the sign-in service. Check your internet connection and try again.');
  return c;
}

function roleOf(user) {
  return user && user.app_metadata && user.app_metadata.role === 'admin' ? 'admin' : 'client';
}

function toSession(s) {
  const user = s.user;
  return {
    provider: 'supabase',
    user: {
      id: user.id,
      email: user.email,
      role: roleOf(user),
      name: (user.user_metadata && user.user_metadata.name) || user.email,
    },
    access_token: s.access_token,
  };
}

function friendly(err, fallback) {
  const m = String((err && err.message) || '');
  if (/invalid login credentials/i.test(m)) return 'Incorrect email or password.';
  if (/token has expired|invalid/i.test(m) && /token|otp|code/i.test(m)) return 'That code is incorrect or has expired. Request a new one.';
  if (/rate limit|too many|security purposes/i.test(m)) return 'Too many attempts. Please wait a minute before trying again.';
  if (/signups not allowed|user not found/i.test(m)) return 'No account exists for that email. Ask an administrator to create one.';
  return m || fallback;
}

function persistGatewaySession(s) {
  saveSession({
    provider: 'supabase',
    user: s.user,
    access_token: s.access_token,
    refresh_token: s.refresh_token,
  });
  if (s.refresh_token) trySetGatewayRefresh(s.refresh_token, s.expires_at);
}

let gatewayRefresh = null;
function trySetGatewayRefresh(refreshToken, expiresAt) {
  gatewayRefresh = { refreshToken, expiresAt: Number(expiresAt) || 0 };
  try { localStorage.setItem('osas.gwRefresh', JSON.stringify(gatewayRefresh)); } catch {}
}

export function onAuthChange(fn) {
  listeners.push(fn);
  return () => { listeners = listeners.filter((f) => f !== fn); };
}

export function getSession() {
  return session;
}

export function hasRealSession() {
  return Boolean(session && session.provider === 'supabase');
}

export function isSignedIn() {
  return Boolean(session);
}

export async function currentAccessToken() {
  if (session && session.provider === 'supabase' && client) {
    const { data } = await client.auth.getSession();
    if (data && data.session) return data.session.access_token;
    return null;
  }
  return null;
}

export function isAdmin() {
  return Boolean(session && session.user && session.user.role === 'admin');
}

export function currentUser() {
  return session ? session.user : null;
}

export async function signIn(email, password) {
  const addr = String(email || '').trim().toLowerCase();

  // Preferred path: the auth-gateway Edge Function tracks failed attempts and
  // locks the account after too many wrong passwords (see EMAIL-WIRING.md).
  if (authFnAvailable()) {
    const dt = readDeviceToken();
    const res = await authFnPost(dt ? { action: 'sign-in', email: addr, password, device_token: dt } : { action: 'sign-in', email: addr, password });
    if (res) {
      const d = (res && res.data) || {};
      if (d.trusted && d.session && d.session.access_token) {
        persistGatewaySession(d.session);
        return { done: true };
      }
      if (d.invalid_device || (d.error && /no longer authorized/i.test(d.error))) writeDeviceToken('');
      if (res.status >= 500 || (res.status === 0)) {
        // fall through to legacy path below
      } else {
        if (responseIsLocked(res)) {
          const e = new Error(d.error || 'This account is locked. Check your email for the unlock code.');
          e.locked = true;
          e.email = addr;
          e.unlockSent = d.unlock_sent !== false;
          throw e;
        }
        if (!res.ok || d.error) {
          if (d.error && /email not confirmed/i.test(d.error)) {
            const e = new Error('Please verify your email address first.');
            e.unconfirmed = true;
            throw e;
          }
          const e = new Error(d.error || friendly(null, 'Sign-in failed.'));
          if (typeof d.remaining === 'number') e.remaining = d.remaining;
          throw e;
        }
        // Password accepted by the gateway.
        if (needsPin(addr)) {
          pendingPin = { email: addr, userId: (d.user && d.user.id) || null, gateway: true };
          pinTries = 0;
          return { step: 'pin', email: addr, gateway: true };
        }
        await sendCode(addr);
        pendingPassword = password;
        pendingPasswordEmail = addr;
        return { step: 'otp', email: addr };
      }
    }
  }

  // Legacy path (auth-gateway not deployed or unreachable): direct Supabase
  // sign-in. No lockout tracking is possible here.
  const c = await requireClient();
  checkingPassword = true;
  try {
    const { data: signed, error } = await c.auth.signInWithPassword({ email: addr, password });
    if (error) {
      if (/email not confirmed/i.test(error.message || '')) {
        const e = new Error('Please verify your email address first.');
        e.unconfirmed = true;
        throw e;
      }
      throw new Error(friendly(error, 'Sign-in failed.'));
    }
    if (needsPin(addr) && signed && signed.session) {
      pendingPin = { email: addr, session: toSession(signed.session), userId: signed.session.user.id };
      pinTries = 0;
      return { step: 'pin', email: addr };
    }
    await c.auth.signOut();
  } finally {
    checkingPassword = false;
  }
  await sendCode(addr);
  pendingPassword = password;
  pendingPasswordEmail = addr;
  return { step: 'otp', email: addr };
}

function responseIsLocked({ data }) {
  return Boolean(data && (data.locked === true));
}

export function accountLocked(res) {
  return responseIsLocked(res);
}

export async function sendUnlockCode(email) {
  const res = await authFnPost({ action: 'resend-unlock', email: String(email || '').trim().toLowerCase() });
  if (!res) throw new Error('Cannot reach the unlock service. Check your internet connection and try again.');
  const d = res.data || {};
  if (!res.ok || d.error) throw new Error(d.error || 'Could not send the unlock code.');
  return d;
}

export async function unlockWithCode(email, code, pageToken) {
  const res = await authFnPost({
    action: 'unlock',
    email: String(email || '').trim().toLowerCase(),
    code: String(code || '').trim(),
    k: String(pageToken || '').trim(),
  });
  if (!res) throw new Error('Cannot reach the unlock service. Check your internet connection and try again.');
  const d = res.data || {};
  if (!res.ok || d.error) throw new Error(d.error || 'Could not unlock the account.');
  return d;
}

export async function changePasswordAfterUnlock(resetToken, password) {
  const res = await authFnPost({ action: 'change-password', reset_token: String(resetToken || '').trim(), password: String(password || '') });
  if (!res) throw new Error('Cannot reach the unlock service. Check your internet connection and try again.');
  const d = res.data || {};
  if (!res.ok || d.error) throw new Error(d.error || 'Could not set the new password.');
  return d;
}

export function pendingPasswordFor(addr) {
  if (pendingPasswordEmail && pendingPasswordEmail !== String(addr || '').toLowerCase()) return '';
  return pendingPassword;
}

export const MAX_LOGIN_ATTEMPTS = AUTH_ATTEMPTS_MAX; // shown in the UI (locks after 5)

export function pinLockSeconds() {
  return Math.max(0, Math.ceil((pinLockedUntil - Date.now()) / 1000));
}

export async function verifyPin(pin) {
  if (!pendingPin) throw new Error('Your sign-in expired. Enter your email and password again.');
  const wait = pinLockSeconds();
  if (wait > 0) throw Object.assign(new Error(`Too many wrong PINs. Try again in ${wait}s.`), { locked: true });
  const expected = pinAccounts()[pendingPin.email];
  const actual = await sha256Hex(`osas-pin:${pendingPin.email}:${String(pin)}`);
  if (actual !== expected) {
    pinTries += 1;
    if (pinTries >= PIN_MAX_TRIES) {
      pinTries = 0;
      pinLockedUntil = Date.now() + PIN_LOCK_MS;
      throw Object.assign(new Error(`Too many wrong PINs. Try again in ${PIN_LOCK_MS / 1000}s.`), { locked: true });
    }
    throw new Error(`Wrong PIN. ${PIN_MAX_TRIES - pinTries} ${PIN_MAX_TRIES - pinTries === 1 ? 'try' : 'tries'} left.`);
  }
  if (pendingPin.gateway) {
    // Gateway mode: no Supabase session exists yet — continue to the emailed
    // code step after the PIN is accepted.
    const email = pendingPin.email;
    pendingPin = null;
    await sendCode(email);
    return { step: 'otp' };
  }
  const ok = pendingPin;
  pendingPin = null;
  try { sessionStorage.setItem(PIN_OK_KEY, String(ok.userId)); } catch {}
  saveSession(ok.session);
  return session;
}

function pendingEmail() { return (pendingPin && pendingPin.email) || ''; }

export async function cancelPin() {
  pendingPassword = '';
  pendingPasswordEmail = '';
  if (!pendingPin) return;
  pendingPin = null;
  try { if (client) await client.auth.signOut(); } catch {}
}

export async function register({ name, email, password }) {
  const c = await requireClient();
  const addr = String(email || '').trim().toLowerCase();
  checkingPassword = true;
  try {
    const { data, error } = await c.auth.signUp({
      email: addr,
      password,
      options: { data: { name: String(name || '').trim() } },
    });
    if (error) {
      if (/signups? (not allowed|are disabled)/i.test(error.message || '')) {
        throw new Error('Self-registration is turned off. Ask an administrator to create your account.');
      }
      if (/already|registered/i.test(error.message || '')) throw new Error('An account with that email already exists.');
      throw new Error(friendly(error, 'Could not create the account.'));
    }
    if (data && data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new Error('An account with that email already exists.');
    }
    const needsConfirm = !(data && data.session);
    if (!needsConfirm) await c.auth.signOut();
    return { email: addr, needsConfirm };
  } finally {
    checkingPassword = false;
  }
}

export async function verifySignup(email, code) {
  pendingPassword = '';
  pendingPasswordEmail = '';
  const c = await requireClient();
  const token = String(code || '').replace(/\s+/g, '');
  const { data, error } = await c.auth.verifyOtp({
    email: String(email).trim().toLowerCase(),
    token,
    type: 'signup',
  });
  if (error || !data || !data.session) throw new Error(friendly(error, 'Verification failed.'));
  saveSession(toSession(data.session));
  return session;
}

export async function resendSignup(email) {
  const c = await requireClient();
  const { error } = await c.auth.resend({ type: 'signup', email: String(email).trim().toLowerCase() });
  if (error) throw new Error(friendly(error, 'Could not resend the code.'));
}

export async function sendCode(email) {
  const c = await requireClient();
  const { error } = await c.auth.signInWithOtp({
    email: String(email).trim().toLowerCase(),
    options: { shouldCreateUser: false },
  });
  if (error) {
    const msg = friendly(error, 'Could not send the code.');
    const layered = layerEmailError(error, msg);
    const e = new Error(layered);
    e.sendError = error;
    throw e;
  }
}

function layerEmailError(error, fallback) {
  const m = String((error && error.message) || '').toLowerCase();
  if (/email provider not configured|email is not configured|no email.*provider/i.test(m)) {
    return 'Sign-in by email code is not set up yet. Ask an administrator to configure Supabase Auth email (Authentication → Email, SMTP or a working custom provider) and redeploy the project.';
  }
  if (/rate limit|too many/i.test(m)) return 'Too many code requests. Wait a minute before trying again.';
  if (/invalid login credentials|user not found|no account/i.test(m)) return 'No account exists for that email. Ask an administrator to create one.';
  return fallback;
}

export async function verifyCode(email, code, remember = false, password = '') {
  const addr = String(email).trim().toLowerCase();
  if (authFnAvailable() && password) {
    pendingPassword = '';
    pendingPasswordEmail = '';
    const res = await authFnPost({ action: 'verify-trusted', email: addr, code: String(code || '').replace(/\s+/g, ''), password, remember: remember === true });
    if (res) {
      const d = (res && res.data) || {};
      if (!res.ok || d.error) throw new Error(d.error || 'That code is incorrect or has expired. Request a new one.');
      persistGatewaySession(d.session);
      if (d.device_token) writeDeviceToken(d.device_token);
      else writeDeviceToken('');
      return session;
    }
  }
  const c = await requireClient();
  const token = String(code || '').replace(/\s+/g, '');
  const { data, error } = await c.auth.verifyOtp({
    email: String(email).trim().toLowerCase(),
    token,
    type: 'email',
  });
  if (error || !data || !data.session) throw new Error(friendly(error, 'Verification failed.'));
  saveSession(toSession(data.session));
  return session;
}

export async function signOut() {
  pendingPin = null;
  try { sessionStorage.removeItem(PIN_OK_KEY); } catch {}
  try {
    if (client) await client.auth.signOut();
  } catch {}
  saveSession(null);
}

export async function restore() {
  if (!supabaseConfigured()) {
    session = null;
    return null;
  }
  const c = await getClient();
  if (!c) return null;
  const { data } = await c.auth.getSession();
  if (data && data.session) {
    const u = data.session.user;
    if (needsPin(u.email) && !pinPassed(u.id)) {
      try { await c.auth.signOut(); } catch {}
      saveSession(null);
      return null;
    }
    saveSession(toSession(data.session));
    return session;
  }
  saveSession(null);
  return null;
}
