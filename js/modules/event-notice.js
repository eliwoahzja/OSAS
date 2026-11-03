export const EVENT_NOTICE_CATEGORIES = Object.freeze([
  'Upcoming Event',
  'Drill & Preparedness',
  'School Activity',
  'Meeting',
  'Other School Notice',
]);

export const EVENT_NOTICE_AUDIENCES = Object.freeze([
  'All Parents & Guardians',
  'Grade 7 Parents',
  'Grade 8 Parents',
  'Grade 9 Parents',
  'Grade 10 Parents',
  'Grade 7-10 Parents',
]);

function manilaEpoch(localTime) {
  const value = String(localTime || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return NaN;
  const epoch = Date.parse(value + ':00+08:00');
  if (!Number.isFinite(epoch)) return NaN;
  const reconstructed = new Date(epoch + 8 * 3600 * 1000).toISOString().slice(0, 16);
  return reconstructed === value ? epoch : NaN;
}

export function validateEventNotice(form, now = Date.now()) {
  if (!EVENT_NOTICE_CATEGORIES.includes(form.category)) return 'Select a valid notice category.';
  if (!EVENT_NOTICE_AUDIENCES.includes(form.audience_group)) return 'Select a valid parent audience.';
  if (!String(form.title || '').trim()) return 'A notice title is required.';
  if (String(form.title).trim().length > 180) return 'The notice title must be 180 characters or less.';
  if (!String(form.message || '').trim()) return 'Message details are required.';
  if (String(form.message).trim().length > 2000) return 'Message details must be 2000 characters or less.';
  const start = manilaEpoch(form.event_start_at);
  const end = manilaEpoch(form.event_end_at);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 'Select valid start and end dates and times (Philippine time).';
  if (end <= start) return 'The end time must be after the start time.';
  if (start < now) return 'The event must start in the future. Check the start date and time.';
  return '';
}

export function eventNoticePayload(form, now = Date.now()) {
  const error = validateEventNotice(form, now);
  if (error) throw new Error(error);
  return {
    notif_type: 'event_notice',
    priority: 'informational',
    audience_group: form.audience_group,
    title: '[' + form.category + '] ' + String(form.title).trim(),
    message: String(form.message).trim(),
    event_start_at: new Date(manilaEpoch(form.event_start_at)).toISOString(),
    event_end_at: new Date(manilaEpoch(form.event_end_at)).toISOString(),
    contact_method: 'email',
  };
}
