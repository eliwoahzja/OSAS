import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { createUsernameAuthHandler } from './core.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(async (req: Request) => {
  const cors = {
    'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, apikey, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Cache-Control': 'no-store',
  };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  // A fresh public-key Auth client per request avoids sharing sessions between users.
  const auth = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).auth;
  const handler = createUsernameAuthHandler({
    async lookup(username) {
      const { data, error } = await service.from('users').select('id,email').eq('username', username).maybeSingle();
      if (error) throw error;
      return data;
    },
    signIn: (email, password) => auth.signInWithPassword({ email, password }),
    recover: (email, redirectTo) => auth.resetPasswordForEmail(email, { redirectTo }),
  });
  const response = await handler(req);
  for (const [key, value] of Object.entries(cors)) response.headers.set(key, value);
  return response;
});
