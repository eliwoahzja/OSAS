// Real account UI, mocked auth/Edge Functions. No live accounts are changed.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.TEST_ORIGIN || 'http://localhost:3000';
const backend = 'https://unit-test.supabase.co';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
  headless: true, args: ['--no-sandbox'],
});
const users = [
  { id: 'admin', name: 'Administrator', username: 'school.admin', email: 'administrator@gmail.com', role: 'admin' },
  { id: 'student', name: 'Student One', username: 'student.one', email: 'student@gmail.com', role: 'client' },
];
try {
  const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const writes = [];
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.origin === origin && url.pathname === '/__account_test') {
      return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head>
        <link rel="stylesheet" href="/css/tailwind.css"><link rel="stylesheet" href="/css/osas.css">
        </head><body><main id="view"></main><div id="toast-root"></div>
        <script>window.OSAS={SUPABASE_URL:'${backend}',SUPABASE_ANON_KEY:'test-key',NOTIFY_FN_URL:'${backend}/functions/v1/send-notification'};</script>
        <script type="module">import {accounts} from '/js/modules/accounts.js';await accounts(document.getElementById('view'));</script></body></html>` });
    }
    if (url.origin === origin && url.pathname === '/js/auth.js') {
      return route.fulfill({ contentType: 'text/javascript', body: `export const isAdmin=()=>true;export const currentAccessToken=async()=>'test-token';` });
    }
    if (url.origin === backend) {
      const payload = request.postDataJSON();
      if (url.pathname.endsWith('/password-reset')) return json({ requests: [] });
      assert.ok(url.pathname.endsWith('/manage-accounts'));
      if (payload.action === 'list') return json({ users, me: 'admin' });
      writes.push(payload);
      if (payload.username === 'school.admin') return json({ error: 'Username is already taken.' }, 400);
      if (payload.action === 'update') Object.assign(users.find((user) => user.id === payload.id), payload);
      return json({ user: payload });
    }
    if (url.origin === origin) return route.continue();
    return route.abort('blockedbyclient');
  });
  await page.goto(`${origin}/__account_test`);
  await page.getByRole('cell', { name: 'student.one', exact: true }).waitFor();
  assert.equal(await page.getByRole('columnheader', { name: 'Username', exact: true }).count(), 1);
  const row = page.getByRole('row').filter({ has: page.getByRole('cell', { name: 'student.one', exact: true }) });
  await row.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.locator('.osas-modal-loader').waitFor({ state: 'detached' });
  const modal = page.locator('.osas-modal-card');
  assert.equal(await modal.getByLabel('Username', { exact: true }).inputValue(), 'student.one');
  assert.equal(await modal.getByLabel('Email', { exact: true }).inputValue(), 'student@gmail.com');
  await modal.getByLabel('Username', { exact: true }).fill('school.admin');
  await modal.getByRole('button', { name: 'Save changes', exact: true }).click();
  await modal.getByText('Username is already taken.', { exact: true }).waitFor();
  await modal.getByLabel('Username', { exact: true }).fill('student.renamed');
  await modal.getByRole('button', { name: 'Save changes', exact: true }).click();
  await modal.waitFor({ state: 'detached' });
  await page.getByRole('cell', { name: 'student.renamed', exact: true }).waitFor();
  assert.equal(writes.at(-1).email, 'student@gmail.com', 'Changing a username must not change the code delivery email');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.locator('.osas-modal-loader').waitFor({ state: 'detached' });
  assert.equal(await modal.getByLabel('Username', { exact: true }).count(), 1);
  assert.equal(await modal.getByLabel('Email', { exact: true }).getAttribute('type'), 'email');
  assert.deepEqual(errors, []);
  await context.close();
  console.log('Account UI OK: stored usernames, separate username/email fields, duplicate error, and rename without changing the mailbox.');
} finally {
  await browser.close();
}
