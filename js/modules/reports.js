import {
  h, icon, moduleShell, skeletonHeader, skeletonStatCards, statCard, toast, errorBanner,
} from '../ui.js';
import * as api from '../api.js';

export async function complianceReports(el) {
  el.innerHTML = '';
  const wrap = h('div', { class: 'max-w-[1400px] 2xl:max-w-[1600px] mx-auto space-y-6' });
  el.appendChild(wrap);

  wrap.appendChild(skeletonHeader({
    hasAction: false,
    hasIcon: true,
    titleWidth: 'w-64 sm:w-80',
    subtitleWidth: 'w-80 sm:w-[480px]',
  }));

  const holder = h('div', { class: 'space-y-5' });
  wrap.appendChild(holder);

  const gridWrap = h('div');
  gridWrap.appendChild(skeletonStatCards(4, 'grid grid-cols-2 lg:grid-cols-4 gap-5'));
  holder.appendChild(gridWrap);

  const logWrap = h('div', { class: 'space-y-4 max-w-4xl mt-8 animate-pulse' });
  logWrap.appendChild(h('div', { class: 'h-6 w-48 bg-gray-200/80 rounded-lg mt-2 mb-4' }));
  for (let i = 0; i < 6; i++) {
    logWrap.appendChild(
      h('div', { class: 'flex items-center gap-4 py-3 border-b border-gray-100 last:border-0' },
        h('div', { class: 'h-3.5 w-20 bg-gray-200/60 rounded-full shrink-0' }),
        h('div', { class: 'w-2 h-2 rounded-full bg-gray-200 shrink-0' }),
        h('div', { class: 'flex-1 space-y-1.5' },
          h('div', { class: 'h-4 w-60 bg-gray-200/80 rounded-md' }),
          h('div', { class: 'h-3 w-80 bg-gray-100 rounded-full' }),
        ),
      )
    );
  }
  holder.appendChild(logWrap);

  try {
    const [s, logs] = await Promise.all([
      api.getDashboardStats(),
      api.listRows('incidents'),
      new Promise(r => setTimeout(r, 3000)),
    ]);

    el.innerHTML = '';
    const shell = moduleShell({
      icon: 'assessment', title: 'Safety Compliance Reports',
      subtitle: 'Auto-generated summaries pulled from inspections, drills, and incidents — exportable as CSV or PDF.',
    });
    el.appendChild(shell);

    const realHolder = h('div', { class: 'space-y-5' });
    shell.appendChild(realHolder);

    const grid = h('div', { class: 'grid grid-cols-2 lg:grid-cols-4 gap-5' });
    const items = [
      { label: 'Inspections Passed', value: s.inspections_passed, sub: 'of total checklist items', iconName: 'checklist', tone: 'green', blob: 'bg-emerald-50' },
      { label: 'Drills Completed', value: s.drills_completed, sub: 'total drills finished', iconName: 'person-running', tone: 'blue', blob: 'bg-blue-50' },
      { label: 'Open Incidents', value: s.incidents_open, sub: 'currently unresolved', iconName: 'warning', tone: 'red', blob: 'bg-red-50' },
      { label: 'Compliance Score', value: `${s.compliance_score}%`, sub: 'overall safety rating', iconName: 'verified_user', tone: 'purple', blob: 'bg-purple-50' },
    ];
    items.forEach((d) => grid.appendChild(statCard(d)));
    realHolder.appendChild(grid);

    const realLogWrap = h('div', { class: 'space-y-4 max-w-4xl mt-8' });
    realHolder.appendChild(realLogWrap);
    realLogWrap.appendChild(h('h3', { class: 'text-lg font-bold text-gray-900 mt-2' }, 'Recent System Activity'));
    if (!logs.length) {
      realLogWrap.appendChild(h('p', { class: 'text-sm text-gray-500' }, 'No recent activity.'));
    } else {
      logs.slice(0, 10).forEach((l) => {
        realLogWrap.appendChild(h('div', { class: 'flex items-center gap-4 py-3 border-b border-gray-100 last:border-0' },
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
    wrap.innerHTML = '';
    wrap.appendChild(errorBanner(e.message, () => complianceReports(el)));
  }
}
