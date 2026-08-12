import ModulePage from './ModulePage.jsx';
import DataTable from './DataTable.jsx';
import StatusPill from './StatusPill.jsx';
import { notifications, formatDate } from '../data/mockData.js';

const TYPE_TONE = {
  'drill notice': 'blue',
  'incident alert': 'red',
  closure: 'purple',
  reminder: 'amber',
};

const columns = [
  { key: 'id', label: 'ID', render: (r) => <span className="text-gray-400 font-mono text-xs">{r.id}</span> },
  { key: 'type', label: 'Message Type', render: (r) => <StatusPill status={r.type} tone={TYPE_TONE[r.type]} /> },
  { key: 'audience', label: 'Audience' },
  { key: 'content', label: 'Message', render: (r) => <span className="block max-w-[380px] text-gray-600">{r.content}</span> },
  { key: 'sent', label: 'Send Date', render: (r) => formatDate(r.sent) },
  { key: 'delivery', label: 'Delivery / Read', render: (r) => <StatusPill status={r.delivery} /> },
];

export default function ParentNotifications() {
  return (
    <ModulePage
      icon="notifications"
      title="Parent Notification System"
      subtitle="Compose drill notices, incident alerts, and closure announcements targeted to parent groups."
      actionLabel="Compose Message"
      actionIcon="edit"
    >
      <DataTable columns={columns} rows={notifications} />
    </ModulePage>
  );
}
