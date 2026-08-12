import ModulePage from './ModulePage.jsx';
import DataTable from './DataTable.jsx';
import { evacuationPlans, formatDate } from '../data/mockData.js';

const columns = [
  {
    key: 'building',
    label: 'Building / Floor',
    render: (r) => (
      <span className="whitespace-nowrap">
        <span className="font-semibold text-gray-900">{r.building}</span>
        <span className="text-gray-400"> · {r.floor}</span>
      </span>
    ),
  },
  { key: 'exits', label: 'Exits', render: (r) => <span className="block max-w-[300px]">{r.exits}</span> },
  { key: 'routes', label: 'Evacuation Routes', render: (r) => <span className="block max-w-[300px] text-gray-600">{r.routes}</span> },
  { key: 'assemblyPoint', label: 'Assembly Point' },
  { key: 'version', label: 'Version', render: (r) => <span className="font-mono text-xs text-gray-500">{r.version}</span> },
  { key: 'updated', label: 'Last Updated', render: (r) => formatDate(r.updated) },
];

export default function EvacuationPlans() {
  return (
    <ModulePage
      icon="map"
      title="Evacuation Map & Plans"
      subtitle="Uploaded floor plans per building and floor with exits, routes, assembly points, and version history."
      actionLabel="Upload Floor Plan"
      actionIcon="upload_file"
    >
      <DataTable columns={columns} rows={evacuationPlans} />
    </ModulePage>
  );
}
