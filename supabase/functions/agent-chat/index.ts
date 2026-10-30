import { createClient } from 'npm:@supabase/supabase-js@2';
import { mintAgentToken } from '../_shared/agent-token.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const AGENT_GATEWAY_KEY = Deno.env.get('AGENT_GATEWAY_KEY') || '';
const N8N_AGENT_WEBHOOK_URL = (Deno.env.get('N8N_AGENT_WEBHOOK_URL') || '').trim();
const N8N_WEBHOOK_SECRET = Deno.env.get('N8N_WEBHOOK_SECRET') || '';
const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || '*';

const CORS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...CORS },
});

const text = (value: unknown): string => (value === null || value === undefined ? '' : String(value).trim());

function transcriptFrom(history: any, message: string): string {
  const lines: string[] = [];
  const items = Array.isArray(history) ? history.slice(-14) : [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const role = item.role === 'assistant' ? 'Assistant' : item.role === 'user' ? 'Administrator' : '';
    const content = text(item.content).slice(0, 3000);
    if (role && content) lines.push(`${role}: ${content}`);
  }
  const current = `Current request: ${message}`;
  if (!lines.length) return current;
  return `Prior conversation (oldest first):\n${lines.join('\n')}\n\n${current}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only.' }, 405);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: 'The assistant service is not configured.' }, 503);
  if (!AGENT_GATEWAY_KEY) return json({ error: 'The assistant gateway key is not configured.' }, 503);
  if (!N8N_AGENT_WEBHOOK_URL) {
    return json({ error: 'The assistant is not connected yet. Its n8n Production URL has not been configured.' }, 503);
  }
  if (!N8N_WEBHOOK_SECRET) {
    return json({ error: 'The assistant webhook secret is not configured. Ask an administrator to finish setup.' }, 503);
  }

  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ error: 'Sign-in required.' }, 401);

  const svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: who, error: whoError } = await svc.auth.getUser(jwt);
  const user = who?.user;
  if (whoError || !user) return json({ error: 'Your session is invalid or expired. Sign in again.' }, 401);
  if (user.app_metadata?.role !== 'admin') return json({ error: 'Only administrators can use the OSAS assistant.' }, 403);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Invalid request.' }, 400);

  const message = text(body.message);
  if (message.length < 1) return json({ error: 'Type a message for the assistant.' }, 400);
  if (message.length > 4000) return json({ error: 'Keep each message under 4,000 characters.' }, 400);
  const sessionId = text(body.sessionId).slice(0, 100) || crypto.randomUUID();

  // Content-free throttling. The table stores only the actor and timestamp.
  const since = new Date(Date.now() - 60000).toISOString();
  try {
    const { count } = await svc.from('agent_chat_log').select('id', { count: 'exact', head: true })
      .eq('actor_id', user.id).gte('created_at', since);
    if (Number(count || 0) >= 20) {
      return json({ error: 'Too many assistant messages in one minute. Wait a moment and try again.' }, 429);
    }
    await svc.from('agent_chat_log').insert({ actor_id: user.id });
  } catch {
    // A logging outage should not block an otherwise authenticated request.
  }

  const requestId = crypto.randomUUID();
  const actorName = text(user.user_metadata?.name) || text(user.email) || 'Administrator';
  const agentToken = await mintAgentToken({
    sub: user.id,
    email: text(user.email) || undefined,
    name: actorName,
    exp: Math.floor(Date.now() / 1000) + 15 * 60,
    jti: requestId,
  }, AGENT_GATEWAY_KEY);

  let response: Response;
  try {
    response = await fetch(N8N_AGENT_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-agent-key': N8N_WEBHOOK_SECRET,
      },
      body: JSON.stringify({
        message,
        transcript: transcriptFrom(body.history, message),
        sessionId,
        requestId,
        actorId: user.id,
        actorName,
        agentToken,
      }),
      signal: AbortSignal.timeout(55000),
    });
  } catch {
    return json({ error: 'The assistant took too long to respond. Try a shorter request.' }, 504);
  }

  if (!response.ok) {
    return json({ error: `The assistant workflow returned an error (${response.status}). Check that the n8n workflow is active.` }, 502);
  }

  let payload: any = null;
  try { payload = await response.json(); } catch {}
  const reply = text(payload?.reply || payload?.output || payload?.text);
  if (!reply) return json({ error: 'The assistant returned an empty response. Try again.' }, 502);

  return json({ reply: reply.slice(0, 16000), requestId });
});
