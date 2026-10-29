import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { createStudentAuthHandler } from './core.ts';

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
  const auth = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).auth;
  const handler = createStudentAuthHandler({
    async lookup(studentId) {
      const { data, error } = await service.from('users').select('id,email').eq('student_id', studentId).maybeSingle();
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
