type Actor = { id: string; app_metadata?: { role?: string }; password_verified?: boolean };
type PinResult = { ok?: boolean; has_pin?: boolean; code?: string; retry_after?: number };
type Dependencies = {
  actor: (jwt: string) => Promise<Actor | null>;
  pinAction: (userId: string, action: string, pin: string | null) => Promise<PinResult>;
};

// Decode only after Auth has validated this exact JWT with getUser().
export function hasPasswordAuthentication(jwt: string): boolean {
  try {
    const claims = JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return Array.isArray(claims.amr) && claims.amr.some((item: { method?: string }) => item?.method === 'password');
  } catch { return false; }
}

export function createAdminPinHandler({ actor, pinAction }: Dependencies) {
  const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
    Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
  return async (req: Request) => {
    if (req.method !== 'POST') return json({ error: 'POST only.' }, 405);
    const bearer = /^Bearer\s+(\S+)$/i.exec(req.headers.get('Authorization') || '');
    if (!bearer) return json({ error: 'Sign in with your administrator email and password first.', code: 'sign_in_required' }, 401);
    try {
      const user = await actor(bearer[1]);
      if (!user) return json({ error: 'Your sign-in expired. Enter your email and password again.', code: 'sign_in_required' }, 401);
      if (user.app_metadata?.role !== 'admin') return json({ error: 'Administrators only.', code: 'admin_only' }, 403);
      let body: any;
      try { body = await req.json(); } catch { return json({ error: 'Invalid JSON.' }, 400); }
      if (!body || typeof body !== 'object' || Array.isArray(body) || !['status', 'setup', 'verify'].includes(body.action)) {
        return json({ error: 'Invalid request.' }, 400);
      }
      if (body.action !== 'status') {
        if (!user.password_verified) return json({ error: 'Sign in with your administrator email and password first.', code: 'password_required' }, 401);
        if (typeof body.pin !== 'string' || !/^\d{4}$/.test(body.pin)) return json({ error: 'Enter a 4-digit PIN.', code: 'invalid_pin' }, 400);
      }
      const result = await pinAction(user.id, body.action, body.action === 'status' ? null : body.pin);
      if (result.code === 'admin_only') return json({ error: 'Administrators only.', code: 'admin_only' }, 403);
      if (result.code === 'already_configured') return json({ error: 'A PIN is already configured. Enter your existing PIN.', code: 'already_configured' }, 409);
      if (result.code === 'pin_not_set') return json({ error: 'Set your administrator PIN first.', code: 'pin_not_set' }, 409);
      if (result.code === 'locked') {
        const retry = Math.max(1, Math.ceil(Number(result.retry_after) || 900));
        return json({ error: 'Too many incorrect PINs. Wait 15 minutes before trying again.', code: 'locked', retry_after: retry }, 429, { 'Retry-After': String(retry) });
      }
      if (result.code === 'incorrect_pin') return json({ error: 'Wrong PIN. Try again.', code: 'incorrect_pin' }, 400);
      if (body.action === 'status' && typeof result.has_pin === 'boolean') return json({ has_pin: result.has_pin });
      if (result.ok === true) return json({ ok: true });
      return json({ error: 'PIN verification is temporarily unavailable. Please try again.', code: 'pin_service_unavailable' }, 503);
    } catch {
      return json({ error: 'PIN verification is temporarily unavailable. Please try again.', code: 'pin_service_unavailable' }, 503);
    }
  };
}
