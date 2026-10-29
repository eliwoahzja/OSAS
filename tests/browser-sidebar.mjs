// Real app/sidebar and route CSS; Auth and backend traffic are mocked.
// Run against a local server with Playwright and optionally CHROMIUM_PATH.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.TEST_ORIGIN || 'http://localhost:3000';
const backend = 'https://unit-test.supabase.co';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
  headless: true, args: ['--no-sandbox'],
});
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin === origin && url.pathname === '/js/config.js') {
        return route.fulfill({ contentType: 'text/javascript', body: `window.OSAS={SUPABASE_URL:'${backend}',SUPABASE_ANON_KEY:'test-key',PIN_ACCOUNTS:{}};` });
      }
      if (url.origin === origin && url.pathname === '/js/auth.js') {
        return route.fulfill({ contentType: 'text/javascript', body: `
          const user={id:'admin',name:'Test Administrator',email:'admin@example.test',role:'admin'};
          export const currentUser=()=>user;
          export const isAdmin=()=>true;
          export const isSignedIn=()=>true;
          export const restore=async()=>({user});
          export const passwordRecovery=()=>({active:false,error:''});
          export const currentAccessToken=async()=>'test-token';
          export const subscribeIncidentChanges=async()=>()=>{};
        ` });
      }
      if (url.origin === backend) {
        assert.equal(route.request().method(), 'GET', 'Sidebar navigation must not write data');
        return route.fulfill({ contentType: 'application/json', body: '[]' });
      }
      if (url.origin === origin) return route.continue();
      return route.abort('blockedbyclient');
    });
    await page.goto(`${origin}/#/emergency-contacts`);
    await page.waitForFunction(() => document.body.dataset.route === 'emergency-contacts');
    await page.evaluate(() => document.fonts.ready);
    const measure = () => page.evaluate(() => ({
      width: document.getElementById('sidebar').getBoundingClientRect().width,
      links: [...document.querySelectorAll('#sidebar-nav a')].map((link) => {
        const style = getComputedStyle(link);
        return {
          href: link.getAttribute('href'), width: link.getBoundingClientRect().width,
          height: link.getBoundingClientRect().height, paddingTop: style.paddingTop,
          paddingBottom: style.paddingBottom, fontSize: getComputedStyle(link.querySelector('span')).fontSize,
        };
      }),
    }));
    const baseline = await measure();
    assert.equal(baseline.width, 288);
    for (const route of ['first-aid-supplies', 'safety-inspections', 'emergency-contacts', 'safety-inspections']) {
      if (viewport.width < 1024) await page.getByRole('button', { name: 'Open menu', exact: true }).click();
      await page.locator(`#sidebar-nav a[href="#/${route}"]`).click();
      await page.waitForFunction((expected) => document.body.dataset.route === expected, route);
      // Highlight transitions change color/weight only, not the sidebar geometry.
      assert.deepEqual(await measure(), baseline, `Sidebar geometry changed on ${route} at ${viewport.width}px`);
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log('Sidebar OK: width, every button size, padding, and label font remain unchanged across Supplies, Inspections, and Contacts on desktop/tablet/mobile.');
} finally { await browser.close(); }
