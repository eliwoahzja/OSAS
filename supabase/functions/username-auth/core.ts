const USERNAME = /^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/;
const INVALID_LOGIN = 'Incorrect username or password.';
const UNKNOWN_EMAIL = 'no-account@osas.invalid';

type Dependencies = {
  lookup: (username: string) => Promise<{ id: string; email: string } | null>;
  signIn: (email: string, password: string) => Promise<any>;
  recover: (email: string, redirectTo: string) => Promise<any>;
};

export function createUsernameAuthHandler({ lookup, signIn, recover }: Dependencies) {
  const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  return async (req: Request) => {
    if (req.method !== 'POST') return json({ error: 'POST only.' }, 405);
    let body: any;
    try { body = await req.json(); } catch { return json({ error: 'Invalid JSON.' }, 400); }
    if (!body || !['sign-in', 'recover'].includes(body.action)) return json({ error: 'Unknown action.' }, 400);
    const username = String(body.username || '').trim().toLowerCase();
    if (!USERNAME.test(username)) return json({ error: 'Enter a valid username.' }, 400);
    if (body.action === 'sign-in' && (typeof body.password !== 'string' || !body.password || body.password.length > 128)) {
      return json({ error: INVALID_LOGIN }, 400);
    }
    let redirectTo = '';
    if (body.action === 'recover') {
      try {
        const url = new URL(body.redirectTo);
        if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) throw new Error();
        redirectTo = url.href;
      } catch { return json({ error: 'Invalid recovery URL.' }, 400); }
    }
    try {
      const account = await lookup(username);
      // Always call Supabase Auth, even for unknown usernames. Do not expose
      // registered email addresses from a public username-lookup endpoint.
      const email = account?.email || UNKNOWN_EMAIL;
      if (body.action === 'recover') {
        // Supabase Auth enforces the project's redirect allowlist and throttles
        // requests. Unknown users receive the same response, with no mailbox.
        const { error } = await recover(email, redirectTo);
        if (error) return json({ error: 'Could not send the password reset email. Please try again shortly.' }, 502);
        return json({ message: 'If this username has an account, a password reset link has been sent.' });
      }
      const { data, error } = await signIn(email, body.password);
      if (!account || error || !data?.session || data.session.user?.id !== account.id) return json({ error: INVALID_LOGIN }, 400);
      // Only a correct password may reveal the email/session. The browser then
      // performs the existing email OTP flow before opening the dashboard.
      return json({ session: data.session });
    } catch {
      return json({ error: 'The sign-in service is unavailable. Please try again shortly.' }, 503);
    }
  };
}
