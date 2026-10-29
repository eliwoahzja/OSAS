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

  try {
  if (body.action === 'list') {
    const accounts = await allUsers();
    // The Data API has a row limit independent of Auth pagination. Read the
    // matching profiles in bounded batches so IDs remain available after the
    // directory grows beyond that limit.
    const studentIds = new Map<string, string>();
    for (let offset = 0; offset < accounts.length; offset += 200) {
      const ids = accounts.slice(offset, offset + 200).map((u: any) => u.id);
      const { data: profiles, error } = await svc.from('users').select('id,student_id').in('id', ids);
      if (error) return json({ error: 'Account IDs could not be loaded. Refresh Accounts and try again.' }, 503);
      for (const profile of profiles || []) studentIds.set(profile.id, profile.student_id);
    }
    const users = accounts.map((u: any) => ({
      id: u.id,
      email: u.email,
      student_id: studentIds.get(u.id) || null,
      name: u.user_metadata?.name || u.email,
      role: roleOf(u),
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
    }));
    return json({ users, me: who.user.id });
  }

  if (body.action === 'create') {
    const email = String(body.email || '').trim().toLowerCase();
    if (email.length > 254 || !EMAIL_RE.test(email)) return json({ error: 'Enter a valid email address.' }, 400);
    if (body.student_id !== undefined || body.username !== undefined) return json({ error: 'Student IDs are generated automatically. Do not supply an ID or username.' }, 400);
    const name = String(body.name || '').trim();
    const password = String(body.password || '');
    const role = body.role === 'admin' ? 'admin' : body.role === 'client' ? 'client' : '';
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
    // The Auth trigger writes the public profile in the same transaction.
    const { data: profile, error: profileError } = await svc.from('users').select('student_id').eq('id', data.user.id).single();
    if (profileError) throw profileError;
    return json({ user: { id: data.user.id, email, student_id: profile.student_id, name, role } }, 201);
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
    const name = body.name === undefined ? (target.user_metadata?.name || '') : String(body.name).trim();
    const email = String(body.email ?? target.email ?? '').trim().toLowerCase();
    if (email.length > 254 || !EMAIL_RE.test(email)) return json({ error: 'Enter a valid email address.' }, 400);
    if (body.student_id !== undefined || body.username !== undefined) return json({ error: 'Student IDs are generated automatically and cannot be edited.' }, 400);
    const role = body.role === undefined ? roleOf(target) : body.role === 'admin' ? 'admin' : body.role === 'client' ? 'client' : '';
    const password = body.password ? String(body.password) : '';

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
    const { data: profile, error: profileError } = await svc.from('users').select('student_id').eq('id', id).single();
    if (profileError) throw profileError;
    return json({ user: { id, email, student_id: profile.student_id, name, role } });
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
