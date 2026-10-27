import {
  h, icon, pill, formatDate, openModal, toast, errorBanner,
} from '../ui.js';
import * as api from '../api.js';
import { isAdmin } from '../auth.js';
import { loadTable } from './table-loader.js';
import { viewRecord, recordForm, rowActions } from './record-actions.js';

const CLINIC_RE = /nurse|clinic|health/i;

async function loadClinicRecipients() {
  const contacts = await api.listRows('emergency_contacts');
  return contacts.filter((c) =>
    c.category === 'school' && c.email &&
    CLINIC_RE.test(`${c.name || ''} ${c.role || ''} ${c.relationship || ''}`));
}

export async function promptNotifyStockHandlers(lowItems = null, triggerBtn = null) {
  let items = lowItems;
  let recipients = [];
  let loadError = '';
  try {
    if (!items || !items.length) {
      const all = await api.listRows('supplies');
      items = all
        .filter((x) => Number(x.quantity) <= Number(x.reorder_threshold))
        .map((x) => ({
          item: x.item,
          quantity: Number(x.quantity),
          reorder_threshold: Number(x.reorder_threshold),
          location: x.location || 'Clinic',
          unit: x.unit || '',
        }));
    }
    recipients = await loadClinicRecipients();
  } catch (err) {
    loadError = err.message || 'Could not load supplies or clinic contacts.';
  }
  items = items || [];

  const hasLow = items.length > 0;
  const canSend = hasLow && recipients.length > 0 && !loadError;

  const stockLabel = (it) => (it.quantity <= 0
    ? 'Out of stock'
    : `${it.quantity} ${it.unit || ''}`.trim() + ' left');

  const recipientBlock = recipients.length
    ? h('div', { class: 'space-y-2' },
      recipients.map((c) => h('div', { class: 'flex items-center justify-between gap-3' },
        h('div', { class: 'min-w-0' },
          h('p', { class: 'text-sm font-bold text-gray-900 truncate' }, c.name),
          h('p', { class: 'text-xs text-gray-500 mt-0.5 truncate' }, [c.role, c.phone].filter(Boolean).join(' · ') || 'Clinic contact'),
        ),
        h('span', { class: 'text-xs text-gray-500 font-mono truncate max-w-[45%]' }, c.email),
      )))
    : h('p', { class: 'text-xs text-amber-700' },
      'No school nurse / clinic contact with an email is registered yet. Add one under Emergency Contacts (category: School) so restock alerts have someone to go to.');

  const content = h('div', { class: 'p-6 sm:p-7 space-y-6 w-full' },
    h('div', { class: 'flex items-start justify-between gap-4' },
      h('div', { class: 'flex items-start gap-3.5' },
        h('div', { class: 'w-11 h-11 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shrink-0 shadow-xs' },
          icon('notifications', 'text-xl'),
        ),
        h('div', {},
          h('h3', { class: 'text-lg sm:text-xl font-bold text-gray-900 leading-tight' }, 'Notify Clinic Stock Handlers'),
          h('p', { class: 'text-xs sm:text-sm text-gray-500 mt-1' },
            'Email a restock alert to the school nurse / clinic staff on record.',
          ),
        ),
      ),
      h('button', {
        class: 'w-8 h-8 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 flex items-center justify-center shrink-0 transition-colors clickable',
        'aria-label': 'Close dialog',
        onclick: () => modal.close(),
      }, '✕'),
    ),

    h('div', { class: 'bg-gray-50 border border-gray-200/80 rounded-2xl p-4' },
      h('p', { class: 'text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2' },
        `Recipients (${recipients.length})`),
      recipientBlock,
    ),

    loadError ? h('p', { class: 'text-[13px] text-red-600 bg-red-50 border border-red-200/70 rounded-xl px-3.5 py-2.5' }, loadError) : null,

    h('div', { class: 'space-y-2.5' },
      h('div', { class: 'flex items-center justify-between' },
        h('p', { class: 'text-[10px] font-bold uppercase tracking-wider text-gray-400' },
          hasLow ? `Low stock — needs reorder (${items.length})` : 'Supplies status'),
        hasLow ? h('span', { class: 'text-[11px] font-semibold text-red-600' }, 'Action required') : null,
      ),
      hasLow ? h('div', { class: 'max-h-52 overflow-y-auto space-y-2 pr-1' },
        items.map((it) => h('div', { class: 'flex items-center justify-between bg-red-50/50 border border-red-100 rounded-xl p-3 text-xs' },
          h('div', { class: 'min-w-0 pr-3' },
            h('p', { class: 'font-bold text-gray-900 truncate' }, it.item),
            h('p', { class: 'text-gray-500 text-[11px] mt-0.5' }, it.location ? `Location: ${it.location}` : 'Clinic Storage'),
          ),
          h('div', { class: 'text-right shrink-0' },
            h('span', { class: 'inline-block px-2 py-0.5 rounded-md bg-red-100 text-red-700 font-bold' }, stockLabel(it)),
            h('p', { class: 'text-[10px] text-gray-500 mt-0.5' }, `Reorder at: ${it.reorder_threshold}`),
          ),
        )),
      ) : h('div', { class: 'bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-xs text-emerald-800 flex items-center gap-2.5' },
        icon('check_circle', 'text-emerald-600 text-base shrink-0'),
        h('span', {}, 'All tracked first aid supplies are above their reorder thresholds. There is nothing to send.'),
      ),
    ),

    h('div', { class: 'flex items-center justify-end gap-2 pt-3 border-t border-gray-100' },
      h('button', {
        class: 'px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold transition-colors clickable',
        onclick: () => modal.close(),
      }, 'Cancel'),
      h('button', {
        id: 'btn-confirm-send-stock-alert',
        class: `px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-sm transition-colors flex items-center gap-2 clickable ${canSend ? '' : 'opacity-50 cursor-not-allowed'}`,
        disabled: canSend ? null : 'disabled',
        onclick: async (e) => {
          if (!canSend) return;
          const btn = e.currentTarget;
          btn.disabled = true;
          btn.textContent = 'Sending…';
          try {
            const summaryText = items
              .map((x) => `${x.item} (${x.quantity <= 0 ? 'out of stock' : `${x.quantity} left`}, reorder at ${x.reorder_threshold}${x.location ? `, ${x.location}` : ''})`)
              .join('; ');
            const res = await api.sendNotification({
              notif_type: 'alert',
              audience_group: 'Clinic Staff / Stock Custodians',
              title: 'Low First Aid Supplies — Restock Alert',
              message: `The following first aid items are at or below their reorder level and need restocking: ${summaryText}.`,
            });
            if (!res.ok) throw new Error(res.error || 'Failed to send the notification.');
            modal.close();
            const n = res.delivery && res.delivery.sent != null ? res.delivery.sent : recipients.length;
            toast(`Restock alert emailed to ${n} clinic contact${n === 1 ? '' : 's'}.`);
            if (triggerBtn) {
              triggerBtn.disabled = true;
              triggerBtn.className = 'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-xs whitespace-nowrap opacity-90 cursor-default';
              triggerBtn.innerHTML = '';
              triggerBtn.appendChild(icon('check_circle', 'text-xs'));
              triggerBtn.appendChild(document.createTextNode(' Stock Handlers Notified'));
            }
          } catch (err) {
            btn.disabled = false;
            btn.textContent = 'Send Restock Alert';
            toast(`Failed to send alert: ${err.message || 'Network error'}`);
          }
        },
      }, icon('send', 'text-xs'), 'Send Restock Alert'),
    ),
  );

  const modal = openModal(content);
}

const INSPECTION_FREQUENCIES = ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'semi-annual', 'annual'];
const INSPECTION_DAYS = { daily: 1, weekly: 7, biweekly: 14, monthly: 30, quarterly: 91, 'semi-annual': 182, annual: 365 };
const inspectionFields = [
  { key: 'item', label: 'Inspection item', required: true, maxLength: 255 },
  { key: 'area', label: 'Area / location', required: true, maxLength: 255 },
  { key: 'frequency', label: 'Frequency', type: 'select', required: true, defaultValue: 'monthly', options: INSPECTION_FREQUENCIES.map((v) => ({ value: v, label: v })) },
  { key: 'last_inspected', label: 'Last inspected', type: 'date' },
  { key: 'status', label: 'Status', type: 'select', required: true, defaultValue: 'pending', options: ['pending', 'passed', 'fail', 'overdue'].map((v) => ({ value: v, label: v })) },
  { key: 'inspector', label: 'Inspector' },
  { key: 'notes', label: 'Findings / follow-up notes', type: 'textarea', wide: true },
];
const inspectionDetails = [
  ...inspectionFields.map(({ key, label, type }) => ({ key, label, type })),
  { key: 'risk_level', label: 'Risk classification' },
  { key: 'photo_url', label: 'Inspection photo' },
  { key: 'created_at', label: 'Record created', type: 'date' },
];
function inspectionDue(record) {
  const interval = INSPECTION_DAYS[String(record.frequency || '').toLowerCase().trim()];
  if (!interval || !record.last_inspected) return null;
  const d = new Date(String(record.last_inspected).slice(0, 10) + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + interval);
  return d.toISOString().slice(0, 10);
}
export async function safetyInspections(el) {
  if (!isAdmin()) { el.replaceChildren(errorBanner('Safety inspections are visible to administrators only.')); return; }
  const edit = (record) => recordForm({
    title: record ? 'Edit inspection' : 'Add inspection', table: 'inspections',
    record, fields: inspectionFields, onSaved: () => safetyInspections(el),
  });
  const columns = [
    { key: 'item', label: 'Inspection item', render: (r) => h('span', { class: 'font-semibold text-gray-900' }, r.item) },
    { key: 'area', label: 'Area / location' },
    { key: 'status', label: 'Status', render: (r) => pill(r.status) },
    { key: 'risk_level', label: 'Risk', render: (r) => r.risk_level || 'Not recorded' },
    { key: 'last_inspected', label: 'Last check', render: (r) => formatDate(r.last_inspected) },
    { key: 'next_due', label: 'Next due', render: (r) => formatDate(inspectionDue(r)) },
    { key: 'inspector', label: 'Inspector', render: (r) => r.inspector || 'Unassigned' },
    { key: 'actions', label: 'Actions', render: (r) => rowActions(
      () => viewRecord('Inspection details: ' + r.item, {
        ...r, next_due: inspectionDue(r),
      }, [...inspectionDetails, { key: 'next_due', label: 'Next due', type: 'date' }],
      [{ label: 'Edit inspection', onClick: () => edit(r) }]),
      () => edit(r),
    ) },
  ];
  const rows = await loadTable(el, {
    table: 'inspections', columns, iconName: 'fact_check',
    title: 'Safety Inspections', subtitle: 'Review inspection status, due dates and documented findings.',
    actionLabel: 'Add inspection', actionIcon: 'add', adminAction: true, onAction: () => edit(null),
    searchKeys: ['item', 'area', 'inspector', 'status', 'notes', 'risk_level'],
    searchPlaceholder: 'Search item, area, status or inspector…',
    selectFilters: [{ key: 'status', label: 'All statuses', options: ['pending', 'passed', 'fail', 'overdue'].map((v) => ({ label: v, value: v })) }],
    empty: { title: 'No inspections recorded yet', text: 'Add an inspection item to track safety checks.' },
  });
  if (!Array.isArray(rows) || !rows.length) return;
  const upcoming = rows.map((r) => ({ record: r, due: inspectionDue(r) })).filter((r) => r.due && r.due >= new Date().toISOString().slice(0, 10)).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 5);
  if (upcoming.length) el.firstElementChild?.appendChild(h('section', { class: 'bg-white border border-gray-100 rounded-2xl p-5' },
    h('h3', { class: 'font-bold text-gray-900 mb-3' }, 'Upcoming inspections'),
    h('ul', { class: 'space-y-2' }, upcoming.map(({ record, due }) => h('li', { class: 'flex flex-wrap justify-between gap-2 text-sm' },
      h('span', {}, record.item + ' · ' + record.area), h('span', { class: 'font-semibold' }, formatDate(due)))))));
}

export async function emergencyRoles(el) {
  const columns = [
    { key: 'id', label: 'ID', render: (r) => h('span', { class: 'text-gray-400 font-mono text-xs whitespace-nowrap' }, r.id) },
    { key: 'role', label: 'Role', render: (r) => h('span', { class: 'font-semibold text-gray-900' }, r.role) },
    { key: 'staff', label: 'Assigned Staff', render: (r) => h('span', { class: 'text-gray-700' }, r.staff) },
    { key: 'zone', label: 'Zone / Building' },
    { key: 'backup', label: 'Backup Person', render: (r) => r.backup ? h('span', { class: 'text-gray-600' }, r.backup) : h('span', { class: 'text-gray-300' }, '—') },
  ];
  return loadTable(el, {
    table: 'emergency_roles', columns, iconName: 'groups',
    title: 'Emergency Role Assignment',
    subtitle: 'Fire wardens, first aiders, and evacuation marshals assigned per zone, each with a backup person.',
    searchKeys: ['role', 'staff', 'zone', 'backup'],
    searchPlaceholder: 'Search by role, staff, or zone…',
    empty: { title: 'No roles assigned yet', text: 'Assign the first emergency role to a staff member.' },
  });
}

const supplyFields = [
  { key: 'item', label: 'Item name', required: true, maxLength: 255 },
  { key: 'quantity', label: 'Quantity', type: 'number', min: 0, required: true },
  { key: 'unit', label: 'Unit', maxLength: 20 },
  { key: 'location', label: 'Storage location', required: true, maxLength: 255 },
  { key: 'expiry', label: 'Expiration date', type: 'date' },
  { key: 'reorder_threshold', label: 'Reorder threshold', type: 'number', min: 0, required: true, defaultValue: 0 },
  { key: 'last_restocked', label: 'Last restocked', type: 'date' },
];
export async function firstAidSupplies(el) {
  if (!isAdmin()) { el.replaceChildren(errorBanner('First aid supplies are visible to administrators only.')); return; }
  const edit = (record) => recordForm({
    title: record ? 'Edit first aid supply' : 'Add first aid supply',
    table: 'supplies', record, fields: supplyFields, onSaved: () => firstAidSupplies(el),
  });
  const stock = (r) => Number(r.quantity) <= Number(r.reorder_threshold) ? 'low' : 'ok';
  const columns = [
    { key: 'item', label: 'Item', render: (r) => h('span', { class: 'font-semibold text-gray-900' }, r.item) },
    { key: 'quantity', label: 'Quantity', render: (r) => h('span', { class: stock(r) === 'low' ? 'font-bold text-red-600' : 'font-semibold text-gray-900' }, `${r.quantity} ${r.unit || ''}`.trim()) },
    { key: 'location', label: 'Location' },
    { key: 'expiry', label: 'Expiry', render: (r) => formatDate(r.expiry) },
    { key: 'reorder_threshold', label: 'Reorder at' },
    { key: 'status', label: 'Stock status', render: (r) => pill(stock(r)) },
    { key: 'actions', label: 'Actions', render: (r) => rowActions(
      () => viewRecord('Supply details: ' + r.item, {
        ...r, stock_status: stock(r),
      }, [...supplyFields.map(({ key, label, type }) => ({ key, label, type })),
        { key: 'stock_status', label: 'Stock status' }, { key: 'created_at', label: 'Record created', type: 'date' }],
      [{ label: 'Edit supply', onClick: () => edit(r) }]),
      () => edit(r),
    ) },
  ];
  return loadTable(el, {
    table: 'supplies', columns, iconName: 'medical_services',
    title: 'First Aid Supplies', subtitle: 'Review quantities, expiry dates and reorder thresholds using recorded stock data.',
    actionLabel: 'Add supply', actionIcon: 'add', adminAction: true, onAction: () => edit(null),
    secondaryActionLabel: 'Notify Stock Handlers', secondaryActionIcon: 'notifications',
    onSecondaryAction: (e) => promptNotifyStockHandlers(null, e?.currentTarget),
    searchKeys: ['item', 'location', 'unit'],
    searchPlaceholder: 'Search by item, location or unit…',
    empty: { title: 'No supplies tracked yet', text: 'Add the first supply item to begin inventory tracking.' },
  });
}
