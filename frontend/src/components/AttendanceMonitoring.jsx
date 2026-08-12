import { useMemo, useState } from 'react';
import Icon from './Icons.jsx';
import { attendanceSections } from '../data/mockData.js';

const STATUSES = ['present', 'late', 'absent', 'excused'];

const statusMeta = {
  present: { label: 'Present', color: '#10b981' },
  late: { label: 'Late', color: '#f59e0b' },
  absent: { label: 'Absent', color: '#ef4444' },
  excused: { label: 'Excused', color: '#0ea5e9' },
};

// Mock week labels used for the date stepper.
const weekDates = ['Mon · Jul 20', 'Tue · Jul 21', 'Wed · Jul 22', 'Thu · Jul 23', 'Fri · Jul 24'];

export default function AttendanceMonitoring() {
  const [sectionId, setSectionId] = useState(attendanceSections[0].id);
  const [dateIdx, setDateIdx] = useState(4);
  const [query, setQuery] = useState('');
  const [statuses, setStatuses] = useState({});
  const [saved, setSaved] = useState(false);

  const section = attendanceSections.find((s) => s.id === sectionId);
  const roster = section.roster;

  // Status keys are scoped by section + date so drafts never leak between
  // classes (roster ids repeat across sections).
  const keyFor = (studentId) => `${sectionId}:${dateIdx}:${studentId}`;
  const getStatus = (id) =>
    statuses[keyFor(id)] || roster.find((r) => r.id === id)?.status || 'present';

  const setStatus = (studentId, status) =>
    setStatuses((prev) => ({ ...prev, [keyFor(studentId)]: status }));

  const markAllPresent = () =>
    setStatuses(Object.fromEntries(roster.map((r) => [keyFor(r.id), 'present'])));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return roster;
    return roster.filter(
      (r) => r.name.toLowerCase().includes(q) || r.lrn.includes(q)
    );
  }, [roster, query]);

  const counts = { present: 0, late: 0, absent: 0, excused: 0 };
  roster.forEach((r) => {
    counts[getStatus(r.id)] += 1;
  });

  const handleSave = () => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  };

  return (
    <div className="view">
      <div className="view-header">
        <div className="breadcrumb">
          <span>ADMINISTRATOR WORKSPACE</span>
          <Icon name="chevron-right" size={13} />
          <span className="breadcrumb-current">Attendance Monitoring</span>
        </div>
        <div className="view-heading-row">
          <h1>Attendance Monitoring</h1>
          <p>
            Record and finalize daily attendance per section. Select a class,
            then mark each student present, late, absent, or excused.
          </p>
        </div>
      </div>

      <section className="panel attendance-panel">
        <div className="attendance-toolbar">
          <div className="date-stepper" title="Change date">
            <button
              className="step-btn"
              onClick={() => setDateIdx((i) => Math.max(0, i - 1))}
              disabled={dateIdx === 0}
              aria-label="Previous day"
            >
              <Icon name="chevron-left" size={16} />
            </button>
            <span className="step-label">
              <Icon name="clock" size={14} />
              {weekDates[dateIdx]}
            </span>
            <button
              className="step-btn"
              onClick={() => setDateIdx((i) => Math.min(weekDates.length - 1, i + 1))}
              disabled={dateIdx === weekDates.length - 1}
              aria-label="Next day"
            >
              <Icon name="chevron-right" size={16} />
            </button>
          </div>

          <div className="toolbar-actions">
            <div className="search-box table-search">
              <Icon name="search" size={15} />
              <input
                type="text"
                placeholder="Search student or LRN…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <button className="ghost-btn" onClick={markAllPresent}>
              <Icon name="check-all" size={16} />
              Mark all present
            </button>
            <button className="primary-btn" onClick={handleSave}>
              <Icon name="save" size={16} />
              Save attendance
            </button>
          </div>
        </div>

        <div className="section-tabs" aria-label="Sections">
          {attendanceSections.map((s) => (
            <button
              key={s.id}
              aria-pressed={s.id === sectionId}
              className={`section-tab${s.id === sectionId ? ' active' : ''}`}
              onClick={() => {
                setSectionId(s.id);
                setQuery('');
              }}
            >
              {s.name}
            </button>
          ))}
        </div>

        <div className="roster-meta">
          <span>
            <Icon name="users" size={14} />
            {section.roster.length} students
          </span>
          <span>
            <Icon name="teachers" size={14} />
            Adviser: {section.adviser}
          </span>
          <span>
            <Icon name="clock" size={14} />
            {section.time}
          </span>
        </div>

        <div className="summary-strip">
          {STATUSES.map((s) => (
            <div key={s} className="summary-item">
              <span className="summary-dot" style={{ background: statusMeta[s].color }} />
              <span>{statusMeta[s].label}</span>
              <strong>{counts[s]}</strong>
            </div>
          ))}
          <div className="summary-item summary-total">
            <span>Total</span>
            <strong>{roster.length}</strong>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th className="col-idx">#</th>
                <th>Student</th>
                <th className="col-lrn">LRN</th>
                <th className="col-status">Attendance status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.id}>
                  <td className="col-idx">{i + 1}</td>
                  <td>
                    <div className="student-cell">
                      <span className="student-avatar">{r.name.charAt(0)}</span>
                      <span className="student-name">{r.name}</span>
                    </div>
                  </td>
                  <td className="col-lrn mono">{r.lrn}</td>
                  <td className="col-status">
                    <div className="status-toggle" role="group" aria-label={`Status for ${r.name}`}>
                      {STATUSES.map((s) => (
                        <button
                          key={s}
                          className={`status-pill${getStatus(r.id) === s ? ' active' : ''}`}
                          style={getStatus(r.id) === s ? { background: statusMeta[s].color } : undefined}
                          onClick={() => setStatus(r.id, s)}
                        >
                          {statusMeta[s].label}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="4" className="empty-cell">
                    No students match “{query}”.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {saved && (
        <div className="toast" role="status">
          <Icon name="check-circle" size={17} />
          Attendance for {section.name} saved successfully.
        </div>
      )}
    </div>
  );
}
