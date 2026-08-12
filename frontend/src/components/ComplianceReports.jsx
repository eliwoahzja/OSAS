import ModulePage from './ModulePage.jsx';
import DataTable from './DataTable.jsx';
import StatusPill from './StatusPill.jsx';
import Icon from './Icons.jsx';
import { inspections, drills, incidents, generatedReports, formatDate, complianceScore } from '../data/mockData.js';

const countBy = (arr, pred) => arr.filter(pred).length;

const summary = [
  {
    key: 'passed',
    label: 'Inspections Passed',
    value: `${countBy(inspections, (i) => i.status === 'passed')} / ${inspections.length}`,
    hint: 'Passed of total scheduled checks',
    tone: 'emerald',
    icon: 'check_circle',
  },
  {
    key: 'drills',
    label: 'Drills Completed',
    value: String(countBy(drills, (d) => d.status === 'completed')),
    hint: `${countBy(drills, (d) => d.status === 'upcoming')} upcoming · ${countBy(drills, (d) => d.status === 'cancelled')} cancelled`,
    tone: 'blue',
    icon: 'emergency',
  },
  {
    key: 'open',
    label: 'Open Incidents',
    value: String(countBy(incidents, (i) => i.status === 'open')),
    hint: `${countBy(incidents, (i) => i.status === 'resolved')} resolved`,
    tone: 'amber',
    icon: 'report',
  },
  {
    key: 'compliance',
    label: 'Compliance Score',
    value: `${complianceScore}%`,
    hint: 'Based on passed vs. overdue inspections',
    tone: 'purple',
    icon: 'verified_user',
  },
];

const TONE_CLASS = {
  emerald: 'bg-emerald-50 text-emerald-600',
  blue: 'bg-blue-50 text-blue-600',
  amber: 'bg-amber-50 text-amber-600',
  purple: 'bg-purple-50 text-purple-600',
};

const reportColumns = [
  { key: 'id', label: 'ID', render: (r) => <span className="text-gray-400 font-mono text-xs">{r.id}</span> },
  { key: 'name', label: 'Report', render: (r) => <span className="font-semibold text-gray-900">{r.name}</span> },
  { key: 'scope', label: 'Scope' },
  { key: 'generated', label: 'Generated', render: (r) => formatDate(r.generated) },
  { key: 'format', label: 'Format', render: (r) => <StatusPill label={r.format} tone={r.format === 'PDF' ? 'red' : 'green'} /> },
];

export default function ComplianceReports() {
  const handleExportCSV = () => {
    const rows = [
      ['Metric', 'Value'],
      ['Inspections passed', summary[0].value],
      ['Drills completed', summary[1].value],
      ['Open incidents', summary[2].value],
      ['Compliance score', summary[3].value],
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'saac-compliance-report.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ModulePage
      icon="assessment"
      title="Safety Compliance Reports"
      subtitle="Auto-generated compliance summaries from the inspections, drills, and incident modules — exportable to Excel/CSV or PDF."
    >
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={handleExportCSV}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-pink-600 text-white text-sm font-semibold shadow-sm hover:bg-pink-700 transition-colors cursor-pointer"
        >
          <Icon name="download" className="text-base" />
          Export CSV / Excel
        </button>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-gray-700 text-sm font-semibold border border-gray-200 shadow-sm hover:bg-gray-50 transition-colors cursor-pointer"
        >
          <Icon name="print" className="text-base" />
          Export PDF (Print)
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {summary.map((s) => (
          <article key={s.key} className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 relative overflow-hidden">
            <div className={`w-8 h-8 rounded-xl ${TONE_CLASS[s.tone]} flex items-center justify-center mb-4`}>
              <Icon name={s.icon} className="text-sm" />
            </div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{s.label}</p>
            <p className="text-[32px] font-extrabold text-gray-900 mt-2 leading-none">{s.value}</p>
            <p className="text-[11px] text-gray-500 mt-4">{s.hint}</p>
          </article>
        ))}
      </div>

      <DataTable title="Generated Reports" columns={reportColumns} rows={generatedReports} />
    </ModulePage>
  );
}
