export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = v;
    else if (k === 'selected') el.selected = !!v;
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v);
  }
  append(el, children.flat(1));
  return el;
}

export function append(el, children) {
  for (const c of [].concat(children).filter(Boolean)) {
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export { openModal } from './modal.js';
export { pieChart, donutChart, yearBarChart, barChart } from './charts.js';

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined) continue;
    if (k === 'class') el.setAttribute('class', v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else el.setAttribute(k, String(v));
  }
  return el;
}

const FA = {
  add: 'plus', assessment: 'chart-column', 'border-all': 'table-cells',
  check_circle: 'circle-check', checklist: 'list-check', contacts: 'address-book',
  dangerous: 'circle-xmark', database: 'database', download: 'download',
  emergency: 'truck-medical', error: 'circle-exclamation', event: 'calendar-day',
  fact_check: 'clipboard-check', family_restroom: 'children', groups: 'users',
  inbox: 'inbox', local_police: 'handcuffs', logout: 'arrow-right-from-bracket',
  map: 'map', medical_services: 'kit-medical', menu: 'bars',
  calendar_month: 'calendar-days', notifications: 'bell', 'person-running': 'person-running',
  phone: 'phone', print: 'print', priority_high: 'exclamation', report: 'file-lines',
  schedule: 'clock', school: 'school', security: 'shield-halved',
  send: 'paper-plane', support_agent: 'headset', task_alt: 'check',
  upload: 'upload', verified: 'circle-check', verified_user: 'certificate',
  warning: 'triangle-exclamation', calculator: 'calculator', info: 'circle-info',
  close: 'xmark',
};

export function icon(name, cls = 'text-sm') {
  return h('i', { class: `fa-solid fa-${FA[name] || 'circle'} ${cls}`, 'aria-hidden': 'true' });
}

function parseDate(iso) {
  const s = String(iso).replace(' ', 'T');
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + 'T00:00:00') : new Date(s);
}

export function formatDate(iso) {
  if (!iso) return '—';
  const d = parseDate(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(iso) {
  if (!iso) return '—';
  const d = parseDate(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function capitalize(s = '') {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export const inputCls =
  'w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-100 transition-colors';
export const labelCls = 'block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5';

const TONES = {
  pending: 'amber', upcoming: 'blue', open: 'red', resolved: 'green', delivered: 'green',
  read: 'green', sent: 'blue', failed: 'red', completed: 'green', cancelled: 'gray',
  passed: 'green', overdue: 'red', low: 'red', ok: 'green', active: 'green', current: 'green',
  medical: 'pink', 'slips/falls': 'amber', 'fire-related': 'red', security: 'blue', 'equipment failure': 'purple',
  low: 'green', medium: 'amber', moderate: 'amber', high: 'red', critical: 'red',
  'low risk': 'green', 'medium risk': 'amber', 'moderate risk': 'amber', 'high risk': 'red', critical: 'red',
  urgent: 'red', informational: 'pink', admin: 'pink', staff: 'blue', true: 'green', false: 'gray',
  fire: 'red', earthquake: 'amber', lockdown: 'purple', evacuation: 'blue',
  student: 'blue', school: 'purple',
};

const TONE_CLASSES = {
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200/70',
  amber: 'bg-amber-50 text-amber-700 border-amber-200/70',
  red: 'bg-red-50 text-red-700 border-red-200/70',
  blue: 'bg-blue-50 text-blue-700 border-blue-200/70',
  purple: 'bg-purple-50 text-purple-700 border-purple-200/70',
  pink: 'bg-pink-50 text-pink-700 border-pink-200/70',
  gray: 'bg-gray-100 text-gray-600 border-gray-200',
};

export function pill(status, tone) {
  const key = String(status ?? '').toLowerCase();
  const t = tone || TONES[key] || 'gray';
  const cls = TONE_CLASSES[t] || TONE_CLASSES.gray;
  return h('span', {
    class: `inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border whitespace-nowrap ${cls}`,
  }, String(status ?? '—'));
}

export function moduleShell({ icon: iconName, title, subtitle, actionLabel, actionIcon, actionClass, onAction, children }) {
  const wrap = h('div', { class: 'max-w-[1400px] 2xl:max-w-[1600px] mx-auto space-y-6' });
  const head = h('div', { class: 'flex flex-wrap items-end justify-between gap-4' });
  const left = h('div');
  if (iconName) left.appendChild(h('div', { class: 'w-10 h-10 rounded-xl bg-pink-50 text-pink-600 flex items-center justify-center mb-3' }, icon(iconName, 'text-lg')));
  left.appendChild(h('h2', { class: 'text-[28px] font-extrabold text-gray-900 tracking-tight' }, title));
  if (subtitle) left.appendChild(h('p', { class: 'text-[15px] text-gray-500 mt-1 max-w-2xl' }, subtitle));
  head.appendChild(left);
  if (actionLabel) {
    head.appendChild(h('button', {
      class: actionClass || 'btn-primary shrink-0',
      onclick: onAction,
    }, icon(actionIcon || 'add', 'text-base'), actionLabel));
  }
  wrap.appendChild(head);
  append(wrap, children);
  return wrap;
}

export function moduleStats(chips) {
  if (!chips || !chips.length) return null;
  return h('div', { class: 'flex flex-wrap gap-2.5' },
    chips.map((c, i) =>
      h('div', {
        class: `animate-chip card-lift inline-flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white border border-gray-100 shadow-sm`,
        style: { animationDelay: `${i * 50}ms` },
      },
        h('div', { class: `w-7 h-7 rounded-lg flex items-center justify-center ${c.chipCls || 'bg-pink-50 text-pink-600'}` }, icon(c.icon, 'text-[14px]')),
        h('span', { class: 'text-[12px] font-bold text-gray-900' }, String(c.value)),
        h('span', { class: 'text-[11px] text-gray-500' }, c.label),
      ),
    ),
  );
}

export function skeleton(rows = 5, cols = 5) {
  return skeletonTable(rows, cols);
}

export function skeletonHeader({ hasAction = true, hasIcon = true } = {}) {
  const head = h('div', { class: 'flex flex-wrap items-end justify-between gap-4 pb-1 animate-pulse' });
  const left = h('div', { class: 'space-y-2.5' });
  if (hasIcon) {
    left.appendChild(h('div', { class: 'w-10 h-10 rounded-xl bg-gray-200/80 mb-2' }));
  }
  left.appendChild(h('div', { class: 'h-8 w-64 sm:w-80 bg-gray-200/90 rounded-xl' }));
  left.appendChild(h('div', { class: 'h-4 w-48 sm:w-96 bg-gray-100 rounded-full' }));
  head.appendChild(left);
  if (hasAction) {
    head.appendChild(h('div', { class: 'h-10 w-36 sm:w-44 bg-gray-200/80 rounded-2xl shrink-0' }));
  }
  return head;
}

export function skeletonCard({ title = true, lines = 3, height = 'auto' } = {}) {
  const card = h('div', {
    class: 'bg-white rounded-3xl shadow-sm border border-gray-100 p-6 space-y-4 animate-pulse',
    style: height !== 'auto' ? { minHeight: height } : {},
  });
  if (title) {
    card.appendChild(h('div', { class: 'flex items-center justify-between pb-3 border-b border-gray-100' },
      h('div', { class: 'h-5 w-40 bg-gray-200/80 rounded-lg' }),
      h('div', { class: 'h-4 w-16 bg-gray-100 rounded-full' }),
    ));
  }
  for (let i = 0; i < lines; i++) {
    card.appendChild(h('div', {
      class: 'h-4 rounded-full bg-gray-100',
      style: { width: `${80 - ((i * 19) % 35)}%`, animationDelay: `${i * 100}ms` },
    }));
  }
  return card;
}

export function skeletonCharts() {
  const wrap = h('div', { class: 'grid grid-cols-1 lg:grid-cols-2 gap-6' });
  
  // Donut/pie chart card skeleton
  const c1 = h('div', { class: 'bg-white rounded-3xl shadow-sm border border-gray-100 p-6 space-y-4 animate-pulse' },
    h('div', { class: 'flex items-center justify-between pb-3 border-b border-gray-100' },
      h('div', { class: 'h-5 w-44 bg-gray-200/80 rounded-lg' }),
      h('div', { class: 'h-4 w-20 bg-gray-100 rounded-full' }),
    ),
    h('div', { class: 'w-44 h-44 rounded-full border-[18px] border-gray-100 mx-auto my-6 flex items-center justify-center' },
      h('div', { class: 'h-6 w-16 bg-gray-100 rounded-md' }),
    ),
    h('div', { class: 'grid grid-cols-3 gap-3 pt-2' },
      h('div', { class: 'h-4 bg-gray-100 rounded-full' }),
      h('div', { class: 'h-4 bg-gray-100 rounded-full' }),
      h('div', { class: 'h-4 bg-gray-100 rounded-full' }),
    ),
  );
  
  // Bar chart card skeleton
  const c2 = h('div', { class: 'bg-white rounded-3xl shadow-sm border border-gray-100 p-6 space-y-4 animate-pulse' },
    h('div', { class: 'flex items-center justify-between pb-3 border-b border-gray-100' },
      h('div', { class: 'h-5 w-48 bg-gray-200/80 rounded-lg' }),
      h('div', { class: 'h-4 w-20 bg-gray-100 rounded-full' }),
    ),
    h('div', { class: 'flex items-end justify-between h-48 px-4 gap-3 pt-4 border-b border-gray-100 pb-2' },
      [45, 75, 35, 90, 60, 80, 50, 65].map((val) =>
        h('div', { class: 'w-full bg-gray-100 rounded-t-lg', style: { height: `${val}%` } })
      ),
    ),
    h('div', { class: 'flex justify-between px-2 pt-1' },
      h('div', { class: 'h-3 w-10 bg-gray-100 rounded-full' }),
      h('div', { class: 'h-3 w-10 bg-gray-100 rounded-full' }),
      h('div', { class: 'h-3 w-10 bg-gray-100 rounded-full' }),
      h('div', { class: 'h-3 w-10 bg-gray-100 rounded-full' }),
    ),
  );
  
  wrap.appendChild(c1);
  wrap.appendChild(c2);
  return wrap;
}

export function skeletonDashboard() {
  const wrap = h('div', { class: 'space-y-8 max-w-[1400px] 2xl:max-w-[1600px] mx-auto animate-pulse' });
  
  // Top header skeleton with title & action text pills
  wrap.appendChild(
    h('div', { class: 'flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-100' },
      h('div', { class: 'space-y-2' },
        h('div', { class: 'h-8 w-64 bg-gray-200/90 rounded-xl' }),
        h('div', { class: 'h-4 w-80 sm:w-96 bg-gray-100 rounded-full' }),
      ),
      h('div', { class: 'flex items-center gap-2' },
        h('div', { class: 'h-9 w-28 bg-gray-200/80 rounded-xl' }),
        h('div', { class: 'h-9 w-32 bg-gray-200/80 rounded-xl' }),
      ),
    ),
  );
  
  // Hero banner skeleton
  wrap.appendChild(
    h('div', { class: 'bg-white rounded-3xl p-8 border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6' },
      h('div', { class: 'space-y-3 flex-1' },
        h('div', { class: 'h-6 w-36 bg-gray-100 rounded-full' }),
        h('div', { class: 'h-9 w-72 sm:w-96 bg-gray-200/80 rounded-xl' }),
        h('div', { class: 'h-4 w-60 sm:w-80 bg-gray-100 rounded-full' }),
        h('div', { class: 'h-4 w-44 bg-gray-100/70 rounded-full pt-1' }),
      ),
      h('div', { class: 'hidden md:block pr-8' },
        h('div', { class: 'w-36 h-36 rounded-full bg-gray-100' }),
      ),
    ),
  );
  
  // 4 Stat Cards
  wrap.appendChild(skeletonGrid(4));
  
  // 2 Chart Cards
  wrap.appendChild(skeletonCharts());
  
  // Alert banner skeleton
  wrap.appendChild(
    h('div', { class: 'bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center justify-between gap-4' },
      h('div', { class: 'flex items-center gap-3.5 flex-1' },
        h('div', { class: 'w-9 h-9 rounded-full bg-gray-100 shrink-0' }),
        h('div', { class: 'space-y-2 flex-1' },
          h('div', { class: 'h-4 w-48 bg-gray-200/80 rounded-md' }),
          h('div', { class: 'h-3 w-80 bg-gray-100 rounded-full' }),
        ),
      ),
      h('div', { class: 'h-9 w-36 bg-gray-200/70 rounded-xl shrink-0' }),
    ),
  );
  
  return wrap;
}

export function skeletonModulePage({ columns = 5, hasAction = true } = {}) {
  const wrap = h('div', { class: 'max-w-[1400px] 2xl:max-w-[1600px] mx-auto space-y-6 animate-pulse' });
  
  // Header skeleton
  wrap.appendChild(skeletonHeader({ hasAction, hasIcon: true }));
  
  // Search and filter controls skeleton
  wrap.appendChild(
    h('div', { class: 'flex flex-wrap items-center justify-between gap-3' },
      h('div', { class: 'h-11 w-full sm:w-72 bg-white rounded-2xl border border-gray-100 shadow-xs' }),
      h('div', { class: 'flex gap-2' },
        h('div', { class: 'h-10 w-24 bg-white rounded-xl border border-gray-100 shadow-xs' }),
        h('div', { class: 'h-10 w-28 bg-white rounded-xl border border-gray-100 shadow-xs' }),
      ),
    ),
  );
  
  // Table card skeleton
  wrap.appendChild(skeletonTable(5, columns));
  
  return wrap;
}

export function skeletonTable(rows = 5, cols = 5) {
  const wrap = h('div', { class: 'bg-white rounded-3xl shadow-sm border border-gray-100 p-6 space-y-4' });
  
  // Header row
  const header = h('div', { class: 'flex gap-4 border-b border-gray-100 pb-4 mb-2' });
  for (let c = 0; c < cols; c++) {
    header.appendChild(h('div', { class: 'h-4 rounded-full bg-gray-200/60 animate-pulse', style: { width: `${40 + (c * 17 % 30)}%` } }));
  }
  wrap.appendChild(header);

  // Data rows
  for (let r = 0; r < rows; r++) {
    const row = h('div', { class: 'flex gap-4 items-center' });
    for (let c = 0; c < cols; c++) {
      row.appendChild(h('div', { class: 'h-4 rounded-full bg-gray-100 animate-pulse', style: { width: `${60 + ((r * 13 + c * 29) % 30)}%`, animationDelay: `${(r * 50) + (c * 20)}ms` } }));
    }
    wrap.appendChild(row);
  }
  return wrap;
}

export function skeletonGrid(cards = 4) {
  const wrap = h('div', { class: 'grid grid-cols-2 lg:grid-cols-4 gap-5' });
  for (let i = 0; i < cards; i++) {
    wrap.appendChild(
      h('div', { class: 'bg-white rounded-3xl shadow-sm border border-gray-100 p-6 flex flex-col gap-4 animate-pulse' },
        h('div', { class: 'w-12 h-12 rounded-full bg-gray-100' }),
        h('div', { class: 'space-y-2' },
          h('div', { class: 'h-8 bg-gray-100 rounded-lg w-3/4' }),
          h('div', { class: 'h-4 bg-gray-50 rounded-full w-1/2' })
        )
      )
    );
  }
  return wrap;
}

export function skeletonFeed(items = 4) {
  const wrap = h('div', { class: 'bg-white rounded-3xl shadow-sm border border-gray-100 p-6 space-y-6' });
  for (let i = 0; i < items; i++) {
    wrap.appendChild(
      h('div', { class: 'flex gap-4 items-start animate-pulse', style: { animationDelay: `${i * 100}ms` } },
        h('div', { class: 'w-10 h-10 rounded-full bg-gray-100 shrink-0' }),
        h('div', { class: 'flex-1 space-y-2 py-1' },
          h('div', { class: 'h-4 bg-gray-100 rounded-full w-1/3' }),
          h('div', { class: 'h-3 bg-gray-50 rounded-full w-2/3' })
        )
      )
    );
  }
  return wrap;
}

export function emptyBanner({ icon: iconName = 'inbox', title, text }) {
  return h('div', {
    class: 'bg-white rounded-3xl shadow-sm border border-gray-100 p-10 flex flex-col items-center text-center',
  },
    h('div', { class: 'w-12 h-12 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center mb-4' }, icon(iconName, 'text-2xl')),
    h('p', { class: 'text-sm font-bold text-gray-800' }, title),
    text ? h('p', { class: 'text-[13px] text-gray-500 mt-1 max-w-md' }, text) : null,
  );
}

export function errorBanner(message, onRetry) {
  return h('div', {
    class: 'bg-red-50 border border-red-200/70 rounded-2xl p-5 flex items-start gap-3',
  },
    icon('error', 'text-red-500 text-lg mt-0.5'),
    h('div', { class: 'flex-1' },
      h('p', { class: 'text-[13px] font-bold text-red-700' }, 'Could not load data'),
      h('p', { class: 'text-[13px] text-red-600/80 mt-0.5' }, message || 'The request failed.'),
    ),
    onRetry ? h('button', {
      class: 'px-4 py-2 rounded-xl bg-white border border-red-200 text-red-700 text-xs font-semibold hover:bg-red-100 transition-colors clickable shrink-0',
      onclick: onRetry,
    }, 'Retry') : null,
  );
}

export function toast(msg) {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const node = h('div', {
    class: 'bg-gray-900 text-white text-[13px] font-semibold px-4 py-3 rounded-xl shadow-lg flex items-center gap-3',
  },
    icon('check_circle', 'text-emerald-400 text-base shrink-0'),
    h('span', { class: 'flex-1' }, msg),
    h('button', {
      class: 'text-gray-400 hover:text-white clickable shrink-0',
      'aria-label': 'Dismiss',
      onclick: () => node.remove(),
    }, '✕'),
  );
  root.appendChild(node);
  setTimeout(() => node.remove(), 4500);
}

export function dataTable(columns, rows) {
  const table = h('table', { class: 'w-full text-left border-collapse' });
  const thead = h('thead');
  const tr = h('tr', { class: 'border-b border-gray-100' });
  for (const col of columns) {
    tr.appendChild(h('th', {
      class: 'px-5 py-3.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 whitespace-nowrap',
    }, col.label));
  }
  thead.appendChild(tr);
  table.appendChild(thead);

  const tbody = h('tbody');
  rows.forEach((r, i) => {
    const row = h('tr', {
      class: `animate-row border-b border-gray-50 ${i % 2 ? 'bg-gray-50/40' : ''} hover:bg-pink-50/30 transition-colors`,
      style: { animationDelay: `${Math.min(i * 40, 320)}ms` },
    });
    for (const col of columns) {
      row.appendChild(h('td', { class: 'px-5 py-3.5 text-[13px] align-middle' },
        col.render ? col.render(r) : (r[col.key] ?? '—')));
    }
    tbody.appendChild(row);
  });
  table.appendChild(tbody);

  return h('div', { class: 'bg-white rounded-3xl shadow-sm border border-gray-100 overflow-visible' },
    h('div', { class: 'overflow-x-auto overflow-y-visible' }, table)
  );
}

const STAT_TONES = {
  pink: 'bg-pink-50 text-pink-600', blue: 'bg-blue-50 text-blue-600', green: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600', red: 'bg-red-50 text-red-600', purple: 'bg-purple-50 text-purple-600',
};

export function statCard({ label, value, sub, iconName, tone = 'pink', blob = 'bg-pink-50', href }) {
  const tag = href ? 'a' : 'div';
  const attrs = {
    class: 'card-lift bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col relative overflow-hidden'
      + (href ? ' clickable focus:outline-none focus:ring-2 focus:ring-pink-200' : ''),
  };
  if (href) attrs.href = href;
  return h(tag, attrs,
    h('div', { class: `absolute -right-8 -bottom-8 w-32 h-32 rounded-full opacity-50 ${blob}` }),
    h('div', { class: 'relative z-10' },
      h('div', { class: `w-8 h-8 rounded-xl flex items-center justify-center mb-4 ${STAT_TONES[tone] || STAT_TONES.pink}` }, icon(iconName, 'text-sm')),
      h('p', { class: 'text-[10px] font-bold text-gray-400 uppercase tracking-widest' }, label),
      h('p', { class: 'text-[32px] font-extrabold text-gray-900 mt-2 leading-none' }, value),
      sub ? h('p', { class: 'text-[11px] text-gray-500 mt-5 leading-snug' }, sub) : null,
    ),
  );
}
