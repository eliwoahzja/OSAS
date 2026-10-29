import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || '*';

const CORS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...CORS } });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_DOMAIN = (Deno.env.get('EMAIL_DOMAIN') || 'saac.edu.ph').toLowerCase();
const USERNAME_RE = /^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/;

// Accept older clients that supplied a school username in the email field.
// New clients send a username separately from the actual delivery email.
const resolveEmail = (raw: string): { email: string; username: string | null } | null => {
  const value = String(raw || '').trim().toLowerCase();
  if (!value) return null;
  if (value.includes('@')) {
    if (value.length <= 254 && EMAIL_RE.test(value)) return { email: value, username: null };
    return null;
  }
  return USERNAME_RE.test(value) ? { email: `${value}@${EMAIL_DOMAIN}`, username: value } : null;
};

const roleOf = (u: any) => (u?.app_metadata?.role === 'admin' ? 'admin' : 'client');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  if (!SERVICE_ROLE_KEY) return json({ error: 'Service role key is not available to this function.' }, 500);

  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ error: 'Sign-in required.' }, 401);

  const svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: who, error: whoErr } = await svc.auth.getUser(jwt);
  if (whoErr || !who?.user) return json({ error: 'Your session is invalid or expired.' }, 401);
  if (roleOf(who.user) !== 'admin') return json({ error: 'Administrators only.' }, 403);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON.' }, 400); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Invalid request.' }, 400);

  const allUsers = async () => {
    const users: any[] = [];
    for (let page = 1; ; page++) {
      const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      users.push(...(data?.users || []));
      if ((data?.users || []).length < 200) break;
    }
    return users;
  };
  const usernameTaken = async (username: string, excludeId = '') => {
    const { data, error } = await svc.from('users').select('id').eq('username', username).maybeSingle();
    if (error) throw error;
    return Boolean(data && data.id !== excludeId);
  };

  try {
  if (body.action === 'list') {
    const accounts = await allUsers();
    const { data: profiles, error } = await svc.from('users').select('id,username');
    if (error) return json({ error: error.message }, 500);
    const usernames = new Map((profiles || []).map((u: any) => [u.id, u.username]));
    const users = accounts.map((u: any) => ({
      id: u.id,
      email: u.email,
      username: usernames.get(u.id) || '',
      name: u.user_metadata?.name || u.email,
      role: roleOf(u),
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
    }));
    return json({ users, me: who.user.id });
  }

  if (body.action === 'create') {
    const resolved = resolveEmail(body.email);
    if (!resolved) return json({ error: 'Enter a valid username or email address.' }, 400);
    const email = resolved.email;
    const username = String(body.username ?? resolved.username ?? '').trim().toLowerCase();
    if ((body.username !== undefined || username) && !USERNAME_RE.test(username)) return json({ error: 'Enter a valid username (1 to 64 letters, numbers, dots, dashes, or underscores).' }, 400);
    const name = String(body.name || '').trim();
    const password = String(body.password || '');
    const role = body.role === 'admin' ? 'admin' : body.role === 'client' ? 'client' : '';
    if (name.length < 2 || name.length > 120) return json({ error: 'Enter the person’s full name.' }, 400);
    if (password.length < 8) return json({ error: 'Password must be at least 8 characters.' }, 400);
    if (!role) return json({ error: 'Role must be admin or client.' }, 400);

    if (username && await usernameTaken(username)) return json({ error: 'Username is already taken.' }, 400);

    const { data, error } = await svc.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role, ...(username ? { username } : {}) },
      user_metadata: { name },
    });
    if (error || !data?.user) {
      const msg = error?.message || 'Could not create the account.';
      if (username && await usernameTaken(username)) return json({ error: 'Username is already taken.' }, 400);
      return json({ error: /already|registered|exists/i.test(msg)
        ? (resolved.username ? 'Username is already taken.' : 'An account with that email already exists.')
        : msg }, 400);
    }
    // The Auth trigger writes the public profile in the same transaction.
    const { data: profile, error: profileError } = await svc.from('users').select('username').eq('id', data.user.id).single();
    if (profileError) throw profileError;
    return json({ user: { id: data.user.id, email, username: profile.username, name, role } }, 201);
  }

  const otherAdminExists = async (excludeId: string) => {
    return (await allUsers()).some((u: any) => u.id !== excludeId && roleOf(u) === 'admin');
  };

  if (body.action === 'update') {
    const id = String(body.id || '');
    if (!UUID_RE.test(id)) return json({ error: 'Invalid user id.' }, 400);
    const { data: found, error: findErr } = await svc.auth.admin.getUserById(id);
    if (findErr || !found?.user) return json({ error: 'Account not found.' }, 404);
    const target = found.user;
    const { data: profile, error: profileError } = await svc.from('users').select('username').eq('id', id).single();
    if (profileError) throw profileError;

    const name = body.name === undefined ? (target.user_metadata?.name || '') : String(body.name).trim();
    const resolvedEmail = resolveEmail(body.email === undefined ? String(target.email || '') : String(body.email));
    if (!resolvedEmail) return json({ error: 'Enter a valid username or email address.' }, 400);
    const email = resolvedEmail.email;
    const username = String(body.username ?? profile.username).trim().toLowerCase();
    if (!USERNAME_RE.test(username)) return json({ error: 'Enter a valid username (1 to 64 letters, numbers, dots, dashes, or underscores).' }, 400);
    const role = body.role === undefined ? roleOf(target) : body.role === 'admin' ? 'admin' : body.role === 'client' ? 'client' : '';
    const password = body.password ? String(body.password) : '';

    if (await usernameTaken(username, id)) return json({ error: 'Username is already taken.' }, 400);
    if (name.length < 2 || name.length > 120) return json({ error: 'Enter the person’s full name.' }, 400);
    if (!role) return json({ error: 'Role must be admin or client.' }, 400);
    if (password && password.length < 8) return json({ error: 'New password must be at least 8 characters.' }, 400);
    if (roleOf(target) === 'admin' && role !== 'admin') {
      if (id === who.user.id) return json({ error: 'You cannot remove your own administrator access.' }, 400);
      if (!(await otherAdminExists(id))) return json({ error: 'At least one administrator must remain.' }, 400);
    }

    const changes: Record<string, unknown> = {
      email,
      email_confirm: true,
      app_metadata: { ...(target.app_metadata || {}), role, username },
      user_metadata: { ...(target.user_metadata || {}), name },
    };
    if (password) changes.password = password;
    const { error } = await svc.auth.admin.updateUserById(id, changes);
    if (error) {
      const msg = error.message || 'Could not update the account.';
      if (await usernameTaken(username, id)) return json({ error: 'Username is already taken.' }, 400);
      return json({ error: /already|registered|exists/i.test(msg)
        ? (resolvedEmail.username ? 'Username is already taken.' : 'Another account already uses that email.')
        : msg }, 400);
    }
    return json({ user: { id, email, username, name, role } });
  }

  if (body.action === 'delete') {
    const id = String(body.id || '');
    if (!UUID_RE.test(id)) return json({ error: 'Invalid user id.' }, 400);
    if (id === who.user.id) return json({ error: 'You cannot delete your own account.' }, 400);
    const { data: found } = await svc.auth.admin.getUserById(id);
    if (found?.user && roleOf(found.user) === 'admin' && !(await otherAdminExists(id))) {
      return json({ error: 'At least one administrator must remain.' }, 400);
    }
    const { error } = await svc.auth.admin.deleteUser(id);
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }

  return json({ error: 'Unknown action.' }, 400);
  } catch {
    return json({ error: 'The account service is unavailable. Please try again shortly.' }, 503);
  }
});
