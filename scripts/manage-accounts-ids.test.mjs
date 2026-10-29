import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = await readFile(new URL('../supabase/functions/manage-accounts/index.ts', import.meta.url), 'utf8');
let fixtureNumber = 0;
const userId = (n) => `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`;

async function setup({ count = 2, actorRole = 'admin', profileError = false } = {}) {
  const users = Array.from({ length: count }, (_, i) => ({
    id: userId(i), email: `account${i}@example.test`, app_metadata: { role: i === 0 ? 'admin' : 'client' },
    user_metadata: { name: `Account ${i}` }, created_at: '2026-10-29T00:00:00Z',
  }));
  const profiles = new Map(users.map((u, i) => [u.id, `s26${String(i + 1).padStart(7, '0')}`]));
  const profileBatches = [];
  const created = [];
  const svc = {
    auth: {
      async getUser() { return { data: { user: { ...users[0], app_metadata: { role: actorRole }, user_metadata: { role: 'admin' } } }, error: null }; },
      admin: {
        async listUsers({ page, perPage }) { return { data: { users: users.slice((page - 1) * perPage, page * perPage) }, error: null }; },
        async createUser(values) {
          created.push(values);
          const user = { ...values, id: userId(users.length), user_metadata: values.user_metadata };
          users.push(user);
          profiles.set(user.id, `s26${String(users.length).padStart(7, '0')}`);
          return { data: { user }, error: null };
        },
      },
    },
    from(table) {
      assert.equal(table, 'users');
      return { select() { return {
        async in(column, ids) {
          assert.equal(column, 'id');
          profileBatches.push(ids);
          return profileError ? { data: null, error: { message: 'Internal query failure' } }
            : { data: ids.filter((id) => profiles.has(id)).map((id) => ({ id, student_id: profiles.get(id) })), error: null };
        },
        eq(column, id) {
          assert.equal(column, 'id');
          return { async single() { return { data: { student_id: profiles.get(id) }, error: null }; } };
        },
      }; } };
    },
  };
  let handler;
  const key = `__manageAccountsFixture${++fixtureNumber}`;
  globalThis[key] = { createClient: () => svc };
  globalThis.Deno = {
    env: { get(name) { return ({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-key' })[name]; } },
    serve(fn) { handler = fn; },
  };
  const rewritten = source.replace(/^import \{ createClient \} from .*;$/m, `const createClient = globalThis[${JSON.stringify(key)}].createClient;`);
  await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(rewritten)).toString('base64')}`);
  return {
    created, profileBatches, profiles,
    async call(body) {
      const res = await handler(new Request('https://example.supabase.co/functions/v1/manage-accounts', {
        method: 'POST', headers: { Authorization: 'Bearer fake-session', 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      }));
      return { status: res.status, data: await res.json() };
    },
  };
}

test('account list preserves generated IDs for every role beyond the Data API row limit', async () => {
  const fixture = await setup({ count: 1205 });
  const { status, data } = await fixture.call({ action: 'list' });
  assert.equal(status, 200);
  assert.equal(data.users.length, 1205);
  assert.equal(data.users[0].role, 'admin');
  assert.equal(data.users[0].student_id, 's260000001');
  for (const user of data.users) assert.equal(user.student_id, fixture.profiles.get(user.id));
  assert.equal(fixture.profileBatches.length, 7);
  assert.ok(fixture.profileBatches.every((batch) => batch.length <= 200));
});

for (const role of ['admin', 'client']) {
  test(`creating a ${role} returns its assigned student ID`, async () => {
    const fixture = await setup();
    const { status, data } = await fixture.call({ action: 'create', name: 'New Account', email: 'new@example.test', password: 'Temporary123', role });
    assert.equal(status, 201);
    assert.equal(data.user.role, role);
    assert.equal(data.user.student_id, 's260000003');
    assert.deepEqual(fixture.created[0].app_metadata, { role });
    assert.equal(Object.hasOwn(fixture.created[0].user_metadata, 'student_id'), false);
  });
}

test('callers cannot supply their own student ID during account creation', async () => {
  const fixture = await setup();
  const { status } = await fixture.call({ action: 'create', name: 'New Account', email: 'new@example.test', password: 'Temporary123', role: 'client', student_id: 's269999999' });
  assert.equal(status, 400);
  assert.equal(fixture.created.length, 0);
});

test('students cannot read the account directory even with editable admin metadata', async () => {
  const fixture = await setup({ actorRole: 'client' });
  const { status } = await fixture.call({ action: 'list' });
  assert.equal(status, 403);
  assert.equal(fixture.profileBatches.length, 0);
});

test('profile failures return a retry message without exposing internal database errors', async () => {
  const fixture = await setup({ profileError: true });
  const { status, data } = await fixture.call({ action: 'list' });
  assert.equal(status, 503);
  assert.match(data.error, /Refresh Accounts/);
  assert.doesNotMatch(data.error, /Internal query/);
});
