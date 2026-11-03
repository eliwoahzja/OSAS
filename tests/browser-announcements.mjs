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

async function scenario(role) {
  const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await context.route('**/*', async route => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.origin === origin && url.pathname === '/js/config.js') return route.fulfill({ contentType: 'text/javascript', body: `window.OSAS={SUPABASE_URL:'${backend}',SUPABASE_ANON_KEY:'test-key'};` });
    if (url.origin === origin && url.pathname === '/js/auth.js') return route.fulfill({ contentType: 'text/javascript', body: `
      const user={id:'11111111-1111-4111-8111-111111111111',name:'School Administrator',role:'${role}',email:'admin@example.test',student_id:'s260000001'};
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
  await page.getByRole('heading', { name: 'Announcement board', exact: true }).waitFor();
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
    const charts = document.querySelector('.dashboard-analytics-grid');
    const board = document.querySelector('.announcement-board');
    return !!charts && Boolean(charts.compareDocumentPosition(board) & Node.DOCUMENT_POSITION_FOLLOWING);
  }), true, 'The board must follow the student graphs');

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
  rows = Array.from({ length: 12 }, (_, i) => ({ id: 'page-' + i, title: 'School update ' + (i + 1), body: 'Updates and reminders for students.\nPlease follow school staff instructions.', author_name: 'OSAS Administrator', created_at: '2026-11-03T05:00:00Z', updated_at: '2026-11-03T05:00:00Z' }));
  await student.page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await student.board.getByRole('heading', { name: 'School update 1', exact: true }).waitFor();
  assert.equal(await student.board.locator('article').count(), 10);
  await student.board.getByRole('button', { name: 'Next', exact: true }).click();
  await student.board.getByRole('heading', { name: 'School update 11', exact: true }).waitFor();
  assert.equal(await student.board.locator('article').count(), 2);
  await student.board.getByRole('button', { name: 'Previous', exact: true }).click();
  await student.board.getByRole('heading', { name: 'School update 1', exact: true }).waitFor();
  await mkdir('/tmp/osas-announcements', { recursive: true });
  await student.page.screenshot({ path: '/tmp/osas-announcements/student-desktop.png', fullPage: true });
  await student.page.setViewportSize({ width: 390, height: 844 });
  await student.page.waitForFunction(() => document.getElementById('sidebar').getBoundingClientRect().right <= 1);
  await student.board.scrollIntoViewIfNeeded();
  assert.equal(await student.board.evaluate(el => el.scrollWidth <= el.clientWidth), true);
  await student.page.screenshot({ path: '/tmp/osas-announcements/student-mobile.png' });
  assert.deepEqual(admin.errors, []);
  assert.deepEqual(student.errors, []);
  assert.ok(requests.filter(r => r.role === 'client').every(r => r.method === 'GET'));
  await admin.context.close();
  await student.context.close();
  console.log('Announcements browser OK: below student graphs, admin publish/edit/delete, save retry, read-only students, refresh/retry, text safety, pagination and mobile layout.');
} finally { await browser.close(); }
