import test from 'node:test';
import assert from 'node:assert/strict';
import { schoolToday, supplyStatus, supplyTone, inspectionDue, inspectionStatus } from '../js/safety-status.js';

const today = '2026-10-27';
const supply = { quantity: 12, reorder_threshold: 5, expiry: '2027-06-10' };
test('school date changes at Manila midnight', () => {
  assert.equal(schoolToday(new Date('2026-10-27T15:59:59Z')), '2026-10-27');
  assert.equal(schoolToday(new Date('2026-10-27T16:00:00Z')), '2026-10-28');
});
test('supply statuses handle thresholds, missing expiry and expiry boundaries', () => {
  assert.equal(supplyStatus(supply, today), 'In Stock');
  assert.equal(supplyStatus({ ...supply, quantity: 5 }, today), 'Low Stock');
  assert.equal(supplyStatus({ ...supply, quantity: 0 }, today), 'Low Stock');
  assert.equal(supplyStatus({ ...supply, expiry: '2026-10-26', quantity: 0 }, today), 'Expired');
  assert.equal(supplyStatus({ ...supply, expiry: today }, today), 'Expiring Soon');
  assert.equal(supplyStatus({ ...supply, expiry: '2026-11-26' }, today), 'Expiring Soon');
  assert.equal(supplyStatus({ ...supply, expiry: '2026-11-27' }, today), 'In Stock');
  assert.equal(supplyStatus({ ...supply, expiry: null }, today), 'In Stock');
  assert.equal(supplyStatus({ ...supply, expiry: 'invalid' }, today), 'In Stock');
  assert.equal(supplyStatus({ ...supply, expiry: today, quantity: 5 }, today), 'Expiring Soon');
});
test('inspection schedules preserve supported stored frequency aliases', () => {
  assert.equal(inspectionDue({ frequency: 'Monthly', last_inspected: '2026-10-05' }), '2026-11-04');
  assert.equal(inspectionDue({ frequency: 'Semiannual', last_inspected: '2026-01-01' }), '2026-07-02');
  assert.equal(inspectionDue({ frequency: 'unknown', last_inspected: '2026-10-05' }), null);
  assert.equal(inspectionDue({ frequency: 'monthly', last_inspected: null }), null);
});
test('inspection urgency handles due today, seven days, overdue and failed checks', () => {
  const inspection = { frequency: 'daily', last_inspected: '2026-10-26', status: 'passed' };
  assert.equal(inspectionStatus(inspection, today), 'due soon');
  assert.equal(inspectionStatus({ ...inspection, frequency: 'weekly', last_inspected: today }, today), 'due soon');
  assert.equal(inspectionStatus({ ...inspection, frequency: 'biweekly', last_inspected: today }, today), 'passed');
  assert.equal(inspectionStatus({ ...inspection, last_inspected: '2026-10-25' }, today), 'overdue');
  assert.equal(inspectionStatus({ ...inspection, status: 'fail' }, today), 'fail');
  assert.equal(inspectionStatus({ status: 'pending' }, today), 'pending');
});

test('stock warning colors distinguish reorder warnings from critical shortages', () => {
  assert.equal(supplyTone({ ...supply, quantity: 3, reorder_threshold: 4 }, today), 'amber');
  assert.equal(supplyTone({ ...supply, quantity: 2, reorder_threshold: 4 }, today), 'red');
  assert.equal(supplyTone({ ...supply, quantity: 0 }, today), 'red');
  assert.equal(supplyTone(supply, today), 'green');
  assert.equal(supplyTone({ ...supply, quantity: 1, expiry: today }, today), 'amber');
  assert.equal(supplyTone({ ...supply, quantity: 4, expiry: '2026-10-26' }, today), 'red');
});
