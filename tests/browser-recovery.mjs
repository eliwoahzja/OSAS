// Run against the local dev server; authentication SDK and API traffic are intercepted.
// PLAYWRIGHT_MODULE can point to a separately installed playwright/index.mjs.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.TEST_ORIGIN || 'http://localhost:3000';
const backend = 'https://unit-test.supabase.co';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
  headless: true,
  args: ['--no-sandbox'],
});

// Keep SDK behavior small and explicit while running the actual app, auth, and login modules.
// In particular, each createClient uses its configured storage and emits auth callbacks.
const sdk = `
  export function createClient(url, key, options = {}) {
    const storage = options.auth?.storage || localStorage;
    const storageKey = 'test.sdk.' + (options.auth?.storageKey || 'default');
    const read = () => JSON.parse(storage.getItem(storageKey) || 'null');
    const callbacks = [];
    const emit = (event, session) => callbacks.forEach((fn) => fn(event, session));
    const write = (session) => {
      if (session) storage.setItem(storageKey, JSON.stringify(session));
      else storage.removeItem(storageKey);
    };
    window.__sdkCalls ||= [];
    window.__sdkCalls.push({ method: 'createClient', storageKey, sessionStorage: storage === sessionStorage });
    const call = async (method, path, body) => {
      const response = await fetch(url + '/auth/v1/' + path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json();
      return response.ok ? result : { data: null, error: { message: result.message } };
    };
    return { auth: {
      onAuthStateChange(fn) {
        callbacks.push(fn);
        queueMicrotask(() => fn('INITIAL_SESSION', read()));
        return { data: { subscription: { unsubscribe() {} } } };
      },
      async getSession() { return { data: { session: read() }, error: null }; },
      async resetPasswordForEmail(email, options) { return call('POST', 'recover', { email, options }); },
      async signInWithOtp(options) { return call('POST', 'otp', options); },
      async setSession(tokens) {
        window.__sdkCalls.push({ method: 'setSession', storageKey });
        const result = await call('POST', 'token', tokens);
        if (!result.error) { write(result.data.session); emit('SIGNED_IN', result.data.session); }
        return result;
      },
      async updateUser(payload) {
        window.__sdkCalls.push({ method: 'updateUser', storageKey });
        const result = await call('PUT', 'user', payload);
        if (!result.error) emit('USER_UPDATED', read());
        return result;
      },
      async signOut(options) {
        window.__sdkCalls.push({ method: 'signOut', storageKey, options });
        const result = await call('POST', 'logout', { options });
        if (!result.error) { write(null); emit('SIGNED_OUT', null); }
        return result;
      },
    } };
  }
`;

async function scenario() {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const requests = [];
  const errors = [];
  const behavior = { recoverError: '', updateError: '', tokenError: '' };
  context.on('page', (page) => page.on('pageerror', (error) => errors.push(error.message)));
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === origin && url.pathname === '/js/config.js') {
      return route.fulfill({ contentType: 'text/javascript', body: `window.OSAS = { SUPABASE_URL: '${backend}', SUPABASE_ANON_KEY: 'test-key', PIN_ACCOUNTS: {} };` });
    }
    if (url.origin === 'https://cdn.jsdelivr.net' && url.pathname.startsWith('/npm/@supabase/supabase-js@')) {
      return route.fulfill({ contentType: 'text/javascript', body: sdk });
    }
    if (url.origin === backend) {
      const record = { method: request.method(), path: url.pathname, body: request.postData() ? request.postDataJSON() : null };
      requests.push(record);
      const fail = (message) => route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message }) });
      if (url.pathname === '/functions/v1/username-auth') {
        if (record.body.action === 'recover') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ message: 'Request sent.' }) });
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ session: {
          access_token: 'test-access', refresh_token: 'test-refresh', user: { email: 'student@example.test' },
        } }) });
      }
      if (url.pathname === '/auth/v1/otp') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: {}, error: null }) });
      if (url.pathname === '/auth/v1/recover') {
        if (behavior.recoverError) return fail(behavior.recoverError);
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: {}, error: null }) });
      }
      if (url.pathname === '/auth/v1/token') {
        if (behavior.tokenError) return fail(behavior.tokenError);
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { session: {
          access_token: 'test-recovery-access', refresh_token: 'test-recovery-refresh',
          user: { id: '11111111-1111-4111-8111-111111111111', email: 'student@example.test', app_metadata: { role: 'client' }, user_metadata: { name: 'Student One' } },
        } }, error: null }) });
      }
      if (url.pathname === '/auth/v1/user') {
        if (behavior.updateError) return fail(behavior.updateError);
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { user: {} }, error: null }) });
      }
      if (url.pathname === '/auth/v1/logout') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ error: null }) });
      // Record and contain any unexpected attempt to enter the dashboard.
      return route.fulfill({ contentType: 'application/json', body: '[]' });
    }
    if (url.origin === origin) return route.continue();
    return route.abort('blockedbyclient');
  });
  const page = await context.newPage();
  return { context, page, requests, errors, behavior };
}

const recoveryUrl = `${origin}/?recovery=1#access_token=test-recovery-access&refresh_token=test-recovery-refresh&type=recovery`;
const dashboardRequests = (requests) => requests.filter((r) => r.path.startsWith('/rest/'));

try {
  const email = await scenario();
  await email.page.goto(`${origin}/#/sign-in`);
  await email.page.getByRole('heading', { name: 'Welcome Back', exact: true }).waitFor();
  assert.equal(await email.page.getByText(/Contact admin|Create an account|Sign up/i).count(), 0);
  await email.page.locator('input[autocomplete="username"]').fill('Student@Example.Test');
  await email.page.getByRole('button', { name: 'Forgot password?', exact: true }).click();
  await email.page.getByRole('heading', { name: 'Forgot Password', exact: true }).waitFor();
  await email.page.getByRole('button', { name: 'Send Reset Link', exact: true }).click();
  await email.page.getByRole('status').filter({ hasText: 'If this account exists, a password reset link has been sent.' }).waitFor();
  const reset = email.requests.find((r) => r.path === '/auth/v1/recover');
  assert.equal(reset.method, 'POST');
  assert.equal(reset.body.email, 'student@example.test');
  assert.equal(reset.body.options.redirectTo, `${origin}/?recovery=1`);
  assert.equal(dashboardRequests(email.requests).length, 0);
  await email.page.locator('input[autocomplete="username"]').fill('other@example.test');
  email.behavior.recoverError = 'Email delivery is unavailable in this test.';
  await email.page.getByRole('button', { name: 'Send Reset Link', exact: true }).click();
  await email.page.getByRole('alert').filter({ hasText: email.behavior.recoverError }).waitFor();
  assert.equal(await email.page.getByRole('button', { name: 'Send Reset Link', exact: true }).isEnabled(), true);
  assert.deepEqual(email.errors, []);
  await email.context.close();

  const username = await scenario();
  await username.page.goto(`${origin}/#/sign-in`);
  await username.page.locator('input[autocomplete="username"]').fill('Student.Name');
  await username.page.locator('input[autocomplete="current-password"]').fill('Password12');
  await username.page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await username.page.getByRole('heading', { name: 'Check your email', exact: true }).waitFor();
  assert.equal(username.requests.find((r) => r.path === '/functions/v1/username-auth').body.username, 'student.name');
  assert.equal(username.requests.find((r) => r.path === '/auth/v1/otp').body.email, 'student@example.test');
  assert.equal(await username.page.evaluate(async () => (await import('/js/auth.js')).isSignedIn()), false);
  assert.equal(dashboardRequests(username.requests).length, 0);
  assert.deepEqual(username.errors, []);
  await username.context.close();

  const usernameReset = await scenario();
  await usernameReset.page.goto(`${origin}/#/sign-in`);
  await usernameReset.page.locator('input[autocomplete="username"]').fill('Student.Name');
  await usernameReset.page.getByRole('button', { name: 'Forgot password?', exact: true }).click();
  await usernameReset.page.getByRole('button', { name: 'Send Reset Link', exact: true }).click();
  await usernameReset.page.getByRole('status').filter({ hasText: 'If this account exists' }).waitFor();
  const usernameRecovery = usernameReset.requests.find((r) => r.path === '/functions/v1/username-auth');
  assert.equal(usernameRecovery.body.action, 'recover');
  assert.equal(usernameRecovery.body.username, 'student.name');
  assert.equal(usernameRecovery.body.redirectTo, `${origin}/?recovery=1`);
  assert.equal(usernameReset.requests.some((r) => r.path === '/auth/v1/recover'), false, 'The browser must not guess a school mailbox');
  assert.deepEqual(usernameReset.errors, []);
  await usernameReset.context.close();

  const recovery = await scenario();
  await recovery.page.goto(recoveryUrl);
  await recovery.page.getByRole('heading', { name: 'Choose a New Password', exact: true }).waitFor();
  assert.equal(new URL(recovery.page.url()).hash, '');
  assert.equal(dashboardRequests(recovery.requests).length, 0);
  assert.equal(await recovery.page.evaluate(async () => (await import('/js/auth.js')).isSignedIn()), false);
  assert.equal(await recovery.page.evaluate(async () => (await import('/js/auth.js')).currentAccessToken()), null);
  await recovery.page.reload();
  await recovery.page.getByRole('heading', { name: 'Choose a New Password', exact: true }).waitFor();
  assert.equal(recovery.requests.filter((r) => r.path === '/auth/v1/token').length, 1, 'Refresh restores the tab recovery session without reusing URL tokens');

  // A separate tab sharing localStorage must not inherit a recovery login session.
  const anotherTab = await recovery.context.newPage();
  await anotherTab.goto(`${origin}/#/sign-in`);
  await anotherTab.getByRole('heading', { name: 'Welcome Back', exact: true }).waitFor();
  assert.equal(await anotherTab.evaluate(async () => (await import('/js/auth.js')).isSignedIn()), false);
  await anotherTab.close();
  assert.equal(dashboardRequests(recovery.requests).length, 0);

  await recovery.page.getByPlaceholder('New password', { exact: true }).fill('NewSecret42');
  await recovery.page.getByPlaceholder('Re-enter password', { exact: true }).fill('Mismatch42');
  await recovery.page.getByRole('button', { name: 'Save New Password', exact: true }).click();
  await recovery.page.getByRole('alert').filter({ hasText: 'The two passwords do not match.' }).waitFor();
  assert.equal(recovery.requests.filter((r) => r.path === '/auth/v1/user').length, 0);
  await recovery.page.getByPlaceholder('Re-enter password', { exact: true }).fill('NewSecret42');
  recovery.behavior.updateError = 'Cannot update the password in this test.';
  await recovery.page.getByRole('button', { name: 'Save New Password', exact: true }).click();
  await recovery.page.getByRole('alert').filter({ hasText: recovery.behavior.updateError }).waitFor();
  assert.equal(await recovery.page.getByRole('button', { name: 'Save New Password', exact: true }).isEnabled(), true);
  recovery.behavior.updateError = '';
  await recovery.page.getByRole('button', { name: 'Save New Password', exact: true }).click();
  await recovery.page.getByRole('heading', { name: 'Welcome Back', exact: true }).waitFor();
  await recovery.page.getByRole('status').filter({ hasText: 'Password updated. Sign in with your new password to continue.' }).waitFor();
  const update = recovery.requests.find((r) => r.path === '/auth/v1/user');
  assert.equal(update.method, 'PUT');
  assert.deepEqual(update.body, { password: 'NewSecret42' });
  const calls = await recovery.page.evaluate(() => window.__sdkCalls);
  const lastUpdate = calls.findLastIndex((call) => call.method === 'updateUser');
  assert.equal(calls[lastUpdate + 1].method, 'signOut');
  assert.equal(await recovery.page.evaluate(async () => (await import('/js/auth.js')).isSignedIn()), false);
  assert.equal(await recovery.page.evaluate(() => sessionStorage.getItem('osas.password.recovery')), null);
  assert.equal(new URL(recovery.page.url()).search, '');
  assert.equal(dashboardRequests(recovery.requests).length, 0);
  assert.deepEqual(recovery.errors, []);
  await recovery.context.close();

  const expired = await scenario();
  await expired.page.goto(`${origin}/?recovery=1#error=access_denied&error_code=otp_expired&error_description=Link+expired`);
  await expired.page.getByRole('heading', { name: 'Forgot Password', exact: true }).waitFor();
  await expired.page.getByRole('alert').filter({ hasText: 'That password reset link is invalid or has expired. Request a new one.' }).waitFor();
  assert.equal(await expired.page.getByRole('button', { name: 'Send Reset Link', exact: true }).isVisible(), true);
  assert.equal(new URL(expired.page.url()).hash, '');
  assert.equal(dashboardRequests(expired.requests).length, 0);
  assert.deepEqual(expired.errors, []);
  await expired.context.close();

  console.log('Browser recovery OK: assigned-account login, reset email/redirect, neutral success, delivery error, callback isolation, reload, cross-tab isolation, mismatch/update error, password save/sign-out/login, expired-link recovery. All backend traffic intercepted.');
} finally {
  await browser.close();
}
