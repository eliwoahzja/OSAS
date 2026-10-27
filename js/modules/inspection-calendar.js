import { h, icon, openModal, formatDate, pill } from '../ui.js';
import { inspectionDue, schoolToday } from '../safety-status.js';

export function openInspectionCalendar(records, onView) {
  const today = schoolToday();
  let selected = today;
  let month = today.slice(0, 7);
  const due = records.map((record) => ({ record, date: inspectionDue(record) })).filter((r) => r.date);
  const body = h('div', { class: 'inspection-calendar p-6 space-y-4' });
  const modal = openModal(body, { delay: 0 });
  const shiftMonth = (offset) => {
    const date = new Date(month + '-01T00:00:00Z');
    date.setUTCMonth(date.getUTCMonth() + offset);
    month = date.toISOString().slice(0, 7);
    selected = month + '-01';
    render();
  };
  const render = () => {
    const first = new Date(month + '-01T00:00:00Z');
    const title = first.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' });
    const start = new Date(first);
    start.setUTCDate(1 - first.getUTCDay());
    const days = Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + index);
      const key = date.toISOString().slice(0, 10);
      const count = due.filter((r) => r.date === key).length;
      return h('button', {
        type: 'button', class: 'calendar-day' + (key.startsWith(month) ? '' : ' calendar-day-outside'),
        'aria-label': `${formatDate(key)}, ${count} inspection${count === 1 ? '' : 's'}`,
        'aria-pressed': key === selected, 'aria-current': key === today ? 'date' : null,
        onclick: () => { selected = key; month = key.slice(0, 7); render(); },
      }, h('span', {}, String(date.getUTCDate())), count ? h('small', {}, `${count} due`) : null);
    });
    const checks = due.filter((r) => r.date === selected);
    body.replaceChildren(
      h('h3', { class: 'text-lg font-bold' }, 'Inspection schedule'),
      h('div', { class: 'calendar-navigation' },
        h('button', { type: 'button', class: 'btn-ghost', 'aria-label': 'Previous month', onclick: () => shiftMonth(-1) }, icon('chevron_left')),
        h('h4', { class: 'font-bold', 'aria-live': 'polite' }, title),
        h('button', { type: 'button', class: 'btn-ghost', 'aria-label': 'Next month', onclick: () => shiftMonth(1) }, icon('chevron_right'))),
      h('div', { class: 'calendar-weekdays', 'aria-hidden': 'true' }, ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => h('span', {}, day))),
      h('div', { class: 'calendar-days', 'aria-label': title }, days),
      h('section', { 'aria-label': 'Inspections due on selected date', 'aria-live': 'polite' },
        h('h4', { class: 'font-bold text-sm' }, formatDate(selected)),
        ...checks.map(({ record }) => h('button', {
          type: 'button', class: 'inspection-shortcut', onclick: () => { modal.close(); onView(record); },
        }, h('span', {}, record.item, h('small', {}, record.area)), pill(record.status))),
        !checks.length ? h('p', { class: 'text-sm text-gray-500 mt-2' }, 'No inspections due on this date.') : null),
      h('div', { class: 'flex justify-between gap-3' },
        h('button', { type: 'button', class: 'btn-ghost', onclick: () => { selected = today; month = today.slice(0, 7); render(); } }, 'Today'),
        h('button', { type: 'button', class: 'btn-primary', onclick: () => modal.close() }, 'Close')),
    );
  };
  render();
}
