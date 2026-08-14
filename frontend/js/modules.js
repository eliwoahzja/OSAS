// ============================================================
// OSAS module pages — 10 modules, vanilla JS, same design system
// and data shapes as the PHP REST API they talk to.
// ============================================================
import { h, icon, pill, dataTable, moduleShell, moduleStats, skeleton, emptyBanner, errorBanner, toast, inputCls, labelCls, capitalize, formatDate, statCard, openModal } from './ui.js';
import * as api from './api.js';

// Per-module summary chips shown above each table (designs the tab content).
const SUMMARY = {
  emergency_contacts: (rows) => [
    { label: 'Total contacts', value: rows.length, icon: 'contacts', chipCls: 'bg-pink-50 text-pink-600' },
    { label: 'Guardians', value: rows.filter((r) => r.category === 'student').length, icon: 'family_restroom', chipCls: 'bg-blue-50 text-blue-600' },
    { label: 'School & agencies', value: rows.filter((r) => r.category === 'school').length, icon: 'local_police', chipCls: 'bg-purple-50 text-purple-600' },
  ],
  drills: (rows) => [
    { label: 'Total drills', value: rows.length, icon: 'person-running', chipCls: 'bg-pink-50 text-pink-600' },
    { label: 'Upcoming', value: rows.filter((r) => r.status === 'upcoming').length, icon: 'schedule', chipCls: 'bg-blue-50 text-blue-600' },
    { label: 'Completed', value: rows.filter((r) => r.status === 'completed').length, icon: 'task_alt', chipCls: 'bg-emerald-50 text-emerald-600' },
  ],
  evacuation_plans: (rows) => [
    { label: 'Floor plans', value: rows.length, icon: 'map', chipCls: 'bg-pink-50 text-pink-600' },
    { label: 'Current versions', value: rows.filter((r) => r.current).length, icon: 'verified', chipCls: 'bg-emerald-50 text-emerald-600' },
  ],
  incidents: (rows) => [
    { label: 'Total incidents', value: rows.length, icon: 'report', chipCls: 'bg-pink-50 text-pink-600' },
    { label: 'Open', value: rows.filter((r) => r.status === 'open').length, icon: 'priority_high', chipCls: 'bg-red-50 text-red-600' },
    { label: 'Resolved', value: rows.filter((r) => r.status === 'resolved').length, icon: 'task_alt', chipCls: 'bg-emerald-50 text-emerald-600' },
  ],
  inspections: (rows) => [
    { label: 'Checklist items', value: rows.length, icon: 'fact_check', chipCls: 'bg-pink-50 text-pink-600' },
    { label: 'Passed', value: rows.filter((r) => r.status === 'passed').length, icon: 'check_circle', chipCls: 'bg-emerald-50 text-emerald-600' },
    { label: 'Overdue', value: rows.filter((r) => r.status === 'overdue').length, icon: 'warning', chipCls: 'bg-red-50 text-red-600' },
  ],
  risks: (rows) => [
    { label: 'Assessed hazards', value: rows.length, icon: 'security', chipCls: 'bg-pink-50 text-pink-600' },
    { label: 'Critical', value: rows.filter((r) => r.risk_level === 'Critical').length, icon: 'dangerous', chipCls: 'bg-red-50 text-red-600' },
  ],
  emergency_roles: (rows) => [
    { label: 'Assignments', value: rows.length, icon: 'groups', chipCls: 'bg-pink-50 text-pink-600' },
    { label: 'With backup', value: rows.filter((r) => r.backup).length, icon: 'support_agent', chipCls: 'bg-blue-50 text-blue-600' },
  ],
  supplies: (rows) => [
    { label: 'Tracked items', value: rows.length, icon: 'medical_services', chipCls: 'bg-pink-50 text-pink-600' },
    { label: 'Low stock', value: rows.filter((r) => Number(r.quantity) <= Number(r.reorder_threshold)).length, icon: 'warning', chipCls: 'bg-red-50 text-red-600' },
  ],
  students: (rows) => [
    { label: 'Students', value: rows.length, icon: 'school', chipCls: 'bg-pink-50 text-pink-600' },
  ],
};

async function loadTable(el, { table, columns, empty, iconName, title, subtitle, actionLabel, onAction, filters = {} }) {
  el.appendChild(moduleShell({ icon: iconName, title, subtitle, actionLabel, onAction }));
  const holder = h('div', { class: 'space-y-5' });
  el.appendChild(holder);
  holder.appendChild(skeleton(5, columns.length));

  let rows;
  try {
    rows = await api.listRows(table, filters);
  } catch (e) {
    holder.replaceChildren(errorBanner(e.message, () => {
      el.innerHTML = '';
      loadTable(el, { table, columns, empty, iconName, title, subtitle, actionLabel, onAction, filters });
    }));
    return;
  }
  if (!rows.length) {
    holder.replaceChildren(emptyBanner({ icon: empty?.icon || iconName, title: empty?.title || 'No records yet', text: empty?.text }));
    return;
  }
  const parts = [];
  if (SUMMARY[table]) parts.push(moduleStats(SUMMARY[table](rows)));
  parts.push(dataTable(columns, rows));
  holder.replaceChildren(...parts);
  return rows;
}

export function emergencyContacts(el) {
  const columns = [
    { key: 'id', label: 'ID', render: (r) => h('span', { class: 'text-gray-400 font-mono text-xs whitespace-nowrap' }, r.id) },
    { key: 'name', label: 'Name', render: (r) => h('span', { class: 'font-semibold text-gray-900' }, r.name) },
    { key: 'category', label: 'Type', render: (r) => r.category === 'school' ? pill(r.role || 'School', 'purple') : pill('Parent/Guardian', 'blue') },
    { key: 'relationship', label: 'Relationship', render: (r) => r.relationship || h('span', { class: 'text-gray-300' }, '—') },
    { key: 'phone', label: 'Phone', render: (r) => h('span', { class: 'font-mono text-[12px]' }, r.phone || '—') },
    { key: 'email', label: 'Email', render: (r) => h('span', { class: 'text-gray-600' }, r.email || '—') },
    { key: 'priority', label: 'Priority', render: (r) => (r.priority ? pill(`#${r.priority}`, 'pink') : h('span', { class: 'text-gray-300' }, '—')) },
  ];
  loadTable(el, {
    table: 'emergency_contacts', columns, iconName: 'contacts',
    title: 'Emergency Contact Database',
    subtitle: 'Per-student guardians (priority order) plus school-wide responders: nurse, security head, and nearest police/fire/hospital.',
    empty: { title: 'No contacts yet', text: 'Add student guardians and school-wide responders to build the emergency directory.' },
  });
}

const DRILL_TYPES = ['Fire', 'Earthquake', 'Lockdown', 'Evacuation'];
const AUDIENCES = ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12', 'All Parents'];

export function drillScheduling(el) {
  const columns = [
    { key: 'id', label: 'ID', render: (r) => h('span', { class: 'text-gray-400 font-mono text-xs whitespace-nowrap' }, r.id) },
    { key: 'type', label: 'Drill Type', render: (r) => pill(r.type) },
    { key: 'date', label: 'Schedule', render: (r) => h('span', { class: 'whitespace-nowrap' }, h('span', { class: 'font-semibold text-gray-900' }, formatDate(r.date)), h('span', { class: 'text-gray-400' }, ` · ${r.time}`)) },
    { key: 'building', label: 'Building / Area' },
    { key: 'personInCharge', label: 'Person in Charge' },
    { key: 'status', label: 'Status', render: (r) => pill(r.status) },
    { key: 'notes', label: 'Outcome Notes', render: (r) => r.notes ? h('span', { class: 'block max-w-[340px] text-gray-600' }, r.notes) : h('span', { class: 'text-gray-300' }, '—') },
  ];

  loadTable(el, {
    table: 'drills', columns, iconName: 'person-running',
    title: 'Drill Scheduling',
    subtitle: 'Plan fire, earthquake, lockdown, and evacuation drills. Scheduled drills can auto-send an event notice to parents.',
    actionLabel: 'Schedule Drill',
    empty: { title: 'No drills scheduled yet', text: 'Schedule the first drill — parent notices can be sent straight from the form.' },
    onAction: () => drillForm(el),
  });
}

function drillForm(el) {
  let closeModal = () => {};
  const form = h('form', { class: 'bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden' },
    h('div', { class: 'px-6 pt-5 pb-4 border-b border-gray-100' }, h('h3', { class: 'text-sm font-bold text-gray-900' }, 'Schedule New Drill')),
    h('div', { class: 'p-6 grid grid-cols-1 sm:grid-cols-2 gap-4' }));
  const grid = form.querySelector('.grid');
  const f = { type: 'Fire', date: '', time: '09:00', building: '', personInCharge: '', notify: false, audience: 'All Parents' };

  const sel = (label, options, val, onChange) => {
    const d = h('div', {}, h('label', { class: labelCls }, label),
      h('select', { class: inputCls, onchange: (e) => onChange(e.target.value) },
        options.map((o) => h('option', { value: o, selected: o === val }, o))));
    return d;
  };
  const txt = (label, placeholder, onChange) => {
    const d = h('div', {}, h('label', { class: labelCls }, label),
      h('input', { class: inputCls, placeholder, oninput: (e) => onChange(e.target.value) }));
    return d;
  };

  grid.appendChild(sel('Drill Type', DRILL_TYPES, f.type, (v) => { f.type = v; }));
  grid.appendChild(txt('Building / Area', 'e.g. Main Building', (v) => { f.building = v; }));

  const dateD = h('div', {}, h('label', { class: labelCls }, 'Date'),
    h('input', { type: 'date', class: inputCls, oninput: (e) => { f.date = e.target.value; } }));
  const timeD = h('div', {}, h('label', { class: labelCls }, 'Time'),
    h('input', { type: 'time', class: inputCls, value: '09:00', oninput: (e) => { f.time = e.target.value; } }));
  grid.appendChild(dateD);
  grid.appendChild(timeD);

  grid.appendChild(txt('Person in Charge', 'e.g. Mr. Lim', (v) => { f.personInCharge = v; }));

  const notifyD = h('div', { class: 'sm:col-span-2 flex items-center gap-3' },
    h('input', { type: 'checkbox', id: 'drill-notify', class: 'w-4 h-4 accent-pink-600', onchange: (e) => { f.notify = e.target.checked; renderAudience(); } }),
    h('label', { for: 'drill-notify', class: 'text-[13px] font-semibold text-gray-700' },
      'Notify parents? ', h('span', { class: 'text-gray-400 font-normal' }, 'Creates an event notice for the selected audience.')));
  grid.appendChild(notifyD);

  const audienceWrap = h('div');
  grid.appendChild(audienceWrap);
  const renderAudience = () => {
    audienceWrap.innerHTML = '';
    if (!f.notify) return;
    audienceWrap.appendChild(sel('Audience Group', AUDIENCES, f.audience, (v) => { f.audience = v; }));
  };

  const errBox = h('p', { class: 'hidden sm:col-span-2 text-[13px] text-red-600 bg-red-50 border border-red-200/70 rounded-xl px-3.5 py-2.5' });
  grid.appendChild(errBox);

  const btnRow = h('div', { class: 'sm:col-span-2 flex items-center gap-3 pt-1' },
    h('button', { type: 'submit', class: 'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-pink-600 text-white text-sm font-semibold shadow-sm hover:bg-pink-700 transition-colors cursor-pointer' }, icon('send', 'text-base'), 'Schedule Drill'),
    h('button', { type: 'button', class: 'px-5 py-2.5 rounded-xl bg-white text-gray-600 text-sm font-semibold border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer', onclick: () => closeModal() }, 'Cancel'));
  grid.appendChild(btnRow);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!f.date || !f.building.trim() || !f.personInCharge.trim()) {
      errBox.textContent = 'Date, building, and person in charge are required.';
      errBox.classList.remove('hidden');
      return;
    }
    errBox.classList.add('hidden');
    const btn = btnRow.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Saving…';
    try {
      const created = await api.insertRow('drills', {
        type: f.type, date: f.date, time: f.time,
        building: f.building.trim(), personInCharge: f.personInCharge.trim(),
        status: 'upcoming', notes: '',
      });
      if (f.notify) {
        const startAt = `${f.date}T${f.time}`;
        const res = await api.sendNotification({
          notif_type: 'event_notice', priority: 'informational',
          audience_group: f.audience,
          title: `${f.type} Drill — ${formatDate(f.date)}`,
          message: `A ${f.type.toLowerCase()} drill is scheduled for ${formatDate(f.date)} at ${f.time} in the ${f.building}. Students will practice the relevant safety procedures.`,
          event_start_at: startAt, event_end_at: startAt,
          contact_method: 'app',
        });
        toast(res.ok ? `Drill ${created.id} scheduled — event notice sent via ${res.channel || 'app'}.` : `Drill ${created.id} scheduled, but the event notice could not be sent.`);
      } else {
        toast(`Drill ${created.id} scheduled.`);
      }
      closeModal();
      drillScheduling(el);
    } catch (err) {
      errBox.textContent = err.message;
      errBox.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'Schedule Drill';
    }
  });

  closeModal = openModal(form).close;
}

export function evacuationPlans(el) {
  const columns = [
    { key: 'id', label: 'ID', render: (r) => h('span', { class: 'text-gray-400 font-mono text-xs whitespace-nowrap' }, r.id) },
    { key: 'building', label: 'Building', render: (r) => h('span', { class: 'font-semibold text-gray-900' }, r.building) },
    { key: 'floor', label: 'Floor' },
    { key: 'exits', label: 'Exits', render: (r) => h('span', { class: 'text-gray-600' }, r.exits || '—') },
    { key: 'routes', label: 'Routes', render: (r) => h('span', { class: 'block max-w-[260px] text-gray-600' }, r.routes || '—') },
    { key: 'assembly_point', label: 'Assembly Point', render: (r) => h('span', { class: 'text-gray-600' }, r.assembly_point || '—') },
    { key: 'version', label: 'Version', render: (r) => h('span', { class: 'font-mono text-xs text-gray-500' }, r.version || '—') },
    { key: 'updated', label: 'Last Updated', render: (r) => h('span', { class: 'whitespace-nowrap text-gray-500' }, formatDate(r.updated)) },
    { key: 'current', label: 'Status', render: (r) => pill(r.current ? 'current' : 'archived') },
  ];
  loadTable(el, {
    table: 'evacuation_plans', columns, iconName: 'map',
    title: 'Evacuation Map & Plans',
    subtitle: 'Floor plans per building with exits, evacuation routes, and assembly points. Upload a new plan to keep a version history.',
    actionLabel: 'Upload Floor Plan',
    empty: { title: 'No floor plans uploaded yet', text: 'Upload the first building floor plan with its evacuation routes.' },
    onAction: () => planUploadForm(el),
  });
}

function planUploadForm(el) {
  let closeModal = () => {};
  const form = h('form', { class: 'bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden' },
    h('div', { class: 'px-6 pt-5 pb-4 border-b border-gray-100' }, h('h3', { class: 'text-sm font-bold text-gray-900' }, 'Upload Floor Plan')),
    h('div', { class: 'p-6 grid grid-cols-1 sm:grid-cols-2 gap-4' }));
  const grid = form.querySelector('.grid');
  const f = { building: '', floor: '', exits: '', routes: '', assembly_point: '', file: null };

  const txt = (label, placeholder, onChange) => {
    const d = h('div', {}, h('label', { class: labelCls }, label),
      h('input', { class: inputCls, placeholder, oninput: (e) => onChange(e.target.value) }));
    return d;
  };
  grid.appendChild(txt('Building', 'e.g. Main Building', (v) => { f.building = v; }));
  grid.appendChild(txt('Floor', 'e.g. Ground Floor', (v) => { f.floor = v; }));
  grid.appendChild(txt('Exits', 'e.g. Exit A, Exit B', (v) => { f.exits = v; }));
  grid.appendChild(txt('Routes', 'e.g. R1 via Front Lobby', (v) => { f.routes = v; }));
  grid.appendChild(txt('Assembly Point', 'e.g. Quadrangle — Zone 1', (v) => { f.assembly_point = v; }));
  grid.appendChild(h('div', {}, h('label', { class: labelCls }, 'Floor Plan File (image/PDF)'),
    h('input', { type: 'file', accept: 'image/*,.pdf', class: inputCls, onchange: (e) => { f.file = e.target.files[0] || null; } })));

  const errBox = h('p', { class: 'hidden sm:col-span-2 text-[13px] text-red-600 bg-red-50 border border-red-200/70 rounded-xl px-3.5 py-2.5' });
  grid.appendChild(errBox);
  grid.appendChild(h('div', { class: 'sm:col-span-2 flex items-center gap-3 pt-1' },
    h('button', { type: 'submit', class: 'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-pink-600 text-white text-sm font-semibold shadow-sm hover:bg-pink-700 transition-colors cursor-pointer' }, icon('upload', 'text-base'), 'Upload Plan'),
    h('button', { type: 'button', class: 'px-5 py-2.5 rounded-xl bg-white text-gray-600 text-sm font-semibold border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer', onclick: () => closeModal() }, 'Cancel')));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!f.building.trim() || !f.floor.trim()) {
      errBox.textContent = 'Building and floor are required.';
      errBox.classList.remove('hidden');
      return;
    }
    errBox.classList.add('hidden');
    const btn = grid.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      let url = null;
      if (f.file) {
        const up = await api.uploadFile('evacuation-maps', f.file, `${f.building}-${f.floor}-${Date.now()}`);
        url = up.url;
      }
      await api.insertRow('evacuation_plans', {
        building: f.building.trim(), floor: f.floor.trim(),
        exits: f.exits.trim(), routes: f.routes.trim(), assembly_point: f.assembly_point.trim(),
        version: 'v1.0', updated: new Date().toISOString().slice(0, 10),
        file_url: url, current: true,
      });
      toast(`Floor plan for ${f.building} (${f.floor}) uploaded.`);
      closeModal();
      evacuationPlans(el);
    } catch (err) {
      errBox.textContent = err.message;
      errBox.classList.remove('hidden');
      btn.disabled = false;
    }
  });
  closeModal = openModal(form).close;
}

const INCIDENT_TYPES = ['medical', 'slips/falls', 'fire-related', 'security', 'equipment failure'];
const SEVERITIES = ['low', 'medium', 'high'];

export function incidentLogging(el) {
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
  loadTable(el, {
    table: 'incidents', columns, iconName: 'report',
    title: 'Incident Logging',
    subtitle: 'Record medical, fire, security, and structural incidents. Incidents tied to a student can auto-notify their parents.',
    actionLabel: 'Log Incident',
    empty: { title: 'No incidents logged yet', text: 'Log the first incident — parent alerts can be sent straight from the form.' },
    onAction: () => incidentForm(el),
  });
}

function incidentForm(el) {
  let closeModal = () => {};
  const form = h('form', { class: 'bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden' },
    h('div', { class: 'px-6 pt-5 pb-4 border-b border-gray-100' }, h('h3', { class: 'text-sm font-bold text-gray-900' }, 'Log New Incident')),
    h('div', { class: 'p-6 grid grid-cols-1 sm:grid-cols-2 gap-4' }));
  const grid = form.querySelector('.grid');
  const f = { type: 'medical', location: '', description: '', reporter: '', severity: 'medium', studentId: '', notifyParent: false };

  const sel = (label, options, val, onChange) => {
    const d = h('div', {}, h('label', { class: labelCls }, label),
      h('select', { class: inputCls, onchange: (e) => onChange(e.target.value) },
        options.map((o) => h('option', { value: o, selected: o === val }, capitalize(o)))));
    return d;
  };
  const txt = (label, placeholder, onChange) => {
    const d = h('div', {}, h('label', { class: labelCls }, label),
      h('input', { class: inputCls, placeholder, oninput: (e) => onChange(e.target.value) }));
    return d;
  };

  grid.appendChild(sel('Type', INCIDENT_TYPES, f.type, (v) => { f.type = v; }));
  grid.appendChild(sel('Severity', SEVERITIES, f.severity, (v) => { f.severity = v; }));
  grid.appendChild(txt('Location', 'e.g. Gymnasium', (v) => { f.location = v; }));
  grid.appendChild(txt('Reporter', 'Who reported it?', (v) => { f.reporter = v; }));
  grid.appendChild(h('div', { class: 'sm:col-span-2' }, h('label', { class: labelCls }, 'Description'),
    h('textarea', { class: `${inputCls} min-h-[80px] resize-y`, placeholder: 'What happened?', oninput: (e) => { f.description = e.target.value; } })));

  // Student picker (enables parent alert)
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
      'Notify parent? ', h('span', { class: 'text-gray-400 font-normal' }, 'Creates an urgent incident alert (call/SMS) linked to this incident.')));
  };

  const errBox = h('p', { class: 'hidden sm:col-span-2 text-[13px] text-red-600 bg-red-50 border border-red-200/70 rounded-xl px-3.5 py-2.5' });
  grid.appendChild(errBox);
  grid.appendChild(h('div', { class: 'sm:col-span-2 flex items-center gap-3 pt-1' },
    h('button', { type: 'submit', class: 'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-pink-600 text-white text-sm font-semibold shadow-sm hover:bg-pink-700 transition-colors cursor-pointer' }, icon('send', 'text-base'), 'Save Incident'),
    h('button', { type: 'button', class: 'px-5 py-2.5 rounded-xl bg-white text-gray-600 text-sm font-semibold border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer', onclick: () => closeModal() }, 'Cancel')));

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
          contact_method: 'call',
        });
        toast(res.ok ? `Incident ${created.id} logged — parent alert sent via ${res.channel || 'call'}.` : `Incident ${created.id} logged, but the parent alert could not be queued.`);
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

export function safetyInspections(el) {
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
  loadTable(el, {
    table: 'inspections', columns, iconName: 'fact_check',
    title: 'Safety Inspection Checklist',
    subtitle: 'Track inspection items per area with frequency, status, and follow-up notes. Items past their due date are auto-flagged Overdue.',
    empty: { title: 'No inspections recorded yet', text: 'Add the first inspection item to start the compliance checklist.' },
  });
}

export function riskAssessment(el) {
  const columns = [
    { key: 'id', label: 'ID', render: (r) => h('span', { class: 'text-gray-400 font-mono text-xs whitespace-nowrap' }, r.id) },
    { key: 'hazard', label: 'Hazard', render: (r) => h('span', { class: 'font-semibold text-gray-900 block max-w-[300px]' }, r.hazard) },
    { key: 'likelihood', label: 'Likelihood', render: (r) => pill(r.likelihood, r.likelihood === 'High' ? 'red' : r.likelihood === 'Medium' ? 'amber' : 'green') },
    { key: 'impact', label: 'Impact', render: (r) => pill(r.impact, r.impact === 'High' ? 'red' : r.impact === 'Medium' ? 'amber' : 'green') },
    { key: 'risk_level', label: 'Risk Level', render: (r) => pill(r.risk_level, r.risk_level === 'Critical' ? 'red' : r.risk_level === 'High' ? 'red' : r.risk_level === 'Medium' ? 'amber' : 'green') },
    { key: 'mitigation', label: 'Mitigation Plan', render: (r) => h('span', { class: 'block max-w-[320px] text-gray-600' }, r.mitigation || '—') },
    { key: 'owner', label: 'Owner' },
    { key: 'review_date', label: 'Review Date', render: (r) => h('span', { class: 'whitespace-nowrap text-gray-500' }, formatDate(r.review_date)) },
  ];
  loadTable(el, {
    table: 'risks', columns, iconName: 'security',
    title: 'Risk Assessment Tool',
    subtitle: 'Hazards with likelihood/impact scoring, computed risk level, mitigation plans, and review owners.',
    empty: { title: 'No risks assessed yet', text: 'Add the first hazard to start the risk register.' },
  });
}

export function parentNotifications(el) {
  el.appendChild(moduleShell({
    icon: 'notifications',
    title: 'Parent Notification System',
    subtitle: 'Send urgent incident alerts (call/SMS) or informational event notices (app/email) to parents.',
    actionLabel: 'New Notification',
    onAction: () => composer(el),
  }));
  const holder = h('div', { class: 'space-y-5' });
  el.appendChild(holder);
  renderNotifications(el, holder);
}

function renderNotifications(el, holder) {
  holder.innerHTML = '';
  const filterRow = h('div', { class: 'flex flex-wrap items-center gap-2' },
    ['all', 'incident_alert', 'event_notice'].map((k) =>
      h('button', {
        class: `px-4 py-1.5 rounded-full text-xs font-bold border transition-colors cursor-pointer ${k === 'all' ? 'bg-pink-600 text-white border-pink-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`,
        onclick: () => renderNotifications(el, holder),
      }, k === 'all' ? 'All' : k === 'incident_alert' ? 'Incident Alerts' : 'Event Notices')));
  holder.appendChild(filterRow);
  holder.appendChild(skeleton(4, 7));
  api.listRows('notifications').then((rows) => {
    holder.innerHTML = '';
    holder.appendChild(filterRow);
    if (!rows.length) {
      holder.appendChild(emptyBanner({ icon: 'notifications', title: 'No notifications sent yet', text: 'Use “New Notification” to send the first incident alert or event notice.' }));
      return;
    }
    const columns = [
      { key: 'id', label: 'ID', render: (r) => h('span', { class: 'text-gray-400 font-mono text-xs whitespace-nowrap' }, r.id) },
      { key: 'notif_type', label: 'Type', render: (r) => notifBadge(r) },
      { key: 'title', label: 'Title', render: (r) => h('span', { class: 'font-semibold text-gray-900 block max-w-[260px]' }, r.title) },
      { key: 'audience', label: 'Audience', render: (r) => r.student_name
          ? h('span', { class: 'text-gray-600' }, `${r.student_name}${r.student_grade ? ` · Grade ${r.student_grade}` : ''}`)
          : h('span', { class: 'text-gray-600' }, r.audience_group || '—') },
      { key: 'contact_method', label: 'Channel', render: (r) => pill(r.contact_method, r.contact_method === 'call' || r.contact_method === 'sms' ? 'red' : 'blue') },
      { key: 'sent_at', label: 'Sent', render: (r) => h('span', { class: 'whitespace-nowrap text-gray-500' }, formatDate(r.sent_at)) },
      { key: 'delivery_status', label: 'Delivery', render: (r) => pill(r.delivery_status) },
    ];
    holder.appendChild(dataTable(columns, rows));
  }).catch((e) => holder.replaceChildren(filterRow, errorBanner(e.message)));
}

function notifBadge(r) {
  const isAlert = r.notif_type === 'incident_alert';
  return h('span', {
    class: `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border whitespace-nowrap ${isAlert
      ? 'bg-red-50 text-red-700 border-red-200'
      : 'bg-pink-50 text-pink-700 border-pink-200'}`,
    style: isAlert ? { borderLeft: '3px solid #EF4444' } : {},
  },
    icon(isAlert ? 'priority_high' : 'event', 'text-[12px]'),
    isAlert ? 'Incident Alert' : 'Event Notice',
  );
}

function composer(el) {
  let closeModal = () => {};
  const card = h('div', { class: 'bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden' });
  const tabs = h('div', { class: 'grid grid-cols-2 gap-1 p-2 bg-gray-50 border-b border-gray-100' });
  card.appendChild(tabs);

  const f = {
    notif_type: 'incident_alert', studentId: '', student_name: '', student_grade: null,
    related_incident_id: '', title: '', message: '', contact_method: 'call',
    audience_group: 'All Parents', event_start_at: '', event_end_at: '',
  };

  const fields = h('div', { class: 'p-6 grid grid-cols-1 sm:grid-cols-2 gap-4' });
  card.appendChild(fields);

  async function awaitP(t) {
    try { return await api.listRows(t); } catch { return []; }
  }

  const students = awaitP('students');
  const incidents = awaitP('incidents');

  const renderFields = async () => {
    fields.innerHTML = '';
    const isAlert = f.notif_type === 'incident_alert';
    const st = await students;
    const inc = await incidents;

    if (isAlert) {
      fields.appendChild(h('div', { class: 'sm:col-span-2' },
        h('span', { class: `inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold ${'bg-red-50 text-red-700 border border-red-200 animate-pulse'}` },
          icon('priority_high', 'text-[12px]'), 'URGENT — reach parents by phone or SMS')));
      const studentSel = h('select', { class: inputCls, onchange: (e) => {
        const s = st.find((x) => x.id === e.target.value);
        f.studentId = e.target.value; f.student_name = s?.name || ''; f.student_grade = s?.grade || null;
      } },
        h('option', { value: '' }, 'Select student…'),
        st.map((s) => h('option', { value: s.id }, `${s.name} — Grade ${s.grade}`)));
      fields.appendChild(h('div', { class: 'sm:col-span-2' }, h('label', { class: labelCls }, 'Student (required)'), studentSel));

      const incSel = h('select', { class: inputCls, onchange: (e) => { f.related_incident_id = e.target.value; } },
        h('option', { value: '' }, 'No related incident'),
        inc.map((i) => h('option', { value: i.id }, `${i.id} · ${capitalize(i.type)} — ${i.location}`)));
      fields.appendChild(h('div', { class: 'sm:col-span-2' }, h('label', { class: labelCls }, 'Related Incident (optional)'), incSel));
    } else {
      fields.appendChild(h('div', { class: 'sm:col-span-2' },
        h('span', { class: 'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold bg-pink-50 text-pink-700 border border-pink-200' },
          icon('event', 'text-[12px]'), 'INFORMATIONAL — app/email notice')));
      const audSel = h('select', { class: inputCls, onchange: (e) => { f.audience_group = e.target.value; } },
        AUDIENCES.map((g) => h('option', { value: g, selected: g === f.audience_group }, g)));
      fields.appendChild(h('div', { class: 'sm:col-span-2' }, h('label', { class: labelCls }, 'Audience Group (required)'), audSel));
      fields.appendChild(h('div', {}, h('label', { class: labelCls }, 'Event Start'), h('input', { type: 'datetime-local', class: inputCls, oninput: (e) => { f.event_start_at = e.target.value; } })));
      fields.appendChild(h('div', {}, h('label', { class: labelCls }, 'Event End'), h('input', { type: 'datetime-local', class: inputCls, oninput: (e) => { f.event_end_at = e.target.value; } })));
    }

    fields.appendChild(h('div', { class: 'sm:col-span-2' }, h('label', { class: labelCls }, 'Title'),
      h('input', { class: inputCls, placeholder: isAlert ? 'e.g. Medical Emergency — PE Class' : 'e.g. Foundation Day — Schedule', oninput: (e) => { f.title = e.target.value; } })));
    fields.appendChild(h('div', { class: 'sm:col-span-2' }, h('label', { class: labelCls }, 'Message'),
      h('textarea', { class: `${inputCls} min-h-[80px] resize-y`, placeholder: 'What should parents know?', oninput: (e) => { f.message = e.target.value; } })));

    const methods = isAlert ? ['call', 'sms', 'email'] : ['app', 'email'];
    fields.appendChild(h('div', { class: 'sm:col-span-2' }, h('label', { class: labelCls }, 'Contact Method'),
      h('select', { class: inputCls, onchange: (e) => { f.contact_method = e.target.value; } },
        methods.map((m) => h('option', { value: m, selected: m === (isAlert ? 'call' : 'app') }, capitalize(m))))));

    const errBox = h('p', { class: 'hidden sm:col-span-2 text-[13px] text-red-600 bg-red-50 border border-red-200/70 rounded-xl px-3.5 py-2.5' });
    fields.appendChild(errBox);
    fields.appendChild(h('div', { class: 'sm:col-span-2 flex items-center gap-3 pt-1' },
      h('button', {
        class: 'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-pink-600 text-white text-sm font-semibold shadow-sm hover:bg-pink-700 transition-colors cursor-pointer',
        onclick: async () => {
          if (isAlert && !f.studentId) { errBox.textContent = 'A student is required for incident alerts.'; errBox.classList.remove('hidden'); return; }
          if (!isAlert && (!f.audience_group || !f.event_start_at || !f.event_end_at)) {
            errBox.textContent = 'Audience group and event start/end times are required for event notices.'; errBox.classList.remove('hidden'); return;
          }
          if (!isAlert && f.event_end_at <= f.event_start_at) { errBox.textContent = 'Event end must be after event start.'; errBox.classList.remove('hidden'); return; }
          if (!f.title.trim() || !f.message.trim()) { errBox.textContent = 'Title and message are required.'; errBox.classList.remove('hidden'); return; }
          errBox.classList.add('hidden');
          try {
            const payload = isAlert
              ? { notif_type: 'incident_alert', priority: 'urgent', student_id: f.studentId, student_name: f.student_name, student_grade: f.student_grade, related_incident_id: f.related_incident_id || null, title: f.title.trim(), message: f.message.trim(), contact_method: f.contact_method }
              : { notif_type: 'event_notice', priority: 'informational', audience_group: f.audience_group, title: f.title.trim(), message: f.message.trim(), event_start_at: f.event_start_at, event_end_at: f.event_end_at, contact_method: f.contact_method };
            const res = await api.sendNotification(payload);
            toast(res.ok ? `Notification sent via ${res.channel || f.contact_method}.` : 'Notification queued but delivery failed.');
            closeModal();
            el.innerHTML = '';
            parentNotifications(el);
          } catch (e) {
            errBox.textContent = e.message; errBox.classList.remove('hidden');
          }
        },
      }, icon('send', 'text-base'), 'Send Notification'),
      h('button', { class: 'px-5 py-2.5 rounded-xl bg-white text-gray-600 text-sm font-semibold border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer', onclick: () => closeModal() }, 'Cancel')));
  };

  const mkTab = (label, type) => h('button', {
    class: `py-2.5 rounded-xl text-sm font-bold transition-colors cursor-pointer ${f.notif_type === type ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`,
    onclick: (e) => {
      f.notif_type = type;
      // contact method defaults per type (call/sms for alerts, app/email for notices)
      f.contact_method = type === 'incident_alert' ? 'call' : 'app';
      tabs.querySelectorAll('button').forEach((b) => {
        b.classList.remove('bg-white', 'text-pink-600', 'shadow-sm');
        if (b === e.currentTarget) b.classList.add('bg-white', 'text-pink-600', 'shadow-sm');
      });
      renderFields();
    },
  }, label);

  tabs.appendChild(mkTab('Incident Alert', 'incident_alert'));
  tabs.appendChild(mkTab('Event Notice', 'event_notice'));
  renderFields();
  closeModal = openModal(card).close;
}

export function complianceReports(el) {
  el.appendChild(moduleShell({
    icon: 'assessment', title: 'Safety Compliance Reports',
    subtitle: 'Auto-generated summaries pulled from inspections, drills, and incidents — exportable as CSV or PDF.',
  }));
  const holder = h('div', { class: 'space-y-5' });
  el.appendChild(holder);
  holder.appendChild(skeleton(2, 4));

  api.getDashboardStats().then((s) => {
    holder.innerHTML = '';
    const grid = h('div', { class: 'grid grid-cols-2 lg:grid-cols-4 gap-5' });
    const items = [
      { label: 'Inspections Passed', value: s.inspections_passed, sub: 'of total checklist items', iconName: 'checklist', tone: 'green', blob: 'bg-emerald-50' },
      { label: 'Drills Completed', value: s.drills_completed, sub: 'total drills finished', iconName: 'person-running', tone: 'blue', blob: 'bg-blue-50' },
      { label: 'Open Incidents', value: s.incidents_open, sub: 'currently unresolved', iconName: 'warning', tone: 'red', blob: 'bg-red-50' },
      { label: 'Compliance Score', value: `${s.compliance_score}%`, sub: 'overall safety rating', iconName: 'verified_user', tone: 'purple', blob: 'bg-purple-50' },
    ];
    items.forEach((d) => grid.appendChild(statCard(d)));
    holder.appendChild(grid);

    holder.appendChild(h('div', { class: 'flex flex-wrap gap-3' },
      h('button', { class: 'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-pink-600 text-white text-sm font-semibold shadow-sm hover:bg-pink-700 transition-colors cursor-pointer', onclick: () => exportCSV(s) }, icon('download', 'text-base'), 'Export CSV (Excel)'),
      h('button', { class: 'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-gray-700 text-sm font-semibold border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer', onclick: () => window.print() }, icon('print', 'text-base'), 'Export PDF (Print)')));

    holder.appendChild(h('div', { class: 'bg-[#FFF8E7] border border-amber-200/60 rounded-2xl p-4 flex items-center gap-4' },
      h('div', { class: 'w-8 h-8 rounded-full bg-amber-100 text-amber-500 flex items-center justify-center shrink-0' }, icon('database', 'text-xs')),
      h('div', {},
        h('h4', { class: 'text-[13px] font-bold text-gray-900' }, 'Generated report'),
        h('p', { class: 'text-[13px] text-gray-600 mt-0.5' }, `Summary generated ${new Date().toLocaleString()} from live module data.`))));
  }).catch((e) => holder.replaceChildren(errorBanner(e.message)));
}

function exportCSV(stats) {
  const rows = [
    ['Metric', 'Value'],
    ['Total Incidents', stats.incidents_total],
    ['Open Incidents', stats.incidents_open],
    ['Inspections Passed', stats.inspections_passed],
    ['Inspections Pending', stats.inspections_pending],
    ['Inspections Overdue', stats.inspections_overdue],
    ['Drills Completed', stats.drills_completed],
    ['Active Drills', stats.drills_active],
    ['Low Supplies', stats.supplies_low],
    ['Emergency Contacts', stats.emergency_contacts_total],
    ['Compliance Score (%)', stats.compliance_score],
  ];
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `osas-compliance-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Compliance summary exported as CSV.');
}

export function emergencyRoles(el) {
  const columns = [
    { key: 'id', label: 'ID', render: (r) => h('span', { class: 'text-gray-400 font-mono text-xs whitespace-nowrap' }, r.id) },
    { key: 'role', label: 'Role', render: (r) => h('span', { class: 'font-semibold text-gray-900' }, r.role) },
    { key: 'staff', label: 'Assigned Staff', render: (r) => h('span', { class: 'text-gray-700' }, r.staff) },
    { key: 'zone', label: 'Zone / Building' },
    { key: 'backup', label: 'Backup Person', render: (r) => r.backup ? h('span', { class: 'text-gray-600' }, r.backup) : h('span', { class: 'text-gray-300' }, '—') },
  ];
  loadTable(el, {
    table: 'emergency_roles', columns, iconName: 'groups',
    title: 'Emergency Role Assignment',
    subtitle: 'Fire wardens, first aiders, and evacuation marshals assigned per zone, each with a backup person.',
    empty: { title: 'No roles assigned yet', text: 'Assign the first emergency role to a staff member.' },
  });
}

export function firstAidSupplies(el) {
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
  loadTable(el, {
    table: 'supplies', columns, iconName: 'medical_services',
    title: 'First Aid Supplies Monitor',
    subtitle: 'Stock levels with expiry dates and reorder thresholds. Items at or below threshold are flagged Low automatically.',
    empty: { title: 'No supplies tracked yet', text: 'Add the first first-aid item to start the stock monitor.' },
  });
}
