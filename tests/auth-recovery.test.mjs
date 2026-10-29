import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm';

const source = await readFile(new URL('../js/auth.js', import.meta.url), 'utf8');
const recovered = {
  user: { id: 'student-1', email: 'student@saac.ph', app_metadata: {}, user_metadata: { name: 'Student One' } },
  access_token: 'recovery-access', refresh_token: 'recovery-refresh',
};

async function loadAuth({ url = 'https://school.example/', stored = null, marker = null, failure = null, shared = { session: stored } } = {}) {
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
      session = recovered;
      if (!recoveryClient) shared.session = session;
      onChange('SIGNED_IN', session);
      return { data: { session }, error: null };
    },
    async signInWithOtp(options) {
      records.push(['signInWithOtp', options]);
      return { error: null };
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
      assert.equal(url, 'https://project.example/functions/v1/username-auth');
      const payload = JSON.parse(options.body);
      records.push(['usernameAuth', payload]);
      return {
        ok: failure !== 'username',
        json: async () => failure === 'username' ? { error: 'Incorrect username or password.' }
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

test('saved username sends the OTP to the actual account email and still requires verification', async () => {
  const { auth, records } = await loadAuth();
  const next = await auth.signIn('  Student.Name  ', 'Password12');
  assert.equal(next.step, 'otp');
  assert.equal(next.email, 'student@saac.ph');
  const lookup = records.find(([method]) => method === 'usernameAuth');
  assert.equal(lookup[1].username, 'student.name');
  assert.equal(lookup[1].action, 'sign-in');
  assert.equal(records.find(([method]) => method === 'signInWithOtp')[1].email, 'student@saac.ph');
  assert.equal(auth.isSignedIn(), false);
  await auth.verifyCode(next.email, '123456');
  assert.equal(auth.isSignedIn(), true);
});

test('bad username credentials cannot set a session or send OTPs', async () => {
  const { auth, records } = await loadAuth({ failure: 'username' });
  await assert.rejects(auth.signIn('student.name', 'WrongPassword12'), /Incorrect username or password/);
  assert.equal(auth.isSignedIn(), false);
  assert.equal(records.some(([method]) => ['setSession', 'signInWithOtp'].includes(method)), false);
});

test('username recovery does not guess an email or reveal an address in the browser', async () => {
  const { auth, records } = await loadAuth();
  await auth.requestPasswordReset('  Student.Name  ');
  assert.equal(records.length, 1);
  assert.equal(records[0][0], 'usernameAuth');
  assert.equal(records[0][1].action, 'recover');
  assert.equal(records[0][1].username, 'student.name');
  assert.equal(records[0][1].redirectTo, 'https://school.example/?recovery=1');
  assert.equal(auth.isSignedIn(), false);
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
