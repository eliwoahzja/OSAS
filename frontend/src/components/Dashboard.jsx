import WelcomeBanner from './WelcomeBanner.jsx';
import StatCard from './StatCard.jsx';
import DonutChart from './DonutChart.jsx';
import Icon from './Icons.jsx';
import {
  stats,
  incidentTypeBreakdown,
  inspectionStatusBreakdown,
} from '../data/mockData.js';

function AnalyticsPanel({ title, source, children }) {
  return (
    <section className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between gap-3 mb-5">
        <h3 className="text-[15px] font-bold text-gray-900">{title}</h3>
        <span className="px-3 py-1 rounded-full bg-gray-100 text-[10.5px] font-bold text-gray-500 whitespace-nowrap">
          {source}
        </span>
      </div>
      {children}
    </section>
  );
}

function ChartEmptyState({ icon, text }) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <div className="w-12 h-12 rounded-2xl bg-gray-50 text-gray-300 flex items-center justify-center">
        <Icon name={icon} className="text-2xl" />
      </div>
      <p className="text-[13px] text-gray-400 max-w-[280px]">{text}</p>
    </div>
  );
}

export default function Dashboard() {
  const incidentTotal = incidentTypeBreakdown.reduce((sum, d) => sum + d.value, 0);
  const inspectionTotal = inspectionStatusBreakdown.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="max-w-[1400px] mx-auto space-y-8">
      <WelcomeBanner />

      <div className="bg-[#FFF8E7] border border-amber-200/60 rounded-2xl p-4 flex items-center gap-4">
        <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-500 flex items-center justify-center shrink-0">
          <Icon name="database" size={12} />
        </div>
        <div>
          <h4 className="text-[13px] font-bold text-gray-900">Live data status</h4>
          <p className="text-[13px] text-gray-600 mt-0.5">
            KPI cards and charts below pull live from the OSAS safety modules as
            records are added.
          </p>
        </div>
      </div>

      <section data-purpose="summary-grid">
        <div className="mb-6">
          <p className="text-[10px] font-bold text-pink-600 uppercase tracking-widest mb-1.5">
            At a Glance
          </p>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[28px] font-extrabold text-gray-900 tracking-tight">
                Dashboard summary
              </h3>
              <p className="text-[15px] text-gray-500 mt-1">
                Role-specific figures from the safety module records.
              </p>
            </div>
            <span className="px-4 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-bold text-gray-600 shadow-sm">
              6 summaries
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5">
          {stats.map((s) => (
            <StatCard key={s.key} stat={s} />
          ))}
        </div>
      </section>

      <section data-purpose="analytics" className="mt-10">
        <div className="mb-6">
          <p className="text-[10px] font-bold text-pink-600 uppercase tracking-widest mb-1.5">
            Analytics
          </p>
          <h3 className="text-[28px] font-extrabold text-gray-900 tracking-tight">
            Safety Analytics
          </h3>
          <p className="text-[15px] text-gray-500 mt-1">
            Live breakdowns from the incident and inspection records.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <AnalyticsPanel title="Incident Type Breakdown" source="Incident Logging">
            {incidentTotal > 0 ? (
              <DonutChart data={incidentTypeBreakdown} centerLabel="Incidents" />
            ) : (
              <ChartEmptyState
                icon="report"
                text="No incidents logged yet. Add incidents in the Incident Logging module to see the breakdown."
              />
            )}
          </AnalyticsPanel>

          <AnalyticsPanel title="Inspection Status" source="Safety Inspections">
            {inspectionTotal > 0 ? (
              <DonutChart data={inspectionStatusBreakdown} centerLabel="Inspections" />
            ) : (
              <ChartEmptyState
                icon="fact_check"
                text="No inspections recorded yet. Complete inspections to see the compliance-health view."
              />
            )}
          </AnalyticsPanel>
        </div>
      </section>

      <section data-purpose="analytics-preview" className="mt-10">
        <p className="text-[10px] font-bold text-pink-600 uppercase tracking-widest mb-1.5">
          Safety Modules
        </p>
        <h3 className="text-[28px] font-extrabold text-gray-900 tracking-tight">
          Quick Access Hub
        </h3>
        <p className="text-[15px] text-gray-500 mt-1">
          Charts use recorded MySQL attendance data only.
        </p>
      </section>
    </div>
  );
}
