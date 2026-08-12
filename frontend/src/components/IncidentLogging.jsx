import ModulePage from './ModulePage.jsx';
import DataTable from './DataTable.jsx';
import StatusPill from './StatusPill.jsx';
import { incidents, formatDate } from '../data/mockData.js';

const TYPE_TONE = {
  medical: 'pink',
  'slips/falls': 'amber',
  'fire-related': 'red',
  security: 'blue',
  'equipment failure': 'purple',
};

const SEVERITY_TONE = { low: 'green', medium: 'amber', high: 'red' };

const columns = [
  { key: 'id', label: 'ID', render: (r) => <span className="text-gray-400 font-mono text-xs">{r.id}</span> },
  {
    key: 'date',
    label: 'Date / Time',
    render: (r) => (
      <span className="whitespace-nowrap">
        <span className="font-semibold text-gray-900">{formatDate(r.date)}</span>
        <span className="text-gray-400"> · {r.time}</span>
      </span>
    ),
  },
  { key: 'type', label: 'Type', render: (r) => <StatusPill status={r.type} tone={TYPE_TONE[r.type]} /> },
  { key: 'location', label: 'Location' },
  { key: 'description', label: 'Description', render: (r) => <span className="block max-w-[320px] text-gray-600">{r.description}</span> },
  { key: 'reporter', label: 'Reporter' },
  { key: 'severity', label: 'Severity', render: (r) => <StatusPill status={r.severity} tone={SEVERITY_TONE[r.severity]} /> },
  { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status} /> },
];

export default function IncidentLogging() {
  return (
    <ModulePage
      icon="report"
      title="Incident Logging"
      subtitle="Record medical, fire, security, and structural incidents with severity and resolution status."
      actionLabel="Log Incident"
    >
      <DataTable columns={columns} rows={incidents} />
    </ModulePage>
  );
}
