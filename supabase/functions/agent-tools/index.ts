import { createClient } from 'npm:@supabase/supabase-js@2';
import { runAgentRequest } from './core.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const AGENT_GATEWAY_KEY = Deno.env.get('AGENT_GATEWAY_KEY') || '';
// Empty falls back to the core module's current public site URL.
const SITE_URL = Deno.env.get('SITE_URL') || '';
const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || '*';

const CORS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, apikey, x-client-info, x-agent-token, x-agent-key, x-agent-actor',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...CORS },
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, error: 'POST only.' }, 405);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ ok: false, error: 'The agent gateway is not configured.' }, 503);
  if (!AGENT_GATEWAY_KEY) return json({ ok: false, error: 'The agent gateway key is not configured.' }, 503);

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON body.' }, 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json({ ok: false, error: 'Invalid request.' }, 400);
  }

  const svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const result = await runAgentRequest({
    svc,
    key: AGENT_GATEWAY_KEY,
    token: (req.headers.get('x-agent-token') || '').replace(/^Bearer\s+/i, ''),
    body,
    supabaseUrl: SUPABASE_URL,
    serviceKey: SERVICE_ROLE_KEY,
    siteUrl: SITE_URL,
    now: Date.now(),
  });

  return json(result.body, result.status);
});
