// Real dashboard/modules with intercepted Auth and REST; no live school posts.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.TEST_ORIGIN || 'http://localhost:3000';
const backend = 'https://announcements-test.supabase.co';
const browser = await chromium.launch({ executablePath: existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined, headless: true, args: ['--no-sandbox'] });
let rows = [];
let serial = 0;
let failSave = false;
let failRead = false;
const requests = [];
const dataRequests = [];
let gradeLevel = null;

async function scenario(role) {
  const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await context.route('**/*', async route => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.origin === origin && url.pathname === '/js/config.js') return route.fulfill({ contentType: 'text/javascript', body: `window.OSAS={SUPABASE_URL:'${backend}',SUPABASE_ANON_KEY:'test-key',NOTIFY_FN_URL:'${backend}/functions/v1/send-notification'};` });
    if (url.origin === origin && url.pathname === '/js/auth.js') return route.fulfill({ contentType: 'text/javascript', body: `
      const user={id:'11111111-1111-4111-8111-111111111111',name:'${role === 'admin' ? 'School Administrator' : 'Student One'}',role:'${role}',email:'student@example.test',student_id:'s260000001'};
      const session={provider:'supabase',user,access_token:'test-token'};
      export const currentUser=()=>user;
      export const isAdmin=()=>user.role==='admin';
      export const isSignedIn=()=>true;
      export const getSession=()=>session;
      export const currentAccessToken=async()=>'test-token';
      export const hasRealSession=()=>true;
      export const restore=async()=>session;
      export const passwordRecovery=()=>({active:false,error:''});
      export const onAuthChange=()=>()=>{};
      export const subscribeIncidentChanges=async()=>()=>{};
    ` });
    if (url.origin === backend) {
      dataRequests.push({ role, path: url.pathname, method: req.method() });
      if (url.pathname === '/functions/v1/manage-accounts') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ users: [{ id: '11111111-1111-4111-8111-111111111111', name: 'Student One', email: 'student@example.test', role: 'client', student_id: 's260000001' }], me: '22222222-2222-4222-8222-222222222222' }) });
      if (url.pathname === '/functions/v1/password-reset') return route.fulfill({ contentType: 'application/json', body: '{"requests":[]}' });
      if (url.pathname === '/rest/v1/student_grades') {
        if (req.method() === 'GET') {
          assert.equal(url.searchParams.get('user_id'), 'eq.11111111-1111-4111-8111-111111111111');
          return route.fulfill({ contentType: 'application/json', body: JSON.stringify(gradeLevel === null ? [] : [{ grade_level: gradeLevel }]) });
        }
        assert.equal(role, 'admin');
        assert.equal(req.method(), 'POST');
        gradeLevel = req.postDataJSON().grade_level;
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify([{ grade_level: gradeLevel }]) });
      }
      if (role !== 'admin' && ['/rest/v1/incidents', '/rest/v1/inspections', '/rest/v1/supplies', '/rest/v1/drills'].includes(url.pathname)) throw new Error('Student dashboard requested school analytics: ' + url.pathname);
      if (url.pathname === '/rest/v1/incidents') return route.fulfill({ contentType: 'application/json', body: JSON.stringify([
        { id: 'incident-1', submitted_by: '11111111-1111-4111-8111-111111111111', date: '2026-11-03', created_at: '2026-11-03T05:00:00Z', status: 'open', type: null },
        { id: 'incident-2', submitted_by: '11111111-1111-4111-8111-111111111111', date: '2026-11-03', created_at: '2026-11-03T06:00:00Z', status: 'resolved', type: null },
      ]) });
      if (url.pathname !== '/rest/v1/announcements') return route.fulfill({ contentType: 'application/json', body: '[]' });
      requests.push({ role, method: req.method() });
      assert.equal(req.headers().authorization, 'Bearer test-token');
      const reply = (body, status = 200) => route.fulfill({ contentType: 'application/json', status, body: JSON.stringify(body) });
      if (req.method() === 'GET') {
        if (failRead) return reply({ message: 'Announcement service unavailable' }, 503);
        const offset = Number(url.searchParams.get('offset'));
        const limit = Number(url.searchParams.get('limit'));
        return reply(rows.slice(offset, offset + limit));
      }
      assert.equal(role, 'admin', 'Students must never send announcement mutations');
      if (failSave) return reply({ message: 'Please retry publishing' }, 503);
      const id = url.searchParams.get('id')?.slice(3);
      if (req.method() === 'POST') {
        const row = { ...req.postDataJSON(), id: 'post-' + ++serial, author_name: 'School Administrator', created_at: '2026-11-03T05:00:00Z', updated_at: '2026-11-03T05:00:00Z' };
        rows.unshift(row);
        return reply([row], 201);
      }
      const row = rows.find(r => r.id === id);
      assert.ok(row);
      if (req.method() === 'PATCH') { Object.assign(row, req.postDataJSON(), { updated_at: '2026-11-03T06:00:00Z' }); return reply([row]); }
      assert.equal(req.method(), 'DELETE');
      rows = rows.filter(r => r.id !== id);
      return reply([row]);
    }
    if (url.origin === origin) return route.continue();
    return route.abort('blockedbyclient');
  });
  await page.goto(`${origin}/#/dashboard`);
  await page.getByRole('heading', { name: 'Announcements', exact: true }).waitFor();
  const board = page.locator('.announcement-board');
  await board.scrollIntoViewIfNeeded();
  return { page, context, board, errors };
}

try {
  const admin = await scenario('admin');
  await admin.board.getByText('No announcements yet', { exact: true }).waitFor();
  await admin.board.getByRole('button', { name: 'Post announcement', exact: true }).click();
  let form = admin.page.locator('.osas-modal-card form');
  await form.getByLabel('Title', { exact: true }).fill('Campus safety reminder');
  await form.getByLabel('Message', { exact: true }).fill('Remember your assembly area.\nFollow your teacher during drills.');
  failSave = true;
  await form.getByRole('button', { name: 'Publish announcement' }).click();
  await form.getByRole('alert').filter({ hasText: 'Please retry publishing' }).waitFor();
  assert.equal(await form.getByLabel('Title', { exact: true }).inputValue(), 'Campus safety reminder');
  failSave = false;
  await form.getByRole('button', { name: 'Publish announcement' }).click();
  await admin.board.getByRole('heading', { name: 'Campus safety reminder', exact: true }).waitFor();
  await admin.page.locator('.osas-modal-overlay').waitFor({ state: 'detached' });
  assert.equal(rows.length, 1);

  const student = await scenario('client');
  await student.board.getByRole('heading', { name: 'Campus safety reminder', exact: true }).waitFor();
  assert.equal(await student.board.getByRole('button').count(), 0);
  assert.equal(await student.page.evaluate(() => {
    const info = document.querySelector('.student-info-grid');
    const board = document.querySelector('.announcement-board');
    return !!info && Boolean(info.compareDocumentPosition(board) & Node.DOCUMENT_POSITION_FOLLOWING);
  }), true, 'Student details must precede announcements');
  const info = student.page.getByRole('region', { name: 'Student information' });
  await info.getByRole('heading', { name: 'Student One', exact: true }).waitFor();
  assert.deepEqual(await info.locator('dt').allTextContents(), ['Student ID', 'Grade']);
  assert.equal(await info.getByText('s260000001', { exact: true }).count(), 1);
  assert.equal(await info.getByText('Not assigned', { exact: true }).count(), 1);
  assert.equal(await student.page.getByRole('heading', { name: 'Adviser', exact: true }).count(), 0);
  assert.equal(await student.page.locator('.dashboard-analytics-grid,.yearly-chart').count(), 0);
  await admin.page.getByRole('heading', { name: 'Incidents by Status', exact: true }).waitFor();
  await admin.page.getByRole('heading', { name: 'Incidents by Year', exact: true }).waitFor();
  assert.equal(await student.page.getByRole('heading', { name: 'Incidents by Type', exact: true }).count(), 0);
  const yearBar = admin.page.locator('.yearly-chart-bar');
  assert.equal(await yearBar.locator('.yearly-chart-value').textContent(), '2');
  assert.ok(await yearBar.evaluate(el => el.getBoundingClientRect().height) > 50, 'A single year must show a visible bar');

  await admin.board.getByRole('button', { name: 'Edit announcement: Campus safety reminder', exact: true }).click();
  form = admin.page.locator('.osas-modal-card form');
  await form.getByLabel('Title', { exact: true }).fill('Updated campus reminder');
  await form.getByLabel('Message', { exact: true }).fill('Bring water.\n<img src=x onerror="window.announcementXss=true">');
  await form.getByRole('button', { name: 'Save changes', exact: true }).click();
  await admin.board.getByRole('heading', { name: 'Updated campus reminder', exact: true }).waitFor();
  await student.page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await student.board.getByRole('heading', { name: 'Updated campus reminder', exact: true }).waitFor();
  assert.equal(await student.board.locator('img').count(), 0);
  assert.equal(await student.page.evaluate(() => window.announcementXss), undefined);
  await student.board.getByText('· Edited', { exact: false }).waitFor();

  // Refresh failure leaves the previously loaded post readable and offers retry.
  failRead = true;
  await student.page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await student.board.getByRole('alert').filter({ hasText: 'unavailable' }).waitFor();
  assert.equal(await student.board.locator('article').count(), 1);
  failRead = false;
  await student.board.getByRole('button', { name: 'Retry announcements' }).click();
  await student.board.getByRole('alert').waitFor({ state: 'hidden' });

  await admin.page.locator('.osas-modal-overlay').waitFor({ state: 'detached' });
  await admin.board.getByRole('button', { name: 'Delete announcement: Updated campus reminder', exact: true }).click();
  await admin.page.locator('.osas-modal-card').getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.equal(rows.length, 1);
  await admin.page.locator('.osas-modal-overlay').waitFor({ state: 'detached' });
  await admin.board.getByRole('button', { name: 'Delete announcement: Updated campus reminder', exact: true }).click();
  await admin.page.locator('.osas-modal-card').getByRole('button', { name: 'Delete announcement', exact: true }).click();
  await admin.board.getByText('No announcements yet', { exact: true }).waitFor();

  // Multiple pages, stable refresh and mobile layout.
  rows = Array.from({ length: 3 }, (_, i) => ({ id: 'page-' + i, title: 'School update ' + (i + 1), body: 'Updates and reminders for students.\nPlease follow school staff instructions.', image_path: ['assets/announcements/long-spookend.jpg', 'assets/announcements/teachers-day.jpg', 'assets/announcements/dance-troupe-auditions.jpg'][i], author_name: 'OSAS Administrator', created_at: '2026-11-03T05:00:00Z', updated_at: '2026-11-03T05:00:00Z' }));
  await student.page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await student.board.getByRole('article', { name: 'School update 1', exact: true }).waitFor();
  assert.equal(await student.board.locator('article').count(), 2);
  for (const image of await student.board.locator('.announcement-poster img').all()) await image.scrollIntoViewIfNeeded();
  await student.page.waitForFunction(() => [...document.querySelectorAll('.announcement-poster img')].every(img => img.complete && img.naturalWidth > 0));
  assert.equal(await student.board.locator('.announcement-author,.announcement-avatar').count(), 0);
  assert.equal(await student.board.locator('h4').count(), 0);
  const posterLayout = await student.board.locator('article').first().evaluate(article => {
    const image = article.querySelector('img').getBoundingClientRect();
    const footer = article.querySelector('.announcement-footer').getBoundingClientRect();
    const link = article.querySelector('.announcement-poster').getBoundingClientRect();
    return { fullWidth: Math.abs(image.width - link.width) < 1, dateBelow: footer.top >= image.bottom };
  });
  assert.deepEqual(posterLayout, { fullWidth: true, dateBelow: true });
  assert.equal(await student.board.locator('.announcement-poster img').evaluateAll(images => images.every(img => img.complete && img.naturalWidth > 0)), true);
  await student.board.getByRole('button', { name: 'Next', exact: true }).click();
  await student.board.getByRole('article', { name: 'School update 3', exact: true }).waitFor();
  assert.equal(await student.board.locator('article').count(), 1);
  assert.equal(await student.board.getByRole('button', { name: 'Next', exact: true }).isEnabled(), false);
  await student.board.getByRole('button', { name: 'Previous', exact: true }).click();
  await student.board.getByRole('article', { name: 'School update 1', exact: true }).waitFor();
  await mkdir('/tmp/osas-announcements', { recursive: true });
  await student.board.locator('.announcement-heading').scrollIntoViewIfNeeded();
  await student.page.screenshot({ path: '/tmp/osas-announcements/student-desktop.png', fullPage: true });
  await student.page.setViewportSize({ width: 390, height: 844 });
  await student.page.waitForFunction(() => document.getElementById('sidebar').getBoundingClientRect().right <= 1);
  await student.board.scrollIntoViewIfNeeded();
  assert.equal(await student.board.evaluate(el => el.scrollWidth <= el.clientWidth), true);
  await student.page.screenshot({ path: '/tmp/osas-announcements/student-mobile.png' });
  await admin.page.goto(`${origin}/#/accounts`);
  await admin.page.getByRole('button', { name: 'Set grade: Student One', exact: true }).click();
  const gradeForm = admin.page.locator('.osas-modal-card form');
  await gradeForm.getByLabel('Grade level').selectOption('10');
  await gradeForm.getByRole('button', { name: 'Save grade', exact: true }).click();
  await admin.page.locator('.osas-modal-overlay').waitFor({ state: 'detached' });
  assert.equal(gradeLevel, 10);
  await student.page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await info.locator('dd').last().filter({ hasText: /^10$/ }).waitFor();
  await info.scrollIntoViewIfNeeded();
  await student.page.screenshot({ path: '/tmp/osas-announcements/student-details-mobile.png' });
  assert.deepEqual(admin.errors, []);
  assert.deepEqual(student.errors, []);
  assert.ok(requests.filter(r => r.role === 'client').every(r => r.method === 'GET'));
  assert.ok(dataRequests.filter(r => r.role === 'client').every(r => ['/rest/v1/student_grades', '/rest/v1/announcements'].includes(r.path)));
  await admin.context.close();
  await student.context.close();
  console.log('Dashboard browser OK: admin-only charts, student name/ID/grade with no adviser, no student analytics requests, admin grade assignment, announcement publishing, two-post pages, posters and mobile layout.');
} finally { await browser.close(); }
