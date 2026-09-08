import {
  h, icon, pill, formatDate, inputCls, labelCls,
  capitalize, toast, openModal, moduleShell, skeletonTable,
  dataTable, emptyBanner, errorBanner,
} from '../ui.js';
import * as api from '../api.js';
import { AUDIENCES } from './drills.js';

export async function parentNotifications(el) {
  el.appendChild(moduleShell({
    icon: 'notifications',
    title: 'Parent Notification System',
    subtitle: 'Send urgent incident alerts or informational event notices to parents.',
    actionLabel: 'New Notification',
    onAction: () => composer(el),
  }));
  const holder = h('div', { class: 'space-y-5' });
  el.appendChild(holder);
  return renderNotifications(el, holder);
}

async function renderNotifications(el, holder) {
  holder.innerHTML = '';
  const filterRow = h('div', { class: 'flex flex-wrap items-center gap-2' },
    ['all', 'incident_alert', 'event_notice'].map((k) =>
      h('button', {
        class: `px-4 py-1.5 rounded-full text-xs font-bold border transition-colors clickable ${k === 'all' ? 'bg-pink-600 text-white border-pink-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`,
        onclick: () => renderNotifications(el, holder),
      }, k === 'all' ? 'All' : k === 'incident_alert' ? 'Incident Alerts' : 'Event Notices')));
  holder.appendChild(filterRow);
  holder.appendChild(skeletonTable(4, 7));
  try {
    const rows = await api.listRows('notifications');
    holder.innerHTML = '';
    holder.appendChild(filterRow);
    if (!rows.length) {
      holder.appendChild(emptyBanner({ icon: 'notifications', title: 'No notifications sent yet', text: 'Use "New Notification" to send the first incident alert or event notice.' }));
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
    holder.appendChild(dataTable(columns, rows));
  } catch (e) {
    holder.replaceChildren(filterRow, errorBanner(e.message));
  }
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
  // FIXME: When sending SMS broadcasts via external gateway (Semaphore / Twilio),
  // throttle in batches of 25 numbers with 400ms delay to avoid carrier-level rate-limiting (HTTP 429).
  let closeModal = () => {};
  const card = h('div', { class: 'bg-white rounded-3xl shadow-sm border border-gray-100 overflow-visible' });
  const tabs = h('div', { class: 'grid grid-cols-2 gap-1 p-2 bg-gray-50 border-b border-gray-100' });
  card.appendChild(tabs);

  const f = {
    notif_type: 'incident_alert', studentId: '', student_name: '', student_grade: null,
    related_incident_id: '', title: '', message: '', contact_method: 'email',
    audience_group: 'All Parents', event_start_at: '', event_end_at: '',
  };

  const fields = h('div', { class: 'p-6 grid grid-cols-1 sm:grid-cols-2 gap-4' });
  card.appendChild(fields);

  async function awaitP(t) {
    try { return await api.listRows(t); } catch { return []; }
  }

  const students = awaitP('students');
  const incidents = awaitP('incidents');
  const contacts = awaitP('emergency_contacts');

  const renderFields = async () => {
    fields.innerHTML = '';
    const isAlert = f.notif_type === 'incident_alert';
    const st = await students;
    const inc = await incidents;
    const cts = await contacts;

    if (isAlert) {
      fields.appendChild(h('div', { class: 'sm:col-span-2' },
        h('span', { class: 'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200 animate-pulse' },
          icon('priority_high', 'text-[12px]'), 'URGENT — email parents immediately')));
      const parentHint = h('div', { class: 'sm:col-span-2 hidden rounded-xl bg-emerald-50 border border-emerald-200/70 px-3.5 py-2.5 text-[12px] text-emerald-800' });
      const studentSel = h('select', { class: inputCls, onchange: (e) => {
        const s = st.find((x) => x.id === e.target.value);
        f.studentId = e.target.value; f.student_name = s?.name || ''; f.student_grade = s?.grade || null;
        const linked = (s ? cts : []).filter((c) => c.student_id === s?.id);
        parentHint.classList.toggle('hidden', !linked.length);
        parentHint.textContent = linked.length
          ? `Emails go to: ${linked.map((c) => `${c.name} (${c.relationship}) - ${c.email}`).join(', ')}`
          : '';
      } },
        h('option', { value: '' }, 'Select student…'),
        st.map((s) => h('option', { value: s.id }, `${s.name} — Grade ${s.grade}`)));
      fields.appendChild(h('div', { class: 'sm:col-span-2' }, h('label', { class: labelCls }, 'Student (required)'), studentSel));
      fields.appendChild(parentHint);

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

    fields.appendChild(h('div', { class: 'sm:col-span-2' }, h('label', { class: labelCls }, 'Message'),
      h('textarea', { class: `${inputCls} min-h-[80px] resize-y`, placeholder: 'What should parents know?', oninput: (e) => { f.message = e.target.value; } })));

    const methods = isAlert ? ['email'] : ['app', 'email'];
    fields.appendChild(h('div', { class: 'sm:col-span-2' }, h('label', { class: labelCls }, 'Contact Method'),
      h('select', { class: inputCls, onchange: (e) => { f.contact_method = e.target.value; } },
        methods.map((m) => h('option', { value: m, selected: m === (isAlert ? 'email' : 'app') }, capitalize(m))))));

    const errBox = h('p', { class: 'hidden sm:col-span-2 text-[13px] text-red-600 bg-red-50 border border-red-200/70 rounded-xl px-3.5 py-2.5' });
    fields.appendChild(errBox);
    fields.appendChild(h('div', { class: 'sm:col-span-2 flex items-center gap-3 pt-1' },
      h('button', {
        class: 'btn-primary',
        onclick: async (e) => {
          if (isAlert && !f.studentId) { errBox.textContent = 'A student is required for incident alerts.'; errBox.classList.remove('hidden'); return; }
          if (!isAlert && (!f.audience_group || !f.event_start_at || !f.event_end_at)) {
            errBox.textContent = 'Audience group and event start/end times are required for event notices.'; errBox.classList.remove('hidden'); return;
          }
          if (!isAlert && f.event_end_at <= f.event_start_at) { errBox.textContent = 'Event end must be after event start.'; errBox.classList.remove('hidden'); return; }
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
            const payload = isAlert
              ? { notif_type: 'incident_alert', priority: 'urgent', student_id: f.studentId, student_name: f.student_name, student_grade: f.student_grade, related_incident_id: f.related_incident_id || null, title: f.message.trim().slice(0, 60), message: f.message.trim(), contact_method: f.contact_method }
              : { notif_type: 'event_notice', priority: 'informational', audience_group: f.audience_group, title: f.message.trim().slice(0, 60), message: f.message.trim(), event_start_at: f.event_start_at, event_end_at: f.event_end_at, contact_method: f.contact_method };
            const res = await api.sendNotification(payload);
            if (res.ok) {
              toast(`Notification sent via ${res.channel || f.contact_method}.`);
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
      }, icon('send', 'text-base'), 'Send Notification'),
      h('button', { class: 'btn-ghost', onclick: () => closeModal() }, 'Cancel')));
  };

  const mkTab = (label, type) => h('button', {
    class: `py-2.5 rounded-xl text-sm font-bold transition-colors clickable ${f.notif_type === type ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`,
    onclick: (e) => {
      f.notif_type = type;
      f.contact_method = type === 'incident_alert' ? 'email' : 'app';
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
