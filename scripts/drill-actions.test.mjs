import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('drill scheduling has inspection-style View, Edit and Delete row actions', () => {
  const drill = read('js/modules/drills.js');
  const inspection = read('js/modules/inspections.js');
  assert.ok(inspection.includes("import { viewRecord, recordForm, rowActions, confirmDelete }"));
  assert.ok(drill.includes("import { viewRecord, recordForm, rowActions, confirmDelete }"));
  assert.match(drill, /key: 'actions', label: 'Actions', cls: 'workspace-actions-column', cellCls: 'workspace-actions-cell'/);
  assert.match(drill, /rowActions\(\s*\(\) => view\(record\),\s*\(\) => edit\(record\),/);
  assert.ok(drill.includes("compact: true, onDelete: () => remove(record)"));
});

test('editing a drill updates an existing record and supports all schedule fields', () => {
  const drill = read('js/modules/drills.js');
  const actions = read('js/modules/record-actions.js');
  for (const key of ['type', 'date', 'time', 'building', 'person_in_charge', 'status', 'notes']) {
    assert.ok(drill.includes("key: '" + key + "'"), key + ' must be editable');
  }
  assert.ok(drill.includes("value: 'completed'"));
  assert.ok(drill.includes("value: 'cancelled'"));
  assert.ok(drill.includes("record,\n    fields: drillEditFields"));
  assert.ok(actions.includes("api.updateRow(table, record.id, payload)"));
  assert.ok(drill.includes("onSaved: () => drillScheduling(el)"));
});

test('deleting requires confirmation and refreshes the table', () => {
  const drill = read('js/modules/drills.js');
  const actions = read('js/modules/record-actions.js');
  assert.ok(drill.includes("table: 'drills',\n    record,\n    onSaved: () => drillScheduling(el)"));
  assert.ok(actions.includes("This action cannot be undone."));
  assert.ok(actions.includes("await api.deleteRow(table, record.id)"));
});

test('creation workflow and optional parent notification stay intact', () => {
  const drill = read('js/modules/drills.js');
  assert.ok(drill.includes("onAction: () => drillForm(el)"));
  assert.ok(drill.includes("api.insertRow('drills'"));
  assert.ok(drill.includes("api.sendNotification("));
  assert.ok(drill.includes("notif_type: 'event_notice'"));
  assert.ok(!drill.includes("onRowClick: (record) => view(record)"));
  assert.ok(drill.includes("...(isAdmin() ? [{"));
});
