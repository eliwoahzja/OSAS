// Run against a local server. All Auth and school-data requests are intercepted.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.TEST_ORIGIN || 'http://localhost:3000';
const backend = 'https://navigation-test.supabase.co';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
  args: ['--no-sandbox'], headless: true,
});

try {
  for (const role of ['admin', 'client']) {
    const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const requests = [];
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await context.route('**/*', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin === origin && url.pathname === '/js/config.js') {
        return route.fulfill({ contentType: 'text/javascript', body: `window.OSAS = { SUPABASE_URL: '${backend}', SUPABASE_ANON_KEY: 'test-key' };` });
      }
      if (url.origin === origin && url.pathname === '/js/auth.js') {
        return route.fulfill({ contentType: 'text/javascript', body: `
          const user = { id: '11111111-1111-4111-8111-111111111111', name: 'Navigation Test', email: 'navigation@example.test', role: '${role}', student_id: 's260000001' };
          const session = { provider: 'supabase', user, access_token: 'test-access' };
          export const currentUser = () => user;
          export const isAdmin = () => user.role === 'admin';
          export const currentAccessToken = async () => 'test-access';
          export const subscribeIncidentChanges = async () => () => {};
          export const isSignedIn = () => true;
          export const getSession = () => session;
          export const hasRealSession = () => true;
          export const restore = async () => session;
          export const passwordRecovery = () => ({ active: false, error: '' });
          export const onAuthChange = () => () => {};
        ` });
      }
      if (url.origin === backend) {
        assert.equal(request.method(), 'GET', 'Navigation checks must not write school data');
        requests.push(url.pathname);
        return route.fulfill({ contentType: 'application/json', body: '[]' });
      }
      if (url.origin === origin) return route.continue();
      return route.abort('blockedbyclient');
    });

    await page.goto(`${origin}/#/dashboard`);
    await page.waitForFunction(() => document.body.dataset.session === 'active');
    await page.locator('#page-title').filter({ hasText: /^Dashboard$/ }).waitFor();
    assert.equal(await page.locator('#sidebar-nav a[href="#/emergency-roles"]').count(), 0);
    assert.equal(await page.getByRole('link', { name: 'Emergency Roles', exact: true }).count(), 0);
    assert.equal(await page.locator('#sidebar-nav a[href="#/emergency-contacts"]').count(), 1);
    assert.equal(await page.evaluate(async () => 'emergencyRoles' in await import('/js/modules.js')), false);
    assert.equal(await page.evaluate(async () => typeof (await import('/js/modules.js')).emergencyContacts), 'function');

    await page.evaluate(() => { location.hash = '#/emergency-roles'; });
    await page.waitForFunction(() => location.hash === '#/dashboard' && document.body.dataset.route === 'dashboard');
    await page.goto(`${origin}/#/emergency-roles`);
    await page.waitForFunction(() => location.hash === '#/dashboard' && document.body.dataset.route === 'dashboard');
    await page.locator('#page-title').filter({ hasText: /^Dashboard$/ }).waitFor();
    assert.equal(requests.includes('/rest/v1/emergency_roles'), false);
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log('Navigation OK: Emergency Roles absent for students and admins, removed module export, direct/changed hash routes return to dashboard, Emergency Contacts preserved, no role data fetched.');
} finally {
  await browser.close();
}
