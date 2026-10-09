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
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...CORS } });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  if (body.action === 'list') {
    const { data, error } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) return json({ error: error.message }, 500);
    const users = (data.users || []).map((u: any) => ({
      id: u.id,
      email: u.email,
      name: u.user_metadata?.name || u.email,
      role: roleOf(u),
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
    }));
    return json({ users, me: who.user.id });
  }

  if (body.action === 'create') {
    const email = String(body.email || '').trim().toLowerCase();
    const name = String(body.name || '').trim();
    const password = String(body.password || '');
    const role = body.role === 'admin' ? 'admin' : body.role === 'client' ? 'client' : '';
    if (!EMAIL_RE.test(email)) return json({ error: 'Enter a valid email address.' }, 400);
    if (name.length < 2 || name.length > 120) return json({ error: 'Enter the person’s full name.' }, 400);
    if (password.length < 8) return json({ error: 'Password must be at least 8 characters.' }, 400);
    if (!role) return json({ error: 'Role must be admin or client.' }, 400);

    const { data, error } = await svc.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role },
      user_metadata: { name },
    });
    if (error || !data?.user) {
      const msg = error?.message || 'Could not create the account.';
      return json({ error: /already|registered|exists/i.test(msg) ? 'An account with that email already exists.' : msg }, 400);
    }
    await svc.from('users').upsert({
      id: data.user.id, role: role === 'admin' ? 'admin' : 'staff', full_name: name, email,
    });
    return json({ user: { id: data.user.id, email, name, role } }, 201);
  }

  const otherAdminExists = async (excludeId: string) => {
    const { data } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 });
    return (data?.users || []).some((u: any) => u.id !== excludeId && roleOf(u) === 'admin');
  };

  if (body.action === 'update') {
    const id = String(body.id || '');
    if (!UUID_RE.test(id)) return json({ error: 'Invalid user id.' }, 400);
    const { data: found, error: findErr } = await svc.auth.admin.getUserById(id);
    if (findErr || !found?.user) return json({ error: 'Account not found.' }, 404);
    const target = found.user;

    const name = body.name === undefined ? (target.user_metadata?.name || '') : String(body.name).trim();
    const email = body.email === undefined ? String(target.email || '') : String(body.email).trim().toLowerCase();
    const role = body.role === undefined ? roleOf(target) : body.role === 'admin' ? 'admin' : body.role === 'client' ? 'client' : '';
    const password = body.password ? String(body.password) : '';

    if (!EMAIL_RE.test(email)) return json({ error: 'Enter a valid email address.' }, 400);
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
      app_metadata: { ...(target.app_metadata || {}), role },
      user_metadata: { ...(target.user_metadata || {}), name },
    };
    if (password) changes.password = password;
    const { error } = await svc.auth.admin.updateUserById(id, changes);
    if (error) {
      const msg = error.message || 'Could not update the account.';
      return json({ error: /already|registered|exists/i.test(msg) ? 'Another account already uses that email.' : msg }, 400);
    }
    await svc.from('users').upsert({ id, role: role === 'admin' ? 'admin' : 'staff', full_name: name, email });
    return json({ user: { id, email, name, role } });
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
});
