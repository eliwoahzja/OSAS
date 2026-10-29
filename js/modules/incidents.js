import {
  h, icon, pill, formatDate, inputCls, labelCls,
  capitalize, toast, openModal,
} from '../ui.js';
import * as api from '../api.js';
import { isAdmin, currentUser, subscribeIncidentChanges } from '../auth.js';
import { incidentLabels } from '../labels.js';
import { loadTable } from './table-loader.js';
import { startDashboardUpdates } from '../live-dashboard.js';
import { viewRecord, recordForm, rowActions, confirmDelete } from './record-actions.js';

export const INCIDENT_TYPES = ['medical', 'slips/falls', 'fire-related', 'security', 'equipment failure'];
export const SEVERITIES = ['low', 'medium', 'high'];

const CONTACT_FIELDS = [
  { key: 'name', label: 'Contact person / organization', required: true, maxLength: 255 },
  { key: 'role', label: 'Emergency type / service', required: true, maxLength: 255 },
  { key: 'phone', label: 'Contact number', required: true, maxLength: 50 },
  { key: 'email', label: 'Email address', type: 'email' },
  { key: 'address', label: 'Address / location', type: 'textarea', wide: true },
];

// Present a service category even for older contacts stored with a staff-role label.
const contactEmergencyType = (role) => {
  const value = String(role || '').trim();
  if (/nurs|physician|clinic|hospital|medical|health|doctor/i.test(value)) return 'Medical';
  if (/secur|police|guard/i.test(value)) return 'Security';
  if (/fire/i.test(value)) return 'Fire';
  if (/rescue|ambulance/i.test(value)) return 'Rescue';
  return value || 'Other';
};

export async function emergencyContacts(el) {
  const admin = isAdmin();
  const edit = (r) => recordForm({
    title: 'Edit emergency contact', table: 'emergency_contacts', record: r,
    fields: CONTACT_FIELDS,
    onSaved: () => emergencyContacts(el),
  });
  const show = (r) => viewRecord('Emergency contact details', {
    ...r, contact_type: contactEmergencyType(r.role),
    status_label: r.active === false ? 'Inactive' : 'Active',
  }, [
    { key: 'name', label: 'Contact person / organization' },
    { key: 'contact_type', label: 'Emergency type' },
    { key: 'role', label: 'Service / role' },
    { key: 'phone', label: 'Contact number' },
    { key: 'email', label: 'Email' },
    { key: 'address', label: 'Address / location' },
    { key: 'status_label', label: 'Status' },
  ], admin ? [
    { label: 'Edit contact', onClick: () => edit(r) },
    { label: 'Delete contact', onClick: () => confirmDelete({
      title: r.name, table: 'emergency_contacts', record: r,
      onSaved: () => emergencyContacts(el),
    }) },
  ] : []);
  const toggle = async (r, button) => {
    if (!admin) return;
    button.disabled = true;
    try {
      await api.updateRow('emergency_contacts', r.id, { active: r.active === false });
      toast(r.active === false ? 'Contact activated.' : 'Contact deactivated.');
      await emergencyContacts(el);
    } catch (e) {
      toast(e.message || 'Could not update contact status.', 'error');
      button.disabled = false;
    }
  };
  const columns = [
    { key: 'name', label: 'Contact person', render: (r) => h('span', { class: 'font-semibold text-gray-900' }, r.name) },
    { key: 'role', label: 'Emergency type', render: (r) => contactEmergencyType(r.role) },
    { key: 'phone', label: 'Contact number', render: (r) => h('span', { class: 'font-mono text-sm whitespace-nowrap' }, r.phone) },
    { key: 'status', label: 'Status', render: (r) => pill(r.active === false ? 'Inactive' : 'Active') },
    { key: 'actions', label: 'Actions', render: (r) => h('div', { class: 'flex flex-wrap gap-1 items-center' },
      // Students always receive a read-only View action.
      rowActions(() => show(r), admin ? () => edit(r) : null),
      admin ? h('button', {
        type: 'button', class: 'btn-ghost text-xs',
        title: r.active === false ? 'Activate contact' : 'Deactivate contact',
        'aria-label': r.active === false ? 'Activate contact' : 'Deactivate contact',
        onclick: (e) => toggle(r, e.currentTarget),
      }, r.active === false ? 'Activate' : 'Deactivate') : null,
    ) },
  ];
  return loadTable(el, {
    table: 'emergency_contacts', filters: { category: 'school' },
    columns, iconName: 'contacts', title: 'Emergency Contacts',
    subtitle: 'Verified school personnel and nearby emergency services. Parent / guardian contacts are kept outside this directory.',
    actionLabel: 'Add contact', actionIcon: 'add', onAction: () => contactForm(el),
    adminAction: true,
    searchKeys: ['name', 'phone', 'role'],
    searchPlaceholder: 'Search by name, agency, or contact number…',
    selectFilters: [
      { key: 'active', label: 'All statuses', options: [
        { value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' },
      ] },
    ],
    empty: {
      title: 'No school emergency contacts',
      text: 'Administrators can add verified school staff and nearby emergency agencies.',
    },
  });
}

function contactForm(el) {
  if (!isAdmin()) return;
  let closeModal = () => {};
  const form = h('form', { class: 'bg-white rounded-3xl shadow-sm border border-gray-100' },
    h('div', { class: 'px-6 pt-5 pb-4 border-b border-gray-100' },
      h('h3', { class: 'text-sm font-bold text-gray-900' }, 'Add School Emergency Contact')),
    h('div', { class: 'p-6 grid grid-cols-1 sm:grid-cols-2 gap-4' }));
  const grid = form.querySelector('.grid');
  const fields = [
    { key: 'name', label: 'Contact person / organization', placeholder: 'e.g. School Nurse' },
    { key: 'role', label: 'Emergency type / service', placeholder: 'e.g. Medical, Security, Fire' },
    { key: 'phone', label: 'Contact number', placeholder: 'Verified emergency phone number' },
    { key: 'email', label: 'Email (optional)', placeholder: 'name@domain.com', type: 'email' },
    { key: 'address', label: 'Address / location (optional)', placeholder: 'Verified address of the clinic, station, or office', type: 'textarea', wide: true },
  ];
  const controls = {};
  fields.forEach((f) => {
    const attrs = {
      class: inputCls, placeholder: f.placeholder, required: !['email', 'address'].includes(f.key),
      maxLength: f.key === 'phone' ? 50 : (f.key === 'address' ? 500 : 255),
    };
    controls[f.key] = f.type === 'textarea'
      ? h('textarea', { ...attrs, rows: 3 })
      : h('input', { ...attrs, type: f.type || 'text' });
    grid.appendChild(h('div', { class: f.wide ? 'sm:col-span-2' : '' },
      h('label', { class: labelCls }, f.label), controls[f.key]));
  });
  const errBox = h('p', { class: 'hidden sm:col-span-2 text-[13px] text-red-600' });
  const submit = h('button', { type: 'submit', class: 'btn-primary' }, icon('add', 'text-base'), 'Save Contact');
  grid.appendChild(errBox);
  grid.appendChild(h('div', { class: 'sm:col-span-2 flex items-center gap-3 pt-1' },
    submit,
    h('button', { type: 'button', class: 'btn-ghost', onclick: () => closeModal() }, 'Cancel')));
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!isAdmin()) return;
    const name = controls.name.value.trim();
    const role = controls.role.value.trim();
    const phone = controls.phone.value.trim();
    const email = controls.email.value.trim();
    const address = controls.address.value.trim();
    if (!name || !role || !phone) {
      errBox.textContent = 'Contact person, emergency type and phone are required.';
      errBox.classList.remove('hidden');
      return;
    }
    errBox.classList.add('hidden');
    submit.disabled = true;
    submit.textContent = 'Saving…';
    try {
      await api.insertRow('emergency_contacts', {
        category: 'school', name, role, phone, email: email || null,
        address: address || null, active: true,
      });
      toast('Emergency contact added.');
      closeModal();
      emergencyContacts(el);
    } catch (err) {
      errBox.textContent = err.message || 'Could not save the contact.';
      errBox.classList.remove('hidden');
      submit.disabled = false;
      submit.textContent = 'Save Contact';
    }
  });
  closeModal = openModal(form).close;
  controls.name.focus();
}

const incidentSubscriptions = new WeakMap();
export async function incidentLogging(el) {
  incidentSubscriptions.get(el)?.();
  const admin = isAdmin();
  const L = incidentLabels(isAdmin());
  const columns = [
    { key: 'date', label: 'Date / Time', render: (r) => h('span', { class: 'whitespace-nowrap' }, h('span', { class: 'font-semibold text-gray-900' }, formatDate(r.date)), h('span', { class: 'text-gray-400' }, ` · ${r.time}`)) },
    { key: 'type', label: 'Type', render: (r) => pill(r.type || 'To review') },
    { key: 'location', label: 'Location', render: (r) => r.location || 'Not recorded' },
    { key: 'description', label: 'Description', render: (r) => h('span', { class: 'block w-72 max-w-[22rem] text-gray-600 leading-snug' }, r.description) },
    { key: 'reporter', label: 'Reporter' },
    { key: 'severity', label: 'Severity', render: (r) => pill(r.severity || 'To review') },
    { key: 'status', label: 'Status', render: (r) => h('span', { 'data-incident-status': r.id }, pill(r.status)) },
    ...(admin ? [{ key: 'actions', label: 'Actions', render: (r) => h('button', {
      type: 'button', class: 'btn-ghost text-xs',
      'aria-label': (r.status === 'resolved' ? 'Reopen incident: ' : 'Resolve incident: ') + r.description,
      onclick: () => recordForm({ title: 'Update incident status', table: 'incidents', record: { ...r, status: r.status === 'resolved' ? 'open' : 'resolved' },
        fields: [
          { key: 'status', label: 'Status', type: 'select', required: true, options: [{ value: 'open', label: 'Open' }, { value: 'resolved', label: 'Resolved' }] },
          { key: 'type', label: 'Type', type: 'select', options: [{ value: '', label: 'To review' }, ...INCIDENT_TYPES.map((value) => ({ value, label: capitalize(value) }))] },
          { key: 'severity', label: 'Severity', type: 'select', options: [{ value: '', label: 'To review' }, ...SEVERITIES.map((value) => ({ value, label: capitalize(value) }))] },
          { key: 'location', label: 'Location', maxLength: 255 },
        ],
        onSaved: () => incidentLogging(el),
      }),
    }, r.status === 'resolved' ? 'Reopen' : 'Mark resolved') }] : []),
  ];

  const rows = await loadTable(el, {
    table: 'incidents', columns, iconName: 'report',
    title: L.nav,
    subtitle: L.subtitle,
    actionLabel: admin ? null : L.action,
    searchKeys: ['type', 'location', 'description', 'reporter', 'status'],
    searchPlaceholder: 'Search by type, location, or reporter…',
    empty: { title: L.emptyTitle, text: L.emptyText },
    onAction: () => incidentForm(el),
  });
  if (!admin) {
    const shell = el.firstElementChild;
    const stop = startDashboardUpdates(async () => {
      if (!el.contains(shell)) { stop(); return; }
      const latest = await api.listRows('incidents').catch(() => null);
      if (!latest || !el.contains(shell)) return;
      const statuses = new Map(latest.map((r) => [String(r.id), r.status]));
      el.querySelectorAll('[data-incident-status]').forEach((cell) => {
        const status = statuses.get(cell.dataset.incidentStatus);
        if (status) cell.replaceChildren(pill(status));
      });
    }, subscribeIncidentChanges);
    incidentSubscriptions.set(el, stop);
  }
  return rows;
}

// The reporter is always the signed-in account — nobody types it.
function reporterName() {
  const me = currentUser() || {};
  const name = String(me.name || '').trim();
  if (name && !name.includes('@')) return name;
  return String(me.email || '').trim() || 'OSAS Staff';
}

function incidentForm(el) {
  const L = incidentLabels(isAdmin());
  let closeModal = () => {};
  const form = h('form', { class: 'bg-white rounded-3xl shadow-sm border border-gray-100 overflow-visible' },
    h('div', { class: 'px-6 pt-5 pb-4 border-b border-gray-100' }, h('h3', { class: 'text-sm font-bold text-gray-900' }, L.modalTitle)),
    h('div', { class: 'p-6 grid grid-cols-1 sm:grid-cols-2 gap-4' }));
  const grid = form.querySelector('.grid');
  const f = { description: '' };
  const reporter = reporterName();
  grid.appendChild(h('div', { class: 'sm:col-span-2' }, h('label', { class: labelCls, for: 'incident-reporter' }, 'Reporter'),
    h('div', { class: 'relative' },
      h('input', {
        id: 'incident-reporter', class: `${inputCls} bg-gray-50 pr-9 text-gray-500 cursor-not-allowed`,
        value: reporter, readonly: true, 'aria-readonly': 'true',
      }),
      icon('lock', 'text-[11px] text-gray-400 absolute right-3.5 top-1/2 -translate-y-1/2'),
    ),
    h('p', { class: 'lg-field-hint' }, 'Auto-filled from your account')));
  grid.appendChild(h('div', { class: 'sm:col-span-2' }, h('label', { class: labelCls, for: 'incident-description' }, 'Description'),
    h('textarea', { id: 'incident-description', required: true, maxLength: 10000, class: `${inputCls} min-h-[80px] resize-y`, placeholder: 'Describe what happened and where. Include any immediate help needed.', oninput: (e) => { f.description = e.target.value; } })));

  const errBox = h('p', { class: 'hidden sm:col-span-2 text-[13px] text-red-600 bg-red-50 border border-red-200/70 rounded-xl px-3.5 py-2.5' });
  grid.appendChild(errBox);
  grid.appendChild(h('div', { class: 'sm:col-span-2 flex items-center gap-3 pt-1' },
    h('button', { type: 'submit', class: 'btn-primary' }, icon('send', 'text-base'), L.submit),
    h('button', { type: 'button', class: 'btn-ghost', onclick: () => closeModal() }, 'Cancel')));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!f.description.trim()) {
      errBox.textContent = 'Describe what happened before submitting your report.';
      errBox.classList.remove('hidden');
      return;
    }
    errBox.classList.add('hidden');
    const btn = grid.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Saving…';
    try {
      await api.insertRow('incidents', {
        date: new Date().toISOString().slice(0, 10),
        time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        description: f.description.trim(), reporter, status: 'open',
      });
      toast(L.saved());
      closeModal();
      incidentLogging(el);
    } catch (err) {
      errBox.textContent = err.message;
      errBox.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = L.submit;
    }
  });

  closeModal = openModal(form).close;
}
