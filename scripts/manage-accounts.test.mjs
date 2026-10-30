import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';

// Run the actual Edge Function with injected Deno/Supabase adapters; no network.
const source = stripTypeScriptTypes((await readFile(new URL('../supabase/functions/manage-accounts/index.ts', import.meta.url), 'utf8'))
  .replace(/^import .+\r?\n/, ''));
const adminId = '11000000-0000-4000-8000-000000000001';
const studentId = '11000000-0000-4000-8000-000000000002';
function setup() {
  const users = [
    { id: adminId, email: 'admin@gmail.com', app_metadata: { role: 'admin' }, user_metadata: { name: 'Administrator' } },
    { id: studentId, email: 'student@gmail.com', app_metadata: { role: 'client' }, user_metadata: { name: 'Student One' } },
  ];
  const profiles = [
    { id: adminId, email: users[0].email, student_id: 's260000002' },
    { id: studentId, email: users[1].email, student_id: 's260000001' },
  ];
  const writes = [];
  const svc = {
    auth: {
      async getUser(token) { return { data: { user: token === 'admin' ? users[0] : users[1] } }; },
      admin: {
        async listUsers({ page, perPage }) { return { data: { users: users.slice((page - 1) * perPage, page * perPage) } }; },
        async getUserById(id) { return { data: { user: users.find((u) => u.id === id) } }; },
        async createUser(attributes) {
          writes.push(attributes);
          const user = { id: '11000000-0000-4000-8000-000000000003', ...attributes };
          users.push(user);
          profiles.push({ id: user.id, email: user.email, student_id: 's260000003' });
          return { data: { user } };
        },
        async updateUserById(id, attributes) {
          writes.push(attributes);
          Object.assign(users.find((u) => u.id === id), attributes);
          Object.assign(profiles.find((p) => p.id === id), { email: attributes.email });
          return {};
        },
      },
    },
    from(table) {
      assert.equal(table, 'users');
      const filters = [];
      const membership = [];
      const result = () => profiles.filter((p) => filters.every(([key, value]) => p[key] === value) && membership.every(([key, values]) => values.includes(p[key])));
      const query = {
        select: () => query,
        eq(key, value) { filters.push([key, value]); return query; },
        in(key, values) { membership.push([key, values]); return query; },
        async maybeSingle() { return { data: result()[0] || null }; },
        async single() { return { data: result()[0] || null }; },
        then(resolve) { resolve({ data: result() }); },
      };
      return query;
    },
  };
  let handler;
  const Deno = {
    env: { get: (key) => key === 'SUPABASE_URL' ? 'https://project.example' : key === 'SUPABASE_SERVICE_ROLE_KEY' ? 'test-service-key' : undefined },
    serve(fn) { handler = fn; },
  };
  new Function('Deno', 'createClient', source)(Deno, () => svc);
  const call = async (body, token = 'admin') => {
    const response = await handler(new Request('https://project.example/functions/v1/manage-accounts', {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(body),
    }));
    return { status: response.status, data: await response.json() };
  };
  return { users, profiles, writes, call };
}

test('account list returns saved student IDs and no username login fields', async () => {
  const s = setup();
  const response = await s.call({ action: 'list' });
  assert.equal(response.status, 200);
  assert.equal(response.data.users[0].student_id, 's260000002');
  assert.equal(response.data.users[1].student_id, 's260000001');
  assert.equal(response.data.users[1].username, undefined);
  assert.equal(response.data.users[1].email, 'student@gmail.com');
  assert.equal((await s.call({ action: 'list' }, 'student')).status, 403);
});

test('account create returns an auto-generated ID, separate from the verification mailbox', async () => {
  const s = setup();
  const response = await s.call({ action: 'create', email: 'personal@gmail.com', name: 'Juan Reyes', password: 'Password12', role: 'client' });
  assert.equal(response.status, 201);
  assert.equal(response.data.user.student_id, 's260000003');
  assert.equal(s.writes[0].email, 'personal@gmail.com');
  assert.equal(s.writes[0].app_metadata.username, undefined);
  assert.equal(s.writes[0].app_metadata.student_id, undefined);
});

test('callers cannot supply, overwrite, or rename generated IDs', async () => {
  const s = setup();
  for (const extra of [{ student_id: 's260000001' }, { username: 'School.Admin' }]) {
    const create = await s.call({ action: 'create', email: 'new@gmail.com', name: 'New Account', password: 'Password12', role: 'client', ...extra });
    const rename = await s.call({ action: 'update', id: studentId, ...extra });
    assert.equal(create.status, 400);
    assert.equal(rename.status, 400);
    assert.match(create.data.error, /generated automatically/);
    assert.match(rename.data.error, /cannot be edited/);
  }
  assert.equal(s.writes.length, 0);
});

test('changing the name or email retains the generated student ID', async () => {
  const s = setup();
  const renamed = await s.call({ action: 'update', id: studentId, name: 'Student Renamed' });
  assert.equal(renamed.status, 200);
  assert.equal(renamed.data.user.email, 'student@gmail.com');
  const emailChanged = await s.call({ action: 'update', id: studentId, email: 'another@gmail.com' });
  assert.equal(emailChanged.data.user.student_id, 's260000001');
  assert.equal(s.profiles[1].email, 'another@gmail.com');
});

test('administrator creation also returns an assigned student ID', async () => {
  const s = setup();
  const result = await s.call({ action: 'create', email: 'new@gmail.com', name: 'Juan Reyes', password: 'Password12', role: 'admin' });
  assert.equal(result.status, 201);
  assert.equal(result.data.user.student_id, 's260000003');
});
