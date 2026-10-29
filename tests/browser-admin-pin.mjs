// Runs the real app/auth/login modules with intercepted Auth, PIN, and REST traffic.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.TEST_ORIGIN || 'http://localhost:3000';
const backend = 'https://admin-pin-test.supabase.co';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
  args: ['--no-sandbox'], headless: true,
});
const sdk = `export function createClient(url, key, options = {}) {
  const storage=options.auth?.storage||localStorage;
  const storageKey='test.admin.'+(options.auth?.storageKey||'default');
  const callbacks=[];
  const read=()=>JSON.parse(storage.getItem(storageKey)||'null');
  const emit=(event,session)=>callbacks.forEach(fn=>fn(event,session));
  const write=session=>session?storage.setItem(storageKey,JSON.stringify(session)):storage.removeItem(storageKey);
  const call=async(path,body)=>{
    const response=await fetch(url+'/auth/v1/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const data=await response.json();
    if(!response.ok)return {error:{message:data.message}};
    if(data.data?.session){write(data.data.session);emit('SIGNED_IN',data.data.session)}
    return data;
  };
  const channel={on(){return channel},subscribe(){return channel}};
  return {channel:()=>channel,removeChannel:async()=>{},auth:{
    onAuthStateChange(fn){callbacks.push(fn);queueMicrotask(()=>fn('INITIAL_SESSION',read()))},
    getSession:async()=>({data:{session:read()}}),
    signInWithPassword:body=>call('password',body),
    setSession:body=>call('adopt',body),
    signInWithOtp:body=>call('otp',body),
    async signOut(){write(null);emit('SIGNED_OUT',null);return {error:null}},
  }};
}`;

async function scenario({ hasPin = true, failStatus = false, trusted = false } = {}) {
  const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 900 } });
  if (trusted) await context.addInitScript(() => {
    try { localStorage.setItem('osas.device.trust', JSON.stringify({ 'admin@example.test': { expiresAt: Date.now() + 86400000 } })); } catch {}
  });
  const requests = [];
  const errors = [];
  const session = { access_token: 'password-access', refresh_token: 'password-refresh', user: {
    id: '11111111-1111-4111-8111-111111111111', email: 'admin@example.test', app_metadata: { role: 'admin' }, user_metadata: { name: 'Administrator' },
  } };
  context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === origin && url.pathname === '/js/config.js') return route.fulfill({ contentType: 'text/javascript', body: `window.OSAS={SUPABASE_URL:'${backend}',SUPABASE_ANON_KEY:'public-test-key'};` });
    if (url.origin === 'https://cdn.jsdelivr.net' && url.pathname.includes('@supabase/supabase-js@')) return route.fulfill({ contentType: 'text/javascript', body: sdk });
    if (url.origin === backend) {
      const record = { path: url.pathname, headers: request.headers(), body: request.postData() ? request.postDataJSON() : null };
      requests.push(record);
      const reply = (data, status = 200) => route.fulfill({ contentType: 'application/json', status, body: JSON.stringify(data) });
      if (url.pathname === '/auth/v1/password') {
        assert.equal(record.body.email, 'admin@example.test');
        assert.equal(record.body.password, 'Password12');
        return reply({ data: { session }, error: null });
      }
      if (url.pathname === '/auth/v1/adopt') return reply({ data: { session }, error: null });
      if (url.pathname === '/functions/v1/student-auth') return reply({ session });
      if (url.pathname === '/functions/v1/admin-pin') {
        assert.equal(record.headers.authorization, 'Bearer password-access');
        if (record.body.action === 'status') return failStatus ? reply({ error: 'PIN service unavailable in test.' }, 503) : reply({ has_pin: hasPin });
        assert.ok(['setup', 'verify'].includes(record.body.action));
        if (record.body.pin !== '1234') return reply({ error: 'Wrong PIN. Try again.' }, 400);
        hasPin = true;
        return reply({ ok: true });
      }
      if (url.pathname === '/auth/v1/otp') return reply({ error: 'Administrators must never request OTP.' }, 500);
      if (url.pathname === '/rest/v1/users') {
        assert.equal(url.searchParams.get('id'), `eq.${session.user.id}`);
        return reply([{ student_id: 's260000001' }]);
      }
      if (url.pathname.startsWith('/rest/v1/')) return reply([]);
      throw new Error('Unexpected backend request: ' + url.pathname);
    }
    if (url.origin === origin) return route.continue();
    return route.abort('blockedbyclient');
  });
  const page = await context.newPage();
  await page.goto(`${origin}/#/sign-in`);
  await page.getByRole('heading', { name: 'Welcome Back', exact: true }).waitFor();
  const signIn = async (identifier = 'admin@example.test') => {
    await page.locator('#login-overlay input[autocomplete="username"]').fill(identifier);
    await page.getByPlaceholder('Password', { exact: true }).fill('Password12');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  };
  return { context, page, requests, errors, signIn };
}
const noOtp = requests => assert.equal(requests.filter(r => r.path === '/auth/v1/otp').length, 0);
const pinCalls = requests => requests.filter(r => r.path === '/functions/v1/admin-pin');

try {
  const existing = await scenario({ trusted: true });
  await existing.signIn();
  await existing.page.getByRole('heading', { name: 'Enter your PIN', exact: true }).waitFor();
  assert.equal(await existing.page.locator('.lg-pin-dot').count(), 4);
  assert.equal(await existing.page.evaluate(async () => (await import('/js/auth.js')).isSignedIn()), false);
  assert.equal(await existing.page.evaluate(async () => (await import('/js/auth.js')).currentAccessToken()), null);
  assert.equal(existing.requests.some(r => r.path.startsWith('/rest/')), false);
  await existing.page.keyboard.type('0000');
  await existing.page.getByRole('alert').filter({ hasText: 'Wrong PIN. Try again.' }).waitFor();
  assert.equal(await existing.page.evaluate(async () => (await import('/js/auth.js')).isSignedIn()), false);
  await existing.page.keyboard.type('1234');
  await existing.page.waitForFunction(() => document.body.dataset.session === 'active');
  assert.equal(await existing.page.evaluate(async () => (await import('/js/auth.js')).isAdmin()), true);
  assert.deepEqual(pinCalls(existing.requests).map(r => r.body.action), ['status', 'verify', 'verify']);
  noOtp(existing.requests);
  await existing.page.reload();
  await existing.page.waitForFunction(() => document.body.dataset.session === 'active');
  const otherTab = await existing.context.newPage();
  await otherTab.goto(`${origin}/#/sign-in`);
  await otherTab.getByRole('heading', { name: 'Welcome Back', exact: true }).waitFor();
  assert.equal(await otherTab.evaluate(async () => (await import('/js/auth.js')).isSignedIn()), false);
  assert.deepEqual(existing.errors, []);
  await existing.context.close();

  const setup = await scenario({ hasPin: false });
  await setup.signIn();
  await setup.page.getByRole('heading', { name: 'Create your PIN', exact: true }).waitFor();
  await setup.page.keyboard.type('1234');
  await setup.page.getByRole('heading', { name: 'Confirm your PIN', exact: true }).waitFor();
  assert.equal(pinCalls(setup.requests).length, 1);
  await setup.page.keyboard.type('4321');
  await setup.page.getByRole('alert').filter({ hasText: 'The PINs do not match.' }).waitFor();
  await setup.page.getByRole('heading', { name: 'Create your PIN', exact: true }).waitFor();
  assert.equal(pinCalls(setup.requests).length, 1);
  await setup.page.keyboard.type('1234');
  await setup.page.getByRole('heading', { name: 'Confirm your PIN', exact: true }).waitFor();
  await setup.page.keyboard.type('1234');
  await setup.page.waitForFunction(() => document.body.dataset.session === 'active');
  assert.deepEqual(pinCalls(setup.requests).map(r => r.body.action), ['status', 'setup']);
  noOtp(setup.requests);
  assert.deepEqual(setup.errors, []);
  await setup.context.close();

  for (const cancel of [true, false]) {
    const pending = await scenario();
    await pending.signIn();
    await pending.page.getByRole('heading', { name: 'Enter your PIN', exact: true }).waitFor();
    if (cancel) await pending.page.getByRole('button', { name: 'Use a different account', exact: false }).click();
    else await pending.page.reload();
    await pending.page.getByRole('heading', { name: 'Welcome Back', exact: true }).waitFor();
    assert.equal(await pending.page.evaluate(async () => (await import('/js/auth.js')).isSignedIn()), false);
    assert.equal(await pending.page.evaluate(() => localStorage.getItem('test.admin.default')), null);
    noOtp(pending.requests);
    assert.deepEqual(pending.errors, []);
    await pending.context.close();
  }

  const unavailable = await scenario({ failStatus: true });
  await unavailable.signIn();
  await unavailable.page.getByRole('alert').filter({ hasText: 'PIN service unavailable in test.' }).waitFor();
  assert.equal(await unavailable.page.getByRole('button', { name: 'Sign In', exact: true }).isEnabled(), true);
  assert.equal(await unavailable.page.evaluate(() => localStorage.getItem('test.admin.default')), null);
  noOtp(unavailable.requests);
  await unavailable.context.close();

  const wrongIdentifier = await scenario();
  await wrongIdentifier.signIn('s260000001');
  await wrongIdentifier.page.getByRole('alert').filter({ hasText: 'Administrators sign in using their email address' }).waitFor();
  assert.equal(pinCalls(wrongIdentifier.requests).length, 0);
  noOtp(wrongIdentifier.requests);
  assert.equal(await wrongIdentifier.page.evaluate(async () => (await import('/js/auth.js')).isSignedIn()), false);
  await wrongIdentifier.context.close();
  console.log('Admin PIN browser OK: email/password -> server PIN, no OTP, trusted-device PIN requirement, wrong-PIN retry, first-use confirmation/setup, cancel, pending reload, completed reload, new-tab gate, service failure, and admin ID rejection.');
} finally {
  await browser.close();
}
