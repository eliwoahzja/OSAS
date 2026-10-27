import { h, icon, openModal, formatDate, inputCls, labelCls, toast } from '../ui.js';
import * as api from '../api.js';
import { isAdmin } from '../auth.js';

const visible = (value, type) => {
  if (value === null || value === undefined || value === '') return 'Not recorded';
  if (type === 'date') return formatDate(value);
  if (typeof value === 'boolean') return value ? 'Active' : 'Inactive';
  return String(value);
};

export function viewRecord(title, record, fields, actions = []) {
  const detailValue = ({ key, label, type }) => {
    if (['image', 'link'].includes(type) && record[key]) {
      let url;
      try { url = new URL(record[key], window.location.origin); } catch { return 'Not recorded'; }
      if (!['https:', 'http:'].includes(url.protocol)) return 'Not recorded';
      return h('a', { href: url.href, target: '_blank', rel: 'noopener noreferrer', class: 'text-pink-700 underline' },
        type === 'image' ? h('img', { src: url.href, alt: label, class: 'record-detail-photo', loading: 'lazy' }) : 'Open ' + label.toLowerCase());
    }
    return visible(record[key], type);
  };
  const rows = fields.map((field) => h('div', { class: 'py-3 border-b border-gray-100 min-w-0' + (['textarea', 'image'].includes(field.type) ? ' record-detail-wide' : '') },
    h('dt', { class: 'text-xs font-bold uppercase tracking-wide text-gray-500' }, field.label),
    h('dd', { class: 'text-sm text-gray-900 mt-1 break-words whitespace-pre-wrap' }, detailValue(field)),
  ));
  const details = h('div', { class: 'p-6 sm:p-8 space-y-4' },
    h('h3', { class: 'text-lg font-bold text-gray-900' }, title),
    h('dl', { class: 'grid grid-cols-1 sm:grid-cols-2 gap-x-6' }, rows),
  );
  const controls = h('div', { class: 'flex flex-wrap justify-end gap-2 pt-2' });
  let modal;
  for (const action of actions) {
    if (!isAdmin()) continue;
    controls.appendChild(h('button', {
      type: 'button', class: 'btn-ghost',
      onclick: () => { modal.close(); action.onClick(); },
    }, action.label));
  }
  controls.appendChild(h('button', { type: 'button', class: 'btn-primary', onclick: () => modal.close() }, 'Close'));
  details.appendChild(controls);
  modal = openModal(details, { delay: 0 });
}

export function recordForm({ title, table, record = null, fields, onSaved, validate, prepare }) {
  if (!isAdmin()) return;
  const editing = Boolean(record);
  const form = h('form', { class: 'p-6 sm:p-8 space-y-4' });
  form.appendChild(h('h3', { class: 'text-lg font-bold text-gray-900' }, title));
  const grid = h('div', { class: 'grid grid-cols-1 sm:grid-cols-2 gap-4' });
  const controls = {};
  for (const field of fields) {
    const value = record?.[field.key] ?? field.defaultValue ?? '';
    const attrs = { class: inputCls, required: field.required || null, 'aria-label': field.label };
    let input;
    if (field.type === 'select') {
      input = h('select', attrs,
        (field.options || []).map((o) => h('option', {
          value: o.value, selected: String(o.value) === String(value),
        }, o.label)));
    } else if (field.type === 'textarea') {
      input = h('textarea', { ...attrs, rows: 3, maxLength: field.maxLength ?? null, placeholder: field.placeholder || null });
      input.value = String(value);
    } else {
      input = h('input', {
        ...attrs, type: field.type || 'text', value,
        min: field.min ?? null, max: field.max ?? null,
        maxLength: field.maxLength ?? null, placeholder: field.placeholder || null,
      });
    }
    controls[field.key] = input;
    grid.appendChild(h('div', { class: field.wide ? 'sm:col-span-2' : '' },
      h('label', { class: labelCls }, field.label), input));
  }
  form.appendChild(grid);
  const err = h('p', { class: 'hidden text-sm text-red-600', role: 'alert' });
  const save = h('button', { type: 'submit', class: 'btn-primary' }, icon('check_circle', 'text-sm'), editing ? 'Save changes' : 'Create');
  const cancel = h('button', { type: 'button', class: 'btn-ghost' }, 'Cancel');
  form.appendChild(err);
  form.appendChild(h('div', { class: 'flex flex-wrap justify-end gap-2' }, cancel, save));
  const modal = openModal(form, { delay: 0 });
  cancel.addEventListener('click', () => modal.close());

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!isAdmin()) return;
    const payload = {};
    for (const f of fields) {
      const raw = controls[f.key].value.trim();
      if (f.required && !raw) {
        err.textContent = f.label + ' is required.';
        err.classList.remove('hidden');
        return;
      }
      if (f.type === 'number') {
        const n = Number(raw);
        if (raw && (!Number.isSafeInteger(n) || n < (f.min ?? 0))) {
          err.textContent = 'Enter a valid ' + f.label.toLowerCase() + '.';
          err.classList.remove('hidden');
          return;
        }
        payload[f.key] = raw ? n : null;
      } else {
        payload[f.key] = raw || null;
      }
    }
    if (prepare) prepare(payload);
    const message = validate?.(payload);
    if (message) { err.textContent = message; err.classList.remove('hidden'); return; }
    err.classList.add('hidden');
    save.disabled = true;
    try {
      if (editing) await api.updateRow(table, record.id, payload);
      else await api.insertRow(table, payload);
      toast(editing ? 'Changes saved.' : 'Record created.');
      modal.close();
      await onSaved?.();
    } catch (e) {
      err.textContent = e.message || 'Could not save the record.';
      err.classList.remove('hidden');
    } finally {
      save.disabled = false;
    }
  });
  controls[fields[0]?.key]?.focus();
}

export function confirmDelete({ title, table, record, onSaved }) {
  if (!isAdmin()) return;
  const err = h('p', { class: 'hidden text-sm text-red-600', role: 'alert' });
  const del = h('button', { type: 'button', class: 'btn-primary' }, 'Delete record');
  const modal = openModal(h('div', { class: 'p-6 sm:p-8 space-y-4' },
    h('h3', { class: 'text-lg font-bold' }, 'Delete ' + title + '?'),
    h('p', { class: 'text-sm text-gray-600' }, 'This action cannot be undone. Existing references may prevent deletion.'),
    err,
    h('div', { class: 'flex gap-2 justify-end' },
      h('button', { type: 'button', class: 'btn-ghost', onclick: () => modal.close() }, 'Cancel'), del),
  ), { delay: 0 });
  del.addEventListener('click', async () => {
    del.disabled = true;
    try {
      await api.deleteRow(table, record.id);
      toast('Record deleted.');
      modal.close();
      await onSaved?.();
    } catch (e) {
      err.textContent = e.message || 'Deletion failed.';
      err.classList.remove('hidden');
    } finally { del.disabled = false; }
  });
}

export function rowActions(onView, onEdit, { compact = false, onMore, onDelete } = {}) {
  const buttons = [h('button', {
    type: 'button', class: compact ? 'btn-ghost record-action-icon' : 'btn-ghost text-xs', title: 'View details',
    'aria-label': 'View details', onclick: onView,
  }, icon('eye', 'text-xs'), compact ? null : 'View')];
  if (isAdmin() && onEdit) buttons.push(h('button', {
    type: 'button', class: compact ? 'btn-ghost record-action-icon' : 'btn-ghost text-xs', title: 'Edit record',
    'aria-label': 'Edit record', onclick: onEdit,
  }, icon('pen', 'text-xs'), compact ? null : 'Edit'));
  if (isAdmin() && (onMore || onDelete)) buttons.push(h('button', {
    type: 'button', class: 'btn-ghost record-action-icon',
    title: onMore ? 'More actions' : 'Delete record',
    'aria-label': onMore ? 'More actions' : 'Delete record', onclick: onMore || onDelete,
  }, icon(onMore ? 'ellipsis' : 'trash-can', 'text-xs')));
  return h('div', { class: 'flex items-center gap-1' }, buttons);
}
