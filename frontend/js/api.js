// ============================================================
// OSAS data layer — talks to the PHP REST API first, falls back
// to the in-browser mock dataset when the API is unreachable and
// no Supabase keys are configured (keeps the UI usable offline).
// ============================================================
import { MOCK, mockNextId } from './mock.js';

const API = window.OSAS.API_URL || '/api';
let provider = 'api'; // 'api' | 'mock'

const REQ_TIMEOUT = 7000;

async function apiFetch(path, options = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQ_TIMEOUT);
  let res;
  try {
    res = await fetch(`${API}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
      signal: ctrl.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    throw e instanceof TypeError ? e : new TypeError('API unavailable');
  }
  clearTimeout(timer);
  const type = res.headers.get('content-type') || '';
  let body = null;
  try { body = await res.json(); } catch { /* non-JSON */ }
  // Only a real JSON API counts as the backend. Static hosts answer
  // /api with HTML (404 page or SPA fallback) — treat those as
  // unavailable so callers fall back to the demo dataset.
  if (!type.includes('application/json')) {
    throw new TypeError('API unavailable');
  }
  if (!res.ok) {
    // Real API answered — surface its validation/server error.
    const detail = body && (body.error || (body.errors && body.errors.join(', ')) || body.message);
    throw new Error(detail || `Request failed (${res.status})`);
  }
  return body;
}

function snapshot(table) {
  return JSON.parse(JSON.stringify(MOCK[table] || []));
}

function insertMock(table, payload) {
  const row = { id: mockNextId(table), ...payload };
  MOCK[table] = MOCK[table] || [];
  MOCK[table].unshift(row);
  return row;
}

function updateMock(table, id, patch) {
  const rows = MOCK[table] || [];
  const i = rows.findIndex((r) => r.id === id);
  if (i < 0) throw new Error('Record not found');
  rows[i] = { ...rows[i], ...patch };
  return rows[i];
}

function deleteMock(table, id) {
  const rows = MOCK[table] || [];
  const i = rows.findIndex((r) => r.id === id);
  if (i >= 0) rows.splice(i, 1);
}

function listMock(table, filters = {}) {
  let rows = snapshot(table);
  for (const [k, v] of Object.entries(filters)) {
    if (v === null || v === undefined || v === '') continue;
    rows = rows.filter((r) => String(r[k] ?? '').toLowerCase().includes(String(v).toLowerCase()));
  }
  return rows;
}

/** Which data provider is active — shown in the UI for transparency. */
export function dataMode() {
  return provider;
}

// --- Public API (mirrors the PHP routes) ---

export async function listRows(table, filters = {}) {
  try {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v) qs.set(k, v);
    const rows = await apiFetch(`/${table}${qs.toString() ? `?${qs}` : ''}`);
    provider = 'api';
    return rows;
  } catch (e) {
    if (e instanceof TypeError || /Failed to fetch|NetworkError/i.test(e.message)) {
      provider = 'mock';
      return listMock(table, filters);
    }
    throw e;
  }
}

export async function insertRow(table, payload) {
  try {
    const row = await apiFetch(`/${table}`, { method: 'POST', body: JSON.stringify(payload) });
    provider = 'api';
    return row;
  } catch (e) {
    if (e instanceof TypeError || /Failed to fetch|NetworkError/i.test(e.message)) {
      provider = 'mock';
      return insertMock(table, payload);
    }
    throw e;
  }
}

export async function updateRow(table, id, patch) {
  try {
    const row = await apiFetch(`/${table}/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
    provider = 'api';
    return row;
  } catch (e) {
    if (e instanceof TypeError || /Failed to fetch|NetworkError/i.test(e.message)) {
      provider = 'mock';
      return updateMock(table, id, patch);
    }
    throw e;
  }
}

export async function deleteRow(table, id) {
  try {
    const r = await apiFetch(`/${table}/${id}`, { method: 'DELETE' });
    provider = 'api';
    return r;
  } catch (e) {
    if (e instanceof TypeError || /Failed to fetch|NetworkError/i.test(e.message)) {
      provider = 'mock';
      deleteMock(table, id);
      return { ok: true };
    }
    throw e;
  }
}

/** POST /notifications/send — server validates type-specific rules. */
export async function sendNotification(payload) {
  try {
    const r = await apiFetch('/notifications/send', { method: 'POST', body: JSON.stringify(payload) });
    provider = 'api';
    return r;
  } catch (e) {
    if (e instanceof TypeError || /Failed to fetch|NetworkError/i.test(e.message)) {
      provider = 'mock';
      insertMock('notifications', {
        ...payload,
        sent_at: new Date().toISOString(),
        delivery_status: 'sent',
        created_by: 'admin',
      });
      return { ok: true, provider: 'direct', id: mockNextId('notifications') };
    }
    throw e;
  }
}

/** GET /dashboard/stats — live aggregation for KPI cards + donuts. */
export async function getDashboardStats() {
  try {
    const s = await apiFetch('/dashboard/stats');
    provider = 'api';
    return s;
  } catch (e) {
    if (e instanceof TypeError || /Failed to fetch|NetworkError/i.test(e.message)) {
      provider = 'mock';
      const incidents = listMock('incidents');
      const inspections = listMock('inspections');
      const drills = listMock('drills');
      const supplies = listMock('supplies');
      const contacts = listMock('emergency_contacts');
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
        compliance_score: Math.round(((inspections.filter((i) => i.status === 'passed').length) / total) * 100),
        incident_breakdown: Object.entries(typeCount).map(([label, value]) => ({ label, value })),
        inspection_status: Object.entries(statusCount).map(([label, value]) => ({ label, value })),
      };
    }
    throw e;
  }
}

/**
 * File upload → PHP proxy. The PHP backend forwards to Supabase
 * Storage when keys are set, otherwise it stores the file under
 * backend/storage/ and serves it back.
 */
export async function uploadFile(bucket, file, path) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('bucket', bucket);
  fd.append('path', path || `${Date.now()}-${file.name}`);
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQ_TIMEOUT);
    let res;
    try {
      res = await fetch(`${API}/upload`, { method: 'POST', body: fd, signal: ctrl.signal });
    } finally {
      clearTimeout(timer);
    }
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      if (body && body.error) throw new Error(body.error);
      throw new TypeError('API unavailable');
    }
    provider = 'api';
    return body; // { path, url }
  } catch (e) {
    if (e instanceof TypeError || /Failed to fetch|NetworkError/i.test(e.message)) {
      provider = 'mock';
      return { path: `mock://${bucket}/${path || file.name}`, url: null, mock: true };
    }
    throw e;
  }
}


