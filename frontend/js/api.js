// ============================================================
// OSAS data layer — Supabase-native (no PHP backend).
//
// The browser talks to Supabase directly:
//   * PostgREST (https://<project>.supabase.co/rest/v1/...) for
//     table CRUD — the server validates the JWT, enforces RLS
//     roles and the DB CHECK constraints.
//   * Storage (https://<project>.supabase.co/storage/v1/...) for
//     file uploads (evacuation maps, inspection photos).
//   * An Edge Function for notification delivery.
//
// The exported function signatures are unchanged so the 10
// module pages don't need edits. The built-in demo dataset is
// used ONLY when no real Supabase session exists (i.e. the
// companion hasn't signed anyone in) — that state is visible in
// the UI via dataMode() === 'mock'.
// ============================================================
import * as auth from './auth.js';
import { MOCK, mockNextId } from './mock.js';

const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.OSAS;
const REST = `${SUPABASE_URL}/rest/v1`;
let provider = 'mock'; // 'api' | 'mock'

// ---------- PostgREST helpers ----------

async function restFetch(method, path, { query = {}, body = null, prefer = null } = {}) {
  const token = await auth.currentAccessToken();
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
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const j = await res.json();
      if (j.message) detail = j.message;
      if (res.status === 401) detail = 'Sign-in required — no valid session for this data.';
      if (res.status === 403 || j.code === '42501') detail = 'Permission denied for this account.';
    } catch { /* non-JSON error body */ }
    throw new Error(detail);
  }
  if (res.status === 204) return null;
  return res.json();
}

/** Whether we're running on the demo dataset (no real session). */
async function demoMode() {
  return !(await auth.hasRealSession());
}

// ---------- Mock (demo dataset, dev only) ----------
// Persisted to localStorage so demo-mode changes (sent notifications,
// added records) survive a page reload instead of silently disappearing.
const MOCK_KEY = 'osas.mock.v1';

function loadMock() {
  try {
    const saved = JSON.parse(localStorage.getItem(MOCK_KEY) || '{}');
    for (const [table, rows] of Object.entries(saved)) {
      if (!Array.isArray(rows)) continue;
      const defaults = MOCK[table] || [];
      // keep saved rows, then add any default rows whose ids aren't present
      MOCK[table] = [...rows, ...defaults.filter((d) => !rows.some((r) => r.id === d.id))];
    }
  } catch { /* ignore corrupted storage */ }
}

function persistMock() {
  try { localStorage.setItem(MOCK_KEY, JSON.stringify(MOCK)); } catch { /* quota/private mode */ }
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
  for (const [k, v] of Object.entries(filters)) {
    if (v === null || v === undefined || v === '') continue;
    rows = rows.filter((r) => String(r[k] ?? '').toLowerCase().includes(String(v).toLowerCase()));
  }
  return rows;
}

/** Dashboard stats aggregation — shared by the mock and live paths. */
function computeStats(incidents, inspections, drills, supplies, contacts) {
  const typeCount = {};
  incidents.forEach((i) => { typeCount[i.type] = (typeCount[i.type] || 0) + 1; });
  const statusCount = {};
  inspections.forEach((i) => { statusCount[i.status] = (statusCount[i.status] || 0) + 1; });
  const total = inspections.length || 1;
  return {
    incidents_total: incidents.length,
    incidents_open: incidents.filter((i) => i.status === 'open').length,
    inspections_pending: inspections.filter((i) => i.status === 'pending').length,
    inspections_passed: inspections.filter((i) => i.status === 'passed').length,
    inspections_overdue: inspections.filter((i) => i.status === 'overdue').length,
    drills_active: drills.filter((d) => d.status === 'upcoming').length,
    drills_completed: drills.filter((d) => d.status === 'completed').length,
    supplies_low: supplies.filter((s) => Number(s.quantity) <= Number(s.reorder_threshold)).length,
    emergency_contacts_total: contacts.length,
    compliance_score: Math.round((inspections.filter((i) => i.status === 'passed').length / total) * 100),
    incident_breakdown: Object.entries(typeCount).map(([label, value]) => ({ label, value })),
    inspection_status: Object.entries(statusCount).map(([label, value]) => ({ label, value })),
  };
}

/** Which data provider is active — shown in the UI for transparency. */
export function dataMode() {
  return provider;
}

// ---------- Public API (mirrors the old PHP routes) ----------

export async function listRows(table, filters = {}) {
  if (await demoMode()) {
    provider = 'mock';
    return listMock(table, filters);
  }
  // Substring search → PostgREST `ilike` filter.
  const query = { select: '*' };
  for (const [k, v] of Object.entries(filters)) {
    if (v) query[k] = `ilike.*${v}*`;
  }
  const rows = await restFetch('GET', table, { query });
  provider = 'api';
  return rows || [];
}

export async function insertRow(table, payload) {
  if (await demoMode()) {
    provider = 'mock';
    return insertMock(table, payload);
  }
  const rows = await restFetch('POST', table, {
    body: payload,
    prefer: 'return=representation',
  });
  provider = 'api';
  return (rows && rows[0]) || payload;
}

export async function updateRow(table, id, patch) {
  if (await demoMode()) {
    provider = 'mock';
    return updateMock(table, id, patch);
  }
  const rows = await restFetch('PATCH', table, {
    query: { id: `eq.${id}` },
    body: patch,
    prefer: 'return=representation',
  });
  provider = 'api';
  if (!rows || !rows[0]) throw new Error('Record not found');
  return rows[0];
}

export async function deleteRow(table, id) {
  if (await demoMode()) {
    provider = 'mock';
    deleteMock(table, id);
    return { ok: true };
  }
  await restFetch('DELETE', table, { query: { id: `eq.${id}` } });
  provider = 'api';
  return { ok: true };
}

/**
 * Notification delivery.
 *
 * With NOTIFY_FN_URL configured (recommended), the Edge Function
 * validates, records, and emails parents through Maileroo. Without
 * it, the row is recorded directly through PostgREST — the DB
 * CHECK constraints still enforce the business rules, but no
 * email is sent.
 */
export async function sendNotification(payload) {
  const fnUrl = window.OSAS.NOTIFY_FN_URL;
  if (fnUrl) {
    try {
      const token = await auth.currentAccessToken();
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error((data && data.error) || `Notification failed (${res.status})`);
      provider = 'api';
      return { ok: true, channel: (data && data.channel) || payload.contact_method, ...(data || {}) };
    } catch (e) {
      // Edge Function unreachable → fall through and record directly.
      console.error('sendNotification via Edge Function failed:', e);
    }
  }
  if (await demoMode()) {
    provider = 'mock';
    insertMock('notifications', {
      ...payload,
      sent_at: new Date().toISOString(),
      delivery_status: 'sent',
      created_by: 'admin',
    });
    return { ok: true, provider: 'direct', channel: payload.contact_method || 'app', id: mockNextId('notifications') };
  }
  const record = { ...payload };
  delete record.student_name; // enrichment fields — not columns
  delete record.student_grade;
  const row = await insertRow('notifications', {
    ...record,
    sent_at: new Date().toISOString(),
    delivery_status: 'sent',
  });
  return { ok: true, provider: 'direct', channel: row.contact_method || payload.contact_method || 'app', id: row.id };
}

/** GET /dashboard/stats — KPI + donut data. Aggregated client-side from live rows. */
export async function getDashboardStats() {
  if (await demoMode()) {
    provider = 'mock';
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
    restFetch('GET', 'emergency_contacts', { query: { select: '*' } }),
  ]);
  provider = 'api';
  return computeStats(incidents || [], inspections || [], drills || [], supplies || [], contacts || []);
}

/**
 * File upload → Supabase Storage (public buckets). Requires a
 * real session (storage policies are authenticated-only).
 */
export async function uploadFile(bucket, file, path) {
  if (await demoMode()) {
    provider = 'mock';
    return { path: `mock://${bucket}/${path || file.name}`, url: null, mock: true };
  }
  const token = await auth.currentAccessToken();
  const url = `${SUPABASE_URL}/storage/v1/object/${bucket}/${encodeURIComponent(path || file.name)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': file.type || 'application/octet-stream',
      'x-upsert': 'true',
    },
    body: file,
  });
  if (!res.ok) {
    let detail = `Upload failed (${res.status})`;
    try {
      const j = await res.json();
      if (j.message) detail = j.message;
    } catch { /* non-JSON */ }
    throw new Error(detail);
  }
  provider = 'api';
  return {
    path: `${bucket}/${path || file.name}`,
    url: `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${encodeURIComponent(path || file.name)}`,
  };
}
