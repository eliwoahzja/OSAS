import test from 'node:test';
import assert from 'node:assert/strict';
import { csvCell, incidentReportRows, REPORT_DATASETS, reportColumnLabel } from '../js/report-format.js';
test('CSV treats formula-like strings as text including whitespace and control prefixes', () => {
  for (const value of ['=1+1', '  =1+1', '\n@SUM(1)', '\t+1', '-cmd', '\ufeff=1']) assert.ok(csvCell(value).startsWith('"\''));
  assert.equal(csvCell(-3), '"-3"');
  assert.equal(csvCell('Room "A", upstairs'), '"Room ""A"", upstairs"');
  assert.equal(csvCell(null), '""');
});
test('incident exports match current fields, use server timestamp and identify the timezone', () => {
  assert.deepEqual(REPORT_DATASETS.incidents.cols, ['reported_at','reporter','description','status']);
  assert.equal(reportColumnLabel('reported_at'), 'Date / Time (Asia/Manila)');
  const [row]=incidentReportRows([{created_at:'2026-11-03T17:30:00Z',date:'1999-01-01',reporter:'Student',description:'Blocked exit',status:'open'}]);
  assert.match(row.reported_at,/Nov 4, 2026/);assert.match(row.reported_at,/1:30 AM/);
  assert.equal(row.reporter,'Student');assert.equal('type' in row,false);
});
test('legacy and invalid timestamps remain exportable without inventing a report time', () => {
  assert.equal(incidentReportRows([{date:'2025-01-01',time:'10:00 AM'}])[0].reported_at,'2025-01-01 10:00 AM');
  assert.equal(incidentReportRows([{created_at:'bad'}])[0].reported_at,'Not recorded');
});
