import {
  h, icon, moduleShell, skeletonGrid, statCard, toast, errorBanner,
} from '../ui.js';
import * as api from '../api.js';

export async function complianceReports(el) {
  el.appendChild(moduleShell({
    icon: 'assessment', title: 'Safety Compliance Reports',
    subtitle: 'Auto-generated summaries pulled from inspections, drills, and incidents — exportable as CSV or PDF.',
  }));
  const holder = h('div', { class: 'space-y-5' });
  el.appendChild(holder);
  holder.appendChild(skeletonGrid(4));

  try {
    const [s, logs] = await Promise.all([
      api.getDashboardStats(),
      api.listRows('incidents'),
      new Promise(r => setTimeout(r, 3000)),
    ]);
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

    const logEl = h('div', { class: 'space-y-4 max-w-4xl mt-8' });
    holder.appendChild(logEl);
    logEl.appendChild(h('h3', { class: 'text-lg font-bold text-gray-900 mt-2' }, 'Recent System Activity'));
    if (!logs.length) {
      logEl.appendChild(h('p', { class: 'text-sm text-gray-500' }, 'No recent activity.'));
    } else {
      logs.slice(0, 10).forEach((l) => {
        logEl.appendChild(h('div', { class: 'flex items-center gap-4 py-3 border-b border-gray-100 last:border-0' },
          h('span', { class: 'text-[11px] text-gray-400 font-mono w-24 shrink-0' }, l.date),
          h('div', { class: 'w-2 h-2 rounded-full bg-pink-500 shrink-0' }),
          h('div', { class: 'flex-1' },
            h('p', { class: 'text-sm text-gray-800 font-medium' }, `Incident logged in ${l.location || 'campus'}`),
            h('p', { class: 'text-xs text-gray-500 mt-0.5' }, l.description || 'No description provided'),
          ),
        ));
      });
    }
  } catch (e) {
    holder.replaceChildren(errorBanner(e.message));
  }
}
