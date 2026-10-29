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
    await page.mouse.move(viewport.width / 2, viewport.height / 2);
    await page.mouse.wheel(0, 650);
    await page.waitForFunction(() => window.scrollY > 200);
    const first = await page.evaluate(() => scrollY);
    await page.keyboard.press('PageDown');
    await page.waitForFunction((previous) => scrollY > previous + 100, first);
    if (viewport.width > 900) {
      await page.getByRole('navigation', { name: 'Safety brochure' }).getByRole('link', { name: 'Drills', exact: true }).click();
      await page.waitForFunction(() => document.activeElement?.id === 'safety-drills');
      const drill = await page.locator('#safety-drills').boundingBox();
      assert.ok(drill.y >= 0 && drill.y < viewport.height);
      await page.getByRole('navigation', { name: 'Safety brochure' }).getByRole('link', { name: 'Reminders', exact: true }).click();
      await page.waitForFunction(() => document.activeElement?.id === 'safety-ready');
    }
    await page.evaluate(() => scrollTo(0, 0));
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.getByRole('heading', { name: 'Welcome Back', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Back to safety guide' }).click();
    await page.locator('#login-overlay').waitFor({ state: 'detached' });
    await page.evaluate(() => scrollTo(0, 0));
    await page.mouse.move(viewport.width / 2, viewport.height / 2);
    await page.mouse.wheel(0, 650);
    await page.waitForFunction(() => scrollY > 200);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(errors, []);
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
  console.log('Public scroll OK: desktop and mobile wheel, PageDown, section navigation, sign-in/back, no horizontal overflow, and no-JavaScript fallback.');
} finally {
  await browser.close();
}
