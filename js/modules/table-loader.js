import {
  h, icon, dataTable, moduleShell, moduleStats,
  skeletonHeader, skeletonTableWithColumns, skeletonModuleStats, skeletonSearchBar,
  emptyBanner, errorBanner, inputCls, checkbox,
} from '../ui.js';
import * as api from '../api.js';
import { isAdmin } from '../auth.js';
import { supplyStatus } from '../safety-status.js';

export const SUMMARY = {
  emergency_contacts: (rows) => [
    { label: 'Total contacts', value: rows.length, icon: 'contacts', chipCls: 'bg-pink-50 text-pink-600' },
    { label: 'Active contacts', value: rows.filter((r) => r.active !== false).length, icon: 'check_circle', chipCls: 'bg-emerald-50 text-emerald-600' },
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
    { label: 'Total Items', description: 'All inspection items', value: rows.length, icon: 'fact_check', chipCls: 'bg-blue-50 text-blue-600' },
    { label: 'Passed', description: 'Completed & safe', value: rows.filter((r) => r.status === 'passed').length, icon: 'check_circle', chipCls: 'bg-emerald-50 text-emerald-600' },
    { label: 'Due Soon', description: 'Within 7 days', value: rows.filter((r) => r.status === 'due soon').length, icon: 'schedule', chipCls: 'bg-amber-50 text-amber-700' },
    { label: 'Overdue', description: 'Past due date', value: rows.filter((r) => r.status === 'overdue').length, icon: 'warning', chipCls: 'bg-red-50 text-red-600' },
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
    { label: 'Expiring soon', value: rows.filter((r) => supplyStatus(r) === 'Expiring Soon').length, icon: 'schedule', chipCls: 'bg-amber-50 text-amber-700' },
    { label: 'Expired', value: rows.filter((r) => supplyStatus(r) === 'Expired').length, icon: 'error', chipCls: 'bg-red-50 text-red-600' },
  ],
  students: (rows) => [
    { label: 'Students', value: rows.length, icon: 'school', chipCls: 'bg-pink-50 text-pink-600' },
  ],
};

export async function loadTable(el, {
  table, columns, empty, iconName, title, subtitle,
  actionLabel, actionIcon, actionClass, onAction, secondaryActionLabel, secondaryActionIcon, onSecondaryAction, filters = {}, searchKeys = [],
  searchPlaceholder, selectFilters = [], onRowClick, adminAction = false, dateFilter, transformRows, onRetry, selection, onFilteredRows, paginationStyle = 'standard',
}) {
  el.innerHTML = '';
  const wrap = h('div', { class: 'max-w-[1400px] 2xl:max-w-[1600px] mx-auto space-y-6' });
  el.appendChild(wrap);

  wrap.appendChild(skeletonHeader({
    hasAction: !!actionLabel && (!adminAction || isAdmin()),
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
    rows = await api.listRows(table, filters);
    if (transformRows) rows = transformRows(rows);
  } catch (e) {
    holder.replaceChildren(errorBanner(e.message, onRetry || (() => {
      loadTable(el, { table, columns, empty, iconName, title, subtitle, actionLabel, actionIcon, actionClass, onAction, secondaryActionLabel, secondaryActionIcon, onSecondaryAction, filters, searchKeys, searchPlaceholder, selectFilters, onRowClick, adminAction, dateFilter, transformRows, onRetry, selection, onFilteredRows, paginationStyle });
    })));
    return;
  }

  el.innerHTML = '';
  const realShell = moduleShell({
    icon: iconName, title, subtitle,
    actionLabel: actionLabel && (!adminAction || isAdmin()) ? actionLabel : null,
    actionIcon, actionClass, onAction,
  });
  el.appendChild(realShell);
  if (secondaryActionLabel && (!adminAction || isAdmin())) {
    realShell.firstElementChild.appendChild(h('button', {
      type: 'button', class: 'btn-ghost shrink-0',
      onclick: onSecondaryAction, 'aria-label': secondaryActionLabel,
    }, icon(secondaryActionIcon || 'add', 'text-sm'), secondaryActionLabel));
  }

  const realHolder = h('div', { class: 'space-y-5' });
  realShell.appendChild(realHolder);

  if (!rows.length) {
    // A successful empty query is not evidence of missing permissions.
    realHolder.replaceChildren(emptyBanner({ icon: empty?.icon || iconName, title: empty?.title || 'No records yet', text: empty?.text }));
    return [];
  }

  const state = { q: '', sel: {}, from: '', to: '', page: 1, pageSize: 10, selected: new Set() };
  const matches = (r) => {
    if (state.q) {
      const s = state.q.toLowerCase();
      if (!searchKeys.some((k) => String(r[k] ?? '').toLowerCase().includes(s))) return false;
    }
    if (dateFilter && (state.from || state.to)) {
      const date = String(r[dateFilter.key] || '').slice(0, 10);
      if (!date || (state.from && date < state.from) || (state.to && date > state.to)) return false;
    }
    return selectFilters.every((d) => !state.sel[d.key] || String(r[d.key]) === state.sel[d.key]);
  };

  const parts = [];
  if (SUMMARY[table]) parts.push(moduleStats(SUMMARY[table](rows)));
  let toolbar;
  if (searchKeys.length || selectFilters.length) {
    toolbar = h('div', { class: 'osas-table-toolbar flex flex-wrap items-center gap-3' },
      h('div', { class: 'relative flex-1 min-w-[240px]' },
        icon('search', 'text-gray-400 text-sm absolute left-3.5 top-1/2 -translate-y-1/2'),
        h('input', {
          class: `${inputCls} pl-10`, placeholder: searchPlaceholder || 'Search…', 'aria-label': 'Search',
          oninput: (e) => { state.q = e.target.value; state.page = 1; renderTable(); },
        })),
      selectFilters.map((d) => h('select', {
        class: `${inputCls} w-auto`, 'aria-label': d.label,
        onchange: (e) => { state.sel[d.key] = e.target.value; state.page = 1; renderTable(); },
      },
      h('option', { value: '', selected: true }, d.label),
      d.options.map((o) => h('option', { value: o.value }, o.label)))));
    parts.push(toolbar);
  }

  if (dateFilter) {
    let toggle;
    const range = h('div', { class: 'table-date-controls flex flex-wrap gap-3 items-end', hidden: Boolean(dateFilter.compact) },
      ...['from', 'to'].map((key) => h('label', { class: 'text-xs text-gray-500' },
        dateFilter.label + (key === 'from' ? ' from' : ' to'),
        h('input', { type: 'date', class: inputCls, 'aria-label': dateFilter.label + (key === 'from' ? ' from' : ' to'),
          onchange: (e) => {
            state[key] = e.target.value; state.page = 1;
            toggle?.classList.toggle('date-range-active', Boolean(state.from || state.to));
            renderTable();
          },
        }))),
      h('button', { type: 'button', class: 'btn-ghost', onclick: () => {
        state.from = ''; state.to = ''; state.page = 1;
        range.querySelectorAll('input').forEach((input) => { input.value = ''; });
        toggle?.classList.remove('date-range-active');
        renderTable();
      } }, 'Clear dates'),
      dateFilter.compact ? h('button', { type: 'button', class: 'btn-primary', onclick: () => {
        range.hidden = true; toggle.setAttribute('aria-expanded', 'false'); toggle.focus();
      } }, 'Done') : null);
    if (dateFilter.compact) {
      toggle = h('button', { type: 'button', class: 'btn-ghost table-date-toggle', 'aria-label': 'Select Date Range', 'aria-expanded': 'false',
        onclick: () => { range.hidden = !range.hidden; toggle.setAttribute('aria-expanded', String(!range.hidden)); },
      }, icon('calendar_month'), 'Select Date Range');
      if (toolbar) toolbar.appendChild(toggle);
      else parts.push(toggle);
    }
    parts.push(range);
  }
  const selectedRows = () => rows.filter((r) => state.selected.has(r.id));
  const selectionBar = h('div', { class: 'table-selection-bar', 'aria-label': 'Selected records' });
  if (selection) parts.push(selectionBar);
  const tableWrap = h('div');
  const pager = h('div', { class: 'table-pager flex flex-wrap justify-between items-center gap-3 text-sm text-gray-600' });
  parts.push(tableWrap, pager);
  realHolder.replaceChildren(...parts);

  const renderTable = () => {
    const filtered = rows.filter(matches);
    const pages = Math.max(1, Math.ceil(filtered.length / state.pageSize));
    state.page = Math.min(state.page, pages);
    const start = (state.page - 1) * state.pageSize;
    const shown = filtered.slice(start, start + state.pageSize);
    onFilteredRows?.(filtered);
    let displayedColumns = columns;
    if (selection) {
      const selected = selectedRows();
      selection.onChange?.(selected);
      selectionBar.hidden = !selected.length;
      selectionBar.replaceChildren(
        h('span', { role: 'status' }, `${selected.length} selected across pages`),
        selection.onExport ? h('button', { type: 'button', class: 'btn-ghost', onclick: () => selection.onExport(selectedRows()) }, 'Export selected') : null,
        h('button', { type: 'button', class: 'btn-ghost', onclick: () => { state.selected.clear(); renderTable(); } }, 'Clear selection'));
      const allShown = shown.length > 0 && shown.every((r) => state.selected.has(r.id));
      displayedColumns = [{
        key: 'selection', cls: 'table-selection-column',
        label: h('label', { class: 'table-selection-toggle' }, checkbox({
          ariaLabel: 'Select all visible records', checked: allShown,
          indeterminate: !allShown && shown.some((r) => state.selected.has(r.id)),
          onChange: (checked, event) => {
            event.stopPropagation();
            shown.forEach((r) => checked ? state.selected.add(r.id) : state.selected.delete(r.id));
            renderTable();
            tableWrap.querySelector('thead input')?.focus();
          },
        })),
        render: (r) => h('label', { class: 'table-selection-toggle', onclick: (e) => e.stopPropagation() }, checkbox({
          ariaLabel: 'Select ' + (selection.label?.(r) || r.item || 'record'), checked: state.selected.has(r.id),
          onChange: (checked, event) => {
            event.stopPropagation();
            checked ? state.selected.add(r.id) : state.selected.delete(r.id);
            renderTable();
            tableWrap.querySelectorAll('tbody input')[shown.indexOf(r)]?.focus();
          },
        })),
      }, ...columns];
    }
    tableWrap.replaceChildren(dataTable(displayedColumns, shown, { onRowClick }));
    if (!filtered.length) {
      tableWrap.appendChild(emptyBanner({ icon: 'search', title: 'No matches', text: 'Try a different search or clear the filters.' }));
    }
    const navigation = h('div', { class: 'flex items-center gap-2' },
      h('button', { type: 'button', class: 'btn-ghost', 'aria-label': 'Previous', disabled: state.page === 1,
        onclick: () => { state.page--; renderTable(); } }, paginationStyle === 'numbered' ? icon('chevron_left') : 'Previous'),
      ...(paginationStyle === 'numbered'
        ? Array.from({ length: pages }, (_, i) => i + 1).filter((page) => page === 1 || page === pages || Math.abs(page - state.page) <= 1)
          .map((page, index, visible) => h('span', { class: 'inline-flex items-center gap-2' },
            index > 0 && page > visible[index - 1] + 1 ? h('span', {}, '…') : null,
            h('button', { type: 'button', class: page === state.page ? 'btn-primary page-number' : 'btn-ghost page-number',
              'aria-label': 'Page ' + page, 'aria-current': page === state.page ? 'page' : null,
              onclick: () => { state.page = page; renderTable(); } }, String(page))))
        : [h('span', {}, `Page ${state.page} of ${pages}`)]),
      h('button', { type: 'button', class: 'btn-ghost', 'aria-label': 'Next', disabled: state.page === pages,
        onclick: () => { state.page++; renderTable(); } }, paginationStyle === 'numbered' ? icon('chevron_right') : 'Next'));
    pager.replaceChildren(
      h('span', { 'aria-live': 'polite' }, `Showing ${filtered.length ? start + 1 : 0}–${start + shown.length} of ${filtered.length}`), navigation);

  };

  renderTable();
  return rows;
}
