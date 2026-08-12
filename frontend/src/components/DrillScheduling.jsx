import ModulePage from './ModulePage.jsx';
import DataTable from './DataTable.jsx';
import StatusPill from './StatusPill.jsx';
import { drills, formatDate } from '../data/mockData.js';

const TYPE_TONE = { Fire: 'red', Earthquake: 'amber', Lockdown: 'purple', Evacuation: 'blue' };

const columns = [
  { key: 'id', label: 'ID', render: (r) => <span className="text-gray-400 font-mono text-xs">{r.id}</span> },
  { key: 'type', label: 'Drill Type', render: (r) => <StatusPill label={r.type} tone={TYPE_TONE[r.type]} /> },
  {
    key: 'date',
    label: 'Schedule',
    render: (r) => (
      <span className="whitespace-nowrap">
        <span className="font-semibold text-gray-900">{formatDate(r.date)}</span>
        <span className="text-gray-400"> · {r.time}</span>
      </span>
    ),
  },
  { key: 'building', label: 'Building / Area' },
  { key: 'personInCharge', label: 'Person in Charge' },
  { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status} /> },
  {
    key: 'notes',
    label: 'Outcome Notes',
    render: (r) =>
      r.notes ? <span className="block max-w-[340px] text-gray-600">{r.notes}</span> : <span className="text-gray-300">—</span>,
  },
];

export default function DrillScheduling() {
  return (
    <ModulePage
      icon="person-running"
      title="Drill Scheduling"
      subtitle="Plan fire, earthquake, lockdown, and evacuation drills with assigned personnel and outcome tracking."
      actionLabel="Schedule Drill"
    >
      <DataTable columns={columns} rows={drills} />
    </ModulePage>
  );
}
