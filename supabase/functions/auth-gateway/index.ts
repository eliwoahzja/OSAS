/** Sign-in gateway with lockout, emailed unlock codes and QR verify. */
import { createClient } from 'npm:@supabase/supabase-js@2';
import qrcode from 'npm:qrcode-generator@1.4.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const MAILEROO_API_KEY = Deno.env.get('MAILEROO_API_KEY') || '';
const MAILEROO_FROM = Deno.env.get('MAILEROO_FROM') || 'Saint Agnes Academy OSAS <osas@stagnesacdmy.maileroo.app>';
const SMTP_HOST = Deno.env.get('SMTP_HOST') || '';
const SMTP_PORT = Deno.env.get('SMTP_PORT') || '587';
const SMTP_USER = Deno.env.get('SMTP_USER') || '';
const SMTP_PASS = Deno.env.get('SMTP_PASS') || '';
const SMTP_FROM = Deno.env.get('SMTP_FROM') || 'Saint Agnes Academy OSAS <noreply@saac.edu.ph>';
const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || '*';
const APP_URL = Deno.env.get('APP_URL') || 'https://stagnesacademy.vercel.app/';

if (!SUPABASE_URL) throw new Error('Missing SUPABASE_URL on the auth-gateway function.');
if (!SERVICE_ROLE_KEY) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY on the auth-gateway function.');

const CORS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_FAILED_ATTEMPTS = 5;      // wrong-password tries before the account locks
const MAX_UNLOCK_TRIES = 5;         // wrong unlock codes before a new code is needed
const UNLOCK_CODE_TTL_MIN = 30;     // unlock code validity
const UNLOCK_RESEND_COOLDOWN_MIN = 2;

const attemptsTable = 'auth_login_attempts';
const locksTable = 'account_locks';
const devicesTable = 'trusted_devices';

const DEVICE_TTL_DAYS = 30;
/** Device token format: "userId:secret" signed with a server secret. */
const serverSecret = Deno.env.get('AUTH_GW_SECRET') || SERVICE_ROLE_KEY;

async function hmacHex(secret: string, text: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomToken(len: number): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function trustedUserId(svc: any, token: string): Promise<string | null> {
  if (!token) return null;
  const [userId, secret] = token.split(':', 2);
  if (!userId || !secret) return null;
  const hash = await hmacHex(serverSecret, `${userId}:${secret}`);
  const { data } = await svc.from(devicesTable).select('user_id, expires_at')
    .eq('token_hash', hash).maybeSingle();
  const row = data as { user_id: string; expires_at: string } | null;
  if (!row || row.user_id !== userId || row.expires_at < new Date().toISOString()) return null;
  await svc.from(devicesTable).update({ last_used_at: new Date().toISOString() })
    .eq('user_id', userId).eq('token_hash', hash);
  return row.user_id;
}

async function issueDeviceToken(svc: any, userId: string, email: string): Promise<string> {
  const secret = randomToken(24);
  const hash = await hmacHex(serverSecret, `${userId}:${secret}`);
  const expires = new Date(Date.now() + DEVICE_TTL_DAYS * 86400000).toISOString();
  await svc.from(devicesTable).upsert({
    user_id: userId, token_hash: hash, expires_at: expires,
    label: String(email).slice(0, 120), last_used_at: new Date().toISOString(),
  });
  return `${userId}:${secret}`;
}

async function revokeDevices(svc: any, userId: string): Promise<void> {
  await svc.from(devicesTable).delete().eq('user_id', userId);
}

const deviceToken = (t: string) => String(t || '').trim();

const sha256Hex = (text: string): Promise<string> =>
  crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then((buf) =>
    [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join(''));

const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I/O to avoid misreading
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1

function randomCode(len: number, alphabet: string): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

const newUnlockCode = () => `${randomCode(4, CODE_ALPHABET)}-${randomCode(4, CODE_ALPHABET)}`;

/* ---------- QR code (PNG) for the "Verify Now" email ---------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return t;
})();
const crc32 = (buf: Uint8Array): number => {
  let c = 0xFFFFFFFF;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
};
function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const len = new Uint8Array(4);
  new DataView(len.buffer).setUint32(0, data.length);
  const td = new Uint8Array([...new TextEncoder().encode(type), ...data]);
  const crc = new Uint8Array(4);
  new DataView(crc.buffer).setUint32(0, crc32(td));
  return new Uint8Array([...len, ...td, ...crc]);
}
async function qrPng(text: string, scale = 8, margin = 4): Promise<Uint8Array> {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const size = (n + margin * 2) * scale;
  const raw = new Uint8Array(size * (size + 1));
  for (let y = 0; y < size; y++) {
    const row = y * (size + 1);
    raw[row] = 0;
    const my = Math.floor(y / scale) - margin;
    for (let x = 0; x < size; x++) {
      const mx = Math.floor(x / scale) - margin;
      const dark = my >= 0 && my < n && mx >= 0 && mx < n && qr.isDark(my, mx);
      raw[row + 1 + x] = dark ? 0 : 255;
    }
  }
  const cs = new CompressionStream('deflate');
  const writer = cs.writable.getWriter();
  writer.write(raw);
  writer.close();
  const idat = new Uint8Array(await new Response(cs.readable).arrayBuffer());
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, size);
  dv.setUint32(4, size);
  ihdr[8] = 8; // bit depth
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  return new Uint8Array([...sig, ...pngChunk('IHDR', ihdr), ...pngChunk('IDAT', idat), ...pngChunk('IEND', new Uint8Array(0))]);
}
const unlockLink = (email: string, pageToken: string, code?: string) =>
  `${APP_URL}${APP_URL.endsWith('/') ? '' : '/'}#/unlock?email=${encodeURIComponent(email)}&k=${encodeURIComponent(pageToken)}` +
  (code ? `&code=${encodeURIComponent(code)}` : '');

const qrUrlFor = (email: string, code: string, pageToken: string) =>
  `${SUPABASE_URL}/functions/v1/auth-gateway?action=qr&email=${encodeURIComponent(email)}&code=${encodeURIComponent(code)}&k=${encodeURIComponent(pageToken)}`;

const newPageToken = () => randomCode(24, 'abcdefhkmnprstuvwxyz23456789');

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...CORS } });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type LockRow = {
  user_id: string; email: string; failed_attempts: number; locked_at: string | null;
  unlock_code_hash: string | null; unlock_code_expires_at: string | null;
  unlock_tries: number; unlock_sent_at: string | null; locked_reason: string | null;
};

function friendlyAuthError(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'Incorrect email or password.';
  if (/email not confirmed/i.test(message)) return 'Please verify your email address first.';
  if (/rate limit|too many/i.test(message)) return 'Too many attempts. Please wait a minute before trying again.';
  if (/signups not allowed|user not found/i.test(message)) return 'No account exists for that email. Ask an administrator to create one.';
  return message;
}

async function mailProvider(): Promise<'maileroo' | 'smtp' | null> {
  if (MAILEROO_API_KEY) return 'maileroo';
  if (SMTP_HOST && SMTP_USER && SMTP_PASS) return 'smtp';
  return null;
}

async function sendMail(to: string, subject: string, html: string): Promise<{ ok: boolean; via: string; error?: string }> {
  const via = await mailProvider();
  if (!via) {
    return { ok: false, via: 'none', error: 'No email provider is configured on auth-gateway (set MAILEROO_API_KEY or SMTP_* secrets).' };
  }
  const fromMatch = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(via === 'maileroo' ? MAILEROO_FROM : SMTP_FROM);
  const fromName = (fromMatch && fromMatch[1]) || 'SAAC OSAS';
  const fromAddr = (fromMatch && fromMatch[2]) || (via === 'maileroo' ? MAILEROO_FROM : SMTP_FROM);
  try {
    if (via === 'maileroo') {
      const res = await fetch('https://smtp.maileroo.com/api/v2/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${MAILEROO_API_KEY}`, 'X-API-Key': MAILEROO_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: { address: fromAddr, display_name: fromName }, to: [{ address: to }], subject, html }),
      });
      if (!res.ok) return { ok: false, via, error: `Maileroo error (${res.status}): ${(await res.text().catch(() => '')).slice(0, 200)}` };
      return { ok: true, via };
    }
    // Minimal SMTP over implicit TLS (port 465 — the only SMTP port Edge
    // Functions may reach). Plain 587/25 are blocked on hosted Supabase.
    const port = Number(SMTP_PORT) || 465;
    let conn = await Deno.connectTls({ hostname: SMTP_HOST, port });
    const enc = new TextEncoder();
    const dec = new TextDecoder();
    let buffer = '';
    const readReply = async (): Promise<string> => {
      const buf = new Uint8Array(4096);
      for (;;) {
        const n = await conn.read(buf);
        if (n === null) break;
        buffer += dec.decode(buf.subarray(0, n));
        const lines = buffer.split(/\r?\n/).filter(Boolean);
        if (lines.length && /^\d{3} /.test(lines[lines.length - 1])) break;
        if (buffer.length > 16384) break;
      }
      return buffer;
    };
    const send = (line: string) => conn.write(enc.encode(`${line}\r\n`));
    const expect = (reply: string, code: string, what: string) => {
      if (!reply.startsWith(code)) throw new Error(`${what} failed: ${reply.slice(0, 160).replace(/\r?\n/g, ' ')}`);
    };
    expect(await readReply(), '220', 'Connect');
    await send('EHLO saac-osas.local');
    expect(await readReply(), '250', 'EHLO');
    await send('AUTH LOGIN');
    expect(await readReply(), '334', 'AUTH');
    await send(btoa(SMTP_USER));
    expect(await readReply(), '334', 'AUTH user');
    await send(btoa(SMTP_PASS));
    expect(await readReply(), '235', 'AUTH credentials');
    await send(`MAIL FROM:<${fromAddr}>`);
    expect(await readReply(), '250', 'MAIL FROM');
    await send(`RCPT TO:<${to}>`);
    expect(await readReply(), '250', 'RCPT TO');
    await send('DATA');
    expect(await readReply(), '354', 'DATA');
    const message = [
      `From: ${fromName} <${fromAddr}>`,
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8',
      '',
      html,
    ].join('\r\n');
    await send(`${message.replace(/(^|\r\n)\./g, '$1..')}\r\n.`);
    expect(await readReply(), '250', 'Message accept');
    await send('QUIT');
    try { conn.close(); } catch { /* ignore */ }
    return { ok: true, via: 'smtp' };
  } catch (err) {
    return { ok: false, via, error: String((err as Error).message || err) };
  }
}

function logoRow(): string {
  return `<tr><td style="background:#3A1024;padding:20px 26px;">
    <table cellpadding="0" cellspacing="0" border="0" style="width:100%"><tr>
      <td style="color:#fff;font-size:17px;font-weight:700;font-family:Arial,Helvetica,sans-serif;line-height:1.2">Saint Agnes Academy</td>
    </tr></table>
    <div style="color:#E9B9CA;font-size:10px;letter-spacing:1.4px;font-weight:600;margin-top:3px">OFFICE OF STUDENT AFFAIRS AND SERVICES</div>
  </td></tr>`;
}

function unlockEmailHtml(email: string, code: string, qrUrl: string, pageToken: string): string {
  const link = unlockLink(email, pageToken);
  return `<div style="background:#f5f1ea;padding:30px 14px;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e7e0d4">
    <table style="width:100%;border-collapse:collapse">${logoRow()}</table>
    <div style="padding:26px 28px">
      <span style="display:inline-block;background:#FEF2F2;color:#B91C1C;border:1px solid #FECACA;font-size:11px;font-weight:700;letter-spacing:1px;padding:4px 12px;border-radius:999px">SECURITY NOTICE</span>
      <h2 style="margin:12px 0 6px;color:#27272a;font-size:19px">Your account was locked</h2>
      <p style="margin:0 0 18px;color:#3f3f46;font-size:14px;line-height:1.6">Someone entered the wrong password too many times, so the account was locked to keep it safe. Verify it&rsquo;s you to unlock it.</p>
      <p style="margin:0 0 20px;text-align:center">
        <a href="${link}" style="display:inline-block;background:#7A1B38;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 30px;border-radius:10px">Verify Now</a>
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px">
        <tr>
          <td align="center" style="padding:16px 10px;background:#FAF6F7;border:1px solid #EBD5DB;border-radius:12px">
            <div style="font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#6B7280;margin-bottom:12px">Option 1 &mdash; Scan to verify</div>
            <img src="${qrUrl}" width="168" height="168" alt="Scan this QR code to verify" style="display:block;width:168px;height:168px;border-radius:8px;background:#fff" />
            <div style="font-size:11.5px;color:#6B7280;margin-top:10px;line-height:1.5">Open the Verify Now page and scan this code<br/>with your camera to unlock instantly.</div>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:16px 10px;background:#FAF6F7;border:1px solid #EBD5DB;border-radius:12px;margin-top:12px">
            <div style="font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#6B7280">Option 2 &mdash; Type your code</div>
            <div style="font-family:'Courier New',monospace;font-size:30px;font-weight:800;letter-spacing:.24em;padding-left:.24em;color:#7A1B38;margin-top:8px">${code}</div>
            <div style="font-size:11.5px;color:#6B7280;margin-top:6px">Enter this code on the Verify Now page.</div>
          </td>
        </tr>
      </table>
      <p style="margin:0;color:#6b7280;font-size:12.5px;line-height:1.6">The code works once and expires in ${UNLOCK_CODE_TTL_MIN} minutes. If you did not try to sign in, someone may be guessing your password &mdash; please contact the OSAS office.</p>
    </div>
    <div style="background:#faf7f2;padding:14px 28px;border-top:1px solid #eee6d9;color:#8b8176;font-size:11px;line-height:1.6">Automated message from the OSAS Dashboard. Please do not reply.</div>
  </div>
</div>`;
}

async function getLock(svc: any, userId: string): Promise<LockRow | null> {
  const { data } = await svc.from(locksTable).select('*').eq('user_id', userId).maybeSingle();
  return data as LockRow | null;
}

async function upsertLock(svc: any, row: Partial<LockRow> & { user_id: string }): Promise<void> {
  const { error } = await svc.from(locksTable).upsert(row);
  if (error) throw new Error(error.message);
}

async function isLocked(svc: any, userId: string): Promise<boolean> {
  const lock = await getLock(svc, userId);
  return Boolean(lock && lock.locked_at);
}

async function setBanned(svc: any, userId: string, banned: boolean): Promise<unknown> {
  const dur = banned ? '876000h' : 'none'; // 100 years ≈ indefinite
  return svc.auth.admin.updateUserById(userId, { ban_duration: dur });
}

async function issueUnlockCode(svc: any, lock: LockRow): Promise<{ sent: boolean; error?: string; isNew: boolean }> {
  const now = Date.now();
  if (lock.unlock_code_expires_at) {
    const expires = new Date(lock.unlock_code_expires_at).getTime();
    const sentAt = lock.unlock_sent_at ? new Date(lock.unlock_sent_at).getTime() : 0;
    const cooldownLeft = sentAt + UNLOCK_RESEND_COOLDOWN_MIN * 60000 - now;
    if (expires > now && cooldownLeft > 0) {
      return { sent: false, isNew: false, error: `An unlock code was just emailed. Request a new one in ${Math.ceil(cooldownLeft / 60000)} min.` };
    }
  }
  const code = newUnlockCode();
  const pageToken = newPageToken();
  const hash = await sha256Hex(`osas-unlock:${lock.user_id}:${code}`);
  const pageHash = await sha256Hex(`osas-page:${lock.user_id}:${pageToken}`);
  const expiresAt = new Date(now + UNLOCK_CODE_TTL_MIN * 60000).toISOString();
  const { error } = await svc.from(locksTable).update({
    unlock_code_hash: hash,
    unlock_code_expires_at: expiresAt,
    unlock_tries: 0,
    unlock_sent_at: new Date().toISOString(),
    page_token_hash: pageHash,
  }).eq('user_id', lock.user_id);
  if (error) return { sent: false, isNew: true, error: error.message };
  const via = await mailProvider();
  if (!via) return { sent: false, isNew: true, error: 'Email is not configured on auth-gateway (MAILEROO_API_KEY or SMTP secrets).' };
  const subject = '[SAAC OSAS] Your account unlock code';
  const html = unlockEmailHtml(lock.email, code, qrUrlFor(lock.email, code, pageToken), pageToken);
  const sendRes = await sendMail(lock.email, subject, html);
  return { sent: sendRes.ok, isNew: true, error: sendRes.ok ? undefined : sendRes.error };
}

async function findUserByEmail(svc: any, email: string): Promise<{ user: any; error: string | null }> {
  try {
    const { data: listed, error } = await svc.auth.admin.listUsers({ page: 1, perPage: 500 });
    if (error) return { user: null, error: error.message };
    const user = (listed?.users || []).find((u: any) => String(u.email || '').toLowerCase() === email);
    return { user: user || null, error: null };
  } catch (e) {
    return { user: null, error: String((e as Error).message || e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method === 'GET') {
    const url = new URL(req.url);
    if (url.searchParams.get('action') === 'qr') {
      const email = String(url.searchParams.get('email') || '').trim().toLowerCase();
      const code = String(url.searchParams.get('code') || '').trim().toUpperCase();
      const k = String(url.searchParams.get('k') || '').trim();
      if (!EMAIL_RE.test(email) || !/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code) || !k) {
        return new Response('Bad request', { status: 400, headers: CORS });
      }
      try {
        const svc = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
        const { data: row } = await svc.from(locksTable).select('user_id, locked_at, unlock_code_expires_at, page_token_hash')
          .eq('email', email).maybeSingle();
        const nowIso = new Date().toISOString();
        if (!row || !row.page_token_hash || !row.locked_at || !row.unlock_code_expires_at
          || row.unlock_code_expires_at < nowIso) return new Response('Not found', { status: 404, headers: CORS });
        const pageHash = await sha256Hex(`osas-page:${row.user_id}:${k}`);
        if (pageHash !== row.page_token_hash) return new Response('Not found', { status: 404, headers: CORS });
        const png = await qrPng(unlockLink(email, k, code));
        return new Response(png, {
          status: 200,
          headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store', ...CORS },
        });
      } catch {
        return new Response('QR generation failed', { status: 500, headers: CORS });
      }
    }
    return new Response('Not found', { status: 404, headers: CORS });
  }
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let payload: Record<string, any>;
  try { payload = await req.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }

  const svc = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const email = String(payload.email || '').trim().toLowerCase();
  const action = String(payload.action || 'sign-in');

  if (action === 'sign-in') {
    const password = String(payload.password || '');
    if (!EMAIL_RE.test(email) || !password) return json({ error: 'Enter your email and password.' }, 400);

    // Trusted device: a valid device token skips failed-attempt counting and OTP
    // and immediately returns a real session (device must not be locked).
    const dt = deviceToken(String(payload.device_token || ''));
    if (dt) {
      const trustedId = await trustedUserId(svc, dt);
      if (trustedId) {
        const { data: listed } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 });
        const trustedUser = (listed?.users || []).find((u: any) => u.id === trustedId);
        if (trustedUser && String(trustedUser.email || '').toLowerCase() === email) {
          if (await isLocked(svc, trustedId)) {
            await revokeDevices(svc, trustedId);
            const e = { locked: true, email };
            return json({ ...e, error: 'This account is locked. Check your email for a Verify Now link.' }, 401);
          }
          const { data: signed2, error: signErr2 } = await svc.auth.signInWithPassword({ email, password });
          if (!signErr2 && signed2 && signed2.session) {
            return json({
              ok: true, trusted: true, session: {
                access_token: signed2.session.access_token,
                refresh_token: signed2.session.refresh_token,
                expires_at: signed2.session.expires_at,
                user: {
                  id: trustedUser.id, email,
                  role: trustedUser.app_metadata?.role || 'client',
                  name: trustedUser.user_metadata?.name || email,
                },
              },
            });
          }
          await revokeDevices(svc, trustedId);
          return json({ error: 'This device is no longer authorized for this account. Sign in with the emailed code.' }, 401);
        }
      }
    }

    const { data: listed, error: findErr } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (findErr) return json({ error: findErr.message }, 500);
    const user = (listed?.users || []).find((u: any) => String(u.email || '').toLowerCase() === email);
    if (!user) {
      // Same response as a wrong password: never reveal account existence.
      return json({ error: 'Incorrect email or password.' }, 401);
    }

    if (await isLocked(svc, user.id)) {
      const lock = await getLock(svc, user.id);
      return json({ locked: true, email, error: 'This account is locked. Check your email for an unlock code, or choose “Account locked?”.' }, 401);
    }

    const { data: signed, error: signErr } = await svc.auth.signInWithPassword({ email, password });
    const ok = !signErr && signed && signed.session;

    await svc.from(attemptsTable).insert({ user_id: user.id, email, ok: !!ok });
    if (ok) {
      await upsertLock(svc, { user_id: user.id, email, failed_attempts: 0, locked_at: null, unlock_tries: 0 });
      // End the check session; the real one comes from the emailed OTP step.
      try { await svc.auth.admin.signOut(signed.session.access_token); } catch { /* ignore */ }
      return json({ ok: true, email, user: { id: user.id, role: user.app_metadata?.role || 'client', name: user.user_metadata?.name || email } });
    }

    const lock = await getLock(svc, user.id) || { user_id: user.id, email, failed_attempts: 0, locked_at: null, unlock_tries: 0, unlock_code_hash: null, unlock_code_expires_at: null, unlock_sent_at: null, locked_reason: null };
    const next = Number(lock.failed_attempts || 0) + 1;
    await upsertLock(svc, { user_id: user.id, email, failed_attempts: next, locked_reason: 'Too many wrong passwords' });

    const remaining = Math.max(0, MAX_FAILED_ATTEMPTS - next);
    if (next >= MAX_FAILED_ATTEMPTS) {
      await setBanned(svc, user.id, true);
      await revokeDevices(svc, user.id);
      const code = newUnlockCode();
      const pageToken = newPageToken();
      const hash = await sha256Hex(`osas-unlock:${user.id}:${code}`);
      const pageHash = await sha256Hex(`osas-page:${user.id}:${pageToken}`);
      await svc.from(locksTable).update({
        locked_at: new Date().toISOString(),
        unlock_code_hash: hash,
        unlock_code_expires_at: new Date(Date.now() + UNLOCK_CODE_TTL_MIN * 60000).toISOString(),
        unlock_tries: 0,
        unlock_sent_at: new Date().toISOString(),
        page_token_hash: pageHash,
      }).eq('user_id', user.id);
      const sendRes = await sendMail(email, '[SAAC OSAS] Your account unlock code', unlockEmailHtml(email, code, qrUrlFor(email, code, pageToken), pageToken));
      return json({
        locked: true, email, attempts: next, remaining: 0,
        unlock_sent: sendRes.ok,
        ...(sendRes.ok ? {} : { unlock_error: sendRes.error }),
        error: 'Too many wrong passwords. This account is now locked — we emailed you an unlock code.',
      }, 401);
    }
    return json({ ok: false, email, attempts: next, remaining, error: `Incorrect email or password. ${remaining} ${remaining === 1 ? 'try' : 'tries'} left before the account locks.` }, 401);
  }

  if (action === 'unlock') {
    const code = String(payload.code || '').trim().toUpperCase();
    const k = String(payload.k || '').trim();
    const normalized = code.includes('-') ? code : (code.length === 8 && !/^\d+$/.test(code) ? `${code.slice(0, 4)}-${code.slice(4)}` : code);
    if (!k) return json({ error: 'Open the unlock page from the "Verify Now" link in your email.' }, 403);
    if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(normalized)) return json({ error: 'Enter the unlock code exactly as it appears in the email (e.g. NSVF-N4D7).' }, 400);

    let targetEmail = String(payload.email || '').trim().toLowerCase();
    let lock: LockRow | null = null;
    if (EMAIL_RE.test(targetEmail)) {
      const { data: byEmail } = await svc.from(locksTable).select('*').eq('email', targetEmail).maybeSingle();
      lock = (byEmail as LockRow | null) || null;
    }
    if (!lock) {
      // Fall back: find any lock row whose stored hash matches this code.
      const { data: candidates } = await svc.from(locksTable).select('user_id, email, locked_at')
        .not('unlock_code_hash', 'is', null).gt('unlock_code_expires_at', new Date().toISOString());
      const list = candidates || [];
      for (const row of list) {
        const hash = await sha256Hex(`osas-unlock:${row.user_id}:${normalized}`);
        const { data: match } = await svc.from(locksTable).select('*').eq('user_id', row.user_id).eq('unlock_code_hash', hash).maybeSingle();
        if (match) { lock = match as LockRow; targetEmail = match.email; break; }
      }
      if (!lock) return json({ error: 'That unlock code is not valid or has expired. Sign in again to get a fresh email, or contact the OSAS office.' }, 400);
    }

    if (!lock.page_token_hash) return json({ error: 'This unlock page invite is no longer valid. Sign in again to receive a fresh email.' }, 403);
    const pageHash = await sha256Hex(`osas-page:${lock.user_id}:${k}`);
    if (pageHash !== lock.page_token_hash) return json({ error: 'This unlock page invite is not valid. Use the "Verify Now" button in the latest email.' }, 403);

    if (!lock.locked_at) {
      await setBanned(svc, lock.user_id, false);
      return json({ ok: true, email: targetEmail, message: 'Your account was already unlocked. Sign in as usual.' });
    }

    const now = Date.now();
    const expires = lock.unlock_code_expires_at ? new Date(lock.unlock_code_expires_at).getTime() : 0;
    if (!expires || expires < now) return json({ error: 'That unlock code has expired. Sign in again to get a fresh one.' }, 400);
    if (lock.unlock_tries >= MAX_UNLOCK_TRIES) {
      return json({ error: 'Too many wrong unlock codes. Sign in again with your password to receive a fresh code.' }, 429);
    }

    const hash = await sha256Hex(`osas-unlock:${lock.user_id}:${normalized}`);
    if (hash !== lock.unlock_code_hash) {
      const tries = Number(lock.unlock_tries || 0) + 1;
      await svc.from(locksTable).update({ unlock_tries: tries }).eq('user_id', lock.user_id);
      const left = Math.max(0, MAX_UNLOCK_TRIES - tries);
      return json({ error: `Wrong unlock code. ${left} ${left === 1 ? 'try' : 'tries'} left.` }, 401);
    }

    const { error: unbanErr } = await setBanned(svc, lock.user_id, false);
    if (unbanErr) return json({ error: unbanErr.message || 'Could not unlock the account.' }, 500);
    const resetToken = randomCode(24, 'abcdefhkmnprstuvwxyz23456789');
    const resetHash = await sha256Hex(`osas-reset:${lock.user_id}:${resetToken}`);
    await svc.from(locksTable).update({
      locked_at: null, failed_attempts: 0, unlock_code_hash: null,
      unlock_code_expires_at: null, unlock_tries: 0, unlock_sent_at: null, locked_reason: null,
      page_token_hash: null, reset_token_hash: resetHash,
      reset_token_expires_at: new Date(Date.now() + 15 * 60000).toISOString(),
    }).eq('user_id', lock.user_id);
    await svc.from(attemptsTable).insert({ user_id: lock.user_id, email: targetEmail, ok: true, locked: false });
    return json({ ok: true, email: targetEmail, reset_token: resetToken, message: 'Account unlocked. You can now change your password.' });
  }

  if (action === 'change-password') {
    const resetToken = String(payload.reset_token || '').trim();
    const password = String(payload.password || '');
    if (!resetToken) return json({ error: 'Your unlock session expired. Start again from the email link.' }, 403);
    if (password.length < 8) return json({ error: 'The new password must be at least 8 characters.' }, 400);

    const { data: candidates } = await svc.from(locksTable).select('user_id, email, reset_token_hash, reset_token_expires_at')
      .not('reset_token_hash', 'is', null).gt('reset_token_expires_at', new Date().toISOString());
    const list = candidates || [];
    let userId = '';
    let targetEmail = '';
    for (const row of list) {
      const hash = await sha256Hex(`osas-reset:${row.user_id}:${resetToken}`);
      if (hash === row.reset_token_hash) { userId = row.user_id; targetEmail = row.email; break; }
    }
    if (!userId) return json({ error: 'Your password-reset window expired. Sign in again to start over.' }, 403);

    const { error: updErr } = await svc.auth.admin.updateUserById(userId, { password });
    if (updErr) return json({ error: updErr.message || 'Could not set the new password.' }, 500);
    await revokeDevices(svc, userId);
    await svc.from(locksTable).update({ reset_token_hash: null, reset_token_expires_at: null, failed_attempts: 0 }).eq('user_id', userId);
    await svc.from(attemptsTable).insert({ user_id: userId, email: targetEmail, ok: true, locked: false });
    return json({ ok: true, message: 'Password updated. Sign in with your new password.' });
  }

  if (action === 'resend-unlock') {
    if (!EMAIL_RE.test(email)) return json({ error: 'Enter the email of the locked account.' }, 400);
    const { data: listed, error: findErr } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (findErr) return json({ error: findErr.message }, 500);
    const user = (listed?.users || []).find((u: any) => String(u.email || '').toLowerCase() === email);
    if (!user) return json({ error: 'No locked account found for that email.' }, 404);
    const lock = await getLock(svc, user.id);
    if (!lock || !lock.locked_at) return json({ ok: true, message: 'That account is not locked. Sign in normally.' });
    const issued = await issueUnlockCode(svc, lock);
    if (!issued.sent && issued.error && !issued.isNew) return json({ error: issued.error }, 429);
    return json({ ok: true, sent: issued.sent, ...(issued.error ? { note: issued.error } : {}), message: issued.sent ? 'A fresh unlock code was emailed.' : undefined });
  }

  if (action === 'verify-trusted') try {
    const password = String(payload.password || '');
    const code = String(payload.code || '').replace(/\s+/g, '');
    const remember = payload.remember === true;
    if (!EMAIL_RE.test(email) || !/^[0-9]{5}$/.test(code) || !password) {
      return json({ error: 'Enter the 5-digit code from your email.' }, 400);
    }
    const { user, error: findErr } = await findUserByEmail(svc, email);
    if (findErr) return json({ error: 'Sign-in is unavailable right now. Try again.' }, 503);
    if (!user) return json({ error: 'Incorrect email or password.' }, 401);

    const { data: signed, error: signErr } = await svc.auth.signInWithPassword({ email, password });
    if (signErr || !signed || !signed.session) {
      return json({ error: 'Your session expired. Enter your email and password again.' }, 401);
    }
    const { error: otpErr } = await svc.auth.verifyOtp({
      email, token: code, type: 'email',
    });
    if (otpErr) {
      try { await svc.auth.admin.signOut(signed.session.access_token); } catch {}
      return json({ error: 'That code is incorrect or has expired. Request a new one.' }, 401);
    }
    const r: Record<string, unknown> = {
      ok: true,
      session: {
        access_token: signed.session.access_token,
        refresh_token: signed.session.refresh_token,
        expires_at: (signed.session as any).expires_at,
        user: {
          id: user.id, email,
          role: user.app_metadata?.role || 'client',
          name: user.user_metadata?.name || email,
        },
      },
    };
    if (remember) {
      try { await svc.auth.admin.signOut(signed.session.access_token); } catch {}
      const { data: resigned } = await svc.auth.signInWithPassword({ email, password });
      if (resigned && resigned.session) {
        r.session = {
          access_token: resigned.session.access_token,
          refresh_token: resigned.session.refresh_token,
          expires_at: (resigned.session as any).expires_at,
          user: r.session ? (r.session as any).user : undefined,
        };
      }
      r.device_token = await issueDeviceToken(svc, user.id, email);
      await svc.from(locksTable).upsert({ user_id: user.id, email, failed_attempts: 0, locked_at: null, unlock_tries: 0 });
    }
    return json(r);
  } catch {
    return json({ error: 'Verification failed. Please try again.' }, 500);
  }

  return json({ error: 'Unknown action.' }, 400);
});
