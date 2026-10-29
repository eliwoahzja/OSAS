import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdminPinHandler, hasPasswordAuthentication } from '../supabase/functions/admin-pin/core.ts';

function setup({ user = { id: 'admin-one', app_metadata: { role: 'admin' }, password_verified: true }, result = { ok: true }, fail = false } = {}) {
  const calls = [];
  const handler = createAdminPinHandler({
    async actor(jwt) { calls.push(['actor', jwt]); return user; },
    async pinAction(...args) { calls.push(['pinAction', ...args]); if (fail) throw new Error('secret database failure'); return result; },
  });
  const call = async (body, { authorization = 'Bearer verified-admin', method = 'POST' } = {}) => {
    const req = new Request('https://project.example/functions/v1/admin-pin', {
      method, headers: authorization ? { Authorization: authorization } : {},
      ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
    });
    const response = await handler(req);
    return { status: response.status, data: await response.json(), headers: response.headers };
  };
  return { calls, call };
}

test('PIN actions require a validated administrator bearer and ignore editable role claims', async () => {
  const missing = setup();
  assert.equal((await missing.call({ action: 'status' }, { authorization: '' })).status, 401);
  assert.equal(missing.calls.length, 0);
  assert.equal((await setup({ user: null }).call({ action: 'status' })).status, 401);
  const student = setup({ user: { id: 'student', app_metadata: { role: 'client' }, user_metadata: { role: 'admin' }, password_verified: true } });
  assert.equal((await student.call({ action: 'setup', pin: '1234' })).status, 403);
  assert.equal(student.calls.some(([name]) => name === 'pinAction'), false);
});

test('status returns only whether a PIN exists, never hashes or attempt state', async () => {
  const s = setup({ result: { has_pin: true, pin_hash: 'private-hash', failed_attempts: 3 } });
  const r = await s.call({ action: 'status', user_id: 'someone-else' });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data, { has_pin: true });
  assert.deepEqual(s.calls.at(-1), ['pinAction', 'admin-one', 'status', null]);
  assert.equal(r.headers.get('cache-control'), 'no-store');
});

test('first setup and verification use the validated account and require four digits', async () => {
  for (const action of ['setup', 'verify']) {
    const s = setup();
    const r = await s.call({ action, pin: '0123', user_id: 'other-admin' });
    assert.equal(r.status, 200);
    assert.deepEqual(r.data, { ok: true });
    assert.deepEqual(s.calls.at(-1), ['pinAction', 'admin-one', action, '0123']);
  }
  for (const pin of ['', '123', '12345', 'abcd', 1234, null]) {
    const s = setup();
    assert.equal((await s.call({ action: 'verify', pin })).status, 400);
    assert.equal(s.calls.some(([name]) => name === 'pinAction'), false);
  }
});

test('OTP or recovery sessions cannot set or verify an administrator PIN', async () => {
  const s = setup({ user: { id: 'admin-one', app_metadata: { role: 'admin' }, password_verified: false } });
  for (const action of ['setup', 'verify']) {
    const r = await s.call({ action, pin: '1234' });
    assert.equal(r.status, 401);
    assert.equal(r.data.code, 'password_required');
  }
  assert.equal(s.calls.some(([name]) => name === 'pinAction'), false);
});

test('PIN failures distinguish setup, wrong PIN, and persistent lockout', async () => {
  for (const [code, status] of [['already_configured', 409], ['pin_not_set', 409], ['incorrect_pin', 400], ['admin_only', 403]]) {
    const r = await setup({ result: { code } }).call({ action: 'verify', pin: '1234' });
    assert.equal(r.status, status);
    assert.equal(r.data.code, code);
  }
  const r = await setup({ result: { code: 'locked', retry_after: 887 } }).call({ action: 'verify', pin: '1234' });
  assert.equal(r.status, 429);
  assert.equal(r.data.retry_after, 887);
  assert.equal(r.headers.get('retry-after'), '887');
  assert.doesNotMatch(JSON.stringify(r.data), /hash|database/);
});

test('invalid requests and service failures never reveal private backend details', async () => {
  for (const body of [null, [], {}, { action: 'reset' }]) {
    assert.equal((await setup().call(body)).status, 400);
  }
  assert.equal((await setup().call(null, { method: 'GET' })).status, 405);
  const failed = await setup({ fail: true }).call({ action: 'verify', pin: '1234' });
  assert.equal(failed.status, 503);
  assert.doesNotMatch(JSON.stringify(failed.data), /secret|database/);
});

test('password AMR helper accepts password authentication and rejects OTP or malformed claims', () => {
  const jwt = (amr) => `header.${Buffer.from(JSON.stringify({ amr })).toString('base64url')}.signature`;
  assert.equal(hasPasswordAuthentication(jwt([{ method: 'password' }])), true);
  assert.equal(hasPasswordAuthentication(jwt([{ method: 'otp' }])), false);
  assert.equal(hasPasswordAuthentication(jwt([])), false);
  assert.equal(hasPasswordAuthentication('invalid'), false);
});
