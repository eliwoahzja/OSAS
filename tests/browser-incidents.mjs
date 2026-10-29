// Run with a local server: PORT=3000 npm run dev
// Install Playwright separately, then set PLAYWRIGHT_MODULE to its index.mjs if needed.
// All authentication and REST traffic is intercepted; this test never contacts a live project.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.TEST_ORIGIN || 'http://localhost:3000';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
  headless: true,
  args: ['--no-sandbox'],
});
const ownId = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';
const incident = (id, reporterId, description) => ({
  id, submitted_by: reporterId, reporter: reporterId === ownId ? 'Student One' : 'Student Two',
  description, date: '2026-10-29', time: '10:30 AM', status: 'open',
  type: null, severity: null, location: null,
});

async function scenario(role, empty = false) {
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  const requests = [];
  const posts = [];
  let rows = empty ? [] : [incident('own-report', ownId, 'My original report'), incident('other-report', otherId, 'Private report from someone else')];
  let rejectSave = false;
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === origin && url.pathname === '/__incident_test') {
      return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head>
        <link rel="stylesheet" href="/css/tailwind.css"><link rel="stylesheet" href="/css/osas.css">
        </head><body><main id="view"></main><div id="toast-root"></div>
        <script>window.OSAS = { SUPABASE_URL: 'https://unit-test.supabase.co', SUPABASE_ANON_KEY: 'test-key' };</script>
        <script type="module">import { incidentLogging } from '/js/modules/incidents.js'; await incidentLogging(document.getElementById('view'));</script>
        </body></html>` });
    }
    if (url.origin === origin && url.pathname === '/js/auth.js') {
      return route.fulfill({ contentType: 'text/javascript', body: `
        const user = { id: '${ownId}', name: 'Student One', email: 'one@example.test', role: '${role}' };
        export const currentUser = () => user;
        export const isAdmin = () => user.role === 'admin';
        export const currentAccessToken = async () => 'test-access-token';
        export const subscribeIncidentChanges = async () => () => {};
      ` });
    }
    if (url.origin === 'https://unit-test.supabase.co') {
      assert.equal(url.pathname, '/rest/v1/incidents', 'The report form must not request students or send alerts');
      requests.push({ method: request.method(), query: url.searchParams, headers: request.headers() });
      if (request.method() === 'POST') {
        const payload = request.postDataJSON();
        posts.push(payload);
        if (rejectSave) return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Test save failed' }) });
        const created = { ...incident('new-report', ownId, payload.description), ...payload };
        rows.unshift(created);
        return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify([created]) });
      }
      assert.equal(request.method(), 'GET');
      // Return every row deliberately: the real API adapter must still hide other owners.
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(rows) });
    }
    if (url.origin === origin) return route.continue();
    return route.abort('blockedbyclient');
  });
  await page.goto(`${origin}/__incident_test`);
  await page.getByRole('heading', { name: role === 'admin' ? 'Incident Logging' : 'Report Incident', exact: true }).waitFor();
  return { page, context, requests, posts, errors, failSave: () => { rejectSave = true; } };
}

try {
  const client = await scenario('client');
  await client.page.getByRole('heading', { name: 'Report Incident', exact: true }).waitFor();
  assert.equal(await client.page.getByText('My original report', { exact: true }).count(), 1);
  assert.equal(await client.page.getByText('Private report from someone else', { exact: true }).count(), 0);
  assert.equal(client.requests[0].query.get('submitted_by'), `eq.${ownId}`);
  assert.equal(client.requests[0].headers.authorization, 'Bearer test-access-token');
  await client.page.getByRole('button', { name: 'Report Incident', exact: true }).click();
  await client.page.locator('.osas-modal-loader').waitFor({ state: 'detached' });
  const modal = client.page.locator('.osas-modal-card');
  assert.deepEqual(await modal.locator('label').allTextContents(), ['Reporter', 'Description']);
  assert.equal(await modal.locator('select,input[type="checkbox"]').count(), 0);
  assert.equal(await modal.getByLabel('Reporter').inputValue(), 'Student One');
  assert.equal(await modal.getByLabel('Reporter').evaluate((input) => input.readOnly), true);
  await modal.getByLabel('Description').fill('   ');
  await modal.getByRole('button', { name: 'Save Report', exact: true }).click();
  await modal.getByText('Describe what happened before submitting your report.', { exact: true }).waitFor();
  assert.equal(client.posts.length, 0);
  await modal.getByLabel('Reporter').evaluate((input) => { input.value = 'Spoofed reporter'; });
  await modal.getByLabel('Description').fill('  A blocked exit needs attention.  ');
  await modal.getByRole('button', { name: 'Save Report', exact: true }).click();
  await client.page.getByText('A blocked exit needs attention.', { exact: true }).waitFor();
  assert.equal(client.posts.length, 1);
  assert.equal(client.posts[0].description, 'A blocked exit needs attention.');
  assert.equal(client.posts[0].reporter, 'Student One');
  assert.equal(client.posts[0].submitted_by, ownId);
  for (const key of ['type', 'severity', 'location', 'student_id', 'notify_parent']) assert.equal(key in client.posts[0], false);
  assert.equal(await client.page.getByText('Private report from someone else', { exact: true }).count(), 0);
  assert.equal(await client.page.getByText('To review', { exact: true }).count(), 4);
  assert.deepEqual(client.errors, []);
  await client.context.close();

  const admin = await scenario('admin');
  await admin.page.getByRole('heading', { name: 'Incident Logging', exact: true }).waitFor();
  await admin.page.getByText('Private report from someone else', { exact: true }).waitFor();
  assert.equal(await admin.page.getByRole('button', { name: 'Report Incident', exact: true }).count(), 0);
  assert.equal(admin.requests[0].query.has('submitted_by'), false);
  assert.deepEqual(admin.errors, []);
  await admin.context.close();

  const empty = await scenario('client', true);
  await empty.page.getByText('No reports filed yet', { exact: true }).waitFor();
  assert.equal(await empty.page.getByText('Session expired or not authorised', { exact: true }).count(), 0);
  await empty.page.getByRole('button', { name: 'Report Incident', exact: true }).click();
  await empty.page.locator('.osas-modal-loader').waitFor({ state: 'detached' });
  empty.failSave();
  await empty.page.getByLabel('Description').fill('Report to retry after service failure.');
  await empty.page.getByRole('button', { name: 'Save Report', exact: true }).click();
  await empty.page.getByText('Test save failed', { exact: true }).waitFor();
  assert.equal(await empty.page.getByRole('button', { name: 'Save Report', exact: true }).isEnabled(), true);
  assert.equal(await empty.page.getByLabel('Description').inputValue(), 'Report to retry after service failure.');
  await empty.page.setViewportSize({ width: 390, height: 844 });
  if (process.env.TEST_SCREENSHOT_DIR) {
    await mkdir(process.env.TEST_SCREENSHOT_DIR, { recursive: true });
    await empty.page.screenshot({ path: `${process.env.TEST_SCREENSHOT_DIR}/incident-form-mobile.png`, fullPage: true });
  }
  assert.deepEqual(empty.errors, []);
  await empty.context.close();
  console.log('Browser incidents OK: client privacy, admin visibility, two-field form, immutable reporter, save/reload, empty state, failed save retry. All backend traffic intercepted.');
} finally {
  await browser.close();
}
