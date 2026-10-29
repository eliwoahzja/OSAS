import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm';

const source = await readFile(new URL('../js/auth.js', import.meta.url), 'utf8');
const recovered = {
  user: { id: 'student-1', email: 'student@saac.ph', app_metadata: {}, user_metadata: { name: 'Student One' } },
  access_token: 'recovery-access', refresh_token: 'recovery-refresh',
};

async function loadAuth({ url = 'https://school.example/', stored = null, marker = null, failure = null, profileId = 's260000001', shared = { session: stored } } = {}) {
  const records = [];
  const storage = new Map(marker ? [['osas.password.recovery', marker]] : []);
  const location = new URL(url);
  function makeSdk(recoveryClient) {
    let session = recoveryClient ? (marker ? stored : null) : shared.session;
    let onChange = () => {};
    return {
    onAuthStateChange(fn) { onChange = fn; fn('INITIAL_SESSION', session); },
    async getSession() { return { data: { session }, error: null }; },
    async setSession(tokens) {
      records.push(['setSession', tokens]);
      if (failure === 'expired') return { data: { session: null }, error: new Error('expired') };
      session = recovered;
      if (!recoveryClient) shared.session = session;
      onChange('SIGNED_IN', session);
      return { data: { session }, error: null };
    },
    async resetPasswordForEmail(email, options) {
      records.push(['resetPasswordForEmail', email, options]);
      return { error: failure === 'send' ? new Error('Email rate limit exceeded') : null };
    },
    async updateUser(attributes) {
      records.push(['updateUser', attributes]);
      onChange('USER_UPDATED', session);
      return { error: failure === 'password' ? new Error('New password should be different') : null };
    },
    async signOut(options) {
      records.push(['signOut', options]);
      session = null;
      if (!recoveryClient) shared.session = null;
      onChange('SIGNED_OUT', null);
      return { error: null };
    },
    async signInWithPassword(credentials) {
      records.push(['signInWithPassword', credentials]);
      if (failure === 'provider-disabled') return { error: { code: 'email_provider_disabled', status: 422, message: 'Email logins are disabled' } };
      session = recovered;
      if (!recoveryClient) shared.session = session;
      onChange('SIGNED_IN', session);
      return { data: { session }, error: null };
    },
    async signInWithOtp(options) {
      records.push(['signInWithOtp', options]);
      return { error: failure === 'otp-send' ? new Error('Unable to send email for this account') : null };
    },
    async verifyOtp(options) {
      records.push(['verifyOtp', options]);
      session = recovered;
      if (!recoveryClient) shared.session = session;
      onChange('SIGNED_IN', session);
      return { data: { session }, error: null };
    },
    };
  }
  const sessionStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  };
  const context = createContext({
    URL, URLSearchParams, TextEncoder,
    fetch: async (url, options) => {
      if (new URL(url).pathname === '/rest/v1/users') {
        records.push(['profile', url, options]);
        return { ok: failure !== 'profile', json: async () => [{ student_id: profileId }] };
      }
      assert.equal(url, 'https://project.example/functions/v1/student-auth');
      const payload = JSON.parse(options.body);
      records.push(['studentAuth', payload]);
      return {
        ok: !['student-id', 'student-endpoint', 'student-service', 'provider-disabled', 'student-rate'].includes(failure),
        status: ['student-service', 'provider-disabled'].includes(failure) ? 503 : failure === 'student-rate' ? 429 : failure === 'student-endpoint' ? 404 : failure === 'student-id' ? 400 : 200,
        json: async () => failure === 'student-id' ? { error: 'Incorrect student ID or password.' }
          : failure === 'provider-disabled' ? { error: 'Provider setup needed', code: 'email_provider_disabled' }
          : failure === 'student-rate' ? { error: 'Too many requests. Please wait before trying again.', code: 'rate_limited' }
          : failure === 'student-endpoint' ? { message: 'Function not found' }
          : failure === 'malformed' ? {}
          : payload.action === 'sign-in' ? { session: recovered } : { message: 'Request sent.' },
      };
    },
    sessionStorage,
    setTimeout: (fn, delay) => { const timer = setTimeout(fn, delay); timer.unref(); return timer; },
    window: {
      OSAS: { SUPABASE_URL: 'https://project.example', SUPABASE_ANON_KEY: 'public-key' },
      location, sessionStorage,
      history: { replaceState(_state, _title, next) { location.href = new URL(next, location).href; } },
    },
  });
  const supabase = new SyntheticModule(['createClient'], function () {
    this.setExport('createClient', (_url, _key, options) => {
      const recoveryClient = options.auth.storageKey === 'osas.password.recovery.session';
      if (recoveryClient) {
        assert.equal(options.auth.storage, sessionStorage);
        assert.equal(options.auth.persistSession, true);
      }
      return { auth: makeSdk(recoveryClient) };
    });
  }, { context });
  await supabase.link(() => {});
  await supabase.evaluate();
  const module = new SourceTextModule(source, { context, importModuleDynamically: () => supabase });
  await module.link(() => {});
  await module.evaluate();
  return { auth: module.namespace, records, location, storage, shared };
}

const recoveryUrl = 'https://school.example/?recovery=1#access_token=recovery-access&refresh_token=recovery-refresh&type=recovery';

test('reset email uses the registered email and a same-origin recovery redirect', async () => {
  const { auth, records } = await loadAuth();
  await auth.requestPasswordReset('  Student@SAAC.ph  ');
  assert.equal(records[0][0], 'resetPasswordForEmail');
  assert.equal(records[0][1], 'student@saac.ph');
  assert.equal(records[0][2].redirectTo, 'https://school.example/?recovery=1');
  assert.equal(auth.isSignedIn(), false);
});

test('recovery callback removes tokens and cannot enter the dashboard', async () => {
  const { auth, location, storage } = await loadAuth({ url: recoveryUrl });
  await auth.restore();
  assert.equal(location.href, 'https://school.example/?recovery=1');
  assert.equal(auth.passwordRecovery().active, true);
  assert.equal(auth.passwordRecovery().email, 'student@saac.ph');
  assert.equal(auth.isSignedIn(), false);
  assert.equal(await auth.currentAccessToken(), null);
  assert.equal(storage.get('osas.password.recovery'), 'student-1');
});

test('a refreshed recovery session stays in recovery even without the URL marker', async () => {
  const { auth } = await loadAuth({ stored: recovered, marker: 'student-1' });
  await auth.restore();
  assert.equal(auth.passwordRecovery().active, true);
  assert.equal(auth.isSignedIn(), false);
});

test('a normal stored session cannot be used as a password recovery link', async () => {
  const { auth, records } = await loadAuth({ url: 'https://school.example/?recovery=1', stored: recovered });
  await auth.restore();
  assert.equal(auth.passwordRecovery().active, false);
  assert.match(auth.passwordRecovery().error, /reset link from your email/);
  assert.equal(auth.isSignedIn(), false);
  await assert.rejects(auth.updateRecoveredPassword('NewPassword12'), /valid password reset link/);
  assert.equal(records.some(([method]) => method === 'updateUser'), false);
});

test('expired links offer recovery again and never authenticate the app', async () => {
  const { auth, location } = await loadAuth({ url: recoveryUrl, failure: 'expired' });
  await auth.restore();
  assert.equal(auth.passwordRecovery().active, false);
  assert.match(auth.passwordRecovery().error, /invalid or has expired/);
  assert.equal(auth.isSignedIn(), false);
  assert.equal(location.hash, '');
});

test('saving a recovered password ends the temporary session and requires sign-in', async () => {
  const { auth, records, location, storage } = await loadAuth({ url: recoveryUrl });
  await auth.restore();
  await auth.updateRecoveredPassword('NewPassword12');
  assert.equal(records.at(-2)[0], 'updateUser');
  assert.equal(records.at(-2)[1].password, 'NewPassword12');
  assert.equal(records.at(-1)[0], 'signOut');
  assert.equal(records.at(-1)[1].scope, 'local');
  assert.equal(auth.passwordRecovery().active, false);
  assert.equal(auth.isSignedIn(), false);
  assert.equal(storage.has('osas.password.recovery'), false);
  assert.equal(location.href, 'https://school.example/');
});

test('password update errors keep the recovery form available for retry', async () => {
  const { auth } = await loadAuth({ url: recoveryUrl, failure: 'password' });
  await auth.restore();
  await assert.rejects(auth.updateRecoveredPassword('OldPassword12'), /should be different/);
  assert.equal(auth.passwordRecovery().active, true);
  assert.equal(auth.isSignedIn(), false);
});

test('normal password sign-in still requires a separate email verification code', async () => {
  const { auth, records } = await loadAuth();
  const next = await auth.signIn('student@saac.ph', 'Password12');
  assert.equal(next.step, 'otp');
  assert.equal(auth.isSignedIn(), false);
  const otp = records.find(([method]) => method === 'signInWithOtp');
  assert.equal(otp[1].options.shouldCreateUser, false);
  await auth.verifyCode('student@saac.ph', '123456');
  assert.equal(auth.isSignedIn(), true);
});

test('student ID sends the OTP to the actual account email and still requires verification', async () => {
  const { auth, records } = await loadAuth();
  const next = await auth.signIn('  S260000001  ', 'Password12');
  assert.equal(next.step, 'otp');
  assert.equal(next.email, 'student@saac.ph');
  const lookup = records.find(([method]) => method === 'studentAuth');
  assert.equal(lookup[1].student_id, 's260000001');
  assert.equal(lookup[1].action, 'sign-in');
  assert.equal(records.find(([method]) => method === 'signInWithOtp')[1].email, 'student@saac.ph');
  assert.equal(auth.isSignedIn(), false);
  assert.equal(records.some(([method]) => method === 'profile'), false);
  await auth.verifyCode(next.email, '123456');
  assert.equal(auth.isSignedIn(), true);
});

test('authenticated sessions load only their own private student ID', async () => {
  const { auth, records } = await loadAuth();
  await auth.signIn('s260000001', 'Password12');
  await auth.verifyCode('student@saac.ph', '123456');
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(auth.currentUser().student_id, 's260000001');
  const [, address, options] = records.find(([method]) => method === 'profile');
  const url = new URL(address);
  assert.equal(url.searchParams.get('id'), 'eq.student-1');
  assert.equal(url.searchParams.get('select'), 'student_id');
  assert.equal(options.headers.Authorization, 'Bearer recovery-access');
});

test('restoring a session loads its student ID, while profile failures do not block sign-in', async () => {
  const restored = await loadAuth({ stored: recovered });
  await restored.auth.restore();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(restored.auth.currentUser().student_id, 's260000001');
  const missing = await loadAuth({ stored: recovered, failure: 'profile' });
  await missing.auth.restore();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(missing.auth.isSignedIn(), true);
  assert.equal(missing.auth.currentUser().student_id, null);
});

test('unavailable or malformed student services offer email sign-in without exposing internals', async () => {
  for (const failure of ['student-endpoint', 'student-service', 'malformed']) {
    const { auth } = await loadAuth({ failure });
    await assert.rejects(auth.signIn('s260000001', 'Password12'), /temporarily unavailable.*account email/);
    assert.equal(auth.isSignedIn(), false);
  }
});

test('email delivery errors retain the provider message instead of becoming undefined', async () => {
  const { auth } = await loadAuth({ failure: 'otp-send' });
  await assert.rejects(auth.signIn('student@saac.ph', 'Password12'), /Unable to send email for this account/);
  assert.equal(auth.isSignedIn(), false);
});

test('disabled email sign-in shows the same actionable setup error for ID and email login', async () => {
  for (const identifier of ['s260000001', 'student@saac.ph']) {
    const { auth, records } = await loadAuth({ failure: 'provider-disabled' });
    await assert.rejects(auth.signIn(identifier, 'Password12'), (error) => {
      assert.match(error.message, /administrator must enable email sign-in/);
      assert.doesNotMatch(error.message, /Incorrect|account email instead/);
      return true;
    });
    assert.equal(auth.isSignedIn(), false);
    assert.equal(records.some(([method]) => ['setSession', 'signInWithOtp'].includes(method)), false);
  }
});

test('student ID throttling keeps the retry instruction and never starts an OTP session', async () => {
  const { auth, records } = await loadAuth({ failure: 'student-rate' });
  await assert.rejects(auth.signIn('s260000001', 'Password12'), /Please wait before trying again/);
  assert.equal(auth.isSignedIn(), false);
  assert.equal(records.some(([method]) => ['setSession', 'signInWithOtp'].includes(method)), false);
});

test('bad student ID credentials cannot set a session or send OTPs', async () => {
  const { auth, records } = await loadAuth({ failure: 'student-id' });
  await assert.rejects(auth.signIn('s260000001', 'WrongPassword12'), /Incorrect student ID or password/);
  assert.equal(auth.isSignedIn(), false);
  assert.equal(records.some(([method]) => ['setSession', 'signInWithOtp'].includes(method)), false);
});

test('student ID recovery does not guess an email or reveal an address in the browser', async () => {
  const { auth, records } = await loadAuth();
  await auth.requestPasswordReset('  S260000001  ');
  assert.equal(records.length, 1);
  assert.equal(records[0][0], 'studentAuth');
  assert.equal(records[0][1].action, 'recover');
  assert.equal(records[0][1].student_id, 's260000001');
  assert.equal(records[0][1].redirectTo, 'https://school.example/?recovery=1');
  assert.equal(auth.isSignedIn(), false);
});

test('legacy usernames are rejected instead of silently guessing a mailbox', async () => {
  const { auth, records } = await loadAuth();
  await assert.rejects(auth.signIn('j.reyes', 'Password12'), /student ID.*not a username/);
  assert.equal(records.length, 0);
});


test('opening another tab cannot restore recovery tokens as a normal sign-in', async () => {
  const shared = { session: null };
  const recoveryTab = await loadAuth({ url: recoveryUrl, shared });
  await recoveryTab.auth.restore();
  assert.equal(recoveryTab.auth.passwordRecovery().active, true);
  assert.equal(shared.session, null);
  const newTab = await loadAuth({ shared });
  await newTab.auth.restore();
  assert.equal(newTab.auth.isSignedIn(), false);
  assert.equal(newTab.auth.passwordRecovery().active, false);
});

test('cancelling recovery clears the temporary session without completing sign-in', async () => {
  const { auth, storage, location } = await loadAuth({ url: recoveryUrl });
  await auth.restore();
  await auth.cancelPasswordRecovery();
  assert.equal(auth.isSignedIn(), false);
  assert.equal(auth.passwordRecovery().active, false);
  assert.equal(storage.has('osas.password.recovery'), false);
  assert.equal(location.href, 'https://school.example/');
});
