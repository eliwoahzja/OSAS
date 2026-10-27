import {
  h, icon, pill, formatDate, openModal, toast, errorBanner,
} from '../ui.js';
import * as api from '../api.js';
import { isAdmin } from '../auth.js';
import { loadTable } from './table-loader.js';
import { inspectionDue, schoolToday, supplyStatus as inventoryStatus, supplyCategoryTone, supplyTone } from '../safety-status.js';
import { openReportExport } from './reports.js';
import { openInspectionCalendar } from './inspection-calendar.js';
import { createActivityPanel, openRecordHistory } from './activity.js';
import { viewRecord, recordForm, rowActions, confirmDelete } from './record-actions.js';

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
const inspectionFields = [
  { key: 'item', label: 'Inspection item', required: true, maxLength: 255 },
  { key: 'area', label: 'Area / location', required: true, maxLength: 255 },
  { key: 'frequency', label: 'Frequency', type: 'select', required: true, defaultValue: 'monthly', options: INSPECTION_FREQUENCIES.map((v) => ({ value: v, label: v })) },
  { key: 'last_inspected', label: 'Last inspected', type: 'date' },
  { key: 'status', label: 'Status', type: 'select', required: true, defaultValue: 'pending', options: ['pending', 'passed', 'fail', 'overdue'].map((v) => ({ value: v, label: v })) },
  { key: 'inspector', label: 'Inspector' },
  { key: 'risk_level', label: 'Risk classification', type: 'select', options: [
    { value: '', label: 'Not recorded' },
    ...['Low', 'Medium', 'Moderate', 'High', 'Critical'].map((v) => ({ value: v, label: v })),
  ] },
  { key: 'notes', label: 'Findings / follow-up notes', type: 'textarea', wide: true },
  { key: 'corrective_actions', label: 'Corrective actions', type: 'textarea', wide: true },
];
const inspectionDetails = [
  ...inspectionFields.map(({ key, label, type }) => ({ key, label, type })),
  { key: 'photo_url', label: 'Inspection photo', type: 'image' },
  { key: 'created_at', label: 'Record created', type: 'date' },
];
export async function safetyInspections(el) {
  if (!isAdmin()) { el.replaceChildren(errorBanner('Safety inspections are visible to administrators only.')); return; }
  const edit = (record) => recordForm({
    title: record ? 'Edit inspection' : 'Add inspection', table: 'inspections',
    record: record ? { ...record, status: record.recorded_status || record.status,
      frequency: ({ semiannual: 'semi-annual', yearly: 'annual' })[String(record.frequency).toLowerCase()] || String(record.frequency).toLowerCase(),
    } : null, fields: inspectionFields, onSaved: () => safetyInspections(el),
  });
  const columns = [
    { key: 'item', label: 'Inspection item', render: (r) => h('span', { class: 'font-semibold text-gray-900' }, r.item) },
    { key: 'area', label: 'Area / location' },
    { key: 'frequency', label: 'Frequency' },
    { key: 'last_inspected', label: 'Last inspected', render: (r) => formatDate(r.last_inspected) },
    { key: 'next_due', label: 'Next due date', render: (r) => formatDate(inspectionDue(r)) },
    { key: 'status', label: 'Status', render: (r) => pill(r.status === 'fail' ? 'Failed' : r.status.replace(/\b\w/g, (c) => c.toUpperCase())) },
    { key: 'risk_level', label: 'Risk level', render: (r) => r.risk_level ? pill(r.risk_level) : 'Not recorded' },
    { key: 'inspector', label: 'Inspector', render: (r) => r.inspector || 'Unassigned' },
    { key: 'actions', label: 'Actions', cls: 'workspace-actions-column', cellCls: 'workspace-actions-cell', render: (r) => rowActions(
      () => viewRecord('Inspection details: ' + r.item, {
        ...r, next_due: inspectionDue(r),
      }, [...inspectionDetails, { key: 'next_due', label: 'Next due', type: 'date' }],
      [{ label: 'Edit inspection', onClick: () => edit(r) }, { label: 'Delete inspection', onClick: () => confirmDelete({ title: r.item, table: 'inspections', record: r, onSaved: () => safetyInspections(el) }) }]),
      () => edit(r),
      { compact: true, onDelete: () => confirmDelete({ title: r.item, table: 'inspections', record: r, onSaved: () => safetyInspections(el) }) },
    ) },
  ];
  let selectedRows = [], filteredRows = [];
  const rows = await loadTable(el, {
    selection: {
      label: (r) => r.item, onChange: (selected) => { selectedRows = selected; },
      onExport: (selected) => openReportExport('inspections', selected, true),
    },
    onFilteredRows: (filtered) => { filteredRows = filtered; },
    table: 'inspections', columns, iconName: 'fact_check', onRetry: () => safetyInspections(el),
    title: 'Safety Inspections', subtitle: h('span', {}, 'Track inspection items per area with frequency, status, and follow-up notes.',
      h('span', { class: 'inspection-subtitle-note' }, 'Keep your campus safe and compliant.')),
    actionLabel: 'Add Inspection Item', actionIcon: 'add', adminAction: true, onAction: () => edit(null),
    searchKeys: ['item', 'area', 'inspector', 'status', 'notes', 'risk_level'],
    searchPlaceholder: 'Search item, area, status or inspector…',
    transformRows: (rows) => rows.map((r) => ({ ...r, next_due: inspectionDue(r) })),
    dateFilter: { key: 'next_due', label: 'Next due date', compact: true },
    paginationStyle: 'numbered',
    selectFilters: [
      { key: 'status', label: 'All statuses', options: ['pending', 'passed', 'due soon', 'fail', 'overdue'].map((v) => ({ label: v === 'fail' ? 'Failed' : v, value: v })) },
      { key: 'area', label: 'All areas', options: [] },
      { key: 'frequency', label: 'All frequencies', options: [] },
    ],
    empty: { title: 'No inspections recorded yet', text: 'Add an inspection item to track safety checks.' },
  });
  if (!Array.isArray(rows)) return;
  const shell = el.firstElementChild;
  shell.classList.add('inspection-workspace');
  const main = shell.lastElementChild;
  main.classList.add('inspection-main');
  if (rows.length) main.firstElementChild?.classList.add('inspection-stats');
  for (const [key, label] of [['area', 'All areas'], ['frequency', 'All frequencies']]) {
    const select = main.querySelector(`select[aria-label="${label}"]`);
    [...new Set(rows.map((r) => r[key]).filter(Boolean))].sort().forEach((value) => {
      select?.appendChild(h('option', { value }, value));
    });
  }
  const show = (record) => viewRecord('Inspection details: ' + record.item, {
    ...record, next_due: inspectionDue(record),
  }, [...inspectionDetails, { key: 'next_due', label: 'Next due date', type: 'date' }],
  [{ label: 'Edit inspection', onClick: () => edit(record) }]);
  const upcoming = rows.filter((r) => r.next_due && r.next_due >= schoolToday())
    .sort((a, b) => a.next_due.localeCompare(b.next_due));
  const panel = (title, ...children) => {
    const viewAll = children[0]?.classList?.contains('inspection-view-all') ? children.shift() : null;
    return h('section', { class: 'inspection-panel' + (title === 'Quick Actions' ? ' inspection-quick-actions' : '') },
      h('div', { class: 'inspection-panel-heading' }, h('h3', { class: 'font-bold text-gray-900' }, title), viewAll), ...children);
  };
  const shortcutIcon = (name) => h('span', { class: 'inspection-shortcut-icon' }, icon(name));
  const scheduleBadge = (r) => r.status === 'due soon' ? pill('Due Soon', 'amber')
    : r.status === 'fail' ? pill('Failed', 'red') : pill('Scheduled', 'green');
  const aside = h('aside', { class: 'inspection-aside', 'aria-label': 'Inspection tools and schedule' },
    panel('Quick Actions',
      h('button', { type: 'button', class: 'inspection-shortcut', onclick: () => edit(null) },
        shortcutIcon('add'), h('span', {}, 'Add Inspection Item', h('small', {}, 'Create a new inspection record'))),
      h('button', { type: 'button', class: 'inspection-shortcut', onclick: () => openInspectionCalendar(rows, show) },
        shortcutIcon('calendar_month'), h('span', {}, 'View Calendar', h('small', {}, 'Check scheduled inspections'))),
      h('button', { type: 'button', class: 'inspection-shortcut', onclick: () =>
        openReportExport('inspections', selectedRows.length ? selectedRows : filteredRows, selectedRows.length > 0),
      }, shortcutIcon('download'), h('span', {}, 'Export Report', h('small', {}, 'Download CSV or print to PDF')))),
    panel('Upcoming Inspections',
      h('button', { type: 'button', class: 'inspection-view-all', onclick: () => openInspectionCalendar(rows, show) }, 'View All'),
      ...upcoming.slice(0, 3).map((r) => h('button', { type: 'button', class: 'inspection-shortcut', onclick: () => show(r) },
        h('span', { class: 'inspection-schedule-icon ' + (r.status === 'due soon' ? 'schedule-due' : 'schedule-ready') }, icon('calendar_month')),
        h('span', {}, formatDate(r.next_due), h('small', {}, r.item + ' · ' + r.area)), scheduleBadge(r))),
      !upcoming.length ? h('p', { class: 'text-sm text-gray-500' }, 'No upcoming inspections recorded.') : null),
    createActivityPanel({ table: 'inspections', limit: 3, onView: (snapshot, event) => {
      const current = rows.find((r) => String(r.id) === String(event.record_id));
      if (current) show(current);
      else viewRecord('Inspection activity snapshot', snapshot, [
        { key: 'event_action', label: 'Change' }, { key: 'event_at', label: 'Recorded at' }, ...inspectionDetails,
      ]);
    } }));
  shell.appendChild(aside);
  main.appendChild(h('aside', { class: 'inspection-safety-note', 'aria-label': 'Campus safety reminder' },
    h('span', { class: 'safety-note-icon' }, icon('security')),
    h('div', {}, h('strong', {}, 'A safer campus is a stronger campus.'),
      h('p', {}, 'Conduct regular inspections, address vulnerabilities, and keep everyone safe.')),
    h('img', { src: '/assets/safety-campus.svg', alt: '', 'aria-hidden': 'true' })));

}

export async function emergencyRoles(el) {
  let plans = [], staff = [], existing = [];
  try {
    [plans, staff, existing] = await Promise.all([
      api.listRows('evacuation_plans'), isAdmin() ? api.listRows('users') : Promise.resolve([]), api.listRows('emergency_roles'),
    ]);
  } catch (err) {
    el.replaceChildren(errorBanner('Could not load evacuation plans and personnel: ' + err.message, () => emergencyRoles(el)));
    return;
  }
  const plan = (r) => plans.find((p) => p.id === r.evacuation_plan_id) || null;
  const planOptions = [
    { value: '', label: 'Select an existing evacuation floor plan' },
    ...plans.map((p) => ({
      value: p.id, label: `${p.building} · ${p.floor}${p.version ? ` (${p.version})` : ''}`,
    })),
  ];
  const staffOptions = [{ value: '', label: 'Select an authorized staff account' },
    ...staff.map((u) => ({ value: u.id, label: u.full_name || u.email || 'Unnamed staff' }))];
  const backupOptions = [{ value: '', label: 'No backup' }, ...staffOptions.slice(1)];
  const roles = [...new Set([
    ...existing.map((r) => r.role).filter(Boolean),
    'Floor Coordinator', 'Evacuation Guide', 'First Aid Responder',
    'Safety Marshal', 'Assembly-Area Coordinator',
  ])].sort((a, b) => a.localeCompare(b));
  const fields = [
    { key: 'evacuation_plan_id', label: 'Building and floor plan', type: 'select', required: true, options: planOptions },
    { key: 'zone', label: 'Zone / coverage area', required: true },
    { key: 'role', label: 'Emergency responsibility', type: 'select', required: true, options: roles.map((v) => ({ value: v, label: v })) },
    { key: 'staff_user_id', label: 'Assigned account', type: 'select', required: true, options: staffOptions },
    { key: 'backup_user_id', label: 'Backup account', type: 'select', options: backupOptions },
  ];
  const edit = (record) => {
    if (!plans.length || !staff.length) {
      toast('Add an evacuation floor plan and authorized accounts before assigning responsibilities.', 'error');
      return;
    }
    recordForm({
      title: record ? 'Edit emergency assignment' : 'Assign emergency responsibility',
      table: 'emergency_roles', record, fields,
      prepare: (data) => {
        const p = plans.find((x) => x.id === data.evacuation_plan_id);
        const lead = staff.find((x) => x.id === data.staff_user_id);
        const backup = staff.find((x) => x.id === data.backup_user_id);
        data.building = p?.building || null;
        data.floor = p?.floor || null;
        data.staff = lead?.full_name || lead?.email || null;
        data.backup = backup?.full_name || backup?.email || (record && !record.backup_user_id ? record.backup : null);
      },
      validate: (data) => {
        if (!plans.some((p) => p.id === data.evacuation_plan_id)) return 'Choose a valid evacuation floor plan.';
        if (!staff.some((u) => u.id === data.staff_user_id)) return 'Choose an authorized staff account.';
        if (data.backup_user_id && data.backup_user_id === data.staff_user_id) return 'The backup must be a different person.';
        if (existing.some((r) => r.id !== record?.id && r.evacuation_plan_id === data.evacuation_plan_id
          && String(r.zone || '').trim().toLowerCase() === String(data.zone).trim().toLowerCase()
          && String(r.role || '').trim().toLowerCase() === String(data.role).trim().toLowerCase())) {
          return 'This responsibility is already assigned for the selected floor and zone.';
        }
        return '';
      },
      onSaved: () => emergencyRoles(el),
    });
  };
  const show = (r) => viewRecord('Emergency role assignment', {
    ...r, floor_plan_url: plan(r)?.file_url, floor_plan: plan(r) ? `${plan(r).building} · ${plan(r).floor}` : 'Legacy assignment not linked to a floor plan',
  }, [
    { key: 'floor_plan', label: 'Evacuation map / floor' },
    { key: 'floor_plan_url', label: 'Evacuation floor plan', type: 'link' },
    { key: 'zone', label: 'Zone / coverage area' },
    { key: 'role', label: 'Responsibility' },
    { key: 'staff', label: 'Assigned person' },
    { key: 'backup', label: 'Backup person' },
  ], [{ label: 'Edit assignment', onClick: () => edit(r) }, { label: 'Delete assignment', onClick: () => confirmDelete({ title: r.role, table: 'emergency_roles', record: r, onSaved: () => emergencyRoles(el) }) }]);
  return loadTable(el, {
    table: 'emergency_roles', iconName: 'groups',
    transformRows: (rows) => rows.map((r) => ({ ...r, building: plan(r)?.building || r.building, floor: plan(r)?.floor || r.floor })),
    selectFilters: [{ key: 'evacuation_plan_id', label: 'All floor plans', options: planOptions.slice(1) }],
    title: 'Emergency Roles by Floor and Zone',
    subtitle: 'Associate responsibilities with existing evacuation maps without changing evacuation routes.',
    actionLabel: 'Assign responsibility', actionIcon: 'add', adminAction: true, onAction: () => edit(null),
    columns: [
      { key: 'role', label: 'Responsibility', render: (r) => h('strong', { class: 'text-gray-900' }, r.role) },
      { key: 'building', label: 'Building', render: (r) => r.building || plan(r)?.building || 'Unlinked' },
      { key: 'floor', label: 'Floor', render: (r) => r.floor || plan(r)?.floor || 'Unlinked' },
      { key: 'zone', label: 'Zone' },
      { key: 'staff', label: 'Assigned staff' },
      { key: 'backup', label: 'Backup', render: (r) => r.backup || '—' },
      { key: 'actions', label: 'Actions', cls: 'workspace-actions-column', cellCls: 'workspace-actions-cell', render: (r) => rowActions(() => show(r), () => edit(r)) },
    ],
    searchKeys: ['role', 'staff', 'zone', 'backup', 'building', 'floor'],
    searchPlaceholder: 'Search role, floor, zone or person…',
    empty: { title: 'No emergency roles assigned', text: 'Link staff responsibilities to an existing evacuation floor plan.' },
  });
}

const supplyFields = [
  { key: 'item', label: 'Item name', required: true, maxLength: 255 },
  { key: 'description', label: 'Item description / pack size', type: 'textarea', wide: true, maxLength: 500, placeholder: 'e.g. Box of 100 pcs' },
  { key: 'category', label: 'Supply category', maxLength: 80, placeholder: 'e.g. Wound Care, PPE, Emergency' },
  { key: 'quantity', label: 'Quantity', type: 'number', min: 0, required: true },
  { key: 'unit', label: 'Unit', maxLength: 20 },
  { key: 'location', label: 'Storage location', required: true, maxLength: 255 },
  { key: 'expiry', label: 'Expiration date', type: 'date' },
  { key: 'reorder_threshold', label: 'Reorder threshold', type: 'number', min: 0, required: true, defaultValue: 0 },
  { key: 'last_restocked', label: 'Last restocked', type: 'date' },
];

// Preserve the existing exported status shape for callers of this module.
export function supplyStatus(record, now = new Date()) {
  const label = inventoryStatus(record, schoolToday(now));
  return { label, tone: supplyTone(record, schoolToday(now)) };
}

export async function firstAidSupplies(el) {
  if (!isAdmin()) {
    el.replaceChildren(errorBanner('First aid supplies are visible to administrators only.'));
    return;
  }
  const edit = (record) => recordForm({
    title: record ? 'Edit first aid supply' : 'Add first aid supply',
    table: 'supplies', record, fields: supplyFields, onSaved: () => firstAidSupplies(el),
  });
  const stock = inventoryStatus;
  const show = (r) => viewRecord('Supply details: ' + r.item, {
    ...r, stock_status: stock(r),
  }, [...supplyFields.map(({ key, label, type }) => ({ key, label, type })),
    { key: 'stock_status', label: 'Stock status' }, { key: 'created_at', label: 'Record created', type: 'date' }],
  [{ label: 'Edit supply', onClick: () => edit(r) }, { label: 'Delete supply', onClick: () => confirmDelete({ title: r.item, table: 'supplies', record: r, onSaved: () => firstAidSupplies(el) }) }]);
  const moreActions = (record) => {
    const body = h('div', { class: 'p-6 space-y-4' }, h('h3', { class: 'text-lg font-bold' }, 'Supply actions: ' + record.item));
    const modal = openModal(body, { delay: 0 });
    const action = (label, run) => h('button', { type: 'button', class: 'btn-ghost', onclick: () => { modal.close(); run(); } }, label);
    body.appendChild(h('div', { class: 'flex flex-wrap gap-3' },
      action('Edit supply', () => edit(record)),
      action('View stock history', () => openRecordHistory('supplies', record, supplyFields)),
      action('Delete supply', () => confirmDelete({ title: record.item, table: 'supplies', record, onSaved: () => firstAidSupplies(el) })),
      h('button', { type: 'button', class: 'btn-primary', onclick: () => modal.close() }, 'Cancel')));
  };
  const columns = [
    { key: 'item', label: 'Item', render: (r) => h('div', {}, h('strong', { class: 'text-gray-900' }, r.item), r.description ? h('small', { class: 'block text-gray-500 mt-1' }, r.description) : null) },
    { key: 'category', label: 'Category', render: (r) => r.category ? pill(r.category, supplyCategoryTone(r.category)) : 'Not recorded' },
    { key: 'quantity', label: 'Quantity', render: (r) => h('span', { class: Number(r.quantity) <= Number(r.reorder_threshold) ? 'font-bold text-red-600' : 'font-semibold text-gray-900' }, `${r.quantity} ${r.unit || ''}`.trim()) },
    { key: 'location', label: 'Location' },
    { key: 'expiry', label: 'Expiry date', render: (r) => formatDate(r.expiry) },
    { key: 'reorder_threshold', label: 'Reorder threshold' },
    { key: 'stock_status', label: 'Status', render: (r) => pill(stock(r), supplyTone(r)) },
    { key: 'actions', label: 'Actions', cls: 'workspace-actions-column', cellCls: 'workspace-actions-cell', render: (r) => rowActions(
      () => show(r),
      () => edit(r),
      { compact: true, onMore: () => moreActions(r) },
    ) },
  ];
  const rows = await loadTable(el, {
    table: 'supplies', columns, iconName: 'medical_services', onRetry: () => firstAidSupplies(el),
    title: 'First Aid Supplies', subtitle: 'Track first aid stock by category and location. Expiring Soon means expiry within 30 days; expired items take priority over low stock.',
    actionLabel: 'Add supply', actionIcon: 'add', adminAction: true, onAction: () => edit(null),
    secondaryActionLabel: 'Notify Stock Handlers', secondaryActionIcon: 'notifications',
    onSecondaryAction: (e) => promptNotifyStockHandlers(null, e?.currentTarget),
    transformRows: (rows) => rows.map((r) => ({ ...r, stock_status: stock(r) })),
    selectFilters: [{ key: 'stock_status', label: 'All statuses', options: ['In Stock', 'Low Stock', 'Expiring Soon', 'Expired'].map((value) => ({ value, label: value })) }],
    searchKeys: ['item', 'description', 'category', 'location', 'unit'],
    searchPlaceholder: 'Search by item, location or unit…',
    empty: { title: 'No supplies tracked yet', text: 'Add the first supply item to begin inventory tracking.' },
  });
  el.firstElementChild?.classList.add('supplies-workspace');
  return rows;
}
