// Requires a running local server and Playwright. All external requests are blocked.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.TEST_ORIGIN || 'http://localhost:3000';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
  args: ['--no-sandbox'], headless: true,
});

try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    await context.route('https://**/*', (route) => route.abort());
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(origin);
    await page.locator('#public-safety').waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.mouse.move(viewport.width / 2, viewport.height / 2);
    await page.mouse.wheel(0, 650);
    await page.waitForFunction(() => window.scrollY > 200);
    const first = await page.evaluate(() => scrollY);
    await page.keyboard.press('PageDown');
    await page.waitForFunction((previous) => scrollY > previous + 100, first);
    if (viewport.width > 900) {
      await page.getByRole('navigation', { name: 'Safety brochure' }).getByRole('link', { name: 'Drills', exact: true }).click();
      await page.waitForFunction(() => document.activeElement?.id === 'safety-drills');
      await page.waitForFunction(() => {
        const { top } = document.getElementById('safety-drills').getBoundingClientRect();
        return top >= 0 && top < innerHeight;
      });
      await page.getByRole('navigation', { name: 'Safety brochure' }).getByRole('link', { name: 'Reminders', exact: true }).click();
      await page.waitForFunction(() => document.activeElement?.id === 'safety-ready');
    }
    await page.evaluate(() => scrollTo(0, 0));
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.getByRole('heading', { name: 'Welcome Back', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).overflowY), 'hidden');
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).overflowY), 'hidden');
    assert.equal(await page.evaluate(() => innerWidth - document.documentElement.clientWidth), 0, 'The background document must not have a second scrollbar');
    assert.equal(await page.locator('#login-overlay').evaluate((el) => getComputedStyle(el).overflowY), 'auto');
    if (viewport.width < 900) {
      const login = page.locator('#login-overlay');
      await login.evaluate((el) => { el.scrollTop = el.scrollHeight; });
      const submit = await page.getByRole('button', { name: 'Sign In', exact: true }).boundingBox();
      assert.ok(submit.y >= 0 && submit.y + submit.height <= viewport.height, 'The mobile login button must be reachable');
      await login.evaluate((el) => { el.scrollTop = 0; });
    }
    await page.getByRole('button', { name: 'Back to safety guide' }).click();
    await page.locator('#login-overlay').waitFor({ state: 'detached' });
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('lg-open')), false);
    await page.evaluate(() => scrollTo(0, 0));
    await page.mouse.move(viewport.width / 2, viewport.height / 2);
    await page.mouse.wheel(0, 650);
    await page.waitForFunction(() => scrollY > 200);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(errors, []);
    await context.close();
  }
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, reducedMotion: 'no-preference' });
    await context.route('https://**/*', (route) => route.abort());
    const page = await context.newPage();
    await page.goto(origin);
    await page.locator('#public-safety').waitFor();
    assert.equal(await page.locator('.safety-hero h1').evaluate((el) => getComputedStyle(el).animationName), 'safety-lift');
    const panel = page.locator('.safety-guide-panel');
    assert.equal(await panel.evaluate((el) => el.classList.contains('is-revealed')), false);
    await panel.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.safety-guide-panel')).opacity === '1');
    assert.equal(await panel.evaluate((el) => el.classList.contains('is-revealed')), true);
    const reminder = page.locator('.safety-reminder-sheet');
    await reminder.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.safety-reminder-sheet')).opacity === '1');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await page.locator('.safety-hero h1').evaluate((el) => getComputedStyle(el).animationName), 'none');
    assert.equal(await page.locator('[data-reveal]').evaluateAll((items) => items.every((el) => getComputedStyle(el).opacity === '1')), true);
    await context.close();
  }
  const fallback = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
  const page = await fallback.newPage();
  await page.goto(origin);
  await page.locator('.safety-fallback').waitFor();
  await page.mouse.move(700, 500);
  await page.mouse.wheel(0, 650);
  // Use a keyboard action to flush wheel rendering without relying on page JavaScript.
  await page.keyboard.press('PageDown');
  await page.waitForFunction(() => scrollY > 200);
  await fallback.close();
  console.log('Public page OK: desktop/mobile scroll, navigation, initial and scroll animations, reduced motion, login single-scrollbar/back, reachable mobile submit, no horizontal overflow, and no-JavaScript fallback.');
} finally {
  await browser.close();
}
