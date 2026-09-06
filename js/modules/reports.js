import {
  h, icon, moduleShell, skeleton, statCard, toast, errorBanner,
} from '../ui.js';
import * as api from '../api.js';

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
      h('button', { class: 'btn-primary', onclick: () => exportCSV(s) }, icon('download', 'text-base'), 'Export CSV (Excel)'),
      h('button', { class: 'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-gray-700 text-sm font-semibold border border-gray-200 hover:bg-gray-50 transition-colors clickable', onclick: () => window.print() }, icon('print', 'text-base'), 'Export PDF (Print)')));

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
