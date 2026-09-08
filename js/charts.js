import { h, icon } from './ui.js';

/**
 * Lightweight SVG Chart Engine.
 *
 * WHY:
 * 1. Zero external dependencies: Avoids bundling large external chart libraries (e.g. Chart.js, Recharts),
 *    saving ~250KB of network payload over slow Philippine provincial Wi-Fi networks.
 * 2. Analytic SVG path lengths: Calculating segment lengths mathematically (Math.hypot) avoids
 *    triggering forced DOM reflows / layout thrashing (el.getTotalLength()).
 * 3. Donut starts at -90deg: Humans expect gauge meters to sweep clockwise starting from 12 o'clock.
 */

const CHART_COLORS = [
  '#EC4899', '#F59E0B', '#3B82F6', '#8B5CF6', '#10B981',
  '#EF4444', '#14B8A6', '#F97316', '#6366F1', '#D946EF',
];

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

export function pieChart(items, { title = '', size = 180, isDonut = false } = {}) {
  const total = items.reduce((s, i) => s + (Number(i.value) || 0), 0) || 0;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 10;
  const innerR = isDonut ? r * 0.55 : 0;

  let startAngle = -Math.PI / 2;
  const segs = items.map((it, i) => {
    const val = Number(it.value) || 0;
    const frac = total ? val / total : 0;
    const angle = frac * 2 * Math.PI;
    const endAngle = startAngle + angle;

    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);

    const largeArc = frac > 0.5 ? 1 : 0;

    let pathD = '';
    if (frac >= 0.999) {
      if (isDonut) {
        pathD = `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r} M ${cx} ${cy - innerR} A ${innerR} ${innerR} 0 1 0 ${cx} ${cy + innerR} A ${innerR} ${innerR} 0 1 0 ${cx} ${cy - innerR} Z`;
      } else {
        pathD = `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r} Z`;
      }
    } else if (frac > 0) {
      if (isDonut) {
        const ix1 = cx + innerR * Math.cos(endAngle);
        const iy1 = cy + innerR * Math.sin(endAngle);
        const ix2 = cx + innerR * Math.cos(startAngle);
        const iy2 = cy + innerR * Math.sin(startAngle);
        pathD = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix2} ${iy2} Z`;
      } else {
        pathD = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
      }
    }

    startAngle = endAngle;

    return {
      ...it,
      value: val,
      pct: total ? Math.round(frac * 100) : 0,
      pathD,
      color: it.color || CHART_COLORS[i % CHART_COLORS.length],
    };
  });

  const svg = svgEl('svg', {
    viewBox: `0 0 ${size} ${size}`,
    class: 'w-full max-w-[160px] h-auto drop-shadow-sm',
    role: 'img',
  });

  if (total === 0) {
    svg.appendChild(svgEl('circle', {
      cx, cy, r,
      fill: '#F3F4F6',
      stroke: '#E5E7EB',
      'stroke-width': 2,
    }));
    const noDataText = svgEl('text', {
      x: cx, y: cy + 4,
      'text-anchor': 'middle',
      class: 'fill-gray-400 text-xs font-semibold',
    });
    noDataText.textContent = 'No data';
    svg.appendChild(noDataText);
  } else {
    segs.forEach((s) => {
      if (!s.pathD) return;
      const slice = svgEl('path', {
        d: s.pathD,
        fill: s.color,
        stroke: '#ffffff',
        'stroke-width': '2',
        class: 'transition-all duration-200 hover:opacity-90 hover:brightness-105 cursor-pointer',
      });
      const titleEl = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      titleEl.textContent = `${s.label}: ${s.value} (${s.pct}%)`;
      slice.appendChild(titleEl);
      svg.appendChild(slice);
    });
  }

  const legend = h('div', { class: 'flex-1 min-w-[130px] space-y-1.5 max-h-[160px] overflow-y-auto pr-1' },
    segs.length
      ? segs.map((s) =>
          h('div', { class: 'flex items-center gap-2 text-xs hover:bg-gray-50/80 p-1 rounded-lg transition-colors' },
            h('span', { class: 'w-2.5 h-2.5 rounded-full shrink-0 shadow-sm', style: { backgroundColor: s.color } }),
            h('span', { class: 'text-gray-700 flex-1 truncate capitalize font-medium text-[12px]', title: s.label }, s.label),
            h('span', { class: 'font-bold text-gray-900 ml-1 text-[12px]' }, String(s.value)),
            h('span', { class: 'text-gray-400 w-8 text-right font-mono text-[10px]' }, `${s.pct}%`),
          )
        )
      : h('p', { class: 'text-xs text-gray-400' }, 'No data recorded yet.'),
  );

  return h('div', {
    class: 'bg-white rounded-3xl shadow-sm border border-gray-100 p-5 flex flex-col justify-between hover:shadow-md transition-shadow',
  },
    title
      ? h('div', { class: 'flex items-center justify-between border-b border-gray-100 pb-3 mb-4' },
          h('h4', { class: 'text-sm font-bold text-gray-900 flex items-center gap-2' },
            h('span', { class: 'w-2 h-2 rounded-full bg-pink-500' }),
            title,
          ),
          h('span', { class: 'text-[11px] font-semibold text-gray-400 uppercase tracking-wider' }, `${total} total`),
        )
      : null,
    h('div', { class: 'flex flex-col sm:flex-row items-center gap-5' },
      h('div', { class: 'shrink-0 flex items-center justify-center p-1' }, svg),
      legend,
    ),
  );
}

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

export function yearBarChart(items, { title = 'Incidents by Year', subtitle = '' } = {}) {
  if (!items || !items.length) {
    return h('div', { class: 'bg-white rounded-3xl shadow-sm border border-gray-100 p-10 flex flex-col items-center text-center' },
      h('div', { class: 'w-12 h-12 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center mb-4' }, icon('chart-column', 'text-2xl')),
      h('p', { class: 'text-sm font-bold text-gray-800' }, 'No historical data yet'),
      h('p', { class: 'text-[13px] text-gray-500 mt-1' }, 'Incidents from past years will appear here once recorded.'),
    );
  }

  const currentYear = new Date().getFullYear();
  const maxVal = Math.max(...items.map((d) => d.incidents), 1);
  const scaleMax = Math.max(maxVal * 1.2, maxVal + 1);

  const chartWidth = 640;
  const chartHeight = 160;
  const padTop = 28;
  const padBottom = 28;
  const padLeft = 20;
  const padRight = 20;
  const plotW = chartWidth - padLeft - padRight;
  const plotH = chartHeight - padTop - padBottom;

  const points = items.map((d, i) => ({
    ...d,
    x: items.length > 1 ? padLeft + (i * plotW) / (items.length - 1) : padLeft + plotW / 2,
    y: padTop + plotH - (d.incidents / scaleMax) * plotH,
  }));

  let pathLen = 0;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`;
    pathLen += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  if (points.length === 1) pathLen = 1;

  const areaD = `${d} L ${points[points.length - 1].x} ${padTop + plotH} L ${points[0].x} ${padTop + plotH} Z`;

  const svg = svgEl('svg', { viewBox: `0 0 ${chartWidth} ${chartHeight}`, class: 'w-full h-auto block', role: 'img' });

  const gradId = `trendFill-${Math.random().toString(36).slice(2, 9)}`;
  const defs = svgEl('defs');
  const grad = svgEl('linearGradient', { id: gradId, x1: 0, y1: 0, x2: 0, y2: 1 });
  grad.appendChild(svgEl('stop', { offset: '0%', 'stop-color': '#DB2777', 'stop-opacity': 0.22 }));
  grad.appendChild(svgEl('stop', { offset: '100%', 'stop-color': '#DB2777', 'stop-opacity': 0 }));
  defs.appendChild(grad);
  svg.appendChild(defs);

  svg.appendChild(svgEl('line', {
    x1: padLeft, y1: padTop + plotH, x2: chartWidth - padRight, y2: padTop + plotH,
    stroke: '#F3F4F6', 'stroke-width': 1,
  }));

  const area = svgEl('path', { d: areaD, fill: `url(#${gradId})`, class: 'trend-fill', style: { opacity: 0 } });
  svg.appendChild(area);

  const linePath = svgEl('path', {
    d, fill: 'none', stroke: '#DB2777', 'stroke-width': 3,
    'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    class: 'trend-line-path',
    style: { strokeDasharray: `${pathLen}`, strokeDashoffset: `${pathLen}` },
  });
  svg.appendChild(linePath);

  const pointEls = [];
  points.forEach((p, i) => {
    const isCurrent = p.year === currentYear;

    const dot = svgEl('circle', {
      cx: p.x, cy: p.y, r: 0,
      fill: '#ffffff', stroke: '#DB2777', 'stroke-width': isCurrent ? 3 : 2.5,
      class: 'trend-point',
      style: { opacity: 0, '--pt-delay': `${0.5 + i * 0.08}s` },
    });
    const titleEl = svgEl('title');
    titleEl.textContent = `${p.year}: ${p.incidents} incident${p.incidents === 1 ? '' : 's'}`;
    dot.appendChild(titleEl);
    svg.appendChild(dot);
    pointEls.push(dot);

    const valueLabel = svgEl('text', {
      x: p.x, y: p.y - 12, 'text-anchor': 'middle',
      class: 'fill-gray-900',
      style: { fontSize: 11, fontWeight: 800 },
    });
    valueLabel.textContent = String(p.incidents);
    svg.appendChild(valueLabel);

    const yearLabel = svgEl('text', {
      x: p.x, y: chartHeight - 10, 'text-anchor': 'middle',
      class: isCurrent ? 'fill-gray-900' : 'fill-gray-500',
      style: { fontSize: 11, fontWeight: isCurrent ? 800 : 600 },
    });
    yearLabel.textContent = String(p.year);
    svg.appendChild(yearLabel);

    if (isCurrent) {
      const badge = svgEl('text', {
        x: p.x, y: p.y - 24, 'text-anchor': 'middle',
        class: 'fill-pink-600',
        style: { fontSize: 7, fontWeight: 700, letterSpacing: '.08em' },
      });
      badge.textContent = 'CURRENT';
      svg.appendChild(badge);
    }
  });

  requestAnimationFrame(() => requestAnimationFrame(() => {
    linePath.style.strokeDashoffset = '0';
    area.style.opacity = '1';
    pointEls.forEach((el, i) => {
      el.setAttribute('r', points[i].year === currentYear ? 5 : 4);
      el.style.opacity = '1';
    });
  }));

  let changeText = '';
  if (items.length >= 2) {
    const prev = items[items.length - 2];
    const curr = items[items.length - 1];
    const diff = curr.incidents - prev.incidents;
    const pct = prev.incidents ? Math.round(Math.abs(diff) / prev.incidents * 100) : 0;
    changeText = diff > 0 ? `↑ ${pct}% from ${prev.year}` : diff < 0 ? `↓ ${pct}% from ${prev.year}` : `Same as ${prev.year}`;
  }

  return h('div', { class: 'trend-chart-shell bg-white rounded-3xl shadow-sm border border-gray-100 p-4' },
    h('div', { class: 'flex items-center justify-between mb-3' },
      h('div', {},
        h('p', { class: 'text-[10px] font-bold text-pink-600 uppercase tracking-widest mb-0.5' }, 'Year-over-Year'),
        h('h3', { class: 'text-base font-bold text-gray-900' }, title),
        subtitle ? h('p', { class: 'text-[12px] text-gray-500 mt-0.5' }, subtitle) : null,
      ),
      changeText ? h('span', { class: 'px-3 py-1.5 bg-pink-50 text-pink-700 rounded-full text-[11px] font-bold border border-pink-200/70' }, changeText) : null,
    ),
    svg,
  );
}

export function barChart(items, { title = '', subtitle = '' } = {}) {
  const total = items.reduce((s, i) => s + (Number(i.value) || 0), 0) || 0;
  const maxVal = Math.max(...items.map(i => Number(i.value) || 0), 1);

  const list = h('div', { class: 'space-y-3.5 mt-2' },
    ...items.map((it, i) => {
      const val = Number(it.value) || 0;
      const pctMax = Math.round((val / maxVal) * 100);
      const pctTotal = total ? Math.round((val / total) * 100) : 0;
      const color = it.color || CHART_COLORS[i % CHART_COLORS.length];
      
      return h('div', { class: 'group relative' },
        h('div', { class: 'flex justify-between text-[11px] mb-1.5' },
          h('span', { class: 'font-bold text-gray-700 uppercase tracking-wide truncate pr-2' }, it.label),
          h('div', { class: 'flex items-center gap-2' },
            h('span', { class: 'font-extrabold text-gray-900 text-xs' }, String(val)),
            h('span', { class: 'text-gray-400 w-8 text-right font-mono' }, `${pctTotal}%`)
          )
        ),
        h('div', { class: 'h-2.5 w-full bg-gray-100 rounded-full overflow-hidden' },
          h('div', {
            class: 'h-full rounded-full transition-all duration-1000 ease-out',
            style: { width: '0%', backgroundColor: color }
          })
        )
      );
    })
  );

  requestAnimationFrame(() => requestAnimationFrame(() => {
    const bars = list.querySelectorAll('.bg-gray-100 > div');
    items.forEach((it, i) => {
      if (bars[i]) {
        const val = Number(it.value) || 0;
        const pctMax = Math.round((val / maxVal) * 100);
        bars[i].style.width = `${pctMax}%`;
      }
    });
  }));

  return h('div', {
    class: 'bg-white rounded-3xl shadow-sm border border-gray-100 p-6 flex flex-col justify-between hover:shadow-md transition-shadow',
  },
    title
      ? h('div', { class: 'flex items-center justify-between border-b border-gray-100 pb-3 mb-2' },
          h('h4', { class: 'text-sm font-bold text-gray-900 flex items-center gap-2' },
            h('span', { class: 'w-2 h-2 rounded-full bg-pink-500' }),
            title,
          ),
          h('span', { class: 'text-[11px] font-semibold text-gray-400 uppercase tracking-wider' }, `${total} total`),
        )
      : null,
    subtitle ? h('p', { class: 'text-[12px] text-gray-500 mb-2' }, subtitle) : null,
    items.length > 0 ? list : h('p', { class: 'text-xs text-gray-400 mt-4' }, 'No data recorded yet.')
  );
}
