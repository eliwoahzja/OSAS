// send-notification — the only custom backend code.
// Deployed with:
//   supabase functions deploy send-notification
//   supabase secrets set MAILEROO_API_KEY=... MAILEROO_FROM="SAAC OSAS <notifications@...>"
// Then point window.OSAS.NOTIFY_FN_URL at the URL the deploy command prints.
//
// It validates the request, records the notification with the service
// role, and emails parents through Maileroo. SMS/call were dropped
// (paid; not needed).

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
// Newer Supabase projects inject the anon key as SUPABASE_PUBLISHABLE_KEYS
// (a JSON array); older ones use SUPABASE_ANON_KEY. Accept both.
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
  || (() => {
    try {
      const pk = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '[]');
      return Array.isArray(pk) && pk.length ? String(pk[0]) : '';
    } catch {
      return '';
    }
  })();
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const MAILEROO_API_KEY = Deno.env.get('MAILEROO_API_KEY') || '';
const MAILEROO_FROM = Deno.env.get('MAILEROO_FROM') || 'SAAC OSAS <noreply@maileroo.net>'; // "Name <email>" or bare email

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

function validate(p: Record<string, unknown>): string[] {
  const errors: string[] = [];
  const type = p.notif_type as string;
  if (!['incident_alert', 'event_notice'].includes(type)) {
    errors.push('notif_type must be incident_alert or event_notice');
  }
  if (type === 'incident_alert') {
    if (!p.student_id) errors.push('student_id is required for incident alerts');
    if (p.contact_method && p.contact_method !== 'email') {
      errors.push('incident alerts go by email');
    }
  }
  if (type === 'event_notice') {
    if (!p.audience_group) errors.push('audience_group is required for event notices');
    if (!p.event_start_at || !p.event_end_at) errors.push('event_start_at and event_end_at are required for event notices');
    if (p.event_start_at && p.event_end_at && new Date(p.event_end_at as string) <= new Date(p.event_start_at as string)) {
      errors.push('event_end_at must be after event_start_at');
    }
  }
  for (const req of ['title', 'message']) {
    if (!p[req]) errors.push(`${req} is required`);
  }
  return errors;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );
}

// Parent emails from emergency_contacts (category = student).
async function parentEmails(svc: ReturnType<typeof createClient>): Promise<string[]> {
  const { data, error } = await svc
    .from('emergency_contacts')
    .select('email')
    .eq('category', 'student')
    .not('email', 'is', null);
  if (error) return [];
  return [...new Set((data || []).map((r) => (r.email as string).trim()).filter(Boolean))];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // Caller must hold a real Supabase JWT.
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Unauthorized' }, 401);
  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: authErr } = await anon.auth.getUser(token);
  if (authErr || !userData.user) return json({ error: 'Unauthorized' }, 401);
  const role = (userData.user.user_metadata?.role as string) === 'admin' ? 'admin' : 'staff';

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  const errors = validate(payload);
  if (errors.length) return json({ error: errors.join('; ') }, 400);

  const notifType = payload.notif_type as string;
  const record = {
    ...payload,
    priority: notifType === 'incident_alert' ? 'urgent' : 'informational',
    contact_method: (payload.contact_method as string) || (notifType === 'incident_alert' ? 'email' : 'app'),
    sent_at: new Date().toISOString(),
    delivery_status: 'sent',
    created_by: userData.user.id,
  };
  delete (record as Record<string, unknown>).student_name; // enrichment only
  delete (record as Record<string, unknown>).student_grade;

  // Record with the service role (bypasses RLS).
  const svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: created, error: insErr } = await svc
    .from('notifications')
    .insert(record)
    .select()
    .single();
  if (insErr) return json({ error: insErr.message }, 400);

  // Deliver. 'app' channel just means in-app; email goes through Maileroo.
  const channel = created.contact_method;
  let delivery: Record<string, unknown> = { provider: 'recorded', status: 'queued' };

  if (channel === 'email') {
    const to = await parentEmails(svc);
    if (!to.length) {
      delivery = { provider: 'email', status: 'failed', error: 'No parent emails found in emergency_contacts (category=student).' };
    } else if (!MAILEROO_API_KEY) {
      delivery = { provider: 'email', status: 'failed', error: 'MAILEROO_API_KEY not set on this function.' };
    } else {
      const m = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(MAILEROO_FROM);
      const from = m
        ? { address: m[2], display_name: m[1] || 'SAAC OSAS' }
        : { address: MAILEROO_FROM, display_name: 'SAAC OSAS' };
      const r = await fetch('https://smtp.maileroo.com/api/v2/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${MAILEROO_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from,
          to: to.map((address) => ({ address })),
          subject: `${created.title} - SAAC OSAS`,
          html:
            `<p style="font-family:Inter,Arial,sans-serif;color:#3f3f46">${escapeHtml(created.message)}</p>` +
            `<p style="font-family:Inter,Arial,sans-serif;color:#a1a1aa;font-size:12px">Sent by the Office of Student Affairs and Services.</p>`,
        }),
      });
      delivery = r.ok
        ? { provider: 'maileroo', status: 'sent' }
        : { provider: 'maileroo', status: 'failed', error: (await r.text()).slice(0, 300) };
    }
  }

  return json({ ok: true, id: created.id, channel, delivery, role }, 201);
});
