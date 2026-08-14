// ============================================================
// send-notification — the ONLY server-side custom code.
//
// Replaces the old PHP API's Notifications.php. Deployed as a
// Supabase Edge Function (Deno + TypeScript):
//
//   supabase functions deploy send-notification
//   supabase secrets set RESEND_API_KEY=re_... SUPABASE_SERVICE_ROLE_KEY=...
//                 TWILIO_ACCOUNT_SID=... TWILIO_AUTH_TOKEN=... TWILIO_FROM_NUMBER=...
//
// Then set window.OSAS.NOTIFY_FN_URL in js/config.js to the
// function's URL (shown by the deploy command), e.g.
//   https://rwqaeabxusivkyjgskko.functions.supabase.co/send-notification
//
// Delivery:
//   * email → Resend (free tier, 3k/mo, no card) — requires RESEND_API_KEY.
//   * sms/call → Twilio — requires TWILIO_* env vars (paid). Without
//     them the notification is recorded but no SMS/call is sent.
// ============================================================

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
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
// From address for Resend — verify your own domain to send to anyone;
// onboarding@resend.dev only reaches your own inbox.
const RESEND_FROM = Deno.env.get('RESEND_FROM') || 'SAAC OSAS <onboarding@resend.dev>';
// No-domain alternative: SendGrid free tier (100/day) with Single Sender
// Verification — verify a personal email (e.g. a Gmail) as the sender, no
// domain needed. From must be that verified address.
const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY') || '';
const SENDGRID_FROM = Deno.env.get('SENDGRID_FROM') || 'SAAC OSAS <noreply@gmail.com>';
// No-card + no-domain option: EmailJS (free 200 emails/month). Emails are
// sent from the sender's connected Gmail/Outlook via EmailJS templates.
// Preferred free option: Maileroo (3,000 emails/month, no card) — they even
// provide a free sender domain, so no domain purchase is needed.
const MAILEROO_API_KEY = Deno.env.get('MAILEROO_API_KEY') || '';
const MAILEROO_FROM = Deno.env.get('MAILEROO_FROM') || 'SAAC OSAS <noreply@maileroo.net>'; // "Name <email>" or bare email
const EMAILJS_SERVICE_ID = Deno.env.get('EMAILJS_SERVICE_ID') || '';
const EMAILJS_TEMPLATE_ID = Deno.env.get('EMAILJS_TEMPLATE_ID') || '';
const EMAILJS_USER_ID = Deno.env.get('EMAILJS_USER_ID') || ''; // public key
const EMAILJS_ACCESS_TOKEN = Deno.env.get('EMAILJS_ACCESS_TOKEN') || ''; // restricted key (optional)
const TWILIO_SID = Deno.env.get('TWILIO_ACCOUNT_SID') || '';
const TWILIO_AUTH = Deno.env.get('TWILIO_AUTH_TOKEN') || '';
const TWILIO_FROM = Deno.env.get('TWILIO_FROM_NUMBER') || '';

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

/** Business rules — mirrors the old Notifications.php (email now allowed for alerts). */
function validate(p: Record<string, unknown>): string[] {
  const errors: string[] = [];
  const type = p.notif_type as string;
  if (!['incident_alert', 'event_notice'].includes(type)) {
    errors.push('notif_type must be incident_alert or event_notice');
  }
  if (type === 'incident_alert') {
    if (!p.student_id) errors.push('student_id is required for incident alerts');
    if (p.contact_method && !['call', 'sms', 'email'].includes(p.contact_method as string)) {
      errors.push('incident alerts should use call, sms or email');
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

/** Parent email addresses (emergency_contacts, category = student). */
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

  // ---- 1. Authenticate the caller (must hold a real Supabase JWT) ----
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Unauthorized' }, 401);
  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: authErr } = await anon.auth.getUser(token);
  if (authErr || !userData.user) return json({ error: 'Unauthorized' }, 401);
  const role = (userData.user.user_metadata?.role as string) === 'admin' ? 'admin' : 'staff';

  // ---- 2. Parse + validate ----
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
    contact_method: (payload.contact_method as string) || (notifType === 'incident_alert' ? 'call' : 'app'),
    sent_at: new Date().toISOString(),
    delivery_status: 'sent',
    created_by: userData.user.id,
  };
  delete (record as Record<string, unknown>).student_name; // enrichment only
  delete (record as Record<string, unknown>).student_grade;

  // ---- 3. Record with the service role (bypasses RLS, like the old API) ----
  const svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: created, error: insErr } = await svc
    .from('notifications')
    .insert(record)
    .select()
    .single();
  if (insErr) return json({ error: insErr.message }, 400);

  // ---- 4. Deliver ----
  const channel = created.contact_method;
  let delivery: Record<string, unknown> = { provider: 'recorded', status: 'queued' };

  if (channel === 'email') {
    const to = await parentEmails(svc);
    if (!to.length) {
      delivery = { provider: 'email', status: 'failed', error: 'No parent emails found in emergency_contacts (category=student).' };
    } else if (RESEND_API_KEY) {
      const body = {
        from: RESEND_FROM,
        to,
        subject: `${created.title} — SAAC OSAS`,
        html:
          `<p style="font-family:Inter,Arial,sans-serif;color:#3f3f46">${escapeHtml(created.message)}</p>` +
          `<p style="font-family:Inter,Arial,sans-serif;color:#a1a1aa;font-size:12px">Sent by the Office of Student Affairs and Services.</p>`,
      };
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      delivery = r.ok
        ? { provider: 'resend', status: 'sent' }
        : { provider: 'resend', status: 'failed', error: (await r.text()).slice(0, 300) };
    } else if (SENDGRID_API_KEY) {
      // Single-sender verified email (no domain needed) — free tier 100/day.
      const body = {
        personalizations: [{ to: to.map((email) => ({ email })) }],
        from: { email: SENDGRID_FROM, name: 'SAAC OSAS' },
        subject: `${created.title} — SAAC OSAS`,
        content: [{
          type: 'text/html',
          value:
            `<p style="font-family:Inter,Arial,sans-serif;color:#3f3f46">${escapeHtml(created.message)}</p>` +
            `<p style="font-family:Inter,Arial,sans-serif;color:#a1a1aa;font-size:12px">Sent by the Office of Student Affairs and Services.</p>`,
        }],
      };
      const r = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${SENDGRID_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      delivery = r.ok
        ? { provider: 'sendgrid', status: 'sent' }
        : { provider: 'sendgrid', status: 'failed', error: (await r.text()).slice(0, 300) };
    } else if (MAILEROO_API_KEY) {
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
          subject: `${created.title} — SAAC OSAS`,
          html:
            `<p style="font-family:Inter,Arial,sans-serif;color:#3f3f46">${escapeHtml(created.message)}</p>` +
            `<p style="font-family:Inter,Arial,sans-serif;color:#a1a1aa;font-size:12px">Sent by the Office of Student Affairs and Services.</p>`,
        }),
      });
      delivery = r.ok
        ? { provider: 'maileroo', status: 'sent' }
        : { provider: 'maileroo', status: 'failed', error: (await r.text()).slice(0, 300) };
    } else if (EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID && EMAILJS_USER_ID) {
      // EmailJS — one API call per recipient. Free tier: 200 emails/month.
      const results: string[] = [];
      let ok = true;
      for (const email of to) {
        const body: Record<string, unknown> = {
          service_id: EMAILJS_SERVICE_ID,
          template_id: EMAILJS_TEMPLATE_ID,
          user_id: EMAILJS_USER_ID,
          template_params: {
            to_email: email,
            subject: `${created.title} — SAAC OSAS`,
            message: created.message,
          },
        };
        if (EMAILJS_ACCESS_TOKEN) body.accessToken = EMAILJS_ACCESS_TOKEN;
        const r = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!r.ok) {
          ok = false;
          results.push(`${email}: ${(await r.text()).slice(0, 120)}`);
        }
      }
      delivery = ok
        ? { provider: 'emailjs', status: 'sent', to: to.length }
        : { provider: 'emailjs', status: 'failed', errors: results };
    } else {
      delivery = { provider: 'email', status: 'failed', error: 'No email provider configured — set MAILEROO_API_KEY, RESEND_API_KEY, SENDGRID_API_KEY, or EMAILJS_* on this function.' };
    }
  } else if ((channel === 'sms' || channel === 'call') && TWILIO_SID && TWILIO_AUTH && TWILIO_FROM) {
    const student = created.student_id
      ? (await svc.from('students').select('phone').eq('id', created.student_id).maybeSingle()).data
      : null;
    const to = student?.phone;
    if (!to) {
      delivery = { provider: 'twilio', status: 'failed', error: 'Student has no phone number on file.' };
    } else {
      // Real Twilio integration point (paid). POST to /Messages.json or /Calls.json
      // with Basic auth (TWILIO_SID:TWILIO_AUTH) when you enable it.
      delivery = { provider: 'twilio', status: 'pending', to, note: 'Twilio integration is a paid add-on — implement here when enabled.' };
    }
  } else if (channel === 'sms' || channel === 'call') {
    delivery = { provider: 'twilio', status: 'pending', note: 'TWILIO_* env vars not set — SMS/call requires a Twilio account (paid).' };
  }

  return json({ ok: true, id: created.id, channel, delivery, role }, 201);
});
