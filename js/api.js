import * as auth from './auth.js';
import { MOCK, mockNextId } from './mock.js';

const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.OSAS;
const REST = `${SUPABASE_URL}/rest/v1`;

// Data mode is decided by the session, never by guessing from failed requests:
//   demo session / no Supabase config  -> local mock data (clearly labelled)
//   signed-in Supabase session         -> live database ONLY. A failed write is
//                                         reported to the user, never hidden in
//                                         localStorage.
function isDemoMode() {
  return !SUPABASE_URL || !SUPABASE_ANON_KEY || auth.isDemo();
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
    return `${msg} — the database schema is out of date. Run supabase/live_fixes.sql in the Supabase SQL editor.`;
  }
  return msg;
}

async function restFetch(method, path, { query = {}, body = null, prefer = null } = {}) {
  const token = await auth.currentAccessToken();
  if (!token) throw new Error('Sign-in required — please sign in to use live data.');
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === null || v === undefined || v === '') continue;
    qs.set(k, v);
  }
  const url = `${REST}/${path}${qs.toString() ? `?${qs}` : ''}`;
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
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

/* ---------------- demo (local mock) storage ---------------- */

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
}

loadMock();

function snapshot(table) {
  return JSON.parse(JSON.stringify(MOCK[table] || []));
}

function insertMock(table, payload) {
  const row = { id: mockNextId(table), ...payload };
  MOCK[table] = MOCK[table] || [];
  MOCK[table].unshift(row);
  persistMock();
  return row;
}

function updateMock(table, id, patch) {
  const rows = MOCK[table] || [];
  const i = rows.findIndex((r) => r.id === id);
  if (i < 0) throw new Error('Record not found');
  rows[i] = { ...rows[i], ...patch };
  persistMock();
  return rows[i];
}

function deleteMock(table, id) {
  const rows = MOCK[table] || [];
  const i = rows.findIndex((r) => r.id === id);
  if (i >= 0) rows.splice(i, 1);
  persistMock();
}

function listMock(table, filters = {}) {
  let rows = snapshot(table);
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

/* ---------------- derived values ---------------- */

const FREQUENCY_DAYS = {
  daily: 1, weekly: 7, biweekly: 14, monthly: 30, quarterly: 91,
  'semi-annual': 182, semiannual: 182, annual: 365, yearly: 365,
};

// An inspection whose last check is older than its frequency is Overdue,
// even if nobody has edited the stored status yet.
function withDerived(table, rows) {
  if (table !== 'inspections') return rows;
  const now = Date.now();
  return rows.map((r) => {
    if (r.status !== 'passed' && r.status !== 'pending') return r;
    const days = FREQUENCY_DAYS[String(r.frequency || '').toLowerCase().trim()];
    const last = r.last_inspected ? new Date(r.last_inspected).getTime() : NaN;
    if (!days || Number.isNaN(last)) return r;
    return now - last > days * 86400000 ? { ...r, status: 'overdue' } : r;
  });
}

function computeStats(incidents, inspections, drills, supplies, contacts) {
  const typeCount = {};
  incidents.forEach((i) => { typeCount[i.type] = (typeCount[i.type] || 0) + 1; });
  const statusCount = {};
  inspections.forEach((i) => { statusCount[i.status] = (statusCount[i.status] || 0) + 1; });
  const total = inspections.length || 1;

  const yearMap = {};
  incidents.forEach((i) => {
    const d = String(i.date || '');
    const year = parseInt(d.slice(0, 4), 10);
    if (!year) return;
    if (!yearMap[year]) yearMap[year] = { year, incidents: 0, byType: {} };
    yearMap[year].incidents++;
    yearMap[year].byType[i.type] = (yearMap[year].byType[i.type] || 0) + 1;
  });
  const years_by_year = Object.values(yearMap).sort((a, b) => a.year - b.year);

  const supplies_low_items = supplies
    .filter((s) => Number(s.quantity) <= Number(s.reorder_threshold))
    .map((s) => ({
      item: s.item,
      quantity: Number(s.quantity),
      reorder_threshold: Number(s.reorder_threshold),
      location: s.location || '',
    }))
    .sort((a, b) => (b.reorder_threshold - b.quantity) - (a.reorder_threshold - a.quantity));

  let inspections_pending = 0, inspections_passed = 0, inspections_overdue = 0;
  for (const ins of inspections) {
    if (ins.status === 'passed') inspections_passed++;
    else if (ins.status === 'pending') inspections_pending++;
    else if (ins.status === 'overdue') inspections_overdue++;
  }

  let drills_active = 0, drills_completed = 0;
  for (const d of drills) {
    if (d.status === 'upcoming') drills_active++;
    else if (d.status === 'completed') drills_completed++;
  }

  const openIncidents = incidents.filter((i) => i.status === 'open').length;

  return {
    incidents_total: incidents.length,
    incidents_open: openIncidents,
    inspections_pending,
    inspections_passed,
    inspections_overdue,
    drills_active,
    drills_completed,
    supplies_low: supplies_low_items.length,
    supplies_low_items,
    supplies_total: supplies.reduce((s, x) => s + Number(x.quantity || 0), 0),
    supplies_breakdown: supplies.map((s) => ({ label: s.item, value: Number(s.quantity || 0) })),
    supplies_status: [
      { label: 'OK', value: supplies.length - supplies_low_items.length },
      { label: 'Low stock', value: supplies_low_items.length },
    ],
    emergency_contacts_total: contacts.length,
    compliance_score: Math.round((inspections_passed / total) * 100),
    incident_breakdown: Object.entries(typeCount).map(([label, value]) => ({ label, value })),
    inspection_status: Object.entries(statusCount).map(([label, value]) => ({ label, value })),
    years_by_year,
  };
}

/* ---------------- CRUD ---------------- */

const EMBEDS = {
  emergency_contacts: '*,students(name,grade)',
  notifications: '*,students(name,grade)',
};

export async function listRows(table, filters = {}) {
  if (isDemoMode()) return listMock(table, filters);
  const query = { select: EMBEDS[table] || '*', order: 'created_at.desc' };
  for (const [k, v] of Object.entries(filters)) {
    if (v) query[k] = `ilike.*${v}*`;
  }
  let rows;
  try {
    rows = await restFetch('GET', table, { query });
  } catch (e) {
    if (!EMBEDS[table]) throw e;
    // relationship embed unavailable: retry without it, but do not hide other errors
    rows = await restFetch('GET', table, { query: { ...query, select: '*' } });
  }
  rows = rows || [];

  // Guard: if 0 rows come back in live mode, the most likely cause is a stale
  // or expired JWT (Supabase falls back to anon role, RLS returns nothing).
  // Verify the session is still live so the UI can surface the real problem.
  if (!rows.length) {
    const token = await auth.currentAccessToken().catch(() => null);
    if (!token) throw new Error('Sign-in required — your session has expired. Please sign in again.');
  }

  return withDerived(table, rows);
}

export async function insertRow(table, payload) {
  if (isDemoMode()) return insertMock(table, payload);
  const rows = await restFetch('POST', table, { body: payload, prefer: 'return=representation' });
  if (!rows || !rows[0]) throw new Error('The database accepted the request but returned no row.');
  return rows[0];
}

export async function updateRow(table, id, patch) {
  if (isDemoMode()) return updateMock(table, id, patch);
  const rows = await restFetch('PATCH', table, {
    query: { id: `eq.${id}` }, body: patch, prefer: 'return=representation',
  });
  if (!rows || !rows[0]) throw new Error('Update was not applied — the record is missing or your account may not edit it.');
  return rows[0];
}

export async function deleteRow(table, id) {
  if (isDemoMode()) {
    deleteMock(table, id);
    return { ok: true };
  }
  const rows = await restFetch('DELETE', table, { query: { id: `eq.${id}` }, prefer: 'return=representation' });
  if (!rows || !rows.length) throw new Error('Nothing was deleted — the record is missing or your account may not delete it.');
  return { ok: true };
}

/* ---------------- notifications ---------------- */

const isValidUuid = (val) =>
  typeof val === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);

const toIso = (v) => {
  const d = v ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toISOString() : null;
};

// Three explicit kinds, no guessing from the wording of the message:
//   incident_alert -> guardian(s) of one student, or all parents if notify_all_parents
//   alert          -> clinic / nurse contacts (low-stock restock notices)
//   event_notice   -> an audience group (drills, events)
// All three are delivered by email through the send-notification Edge Function.
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
    if (!isValidUuid(raw.student_id) && !isDemoMode()) return { ok: false, error: 'A student is required for incident alerts.' };
    payload.student_id = raw.student_id;
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

/* ---------------- dashboard + files ---------------- */

export async function getDashboardStats() {
  if (isDemoMode()) {
    return computeStats(
      listMock('incidents'), listMock('inspections'), listMock('drills'),
      listMock('supplies'), listMock('emergency_contacts'),
    );
  }
  const [incidents, inspections, drills, supplies, contacts] = await Promise.all([
    restFetch('GET', 'incidents', { query: { select: '*' } }),
    restFetch('GET', 'inspections', { query: { select: '*' } }),
    restFetch('GET', 'drills', { query: { select: '*' } }),
    restFetch('GET', 'supplies', { query: { select: '*' } }),
    restFetch('GET', 'emergency_contacts', { query: { select: 'id' } }),
  ]);
  return computeStats(
    incidents || [], withDerived('inspections', inspections || []), drills || [],
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
