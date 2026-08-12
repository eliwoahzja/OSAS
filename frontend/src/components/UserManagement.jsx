import { useMemo, useState } from 'react';
import Icon from './Icons.jsx';
import { students, teachers } from '../data/mockData.js';

export default function UserManagement() {
  const [tab, setTab] = useState('students');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const rows = tab === 'students' ? students : teachers;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((u) => {
      const matchesQuery =
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q) ||
        u.lrn.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || u.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [rows, query, statusFilter]);

  const activeCount = rows.filter((u) => u.status === 'active').length;

  return (
    <div className="view">
      <div className="view-header">
        <div className="breadcrumb">
          <span>ADMINISTRATOR WORKSPACE</span>
          <Icon name="chevron-right" size={13} />
          <span className="breadcrumb-current">User Management</span>
        </div>
        <div className="view-heading-row">
          <h1>User Management</h1>
          <p>
            Manage student and teacher accounts — search records, review account
            status, and keep the user directory up to date.
          </p>
        </div>
      </div>

      <section className="panel users-panel">
        <div className="users-toolbar">
          <div className="user-tabs" aria-label="Account types">
            <button
              aria-pressed={tab === 'students'}
              className={`user-tab${tab === 'students' ? ' active' : ''}`}
              onClick={() => {
                setTab('students');
                setQuery('');
              }}
            >
              <Icon name="students" size={16} />
              Students
              <span className="tab-count">{students.length}</span>
            </button>
            <button
              aria-pressed={tab === 'teachers'}
              className={`user-tab${tab === 'teachers' ? ' active' : ''}`}
              onClick={() => {
                setTab('teachers');
                setQuery('');
              }}
            >
              <Icon name="teachers" size={16} />
              Teachers
              <span className="tab-count">{teachers.length}</span>
            </button>
          </div>

          <div className="toolbar-actions">
            <div className="search-box table-search">
              <Icon name="search" size={15} />
              <input
                type="text"
                placeholder={`Search ${tab}…`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <button className="primary-btn">
              <Icon name="user-plus" size={16} />
              Add {tab === 'students' ? 'student' : 'teacher'}
            </button>
          </div>
        </div>

        <div className="filter-row">
          {['all', 'active', 'inactive'].map((f) => (
            <button
              key={f}
              className={`filter-chip${statusFilter === f ? ' active' : ''}`}
              onClick={() => setStatusFilter(f)}
            >
              {f === 'all' ? 'All accounts' : f[0].toUpperCase() + f.slice(1)}
              <span className="chip-count">
                {f === 'all' ? rows.length : rows.filter((u) => u.status === f).length}
              </span>
            </button>
          ))}
          <span className="filter-hint">
            <Icon name="users" size={13} />
            {activeCount} active of {rows.length} {tab}
          </span>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Account</th>
                <th className="col-lrn">{tab === 'students' ? 'LRN' : 'Teacher ID'}</th>
                <th>{tab === 'students' ? 'Section' : 'Subject'}</th>
                <th className="col-status">Status</th>
                <th>Joined</th>
                <th className="col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="student-cell">
                      <span className="student-avatar">{u.name.charAt(0)}</span>
                      <div className="student-cell-meta">
                        <span className="student-name">{u.name}</span>
                        <span className="student-sub">{u.id}</span>
                      </div>
                    </div>
                  </td>
                  <td className="col-lrn mono">{u.lrn}</td>
                  <td>{u.section}</td>
                  <td className="col-status">
                    <span className={`user-status status-${u.status}`}>
                      <span className="status-dot" />
                      {u.status}
                    </span>
                  </td>
                  <td>{u.joined}</td>
                  <td className="col-actions">
                    <div className="row-actions">
                      <button className="icon-btn sm" title="View profile">
                        <Icon name="eye" size={15} />
                      </button>
                      <button className="icon-btn sm" title="Edit">
                        <Icon name="edit" size={15} />
                      </button>
                      <button className="icon-btn sm danger" title="Deactivate">
                        <Icon name="trash" size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="6" className="empty-cell">
                    No {tab} match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
