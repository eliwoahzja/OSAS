import {
  h, icon, pill, formatDate, openModal, toast,
} from '../ui.js';
import * as api from '../api.js';
import { loadTable } from './table-loader.js';

export async function promptNotifyStockHandlers(lowItems = null, triggerBtn = null) {
  let items = lowItems;
  if (!items || !items.length) {
    try {
      const all = await api.listRows('supplies');
      items = all
        .filter((s) => Number(s.quantity) <= Number(s.reorder_threshold))
        .map((s) => ({
          item: s.item,
          quantity: Number(s.quantity),
          reorder_threshold: Number(s.reorder_threshold),
          location: s.location || 'Clinic',
          unit: s.unit || '',
        }));
    } catch {
      items = [];
    }
  }

  const defaultRecipient = {
    name: 'Ms. Corazon Dela Peña',
    role: 'School Nurse (Clinic Stock Custodian)',
    email: 'nurse@saac.edu.ph',
    phone: '0917 555 0001',
  };

  const hasDepleted = items && items.length > 0;

  const content = h('div', { class: 'p-6 sm:p-7 space-y-6 max-w-xl' },
    h('div', { class: 'flex items-start justify-between gap-4' },
      h('div', { class: 'flex items-start gap-3.5' },
        h('div', { class: 'w-11 h-11 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shrink-0 shadow-xs' },
          icon('notifications', 'text-xl'),
        ),
        h('div', {},
          h('h3', { class: 'text-lg sm:text-xl font-bold text-gray-900 leading-tight' }, 'Notify Clinic Stock Handlers'),
          h('p', { class: 'text-xs sm:text-sm text-gray-500 mt-1' },
            'Dispatch an official restock alert to designated school health and clinic staff.',
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
      h('p', { class: 'text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5' }, 'Designated Recipient (Stock Custodian)'),
      h('div', { class: 'flex items-center justify-between gap-3' },
        h('div', {},
          h('p', { class: 'text-sm font-bold text-gray-900' }, defaultRecipient.name),
          h('p', { class: 'text-xs text-gray-500 mt-0.5' }, `${defaultRecipient.role} · ${defaultRecipient.phone}`),
        ),
        h('span', { class: 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200 shrink-0' },
          icon('verified', 'text-xs'),
          'On Duty',
        ),
      ),
    ),

    h('div', { class: 'space-y-2.5' },
      h('div', { class: 'flex items-center justify-between' },
        h('p', { class: 'text-[10px] font-bold uppercase tracking-wider text-gray-400' },
          hasDepleted ? `Depleted Supplies Requiring Reorder (${items.length})` : 'Supplies Status',
        ),
        hasDepleted ? h('span', { class: 'text-[11px] font-semibold text-red-600' }, 'Action Required') : null,
      ),
      hasDepleted ? h('div', { class: 'max-h-52 overflow-y-auto space-y-2 pr-1' },
        items.map((it) => h('div', { class: 'flex items-center justify-between bg-red-50/50 border border-red-100 rounded-xl p-3 text-xs' },
          h('div', { class: 'min-w-0 pr-3' },
            h('p', { class: 'font-bold text-gray-900 truncate' }, it.item),
            h('p', { class: 'text-gray-500 text-[11px] mt-0.5' }, it.location ? `Location: ${it.location}` : 'Clinic Storage'),
          ),
          h('div', { class: 'text-right shrink-0' },
            h('span', { class: 'inline-block px-2 py-0.5 rounded-md bg-red-100 text-red-700 font-bold' },
              `${it.quantity} ${it.unit || ''}`.trim() + ' left',
            ),
            h('p', { class: 'text-[10px] text-gray-500 mt-0.5' }, `Threshold: ${it.reorder_threshold}`),
          ),
        )),
      ) : h('div', { class: 'bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-xs text-emerald-800 flex items-center gap-2.5' },
        icon('check_circle', 'text-emerald-600 text-base shrink-0'),
        h('span', {}, 'All tracked first aid supplies currently meet or exceed their reorder thresholds. You can still send a routine check-in notice.'),
      ),
    ),

    h('div', { class: 'flex items-center justify-end gap-3 pt-3 border-t border-gray-100' },
      h('button', {
        class: 'px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold transition-colors clickable',
        onclick: () => modal.close(),
      }, 'Cancel'),
      h('button', {
        id: 'btn-confirm-send-stock-alert',
        class: 'px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-sm transition-colors flex items-center gap-2 clickable',
        onclick: async (e) => {
          const btn = e.currentTarget;
          btn.disabled = true;
          btn.textContent = 'Sending notification…';
          try {
            const summaryText = hasDepleted
              ? items.map((x) => `${x.item} (${x.quantity} left, reorder at ${x.reorder_threshold})`).join('; ')
              : 'All supplies currently above reorder thresholds.';
            const startTime = new Date();
            const endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000);
            const res = await api.sendNotification({
              notif_type: 'event_notice',
              priority: 'informational',
              audience_group: 'Clinic Staff / Stock Custodians',
              title: hasDepleted ? 'Urgent: Low First Aid Supplies Restock Alert' : 'Routine First Aid Supplies Status Check',
              message: `Attention ${defaultRecipient.name} (${defaultRecipient.role}): ${hasDepleted ? `The following medical items are depleted and require immediate restocking: ${summaryText}` : 'All clinic supplies verified in good standing.'}`,
              event_start_at: startTime.toISOString(),
              event_end_at: endTime.toISOString(),
              contact_method: 'email',
            });
            if (res && res.ok === false) {
              throw new Error(res.error || 'Failed to dispatch notification');
            }
            modal.close();
            toast(`Restock notification dispatched to ${defaultRecipient.name}.`);
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

/**
 * Routine school safety inspections checklist.
 * 
 * WHY:
 * BFP and DepEd mandate minimum inspection intervals (e.g. fire extinguishers checked
 * every 6 months, exit routes inspected monthly). Flagging items as 'overdue' prevents
 * lapses before regional DepEd accreditation audits.
 */
export async function safetyInspections(el) {
  const columns = [
    { key: 'id', label: 'ID', render: (r) => h('span', { class: 'text-gray-400 font-mono text-xs whitespace-nowrap' }, r.id) },
    { key: 'item', label: 'Inspection Item', render: (r) => h('span', { class: 'font-semibold text-gray-900' }, r.item) },
    { key: 'area', label: 'Area / Location' },
    { key: 'frequency', label: 'Frequency' },
    { key: 'last_inspected', label: 'Last Inspected', render: (r) => h('span', { class: 'whitespace-nowrap text-gray-500' }, formatDate(r.last_inspected)) },
    { key: 'status', label: 'Status', render: (r) => pill(r.status) },
    { key: 'inspector', label: 'Inspector' },
    { key: 'notes', label: 'Follow-up Notes', render: (r) => r.notes ? h('span', { class: 'block max-w-[300px] text-gray-600' }, r.notes) : h('span', { class: 'text-gray-300' }, '—') },
  ];
  return loadTable(el, {
    table: 'inspections', columns, iconName: 'fact_check',
    title: 'Safety Inspection Checklist',
    subtitle: 'Track inspection items per area with frequency, status, and follow-up notes. Items past their due date are auto-flagged Overdue.',
    searchKeys: ['item', 'area', 'inspector', 'status', 'notes'],
    searchPlaceholder: 'Search by item, area, or inspector…',
    empty: { title: 'No inspections recorded yet', text: 'Add the first inspection item to start the compliance checklist.' },
  });
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

export async function firstAidSupplies(el) {
  const columns = [
    { key: 'id', label: 'ID', render: (r) => h('span', { class: 'text-gray-400 font-mono text-xs whitespace-nowrap' }, r.id) },
    { key: 'item', label: 'Item', render: (r) => h('span', { class: 'font-semibold text-gray-900' }, r.item) },
    { key: 'quantity', label: 'Quantity', render: (r) => h('span', { class: `font-bold ${Number(r.quantity) <= Number(r.reorder_threshold) ? 'text-red-600' : 'text-gray-900'}` }, `${r.quantity} ${r.unit || ''}`.trim()) },
    { key: 'location', label: 'Location' },
    { key: 'expiry', label: 'Expiry Date', render: (r) => h('span', { class: 'whitespace-nowrap text-gray-500' }, formatDate(r.expiry)) },
    { key: 'reorder_threshold', label: 'Reorder Threshold', render: (r) => h('span', { class: 'text-gray-500' }, r.reorder_threshold) },
    { key: 'last_restocked', label: 'Last Restocked', render: (r) => h('span', { class: 'whitespace-nowrap text-gray-500' }, formatDate(r.last_restocked)) },
    { key: 'status', label: 'Status', render: (r) => pill(Number(r.quantity) <= Number(r.reorder_threshold) ? 'low' : 'ok') },
  ];
  return loadTable(el, {
    table: 'supplies', columns, iconName: 'medical_services',
    title: 'First Aid Supplies Monitor',
    subtitle: 'Stock levels with expiry dates and reorder thresholds. Items at or below threshold are flagged Low automatically.',
    actionLabel: 'Notify Stock Handlers',
    actionIcon: 'notifications',
    actionClass: 'px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-2 clickable shrink-0',
    onAction: (e) => promptNotifyStockHandlers(null, e?.currentTarget),
    searchKeys: ['item', 'location', 'unit'],
    searchPlaceholder: 'Search by item or location…',
    empty: { title: 'No supplies tracked yet', text: 'Add the first first-aid item to start the stock monitor.' },
  });
}
