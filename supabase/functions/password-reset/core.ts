// Dependency injection keeps security and delivery behavior testable without email or live accounts.
export const REQUEST_MESSAGE = 'If this email belongs to an account, an administrator will review your request. After approval, you will receive a password reset link.';
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
  appUrl: string;
  now?: () => number;
};
export function createResetHandler({ store, sendMail, appUrl, now = Date.now }: Dependencies) {
  const root = new URL(appUrl);
  if (root.protocol !== 'https:' && root.hostname !== 'localhost' && root.hostname !== '127.0.0.1') throw new Error('APP_URL must use HTTPS.');
  const link = (fragment: string) => { const u = new URL(root); u.hash = fragment; return u.href; };
  const details = (r: any) => [
    ['Account name', r.name], ['Account email', r.email], ['Account type', r.role === 'admin' ? 'Administrator' : 'Student'],
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
        const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
        const id = await store.submit(email, await digest(`osas-reset-ip:${ip}`));
        if (id) {
          const record = await store.get(id);
          try {
            const admins = await store.adminEmails();
            if (!admins.length) throw new Error('No administrator email configured.');
            await sendMail(admins, '[SAAC OSAS] Password reset approval requested',
              `<h2>Password reset approval requested</h2><p>Review the account details before approving this request.</p><table>${details(record)}</table><p><a href="${escapeHtml(link('/accounts'))}">Open Accounts to approve or reject</a></p><p>Sign in as an administrator. This email does not grant approval.</p>`);
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
        try {
          const account = await store.account(record.user_id);
          if (!account || String(account.email).toLowerCase() !== record.email) throw new Error('The account email changed. Ask an administrator for a new link.');
          await store.updatePassword(record.user_id, password);
        } catch (error) {
          await store.patch(id, { status: 'approved' }, 'resetting');
          return response({ error: String((error as Error).message || 'Password update failed. Try again.') }, 400);
        }
        await store.patch(id, { status: 'completed', token_hash: null, completed_at: new Date(now()).toISOString() }, 'resetting');
        return response({ message: 'Password updated. Sign in with your new password.' });
      }
      if (!['list', 'approve', 'reject'].includes(body.action)) return response({ error: 'Unknown action.' }, 400);
      const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
      const actor = jwt ? await store.actor(jwt) : null;
      if (!actor) return response({ error: 'Sign-in required.' }, 401);
      if (actor.app_metadata?.role !== 'admin') return response({ error: 'Administrators only.' }, 403);
      if (body.action === 'list') return response({ requests: await store.list() });
      const id = String(body.id || '');
      if (!UUID.test(id)) return response({ error: 'Invalid request.' }, 400);
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
        const account = await store.account(record.user_id);
        if (!account || String(account.email).toLowerCase() !== record.email) throw new Error('Account email changed.');
        await sendMail([record.email], '[SAAC OSAS] Your approved password reset link',
          `<h2>Your password reset request was approved</h2><p>Hello ${escapeHtml(record.name)},</p><p>An administrator approved the request for ${escapeHtml(record.email)}. Set your own new password using the link below.</p><p><a href="${escapeHtml(link('/reset-password?request=' + id + '&token=' + secret))}">Set a new password</a></p><p>This link expires in 30 minutes and works once. Your current password remains unchanged until you submit a new one. If you did not request this, contact the OSAS office.</p>`);
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
