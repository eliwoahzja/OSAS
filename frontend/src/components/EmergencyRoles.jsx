import ModulePage from './ModulePage.jsx';
import DataTable from './DataTable.jsx';
import StatusPill from './StatusPill.jsx';
import { emergencyRoles } from '../data/mockData.js';

const ROLE_TONE = {
  'Fire Warden': 'red',
  'Evacuation Marshal': 'blue',
  'First Aider': 'emerald',
  'Security Liaison': 'purple',
  'Floor Warden': 'amber',
  'Medical Response': 'pink',
};

const columns = [
  { key: 'id', label: 'ID', render: (r) => <span className="text-gray-400 font-mono text-xs">{r.id}</span> },
  { key: 'role', label: 'Role', render: (r) => <StatusPill label={r.role} tone={ROLE_TONE[r.role]} /> },
  { key: 'staff', label: 'Assigned Staff', render: (r) => <span className="font-semibold text-gray-900">{r.staff}</span> },
  { key: 'zone', label: 'Zone / Building' },
  { key: 'backup', label: 'Backup Person' },
];

export default function EmergencyRoles() {
  return (
    <ModulePage
      icon="groups"
      title="Emergency Role Assignment"
      subtitle="Assign fire wardens, evacuation marshals, and first aiders to zones, each with a backup person."
      actionLabel="Assign Role"
    >
      <DataTable columns={columns} rows={emergencyRoles} />
    </ModulePage>
  );
}
