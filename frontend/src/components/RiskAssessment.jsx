import ModulePage from './ModulePage.jsx';
import DataTable from './DataTable.jsx';
import StatusPill from './StatusPill.jsx';
import { risks, formatDate } from '../data/mockData.js';

const RISK_TONE = { Low: 'green', Medium: 'amber', High: 'red', Critical: 'purple' };

const columns = [
  { key: 'id', label: 'ID', render: (r) => <span className="text-gray-400 font-mono text-xs">{r.id}</span> },
  { key: 'hazard', label: 'Hazard', render: (r) => <span className="font-semibold text-gray-900 max-w-[240px] block">{r.hazard}</span> },
  { key: 'likelihood', label: 'Likelihood' },
  { key: 'impact', label: 'Impact' },
  { key: 'riskLevel', label: 'Risk Level', render: (r) => <StatusPill label={r.riskLevel} tone={RISK_TONE[r.riskLevel]} /> },
  { key: 'mitigation', label: 'Mitigation Plan', render: (r) => <span className="block max-w-[320px] text-gray-600">{r.mitigation}</span> },
  { key: 'owner', label: 'Owner' },
  { key: 'reviewDate', label: 'Review Date', render: (r) => formatDate(r.reviewDate) },
];

export default function RiskAssessment() {
  return (
    <ModulePage
      icon="security"
      title="Risk Assessment"
      subtitle="Log campus hazards with likelihood and impact ratings, computed risk levels, and mitigation plans."
      actionLabel="Add Risk"
    >
      <DataTable columns={columns} rows={risks} />
    </ModulePage>
  );
}
