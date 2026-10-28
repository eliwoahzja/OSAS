import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchEveryPage, startDashboardUpdates } from '../js/live-dashboard.js';
import { computeStats } from '../js/dashboard-stats.js';
import { EARTHQUAKE_PREVENTION, earthquakePreventionPlan } from '../js/modules/risk-prevention.js';

test('incident statistics use supplied rows, with zero, one and multiple calendar years', () => {
  const stats = (incidents) => computeStats(incidents, [], [], [], []);
  assert.deepEqual(stats([]).years_by_year, []);
  const one = stats([{ date: '2026-10-29', type: 'medical', status: 'open' }]);
  assert.equal(one.incidents_total, 1);
  assert.deepEqual(one.years_by_year, [{ year: 2026, incidents: 1, byType: { medical: 1 } }]);
  const more = stats([{ date: '2026-10-29', type: 'medical', status: 'open' }, { date: '2025-03-01', type: 'security', status: 'resolved' }, { date: '2026-01-01', type: 'medical', status: 'resolved' }]);
  assert.deepEqual(more.years_by_year.map(r => [r.year, r.incidents]), [[2025, 1], [2026, 2]]);
  assert.deepEqual(more.incident_breakdown, [{ label: 'medical', value: 2 }, { label: 'security', value: 1 }]);
});
test('all incident pages are fetched beyond the API row limit', async () => {
  const dataset = Array.from({ length: 2005 }, (_, id) => ({ id })); const offsets = [];
  const rows = await fetchEveryPage(async (offset, limit) => { offsets.push(offset); return dataset.slice(offset, offset + limit); });
  assert.equal(rows.length, 2005); assert.deepEqual(offsets, [0, 1000, 2000]);
  await assert.rejects(fetchEveryPage(async () => { throw new Error('database unavailable'); }), /database unavailable/);
});
test('dashboard refresh responds to realtime, focus, writes and polling, and cleans up', async () => {
  const win = new EventTarget(); const doc = new EventTarget(); doc.visibilityState = 'visible';
  let tick; let cleared = false; let realtime; let unsubscribed = false; let updates = 0;
  win.setInterval = (fn) => { tick = fn; return 1; }; win.clearInterval = () => { cleared = true; };
  const stop = startDashboardUpdates(async () => { updates++; }, async cb => { realtime = cb; return () => { unsubscribed = true; }; }, { win, doc });
  await new Promise(r => setImmediate(r));
  await realtime(); await tick(); win.dispatchEvent(new Event('focus'));
  await new Promise(r => setImmediate(r));
  win.dispatchEvent(new Event('osas:data-changed')); await new Promise(r => setImmediate(r));
  doc.dispatchEvent(new Event('visibilitychange')); await new Promise(r => setImmediate(r));
  assert.equal(updates, 5); stop(); assert.ok(cleared && unsubscribed);
  win.dispatchEvent(new Event('focus')); await realtime(); assert.equal(updates, 5);
});
test('overlapping dashboard changes queue one follow-up refresh', async () => {
  const win = new EventTarget(); const doc = new EventTarget(); win.setInterval = () => 1; win.clearInterval = () => {};
  let onChange; let resolve; let updates = 0;
  const stop = startDashboardUpdates(async () => { updates++; if (updates === 1) await new Promise(r => { resolve = r; }); }, async cb => { onChange = cb; return () => {}; }, { win, doc });
  await new Promise(r => setImmediate(r));
  const first = onChange(); await onChange(); await onChange(); assert.equal(updates, 1);
  resolve(); await first; await new Promise(r => setImmediate(r)); assert.equal(updates, 2); stop();
});
test('earthquake example includes all ten editable prevention measures', () => {
  assert.equal(EARTHQUAKE_PREVENTION.length, 10);
  const plan = earthquakePreventionPlan();
  assert.match(plan, /qualified engineers/); assert.match(plan, /Duck, Cover, and Hold/); assert.match(plan, /10\./);
});
