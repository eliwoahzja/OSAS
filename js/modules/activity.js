import { h, icon, openModal } from '../ui.js';
import * as api from '../api.js';
import { viewRecord } from './record-actions.js';

const displayTime = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date not recorded' : date.toLocaleString('en-PH', {
    timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
};

export function createActivityPanel({ table, recordId, heading = 'Recent Activity', onView }) {
  const panel = h('section', { class: 'inspection-panel', 'aria-label': heading });
  const refresh = async () => {
    panel.replaceChildren(h('h3', { class: 'font-bold text-gray-900 mb-3' }, heading),
      h('p', { class: 'text-sm text-gray-500', role: 'status' }, 'Loading saved activity…'));
    try {
      const events = await api.listActivity(table, { recordId, limit: recordId ? 20 : 5 });
      if (!panel.isConnected) return;
      panel.lastElementChild.remove();
      if (!events.length) {
        panel.appendChild(h('p', { class: 'text-sm text-gray-500' }, 'No saved activity yet.'));
        return;
      }
      for (const event of events) {
        const record = event.new_value || event.old_value || {};
        const action = String(event.action).toLowerCase();
        let label = action === 'insert' ? 'Record added' : action === 'delete' ? 'Record deleted' : 'Record updated';
        if (action === 'update' && event.new_value?.status !== event.old_value?.status) {
          label = 'Status updated to ' + (event.new_value?.status || 'Not recorded');
        }
        panel.appendChild(h('button', {
          type: 'button', class: 'inspection-shortcut',
          onclick: () => onView?.({ ...record, event_at: displayTime(event.changed_at), event_action: label }, event),
        }, icon(action === 'delete' ? 'trash-can' : action === 'insert' ? 'add' : 'rate_review'),
        h('span', {}, label, h('small', {}, record.item || record.role || 'Saved record'),
          h('small', {}, displayTime(event.changed_at)))));
      }
    } catch (error) {
      if (!panel.isConnected) return;
      panel.lastElementChild?.remove();
      panel.appendChild(h('p', { class: 'text-sm text-gray-500', role: 'status' }, error.message || 'Activity could not be loaded.'));
      panel.appendChild(h('button', { type: 'button', class: 'btn-ghost', onclick: refresh }, 'Retry activity'));
    }
  };
  refresh();
  return panel;
}

export function openRecordHistory(table, record, fields) {
  const body = h('div', { class: 'p-6 space-y-4' },
    h('h3', { class: 'text-lg font-bold' }, 'History: ' + (record.item || record.role)),
    h('p', { class: 'text-sm text-gray-500' }, 'Saved changes, newest first. Times use Asia/Manila.'));
  const modal = openModal(body, { delay: 0 });
  body.appendChild(createActivityPanel({
    table, recordId: record.id, heading: 'Saved changes',
    onView: (snapshot) => {
      modal.close();
      viewRecord('Saved record snapshot', snapshot, [
        { key: 'event_action', label: 'Change' }, { key: 'event_at', label: 'Recorded at' }, ...fields,
      ]);
    },
  }));
  body.appendChild(h('button', { type: 'button', class: 'btn-primary', onclick: () => modal.close() }, 'Close'));
}
