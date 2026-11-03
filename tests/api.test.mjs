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

test('school dashboard analytics are unavailable to students in live and demo mode', async () => {
  for (const demo of [false, true]) {
    const { api, calls } = await fixture({ demo });
    await assert.rejects(api.getDashboardStats(), /administrators only/);
    assert.equal(calls.length, 0);
  }
  const { api } = await fixture({ admin: true, respond: ({ url }) => url.pathname.endsWith('/incidents') ? [own, other, legacy] : [] });
  assert.equal((await api.getDashboardStats()).incidents_total, 3);
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
  assert.equal((await api.listRows('incidents')).length, 2);
  await assert.rejects(api.updateRow('incidents', other.id, { description: 'Changed' }), /Only administrators/);
  assert.equal(calls.length, 0);
});

test('mock reports stamp submission time and preserve it during administrator review', async () => {
  const { api } = await fixture({ admin: true, demo: true });
  const before = Date.now();
  const report = await api.insertRow('incidents', { description: 'Timestamped report', created_at: '1900-01-01T00:00:00Z', date: '1900-01-01', time: 'Wrong time' });
  assert.ok(Date.parse(report.created_at) >= before);
  const manila = new Date(Date.parse(report.created_at) + 8 * 60 * 60 * 1000);
  assert.equal(report.date, manila.toISOString().slice(0, 10));
  const reviewed = await api.updateRow('incidents', report.id, { status: 'resolved', created_at: '1900-01-01T00:00:00Z', date: '1900-01-01', time: 'Wrong time' });
  assert.equal(reviewed.created_at, report.created_at);
  assert.equal(reviewed.date, report.date);
  assert.equal(reviewed.time, report.time);
  assert.equal(reviewed.status, 'resolved');
});

test('students can read announcements but cannot publish, edit or delete them in live or demo mode', async () => {
  for (const demo of [false, true]) {
    const { api, calls } = await fixture({ demo, respond: () => [] });
    assert.deepEqual(await api.listAnnouncements(), []);
    const readCalls = calls.length;
    await assert.rejects(api.insertRow('announcements', { title: 'Title', body: 'Message' }), /Only administrators/);
    await assert.rejects(api.updateRow('announcements', 'id', { title: 'Title', body: 'Message' }), /Only administrators/);
    await assert.rejects(api.deleteRow('announcements', 'id'), /Only administrators/);
    assert.equal(calls.length, readCalls);
  }
});

test('announcement reads require sign-in and use bounded pages in newest-first order', async () => {
  const signedOut = await fixture({ signedIn: false });
  await assert.rejects(signedOut.api.listAnnouncements(), /Sign in/);
  assert.equal(signedOut.calls.length, 0);
  const { api, calls } = await fixture({ respond: () => [] });
  await api.listAnnouncements({ limit: 1000, offset: -10 });
  assert.equal(calls[0].url.pathname, '/rest/v1/announcements');
  assert.equal(calls[0].url.searchParams.get('limit'), '100');
  assert.equal(calls[0].url.searchParams.get('offset'), '0');
  assert.equal(calls[0].url.searchParams.get('order'), 'created_at.desc,id.desc');
  assert.equal(calls[0].headers.Authorization, 'Bearer test-token');
});

test('administrator announcement writes trim text and cannot spoof author or posting date', async () => {
  const { api, calls } = await fixture({ admin: true, respond: ({ body }) => [{ id: 'announcement', ...body }] });
  await api.insertRow('announcements', { title: '  School update  ', body: '  Message  ', author_id: 'fake', author_name: 'Fake admin', created_at: '1900-01-01' });
  assert.deepEqual(calls[0].body, { title: 'School update', body: 'Message' });
  await api.updateRow('announcements', 'announcement', { title: 'Updated', body: 'Message', author_name: 'Fake admin' });
  assert.deepEqual(calls[1].body, { title: 'Updated', body: 'Message' });
  await assert.rejects(api.insertRow('announcements', { title: ' ', body: 'Message' }), /title/);
  await assert.rejects(api.insertRow('announcements', { title: 'Title', body: 'x'.repeat(5001) }), /message/);
  assert.equal(calls.length, 2);
});

test('demo announcements persist through create, edit and delete with original attribution', async () => {
  const { api } = await fixture({ admin: true, demo: true });
  const saved = await api.insertRow('announcements', { title: 'First', body: 'Message', author_name: 'Fake' });
  assert.equal(saved.author_id, user.id);
  assert.equal(saved.author_name, user.name);
  const updated = await api.updateRow('announcements', saved.id, { title: 'Edited', body: 'Updated', created_at: '1900-01-01' });
  assert.equal(updated.created_at, saved.created_at);
  assert.equal(updated.author_name, saved.author_name);
  assert.equal((await api.listAnnouncements())[0].title, 'Edited');
  await api.deleteRow('announcements', saved.id);
  assert.deepEqual(await api.listAnnouncements(), []);
});

test('students read only their own grade assignment and cannot write grades', async () => {
  const { api, calls } = await fixture({ respond: () => [{ grade_level: 10 }] });
  assert.equal(await api.getStudentGrade(), 10);
  assert.equal(calls[0].url.pathname, '/rest/v1/student_grades');
  assert.equal(calls[0].url.searchParams.get('user_id'), `eq.${user.id}`);
  await assert.rejects(api.getStudentGrade(other.submitted_by), /only view your own/);
  await assert.rejects(api.saveStudentGrade(user.id, 11), /Only administrators/);
  assert.equal(calls.length, 1);
  const empty = await fixture({ respond: () => [] });
  assert.equal(await empty.api.getStudentGrade(), null);
  const signedOut = await fixture({ signedIn: false });
  await assert.rejects(signedOut.api.getStudentGrade(), /Sign in/);
  assert.equal(signedOut.calls.length, 0);
});

test('administrators assign or clear grades 7 through 12 and reject invalid grades before sending', async () => {
  const { api, calls } = await fixture({ admin: true, respond: ({ body }) => [body] });
  await api.saveStudentGrade(user.id, 10);
  assert.deepEqual(calls[0].body, { user_id: user.id, grade_level: 10 });
  assert.equal(calls[0].url.searchParams.get('on_conflict'), 'user_id');
  assert.match(calls[0].headers.Prefer, /resolution=merge-duplicates/);
  await api.saveStudentGrade(user.id, null);
  assert.equal(calls[1].body.grade_level, null);
  for (const grade of [6, 13, 7.5, '10', NaN]) await assert.rejects(api.saveStudentGrade(user.id, grade), /grade from 7 to 12/);
  assert.equal(calls.length, 2);
  const demo = await fixture({ admin: true, demo: true });
  await demo.api.saveStudentGrade(user.id, 12);
  assert.equal(await demo.api.getStudentGrade(user.id), 12);
});
