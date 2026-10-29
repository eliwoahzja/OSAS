import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudentAuthHandler } from '../supabase/functions/student-auth/core.ts';

const session = { access_token: 'access', refresh_token: 'refresh', user: { id: 'student', email: 'student@gmail.com' } };
function setup({ exists = true, badPassword = false, unavailable = false, wrongAccount = false } = {}) {
  const calls = [];
  const handler = createStudentAuthHandler({
    async lookup(studentId) {
      calls.push(['lookup', studentId]);
      if (unavailable) throw new Error('Database failure');
      return exists ? { id: wrongAccount ? 'another-student' : session.user.id, email: session.user.email } : null;
    },
    async signIn(email, password) {
      calls.push(['signIn', email, password]);
      return badPassword || !exists ? { error: { message: 'Invalid login credentials' } } : { data: { session } };
    },
    async recover(email, redirectTo) { calls.push(['recover', email, redirectTo]); return {}; },
  });
  const call = async (body, method = 'POST') => {
    const res = await handler(new Request('https://project.example/functions/v1/student-auth', {
      method, ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
    }));
    return { status: res.status, data: await res.json(), headers: res.headers };
  };
  return { calls, call };
}

test('generated student ID authenticates against its saved mailbox', async () => {
  const s = setup();
  const response = await s.call({ action: 'sign-in', student_id: '  S260000001  ', password: 'Password12' });
  assert.equal(response.status, 200);
  assert.deepEqual(s.calls, [['lookup', 's260000001'], ['signIn', 'student@gmail.com', 'Password12']]);
  assert.deepEqual(response.data.session, session);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('unknown student IDs and bad passwords have identical errors without leaking email', async () => {
  const unknown = setup({ exists: false });
  const wrong = setup({ badPassword: true });
  const body = { action: 'sign-in', student_id: 's260000001', password: 'WrongPassword12' };
  const a = await unknown.call(body);
  const b = await wrong.call(body);
  assert.equal(a.status, 400);
  assert.equal(b.status, 400);
  assert.deepEqual(a.data, b.data);
  assert.equal(unknown.calls.some(([method]) => method === 'signIn'), true);
  assert.doesNotMatch(JSON.stringify(b.data), /gmail|refresh|access/);
});

test('student ID reset uses the saved mailbox and a neutral public response', async () => {
  const known = setup();
  const unknown = setup({ exists: false });
  const body = { action: 'recover', student_id: 's260000001', redirectTo: 'https://school.example/?recovery=1' };
  const a = await known.call(body);
  const b = await unknown.call(body);
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  assert.deepEqual(a.data, b.data);
  assert.deepEqual(known.calls.at(-1), ['recover', 'student@gmail.com', body.redirectTo]);
  assert.doesNotMatch(JSON.stringify(a.data), /gmail|student/);
});

test('student endpoint rejects usernames, malformed IDs, and public email lookup', async () => {
  const s = setup();
  for (const body of [null, [], { action: 'lookup', student_id: 's260000001' }, { action: 'sign-in', student_id: 'j.reyes', password: 'Password12' }, { action: 'sign-in', username: 'student', password: 'Password12' }, { action: 'sign-in', student_id: 's260000001', password: '' }, { action: 'recover', student_id: 's260000001', redirectTo: 'javascript:alert(1)' }]) {
    assert.equal((await s.call(body)).status, 400);
  }
  assert.equal((await s.call(null, 'GET')).status, 405);
  assert.equal(s.calls.length, 0);
  const unavailable = setup({ unavailable: true });
  assert.equal((await unavailable.call({ action: 'sign-in', student_id: 's260000001', password: 'Password12' })).status, 503);
});

test('a stale profile cannot authenticate a different account', async () => {
  const s = setup({ wrongAccount: true });
  const result = await s.call({ action: 'sign-in', student_id: 's260000001', password: 'Password12' });
  assert.equal(result.status, 400);
  assert.equal(result.data.session, undefined);
});
