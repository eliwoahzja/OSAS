import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { createResetHandler } from './core.ts';
import { sendMail } from './mail.ts';

const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const TABLE = 'password_reset_requests';
const checked = (result: any) => { if (result.error) throw result.error; return result.data; };
const store = {
  async submit(email: string, ipHash: string, name: string, kind: string) {
    return checked(await svc.rpc('submit_account_request', { p_email: email, p_ip_hash: ipHash, p_name: name, p_kind: kind }));
  },
  async get(id: string) { return checked(await svc.from(TABLE).select('*').eq('id', id).single()); },
  async patch(id: string, patch: any, status?: string) {
    let query = svc.from(TABLE).update(patch).eq('id', id);
    if (status) query = query.eq('status', status);
    const rows = checked(await query.select('id'));
    if (!rows?.length) throw new Error('Request state changed.');
  },
  async claim(id: string, states: string[], patch: any, match?: any) {
    let query = svc.from(TABLE).update(patch).eq('id', id).in('status', states);
    if (match) query = query.eq('token_hash', match.token_hash).gt('expires_at', match.expires_after);
    return checked(await query.select('*').maybeSingle());
  },
  async list() {
    return checked(await svc.from(TABLE)
      .select('id,email,name,submitted_name,request_kind,role,account_created_at,last_sign_in_at,requested_at,status,reviewed_at,expires_at,completed_at,notification_error')
      .order('requested_at', { ascending: false }).limit(100));
  },
  async actor(jwt: string) {
    const { data, error } = await svc.auth.getUser(jwt);
    return error ? null : data.user;
  },
  async account(id: string) {
    const { data, error } = await svc.auth.admin.getUserById(id);
    if (error) throw error;
    return data.user;
  },
  async adminEmails() {
    const addresses: string[] = [];
    for (let page = 1; ; page++) {
      const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      for (const user of data.users) {
        if (user.app_metadata?.role === 'admin' && user.email) addresses.push(user.email);
      }
      if (data.users.length < 200) break;
    }
    return [...new Set(addresses)];
  },
  async emailExists(email: string) {
    return checked(await svc.rpc('account_request_email_exists', { p_email: email }));
  },
  async createAccount(record: any, password: string) {
    // Never reuse an existing account or accept a role supplied by the requester.
    const { data, error } = await svc.auth.admin.createUser({
      email: record.email, password, email_confirm: true,
      app_metadata: { role: 'client' }, user_metadata: { name: record.submitted_name || record.name },
    });
    if (error || !data.user) throw new Error('Could not create the account. The email may already be registered or the password may not meet account policy.');
    const profile = await svc.from('users').upsert({ id: data.user.id, email: record.email, full_name: record.submitted_name || record.name, role: 'staff' });
    if (profile.error) console.error('Account profile sync failed');
    return data.user;
  },
  async updatePassword(id: string, password: string) {
    const { error } = await svc.auth.admin.updateUserById(id, { password });
    if (error) throw error;
  },
};
const handler = createResetHandler({ store, sendMail, appUrl: Deno.env.get('APP_URL') || 'https://stagnesacademy.vercel.app/' });
Deno.serve(async (req: Request) => {
  const cors = {
    'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, apikey, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Cache-Control': 'no-store',
  };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  const response = await handler(req);
  for (const [key, value] of Object.entries(cors)) response.headers.set(key, value);
  return response;
});
