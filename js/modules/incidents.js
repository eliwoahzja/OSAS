import {
  h, icon, pill, formatDate, inputCls, labelCls,
  capitalize, toast, openModal, checkRow,
} from '../ui.js';
import * as api from '../api.js';
import { isAdmin, currentUser } from '../auth.js';
import { incidentLabels } from '../labels.js';
import { loadTable } from './table-loader.js';
import { viewRecord, recordForm, rowActions, confirmDelete } from './record-actions.js';

export const INCIDENT_TYPES = ['medical', 'slips/falls', 'fire-related', 'security', 'equipment failure'];
export const SEVERITIES = ['low', 'medium', 'high'];

const CONTACT_FIELDS = [
  { key: 'name', label: 'Contact person / organization', required: true, maxLength: 255 },
  { key: 'phone', label: 'Contact number', required: true, maxLength: 50 },
  { key: 'email', label: 'Email address', type: 'email' },
  { key: 'relationship', label: 'Relationship / organization' },
  { key: 'priority', label: 'Priority', type: 'number', min: 1 },
];
export async function emergencyContacts(el) {
  const admin = isAdmin();
  const studentDisplay = (r) => {
    const s = Array.isArray(r.students) ? r.students[0] : r.students;
    return s ? `${s.name}${s.grade ? ` · Grade ${s.grade}` : ''}` : 'Not linked';
  };
  const edit = (r) => recordForm({
    title: 'Edit emergency contact', table: 'emergency_contacts', record: r,
    fields: r.category === 'school'
      ? [...CONTACT_FIELDS, { key: 'role', label: 'Service / contact type', required: true }]
      : CONTACT_FIELDS,
    validate: (p) => p.phone?.length > 50 ? 'Contact number is too long.' : '',
    onSaved: () => emergencyContacts(el),
  });
  const show = (r) => viewRecord('Emergency contact details', {
    ...r,
    contact_type: r.category === 'school' ? (r.role || 'School / agency') : 'Parent / Guardian',
    student: studentDisplay(r),
    status_label: r.active === false ? 'Inactive' : 'Active',
  }, [
    { key: 'name', label: 'Contact person / organization' },
    { key: 'contact_type', label: 'Emergency service / type' },
    { key: 'phone', label: 'Contact number' },
    { key: 'email', label: 'Email' },
    { key: 'relationship', label: 'Relationship' },
    { key: 'student', label: 'Linked student' },
    { key: 'priority', label: 'Priority' },
    { key: 'status_label', label: 'Status' },
  ], admin ? [{ label: 'Edit contact', onClick: () => edit(r) }, { label: 'Delete contact', onClick: () => confirmDelete({ title: r.name, table: 'emergency_contacts', record: r, onSaved: () => emergencyContacts(el) }) }] : []);
  const toggle = async (r, button) => {
    if (!isAdmin() || typeof r.active !== 'boolean') return;
    button.disabled = true;
    try {
      await api.updateRow('emergency_contacts', r.id, { active: !r.active });
      toast(r.active ? 'Contact deactivated.' : 'Contact activated.');
      await emergencyContacts(el);
    } catch (e) { toast(e.message || 'Could not update contact status.', 'error'); button.disabled = false; }
  };
  const columns = [
    { key: 'name', label: 'Contact person', render: (r) => h('span', { class: 'font-semibold text-gray-900' }, r.name) },
    { key: 'contact_type', label: 'Emergency service / type', render: (r) => r.category === 'school' ? (r.role || 'School / agency') : 'Parent / Guardian' },
    { key: 'phone', label: 'Contact number', render: (r) => h('span', { class: 'font-mono text-sm whitespace-nowrap' }, r.phone) },
    { key: 'email', label: 'Email', render: (r) => r.email || '—' },
    { key: 'student', label: 'Linked student', render: (r) => r.category === 'student' ? studentDisplay(r) : '—' },
    { key: 'status', label: 'Status', render: (r) => pill(r.active === false ? 'inactive' : 'active') },
    { key: 'actions', label: 'Actions', render: (r) => h('div', { class: 'flex flex-wrap gap-1 items-center' },
      rowActions(() => show(r), admin ? () => edit(r) : null),
      admin && typeof r.active === 'boolean' ? h('button', {
        type: 'button', class: 'btn-ghost text-xs',
        title: r.active ? 'Deactivate contact' : 'Activate contact',
        'aria-label': r.active ? 'Deactivate contact' : 'Activate contact',
        onclick: (e) => toggle(r, e.currentTarget),
      }, r.active ? 'Deactivate' : 'Activate') : null,
    ) },
  ];
  return loadTable(el, {
    table: 'emergency_contacts', columns, iconName: 'contacts',
    title: 'Emergency Contacts',
    subtitle: 'School responders, emergency services and linked guardians. Contact details come from verified school records.',
    actionLabel: 'Add contact', actionIcon: 'add', onAction: () => contactForm(el),
    adminAction: true,
    searchKeys: ['name', 'email', 'phone', 'relationship', 'role'],
    searchPlaceholder: 'Search by person, organization, phone or email…',
    selectFilters: [
      { key: 'category', label: 'All contact types', options: [{ value: 'student', label: 'Parents / Guardians' }, { value: 'school', label: 'School / agency' }] },
      { key: 'active', label: 'All statuses', options: [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }] },
    ],
    empty: { title: 'No emergency contacts', text: 'Administrators add verified school and emergency responders here.' },
  });
}

function contactForm(el) {
  let closeModal = () => {};
  const form = h('form', { class: 'bg-white rounded-3xl shadow-sm border border-gray-100 overflow-visible' },
    h('div', { class: 'px-6 pt-5 pb-4 border-b border-gray-100' }, h('h3', { class: 'text-sm font-bold text-gray-900' }, 'Add Emergency Contact')),
    h('div', { class: 'p-6 grid grid-cols-1 sm:grid-cols-2 gap-4' }));
  const grid = form.querySelector('.grid');
  const f = { category: 'student', name: '', relationship: '', role: 'School Nurse', phone: '', email: '', priority: '', studentId: '' };

  const txt = (label, placeholder, onChange) => h('div', {},
    h('label', { class: labelCls }, label),
    h('input', { class: inputCls, placeholder, oninput: (e) => onChange(e.target.value) }));

  const catSel = h('select', {
    class: inputCls,
    onchange: (e) => { f.category = e.target.value; syncCategory(); },
  },
  h('option', { value: 'student' }, 'Parent / Guardian'),
  h('option', { value: 'school' }, 'School / Agency responder'));
  grid.appendChild(h('div', {}, h('label', { class: labelCls }, 'Type'), catSel));

  grid.appendChild(txt('Full Name', 'e.g. Ms. Ana Reyes', (v) => { f.name = v; }));
  grid.appendChild(txt('Phone', 'e.g. 0917 555 1000', (v) => { f.phone = v; }));
  grid.appendChild(txt('Email', 'Email address (optional)', (v) => { f.email = v; }));
  grid.appendChild(h('p', { class: 'lg-field-hint sm:col-span-2' }, 'Phone format: 11-digit mobile (09xx xxx xxxx) or landline (02) 8-xxx-xxxx. Email format: name@domain.com.'));

  const studentWrap = h('div', { class: 'sm:col-span-2' });
  grid.appendChild(studentWrap);
  const schoolWrap = h('div', { class: 'sm:col-span-2 hidden' });
  grid.appendChild(schoolWrap);

  const studentSel = h('select', { class: inputCls, onchange: (e) => { f.studentId = e.target.value; } }, h('option', { value: '' }, 'No linked student (general parent)'));
  api.listRows('students').then((students) => {
    students.forEach((s) => studentSel.appendChild(h('option', { value: s.id }, `${s.name} — Grade ${s.grade}${s.section ? ` (${s.section})` : ''}`)));
  }).catch(() => {});

  const roleSel = h('select', { class: inputCls, onchange: (e) => { f.role = e.target.value; } },
    ['School Nurse', 'School Physician', 'Security Head', 'Nearest Police Station', 'Nearest Fire Station', 'Nearest Hospital', 'OSAS Staff', 'Custodian'].map((r) =>
      h('option', { value: r, selected: r === f.role }, r)));

  function syncCategory() {
    if (f.category === 'school') {
      studentWrap.classList.add('hidden');
      schoolWrap.classList.remove('hidden');
      schoolWrap.replaceChildren(h('label', { class: labelCls }, 'Role'), roleSel);
    } else {
      schoolWrap.classList.add('hidden');
      studentWrap.classList.remove('hidden');
      studentWrap.replaceChildren(h('label', { class: labelCls }, 'Linked Student (optional)'), studentSel);
    }
  }
  syncCategory();

  grid.appendChild(txt('Relationship (optional)', 'e.g. Mother, Guard', (v) => { f.relationship = v; }));
  grid.appendChild(txt('Priority (optional)', '1 = highest, e.g. 1', (v) => { f.priority = v; }));

  const errBox = h('p', { class: 'hidden sm:col-span-2 text-[13px] text-red-600 bg-red-50 border border-red-200/70 rounded-xl px-3.5 py-2.5' });
  grid.appendChild(errBox);
  grid.appendChild(h('div', { class: 'sm:col-span-2 flex items-center gap-3 pt-1' },
    h('button', { type: 'submit', class: 'btn-primary' }, icon('add', 'text-base'), 'Save Contact'),
    h('button', { type: 'button', class: 'btn-ghost', onclick: () => closeModal() }, 'Cancel')));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!f.name.trim() || !f.phone.trim()) { errBox.textContent = 'Name and phone are required.'; errBox.classList.remove('hidden'); return; }
    if (f.category === 'school' && !f.role.trim()) { errBox.textContent = 'Assign a role for the school / agency responder.'; errBox.classList.remove('hidden'); return; }
    errBox.classList.add('hidden');
    const btn = grid.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Saving…';
    const priority = f.priority && !Number.isNaN(Number(f.priority)) ? Number(f.priority) : null;
    const payload = f.category === 'school'
      ? { category: 'school', name: f.name.trim(), role: f.role.trim(), relationship: f.relationship.trim() || null, phone: f.phone.trim(), email: f.email.trim() || null, priority }
      : { category: 'student', name: f.name.trim(), relationship: f.relationship.trim() || null, phone: f.phone.trim(), email: f.email.trim() || null, student_id: f.studentId || null, priority };
    try {
      await api.insertRow('emergency_contacts', payload);
      toast(`Contact ${f.name.trim()} added.`);
      closeModal();
      emergencyContacts(el);
    } catch (err) {
      errBox.textContent = err.message || 'Could not save the contact.';
      errBox.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'Save Contact';
    }
  });

  closeModal = openModal(form).close;
}

export async function incidentLogging(el) {
  const L = incidentLabels(isAdmin());
  const columns = [
    { key: 'id', label: 'ID', render: (r) => h('span', { class: 'text-gray-400 font-mono text-xs whitespace-nowrap' }, r.id) },
    { key: 'date', label: 'Date / Time', render: (r) => h('span', { class: 'whitespace-nowrap' }, h('span', { class: 'font-semibold text-gray-900' }, formatDate(r.date)), h('span', { class: 'text-gray-400' }, ` · ${r.time}`)) },
    { key: 'type', label: 'Type', render: (r) => pill(r.type) },
    { key: 'location', label: 'Location' },
    { key: 'description', label: 'Description', render: (r) => h('span', { class: 'block w-72 max-w-[22rem] text-gray-600 leading-snug' }, r.description) },
    { key: 'reporter', label: 'Reporter' },
    { key: 'severity', label: 'Severity', render: (r) => pill(r.severity) },
    { key: 'status', label: 'Status', render: (r) => pill(r.status) },
  ];

  return loadTable(el, {
    table: 'incidents', columns, iconName: 'report',
    title: L.nav,
    subtitle: L.subtitle,
    actionLabel: L.action,
    searchKeys: ['type', 'location', 'description', 'reporter', 'status'],
    searchPlaceholder: 'Search by type, location, or reporter…',
    empty: { title: L.emptyTitle, text: L.emptyText },
    onAction: () => incidentForm(el),
  });
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
  const f = { type: 'medical', location: '', description: '', severity: 'medium', studentId: '', notifyParent: false };

  const sel = (label, options, val, onChange) => {
    return h('div', {}, h('label', { class: labelCls }, label),
      h('select', { class: inputCls, onchange: (e) => onChange(e.target.value) },
        options.map((o) => h('option', { value: o, selected: o === val }, capitalize(o)))));
  };
  const txt = (label, placeholder, onChange) => {
    return h('div', {}, h('label', { class: labelCls }, label),
      h('input', { class: inputCls, placeholder, oninput: (e) => onChange(e.target.value) }));
  };

  grid.appendChild(sel('Type', INCIDENT_TYPES, f.type, (v) => { f.type = v; }));
  grid.appendChild(sel('Severity', SEVERITIES, f.severity, (v) => { f.severity = v; }));
  grid.appendChild(txt('Location', 'e.g. Gymnasium', (v) => { f.location = v; }));
  const reporter = reporterName();
  grid.appendChild(h('div', {}, h('label', { class: labelCls, for: 'incident-reporter' }, 'Reporter'),
    h('div', { class: 'relative' },
      h('input', {
        id: 'incident-reporter', class: `${inputCls} bg-gray-50 pr-9 text-gray-500 cursor-not-allowed`,
        value: reporter, readonly: true, 'aria-readonly': 'true',
      }),
      icon('lock', 'text-[11px] text-gray-400 absolute right-3.5 top-1/2 -translate-y-1/2'),
    ),
    h('p', { class: 'lg-field-hint' }, 'Auto-filled from your account')));
  grid.appendChild(h('div', { class: 'sm:col-span-2' }, h('label', { class: labelCls }, 'Description'),
    h('textarea', { class: `${inputCls} min-h-[80px] resize-y`, placeholder: 'What happened?', oninput: (e) => { f.description = e.target.value; } })));

  const studentWrap = h('div', { class: 'sm:col-span-2' });
  grid.appendChild(studentWrap);
  const notifyWrap = h('div', { class: 'hidden sm:col-span-2 flex items-center gap-3' });
  grid.appendChild(notifyWrap);

  api.listRows('students').then((students) => {
    const picker = h('select', { class: inputCls, onchange: (e) => { f.studentId = e.target.value; renderNotify(); } },
      h('option', { value: '' }, 'No student involved'),
      students.map((s) => h('option', { value: s.id }, `${s.name} — Grade ${s.grade}`)));
    studentWrap.appendChild(h('label', { class: labelCls }, 'Student (optional — enables parent alert)'));
    studentWrap.appendChild(picker);
  }).catch(() => {
    studentWrap.appendChild(h('p', { class: 'text-[12px] text-gray-400' }, 'Student list unavailable.'));
  });

  const renderNotify = () => {
    notifyWrap.innerHTML = '';
    if (!f.studentId) { notifyWrap.classList.add('hidden'); return; }
    if (!isAdmin()) return;
    notifyWrap.classList.remove('hidden');
    notifyWrap.appendChild(checkRow({
      id: 'incident-notify',
      label: 'Notify parent?',
      hint: 'Emails an urgent incident alert linked to this incident.',
      checked: f.notifyParent,
      onChange: (v) => { f.notifyParent = v; },
    }));
  };

  const errBox = h('p', { class: 'hidden sm:col-span-2 text-[13px] text-red-600 bg-red-50 border border-red-200/70 rounded-xl px-3.5 py-2.5' });
  grid.appendChild(errBox);
  grid.appendChild(h('div', { class: 'sm:col-span-2 flex items-center gap-3 pt-1' },
    h('button', { type: 'submit', class: 'btn-primary' }, icon('send', 'text-base'), L.submit),
    h('button', { type: 'button', class: 'btn-ghost', onclick: () => closeModal() }, 'Cancel')));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!f.location.trim() || !f.description.trim()) {
      errBox.textContent = 'Location and description are required.';
      errBox.classList.remove('hidden');
      return;
    }
    errBox.classList.add('hidden');
    const btn = grid.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Saving…';
    try {
      const created = await api.insertRow('incidents', {
        date: new Date().toISOString().slice(0, 10),
        time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        type: f.type, location: f.location.trim(), description: f.description.trim(),
        reporter, severity: f.severity,
        status: 'open', student_id: f.studentId || null,
      });
      if (f.notifyParent && f.studentId && isAdmin()) {
        const res = await api.sendNotification({
          notif_type: 'incident_alert', priority: 'urgent',
          student_id: f.studentId,
          notify_all_parents: false,
          related_incident_id: created.id,
          title: `${capitalize(f.type)} — Student Incident`,
          message: f.description.trim(),
          contact_method: 'email',
        });
        toast(res.ok ? L.alertSent(created.id, res.channel) : L.alertFailed(created.id, res.error), res.ok ? 'success' : 'error');
      } else {
        toast(L.saved(created.id));
      }
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
