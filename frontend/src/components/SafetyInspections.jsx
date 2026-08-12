import ModulePage from './ModulePage.jsx';
import DataTable from './DataTable.jsx';
import StatusPill from './StatusPill.jsx';
import { inspections, formatDate } from '../data/mockData.js';

const columns = [
  { key: 'id', label: 'ID', render: (r) => <span className="text-gray-400 font-mono text-xs">{r.id}</span> },
  { key: 'item', label: 'Inspection Item', render: (r) => <span className="font-semibold text-gray-900">{r.item}</span> },
  { key: 'area', label: 'Area / Location' },
  { key: 'frequency', label: 'Frequency' },
  { key: 'lastInspected', label: 'Last Inspected', render: (r) => formatDate(r.lastInspected) },
  { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status} /> },
  { key: 'inspector', label: 'Inspector' },
  {
    key: 'notes',
    label: 'Follow-up Notes',
    render: (r) =>
      r.notes ? <span className="block max-w-[300px] text-gray-600">{r.notes}</span> : <span className="text-gray-300">—</span>,
  },
];

export default function SafetyInspections() {
  return (
    <ModulePage
      icon="fact_check"
      title="Safety Inspection Checklist"
      subtitle="Track inspection items, schedules, pass/fail status, and follow-up work across all buildings."
      actionLabel="Start Inspection"
      actionIcon="playlist_add_check"
    >
      <DataTable columns={columns} rows={inspections} />
    </ModulePage>
  );
}
