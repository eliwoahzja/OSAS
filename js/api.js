import * as auth from './auth.js';
import { MOCK, mockNextId } from './mock.js';

const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.OSAS;
const REST = `${SUPABASE_URL}/rest/v1`;
let provider = 'mock';

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
    } catch {}
    throw new Error(detail);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function demoMode() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return true;
  return false;
}

const MOCK_KEY = 'osas.mock.v1';

function loadMock() {
  try {
    const saved = JSON.parse(localStorage.getItem(MOCK_KEY) || '{}');
    for (const [table, rows] of Object.entries(saved)) {
      if (!Array.isArray(rows)) continue;
      const defaults = MOCK[table] || [];
      MOCK[table] = [...rows, ...defaults.filter((d) => !rows.some((r) => r.id === d.id))];
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
  if (table === 'emergency_contacts') {
    rows = rows.map((r) => ({
      ...r,
      students: r.student_id ? MOCK.students.find((s) => s.id === r.student_id) || null : null,
    }));
  }
  for (const [k, v] of Object.entries(filters)) {
    if (v === null || v === undefined || v === '') continue;
    rows = rows.filter((r) => String(r[k] ?? '').toLowerCase().includes(String(v).toLowerCase()));
  }
  return rows;
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

  return {
    incidents_total: incidents.length,
    incidents_open: incidents.filter((i) => i.status === 'open').length,
    inspections_pending: inspections.filter((i) => i.status === 'pending').length,
    inspections_passed: inspections.filter((i) => i.status === 'passed').length,
    inspections_overdue: inspections.filter((i) => i.status === 'overdue').length,
    drills_active: drills.filter((d) => d.status === 'upcoming').length,
    drills_completed: drills.filter((d) => d.status === 'completed').length,
    supplies_low: supplies.filter((s) => Number(s.quantity) <= Number(s.reorder_threshold)).length,
    supplies_total: supplies.reduce((s, x) => s + Number(x.quantity || 0), 0),
    supplies_breakdown: supplies.map((s) => ({ label: s.item, value: Number(s.quantity || 0) })),
    supplies_status: [
      { label: 'OK', value: supplies.filter((s) => Number(s.quantity) > Number(s.reorder_threshold)).length },
      { label: 'Low stock', value: supplies.filter((s) => Number(s.quantity) <= Number(s.reorder_threshold)).length },
    ],
    emergency_contacts_total: contacts.length,
    compliance_score: Math.round((inspections.filter((i) => i.status === 'passed').length / total) * 100),
    incident_breakdown: Object.entries(typeCount).map(([label, value]) => ({ label, value })),
    inspection_status: Object.entries(statusCount).map(([label, value]) => ({ label, value })),
    years_by_year,
  };
}

export function dataMode() {
  return provider;
}

export async function listRows(table, filters = {}) {
  if (await demoMode()) {
    provider = 'mock';
    return listMock(table, filters);
  }
  const query = { select: table === 'emergency_contacts' ? '*,students(name,grade)' : '*' };
  for (const [k, v] of Object.entries(filters)) {
    if (v) query[k] = `ilike.*${v}*`;
  }
  let rows;
  try {
    rows = await restFetch('GET', table, { query });
  } catch (e) {
    if (table !== 'emergency_contacts') throw e;
    rows = await restFetch('GET', table, { query: { ...query, select: '*' } });
  }
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

export async function sendNotification(payload) {
  const fnUrl = window.OSAS.NOTIFY_FN_URL;
  if (fnUrl) {
    try {
      const token = await auth.currentAccessToken();
      // Guard against a hung request (paused/unreachable Edge Function, CORS
      // block, etc.) — without this, a bad connection can leave the caller
      // waiting indefinitely with no error and no feedback.
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      let res;
      try {
        res = await fetch(fnUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error((data && data.error) || `Notification failed (${res.status})`);
      provider = 'api';
      const delivery = data.delivery || {};
      if (payload.contact_method === 'email' && delivery.status === 'failed') {
        return { ok: false, error: delivery.error || 'Email delivery failed', channel: 'email', ...(data || {}) };
      }
      return { ok: true, channel: (data && data.channel) || payload.contact_method, ...(data || {}) };
    } catch (e) {
      const reason = e.name === 'AbortError' ? 'Notification service timed out' : e.message;
      console.error('sendNotification via Edge Function failed:', e);
      // If there's a real signed-in session, don't silently fall back to a
      // direct DB insert for an email notification — that would record it
      // as "sent" without ever actually emailing anyone. Surface the error
      // instead so the failure is visible.
      if (payload.contact_method === 'email' && !(await demoMode())) {
        return { ok: false, error: reason || 'Notification service unreachable', channel: 'email' };
      }
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
  delete record.student_name;
  delete record.student_grade;
  const row = await insertRow('notifications', {
    ...record,
    sent_at: new Date().toISOString(),
    delivery_status: 'sent',
  });
  return { ok: true, provider: 'direct', channel: row.contact_method || payload.contact_method || 'app', id: row.id };
}

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
    } catch {}
    throw new Error(detail);
  }
  provider = 'api';
  return {
    path: `${bucket}/${path || file.name}`,
    url: `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${encodeURIComponent(path || file.name)}`,
  };
}
