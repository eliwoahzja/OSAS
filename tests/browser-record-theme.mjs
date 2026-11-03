// Actual record pages with intercepted REST/storage; never changes school data.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import { MOCK } from '../js/mock.js';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.TEST_ORIGIN || 'http://localhost:3000';
const backend = 'https://record-theme-check.supabase.co';
const shots = process.env.SCREENSHOT_DIR;
if (shots) mkdirSync(shots, { recursive: true });
const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=', 'base64');
const browser = await chromium.launch({ executablePath: existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined, args: ['--no-sandbox'] });
try {
  for (const width of [1440, 980, 390]) for (const role of ['admin', 'client']) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: width < 1000, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [], mutations = [], uploads = [];
    const data = structuredClone(MOCK);
    data.evacuation_plans[0].file_url = origin + '/test-floor.png';
    data.evacuation_plans.push({ ...data.evacuation_plans[1], id: 'pdf-plan', building: 'Library', file_url: origin + '/test-floor.pdf?version=1' });
    let failEdit = false, failDelete = false;
    page.on('pageerror', error => errors.push(error.message));
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
      if (url.origin === origin && url.pathname === '/__record_theme_test') return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
        ${['tailwind','fa.min','osas','agent','hallmark/tokens','hallmark/surfaces','hallmark/motion','hallmark/loading','hallmark/feedback'].map(name => `<link rel="stylesheet" href="/css/${name}.css">`).join('')}
        </head><body><main id="dashboard-shell" style="padding:24px"><div id="view"></div></main><div id="toast-root" class="fixed bottom-6 right-6 z-[70]"></div>
        <script>window.OSAS={SUPABASE_URL:'${backend}',SUPABASE_ANON_KEY:'test-key'};</script>
        <script type="module">import {evacuationPlans} from '/js/modules/drills.js';import {safetyInspections,firstAidSupplies} from '/js/modules/inspections.js';import {showRiskExplanationModal} from '/js/modules/risk-rationale.js';
        window.renderPage=async name=>{await ({plans:evacuationPlans,inspections:safetyInspections,supplies:firstAidSupplies})[name](document.getElementById('view'));};
        window.showRisk=legacy=>showRiskExplanationModal(legacy?{hazard:'Legacy room hazard',likelihood:'Medium',impact:'High',risk_level:'High'}:{hazard:'Earthquake',threat:5,vulnerability:5,exploit_likelihood:5,exploit_impact:4,asset_value:5,security_controls:5,risk_score:2495,risk_level:'Critical'});
        await window.renderPage('plans');window.ready=true;</script></body></html>` });
      if (url.origin === origin && url.pathname === '/js/auth.js') return route.fulfill({ contentType: 'text/javascript', body: `export const currentUser=()=>({id:'record-check',name:'Record Check',role:'${role}'});export const isAdmin=()=>${role === 'admin'};export const isSignedIn=()=>true;export const currentAccessToken=async()=>'test-token';` });
      if (url.origin === origin && url.pathname === '/test-floor.png') return route.fulfill({ contentType: 'image/png', body: image });
      if (url.origin === backend) {
        if (url.pathname.startsWith('/storage/v1/object/')) {
          assert.equal(role, 'admin');assert.equal(request.method(), 'POST');uploads.push(url.pathname);return json({ Key: 'test-plan' });
        }
        assert.ok(url.pathname.startsWith('/rest/v1/'));
        const table = url.pathname.split('/').pop();
        if (request.method() === 'GET') return json(data[table] || []);
        assert.equal(role, 'admin');assert.equal(table, 'evacuation_plans');
        const id = url.searchParams.get('id')?.slice(3);
        if (request.method() === 'PATCH') {
          if (failEdit) { failEdit = false;return json({ message: 'Synthetic edit failure' }, 503); }
          const payload = request.postDataJSON();mutations.push({ method: 'PATCH', id, payload });
          const record = data[table].find(row => row.id === id);Object.assign(record, payload);return json([record]);
        }
        if (request.method() === 'DELETE') {
          if (failDelete) { failDelete = false;return json({ message: 'Synthetic removal failure' }, 503); }
          const record = data[table].find(row => row.id === id);data[table] = data[table].filter(row => row.id !== id);mutations.push({ method: 'DELETE', id });return json([record]);
        }
        assert.equal(request.method(), 'POST');const payload = request.postDataJSON();const record = { id: 'new-plan', ...payload };data[table].push(record);mutations.push({ method: 'POST', payload });return json([record]);
      }
      if (url.origin === origin) return route.continue();
      return route.abort();
    });
    await page.goto(origin + '/__record_theme_test');await page.waitForFunction(() => window.ready);
    const view = page.locator('#view');
    const row = name => view.locator('tbody tr').filter({ hasText: name });
    const settledDialog = async () => { await page.locator('.osas-modal-card').waitFor();await page.locator('.osas-modal-loader').waitFor({ state: 'detached' });return page.locator('.osas-modal-card'); };
    const close = async dialog => { await dialog.getByRole('button', { name: 'Close', exact: true }).click();await page.locator('.osas-modal-overlay').waitFor({ state: 'detached' }); };
    assert.equal(await view.locator('.table-scroll-hint').count(), 0);
    await row('Main Building').locator('td').first().click();assert.equal(await page.getByRole('dialog').count(), 0, 'Rows must not open hidden actions');
    await row('Main Building').getByRole('button', { name: 'View details', exact: true }).click();
    let dialog = await settledDialog();
    assert.equal(await dialog.locator('.material-symbols-rounded').count(), 0);
    assert.notEqual(await dialog.locator('.fa-map').evaluate(el => getComputedStyle(el, '::before').content), 'none');
    assert.equal(await dialog.locator('img').getAttribute('src'), origin + '/test-floor.png');await close(dialog);
    await row('Library').getByRole('button', { name: 'View details', exact: true }).click();dialog = await settledDialog();
    assert.equal(await dialog.locator('.fa-file-pdf').count(), 1);assert.equal(await dialog.getByRole('link').getAttribute('href'), origin + '/test-floor.pdf?version=1');await close(dialog);
    if (role === 'client') {
      assert.equal(await view.getByRole('button', { name: /Edit record|Remove record|Upload Floor Plan/ }).count(), 0);
      assert.deepEqual(mutations, []);assert.deepEqual(uploads, []);assert.deepEqual(errors, []);
      console.log(`Records OK student ${width}px: explicit View, working map/PDF icons, no edit/remove/upload actions.`);await context.close();continue;
    }
    const actionStyle = await row('Main Building').getByRole('button', { name: 'View details', exact: true }).evaluate(el => { const s = getComputedStyle(el);return [s.backgroundColor,s.borderColor,s.borderWidth,s.borderRadius,s.boxShadow]; });
    await row('Main Building').getByRole('button', { name: 'Edit record', exact: true }).click();dialog = await settledDialog();
    assert.equal(await dialog.getByLabel('Building', { exact: true }).inputValue(), 'Main Building');
    await dialog.getByLabel('Building', { exact: true }).fill('Updated Main Building');await dialog.getByLabel('Version', { exact: true }).fill('v3.2');await dialog.getByLabel('Status', { exact: true }).selectOption('archived');
    await dialog.getByRole('button', { name: 'Save changes', exact: true }).click();await page.locator('.osas-modal-overlay').waitFor({ state: 'detached' });await row('Updated Main Building').waitFor();
    assert.equal(mutations[0].id, 'EP-01');assert.equal(mutations[0].payload.file_url, origin + '/test-floor.png');assert.equal(mutations[0].payload.version, 'v3.2');assert.equal(mutations[0].payload.current, false);assert.equal(uploads.length, 0);
    failEdit = true;await row('Updated Main Building').getByRole('button', { name: 'Edit record', exact: true }).click();dialog = await settledDialog();
    await dialog.getByRole('button', { name: 'Save changes', exact: true }).click();await dialog.getByRole('alert').filter({ hasText: 'Synthetic edit failure' }).waitFor();
    assert.equal(await dialog.getByRole('button', { name: 'Save changes', exact: true }).isEnabled(), true);assert.equal(mutations.length, 1);
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();await page.locator('.osas-modal-overlay').waitFor({ state: 'detached' });
    await row('Science Wing').getByRole('button', { name: 'Edit record', exact: true }).click();dialog = await settledDialog();
    await dialog.locator('input[type="file"]').setInputFiles({ name: 'replacement.png', mimeType: 'image/png', buffer: image });await dialog.getByRole('button', { name: 'Save changes', exact: true }).click();await page.locator('.osas-modal-overlay').waitFor({ state: 'detached' });
    assert.equal(uploads.length, 1);assert.match(uploads[0], /\.png$/);assert.match(mutations[1].payload.file_url, /\/storage\/v1\/object\/public\/evacuation-maps\/.+\.png$/);
    await row('Updated Main Building').getByRole('button', { name: 'Remove record', exact: true }).click();dialog = await settledDialog();
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();await page.locator('.osas-modal-overlay').waitFor({ state: 'detached' });assert.equal(mutations.length, 2);
    failDelete = true;await row('Updated Main Building').getByRole('button', { name: 'Remove record', exact: true }).click();dialog = await settledDialog();
    await dialog.getByRole('button', { name: 'Remove floor plan', exact: true }).click();await dialog.getByRole('alert').filter({ hasText: 'Synthetic removal failure' }).waitFor();
    await dialog.getByRole('button', { name: 'Remove floor plan', exact: true }).click();await page.locator('.osas-modal-overlay').waitFor({ state: 'detached' });await row('Updated Main Building').waitFor({ state: 'detached' });
    assert.deepEqual(mutations.at(-1), { method: 'DELETE', id: 'EP-01' });
    await view.getByRole('button', { name: 'Upload Floor Plan', exact: true }).click();dialog = await settledDialog();
    await dialog.getByLabel('Building', { exact: true }).fill('New School Wing');await dialog.getByLabel('Floor', { exact: true }).fill('Ground Floor');await dialog.getByRole('button', { name: 'Upload Plan', exact: true }).click();await page.locator('.osas-modal-overlay').waitFor({ state: 'detached' });await row('New School Wing').waitFor();assert.equal(mutations.at(-1).method, 'POST');
    await page.evaluate(() => document.querySelectorAll('.osas-toast-dismiss').forEach(button => button.click()));
    await page.waitForFunction(() => !document.querySelector('.osas-toast'));
    for (const name of ['inspections','supplies']) {
      await page.evaluate(name => window.renderPage(name), name);await view.locator('tbody tr').first().waitFor();
      assert.equal(await view.locator('.table-scroll-hint').count(), 0);
      const button = view.getByRole('button', { name: 'View details', exact: true }).first();await button.scrollIntoViewIfNeeded();
      assert.equal(await button.innerText(), 'View');
      assert.deepEqual(await button.evaluate(el => { const s = getComputedStyle(el);return [s.backgroundColor,s.borderColor,s.borderWidth,s.borderRadius,s.boxShadow]; }), actionStyle);
      assert.equal(await view.locator('.workspace-actions-column').evaluate(el => getComputedStyle(el).backgroundColor), await view.locator('thead').evaluate(el => getComputedStyle(el).backgroundColor));
      await view.locator('.data-table-scroll').evaluate(el => { el.scrollLeft = el.scrollWidth; });
      if (shots) await page.screenshot({ path: `${shots}/${name}-${width}.png` });
    }
    await page.evaluate(() => window.showRisk(false));dialog = await settledDialog();
    assert.equal(await dialog.locator('.risk-factor').count(), 6);assert.match(await dialog.locator('.risk-calculation').textContent(), /Risk Score = 2495/);assert.match(await dialog.locator('.risk-band.is-current').textContent(), /Critical/);
    assert.equal(await dialog.locator('.risk-calculation').evaluate(el => el.scrollWidth <= el.clientWidth + 1), true, 'Formula must wrap without clipping');
    assert.equal(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1), true);
    assert.equal(await dialog.locator('.risk-calculation').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(246, 238, 227)');
    assert.notEqual(await dialog.locator('.risk-calculation').evaluate(el => getComputedStyle(el).boxShadow), 'none');
    if (shots) await page.screenshot({ path: `${shots}/risk-${width}.png` });await close(dialog);
    await page.evaluate(() => window.showRisk(true));dialog = await settledDialog();assert.equal(await dialog.locator('.risk-qualitative').count(), 1);await close(dialog);
    assert.deepEqual(errors, []);console.log(`Records OK admin ${width}px: View/Edit/Remove, file retention/replacement, failure/retry/cancel, shared actions/header and wrapping risk calculation.`);
    await context.close();
  }
} finally { await browser.close(); }
