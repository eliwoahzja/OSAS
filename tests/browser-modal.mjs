// Shared popup keyboard, stacking and viewport behavior. No live services used.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.TEST_ORIGIN || 'http://localhost:3000';
const browser = await chromium.launch({ executablePath: existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined, args: ['--no-sandbox'] });
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce', hasTouch: viewport.width < 900 });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname !== '/__modal_test') return route.continue();
      return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head>
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <link rel="stylesheet" href="/css/tailwind.css"><link rel="stylesheet" href="/css/osas.css">
        <link rel="stylesheet" href="/css/hallmark/tokens.css"><link rel="stylesheet" href="/css/hallmark/surfaces.css"><link rel="stylesheet" href="/css/hallmark/motion.css"><link rel="stylesheet" href="/css/hallmark/loading.css">
        </head><body><aside id="sidebar" inert>Already unavailable</aside><main id="dashboard-shell"><button id="open">Open form</button></main>
        <script type="module">
          import {h, openModal, inputCls} from '/js/ui.js';
          window.popup = () => {
            const form=h('form',{class:'p-6 space-y-4'},h('h3',{},'Example form'),
              h('input',{class:inputCls,'aria-label':'Name'}));
            const nested=h('button',{type:'button',class:'btn-ghost'},'Open confirmation');
            const save=h('button',{type:'button',class:'btn-primary'},'Save changes');
            form.append(nested,save);
            window.mainModal=openModal(form);
            nested.onclick=()=>{window.nestedModal=openModal(h('div',{class:'p-6 space-y-4'},h('h3',{},'Confirm changes'),h('button',{class:'btn-primary',type:'button'},'Confirm')));};
          };
          document.getElementById('open').onclick=window.popup;
          window.openLong=()=>window.mainModal=openModal(h('div',{class:'p-6 space-y-4'},h('h3',{},'Long report'),
            ...Array.from({length:40},(_,i)=>h('p',{},'Report detail '+i)),h('button',{type:'button',class:'btn-ghost',onclick:()=>window.mainModal.close()},'Close report')));
          window.modalReady=true;
        </script></body></html>` });
    });
    await page.goto(origin + '/__modal_test');
    await page.waitForFunction(() => window.modalReady);
    const trigger = page.getByRole('button', { name: 'Open form', exact: true });
    const openedAt = Date.now();
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Example form', exact: true });
    await dialog.waitFor();
    assert.equal(await page.locator('.osas-modal-loader').count(), 1, 'Popups must show the requested loading skeleton');
    await page.locator('.osas-modal-loader').waitFor({state:'detached'});
    assert.ok(Date.now()-openedAt >= 2900, 'Popup skeleton must last three seconds');
    assert.equal(await page.locator('#dashboard-shell').evaluate(el => el.inert), true);
    assert.equal(await dialog.evaluate(el => el.contains(document.activeElement)), true);
    await dialog.getByRole('button', { name: 'Save changes', exact: true }).focus();
    await page.keyboard.press('Tab');
    assert.equal(await dialog.getByRole('button', { name: 'Close dialog', exact: true }).evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('Tab');
    assert.equal(await page.getByRole('textbox', { name: 'Name', exact: true }).evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await dialog.getByRole('button', { name: 'Save changes', exact: true }).evaluate(el => el === document.activeElement), true);
    await dialog.getByRole('button', { name: 'Open confirmation', exact: true }).click();
    const nested = page.getByRole('dialog', { name: 'Confirm changes', exact: true });
    await nested.waitFor();
    assert.equal(await page.locator('.osas-modal-card').first().evaluate(el => el.inert), true);
    await page.keyboard.press('Escape');
    await nested.waitFor({ state: 'detached' });
    assert.equal(await page.locator('.osas-modal-card').count(), 1, 'Escape must close only the top popup');
    assert.equal(await dialog.getByRole('button', { name: 'Open confirmation', exact: true }).evaluate(el => el === document.activeElement), true);
    await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill('Unsaved draft');
    await page.keyboard.press('Escape');
    const discard = page.getByRole('dialog', { name: 'Discard unsaved changes?', exact: true });
    await discard.getByRole('button', { name: 'Keep editing', exact: true }).click();
    assert.equal(await dialog.getByRole('textbox', { name: 'Name', exact: true }).inputValue(), 'Unsaved draft');
    await dialog.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await discard.getByRole('button', { name: 'Discard changes', exact: true }).click();
    assert.equal(await page.locator('.osas-modal-overlay').count(), 0);
    assert.equal(await trigger.evaluate(el => el === document.activeElement), true);
    assert.equal(await page.locator('#dashboard-shell').evaluate(el => el.inert), false);
    assert.equal(await page.locator('#sidebar').evaluate(el => el.inert), true, 'Preexisting inert state must survive');
    await trigger.click();
    await page.locator('.osas-modal-overlay.active').waitFor();
    await page.locator('.osas-modal-overlay').click({ position: { x: 2, y: 2 } });
    assert.equal(await page.locator('.osas-modal-overlay').count(), 0);
    await page.evaluate(() => window.openLong());
    const long = page.getByRole('dialog', { name: 'Long report', exact: true });
    await long.waitFor();
    const dimensions = await long.evaluate(el => { const box=el.getBoundingClientRect();return {top:box.top,bottom:box.bottom,height:innerHeight,scrollable:el.scrollHeight>el.clientHeight,shadow:getComputedStyle(el).boxShadow}; });
    assert.ok(dimensions.top >= 0 && dimensions.bottom <= dimensions.height, 'Long popup must stay inside the viewport');
    assert.equal(dimensions.scrollable, true);
    assert.notEqual(dimensions.shadow, 'none');
    await long.getByRole('button', { name: 'Close report', exact: true }).scrollIntoViewIfNeeded();
    await long.getByRole('button', { name: 'Close report', exact: true }).click();
    assert.equal(await page.locator('.osas-modal-overlay').count(), 0);
    assert.equal(await page.locator('html').evaluate(el => el.classList.contains('osas-dialog-open')), false);
    if (viewport.width === 1440) {
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await trigger.click();
      await page.locator('.osas-modal-overlay.active').waitFor();
      assert.equal(await page.locator('.osas-modal-card').evaluate(el => el.getAnimations().length > 0), true);
      // Dismiss during entrance, then reopen immediately. Animation must not lock input.
      await page.keyboard.press('Escape');
      await page.evaluate(() => window.popup());
      await page.waitForFunction(() => document.querySelectorAll('.osas-modal-overlay').length === 1);
      await page.getByRole('dialog', { name: 'Example form', exact: true }).waitFor();
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('.osas-modal-overlay'));
    }
    assert.deepEqual(errors, []);
    console.log('Popup OK: ' + viewport.width + 'px, focus loop/restoration, stacked Escape, backdrop, scroll and preserved inert state.');
    await context.close();
  }
} finally { await browser.close(); }
