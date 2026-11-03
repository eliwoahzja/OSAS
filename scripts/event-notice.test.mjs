import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  EVENT_NOTICE_CATEGORIES, EVENT_NOTICE_AUDIENCES,
  eventNoticePayload, validateEventNotice,
} from '../js/modules/event-notice.js';

const valid = {
  category: 'Drill & Preparedness',
  title: 'Earthquake Drill',
  audience_group: 'Grade 7 Parents',
  event_start_at: '2026-11-10T09:30',
  event_end_at: '2026-11-10T10:30',
  message: 'Please remind students to follow their designated evacuation routes.',
};
const clock = Date.parse('2026-11-02T00:00:00Z');

test('allows all agreed notification categories', () => {
  assert.deepEqual(EVENT_NOTICE_CATEGORIES, [
    'Upcoming Event', 'Drill & Preparedness', 'School Activity', 'Meeting', 'Other School Notice',
  ]);
  for (const category of EVENT_NOTICE_CATEGORIES) {
    assert.equal(validateEventNotice({ ...valid, category }, clock), '');
  }
});

test('keeps the existing event_notice delivery format and Manila dates', () => {
  const payload = eventNoticePayload(valid, clock);
  assert.deepEqual(payload, {
    notif_type: 'event_notice',
    priority: 'informational',
    audience_group: 'Grade 7 Parents',
    title: '[Drill & Preparedness] Earthquake Drill',
    message: valid.message,
    event_start_at: '2026-11-10T01:30:00.000Z',
    event_end_at: '2026-11-10T02:30:00.000Z',
    contact_method: 'email',
  });
});

test('validates required details, time order, and supported parent audiences', () => {
  assert.match(validateEventNotice({ ...valid, title: '' }, clock), /title/i);
  assert.match(validateEventNotice({ ...valid, message: '' }, clock), /Message/i);
  assert.match(validateEventNotice({ ...valid, event_end_at: valid.event_start_at }, clock), /after/i);
  assert.match(validateEventNotice({ ...valid, event_start_at: '2026-10-01T08:00' }, clock), /future/i);
  assert.match(validateEventNotice({ ...valid, event_start_at: 'not-a-date' }, clock), /valid/i);
  assert.match(validateEventNotice({ ...valid, audience_group: 'Only School Staff' }, clock), /audience/i);
  assert.ok(EVENT_NOTICE_AUDIENCES.includes('All Parents & Guardians'));
  assert.throws(() => eventNoticePayload({ ...valid, category: 'urgent incident' }, clock));
});

test('composer only creates event notices while preserving previous incident records', () => {
  const src = readFileSync(new URL('../js/modules/notifications.js', import.meta.url), 'utf8');
  assert.ok(src.includes("title: 'Event Notification'") || src.includes("'Event Notification'"));
  assert.ok(src.includes('eventNoticePayload(f)'));
  assert.ok(src.includes('Past Incident Notice'));
  assert.ok(!src.includes("mkTab('Urgent Incident Alert'"));
  assert.ok(!src.includes("notif_type: 'incident_alert'"));
  assert.ok(src.includes('Confirm & Send Email'));
});
