import ModulePage from './ModulePage.jsx';
import DataTable from './DataTable.jsx';
import StatusPill from './StatusPill.jsx';
import { studentGuardians, schoolContacts } from '../data/mockData.js';

const PRIORITY_TONE = { 1: 'pink', 2: 'blue', 3: 'gray' };

const studentColumns = [
  { key: 'name', label: 'Guardian' },
  { key: 'relationship', label: 'Relationship' },
  { key: 'phone', label: 'Phone', render: (r) => <span className="tabular-nums">{r.phone}</span> },
  { key: 'email', label: 'Email' },
  {
    key: 'priority',
    label: 'Priority',
    render: (r) => <StatusPill label={`Priority ${r.priority}`} tone={PRIORITY_TONE[r.priority]} />,
  },
];

const schoolColumns = [
  { key: 'role', label: 'Role', render: (r) => <StatusPill label={r.role} tone="blue" /> },
  { key: 'name', label: 'Name / Agency' },
  { key: 'phone', label: 'Phone', render: (r) => <span className="tabular-nums">{r.phone}</span> },
  { key: 'email', label: 'Email' },
];

export default function EmergencyContacts() {
  return (
    <ModulePage
      icon="phone"
      title="Emergency Contact Database"
      subtitle="Per-student guardians in priority order, plus school-wide emergency responders and nearest agencies."
      actionLabel="Add Contact"
    >
      <DataTable title="Student Emergency Contacts" columns={studentColumns} rows={studentGuardians} />
      <DataTable title="School-wide & Agency Contacts" columns={schoolColumns} rows={schoolContacts} />
    </ModulePage>
  );
}
