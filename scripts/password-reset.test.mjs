import test from 'node:test';
import assert from 'node:assert/strict';
import { createResetHandler, digest, REQUEST_MESSAGE } from '../supabase/functions/password-reset/core.ts';

const id = '11111111-1111-4111-8111-111111111111';
const timestamp = Date.parse('2026-10-28T10:00:00Z');
function setup(appUrl = 'https://school.example/') {
  const row = { id, user_id: 'owner', name: '<Student>', email: 'student@example.test', role: 'client', status: 'pending', requested_at: new Date(timestamp).toISOString(), account_created_at: '2026-01-01T00:00:00Z' };
  const sent = []; const writes = []; let now = timestamp; let failMail = false; let failPassword = false;
  const store = {
    async submit(email) { return email === row.email && !this.submitted ? (this.submitted = true, id) : null; },
    async get() { return { ...row }; },
    async list() { const { token_hash, ...visible } = row; return [visible]; },
    async actor(jwt) { return jwt === 'admin' ? { id: 'admin', app_metadata: { role: 'admin' } } : jwt === 'student' ? { id: 'owner', app_metadata: { role: 'client' }, user_metadata: { role: 'admin' } } : null; },
    async emailExists() { return false; },
    async createAccount(record, password) { writes.push({ user: 'new-student', password }); return { id: 'new-student' }; },
    async account() { return { id: 'owner', email: row.email }; },
    async adminEmails() { return ['admin@example.test', 'other-admin@example.test']; },
    async patch(key, patch, status) { assert.equal(key, id); if (status) assert.equal(row.status, status); Object.assign(row, patch); },
    async claim(key, states, patch, match) {
      if (key !== id || !states.includes(row.status) || (match && (match.token_hash !== row.token_hash || row.expires_at <= match.expires_after))) return null;
      Object.assign(row, patch); return { ...row };
    },
    async updatePassword(user, password) { if (failPassword) throw new Error('Password does not meet the account policy.'); writes.push({ user, password }); },
  };
  const handler = createResetHandler({ store, appUrl: appUrl ?? undefined, now: () => now, sendMail: async (...args) => { if (failMail) throw new Error('Provider failed'); sent.push(args); } });
  const call = async (body, jwt = '') => {
    if (body.action === 'request' && body.name === undefined) body = { ...body, name: 'Sample Requester' };
    const res = await handler(new Request('https://functions.example/password-reset', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: jwt ? `Bearer ${jwt}` : '' }, body: JSON.stringify(body) }));
    return { status: res.status, data: await res.json() };
  };
  const approvedToken = () => /token=([a-f0-9]{64})/.exec(sent.at(-1)[2])[1];
  return { row, sent, writes, call, approvedToken, setNow(v) { now = v; }, failMail(v) { failMail = v; }, failPassword(v) { failPassword = v; } };
}

test('requests email administrators with escaped account details and uniform public responses', async () => {
  const s = setup();
  for (const email of ['student@example.test', 'unknown@example.test', 'student@example.test']) {
    const r = await s.call({ action: 'request', email });
    assert.equal(r.status, 200); assert.equal(r.data.message, REQUEST_MESSAGE);
  }
  assert.equal(s.sent.length, 1);
  assert.deepEqual(s.sent[0][0], ['admin@example.test', 'other-admin@example.test']);
  assert.match(s.sent[0][2], /&lt;Student&gt;/); assert.match(s.sent[0][2], /student@example.test/);
  assert.match(s.sent[0][2], /#\/accounts/); assert.equal(s.writes.length, 0);
});
test('admin endpoints reject anonymous users and user-editable administrator metadata', async () => {
  const s = setup();
  for (const action of ['list', 'approve', 'reject']) {
    assert.equal((await s.call({ action, id })).status, 401);
    assert.equal((await s.call({ action, id }, 'student')).status, 403);
  }
  assert.equal(s.sent.length, 0); assert.equal(s.row.status, 'pending');
});
test('approval emails only the saved address, stores a hash, and leaves the password unchanged', async () => {
  const s = setup();
  const approved = await s.call({ action: 'approve', id, email: 'attacker@example.test' }, 'admin');
  assert.equal(approved.status, 200); assert.equal(s.row.status, 'approved');
  assert.deepEqual(s.sent[0][0], ['student@example.test']);
  assert.equal(s.row.token_hash, await digest(s.approvedToken()));
  assert.equal(s.row.expires_at, new Date(timestamp + 30 * 60000).toISOString());
  assert.equal(s.writes.length, 0);
  assert.doesNotMatch(JSON.stringify((await s.call({ action: 'list' }, 'admin')).data), /token_hash|token=/);
  assert.equal((await s.call({ action: 'approve', id }, 'admin')).status, 409);
});
test('completion requires approval, a matching token, and a strong enough password', async () => {
  const s = setup();
  const validShape = 'a'.repeat(64);
  assert.equal((await s.call({ action: 'complete', id, token: validShape, password: 'ValidPass123!' })).status, 400);
  await s.call({ action: 'approve', id }, 'admin');
  assert.equal((await s.call({ action: 'complete', id, token: validShape, password: 'ValidPass123!' })).status, 400);
  assert.equal((await s.call({ action: 'complete', id, token: s.approvedToken(), password: 'short' })).status, 400);
  assert.equal(s.writes.length, 0);
});
test('a reset token works once, including concurrent completion attempts', async () => {
  const s = setup(); await s.call({ action: 'approve', id }, 'admin');
  const body = { action: 'complete', id, token: s.approvedToken(), password: 'ValidPass123!' };
  const results = await Promise.all([s.call(body), s.call(body)]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 400]);
  assert.equal(s.writes.length, 1); assert.equal(s.row.status, 'completed'); assert.equal(s.row.token_hash, null);
  assert.equal((await s.call(body)).status, 400);
});
test('expired and revoked links cannot update passwords', async () => {
  for (const mode of ['expired', 'revoked']) {
    const s = setup(); await s.call({ action: 'approve', id }, 'admin'); const token = s.approvedToken();
    if (mode === 'expired') s.setNow(timestamp + 30 * 60000);
    else assert.equal((await s.call({ action: 'reject', id }, 'admin')).status, 200);
    assert.equal((await s.call({ action: 'complete', id, token, password: 'ValidPass123!' })).status, 400);
    assert.equal(s.writes.length, 0);
  }
});
test('delivery failures preserve a reviewable pending request and retry approval', async () => {
  const s = setup(); s.failMail(true);
  assert.equal((await s.call({ action: 'request', email: 'student@example.test' })).status, 200);
  assert.match(s.row.notification_error, /delivery failed/);
  assert.equal((await s.call({ action: 'approve', id }, 'admin')).status, 502);
  assert.equal(s.row.status, 'pending'); assert.equal(s.row.token_hash, null);
  s.failMail(false); assert.equal((await s.call({ action: 'approve', id }, 'admin')).status, 200);
});
test('account policy failures leave an approved token available for correction', async () => {
  const s = setup(); await s.call({ action: 'approve', id }, 'admin'); s.failPassword(true);
  const body = { action: 'complete', id, token: s.approvedToken(), password: 'ValidPass123!' };
  assert.equal((await s.call(body)).status, 400); assert.equal(s.row.status, 'approved');
  s.failPassword(false); assert.equal((await s.call(body)).status, 200);
});

test('registration creates no account until approval and password submission, then only once', async () => {
  const s = setup(); s.row.request_kind='registration'; s.row.user_id=null; s.row.submitted_name='New Student';
  await s.call({action:'request',kind:'registration',name:'New Student',email:s.row.email});
  assert.equal(s.writes.length,0);
  await s.call({action:'approve',id},'admin'); assert.equal(s.writes.length,0);
  const body={action:'complete',id,token:s.approvedToken(),password:'SafePass123!'};
  assert.equal((await s.call(body)).status,200); assert.equal(s.writes.length,1);
  assert.equal(s.row.user_id,'new-student'); assert.equal((await s.call(body)).status,400);
});
test('full name is required and request type cannot escalate access', async () => {
  const s=setup();
  assert.equal((await s.call({action:'request',email:s.row.email,name:''})).status,400);
  assert.equal((await s.call({action:'request',email:s.row.email,name:'Person',kind:'admin'})).status,400);
  assert.equal(s.sent.length,0);
});

test('reviewed requests can be removed without breaking an approved password link', async () => {
  const s=setup();
  assert.equal((await s.call({action:'delete',id},'admin')).status,409);
  assert.equal((await s.call({action:'delete',id},'student')).status,403);
  await s.call({action:'approve',id},'admin'); const token=s.approvedToken();
  assert.equal((await s.call({action:'delete',id},'admin')).status,200);
  assert.ok(s.row.archived_at); assert.equal(s.row.status,'approved');
  assert.equal((await s.call({action:'complete',id,token,password:'ValidPass123!'})).status,200);
});
test('request and approval emails use the existing branded email card', async () => {
  const s=setup(); await s.call({action:'request',email:s.row.email}); await s.call({action:'approve',id},'admin');
  for(const [, ,html] of s.sent){
    assert.match(html, /#F6F3EA/); assert.match(html, /#7A1B38/); assert.match(html, /St\. Agnes Academy/);
    assert.match(html, /assets\/logo\.png/); assert.match(html, /max-width:520px/); assert.match(html, /Office of Student Affairs &amp; Services/);
  }
});

test('both request types send review and password links to the custom domain', async () => {
  for (const kind of ['reset', 'registration']) {
    const s = setup(null);
    s.row.request_kind = kind;
    if (kind === 'registration') s.row.user_id = null;
    await s.call({ action: 'request', kind, email: s.row.email });
    await s.call({ action: 'approve', id }, 'admin');
    assert.equal(s.sent.length, 2);
    assert.match(s.sent[0][2], /https:\/\/osas\.stagnesacademy-sms\.com\/#\/accounts/);
    assert.match(s.sent[1][2], /https:\/\/osas\.stagnesacademy-sms\.com\/#\/reset-password\?request=/);
    for (const [, , html] of s.sent) {
      assert.match(html, /https:\/\/osas\.stagnesacademy-sms\.com\/assets\/logo\.png/);
      assert.doesNotMatch(html, /vercel\.app/);
    }
  }
});
