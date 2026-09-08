import {
  h, icon, dataTable, moduleShell, moduleStats,
  skeletonHeader, skeletonTableWithColumns, skeletonModuleStats, skeletonSearchBar,
  emptyBanner, errorBanner, inputCls,
} from '../ui.js';
import * as api from '../api.js';

export const SUMMARY = {
  emergency_contacts: (rows) => [
    { label: 'Total contacts', value: rows.length, icon: 'contacts', chipCls: 'bg-pink-50 text-pink-600' },
    { label: 'Guardians', value: rows.filter((r) => r.category === 'student').length, icon: 'family_restroom', chipCls: 'bg-blue-50 text-blue-600' },
    { label: 'School & agencies', value: rows.filter((r) => r.category === 'school').length, icon: 'local_police', chipCls: 'bg-purple-50 text-purple-600' },
  ],
  drills: (rows) => [
    { label: 'Total drills', value: rows.length, icon: 'person-running', chipCls: 'bg-pink-50 text-pink-600' },
    { label: 'Upcoming', value: rows.filter((r) => r.status === 'upcoming').length, icon: 'schedule', chipCls: 'bg-blue-50 text-blue-600' },
    { label: 'Completed', value: rows.filter((r) => r.status === 'completed').length, icon: 'task_alt', chipCls: 'bg-emerald-50 text-emerald-600' },
  ],
  evacuation_plans: (rows) => [
    { label: 'Floor plans', value: rows.length, icon: 'map', chipCls: 'bg-pink-50 text-pink-600' },
    { label: 'Current versions', value: rows.filter((r) => r.current).length, icon: 'verified', chipCls: 'bg-emerald-50 text-emerald-600' },
  ],
  incidents: (rows) => [
    { label: 'Total incidents', value: rows.length, icon: 'report', chipCls: 'bg-pink-50 text-pink-600' },
    { label: 'Open', value: rows.filter((r) => r.status === 'open').length, icon: 'priority_high', chipCls: 'bg-red-50 text-red-600' },
    { label: 'Resolved', value: rows.filter((r) => r.status === 'resolved').length, icon: 'task_alt', chipCls: 'bg-emerald-50 text-emerald-600' },
  ],
  inspections: (rows) => [
    { label: 'Checklist items', value: rows.length, icon: 'fact_check', chipCls: 'bg-pink-50 text-pink-600' },
    { label: 'Passed', value: rows.filter((r) => r.status === 'passed').length, icon: 'check_circle', chipCls: 'bg-emerald-50 text-emerald-600' },
    { label: 'Overdue', value: rows.filter((r) => r.status === 'overdue').length, icon: 'warning', chipCls: 'bg-red-50 text-red-600' },
  ],
  risks: (rows) => [
    { label: 'Assessed hazards', value: rows.length, icon: 'security', chipCls: 'bg-pink-50 text-pink-600' },
    { label: 'Critical', value: rows.filter((r) => r.risk_level === 'Critical').length, icon: 'dangerous', chipCls: 'bg-red-50 text-red-600' },
    { label: 'High Risk', value: rows.filter((r) => r.risk_level === 'High').length, icon: 'warning', chipCls: 'bg-amber-50 text-amber-700' },
  ],
  emergency_roles: (rows) => [
    { label: 'Assignments', value: rows.length, icon: 'groups', chipCls: 'bg-pink-50 text-pink-600' },
    { label: 'With backup', value: rows.filter((r) => r.backup).length, icon: 'support_agent', chipCls: 'bg-blue-50 text-blue-600' },
  ],
  supplies: (rows) => [
    { label: 'Tracked items', value: rows.length, icon: 'medical_services', chipCls: 'bg-pink-50 text-pink-600' },
    { label: 'Low stock', value: rows.filter((r) => Number(r.quantity) <= Number(r.reorder_threshold)).length, icon: 'warning', chipCls: 'bg-red-50 text-red-600' },
  ],
  students: (rows) => [
    { label: 'Students', value: rows.length, icon: 'school', chipCls: 'bg-pink-50 text-pink-600' },
  ],
};

export async function loadTable(el, {
  table, columns, empty, iconName, title, subtitle,
  actionLabel, actionIcon, actionClass, onAction, filters = {}, searchKeys = [],
  searchPlaceholder, selectFilters = [],
}) {
  el.innerHTML = '';
  const wrap = h('div', { class: 'max-w-[1400px] 2xl:max-w-[1600px] mx-auto space-y-6' });
  el.appendChild(wrap);

  wrap.appendChild(skeletonHeader({
    hasAction: !!actionLabel,
    hasIcon: !!iconName,
    titleWidth: 'w-64 sm:w-80',
    subtitleWidth: 'w-80 sm:w-[480px]',
  }));

  const holder = h('div', { class: 'space-y-5' });
  wrap.appendChild(holder);

  if (SUMMARY[table]) {
    const chipCount = SUMMARY[table]([]).length;
    holder.appendChild(skeletonModuleStats(chipCount));
  }
  if (searchKeys.length || selectFilters.length) {
    holder.appendChild(skeletonSearchBar({ hasFilters: selectFilters.length > 0, count: selectFilters.length }));
  }
  holder.appendChild(skeletonTableWithColumns(columns, 5));

  let rows;
  try {
    const [fetchedRows] = await Promise.all([
      api.listRows(table, filters),
      new Promise(res => setTimeout(res, 3000)),
    ]);
    rows = fetchedRows;
  } catch (e) {
    holder.replaceChildren(errorBanner(e.message, () => {
      loadTable(el, { table, columns, empty, iconName, title, subtitle, actionLabel, onAction, filters, searchKeys, searchPlaceholder, selectFilters });
    }));
    return;
  }

  el.innerHTML = '';
  const realShell = moduleShell({ icon: iconName, title, subtitle, actionLabel, actionIcon, actionClass, onAction });
  el.appendChild(realShell);

  const realHolder = h('div', { class: 'space-y-5' });
  realShell.appendChild(realHolder);

  if (!rows.length) {
    realHolder.replaceChildren(emptyBanner({ icon: empty?.icon || iconName, title: empty?.title || 'No records yet', text: empty?.text }));
    return;
  }

  const state = { q: '', sel: {} };
  const matches = (r) => {
    if (state.q) {
      const s = state.q.toLowerCase();
      if (!searchKeys.some((k) => String(r[k] ?? '').toLowerCase().includes(s))) return false;
    }
    return selectFilters.every((d) => !state.sel[d.key] || String(r[d.key]) === state.sel[d.key]);
  };

  const parts = [];
  if (SUMMARY[table]) parts.push(moduleStats(SUMMARY[table](rows)));
  if (searchKeys.length || selectFilters.length) {
    parts.push(h('div', { class: 'flex flex-wrap items-center gap-3' },
      h('div', { class: 'relative flex-1 min-w-[240px]' },
        icon('search', 'text-gray-400 text-sm absolute left-3.5 top-1/2 -translate-y-1/2'),
        h('input', {
          class: `${inputCls} pl-10`, placeholder: searchPlaceholder || 'Search…', 'aria-label': 'Search',
          oninput: (e) => { state.q = e.target.value; renderTable(); },
        })),
      selectFilters.map((d) => h('select', {
        class: `${inputCls} w-auto`, 'aria-label': d.label,
        onchange: (e) => { state.sel[d.key] = e.target.value; renderTable(); },
      },
      h('option', { value: '', selected: true }, d.label),
      d.options.map((o) => h('option', { value: o.value }, o.label))))));
  }

  const tableWrap = h('div');
  parts.push(tableWrap);
  realHolder.replaceChildren(...parts);

  const renderTable = () => {
    const filtered = rows.filter(matches);
    tableWrap.replaceChildren(dataTable(columns, filtered));
    if (!filtered.length) {
      tableWrap.appendChild(emptyBanner({ icon: 'search', title: 'No matches', text: 'Try a different search or clear the filters.' }));
    }
  };

  renderTable();
  return rows;
}
