// Every workspace route, main form, role boundary and assistant entry point.
// All Auth/REST/Edge traffic is intercepted; no live users, data or messages change.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { MOCK } from '../js/mock.js';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.TEST_ORIGIN || 'http://localhost:3000';
const backend = 'https://workspace-check.supabase.co';
const userId = '11111111-1111-4111-8111-111111111111';
const publicRoutes = ['dashboard', 'emergency-contacts', 'evacuation-plans', 'incident-logging'];
const adminRoutes = ['parent-notifications', 'drill-scheduling', 'safety-inspections', 'first-aid-supplies', 'risk-assessment', 'safety-reports', 'accounts'];
const actions = {
  'emergency-contacts': /^Add contact$/i,
  'evacuation-plans': /^Upload Floor Plan$/i,
  'incident-logging': /^Report Incident$/i,
  'parent-notifications': /^New Notification$/i,
  'drill-scheduling': /^Schedule Drill$/i,
  'safety-inspections': /Add Room Inspection/i,
  'first-aid-supplies': /^Add supply$/i,
  'risk-assessment': /^New Risk$/i,
  accounts: /^Create account$/i,
};
const browser = await chromium.launch({ executablePath: existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined, headless: true, args: ['--no-sandbox'] });
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    for (const role of ['admin', 'client']) {
      const context = await browser.newContext({ viewport, reducedMotion: 'reduce', hasTouch: viewport.width < 600 });
      const page = await context.newPage();
      const errors = [];
      const calls = [];
      const data = structuredClone(MOCK);
      let heldTable = null, releaseHeld, requestHeld;
      let failNextTable = null;
      data.incidents.unshift({ id: 'own-incident', date: '2026-11-03', created_at: '2026-11-03T05:00:00Z', reporter: 'Workspace Check', submitted_by: userId, description: 'Own report for verification', status: 'open' });
      data.student_grades = [{ user_id: userId, grade_level: 10 }];
      data.announcements = [{ id: 'announcement', title: 'Workspace announcement', body: 'Synthetic school update.', created_at: '2026-11-03T05:00:00Z', updated_at: '2026-11-03T05:00:00Z' }];
      page.on('pageerror', error => errors.push(error.message));
      await context.route('**/*', async route => {
        const request = route.request();
        const url = new URL(request.url());
        const json = body => route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
        if (url.origin === origin && url.pathname === '/js/config.js') return route.fulfill({ contentType: 'text/javascript', body: `window.OSAS={SUPABASE_URL:'${backend}',SUPABASE_ANON_KEY:'test-key',NOTIFY_FN_URL:'${backend}/functions/v1/send-notification'};` });
        if (url.origin === origin && url.pathname === '/js/auth.js') return route.fulfill({ contentType: 'text/javascript', body: `
          let signed=true;const listeners=[];
          const user={id:'${userId}',name:'Workspace Check',email:'check@example.test',role:'${role}',student_id:'s260000001'};
          export const currentUser=()=>signed?user:null;
          export const isAdmin=()=>signed&&user.role==='admin';
          export const isSignedIn=()=>signed;
          export const currentAccessToken=async()=>signed?'test-token':null;
          export const restore=async()=>({provider:'supabase',user});
          export const passwordRecovery=()=>({active:false,error:''});
          export const onAuthChange=fn=>{listeners.push(fn);return()=>{}};
          export const subscribeIncidentChanges=async()=>()=>{};
          export const signOut=async()=>{signed=false;listeners.forEach(fn=>fn(null))};
        ` });
        if (url.origin === backend) {
          calls.push({ path: url.pathname, method: request.method() });
          if (url.pathname === '/functions/v1/agent-chat') {
            assert.equal(role, 'admin', 'Student chatbot must not call administrator AI');
            return json({ reply: 'Workspace assistant verification succeeded.' });
          }
          if (url.pathname === '/functions/v1/manage-accounts') {
            assert.equal(request.postDataJSON().action, 'list');
            return json({ users: [{ id: userId, name: 'Workspace Check', student_id: 's260000001', email: 'check@example.test', role: 'client' }], me: 'other-admin' });
          }
          if (url.pathname === '/functions/v1/password-reset') return json({ requests: [] });
          assert.equal(request.method(), 'GET', 'Workspace navigation/forms must not modify school records');
          assert.ok(url.pathname.startsWith('/rest/v1/'));
          const table = url.pathname.split('/').pop();
          if (heldTable === table) {
            heldTable = null;
            requestHeld?.();
            await new Promise(resolve => { releaseHeld = resolve; });
          }
          if (failNextTable === table) {
            failNextTable = null;
            return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Synthetic connection interruption'})});
          }
          let rows = data[table] || [];
          for (const [key, value] of url.searchParams) {
            if (value.startsWith('eq.')) rows = rows.filter(row => String(row[key]) === value.slice(3));
          }
          if (['notifications', 'emergency_contacts'].includes(table)) rows = rows.map(row => ({ ...row, students: data.students?.find(student => student.id === row.student_id) || null }));
          const offset = Number(url.searchParams.get('offset')) || 0;
          const limit = Number(url.searchParams.get('limit')) || rows.length;
          return json(rows.slice(offset, offset + limit));
        }
        if (url.origin === origin) return route.continue();
        return route.abort('blockedbyclient');
      });
      const openedAt = Date.now();
      await page.goto(`${origin}/#/dashboard`);
      const loadingKind = role === 'admin' ? 'admin-dashboard' : 'student-dashboard';
      await page.locator('.loading-skeleton-' + loadingKind).waitFor();
      assert.equal(await page.locator('.loading-skeleton .loading-charts').count(), role === 'admin' ? 1 : 0);
      assert.equal(await page.locator('.loading-skeleton .loading-profile').count(), role === 'client' ? 1 : 0);
      await page.locator('#view .route-content[aria-busy="false"]').waitFor();
      assert.ok(Date.now() - openedAt >= 2900, 'Dashboard loader must last three seconds');
      await page.waitForFunction(() => document.body.dataset.session === 'active');
      const routes = role === 'admin' ? [...publicRoutes, ...adminRoutes] : publicRoutes;
      assert.equal(await page.locator('#sidebar-nav a').count(), routes.length);
      for (const route of routes) {
        await page.evaluate(next => { location.hash = '#/' + next; }, route);
        await page.waitForFunction(expected => document.body.dataset.route === expected, route);
        await page.waitForLoadState('networkidle');
        await page.locator('#view .route-content[aria-busy="false"]').waitFor();
        await page.waitForFunction(() => {
          const view = document.getElementById('view');
          return view.textContent.trim().length > 20 && !view.querySelector('.animate-pulse');
        });
        const view = page.locator('#view');
        assert.equal(await view.locator('.animate-pulse').count(), 0, route + ' remained loading');
        assert.equal(await view.getByText(/Could not|Permission denied|Request failed|schema is out of date|error loading/i).count(), 0, route + ' failed to load');
        assert.ok((await view.textContent()).trim().length > 20, route + ' is blank');
        if (role !== 'admin') {
          assert.equal(await page.locator('.dashboard-analytics-grid,.yearly-chart').count(), 0);
          assert.equal(await view.getByText(/Private report from someone else/).count(), 0);
        }
        if (route === 'safety-reports') {
          for (const dataset of ['incidents', 'inspections', 'drills', 'supplies']) {
            await view.getByRole('combobox', { name: 'Dataset to export', exact: true }).selectOption(dataset);
            const [download] = await Promise.all([
              page.waitForEvent('download'), view.getByRole('button', { name: 'Export CSV', exact: true }).click(),
            ]);
            assert.ok(download.suggestedFilename().startsWith('osas-' + dataset + '-'));
            assert.equal(await download.failure(), null);
          }
          await page.evaluate(() => { window.print = () => { window.__verificationPrinted = true; }; });
          await view.getByRole('button', { name: 'Print / Save as PDF', exact: true }).click();
          assert.equal(await page.evaluate(() => window.__verificationPrinted), true);
        }
        const action = actions[route];
        const canCreate = role === 'admin' ? route !== 'incident-logging' : route === 'incident-logging';
        if (action && canCreate) {
          await view.getByRole('button', { name: action }).first().click();
          await page.locator('.osas-modal-card').waitFor();
          await page.locator('.osas-modal-loader').waitFor({ state: 'detached' });
          if (route === 'parent-notifications' && !await page.locator('.osas-modal-card input,.osas-modal-card textarea,.osas-modal-card select').count()) {
            await page.locator('.osas-modal-card').getByRole('button', { name: /Event Notice/i }).click();
          }
          assert.ok(await page.locator('.osas-modal-card input,.osas-modal-card textarea,.osas-modal-card select').count(), route + ' action has no fields');
          if (route === 'risk-assessment') {
            await page.locator('.osas-modal-card input').first().fill('Unsaved room hazard');
            await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
            await page.getByRole('dialog', { name: 'Discard unsaved changes?', exact: true })
              .getByRole('button', { name: 'Discard changes', exact: true }).click();
          } else await page.keyboard.press('Escape');
          await page.locator('.osas-modal-overlay').waitFor({ state: 'detached' });
        }
      }
      if (role === 'admin') {
        const held = new Promise(resolve => { requestHeld = resolve; });
        heldTable = 'inspections';
        await page.evaluate(() => { location.hash = '#/safety-inspections'; });
        await held;
        await page.evaluate(() => { location.hash = '#/accounts'; });
        await page.locator('#view .route-content[aria-busy="false"]').waitFor();
        await page.locator('#view').getByRole('columnheader', {name:'Student ID',exact:true}).waitFor();
        releaseHeld();
        await page.waitForLoadState('networkidle');
        assert.equal(await page.locator('#page-title').textContent(), 'Accounts', 'A stale response renamed the new page');
        assert.equal(await page.locator('#view').getByRole('columnheader', {name:'Student ID',exact:true}).count(), 1, 'A stale response replaced Accounts');
        failNextTable = 'inspections';
        await page.evaluate(() => { location.hash = '#/safety-inspections'; });
        await page.locator('#view').getByText('Could not load data',{exact:true}).waitFor();
        assert.equal(await page.locator('#view .animate-pulse').count(),0,'Failure must not leave a loading skeleton');
        await page.locator('#view').getByRole('button',{name:'Retry',exact:true}).click();
        await page.locator('#view').getByRole('button',{name:/Add Room Inspection/i}).waitFor();
        await page.waitForLoadState('networkidle');
      }
      await context.setOffline(true);
      await page.getByRole('status').filter({hasText:'You’re offline.'}).waitFor();
      await context.setOffline(false);
      await page.locator('.connection-notice').waitFor({state:'hidden'});
      if (role !== 'admin') {
        for (const route of adminRoutes) {
          await page.evaluate(next => { location.hash = '#/' + next; }, route);
          await page.waitForFunction(() => document.body.dataset.route === 'dashboard');
          assert.equal(await page.locator('.dashboard-analytics-grid,.yearly-chart').count(), 0);
        }
        assert.ok(calls.every(call => ['/rest/v1/student_grades', '/rest/v1/announcements', '/rest/v1/emergency_contacts', '/rest/v1/evacuation_plans', '/rest/v1/incidents'].includes(call.path)));
      }
      await page.getByRole('button', { name: role === 'admin' ? 'Open OSAS desk' : 'Open Chatbot', exact: true }).click();
      const chat = page.getByRole('dialog', { name: role === 'admin' ? 'OSAS desk' : 'Chatbot', exact: true });
      await chat.getByRole('textbox').fill(role === 'admin' ? 'Verify this synthetic conversation.' : 'Where can I report an incident?');
      await chat.getByRole('button', { name: 'Send message', exact: true }).click();
      if (role === 'admin') await chat.getByText('Workspace assistant verification succeeded.', { exact: true }).waitFor();
      else await chat.locator('.agent-bubble.is-assistant').last().filter({ hasText: /report|incident/i }).waitFor();
      await chat.getByRole('button', { name: 'Close assistant', exact: true }).click();
      if (viewport.width < 600) await page.getByRole('button', { name: 'Open menu', exact: true }).tap();
      await page.locator('#logout-btn').click();
      await page.waitForFunction(() => document.body.dataset.session === 'public');
      await page.locator('#public-safety').waitFor();
      assert.deepEqual(errors, []);
      console.log(`Workspace OK: ${role} ${viewport.width}px, ${routes.length} routes, main forms, access boundaries, assistant and logout.`);
      await context.close();
    }
  }
} finally { await browser.close(); }
