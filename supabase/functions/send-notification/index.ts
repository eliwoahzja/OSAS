// deno-lint-ignore-file no-explicit-any
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
const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || '*';

const CORS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const KINDS = ['incident_alert', 'event_notice', 'alert'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CLINIC_RE = /nurse|clinic|health/i;
const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 250;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );
}

function validate(p: Record<string, any>): string[] {
  const errors: string[] = [];
  const type = p.notif_type;
  if (!KINDS.includes(type)) errors.push('notif_type must be incident_alert, event_notice, or alert');
  if (type === 'incident_alert') {
    if (!UUID_RE.test(String(p.student_id || ''))) errors.push('a valid student_id is required for incident alerts');
  }
  if (type === 'event_notice') {
    if (!p.audience_group) errors.push('audience_group is required for event notices');
    if (!p.event_start_at || !p.event_end_at) errors.push('event_start_at and event_end_at are required for event notices');
    if (p.event_start_at && p.event_end_at && new Date(p.event_end_at) <= new Date(p.event_start_at)) {
      errors.push('event_end_at must be after event_start_at');
    }
  }
  if (!p.message || !String(p.message).trim()) errors.push('message is required');
  if (String(p.message || '').length > 2000) errors.push('message is too long (2000 characters max)');
  if (String(p.title || '').length > 255) errors.push('title is too long (255 characters max)');
  return errors;
}

/* ---------------- recipients ---------------- */

const clean = (rows: any[] | null): string[] =>
  Array.from(new Set((rows || []).map((r) => String(r.email || '').trim().toLowerCase()).filter(Boolean)));

async function guardianEmailsForStudent(svc: any, studentId: string): Promise<string[]> {
  const { data } = await svc.from('emergency_contacts').select('email')
    .eq('category', 'student').eq('student_id', studentId).not('email', 'is', null);
  return clean(data);
}

async function allGuardianEmails(svc: any): Promise<string[]> {
  const { data } = await svc.from('emergency_contacts').select('email')
    .eq('category', 'student').not('email', 'is', null);
  return clean(data);
}

async function guardianEmailsForGrades(svc: any, grades: number[]): Promise<string[]> {
  const { data: studs } = await svc.from('students').select('id').in('grade', grades);
  const ids = (studs || []).map((s: any) => s.id);
  if (!ids.length) return [];
  const { data } = await svc.from('emergency_contacts').select('email')
    .eq('category', 'student').in('student_id', ids).not('email', 'is', null);
  return clean(data);
}

// Only the school nurse / clinic staff receive restock alerts. Other school
// contacts (police, fire, hospital) must never be emailed about supplies.
async function clinicEmails(svc: any): Promise<string[]> {
  const { data } = await svc.from('emergency_contacts').select('name,role,relationship,email')
    .eq('category', 'school').not('email', 'is', null);
  return clean((data || []).filter((c: any) => CLINIC_RE.test(`${c.name || ''} ${c.role || ''} ${c.relationship || ''}`)));
}

function gradesFromAudience(audience: string): number[] | null {
  const a = audience.toLowerCase();
  if (/senior high/.test(a)) return [11, 12];
  const range = /grades?\s*(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})/.exec(a);
  if (range) {
    const lo = Number(range[1]);
    const hi = Number(range[2]);
    const out: number[] = [];
    for (let g = Math.min(lo, hi); g <= Math.max(lo, hi); g++) out.push(g);
    return out;
  }
  const single = /grades?\s*(\d{1,2})/.exec(a);
  return single ? [Number(single[1])] : null; // null = everyone
}

async function audienceEmails(svc: any, audience: string): Promise<string[]> {
  const grades = gradesFromAudience(audience);
  return grades ? await guardianEmailsForGrades(svc, grades) : await allGuardianEmails(svc);
}

/* ---------------- email ---------------- */

const fmt = (iso?: string) =>
  iso ? new Date(iso).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }) : '';

function row(label: string, value: string): string {
  return `<tr><td style="padding:7px 12px;background:#faf7f2;color:#8b8176;font-weight:600;width:110px;border-bottom:1px solid #f0eae0">${label}</td>` +
    `<td style="padding:7px 12px;color:#3f3f46;border-bottom:1px solid #f0eae0">${value}</td></tr>`;
}

type Kind = 'parent' | 'stock' | 'event';

function emailHtml(kind: Kind, n: Record<string, any>, opts: { studentLine?: string; audience?: string }): string {
  const details: string[] = [];
  if (opts.studentLine) details.push(row('Student', escapeHtml(opts.studentLine)));
  if (kind === 'parent') details.push(row('Priority', 'URGENT - please contact the school as soon as possible'));
  if (kind === 'stock') details.push(row('Priority', 'HIGH - Low Stock Restock Required'));
  if (opts.audience) details.push(row('Audience', escapeHtml(opts.audience)));
  if (kind === 'event' && n.event_start_at) {
    details.push(row('Event', `${fmt(n.event_start_at)} - ${fmt(n.event_end_at)}`));
  }
  details.push(row('Sent', fmt(new Date().toISOString())));

  const title = escapeHtml(String(n.title || (kind === 'parent' ? 'Incident Alert' : kind === 'stock' ? 'Alert' : 'Event Notice')));
  const badge = kind === 'parent'
    ? '<span style="display:inline-block;background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;font-size:11px;font-weight:700;letter-spacing:1px;padding:4px 12px;border-radius:999px">URGENT INCIDENT ALERT</span>'
    : kind === 'stock'
      ? '<span style="display:inline-block;background:#fee2e2;color:#dc2626;border:1px solid #f87171;font-size:12px;font-weight:800;letter-spacing:1.5px;padding:4px 14px;border-radius:999px">ALERT</span>'
      : '<span style="display:inline-block;background:#fdf2f8;color:#be185d;border:1px solid #fbcfe8;font-size:11px;font-weight:700;letter-spacing:1px;padding:4px 12px;border-radius:999px">EVENT NOTICE</span>';
  const footer = kind === 'parent'
    ? 'If you have any questions or need more information, please call the OSAS office or reply through the school\'s official channels.'
    : kind === 'stock'
      ? 'This is an official administrative health & safety alert. Please replenish and update supplies inventory upon receipt.'
      : 'For questions, contact the OSAS office during school hours.';

  return `
<div style="background:#f5f1ea;padding:32px 16px;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e7e0d4;box-shadow:0 4px 12px rgba(0,0,0,0.05)">
    <div style="background:#3A1024;padding:22px 28px">
      <table cellpadding="0" cellspacing="0" border="0" style="width:100%">
        <tr>
          <td style="width:52px;vertical-align:middle;padding-right:14px">
            <img src="${SUPABASE_URL}/storage/v1/object/public/branding/logo.png" alt="SAAC Logo" width="48" height="48" style="display:block;border-radius:50%;background:#ffffff;padding:2px;border:2px solid #e9b9ca" />
          </td>
          <td style="vertical-align:middle">
            <div style="color:#ffffff;font-size:18px;font-weight:700;line-height:1.2">Saint Agnes Academy</div>
            <div style="color:#e9b9ca;font-size:11px;letter-spacing:1.5px;margin-top:4px;font-weight:600">OFFICE OF STUDENT AFFAIRS AND SERVICES</div>
          </td>
        </tr>
      </table>
    </div>
    <div style="padding:30px 32px">
      <div style="margin-bottom:18px">${badge}</div>
      <h2 style="margin:0 0 6px;color:#27272a;font-size:19px;font-weight:700">${title}</h2>
      <p style="margin:0 0 18px;color:#3f3f46;font-size:14px;line-height:1.7">${escapeHtml(String(n.message))}</p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 20px;font-size:13px">${details.join('')}</table>
      <p style="margin:0 0 4px;color:#3f3f46;font-size:14px;line-height:1.7">${footer}</p>
    </div>
    <div style="background:#faf7f2;padding:16px 32px;border-top:1px solid #eee6d9;color:#8b8176;font-size:11px;line-height:1.6">
      This is an automated message from Saint Agnes Academy, Office of Student Affairs and Services.<br/>
      Please do not reply directly to this email.
    </div>
  </div>
</div>`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// One email per recipient: parents must never see each other's addresses.
// Sent in small batches with a pause so the provider does not rate-limit (429).
async function sendEach(recipients: string[], subject: string, html: string) {
  const m = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(MAILEROO_FROM);
  const from = m
    ? { address: m[2], display_name: m[1] || 'SAAC OSAS' }
    : { address: MAILEROO_FROM, display_name: 'SAAC OSAS' };

  let sent = 0;
  let failed = 0;
  let firstError = '';
  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map(async (address) => {
      const r = await fetch('https://smtp.maileroo.com/api/v2/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${MAILEROO_API_KEY}`,
          'X-API-Key': MAILEROO_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from, to: [{ address }], subject, html }),
      });
      if (!r.ok) {
        const text = await r.text().catch(() => '');
        throw new Error(r.status === 401
          ? 'Maileroo returned Unauthorized (check MAILEROO_API_KEY and domain verification)'
          : `Maileroo error (${r.status}): ${text.slice(0, 200)}`);
      }
    }));
    for (const res of results) {
      if (res.status === 'fulfilled') sent++;
      else {
        failed++;
        if (!firstError) firstError = String(res.reason?.message || res.reason);
      }
    }
    if (i + BATCH_SIZE < recipients.length) await sleep(BATCH_DELAY_MS);
  }
  return { sent, failed, firstError };
}

/* ---------------- handler ---------------- */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // No auth required — app runs without login. Treat all callers as admin.
  const user = { id: '00000000-0000-0000-0000-000000000000', app_metadata: { role: 'admin' } };
  const role = 'admin';

  let payload: Record<string, any>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  const errors = validate(payload);
  if (errors.length) return json({ error: errors.join('; ') }, 400);

  const type: string = payload.notif_type;
  const broadcast = type === 'incident_alert' && payload.notify_all_parents === true;
  if (broadcast && role !== 'admin') {
    return json({ error: 'Only an administrator can send a campus-wide alert to all parents.' }, 403);
  }

  const svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Who is this about / who receives it. The audience label stored with the
  // row is what the Parent Notifications table displays.
  let audienceLabel: string | null = null;
  let studentLine: string | undefined;
  let recipients: string[] = [];
  let noRecipientsMsg = '';
  const kind: Kind = type === 'incident_alert' ? 'parent' : type === 'alert' ? 'stock' : 'event';

  if (type === 'incident_alert') {
    const { data: stu } = await svc.from('students').select('name,grade').eq('id', payload.student_id).maybeSingle();
    if (!stu) return json({ error: 'Student not found.' }, 400);
    if (broadcast) {
      audienceLabel = 'All Parents & Guardians';
      recipients = await allGuardianEmails(svc);
      noRecipientsMsg = 'No parent or guardian emails are registered.';
      // A campus-wide message must not identify the student involved.
    } else {
      audienceLabel = `Parent/Guardian of ${stu.name}`.slice(0, 100);
      studentLine = `${stu.name}${stu.grade ? ` (Grade ${stu.grade})` : ''}`;
      recipients = await guardianEmailsForStudent(svc, payload.student_id);
      noRecipientsMsg = `No guardian email is registered for ${stu.name}. Add one in Emergency Contacts.`;
      // Deliberately NO fallback to "all parents": one child's incident is never broadcast by accident.
    }
  } else if (type === 'alert') {
    audienceLabel = String(payload.audience_group || 'Clinic Staff / Stock Custodians').slice(0, 100);
    recipients = await clinicEmails(svc);
    noRecipientsMsg = 'No school nurse / clinic contact with an email is registered. Add one in Emergency Contacts.';
  } else {
    audienceLabel = String(payload.audience_group).slice(0, 100);
    recipients = await audienceEmails(svc, audienceLabel);
    noRecipientsMsg = `No parent/guardian emails found for audience "${audienceLabel}".`;
  }

  // Whitelisted columns only: the client cannot set created_by, delivery_status, etc.
  const record: Record<string, any> = {
    notif_type: type,
    priority: type === 'event_notice' ? 'informational' : 'urgent',
    contact_method: 'email',
    title: String(payload.title || '').trim().slice(0, 255) || (type === 'incident_alert' ? 'Incident Alert' : type === 'alert' ? 'Restock Alert' : 'Event Notice'),
    message: String(payload.message).trim(),
    audience_group: audienceLabel,
    delivery_status: 'pending',
    created_by: user.id,
  };
  if (type === 'incident_alert') {
    record.student_id = payload.student_id;
    if (UUID_RE.test(String(payload.related_incident_id || ''))) record.related_incident_id = payload.related_incident_id;
  }
  if (type === 'event_notice') {
    record.event_start_at = payload.event_start_at;
    record.event_end_at = payload.event_end_at;
  }

  const { data: created, error: insErr } = await svc.from('notifications').insert(record).select().single();
  if (insErr) return json({ error: insErr.message }, 400);

  const finish = async (status: 'sent' | 'failed', delivery: Record<string, unknown>, http = 201) => {
    await svc.from('notifications')
      .update({ delivery_status: status, sent_at: status === 'sent' ? new Date().toISOString() : null })
      .eq('id', created.id);
    return json({ ok: status === 'sent', id: created.id, channel: 'email', delivery, role }, http);
  };

  if (!recipients.length) return await finish('failed', { provider: 'email', status: 'failed', error: noRecipientsMsg });
  if (!MAILEROO_API_KEY) return await finish('failed', { provider: 'email', status: 'failed', error: 'MAILEROO_API_KEY is not set on this function.' });

  const subjectPrefix = kind === 'parent' ? '[URGENT INCIDENT ALERT] ' : kind === 'stock' ? '[ALERT] ' : '[NOTICE] ';
  const subject = `${subjectPrefix}${created.title} - Saint Agnes Academy`;
  const html = emailHtml(kind, created, { studentLine, audience: audienceLabel || undefined });
  const { sent, failed, firstError } = await sendEach(recipients, subject, html);

  if (sent === 0) {
    return await finish('failed', { provider: 'maileroo', status: 'failed', sent, failed, recipients: recipients.length, error: firstError });
  }
  return await finish('sent', {
    provider: 'maileroo', status: failed ? 'partial' : 'sent', sent, failed, recipients: recipients.length,
    ...(failed ? { error: firstError } : {}),
  });
});
