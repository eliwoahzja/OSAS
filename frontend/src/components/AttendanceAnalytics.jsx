import Icon from './Icons.jsx';
import { weeklyTrend, todayDistribution, todayLabel } from '../data/mockData.js';

const maxPresent = Math.max(...weeklyTrend.map((d) => d.present));
const totalStudents = todayDistribution.reduce((sum, d) => sum + d.value, 0);
const DONUT_RADIUS = 54;
const DONUT_CIRC = 2 * Math.PI * DONUT_RADIUS;

let cumulative = 0;
const segments = todayDistribution.map((d) => {
  const frac = d.value / totalStudents;
  const seg = { ...d, frac, offset: cumulative };
  cumulative += frac;
  return seg;
});

export default function AttendanceAnalytics() {
  return (
    <section className="analytics">
      <div className="section-header">
        <div>
          <span className="section-eyebrow">ATTENDANCE ANALYTICS</span>
          <h2>Trends and distribution</h2>
          <p>Charts use recorded MySQL attendance data only.</p>
        </div>
        <button className="ghost-btn">
          <Icon name="reports" size={16} />
          Export
        </button>
      </div>

      <div className="analytics-grid">
        <div className="panel">
          <div className="panel-head">
            <h3>Weekly attendance trend</h3>
            <span className="panel-chip">This week</span>
          </div>

          <div className="bar-chart">
            <div className="chart-y">
              <span>100%</span>
              <span>75%</span>
              <span>50%</span>
              <span>25%</span>
              <span>0%</span>
            </div>
            <div className="chart-area">
              {weeklyTrend.map((d) => (
                <div className="bar-col" key={d.day}>
                  <div className="bar-wrap" title={`${d.present} present on ${d.day}`}>
                    <div
                      className="bar"
                      style={{ height: `${(d.present / maxPresent) * 100}%` }}
                    />
                  </div>
                  <span className="bar-label">{d.day}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h3>Today&apos;s distribution</h3>
            <span className="panel-chip">{todayLabel}</span>
          </div>

          <div className="donut-wrap">
            <svg viewBox="0 0 140 140" className="donut" role="img" aria-label="Attendance distribution donut chart">
              {segments.map((s) => (
                <circle
                  key={s.label}
                  cx="70"
                  cy="70"
                  r={DONUT_RADIUS}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="15"
                  strokeDasharray={`${s.frac * DONUT_CIRC} ${DONUT_CIRC}`}
                  strokeDashoffset={-s.offset * DONUT_CIRC}
                  transform="rotate(-90 70 70)"
                />
              ))}
            </svg>
            <div className="donut-center">
              <span className="donut-total">{totalStudents.toLocaleString()}</span>
              <span>students</span>
            </div>
          </div>

          <ul className="legend">
            {todayDistribution.map((d) => (
              <li key={d.label}>
                <span className="legend-dot" style={{ background: d.color }} />
                <span className="legend-label">{d.label}</span>
                <strong>{d.value}</strong>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
