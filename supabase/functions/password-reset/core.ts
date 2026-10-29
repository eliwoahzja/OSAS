import { accountEmail } from './email-template.ts';
// Dependency injection keeps security and delivery behavior testable without email or live accounts.
export const REQUEST_MESSAGE = 'Your details have been submitted for administrator review. If the request is eligible and approved, you will receive an email with a link to set your password.';
export const PUBLIC_APP_URL = 'https://osas.stagnesacademy-sms.com/';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^[a-f0-9]{64}$/;
export const escapeHtml = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export async function digest(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}
function token() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, '0')).join('');
}
const invalidLink = { error: 'This reset link is invalid, expired, or already used. Request a new link from sign-in.' };

type Dependencies = {
  store: any;
  sendMail: (to: string[], subject: string, html: string) => Promise<void>;
  appUrl?: string;
  now?: () => number;
};
export function createResetHandler({ store, sendMail, appUrl = PUBLIC_APP_URL, now = Date.now }: Dependencies) {
  const root = new URL(appUrl);
  if (root.protocol !== 'https:' && root.hostname !== 'localhost' && root.hostname !== '127.0.0.1') throw new Error('APP_URL must use HTTPS.');
  const link = (fragment: string) => { const u = new URL(root); u.hash = fragment; return u.href; };
  const deliver = (to: string[], subject: string, html: string) => sendMail(to, subject, accountEmail(html, root.href));
  const details = (r: any) => [
    ['Request type', r.request_kind === 'registration' ? 'Registration' : 'Password reset'], ['Submitted full name', r.submitted_name || r.name], ['Saved account name', r.request_kind === 'registration' ? 'New account' : r.name], ['Account email', r.email], ['Account type', r.role === 'admin' ? 'Administrator' : 'Student'],
    ['Account created', r.account_created_at], ['Last sign-in', r.last_sign_in_at || 'Never'], ['Requested at', r.requested_at],
  ].map(([key, value]) => `<tr><th style="text-align:left;padding:6px">${key}</th><td style="padding:6px">${escapeHtml(value)}</td></tr>`).join('');

  return async (req: Request) => {
    const response = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
    if (req.method !== 'POST') return response({ error: 'POST only.' }, 405);
    let body: any;
    try { body = await req.json(); } catch { return response({ error: 'Invalid JSON.' }, 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return response({ error: 'Invalid request.' }, 400);
    try {
      if (body.action === 'request') {
        const email = String(body.email || '').trim().toLowerCase();
        if (email.length > 254 || !EMAIL.test(email)) return response({ error: 'Enter a valid email address.' }, 400);
        if (body.student_id !== undefined || body.username !== undefined) return response({ error: 'Student IDs are generated automatically when the student account is created.' }, 400);
        const name = String(body.name || '').trim();
        const kind = body.kind || 'reset';
        if (!['reset', 'registration'].includes(kind)) return response({ error: 'Invalid request type.' }, 400);
        if (name.length < 2 || name.length > 120) return response({ error: 'Enter your full name (2 to 120 characters).' }, 400);
        const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
        const id = await store.submit(email, await digest(`osas-reset-ip:${ip}`), name, kind);
        if (id) {
          const record = await store.get(id);
          try {
            const admins = await store.adminEmails();
            if (!admins.length) throw new Error('No administrator email configured.');
            await deliver(admins, '[SAAC OSAS] Account approval requested',
              `<h2>Account approval requested</h2><p>Review the account details before approving this request.</p><table>${details(record)}</table><p><a href="${escapeHtml(link('/accounts'))}">Open Accounts to approve or reject</a></p><p>Sign in as an administrator. This email does not grant approval.</p>`);
            await store.patch(id, { notification_error: null });
          } catch {
            await store.patch(id, { notification_error: 'Administrator email delivery failed. Review this request in Accounts.' });
          }
        }
        // Existing, unknown, duplicate and throttled accounts receive the same response.
        return response({ message: REQUEST_MESSAGE });
      }
      if (body.action === 'complete') {
        const id = String(body.id || '');
        const supplied = String(body.token || '');
        const password = String(body.password || '');
        if (!UUID.test(id) || !TOKEN.test(supplied)) return response(invalidLink, 400);
        if (password.length < 8 || password.length > 128) return response({ error: 'Use a password between 8 and 128 characters.' }, 400);
        const record = await store.claim(id, ['approved'], { status: 'resetting' }, { token_hash: await digest(supplied), expires_after: new Date(now()).toISOString() });
        if (!record) return response(invalidLink, 400);
        let studentId: string | null = null;
        try {
          if (record.request_kind === 'registration') {
            const created = await store.createAccount(record, password);
            record.user_id = created.id;
            studentId = created.student_id;
          } else {
            const account = await store.account(record.user_id);
            if (!account || String(account.email).toLowerCase() !== record.email) throw new Error('The account email changed. Ask an administrator for a new link.');
            await store.updatePassword(record.user_id, password);
          }
        } catch (error) {
          await store.patch(id, { status: 'approved' }, 'resetting');
          return response({ error: String((error as Error).message || 'Password update failed. Try again.') }, 400);
        }
        await store.patch(id, { status: 'completed', user_id: record.user_id, token_hash: null, completed_at: new Date(now()).toISOString() }, 'resetting');
        if (record.request_kind === 'registration') {
          // A mail outage must not undo successful account creation or hide the ID.
          try {
            await deliver([record.email], '[SAAC OSAS] Your student ID',
              `<h2>Your student account is ready</h2><p>Your student ID is <strong>${escapeHtml(studentId)}</strong>.</p><p>Sign in with this ID and the password you just set. Verification codes will continue to go to this email address.</p><p><a href="${escapeHtml(link('/sign-in'))}">Sign in to OSAS</a></p>`);
          } catch { /* The ID is also returned on screen and shown in Accounts. */ }
          return response({ student_id: studentId, message: `Account created. Your student ID is ${studentId}. Sign in with this ID and your new password.` });
        }
        return response({ message: 'Password updated. Sign in with your new password.' });
      }
      if (!['list', 'approve', 'reject', 'delete'].includes(body.action)) return response({ error: 'Unknown action.' }, 400);
      const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
      const actor = jwt ? await store.actor(jwt) : null;
      if (!actor) return response({ error: 'Sign-in required.' }, 401);
      if (actor.app_metadata?.role !== 'admin') return response({ error: 'Administrators only.' }, 403);
      if (body.action === 'list') return response({ requests: await store.list() });
      const id = String(body.id || '');
      if (!UUID.test(id)) return response({ error: 'Invalid request.' }, 400);
      if (body.action === 'delete') {
        const record = await store.claim(id, ['approved', 'rejected', 'completed'], { archived_at: new Date(now()).toISOString() });
        if (!record) return response({ error: 'Only reviewed requests can be deleted from the list.' }, 409);
        return response({ message: 'Request removed from the list. Approved password links remain valid until used, revoked or expired.' });
      }
      const reviewed = { reviewed_by: actor.id, reviewed_at: new Date(now()).toISOString() };
      if (body.action === 'reject') {
        const record = await store.claim(id, ['pending', 'approved'], { ...reviewed, status: 'rejected', token_hash: null });
        if (!record) return response({ error: 'This request has already been reviewed or is being processed.' }, 409);
        return response({ message: 'Request rejected. Any previous reset link is revoked.' });
      }
      const secret = token();
      const record = await store.claim(id, ['pending'], {
        ...reviewed, status: 'issuing', token_hash: await digest(secret), expires_at: new Date(now() + 30 * 60000).toISOString(), notification_error: null,
      });
      if (!record) return response({ error: 'This request has already been reviewed or is being processed.' }, 409);
      try {
        if (record.request_kind !== 'registration') {
          const account = await store.account(record.user_id);
          if (!account || String(account.email).toLowerCase() !== record.email) throw new Error('Account email changed.');
        } else if (await store.emailExists(record.email)) throw new Error('This email already has an account.');
        await deliver([record.email], '[SAAC OSAS] Your approved password setup link',
          `<h2>Your account request was approved</h2><p>Hello ${escapeHtml(record.name)},</p><p>An administrator approved the request for ${escapeHtml(record.email)}. Set your own new password using the link below.</p><p><a href="${escapeHtml(link('/reset-password?request=' + id + '&token=' + secret))}">Set a new password</a></p><p>This link expires in 30 minutes and works once. For a reset, your current password remains unchanged until you submit a new one. For registration, your student account is created after you set your password. If you did not request this, contact the OSAS office.</p>`);
      } catch {
        await store.patch(id, { status: 'pending', token_hash: null, expires_at: null, notification_error: 'Reset email delivery failed or the account email changed. Check the account and retry approval.' }, 'issuing');
        return response({ error: 'The reset email was not sent. The request remains pending. Check the account email and email service, then retry.' }, 502);
      }
      await store.patch(id, { status: 'approved' }, 'issuing');
      return response({ message: 'Approved. A single-use reset link was emailed to the account owner.' });
    } catch {
      return response({ error: 'The password reset service is unavailable. Try again shortly.' }, 503);
    }
  };
}
