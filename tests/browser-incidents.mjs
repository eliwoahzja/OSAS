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
const evidencePaths = Array.from({ length: 8 }, (_, index) => `${ownId}/00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}.png`);
const incident = (id, reporterId, description, createdAt = '2026-10-29T16:30:00Z') => ({
  id, submitted_by: reporterId, reporter: reporterId === ownId ? 'Student One' : 'Student Two',
  description, date: '2026-10-29', time: '10:30 AM', status: 'open',
  type: null, severity: null, location: null, created_at: createdAt,
});

async function scenario(role, empty = false, evidence = false) {
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 }, timezoneId: 'America/Los_Angeles' });
  const page = await context.newPage();
  const errors = [];
  const requests = [];
  const posts = [];
  const patches = [];
  const storageUploads = [];
  let rows = empty ? [] : [incident('own-report', ownId, 'My original report'), incident('other-report', otherId, 'Private report from someone else', null)];
  if (evidence) Object.assign(rows[0], { photo_path: evidencePaths[0], photo_paths: evidencePaths });
  let failImageSign = false;
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
      if (url.pathname.startsWith('/storage/v1/object/sign/incident-evidence/')) {
        const path = url.pathname.split('/incident-evidence/')[1];
        const index = evidencePaths.indexOf(path);
        assert.ok(index >= 0);
        if (request.method() === 'POST') {
          assert.equal(request.headers().authorization, 'Bearer test-access-token');
          if (failImageSign && index === 7) return route.fulfill({ status: 403, contentType: 'application/json', body: '{"message":"Image unavailable in test"}' });
          return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ signedURL: '/object/sign/incident-evidence/' + path + '?token=test' }) });
        }
        assert.equal(request.method(), 'GET');
        // Deliberately mix a very wide banner and tall portraits.
        const width = index % 2 ? 300 : 1000;
        const height = index % 2 ? 900 : 250;
        return route.fulfill({ contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${index % 2 ? '#81254d' : '#e6bd79'}"/><text x="20" y="70" font-size="40">Image ${index + 1}</text></svg>` });
      }
      if (url.pathname.startsWith('/storage/v1/object/incident-evidence/')) {
        if (request.method() === 'POST') {
          storageUploads.push(url.pathname);
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Key: url.pathname }) });
        }
        if (request.method() === 'DELETE') {
          return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
        }
      }
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
      if (request.method() === 'PATCH') {
        const payload = request.postDataJSON();
        patches.push(payload);
        const id = url.searchParams.get('id')?.replace(/^eq\./, '');
        const existing = rows.find((row) => row.id === id);
        assert.ok(existing, 'The status action must target an existing report');
        Object.assign(existing, payload);
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify([existing]) });
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
  return { page, context, requests, posts, patches, storageUploads, errors, failSave: () => { rejectSave = true; }, failImageSign: () => { failImageSign = true; } };
}

try {
  const client = await scenario('client');
  await client.page.getByRole('heading', { name: 'Report Incident', exact: true }).waitFor();
  assert.equal(await client.page.getByText('My original report', { exact: true }).count(), 1);
  assert.equal(await client.page.getByText('Private report from someone else', { exact: true }).count(), 0);
  assert.deepEqual(await client.page.locator('table thead th').allTextContents(), ['Date / Time', 'Reporter', 'Description', 'Photos', 'Status']);
  await client.page.getByText('Oct 30, 2026', { exact: true }).waitFor();
  await client.page.getByText('· 12:30 AM', { exact: true }).waitFor();
  assert.equal(client.requests[0].query.get('submitted_by'), `eq.${ownId}`);
  assert.equal(client.requests[0].headers.authorization, 'Bearer test-access-token');
  await client.page.getByRole('button', { name: 'Report Incident', exact: true }).click();
  await client.page.locator('.osas-modal-loader').waitFor({ state: 'detached' });
  const modal = client.page.locator('.osas-modal-card');
  assert.deepEqual(await modal.locator('label').allTextContents(), ['Reporter', 'Description', 'Attach incident images (required)']);
  assert.equal(await modal.locator('select,input[type="checkbox"]').count(), 0);
  assert.equal(await modal.getByLabel('Reporter').inputValue(), 'Student One');
  assert.equal(await modal.getByLabel('Reporter').evaluate((input) => input.readOnly), true);
  await modal.getByLabel('Description').fill('A blocked exit needs attention.');
  await modal.getByRole('button', { name: 'Save Report', exact: true }).click();
  assert.equal(client.posts.length, 0, 'A report without an image cannot submit.');
  const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+5xL8AAAAASUVORK5CYII=', 'base64');
  await modal.locator('input[type="file"]').setInputFiles([
    { name: 'evidence-one.png', mimeType: 'image/png', buffer: tinyPng },
    { name: 'evidence-two.png', mimeType: 'image/png', buffer: tinyPng },
  ]);
  await modal.getByRole('img', { name: 'Attached incident image 2', exact: true }).waitFor();
  assert.equal(await modal.getByRole('img', { name: /Attached incident image/ }).count(), 2);
  assert.equal(await modal.getByText('2 of 8 images attached').count(), 1);
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
  assert.match(client.posts[0].photo_path, new RegExp('^' + ownId + '/[0-9a-f-]+\\.png$'));
  assert.equal(client.storageUploads.length, 2);
  assert.equal(client.posts[0].photo_paths.length, 2);
  assert.equal(client.posts[0].photo_paths[0], client.posts[0].photo_path);
  assert.notEqual(client.posts[0].photo_paths[0], client.posts[0].photo_paths[1]);
  for (const key of ['type', 'severity', 'location', 'student_id', 'notify_parent', 'date', 'time', 'created_at']) assert.equal(key in client.posts[0], false);
  assert.equal(await client.page.getByText('Private report from someone else', { exact: true }).count(), 0);
  assert.equal(await client.page.getByText('To review', { exact: true }).count(), 0);
  assert.deepEqual(client.errors, []);
  await client.context.close();

  const admin = await scenario('admin');
  await admin.page.getByRole('heading', { name: 'Incident Logging', exact: true }).waitFor();
  await admin.page.getByText('Private report from someone else', { exact: true }).waitFor();
  assert.deepEqual(await admin.page.locator('table thead th').allTextContents(), ['Date / Time', 'Reporter', 'Description', 'Photos', 'Status', 'Action']);
  await admin.page.getByText('Oct 29, 2026', { exact: true }).waitFor();
  await admin.page.getByText('· 10:30 AM', { exact: true }).waitFor();
  assert.equal(await admin.page.getByRole('button', { name: 'Report Incident', exact: true }).count(), 0);
  assert.equal(admin.requests[0].query.has('submitted_by'), false);
  await admin.page.getByRole('button', { name: 'Resolve incident: My original report', exact: true }).click();
  const statusModal = admin.page.locator('.osas-modal-card');
  await statusModal.getByRole('heading', { name: 'Update incident status', exact: true }).waitFor();
  assert.deepEqual(await statusModal.locator('label').allTextContents(), ['Status']);
  assert.equal(await statusModal.locator('input,textarea').count(), 0);
  await statusModal.getByLabel('Status', { exact: true }).selectOption('resolved');
  await statusModal.getByRole('button', { name: 'Save changes', exact: true }).click();
  await admin.page.getByRole('button', { name: 'Reopen incident: My original report', exact: true }).waitFor();
  assert.deepEqual(admin.patches, [{ status: 'resolved' }]);
  await admin.page.getByText('Oct 30, 2026', { exact: true }).waitFor();
  assert.deepEqual(admin.errors, []);
  await admin.context.close();

  const empty = await scenario('client', true);
  await empty.page.getByText('No reports filed yet', { exact: true }).waitFor();
  assert.equal(await empty.page.getByText('Session expired or not authorised', { exact: true }).count(), 0);
  await empty.page.getByRole('button', { name: 'Report Incident', exact: true }).click();
  await empty.page.locator('.osas-modal-loader').waitFor({ state: 'detached' });
  empty.failSave();
  await empty.page.getByLabel('Description').fill('Report to retry after service failure.');
  await empty.page.locator('input[type="file"]').setInputFiles({ name: 'evidence.png', mimeType: 'image/png', buffer: tinyPng });
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
  for (const role of ['client', 'admin']) {
    const gallery = await scenario(role, false, true);
    await gallery.page.getByRole('button', { name: 'View 8 incident images', exact: true }).click();
    const dialog = gallery.page.getByRole('dialog', { name: 'Incident images (8)', exact: true });
    await dialog.getByRole('link', { name: 'Open incident image 8', exact: true }).waitFor();
    await gallery.page.waitForFunction(() => [...document.querySelectorAll('.incident-evidence-frame img')].every(img => img.complete && img.naturalWidth));
    const dimensions = await dialog.locator('.incident-evidence-frame').evaluateAll(frames => frames.map(frame => frame.getBoundingClientRect().height));
    assert.equal(dimensions.length, 8);
    assert.ok(Math.max(...dimensions) - Math.min(...dimensions) <= 1, 'Wide and portrait evidence must use equal-sized frames');
    assert.ok(await dialog.locator('img').evaluateAll(images => images.every(img => getComputedStyle(img).objectFit === 'contain')), 'Evidence must not be cropped');
    assert.equal(new URL(await dialog.getByRole('link', { name: 'Open incident image 1', exact: true }).getAttribute('href')).origin, 'https://unit-test.supabase.co');
    for (const viewport of [{ width: 390, height: 600 }, { width: 844, height: 390 }]) {
      await gallery.page.setViewportSize(viewport);
      await dialog.locator('.incident-evidence-gallery').evaluate(el => { el.scrollTop = el.scrollHeight; });
      const layout = await dialog.evaluate(el => {
        const box = el.getBoundingClientRect();
        const close = el.querySelector('footer button').getBoundingClientRect();
        const grid = el.querySelector('.incident-evidence-gallery');
        return { fits: box.top >= 0 && box.bottom <= window.innerHeight, closeVisible: close.top >= 0 && close.bottom <= window.innerHeight,
          noHorizontalOverflow: el.scrollWidth <= el.clientWidth, scrollable: grid.scrollHeight > grid.clientHeight };
      });
      assert.deepEqual(layout, { fits: true, closeVisible: true, noHorizontalOverflow: true, scrollable: true });
      if (process.env.TEST_SCREENSHOT_DIR) {
        await mkdir(process.env.TEST_SCREENSHOT_DIR, { recursive: true });
        await dialog.locator('.incident-evidence-gallery').evaluate(el => { el.scrollTop = 0; });
        await gallery.page.screenshot({ path: `${process.env.TEST_SCREENSHOT_DIR}/evidence-${role}-${viewport.width}.png` });
      }
    }
    await gallery.page.getByRole('button', { name: 'Close', exact: true }).click();
    await dialog.waitFor({ state: 'detached' });
    gallery.failImageSign();
    await gallery.page.getByRole('button', { name: 'View 8 incident images', exact: true }).click();
    await dialog.getByRole('alert').filter({ hasText: 'Image 8 could not be opened.' }).waitFor();
    assert.equal(await dialog.getByRole('link').count(), 7);
    await dialog.getByRole('button', { name: 'Close incident evidence', exact: true }).click();
    await dialog.waitFor({ state: 'detached' });
    assert.deepEqual(gallery.errors, []);
    await gallery.context.close();
  }
  console.log('Browser incidents OK: report privacy, timestamps, uploads and retries; eight-image gallery with uniform uncropped previews, mobile/landscape scrolling, visible Close controls, and unavailable-image handling for students and admins. All backend traffic intercepted.');
} finally {
  await browser.close();
}
