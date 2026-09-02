import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
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
const MAILEROO_FROM = Deno.env.get('MAILEROO_FROM') || 'Saint Agnes Academy OSAS <osas@stagnesacdmy.maileroo.app>';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, apikey, x-client-info',
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
  if (!p.message) errors.push('message is required');
  return errors;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );
}

async function parentEmails(svc: ReturnType<typeof createClient>, studentId?: string): Promise<string[]> {
  const emails = (rows: { email?: string | null }[]) =>
    [...new Set((rows || []).map((r) => (r.email || '').trim()).filter(Boolean))];
  if (studentId) {
    const { data } = await svc
      .from('emergency_contacts')
      .select('email')
      .eq('category', 'student')
      .eq('student_id', studentId)
      .not('email', 'is', null);
    const linked = emails(data || []);
    if (linked.length) return linked;
  }
  const { data, error } = await svc
    .from('emergency_contacts')
    .select('email')
    .eq('category', 'student')
    .not('email', 'is', null);
  if (error) return [];
  return emails(data || []);
}

const fmt = (iso?: string) =>
  iso ? new Date(iso).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : '';

function emailHtml(p: Record<string, unknown>, n: Record<string, unknown>): string {
  const isAlert = n.notif_type === 'incident_alert';
  const student = p.student_name as string | undefined;

  const details: string[] = [];
  if (student) {
    details.push(row('Student', `${escapeHtml(student)}${p.student_grade ? ` (Grade ${p.student_grade})` : ''}`));
  }
  if (isAlert) {
    details.push(row('Priority', 'URGENT - please contact the school as soon as possible'));
  }
  if (p.audience_group) details.push(row('Audience', escapeHtml(String(p.audience_group))));
  if (p.event_start_at) {
    details.push(row('Event', `${fmt(p.event_start_at as string)} - ${fmt(p.event_end_at as string)}`));
  }
  details.push(row('Sent', fmt(n.sent_at as string)));
  const title = n.title ? escapeHtml(String(n.title)) : (isAlert ? 'Incident Alert' : 'Event Notice');

  return `
<div style="background:#f5f1ea;padding:32px 16px;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e7e0d4;box-shadow:0 4px 12px rgba(0,0,0,0.05)">
    <div style="background:#3A1024;padding:22px 28px">
      <table cellpadding="0" cellspacing="0" border="0" style="width:100%">
        <tr>
          <td style="width:52px;vertical-align:middle;padding-right:14px">
            <img src="https://rwqaeabxusivkyjgskko.supabase.co/storage/v1/object/public/branding/logo.png" alt="SAAC Logo" width="48" height="48" style="display:block;border-radius:50%;background:#ffffff;padding:2px;border:2px solid #e9b9ca" />
          </td>
          <td style="vertical-align:middle">
            <div style="color:#ffffff;font-size:18px;font-weight:700;line-height:1.2">Saint Agnes Academy</div>
            <div style="color:#e9b9ca;font-size:11px;letter-spacing:1.5px;margin-top:4px;font-weight:600">OFFICE OF STUDENT AFFAIRS AND SERVICES</div>
          </td>
        </tr>
      </table>
    </div>
    <div style="padding:30px 32px">
      <div style="margin-bottom:18px">
        ${isAlert
          ? '<span style="display:inline-block;background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;font-size:11px;font-weight:700;letter-spacing:1px;padding:4px 12px;border-radius:999px">URGENT INCIDENT ALERT</span>'
          : '<span style="display:inline-block;background:#fdf2f8;color:#be185d;border:1px solid #fbcfe8;font-size:11px;font-weight:700;letter-spacing:1px;padding:4px 12px;border-radius:999px">EVENT NOTICE</span>'}
      </div>
      <h2 style="margin:0 0 6px;color:#27272a;font-size:19px;font-weight:700">${title}</h2>
      <p style="margin:0 0 18px;color:#3f3f46;font-size:14px;line-height:1.7">${escapeHtml(String(n.message))}</p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 20px;font-size:13px">
        ${details.join('')}
      </table>
      <p style="margin:0 0 4px;color:#3f3f46;font-size:14px;line-height:1.7">
        ${isAlert
          ? 'If you have any questions or need more information, please call the OSAS office or reply through the school\'s official channels.'
          : 'We look forward to seeing you there. For questions, contact the OSAS office during school hours.'}
      </p>
    </div>
    <div style="background:#faf7f2;padding:16px 32px;border-top:1px solid #eee6d9;color:#8b8176;font-size:11px;line-height:1.6">
      This is an automated message from Saint Agnes Academy, Office of Student Affairs and Services.<br/>
      Please do not reply directly to this email.
    </div>
  </div>
</div>`;
}

function row(label: string, value: string): string {
  return `<tr><td style="padding:7px 12px;background:#faf7f2;color:#8b8176;font-weight:600;width:110px;border-bottom:1px solid #f0eae0">${label}</td>` +
    `<td style="padding:7px 12px;color:#3f3f46;border-bottom:1px solid #f0eae0">${value}</td></tr>`;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const apikey = (req.headers.get('apikey') || '').trim();

  if (!token && !apikey) {
    return json({ error: 'Unauthorized: Missing authentication credentials' }, 401);
  }

  let user: { id: string; user_metadata?: Record<string, unknown> } | null = null;
  let role = 'admin';

  const isAuthorizedKey = (k: string) => {
    if (!k) return false;
    if (k === SUPABASE_ANON_KEY || k === SERVICE_ROLE_KEY) return true;
    if (k.startsWith('sb_publishable_') || k.startsWith('sb_secret_')) return true;
    const claims = decodeJwtPayload(k);
    if (claims && (claims.role === 'anon' || claims.role === 'service_role')) {
      return true;
    }
    return false;
  };

  if (isAuthorizedKey(token) || isAuthorizedKey(apikey)) {
    // Authorized via project anon / service key
    role = 'admin';
  } else if (token) {
    // Attempt to validate user JWT session
    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: authErr } = await anon.auth.getUser(token);
    if (authErr || !userData?.user) {
      return json({ error: 'Unauthorized: Invalid or expired session' }, 401);
    }
    user = userData.user;
    role = (user.user_metadata?.role as string) === 'admin' ? 'admin' : 'staff';
  } else {
    return json({ error: 'Unauthorized: Invalid authentication credentials' }, 401);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  const errors = validate(payload);
  if (errors.length) return json({ error: errors.join('; ') }, 400);

  const notifType = payload.notif_type as string;
  const isAlert = notifType === 'incident_alert';
  const record = {
    ...payload,
    priority: notifType === 'incident_alert' ? 'urgent' : 'informational',
    contact_method: (payload.contact_method as string) || (notifType === 'incident_alert' ? 'email' : 'app'),
    sent_at: new Date().toISOString(),
    delivery_status: 'sent',
    created_by: user ? user.id : null,
  };
  delete (record as Record<string, unknown>).student_name;
  delete (record as Record<string, unknown>).student_grade;

  const svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: created, error: insErr } = await svc
    .from('notifications')
    .insert(record)
    .select()
    .single();
  if (insErr) return json({ error: insErr.message }, 400);

  const channel = created.contact_method;
  let delivery: Record<string, unknown> = { provider: 'recorded', status: 'queued' };

  if (channel === 'email') {
    const to = await parentEmails(svc, created.student_id || undefined);
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
        headers: {
          Authorization: `Bearer ${MAILEROO_API_KEY}`,
          'X-API-Key': MAILEROO_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: to.map((address) => ({ address })),
          subject: `${isAlert ? '[URGENT] ' : ''}${created.title || (isAlert ? 'Incident Alert' : 'Event Notice')} - Saint Agnes Academy`,
          html: emailHtml(payload, created),
        }),
      });
      let responseText = '';
      try {
        responseText = await r.text();
      } catch {}

      delivery = r.ok
        ? { provider: 'maileroo', status: 'sent' }
        : {
            provider: 'maileroo',
            status: 'failed',
            error: r.status === 401
              ? 'Maileroo email provider returned Unauthorized (check MAILEROO_API_KEY and domain verification in Maileroo)'
              : (responseText ? `Maileroo error (${r.status}): ${responseText.slice(0, 300)}` : `Maileroo request failed with status ${r.status}`),
          };
    }
  }

  return json({ ok: true, id: created.id, channel, delivery, role }, 201);
});
