import { currentAccessToken } from './auth.js';

export async function passwordResetCall(payload, admin = false) {
  const cfg = window.OSAS || {};
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) throw new Error('Password reset requests require the connected account service.');
  const token = admin ? await currentAccessToken() : cfg.SUPABASE_ANON_KEY;
  if (!token) throw new Error('Sign in as an administrator first.');
  let response;
  try {
    response = await fetch(`${cfg.SUPABASE_URL}/functions/v1/password-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: cfg.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
  } catch { throw new Error('Could not reach the password reset service. Check your connection and retry.'); }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || 'Password reset request failed.');
  return data;
}

export function readResetLink(hash = window.location.hash) {
  if (!hash.startsWith('#/reset-password')) return null;
  const query = new URLSearchParams(hash.split('?')[1] || '');
  return { id: query.get('request') || '', token: query.get('token') || '' };
}
