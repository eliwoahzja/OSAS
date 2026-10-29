import * as auth from './auth.js';
import { inspectionStatus } from './safety-status.js';
import { MOCK, mockNextId } from './mock.js';
import { fetchEveryPage } from './live-dashboard.js';
import { computeStats } from './dashboard-stats.js';

const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.OSAS;
const REST = `${SUPABASE_URL}/rest/v1`;

function isDemoMode() {
  return !SUPABASE_URL || !SUPABASE_ANON_KEY;
}

export function dataMode() {
  return isDemoMode() ? 'mock' : 'api';
}

function explain(res, j) {
  const msg = (j && j.message) || `Request failed (${res.status})`;
  if (res.status === 401) return 'Sign-in required — your session is missing or expired. Please sign in again.';
  if (res.status === 403 || (j && j.code === '42501')) {
    return 'Permission denied by the database (row-level security). Your account is not allowed to do this.';
  }
  if (j && (j.code === 'PGRST204' || /schema cache|column/i.test(msg))) {
    return `${msg} — the database schema is out of date. Apply the missing files in supabase/migrations/ in order.`;
  }
  return msg;
}

async function restFetch(method, path, { query = {}, body = null, prefer = null } = {}) {
  const token = await auth.currentAccessToken();
  const bearer = token || SUPABASE_ANON_KEY;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === null || v === undefined || v === '') continue;
    qs.set(k, v);
  }
  const url = `${REST}/${path}${qs.toString() ? `?${qs}` : ''}`;
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${bearer}`,
    'Content-Type': 'application/json',
  };
  if (prefer) headers.Prefer = prefer;
  let res;
  try {
    res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error('Could not reach the database. Check your internet connection.');
  }
  if (!res.ok) {
    let j = null;
    try { j = await res.json(); } catch {}
    throw new Error(explain(res, j));
  }
  if (res.status === 204) return null;
  return res.json();
}

const MOCK_KEY = 'osas.mock.v1';

function loadMock() {
  try {
    const saved = JSON.parse(localStorage.getItem(MOCK_KEY) || '{}');
    for (const [table, rows] of Object.entries(saved)) {
      if (!Array.isArray(rows)) continue;
      const defaults = MOCK[table] || [];
      const existingIds = new Set(rows.map((r) => r.id));
      const missingDefaults = defaults.filter((d) => !existingIds.has(d.id));
      MOCK[table] = [...rows, ...missingDefaults];
    }
  } catch {}
}

function persistMock() {
  try { localStorage.setItem(MOCK_KEY, JSON.stringify(MOCK)); } catch {}
  window.dispatchEvent(new Event('osas:data-changed'));
}

loadMock();

function snapshot(table) {
  return JSON.parse(JSON.stringify(MOCK[table] || []));
}

function visibleIncidents(rows) {
  if (auth.isAdmin()) return rows;
  const id = auth.currentUser()?.id;
  return id ? rows.filter((row) => row.submitted_by === id) : [];
}

function recordMockActivity(table, action, oldValue, newValue) {
  if (!['inspections', 'supplies', 'emergency_roles'].includes(table)) return;
  MOCK.audit_log ||= [];
  MOCK.audit_log.unshift({
    id: mockNextId('audit_log') + '-' + MOCK.audit_log.length,
    table_name: table, record_id: (newValue || oldValue).id, action,
    old_value: oldValue ? JSON.parse(JSON.stringify(oldValue)) : null,
    new_value: newValue ? JSON.parse(JSON.stringify(newValue)) : null,
    changed_at: new Date().toISOString(),
  });
}

function insertMock(table, payload) {
  const row = { id: mockNextId(table), ...payload };
  if (table === 'incidents') {
    const me = auth.currentUser();
    const reportedAt = new Date();
    row.created_at = reportedAt.toISOString();
    row.date = new Date(reportedAt.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
    row.time = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' }).format(reportedAt);
    row.submitted_by = me?.id || null;
    row.reporter = me?.name || me?.email || 'Student';
    row.type ??= null; row.severity ??= null; row.location ??= null;
    if (!auth.isAdmin()) { row.status = 'open'; row.student_id = null; row.type = null; row.severity = null; row.location = null; }
  }
  MOCK[table] = MOCK[table] || [];
  MOCK[table].unshift(row);
  recordMockActivity(table, 'insert', null, row);
  persistMock();
  return row;
}

function updateMock(table, id, patch) {
  const rows = MOCK[table] || [];
  const i = rows.findIndex((r) => r.id === id);
  if (i < 0) throw new Error('Record not found');
  const previous = rows[i];
  if (table === 'incidents') {
    patch = { ...patch, created_at: previous.created_at, date: previous.date, time: previous.time, submitted_by: previous.submitted_by };
  }
  rows[i] = { ...rows[i], ...patch };
  recordMockActivity(table, 'update', previous, rows[i]);
  persistMock();
  return rows[i];
}

function deleteMock(table, id) {
  const rows = MOCK[table] || [];
  const i = rows.findIndex((r) => r.id === id);
  if (i >= 0) {
    recordMockActivity(table, 'delete', rows[i], null);
    rows.splice(i, 1);
  }
  persistMock();
}

function listMock(table, filters = {}) {
  let rows = snapshot(table);
  if (table === 'incidents' && !auth.isAdmin()) {
    const id = auth.currentUser()?.id;
    rows = id ? rows.filter((r) => r.submitted_by === id) : [];
  }
  if (table === 'emergency_roles' && !auth.isAdmin()) return [];
  const byId = (list, id) => list.find((x) => x.id === id) || null;
  if (table === 'emergency_contacts') {
    rows = rows.map((r) => ({ ...r, students: r.student_id ? byId(MOCK.students, r.student_id) : null }));
  }
  if (table === 'notifications') {
    rows = rows.map((r) => ({ ...r, students: r.student_id ? byId(MOCK.students, r.student_id) : null }));
  }
  for (const [k, v] of Object.entries(filters)) {
    if (v === null || v === undefined || v === '') continue;
    rows = rows.filter((r) => String(r[k] ?? '').toLowerCase().includes(String(v).toLowerCase()));
  }
  return withDerived(table, rows);
}

function withDerived(table, rows) {
  if (table !== 'inspections') return rows;
  return rows.map((r) => ({ ...r, recorded_status: r.status, status: inspectionStatus(r) }));
}


const EMBEDS = {
  emergency_contacts: '*,students(name,grade)',
  notifications: '*,students(name,grade)',
};

export async function listRows(table, filters = {}) {
  if (table === 'emergency_roles' && !auth.isAdmin()) throw new Error('Emergency roles are visible to administrators only.');
  if (isDemoMode()) return listMock(table, filters);
  const query = { select: EMBEDS[table] || '*', order: 'created_at.desc' };
  for (const [k, v] of Object.entries(filters)) {
    if (v) query[k] = k === 'category' ? `eq.${v}` : `ilike.*${v}*`;
  }
  if (table === 'incidents' && !auth.isAdmin()) {
    const id = auth.currentUser()?.id;
    if (!id) throw new Error('Sign in to view your reports.');
    query.submitted_by = `eq.${id}`;
  }
  let rows;
  try {
    rows = await restFetch('GET', table, { query });
  } catch (e) {
    if (!EMBEDS[table]) throw e;
    rows = await restFetch('GET', table, { query: { ...query, select: '*' } });
  }
  rows = rows || [];

  if (!rows.length) {
    const token = await auth.currentAccessToken().catch(() => null);
    if (!token) throw new Error('Sign-in required — your session has expired. Please sign in again.');
  }

  return withDerived(table, table === 'incidents' ? visibleIncidents(rows) : rows);
}

export async function insertRow(table, payload) {
  if (table === 'incidents') {
    const user = auth.currentUser();
    if (!user?.id) throw new Error('Sign in to submit an incident report.');
    const description = String(payload.description || '').trim();
    if (!description || description.length > 10000) throw new Error('Enter an incident description of up to 10000 characters.');
    payload = { ...payload, description, submitted_by: user.id, reporter: user.name || user.email };
  }
  if (isDemoMode()) return insertMock(table, payload);
  const rows = await restFetch('POST', table, { body: payload, prefer: 'return=representation' });
  if (!rows || !rows[0]) throw new Error('The database accepted the request but returned no row.');
  window.dispatchEvent(new Event('osas:data-changed'));
  return rows[0];
}

export async function listActivity(table, { recordId = null, limit = 5 } = {}) {
  if (!auth.isAdmin()) throw new Error('Activity is visible to administrators only.');
  if (!['inspections', 'supplies', 'emergency_roles'].includes(table)) throw new Error('Unsupported activity table.');
  const count = Math.max(1, Math.min(50, Number(limit) || 5));
  if (isDemoMode()) return snapshot('audit_log')
    .filter((r) => r.table_name === table && (!recordId || String(r.record_id) === String(recordId)))
    .sort((a, b) => b.changed_at.localeCompare(a.changed_at)).slice(0, count);
  return restFetch('GET', 'audit_log', { query: {
    select: 'table_name,record_id,action,old_value,new_value,changed_at',
    table_name: `eq.${table}`, record_id: recordId ? `eq.${recordId}` : null,
    order: 'changed_at.desc', limit: count,
  } });
}

export async function updateRow(table, id, patch) {
  if (table === 'incidents' && !auth.isAdmin()) throw new Error('Only administrators may review incident reports.');
  if (isDemoMode()) return updateMock(table, id, patch);
  const rows = await restFetch('PATCH', table, {
    query: { id: `eq.${id}` }, body: patch, prefer: 'return=representation',
  });
  if (!rows || !rows[0]) throw new Error('Update was not applied — the record is missing or your account may not edit it.');
  window.dispatchEvent(new Event('osas:data-changed'));
  return rows[0];
}

export async function deleteRow(table, id) {
  if (table === 'incidents' && !auth.isAdmin()) throw new Error('Only administrators may delete incident reports.');
  if (isDemoMode()) {
    deleteMock(table, id);
    return { ok: true };
  }
  const rows = await restFetch('DELETE', table, { query: { id: `eq.${id}` }, prefer: 'return=representation' });
  if (!rows || !rows.length) throw new Error('Nothing was deleted — the record is missing or your account may not delete it.');
  window.dispatchEvent(new Event('osas:data-changed'));
  return { ok: true };
}

const isValidUuid = (val) =>
  typeof val === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);

const toIso = (v) => {
  const d = v ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toISOString() : null;
};

export async function sendNotification(raw = {}) {
  const type = ['incident_alert', 'alert', 'event_notice'].includes(raw.notif_type) ? raw.notif_type : 'event_notice';
  const payload = {
    notif_type: type,
    priority: type === 'event_notice' ? 'informational' : 'urgent',
    contact_method: 'email',
    title: String(raw.title || (type === 'incident_alert' ? 'Incident Alert' : type === 'alert' ? 'Restock Alert' : 'Campus Notice')).trim().slice(0, 255),
    message: String(raw.message || '').trim(),
  };
  if (!payload.message) return { ok: false, error: 'Message is required.' };

  if (type === 'incident_alert') {
    if (!raw.notify_all_parents && !isValidUuid(raw.student_id) && !isDemoMode()) return { ok: false, error: 'A student is required for incident alerts.' };
    payload.student_id = raw.student_id || null;
    payload.notify_all_parents = raw.notify_all_parents === true;
    if (isValidUuid(raw.related_incident_id)) payload.related_incident_id = raw.related_incident_id;
  } else if (type === 'alert') {
    payload.audience_group = String(raw.audience_group || 'Clinic Staff / Stock Custodians').slice(0, 100);
  } else {
    let start = toIso(raw.event_start_at) || new Date().toISOString();
    let end = toIso(raw.event_end_at);
    if (!end || new Date(end) <= new Date(start)) end = new Date(new Date(start).getTime() + 3600000).toISOString();
    payload.audience_group = String(raw.audience_group || 'All Parents & Guardians').slice(0, 100);
    payload.event_start_at = start;
    payload.event_end_at = end;
  }

  if (isDemoMode()) {
    const audience = type === 'incident_alert'
      ? (payload.notify_all_parents ? 'All Parents & Guardians' : null)
      : payload.audience_group;
    const row = insertMock('notifications', {
      ...payload,
      audience_group: audience,
      sent_at: new Date().toISOString(),
      delivery_status: 'sent',
    });
    return { ok: true, provider: 'demo', channel: 'email (simulated)', id: row.id };
  }

  const fnUrl = window.OSAS.NOTIFY_FN_URL;
  if (!fnUrl) return { ok: false, error: 'Notification service is not configured.' };
  const token = await auth.currentAccessToken();
  if (!token) return { ok: false, error: 'Sign-in required to send notifications.' };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const res = await fetch(fnUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: (data && data.error) || `Notification failed (${res.status})` };
    const delivery = (data && data.delivery) || {};
    if (delivery.status === 'failed') {
      return { ok: false, error: delivery.error || 'Email delivery failed.', channel: 'email', ...data };
    }
    return { ok: true, channel: 'email', ...data };
  } catch (e) {
    return { ok: false, error: e.name === 'AbortError' ? 'Notification service timed out.' : (e.message || 'Notification service unreachable.') };
  } finally {
    clearTimeout(timeout);
  }
}

export async function getDashboardStats() {
  // First-aid stock is school-confidential: only administrators fetch it
  // (the dashboard charts that use it are administrators-only too).
  const includeSupplies = auth.isAdmin();
  if (isDemoMode()) {
    return computeStats(
      listMock('incidents'), listMock('inspections'), listMock('drills'),
      includeSupplies ? listMock('supplies') : [], listMock('emergency_contacts', { category: 'school' }),
    );
  }
  const [incidents, inspections, drills, supplies, contacts] = await Promise.all([
    fetchEveryPage((offset, limit) => restFetch('GET', 'incidents', { query: { select: 'id,date,type,status,submitted_by', order: 'id.asc', offset, limit, ...(!auth.isAdmin() ? { submitted_by: `eq.${auth.currentUser()?.id}` } : {}) } })),
    includeSupplies ? restFetch('GET', 'inspections', { query: { select: '*' } }) : [],
    includeSupplies ? restFetch('GET', 'drills', { query: { select: '*' } }) : [],
    includeSupplies ? restFetch('GET', 'supplies', { query: { select: '*' } }) : [],
    restFetch('GET', 'emergency_contacts', { query: { select: 'id,category', category: 'eq.school' } }),
  ]);
  return computeStats(
    visibleIncidents(incidents || []), withDerived('inspections', inspections || []), drills || [],
    supplies || [], contacts || [],
  );
}

export async function uploadFile(bucket, file, path) {
  if (isDemoMode()) return { path: `mock://${bucket}/${path || file.name}`, url: null, mock: true };
  const token = await auth.currentAccessToken();
  if (!token) throw new Error('Sign-in required to upload files.');
  const name = encodeURIComponent(path || file.name);
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${name}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': file.type || 'application/octet-stream',
    },
    body: file,
  });
  if (!res.ok) {
    let detail = `Upload failed (${res.status})`;
    try { const j = await res.json(); if (j.message) detail = j.message; } catch {}
    throw new Error(detail);
  }
  return {
    path: `${bucket}/${path || file.name}`,
    url: `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${name}`,
  };
}
