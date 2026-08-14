// ============================================================
// OSAS shared UI builders — small DOM helpers that render the
// design system (maroon/cream/pink) without any framework.
// ============================================================

/** Minimal hyperscript: h('div', {class:'x', onclick:fn}, ...children) */
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

/**
 * Open content (usually a form) as a centered modal popup.
 * Closes on backdrop click, Escape, or the returned close().
 */
export function openModal(content) {
  const overlay = h('div', {
    class: 'fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-4 overflow-y-auto',
    onclick: (e) => { if (e.target === overlay) close(); },
  });
  const card = h('div', {
    class: 'bg-white rounded-3xl shadow-2xl border border-gray-100 w-full max-w-2xl max-h-[90vh] overflow-y-auto',
  });
  overlay.appendChild(card);
  card.appendChild(content);
  document.body.appendChild(overlay);
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  function close() {
    document.removeEventListener('keydown', onKey);
    overlay.remove();
  }
  return { close };
}

/** SVG element builder (circle/text need the SVG namespace). */
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

/** Material symbol icon (ligature glyph from the icon font). */
export function icon(name, cls = 'text-sm') {
  return h('span', { class: `material-symbols-outlined ${cls}`, 'aria-hidden': 'true' }, name);
}

// ---------- Formatting helpers ----------

function parseDate(iso) {
  const s = String(iso).replace(' ', 'T');
  // date-only strings parse as UTC; read them as local so the
  // displayed day never shifts for users behind UTC.
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

// ---------- Form class constants (ported from the React pages) ----------

export const inputCls =
  'w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-100 transition-colors';
export const labelCls = 'block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5';

// ---------- Status pill ----------

const TONES = {
  // neutral statuses
  pending: 'amber', upcoming: 'blue', open: 'red', resolved: 'green', delivered: 'green',
  read: 'green', sent: 'blue', failed: 'red', completed: 'green', cancelled: 'gray',
  passed: 'green', overdue: 'red', low: 'red', ok: 'green', active: 'green', current: 'green',
  // incident types
  medical: 'pink', 'slips/falls': 'amber', 'fire-related': 'red', security: 'blue', 'equipment failure': 'purple',
  // severity
  low: 'green', medium: 'amber', high: 'red', critical: 'red',
  // risk level
  'low risk': 'green', 'medium risk': 'amber', 'high risk': 'red', critical: 'red',
  // misc
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

// ---------- Module page shell ----------

export function moduleShell({ icon: iconName, title, subtitle, actionLabel, onAction, children }) {
  const wrap = h('div', { class: 'max-w-[1400px] 2xl:max-w-[1600px] mx-auto space-y-6' });
  const head = h('div', { class: 'flex flex-wrap items-end justify-between gap-4' });
  const left = h('div');
  if (iconName) left.appendChild(h('div', { class: 'w-10 h-10 rounded-xl bg-pink-50 text-pink-600 flex items-center justify-center mb-3' }, icon(iconName, 'text-lg')));
  left.appendChild(h('h2', { class: 'text-[28px] font-extrabold text-gray-900 tracking-tight' }, title));
  if (subtitle) left.appendChild(h('p', { class: 'text-[15px] text-gray-500 mt-1 max-w-2xl' }, subtitle));
  head.appendChild(left);
  if (actionLabel) {
    head.appendChild(h('button', {
      class: 'btn-press inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-pink-600 text-white text-sm font-semibold shadow-sm hover:bg-pink-700 cursor-pointer shrink-0',
      onclick: onAction,
    }, icon('add', 'text-base'), actionLabel));
  }
  wrap.appendChild(head);
  append(wrap, children);
  return wrap;
}

// ---------- Module summary strip ----------

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

// ---------- Data states ----------

export function skeleton(rows = 5, cols = 6) {
  const wrap = h('div', { class: 'bg-white rounded-3xl shadow-sm border border-gray-100 p-6 space-y-3' });
  for (let r = 0; r < rows; r++) {
    const row = h('div', { class: 'flex gap-4' });
    for (let c = 0; c < cols; c++) {
      row.appendChild(h('div', { class: `h-4 rounded-full bg-gray-100 animate-pulse`, style: { width: `${70 + ((r * 13 + c * 29) % 25)}%` } }));
    }
    wrap.appendChild(row);
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
      class: 'px-4 py-2 rounded-xl bg-white border border-red-200 text-red-700 text-xs font-semibold hover:bg-red-100 transition-colors cursor-pointer shrink-0',
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
      class: 'text-gray-400 hover:text-white cursor-pointer shrink-0',
      'aria-label': 'Dismiss',
      onclick: () => node.remove(),
    }, '✕'),
  );
  root.appendChild(node);
  setTimeout(() => node.remove(), 4500);
}

// ---------- Data table ----------

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

  return h('div', { class: 'bg-white rounded-3xl shadow-sm border border-gray-100 overflow-x-auto' }, table);
}

// ---------- Donut chart (SVG, legend shows name + count + %) ----------

const CHART_COLORS = ['#EC4899', '#F59E0B', '#3B82F6', '#8B5CF6', '#10B981', '#EF4444', '#14B8A6', '#F97316', '#6366F1', '#D946EF'];

export function donutChart(items, { centerLabel = 'Total', size = 200, stroke = 26 } = {}) {
  const total = items.reduce((s, i) => s + i.value, 0) || 0;
  const radius = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * radius;

  let offset = 0;
  const segs = items.map((it, i) => {
    const frac = total ? it.value / total : 0;
    const seg = {
      ...it,
      pct: total ? Math.round(frac * 100) : 0,
      dash: `${frac * circ} ${circ}`,
      offset: -offset * circ,
      color: CHART_COLORS[i % CHART_COLORS.length],
    };
    offset += frac;
    return seg;
  });

  const svg = svgEl('svg', {
    viewBox: `0 0 ${size} ${size}`,
    class: 'w-full max-w-[220px] h-auto',
    role: 'img',
  });
  svg.appendChild(svgEl('circle', { cx, cy, r: radius, fill: 'none', stroke: '#F3F4F6', 'stroke-width': stroke }));
  const segEls = segs.map((s) => svgEl('circle', {
    cx, cy, r: radius, fill: 'none',
    class: 'donut-seg',
    stroke: s.color, 'stroke-width': stroke,
    'stroke-dasharray': s.dash, 'stroke-dashoffset': circ,
    'stroke-linecap': 'butt',
    transform: `rotate(-90 ${cx} ${cy})`,
  }));
  for (const el of segEls) svg.appendChild(el);
  // draw-in: animate from empty to the target offset on the next frames
  requestAnimationFrame(() => requestAnimationFrame(() => {
    segEls.forEach((el, i) => { el.setAttribute('stroke-dashoffset', String(segs[i].offset)); });
  }));
  const centerTotal = svgEl('text', { x: cx, y: cy - 6, 'text-anchor': 'middle', class: 'fill-gray-900', style: { fontSize: 26, fontWeight: 800 } });
  centerTotal.textContent = String(total);
  svg.appendChild(centerTotal);
  const centerLabelEl = svgEl('text', { x: cx, y: cy + 18, 'text-anchor': 'middle', class: 'fill-gray-400', style: { fontSize: 10, fontWeight: 700, letterSpacing: '.1em' } });
  centerLabelEl.textContent = centerLabel.toUpperCase();
  svg.appendChild(centerLabelEl);

  const legend = h('div', { class: 'flex-1 min-w-[220px] space-y-2.5' },
    segs.length
      ? segs.map((s) =>
          h('div', { class: 'flex items-center gap-2.5' },
            h('span', { class: 'w-2.5 h-2.5 rounded-full shrink-0', style: { backgroundColor: s.color } }),
            h('span', { class: 'text-[13px] text-gray-700 flex-1 capitalize' }, s.label),
            h('span', { class: 'text-[13px] font-bold text-gray-900' }, String(s.value)),
            h('span', { class: 'text-[11px] text-gray-400 w-10 text-right' }, `${s.pct}%`),
          )
        )
      : h('p', { class: 'text-[13px] text-gray-400' }, 'No data yet.'),
  );

  return h('div', {
    class: 'bg-white rounded-3xl shadow-sm border border-gray-100 p-6 flex flex-col sm:flex-row items-center gap-8',
  },
    h('div', { class: 'shrink-0' }, svg),
    legend,
  );
}

// ---------- Dashboard stat card ----------

const STAT_TONES = {
  pink: 'bg-pink-50 text-pink-600', blue: 'bg-blue-50 text-blue-600', green: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600', red: 'bg-red-50 text-red-600', purple: 'bg-purple-50 text-purple-600',
};

export function statCard({ label, value, sub, iconName, tone = 'pink', blob = 'bg-pink-50' }) {
  return h('div', {
    class: 'card-lift bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col relative overflow-hidden',
  },
    h('div', { class: `absolute -right-8 -bottom-8 w-32 h-32 rounded-full opacity-50 ${blob}` }),
    h('div', { class: 'relative z-10' },
      h('div', { class: `w-8 h-8 rounded-xl flex items-center justify-center mb-4 ${STAT_TONES[tone] || STAT_TONES.pink}` }, icon(iconName, 'text-sm')),
      h('p', { class: 'text-[10px] font-bold text-gray-400 uppercase tracking-widest' }, label),
      h('p', { class: 'text-[32px] font-extrabold text-gray-900 mt-2 leading-none' }, value),
      sub ? h('p', { class: 'text-[11px] text-gray-500 mt-5 leading-snug' }, sub) : null,
    ),
  );
}
