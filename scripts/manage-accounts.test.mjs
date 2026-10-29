import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';

// Run the actual Edge Function with injected Deno/Supabase adapters; no network.
const source = stripTypeScriptTypes((await readFile(new URL('../supabase/functions/manage-accounts/index.ts', import.meta.url), 'utf8'))
  .replace(/^import .+\n/, ''));
const adminId = '11000000-0000-4000-8000-000000000001';
const studentId = '11000000-0000-4000-8000-000000000002';
function setup() {
  const users = [
    { id: adminId, email: 'admin@gmail.com', app_metadata: { role: 'admin' }, user_metadata: { name: 'Administrator' } },
    { id: studentId, email: 'student@gmail.com', app_metadata: { role: 'client' }, user_metadata: { name: 'Student One' } },
  ];
  const profiles = [
    { id: adminId, email: users[0].email, username: 'school.admin' },
    { id: studentId, email: users[1].email, username: 'student.one' },
  ];
  const writes = [];
  let race = false;
  const svc = {
    auth: {
      async getUser(token) { return { data: { user: token === 'admin' ? users[0] : users[1] } }; },
      admin: {
        async listUsers({ page, perPage }) { return { data: { users: users.slice((page - 1) * perPage, page * perPage) } }; },
        async getUserById(id) { return { data: { user: users.find((u) => u.id === id) } }; },
        async createUser(attributes) {
          writes.push(attributes);
          if (race) {
            profiles.push({ id: 'concurrent-user', username: attributes.app_metadata.username });
            return { error: { message: 'Database error saving new user' } };
          }
          const user = { id: '11000000-0000-4000-8000-000000000003', ...attributes };
          users.push(user);
          profiles.push({ id: user.id, email: user.email, username: user.app_metadata.username || user.email.split('@')[0] });
          return { data: { user } };
        },
        async updateUserById(id, attributes) {
          writes.push(attributes);
          Object.assign(users.find((u) => u.id === id), attributes);
          Object.assign(profiles.find((p) => p.id === id), { email: attributes.email, username: attributes.app_metadata.username });
          return {};
        },
      },
    },
    from(table) {
      assert.equal(table, 'users');
      const filters = [];
      const result = () => profiles.filter((p) => filters.every(([key, value]) => p[key] === value));
      const query = {
        select: () => query,
        eq(key, value) { filters.push([key, value]); return query; },
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
  return { users, profiles, writes, call, simulateRace() { race = true; } };
}

test('account list returns saved usernames, not email prefixes', async () => {
  const s = setup();
  const response = await s.call({ action: 'list' });
  assert.equal(response.status, 200);
  assert.equal(response.data.users[1].username, 'student.one');
  assert.equal(response.data.users[1].email, 'student@gmail.com');
  assert.equal((await s.call({ action: 'list' }, 'student')).status, 403);
});

test('account create separates the username from the verification mailbox', async () => {
  const s = setup();
  const response = await s.call({ action: 'create', username: '  J.Reyes  ', email: 'personal@gmail.com', name: 'Juan Reyes', password: 'Password12', role: 'client' });
  assert.equal(response.status, 201);
  assert.equal(response.data.user.username, 'j.reyes');
  assert.equal(s.writes[0].email, 'personal@gmail.com');
  assert.equal(s.writes[0].app_metadata.username, 'j.reyes');
});

test('duplicate create and rename reject case-insensitively without changing accounts', async () => {
  const s = setup();
  const create = await s.call({ action: 'create', username: 'SCHOOL.ADMIN', email: 'new@gmail.com', name: 'New Account', password: 'Password12', role: 'client' });
  const rename = await s.call({ action: 'update', id: studentId, username: 'School.Admin' });
  assert.equal(create.status, 400);
  assert.equal(rename.status, 400);
  assert.equal(create.data.error, 'Username is already taken.');
  assert.equal(rename.data.error, 'Username is already taken.');
  assert.equal(s.writes.length, 0);
});

test('changing a username retains its email and partial edits retain its username', async () => {
  const s = setup();
  const renamed = await s.call({ action: 'update', id: studentId, username: 'student.renamed' });
  assert.equal(renamed.status, 200);
  assert.equal(renamed.data.user.email, 'student@gmail.com');
  const emailChanged = await s.call({ action: 'update', id: studentId, email: 'another@gmail.com' });
  assert.equal(emailChanged.data.user.username, 'student.renamed');
  assert.equal(s.profiles[1].email, 'another@gmail.com');
});

test('a concurrent username claim receives the exact duplicate message', async () => {
  const s = setup();
  s.simulateRace();
  const result = await s.call({ action: 'create', username: 'j.reyes', email: 'new@gmail.com', name: 'Juan Reyes', password: 'Password12', role: 'client' });
  assert.equal(result.status, 400);
  assert.equal(result.data.error, 'Username is already taken.');
});
