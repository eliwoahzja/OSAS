import ModulePage from './ModulePage.jsx';
import DataTable from './DataTable.jsx';
import StatusPill from './StatusPill.jsx';
import { supplies, formatDate } from '../data/mockData.js';

const stockStatus = (s) =>
  s.quantity <= s.reorderThreshold
    ? { label: 'Reorder', tone: 'amber' }
    : { label: 'In stock', tone: 'green' };

const columns = [
  { key: 'id', label: 'ID', render: (r) => <span className="text-gray-400 font-mono text-xs">{r.id}</span> },
  { key: 'item', label: 'Item', render: (r) => <span className="font-semibold text-gray-900">{r.item}</span> },
  {
    key: 'quantity',
    label: 'Stock',
    render: (r) => (
      <span className="tabular-nums">
        <span className="font-bold text-gray-900">{r.quantity}</span>
        <span className="text-gray-400"> {r.unit}</span>
      </span>
    ),
  },
  { key: 'location', label: 'Location' },
  { key: 'expiry', label: 'Expiry', render: (r) => (r.expiry === 'N/A' ? <span className="text-gray-300">N/A</span> : formatDate(r.expiry)) },
  { key: 'reorderThreshold', label: 'Reorder Threshold', render: (r) => <span className="tabular-nums">{r.reorderThreshold}</span> },
  { key: 'lastRestocked', label: 'Last Restocked', render: (r) => formatDate(r.lastRestocked) },
  { key: 'status', label: 'Status', render: (r) => <StatusPill label={stockStatus(r).label} tone={stockStatus(r).tone} /> },
];

export default function FirstAidSupplies() {
  return (
    <ModulePage
      icon="medical_services"
      title="First Aid Supplies Monitor"
      subtitle="Track stock levels, expiry dates, and reorder thresholds for clinic and emergency-bag supplies."
      actionLabel="Restock Item"
      actionIcon="add"
    >
      <DataTable columns={columns} rows={supplies} />
    </ModulePage>
  );
}
