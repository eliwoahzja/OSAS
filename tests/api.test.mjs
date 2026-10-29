import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../js/api.js', import.meta.url), 'utf8');
const user = { id: '11111111-1111-4111-8111-111111111111', name: 'Same Name', email: 'student@example.com', role: 'client' };
const own = { id: 'own', submitted_by: user.id, reporter: user.name, description: 'My report', status: 'open', date: '2026-10-29' };
const other = { id: 'other', submitted_by: '22222222-2222-4222-8222-222222222222', reporter: user.name, description: 'Private report', status: 'open', date: '2026-10-29' };
const legacy = { id: 'legacy', reporter: user.name, description: 'Unassigned', status: 'open' };
let serial = 0;

async function fixture({ admin = false, demo = false, signedIn = true, token = 'test-token', respond } = {}) {
  const key = `__osasApiTest${++serial}`;
  const state = { user: signedIn ? { ...user, role: admin ? 'admin' : 'client' } : null, token, calls: [] };
  globalThis[key] = state;
  globalThis.window = { OSAS: demo ? {} : { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'public-test-key' }, dispatchEvent() {} };
  globalThis.localStorage = { getItem: () => null, setItem: () => {} };
  globalThis.fetch = async (url, options) => {
    const call = { url: new URL(url), ...options, body: options.body ? JSON.parse(options.body) : undefined };
    state.calls.push(call);
    const rows = respond ? await respond(call) : [own, other, legacy];
    return Response.json(rows);
  };
  const dataUrl = (s) => `data:text/javascript;base64,${Buffer.from(s).toString('base64')}`;
  const auth = dataUrl(`const state = globalThis[${JSON.stringify(key)}]; export const currentUser = () => state.user; export const isAdmin = () => state.user?.role === 'admin'; export const currentAccessToken = async () => state.token;`);
  const mock = dataUrl(`export const MOCK = ${JSON.stringify({ incidents: [own, other, legacy], inspections: [], drills: [], supplies: [], emergency_contacts: [] })}; export const mockNextId = () => 'new-report'; // ${serial}`);
  const rewritten = source.replace("'./auth.js'", JSON.stringify(auth)).replace("'./mock.js'", JSON.stringify(mock)).replace(/'\.\/([^']+)'/g, (_match, path) => JSON.stringify(new URL('../js/' + path, import.meta.url).href));
  const api = await import(dataUrl(rewritten));
  return { api, ...state };
}

test('client requests exact account ownership and hides other/legacy rows even when names match', async () => {
  const { api, calls } = await fixture();
  assert.deepEqual(await api.listRows('incidents', { submitted_by: other.submitted_by }), [own]);
  assert.equal(calls[0].url.searchParams.get('submitted_by'), `eq.${user.id}`);
});

test('admin receives all reports including unassigned legacy reports', async () => {
  const { api, calls } = await fixture({ admin: true });
  assert.deepEqual(await api.listRows('incidents'), [own, other, legacy]);
  assert.equal(calls[0].url.searchParams.has('submitted_by'), false);
});

test('signed-in client with no reports gets an ordinary empty list', async () => {
  const { api } = await fixture({ respond: () => [] });
  assert.deepEqual(await api.listRows('incidents'), []);
});

test('missing session is rejected before requesting incident data', async () => {
  const { api, calls } = await fixture({ signedIn: false });
  await assert.rejects(api.listRows('incidents'), /Sign in/);
  assert.equal(calls.length, 0);
});

test('an expired session still reports an authentication error for empty results', async () => {
  const { api } = await fixture({ token: null, respond: () => [] });
  await assert.rejects(api.listRows('incidents'), /session has expired/);
});

test('new report stamps account identity and trims description', async () => {
  const { api, calls } = await fixture({ respond: ({ body }) => [{ id: 'new', ...body }] });
  const row = await api.insertRow('incidents', { submitted_by: other.submitted_by, reporter: 'Someone else', description: '  New incident  ' });
  assert.equal(row.submitted_by, user.id);
  assert.equal(row.reporter, user.name);
  assert.equal(row.description, 'New incident');
  assert.equal(Object.hasOwn(calls[0].body, 'severity'), false);
  assert.equal(Object.hasOwn(calls[0].body, 'student_id'), false);
});

test('blank descriptions are rejected before any network request', async () => {
  const { api, calls } = await fixture();
  await assert.rejects(api.insertRow('incidents', { description: ' \n ' }), /incident description/);
  assert.equal(calls.length, 0);
});

test('dashboard totals and type breakdown only contain the client reports', async () => {
  const { api, calls } = await fixture({ respond: ({ url }) => url.pathname.endsWith('/incidents') ? [own, other, legacy] : [] });
  const stats = await api.getDashboardStats();
  assert.equal(stats.incidents_total, 1);
  assert.equal(stats.incidents_open, 1);
  assert.deepEqual(stats.incident_breakdown, [{ label: 'Unclassified', value: 1 }]);
  assert.equal(calls.find(({ url }) => url.pathname.endsWith('/incidents')).url.searchParams.get('submitted_by'), `eq.${user.id}`);
});

test('client cannot reassign ownership or delete incident reports', async () => {
  const { api, calls } = await fixture();
  await assert.rejects(api.updateRow('incidents', own.id, { submitted_by: other.submitted_by }), /Only administrators/);
  await assert.rejects(api.deleteRow('incidents', own.id), /Only administrators/);
  assert.equal(calls.length, 0);
});

test('admin updates still report missing or denied rows', async () => {
  const { api, calls } = await fixture({ admin: true, respond: () => [] });
  await assert.rejects(api.updateRow('incidents', other.id, { description: 'Changed' }), /Update was not applied/);
  assert.equal(calls[0].url.searchParams.get('id'), `eq.${other.id}`);
});

test('mock lists, dashboard counts and writes apply the same account ownership', async () => {
  const { api, calls } = await fixture({ demo: true });
  assert.deepEqual(await api.listRows('incidents'), [own]);
  const created = await api.insertRow('incidents', { description: 'Demo report', submitted_by: other.submitted_by });
  assert.equal(created.submitted_by, user.id);
  assert.equal((await api.getDashboardStats()).incidents_total, 2);
  await assert.rejects(api.updateRow('incidents', other.id, { description: 'Changed' }), /Only administrators/);
  assert.equal(calls.length, 0);
});
