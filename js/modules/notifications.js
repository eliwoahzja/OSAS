import { coverLoading } from '../loading.js';
import {
  h, icon, pill, formatDate, inputCls, labelCls,
  toast, openModal, moduleShell, skeletonHeader, skeletonTableWithColumns,
  dataTable, emptyBanner, errorBanner,
} from '../ui.js';
import * as api from '../api.js';
import { isAdmin } from '../auth.js';
import { EVENT_NOTICE_CATEGORIES, EVENT_NOTICE_AUDIENCES, eventNoticePayload, validateEventNotice } from './event-notice.js';

// The school covers Grade 7 to Grade 10.
export const GRADE_OPTIONS = [7, 8, 9, 10];

function normalizeGrade(value) {
  if (value === null || value === undefined || value === '') return null;
  const m = String(value).match(/\d{1,2}/);
  return m ? Number(m[0]) : null;
}

// Grades an audience_group string targets. `null` = every grade
// (campus-wide groups such as "All Parents & Guardians").
export function gradesFromAudience(audience) {
  const a = String(audience || '').toLowerCase();
  if (!a) return null;
  const range = /grades?\s*(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})/.exec(a);
  if (range) {
    const lo = Number(range[1]);
    const hi = Number(range[2]);
    if (lo > hi) return null;
    return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  }
  const single = /grades?\s*(\d{1,2})/.exec(a);
  if (single) return [Number(single[1])];
  if (/senior high/.test(a)) return [11, 12];
  return null;
}

// Grades a notification reaches. Prefers the real student grade field; falls
// back to the stored audience_group for event notices (never display text).
export function notificationGrades(row) {
  const s = Array.isArray(row.students) ? row.students[0] : row.students;
  const fromStudent = normalizeGrade(s && s.grade);
  if (fromStudent) return [fromStudent];
  return gradesFromAudience(row.audience_group);
}

export async function parentNotifications(el) {
  if (!isAdmin()) { el.replaceChildren(errorBanner('Parent Notifications is for administrators only.')); return; }
  return renderNotifications(el);
}

async function renderNotifications(el, currentType = 'all', currentGrade = 'all') {
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
    const rows = await api.listRows('notifications');

    el.innerHTML = '';
    const shell = moduleShell({
      icon: 'notifications',
      title: 'Parent Notification System',
      subtitle: 'Notify parents and guardians about upcoming school events, drills, preparedness activities, and meetings.',
      actionLabel: isAdmin() ? 'New Notification' : null,
      onAction: () => composer(el),
    });
    el.appendChild(shell);

    const realHolder = h('div', { class: 'space-y-5' });
    shell.appendChild(realHolder);

    const filterRow = h('div', { class: 'flex flex-wrap items-center gap-2' },
      [
        { key: 'all', label: 'All' },
        { key: 'event_notice', label: 'Event Notifications' },
      ].map((k) =>
        h('button', {
          class: `px-4 py-1.5 rounded-full text-xs font-bold border transition-colors clickable ${k.key === currentType ? 'bg-pink-600 text-white border-pink-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`,
          onclick: () => renderNotifications(el, k.key, currentGrade),
        }, k.label)));
    realHolder.appendChild(filterRow);

    const typeRows = rows
      .filter((r) => {
        const rawTitle = String(r.title || '');
        const rawMsg = String(r.message || '');
        const rawAudience = String(r.audience_group || '');
        const isStock = r.notif_type === 'alert' ||
          (r.notif_type !== 'event_notice' && (
            /restock|supplies|stock|inventory|shortage/i.test(rawTitle) ||
            /restock|supplies|stock|inventory|depleted/i.test(rawMsg) ||
            /clinic|custodian/i.test(rawAudience)));
        return !isStock;
      })
      .filter((r) => {
        if (currentType === 'event_notice') return r.notif_type === 'event_notice';
        return true;
      });

    // Grade filter (administrators): combines with the type tabs — both match.
    const gradeNum = currentGrade === 'all' ? null : Number(currentGrade);
    const filteredRows = gradeNum === null ? typeRows : typeRows.filter((r) => {
      const grades = notificationGrades(r);
      return grades === null || grades.includes(gradeNum);
    });

    if (isAdmin()) {
      realHolder.appendChild(h('div', { class: 'flex flex-wrap items-center gap-2' },
        h('span', { class: 'text-[10px] font-bold uppercase tracking-widest text-gray-400 mr-0.5' }, 'Grade'),
        [{ key: 'all', label: 'All Grades' }, ...GRADE_OPTIONS.map((g) => ({ key: String(g), label: `Grade ${g}` }))]
          .map((g) => h('button', {
            class: `px-3.5 py-1.5 rounded-full text-xs font-bold border transition-colors clickable ${g.key === currentGrade ? 'bg-pink-50 text-pink-700 border-pink-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`,
            'aria-pressed': g.key === currentGrade ? 'true' : 'false',
            onclick: () => renderNotifications(el, currentType, g.key),
          }, g.label)),
        h('span', { class: 'ml-auto text-[11px] font-bold text-gray-400 whitespace-nowrap' },
          `${filteredRows.length} notification${filteredRows.length === 1 ? '' : 's'} shown`)));
    }

    const realTableWrap = h('div');
    realHolder.appendChild(realTableWrap);

    if (!filteredRows.length) {
      realTableWrap.appendChild(emptyBanner({
        icon: 'notifications',
        title: gradeNum === null ? 'No notifications found' : `No notifications for Grade ${gradeNum}`,
        text: gradeNum === null
          ? 'Use "New Notification" to notify parents about upcoming events, drills, activities, or meetings.'
          : `Nothing matches Grade ${gradeNum} with this type tab. Try "All Grades" or another tab.`,
      }));
      return;
    }
    const columns = [
      { key: 'notif_type', label: 'Type', render: (r) => notifBadge(r) },
      { key: 'message', label: 'Notice', render: (r) => h('div', { class: 'max-w-[320px] space-y-1' }, h('strong', { class: 'block text-gray-900 font-bold' }, r.title || 'Parent Notification'), h('span', { class: 'block text-gray-600' }, r.message)) },
      { key: 'audience', label: 'Audience', render: (r) => audienceCell(r) },
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

function audienceCell(r) {
  const s = Array.isArray(r.students) ? r.students[0] : r.students;
  if (r.notif_type === 'incident_alert') {
    if (/^all parents/i.test(String(r.audience_group || ''))) {
      return h('span', { class: 'text-gray-600' }, 'All parents & guardians (campus-wide)');
    }
    if (s) {
      return h('span', { class: 'text-gray-600' }, `Parent/guardian of ${s.name}${s.grade ? ` · Grade ${s.grade}` : ''}`);
    }
  }
  return h('span', { class: 'text-gray-600' }, r.audience_group || '—');
}

function notifBadge(r) {
  const rawTitle = String(r.title || '');
  const rawMsg = String(r.message || '');
  const rawAudience = String(r.audience_group || '');
  const isStock = r.notif_type === 'alert' ||
    (r.notif_type !== 'event_notice' && (
      /restock|supplies|stock|inventory|shortage/i.test(rawTitle) ||
      /restock|supplies|stock|inventory|depleted/i.test(rawMsg) ||
      /clinic|custodian/i.test(rawAudience)));
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
      class: 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border whitespace-nowrap bg-gray-100 text-gray-600 border-gray-200',
    },
      icon('info', 'text-[12px] text-gray-500'),
      'Past Incident Notice',
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
  let reviewing = false;
  let sending = false;
  let errorBox;

  const f = {
    category: 'Upcoming Event',
    title: '',
    message: '',
    audience_group: 'All Parents & Guardians',
    event_start_at: '',
    event_end_at: '',
  };

  const card = h('div', { class: 'bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden' });
  card.appendChild(h('div', { class: 'p-5 sm:p-6 border-b border-gray-100' },
    h('p', { class: 'text-[11px] font-bold tracking-wider uppercase text-pink-700' }, 'Parent Notification System'),
    h('h2', { class: 'mt-1 text-xl font-extrabold text-gray-900' }, 'Event Notification'),
    h('p', { class: 'mt-2 text-sm leading-relaxed text-gray-500' },
      'One place to notify parents about upcoming events, preparedness drills, school activities, and meetings.')));
  const fields = h('div', { class: 'p-5 sm:p-6 space-y-4' });
  card.appendChild(fields);

  function showError(message) {
    if (!errorBox) return;
    errorBox.textContent = message;
    errorBox.classList.remove('hidden');
  }

  function selectField(label, key, options, description) {
    const select = h('select', {
      class: inputCls,
      value: f[key],
      onchange: (e) => { f[key] = e.target.value; },
    }, options.map((value) => h('option', { value, selected: value === f[key] }, value)));
    return h('div', {}, h('label', { class: labelCls }, label), select,
      ...(description ? [h('p', { class: 'lg-field-hint' }, description)] : []));
  }

  function inputField(label, key, type, placeholder = '') {
    return h('div', {},
      h('label', { class: labelCls }, label),
      h('input', {
        type, class: inputCls, value: f[key], placeholder,
        ...(key === 'title' ? { maxlength: '180' } : {}),
        oninput: (e) => { f[key] = e.target.value; },
      }));
  }

  function actions(...buttons) {
    return h('div', { class: 'flex flex-wrap gap-3 pt-2' }, buttons);
  }

  function button(label, handler, secondary = false) {
    return h('button', {
      type: 'button',
      class: secondary ? 'btn-ghost' : 'btn-primary',
      onclick: handler,
    }, ...(secondary ? [] : [icon('send', 'text-base')]), label);
  }

  async function switchForm() {
    const loading = coverLoading(fields, { fields: 3, label: 'Loading notification form' });
    if (await loading.ready && fields.isConnected) render();
  }

  function render() {
    fields.replaceChildren();
    fields.appendChild(h('p', {
      class: 'text-[12px] text-gray-500 rounded-xl border border-pink-100 bg-pink-50 p-3',
    }, reviewing
      ? 'Review the notice and its recipients. Selecting Send will email registered parents and guardians.'
      : 'All dates and times use Philippine time (PHT, UTC+8).'));

    if (!reviewing) {
      fields.appendChild(selectField('Notice Category', 'category', EVENT_NOTICE_CATEGORIES,
        'Choose Upcoming Event, Drill & Preparedness, School Activity, Meeting, or Other School Notice.'));
      fields.appendChild(inputField('Notice Title (required)', 'title', 'text', 'e.g. Earthquake Drill, PTA Meeting'));
      fields.appendChild(selectField('Parents / Guardians to Notify', 'audience_group', EVENT_NOTICE_AUDIENCES,
        'Only guardians registered for the selected grades will receive the email.'));
      fields.appendChild(h('div', { class: 'grid grid-cols-1 sm:grid-cols-2 gap-4' },
        inputField('Start Date & Time (PHT)', 'event_start_at', 'datetime-local'),
        inputField('End Date & Time (PHT)', 'event_end_at', 'datetime-local')));
      fields.appendChild(h('div', {},
        h('label', { class: labelCls }, 'Message to Parents (required)'),
        h('textarea', {
          class: inputCls + ' min-h-[110px] resize-y',
          value: f.message,
          maxlength: '2000',
          placeholder: 'Describe the activity, preparation required, location, and what parents need to know.',
          oninput: (e) => { f.message = e.target.value; },
        })));
    } else {
      const summary = eventNoticePayload(f);
      const format = (iso) => new Date(iso).toLocaleString('en-PH', {
        dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila',
      });
      const rows = [
        ['Category', f.category],
        ['Title', f.title.trim()],
        ['Audience', f.audience_group],
        ['Starts', format(summary.event_start_at)],
        ['Ends', format(summary.event_end_at)],
        ['Message', f.message.trim()],
      ];
      fields.appendChild(h('div', { class: 'rounded-xl border border-gray-200 divide-y divide-gray-100' },
        rows.map(([label, value]) => h('div', { class: 'p-3 sm:p-4' },
          h('p', { class: 'text-[10px] uppercase tracking-wide font-bold text-gray-500' }, label),
          h('p', { class: 'mt-1 text-sm text-gray-900 whitespace-pre-wrap break-words' }, value)))));
    }

    errorBox = h('p', { class: 'hidden text-[13px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2' });
    fields.appendChild(errorBox);

    if (reviewing) {
      fields.appendChild(actions(
        button('Confirm & Send Email', async (event) => {
          if (sending) return;
          const btn = event.currentTarget;
          sending = true;
          btn.disabled = true;
          try {
            const payload = eventNoticePayload(f);
            const result = await api.sendNotification(payload);
            if (!result.ok) {
              showError(result.error || 'The email was not sent. Check the notification service.');
              return;
            }
            const delivered = result.delivery && Number.isFinite(Number(result.delivery.sent))
              ? Number(result.delivery.sent) : null;
            const failed = Number(result.delivery?.failed || 0);
            toast(failed
              ? 'Event notice sent to ' + (delivered ?? 0) + ' parent(s); ' + failed + ' delivery attempt(s) failed.'
              : 'Event notice sent to ' + f.audience_group + (delivered !== null
                ? ' (' + delivered + ' recipient' + (delivered === 1 ? '' : 's') + ')' : '') + '.');
            closeModal();
            renderNotifications(el);
          } catch (error) {
            showError(error.message || 'Unable to send this notice.');
          } finally {
            sending = false;
            btn.disabled = false;
          }
        }),
        button('Edit Details', () => { reviewing = false; void switchForm(); }, true)));
    } else {
      fields.appendChild(actions(
        button('Review Notification', () => {
          const error = validateEventNotice(f);
          if (error) return showError(error);
          reviewing = true;
          void switchForm();
        }),
        button('Cancel', () => closeModal(), true)));
    }
  }

  render();
  closeModal = openModal(card).close;
}
