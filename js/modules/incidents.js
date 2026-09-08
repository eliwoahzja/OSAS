import {
  h, icon, pill, formatDate, inputCls, labelCls,
  capitalize, toast, openModal,
} from '../ui.js';
import * as api from '../api.js';
import { loadTable } from './table-loader.js';

export const INCIDENT_TYPES = ['medical', 'slips/falls', 'fire-related', 'security', 'equipment failure'];
export const SEVERITIES = ['low', 'medium', 'high'];

export async function emergencyContacts(el) {
  const columns = [
    { key: 'id', label: 'ID', render: (r) => h('span', { class: 'text-gray-400 font-mono text-xs whitespace-nowrap' }, r.id) },
    { key: 'name', label: 'Name', render: (r) => h('span', { class: 'font-semibold text-gray-900' }, r.name) },
    { key: 'student', label: 'Student', render: (r) => {
      const s = Array.isArray(r.students) ? r.students[0] : r.students;
      return r.category === 'student' && s
        ? h('span', { class: 'text-gray-600' }, `${s.name}${s.grade ? ` · Grade ${s.grade}` : ''}`)
        : h('span', { class: 'text-gray-300' }, '—');
    } },
    { key: 'category', label: 'Type', render: (r) => r.category === 'school' ? pill(r.role || 'School', 'purple') : pill('Parent/Guardian', 'blue') },
    { key: 'relationship', label: 'Relationship', render: (r) => r.relationship || h('span', { class: 'text-gray-300' }, '—') },
    { key: 'phone', label: 'Phone', render: (r) => h('span', { class: 'font-mono text-[12px]' }, r.phone || '—') },
    { key: 'email', label: 'Email', render: (r) => h('span', { class: 'text-gray-600' }, r.email || '—') },
    { key: 'priority', label: 'Priority', render: (r) => (r.priority ? pill(`#${r.priority}`, 'pink') : h('span', { class: 'text-gray-300' }, '—')) },
  ];

  return loadTable(el, {
    table: 'emergency_contacts', columns, iconName: 'contacts',
    title: 'Emergency Contact Database',
    subtitle: 'Per-student guardians (priority order) plus school-wide responders: nurse, security head, and nearest police/fire/hospital.',
    searchKeys: ['name', 'email', 'phone', 'relationship', 'role'],
    searchPlaceholder: 'Search by name, email, or phone…',
    selectFilters: [
      { key: 'category', label: 'All types', options: [{ value: 'student', label: 'Parents / Guardians' }, { value: 'school', label: 'School & Agencies' }] },
    ],
    empty: { title: 'No contacts yet', text: 'Add student guardians and school-wide responders to build the emergency directory.' },
  });
}

export async function incidentLogging(el) {
  const columns = [
    { key: 'id', label: 'ID', render: (r) => h('span', { class: 'text-gray-400 font-mono text-xs whitespace-nowrap' }, r.id) },
    { key: 'date', label: 'Date / Time', render: (r) => h('span', { class: 'whitespace-nowrap' }, h('span', { class: 'font-semibold text-gray-900' }, formatDate(r.date)), h('span', { class: 'text-gray-400' }, ` · ${r.time}`)) },
    { key: 'type', label: 'Type', render: (r) => pill(r.type) },
    { key: 'location', label: 'Location' },
    { key: 'description', label: 'Description', render: (r) => h('span', { class: 'block max-w-[320px] text-gray-600' }, r.description) },
    { key: 'reporter', label: 'Reporter' },
    { key: 'severity', label: 'Severity', render: (r) => pill(r.severity) },
    { key: 'status', label: 'Status', render: (r) => pill(r.status) },
  ];

  return loadTable(el, {
    table: 'incidents', columns, iconName: 'report',
    title: 'Incident Logging',
    subtitle: 'Record medical, fire, security, and structural incidents. Incidents tied to a student can auto-notify their parents.',
    actionLabel: 'Log Incident',
    searchKeys: ['type', 'location', 'description', 'reporter', 'status'],
    searchPlaceholder: 'Search by type, location, or reporter…',
    empty: { title: 'No incidents logged yet', text: 'Log the first incident — parent alerts can be sent straight from the form.' },
    onAction: () => incidentForm(el),
  });
}

function incidentForm(el) {
  let closeModal = () => {};
  const form = h('form', { class: 'bg-white rounded-3xl shadow-sm border border-gray-100 overflow-visible' },
    h('div', { class: 'px-6 pt-5 pb-4 border-b border-gray-100' }, h('h3', { class: 'text-sm font-bold text-gray-900' }, 'Log New Incident')),
    h('div', { class: 'p-6 grid grid-cols-1 sm:grid-cols-2 gap-4' }));
  const grid = form.querySelector('.grid');
  const f = { type: 'medical', location: '', description: '', reporter: '', severity: 'medium', studentId: '', notifyParent: false };

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
  grid.appendChild(txt('Reporter', 'Who reported it?', (v) => { f.reporter = v; }));
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
    notifyWrap.classList.remove('hidden');
    notifyWrap.appendChild(h('input', { type: 'checkbox', id: 'incident-notify', class: 'w-4 h-4 accent-pink-600', onchange: (e) => { f.notifyParent = e.target.checked; } }));
    notifyWrap.appendChild(h('label', { for: 'incident-notify', class: 'text-[13px] font-semibold text-gray-700' },
      'Notify parent? ', h('span', { class: 'text-gray-400 font-normal' }, 'Emails an urgent incident alert linked to this incident.')));
  };

  const errBox = h('p', { class: 'hidden sm:col-span-2 text-[13px] text-red-600 bg-red-50 border border-red-200/70 rounded-xl px-3.5 py-2.5' });
  grid.appendChild(errBox);
  grid.appendChild(h('div', { class: 'sm:col-span-2 flex items-center gap-3 pt-1' },
    h('button', { type: 'submit', class: 'btn-primary' }, icon('send', 'text-base'), 'Save Incident'),
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
      // WHY: Under Philippine RA 10173, student medical remarks & disciplinary records
      // must remain confidential and segregated from public bulletin exports.
      // FIXME: When multiple emergency contacts exist, dispatch priority goes to primary guardian;
      // secondary emergency contact is notified if primary remains unacknowledged after 15 min.
      const created = await api.insertRow('incidents', {
        date: new Date().toISOString().slice(0, 10),
        time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        type: f.type, location: f.location.trim(), description: f.description.trim(),
        reporter: f.reporter.trim() || 'OSAS Staff', severity: f.severity,
        status: 'open', student_id: f.studentId || null,
      });
      if (f.notifyParent && f.studentId) {
        const res = await api.sendNotification({
          notif_type: 'incident_alert', priority: 'urgent',
          student_id: f.studentId,
          related_incident_id: created.id,
          title: `${capitalize(f.type)} — Student Incident`,
          message: f.description.trim(),
          contact_method: 'email',
        });
        toast(res.ok ? `Incident ${created.id} logged — parent alert sent via ${res.channel || 'email'}.` : `Incident ${created.id} logged ⚠ ${res.error || 'Parent alert could not be sent.'}`);
      } else {
        toast(`Incident ${created.id} logged.`);
      }
      closeModal();
      incidentLogging(el);
    } catch (err) {
      errBox.textContent = err.message;
      errBox.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'Save Incident';
    }
  });

  closeModal = openModal(form).close;
}
