import {
  h, icon, pill, formatDate, inputCls, labelCls,
  capitalize, toast, openModal, moduleShell, skeletonHeader, skeletonTableWithColumns,
  dataTable, emptyBanner, errorBanner,
} from '../ui.js';
import * as api from '../api.js';
import { AUDIENCES } from './drills.js';

export async function parentNotifications(el) {
  return renderNotifications(el);
}

async function renderNotifications(el, currentType = 'all') {
  el.innerHTML = '';
  const wrap = h('div', { class: 'max-w-[1400px] 2xl:max-w-[1600px] mx-auto space-y-6' });
  el.appendChild(wrap);

  wrap.appendChild(skeletonHeader({
    hasAction: true,
    hasIcon: true,
    titleWidth: 'w-72 sm:w-80',
    subtitleWidth: 'w-80 sm:w-[480px]',
  }));

  const holder = h('div', { class: 'space-y-5' });
  wrap.appendChild(holder);

  const skeletonFilterRow = h('div', { class: 'flex flex-wrap items-center gap-2 animate-pulse' },
    ['w-14', 'w-32', 'w-28'].map(w =>
      h('div', { class: `h-8 ${w} rounded-full bg-gray-100 border border-gray-100` })
    )
  );
  holder.appendChild(skeletonFilterRow);

  const notifColumns = [
    { key: 'id', label: 'ID' },
    { key: 'notif_type', label: 'Type' },
    { key: 'message', label: 'Message' },
    { key: 'audience', label: 'Audience' },
    { key: 'contact_method', label: 'Channel' },
    { key: 'sent_at', label: 'Sent' },
    { key: 'delivery_status', label: 'Delivery' },
  ];
  const tableWrap = h('div');
  tableWrap.appendChild(skeletonTableWithColumns(notifColumns, 5));
  holder.appendChild(tableWrap);

  try {
    const [rows] = await Promise.all([
      api.listRows('notifications'),
      new Promise(r => setTimeout(r, 3000)),
    ]);

    el.innerHTML = '';
    const shell = moduleShell({
      icon: 'notifications',
      title: 'Parent Notification System',
      subtitle: 'Send urgent incident alerts or informational event notices to parents.',
      actionLabel: 'New Notification',
      onAction: () => composer(el),
    });
    el.appendChild(shell);

    const realHolder = h('div', { class: 'space-y-5' });
    shell.appendChild(realHolder);

    const filterRow = h('div', { class: 'flex flex-wrap items-center gap-2' },
      [
        { key: 'all', label: 'All' },
        { key: 'incident_alert', label: 'Urgent Incident Alerts' },
        { key: 'event_notice', label: 'Event Notices & Drills' },
      ].map((k) =>
        h('button', {
          class: `px-4 py-1.5 rounded-full text-xs font-bold border transition-colors clickable ${k.key === currentType ? (k.key === 'incident_alert' ? 'bg-red-600 text-white border-red-600' : 'bg-pink-600 text-white border-pink-600') : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`,
          onclick: () => renderNotifications(el, k.key),
        }, k.label)));
    realHolder.appendChild(filterRow);

    const filteredRows = rows
      .filter((r) => {
        const rawTitle = String(r.title || '');
        const rawMsg = String(r.message || '');
        const rawAudience = String(r.audience_group || '');
        const isStock = r.notif_type === 'alert' ||
          /restock|supplies|stock|inventory|shortage/i.test(rawTitle) ||
          /restock|supplies|stock|inventory|depleted/i.test(rawMsg) ||
          /clinic|custodian/i.test(rawAudience);
        return !isStock;
      })
      .filter((r) => {
        if (currentType === 'incident_alert') return r.notif_type === 'incident_alert';
        if (currentType === 'event_notice') return r.notif_type === 'event_notice';
        return true;
      });

    const realTableWrap = h('div');
    realHolder.appendChild(realTableWrap);

    if (!filteredRows.length) {
      realTableWrap.appendChild(emptyBanner({ icon: 'notifications', title: 'No notifications found', text: 'Use "New Notification" to send an incident alert or event notice to parents.' }));
      return;
    }
    const columns = [
      { key: 'id', label: 'ID', render: (r) => h('span', { class: 'text-gray-400 font-mono text-xs whitespace-nowrap' }, r.id) },
      { key: 'notif_type', label: 'Type', render: (r) => notifBadge(r) },
      { key: 'message', label: 'Message', render: (r) => h('span', { class: 'text-gray-900 block max-w-[320px]' }, r.message) },
      { key: 'audience', label: 'Audience', render: (r) => r.student_name
          ? h('span', { class: 'text-gray-600' }, `${r.student_name}${r.student_grade ? ` · Grade ${r.student_grade}` : ''}`)
          : h('span', { class: 'text-gray-600' }, r.audience_group || '—') },
      { key: 'contact_method', label: 'Channel', render: (r) => pill(r.contact_method) },
      { key: 'sent_at', label: 'Sent', render: (r) => h('span', { class: 'whitespace-nowrap text-gray-500' }, formatDate(r.sent_at)) },
      { key: 'delivery_status', label: 'Delivery', render: (r) => pill(r.delivery_status) },
    ];
    realTableWrap.appendChild(dataTable(columns, filteredRows));
  } catch (e) {
    wrap.innerHTML = '';
    wrap.appendChild(errorBanner(e.message, () => renderNotifications(el, currentType)));
  }
}

function notifBadge(r) {
  const rawTitle = String(r.title || '');
  const rawMsg = String(r.message || '');
  const rawAudience = String(r.audience_group || '');
  const isStock = r.notif_type === 'alert' ||
    /restock|supplies|stock|inventory|shortage/i.test(rawTitle) ||
    /restock|supplies|stock|inventory|depleted/i.test(rawMsg) ||
    /clinic|custodian/i.test(rawAudience);
  const isParentAlert = !isStock && (r.notif_type === 'incident_alert' || Boolean(r.student_name) || Boolean(r.student_id && r.student_id !== '11111111-1111-4111-8111-111111111111') || Boolean(r.related_incident_id));

  if (isStock) {
    return h('span', {
      class: 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border whitespace-nowrap bg-red-50 text-red-700 border-red-300',
      style: { borderLeft: '3px solid #DC2626' },
    },
      icon('warning', 'text-[12px] text-red-600'),
      'Alert',
    );
  }

  if (isParentAlert) {
    return h('span', {
      class: 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border whitespace-nowrap bg-red-50 text-red-700 border-red-200',
      style: { borderLeft: '3px solid #EF4444' },
    },
      icon('priority_high', 'text-[12px] text-red-600'),
      'Urgent Incident Alert',
    );
  }

  return h('span', {
    class: 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border whitespace-nowrap bg-pink-50 text-pink-700 border-pink-200',
  },
    icon('event', 'text-[12px] text-pink-600'),
    'Event Notice',
  );
}

function composer(el) {
  let closeModal = () => {};
  const card = h('div', { class: 'bg-white rounded-3xl shadow-sm border border-gray-100 overflow-visible' });
  const tabs = h('div', { class: 'grid grid-cols-2 gap-1 p-2 bg-gray-50 border-b border-gray-100' });
  card.appendChild(tabs);

  const f = {
    notif_type: 'incident_alert',
    studentId: '',
    student_name: '',
    student_grade: null,
    related_incident_id: '',
    title: '',
    message: '',
    contact_method: 'email',
    audience_group: 'All Parents & Guardians',
    event_start_at: '',
    event_end_at: '',
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
    const isIncident = f.notif_type === 'incident_alert';
    const isEvent = f.notif_type === 'event_notice';
    const st = await students;
    const inc = await incidents;

    if (isIncident) {
      fields.appendChild(h('div', { class: 'sm:col-span-2' },
        h('span', { class: 'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200 animate-pulse' },
          icon('emergency', 'text-[12px]'), 'URGENT INCIDENT ALERT — Direct email notification to all registered parents')));

      const studentSel = h('select', { class: inputCls, onchange: (e) => {
        const s = st.find((x) => x.id === e.target.value);
        f.studentId = e.target.value;
        f.student_name = s?.name || '';
        f.student_grade = s?.grade || null;
      } },
        h('option', { value: '' }, 'Select student involved…'),
        st.map((s) => h('option', { value: s.id, selected: s.id === f.studentId }, `${s.name} — Grade ${s.grade}${s.section ? ` (${s.section})` : ''}`)));
      fields.appendChild(h('div', { class: 'sm:col-span-2' }, h('label', { class: labelCls }, 'Student Involved (required)'), studentSel));

      const incSel = h('select', { class: inputCls, onchange: (e) => { f.related_incident_id = e.target.value; } },
        h('option', { value: '' }, 'No related incident log'),
        inc.map((i) => h('option', { value: i.id, selected: i.id === f.related_incident_id }, `${i.id} · ${capitalize(i.type)} — ${i.location}`)));
      fields.appendChild(h('div', { class: 'sm:col-span-2' }, h('label', { class: labelCls }, 'Related Incident Log (optional)'), incSel));
    } else {
      fields.appendChild(h('div', { class: 'sm:col-span-2' },
        h('span', { class: 'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold bg-pink-50 text-pink-700 border border-pink-200' },
          icon('event', 'text-[12px]'), 'EVENT NOTICE — Send campus event notice, drills schedule, or advisories to parents')));
      const audSel = h('select', { class: inputCls, onchange: (e) => { f.audience_group = e.target.value; } },
        ['All Parents & Guardians', 'All Parents & Faculty', 'Grade 7-10 Parents', 'Senior High Parents'].map((g) =>
          h('option', { value: g, selected: g === f.audience_group }, g)));
      fields.appendChild(h('div', { class: 'sm:col-span-2' }, h('label', { class: labelCls }, 'Audience Group (required)'), audSel));
      fields.appendChild(h('div', {}, h('label', { class: labelCls }, 'Event Start'), h('input', { type: 'datetime-local', class: inputCls, oninput: (e) => { f.event_start_at = e.target.value; } })));
      fields.appendChild(h('div', {}, h('label', { class: labelCls }, 'Event End'), h('input', { type: 'datetime-local', class: inputCls, oninput: (e) => { f.event_end_at = e.target.value; } })));
    }

    fields.appendChild(h('div', { class: 'sm:col-span-2' },
      h('label', { class: labelCls }, 'Message Details'),
      h('textarea', {
        class: `${inputCls} min-h-[85px] resize-y`,
        placeholder: isIncident ? 'Detail the incident, immediate care given, and instructions for parents…' : 'Details for parents regarding the upcoming event, drill, or advisory…',
        oninput: (e) => { f.message = e.target.value; },
      })));

    const errBox = h('p', { class: 'hidden sm:col-span-2 text-[13px] text-red-600 bg-red-50 border border-red-200/70 rounded-xl px-3.5 py-2.5' });
    fields.appendChild(errBox);
    fields.appendChild(h('div', { class: 'sm:col-span-2 flex items-center gap-3 pt-1' },
      h('button', {
        class: 'btn-primary',
        onclick: async (e) => {
          if (isIncident && !f.studentId) { errBox.textContent = 'A student is required for incident alerts.'; errBox.classList.remove('hidden'); return; }
          if (isEvent && (!f.audience_group || !f.event_start_at || !f.event_end_at)) {
            errBox.textContent = 'Audience group and event start/end times are required for event notices.'; errBox.classList.remove('hidden'); return;
          }
          if (isEvent && f.event_end_at <= f.event_start_at) { errBox.textContent = 'Event end must be after event start.'; errBox.classList.remove('hidden'); return; }
          if (!f.message.trim()) { errBox.textContent = 'Message is required.'; errBox.classList.remove('hidden'); return; }
          errBox.classList.add('hidden');
          const btn = e.currentTarget;
          const originalLabel = btn.innerHTML;
          btn.disabled = true;
          btn.classList.add('opacity-70', 'cursor-wait');
          btn.innerHTML = '';
          btn.appendChild(icon('schedule', 'text-base animate-spin'));
          btn.appendChild(document.createTextNode(' Sending…'));
          try {
            let payload;
            if (isIncident) {
              payload = { notif_type: 'incident_alert', priority: 'urgent', student_id: f.studentId, student_name: f.student_name, student_grade: f.student_grade, related_incident_id: f.related_incident_id || null, title: f.message.trim().slice(0, 60), message: f.message.trim(), contact_method: 'email' };
            } else {
              payload = { notif_type: 'event_notice', priority: 'informational', audience_group: f.audience_group, title: f.message.trim().slice(0, 60), message: f.message.trim(), event_start_at: f.event_start_at, event_end_at: f.event_end_at, contact_method: 'email' };
            }
            const res = await api.sendNotification(payload);
            if (res.ok) {
              toast(`Notification successfully emailed to all parents.`);
            } else {
              toast(`⚠ ${res.error || 'Notification queued but email delivery failed.'}`);
            }
            closeModal();
            el.innerHTML = '';
            parentNotifications(el);
          } catch (e2) {
            errBox.textContent = e2.message || 'Something went wrong sending this notification.';
            errBox.classList.remove('hidden');
            btn.disabled = false;
            btn.classList.remove('opacity-70', 'cursor-wait');
            btn.innerHTML = originalLabel;
          }
        },
      }, icon('send', 'text-base'), 'Send Notification to Parents'),
      h('button', { class: 'btn-ghost', onclick: () => closeModal() }, 'Cancel')));
  };

  const mkTab = (label, type) => h('button', {
    class: `py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-colors clickable ${f.notif_type === type ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`,
    onclick: (e) => {
      f.notif_type = type;
      f.contact_method = 'email';
      tabs.querySelectorAll('button').forEach((b) => {
        b.classList.remove('bg-white', 'text-pink-600', 'shadow-sm');
        if (b === e.currentTarget) b.classList.add('bg-white', 'text-pink-600', 'shadow-sm');
      });
      renderFields();
    },
  }, label);

  tabs.appendChild(mkTab('Urgent Incident Alert', 'incident_alert'));
  tabs.appendChild(mkTab('Event Notice', 'event_notice'));
  renderFields();
  closeModal = openModal(card).close;
}
