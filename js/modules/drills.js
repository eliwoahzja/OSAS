import {
  h, icon, pill, formatDate, inputCls, labelCls,
  toast, openModal,
} from '../ui.js';
import * as api from '../api.js';
import { loadTable } from './table-loader.js';

// NOTE(drrm): Drill scheduling aligns with DepEd Order No. 48, s. 2012 & NDRRMC quarterly NSED schedule.
// WHY: Standard evacuation benchmark is under 4 minutes total campus clearance to designated open assembly field.
export const DRILL_TYPES = ['Fire', 'Earthquake', 'Lockdown', 'Evacuation'];
export const AUDIENCES = ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12', 'All Parents'];

export async function drillScheduling(el) {
  const columns = [
    { key: 'id', label: 'ID', render: (r) => h('span', { class: 'text-gray-400 font-mono text-xs whitespace-nowrap' }, r.id) },
    { key: 'type', label: 'Drill Type', render: (r) => pill(r.type) },
    { key: 'date', label: 'Schedule', render: (r) => h('span', { class: 'whitespace-nowrap' }, h('span', { class: 'font-semibold text-gray-900' }, formatDate(r.date)), h('span', { class: 'text-gray-400' }, ` · ${r.time}`)) },
    { key: 'building', label: 'Building / Area' },
    { key: 'person_in_charge', label: 'Person in Charge' },
    { key: 'status', label: 'Status', render: (r) => pill(r.status) },
    { key: 'notes', label: 'Outcome Notes', render: (r) => r.notes ? h('span', { class: 'block max-w-[340px] text-gray-600' }, r.notes) : h('span', { class: 'text-gray-300' }, '—') },
  ];

  return loadTable(el, {
    table: 'drills', columns, iconName: 'person-running',
    title: 'Drill Scheduling',
    subtitle: 'Plan fire, earthquake, lockdown, and evacuation drills. Scheduled drills can auto-send an event notice to parents.',
    actionLabel: 'Schedule Drill',
    searchKeys: ['type', 'building', 'person_in_charge', 'notes'],
    searchPlaceholder: 'Search by type, building, or person in charge…',
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
  const f = { type: 'Fire', date: '', time: '09:00', building: '', person_in_charge: '', notify: false, audience: 'All Parents' };

  const sel = (label, options, val, onChange) => {
    return h('div', {}, h('label', { class: labelCls }, label),
      h('select', { class: inputCls, onchange: (e) => onChange(e.target.value) },
        options.map((o) => h('option', { value: o, selected: o === val }, o))));
  };
  const txt = (label, placeholder, onChange) => {
    return h('div', {}, h('label', { class: labelCls }, label),
      h('input', { class: inputCls, placeholder, oninput: (e) => onChange(e.target.value) }));
  };

  grid.appendChild(sel('Drill Type', DRILL_TYPES, f.type, (v) => { f.type = v; }));
  grid.appendChild(txt('Building / Area', 'e.g. Main Building', (v) => { f.building = v; }));
  grid.appendChild(h('div', {}, h('label', { class: labelCls }, 'Date'),
    h('input', { type: 'date', class: inputCls, oninput: (e) => { f.date = e.target.value; } })));
  grid.appendChild(h('div', {}, h('label', { class: labelCls }, 'Time'),
    h('input', { type: 'time', class: inputCls, value: '09:00', oninput: (e) => { f.time = e.target.value; } })));
  grid.appendChild(txt('Person in Charge', 'e.g. Mr. Lim', (v) => { f.person_in_charge = v; }));

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
    h('button', { type: 'submit', class: 'btn-primary' }, icon('send', 'text-base'), 'Schedule Drill'),
    h('button', { type: 'button', class: 'btn-ghost', onclick: () => closeModal() }, 'Cancel'));
  grid.appendChild(btnRow);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!f.date || !f.building.trim() || !f.person_in_charge.trim()) {
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
        building: f.building.trim(), person_in_charge: f.person_in_charge.trim(),
        status: 'upcoming', notes: '',
      });
      if (f.notify) {
        const startDate = new Date(`${f.date}T${f.time}`);
        const validStart = !isNaN(startDate.getTime()) ? startDate : new Date();
        const startAt = validStart.toISOString();
        const endAt = new Date(validStart.getTime() + 60 * 60 * 1000).toISOString();
        const res = await api.sendNotification({
          notif_type: 'event_notice', priority: 'informational',
          audience_group: f.audience,
          title: `${f.type} Drill — ${formatDate(f.date)}`,
          message: `A ${f.type.toLowerCase()} drill is scheduled for ${formatDate(f.date)} at ${f.time} in the ${f.building}. Students will practice the relevant safety procedures.`,
          event_start_at: startAt, event_end_at: endAt,
          contact_method: 'app',
        });
        toast(res.ok ? `Drill ${created.id} scheduled — event notice sent via ${res.channel || 'app'}.` : `Drill ${created.id} scheduled ⚠ ${res.error || 'Event notice could not be sent.'}`);
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

export async function evacuationPlans(el) {
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
  return loadTable(el, {
    table: 'evacuation_plans', columns, iconName: 'map',
    title: 'Evacuation Map & Plans',
    subtitle: 'Floor plans per building with exits, evacuation routes, and assembly points. Upload a new plan to keep a version history.',
    actionLabel: 'Upload Floor Plan',
    searchKeys: ['building', 'floor', 'exits', 'routes', 'assembly_point'],
    searchPlaceholder: 'Search by building, floor, or exit…',
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
    return h('div', {}, h('label', { class: labelCls }, label),
      h('input', { class: inputCls, placeholder, oninput: (e) => onChange(e.target.value) }));
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
    h('button', { type: 'submit', class: 'btn-primary' }, icon('upload', 'text-base'), 'Upload Plan'),
    h('button', { type: 'button', class: 'btn-ghost', onclick: () => closeModal() }, 'Cancel')));

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
