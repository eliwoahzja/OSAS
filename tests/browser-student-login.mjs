// Run against a local dev server. All Auth/REST traffic is intercepted.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.TEST_ORIGIN || 'http://localhost:3000';
const backend = 'https://student-login-test.supabase.co';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
  args: ['--no-sandbox'], headless: true,
});
const sdk = `export function createClient(url, key, options = {}) {
  const storage = options.auth?.storage || localStorage;
  const storageKey = 'test.auth.' + (options.auth?.storageKey || 'default');
  const callbacks = [];
  const read = () => JSON.parse(storage.getItem(storageKey) || 'null');
  const emit = (event, session) => callbacks.forEach(fn => fn(event, session));
  const write = session => session ? storage.setItem(storageKey, JSON.stringify(session)) : storage.removeItem(storageKey);
  const call = async (path, body) => {
    const response = await fetch(url + '/auth/v1/' + path, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const data = await response.json();
    if (!response.ok) return { error: { message: data.message } };
    if (data.data?.session) { write(data.data.session); emit('SIGNED_IN', data.data.session); }
    return data;
  };
  const channel = { on() {return channel}, subscribe() {return channel} };
  return {
    channel: () => channel, removeChannel: async () => {},
    auth: {
      onAuthStateChange(fn) { callbacks.push(fn); queueMicrotask(() => fn('INITIAL_SESSION',read())); },
      getSession: async () => ({data:{session:read()}}),
      signInWithPassword: body => call('password',body),
      setSession: body => call('adopt',body),
      signInWithOtp: body => call('otp',body),
      verifyOtp: body => call('verify',body),
      async signOut() {write(null);emit('SIGNED_OUT',null);return {error:null}},
    }
  };
}`;

async function scenario(identifier, role = 'client') {
  const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const requests = [];
  const errors = [];
  const profileId = role === 'admin' ? 's260000102' : 's260000101';
  const session = {
    access_token: 'verified-test-access', refresh_token: 'verified-test-refresh',
    user: { id: '11111111-1111-4111-8111-111111111111', email: 'personal@example.test', app_metadata: { role }, user_metadata: { name: 'Account One' } },
  };
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === origin && url.pathname === '/js/config.js') return route.fulfill({ contentType: 'text/javascript', body: `window.OSAS={SUPABASE_URL:'${backend}',SUPABASE_ANON_KEY:'public-test-key',PIN_ACCOUNTS:{}};` });
    if (url.origin === 'https://cdn.jsdelivr.net' && url.pathname.includes('@supabase/supabase-js@')) return route.fulfill({ contentType: 'text/javascript', body: sdk });
    if (url.origin === backend) {
      const record = { path: url.pathname, query: url.searchParams, headers: request.headers(), body: request.postData() ? request.postDataJSON() : null };
      requests.push(record);
      const respond = (data, status = 200) => route.fulfill({ contentType: 'application/json', status, body: JSON.stringify(data) });
      if (url.pathname === '/functions/v1/student-auth') {
        assert.equal(record.body.student_id, profileId);
        assert.equal(record.body.action, 'sign-in');
        assert.equal(record.body.password, 'Password12');
        return respond({ session });
      }
      if (url.pathname === '/auth/v1/password') {
        assert.equal(record.body.email, 'personal@example.test');
        return respond({ data: { session }, error: null });
      }
      if (url.pathname === '/auth/v1/adopt') return respond({ data: { session }, error: null });
      if (url.pathname === '/auth/v1/otp') return respond({ data: {}, error: null });
      if (url.pathname === '/auth/v1/verify') {
        assert.equal(record.body.email, 'personal@example.test');
        if (record.body.token === '999999') return respond({ message: 'Token has expired or is invalid' }, 400);
        return respond({ data: { session }, error: null });
      }
      if (url.pathname === '/rest/v1/users') {
        assert.equal(url.searchParams.get('id'), `eq.${session.user.id}`);
        assert.equal(url.searchParams.get('select'), 'student_id');
        assert.equal(record.headers.authorization, 'Bearer verified-test-access');
        return respond([{ student_id: profileId }]);
      }
      if (url.pathname.startsWith('/rest/v1/')) return respond([]);
      throw new Error('Unexpected backend path: ' + url.pathname);
    }
    if (url.origin === origin) return route.continue();
    return route.abort('blockedbyclient');
  });
  await page.goto(`${origin}/#/sign-in`);
  await page.getByRole('heading', { name: 'Welcome Back', exact: true }).waitFor();
  await page.locator('#login-overlay input[autocomplete="username"]').fill(identifier);
  await page.getByPlaceholder('Password', { exact: true }).fill('Password12');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await page.getByRole('heading', { name: 'Check your email', exact: true }).waitFor();
  assert.equal(requests.filter(r => r.path === '/auth/v1/otp').length, 1);
  assert.equal(requests.filter(r => r.path === '/auth/v1/otp')[0].body.email, 'personal@example.test');
  assert.equal(requests.filter(r => r.path === '/rest/v1/users').length, 0);
  assert.equal(await page.evaluate(async () => (await import('/js/auth.js')).isSignedIn()), false);
  return { context, page, requests, errors, profileId };
}

try {
  for (const [identifier, role] of [[' S260000101 ', 'client'], ['personal@example.test', 'client']]) {
    const test = await scenario(identifier, role);
    const code = test.page.getByRole('textbox', { name: 'Email verification code', exact: true });
    await code.fill('1234');
    await test.page.getByRole('button', { name: 'Verify & Sign In', exact: true }).click();
    await test.page.getByRole('alert').filter({ hasText: 'Enter the complete' }).waitFor();
    assert.equal(test.requests.filter(r => r.path === '/auth/v1/verify').length, 0);
    await code.fill('999999');
    await test.page.getByRole('button', { name: 'Verify & Sign In', exact: true }).click();
    await test.page.getByRole('alert').filter({ hasText: 'That code is incorrect or has expired.' }).waitFor();
    assert.equal(await test.page.getByRole('button', { name: 'Verify & Sign In', exact: true }).isEnabled(), true);
    await code.fill('12345678');
    await test.page.getByRole('button', { name: 'Verify & Sign In', exact: true }).click();
    await test.page.waitForFunction(() => document.body.dataset.session === 'active');
    await test.page.waitForFunction(async expected => (await import('/js/auth.js')).currentUser()?.student_id === expected, test.profileId);
    assert.equal(await test.page.evaluate(async () => (await import('/js/auth.js')).currentUser().role), role);
    await test.page.getByRole('heading', { name: 'Dashboard', exact: true }).waitFor();
    await test.page.reload();
    await test.page.waitForFunction(() => document.body.dataset.session === 'active');
    await test.page.waitForFunction(async expected => (await import('/js/auth.js')).currentUser()?.student_id === expected, test.profileId);
    assert.deepEqual(test.errors, []);
    await test.context.close();
  }
  console.log('Student login OK: student ID/email -> saved mailbox OTP -> dashboard, invalid OTP retry, private student ID hydration, and restored session. All backend requests intercepted.');
} finally {
  await browser.close();
}
