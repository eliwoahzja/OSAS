import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { createAdminPinHandler, hasPasswordAuthentication } from './core.ts';

const service = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const handler = createAdminPinHandler({
  async actor(jwt) {
    const { data, error } = await service.auth.getUser(jwt);
    if (error || !data?.user) return null;
    return { id: data.user.id, app_metadata: data.user.app_metadata, password_verified: hasPasswordAuthentication(jwt) };
  },
  async pinAction(userId, action, pin) {
    const { data, error } = await service.rpc('osas_admin_pin_action', { p_user_id: userId, p_action: action, p_pin: pin });
    if (error) throw error;
    return data;
  },
});
Deno.serve(async (req: Request) => {
  const cors = {
    'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, apikey, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Cache-Control': 'no-store',
  };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  const response = await handler(req);
  for (const [name, value] of Object.entries(cors)) response.headers.set(name, value);
  return response;
});
