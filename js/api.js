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

let supabaseAvailable = null;

async function demoMode() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return true;
  if (supabaseAvailable === false) return true;
  if (supabaseAvailable === true) return false;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`${REST}/incidents?select=id&limit=1`, {
      headers: { apikey: SUPABASE_ANON_KEY },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));
    if (res.ok) {
      supabaseAvailable = true;
      return false;
    }
    supabaseAvailable = false;
    console.warn('[OSAS] Remote Supabase unavailable, running in local mock storage mode.');
    return true;
  } catch {
    supabaseAvailable = false;
    console.warn('[OSAS] Remote Supabase unreachable, running in local mock storage mode.');
    return true;
  }
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
    try {
      rows = await restFetch('GET', table, { query });
    } catch (e) {
      if (table !== 'emergency_contacts') throw e;
      rows = await restFetch('GET', table, { query: { ...query, select: '*' } });
    }
    provider = 'api';
    return rows || [];
  } catch (err) {
    console.warn(`API call for ${table} failed, falling back to mock:`, err);
    provider = 'mock';
    return listMock(table, filters);
  }
}

export async function insertRow(table, payload) {
  if (await demoMode()) {
    provider = 'mock';
    return insertMock(table, payload);
  }
  try {
    const rows = await restFetch('POST', table, {
      body: payload,
      prefer: 'return=representation',
    });
    provider = 'api';
    return (rows && rows[0]) || payload;
  } catch (err) {
    console.warn(`API insert for ${table} failed, using local mock:`, err);
    provider = 'mock';
    return insertMock(table, payload);
  }
}

export async function updateRow(table, id, patch) {
  if (await demoMode()) {
    provider = 'mock';
    return updateMock(table, id, patch);
  }
  try {
    const rows = await restFetch('PATCH', table, {
      query: { id: `eq.${id}` },
      body: patch,
      prefer: 'return=representation',
    });
    provider = 'api';
    if (!rows || !rows[0]) throw new Error('Record not found');
    return rows[0];
  } catch (err) {
    console.warn(`API update for ${table} failed, using local mock:`, err);
    provider = 'mock';
    return updateMock(table, id, patch);
  }
}

export async function deleteRow(table, id) {
  if (await demoMode()) {
    provider = 'mock';
    deleteMock(table, id);
    return { ok: true };
  }
  try {
    await restFetch('DELETE', table, { query: { id: `eq.${id}` } });
    provider = 'api';
    return { ok: true };
  } catch (err) {
    console.warn(`API delete for ${table} failed, using local mock:`, err);
    provider = 'mock';
    deleteMock(table, id);
    return { ok: true };
  }
}

export async function sendNotification(rawPayload = {}) {
  const requestedType = rawPayload.notif_type;
  const isStockAlert = requestedType === 'alert' ||
    /restock|supplies|stock|inventory|shortage/i.test(String(rawPayload.title || '')) ||
    /restock|supplies|depleted/i.test(String(rawPayload.message || ''));
  const isParentAlert = requestedType === 'incident_alert' ||
    (!requestedType && !isStockAlert && (rawPayload.student_id || rawPayload.related_incident_id));

  const notifType = (isParentAlert || isStockAlert) ? 'incident_alert' : 'event_notice';

  let contactMethod = rawPayload.contact_method === 'in_app' ? 'app' : rawPayload.contact_method;
  if (isParentAlert || isStockAlert) {
    contactMethod = rawPayload.contact_method || 'email';
  } else if (contactMethod !== 'email' && contactMethod !== 'app') {
    contactMethod = 'app';
  }

  const priority = (isParentAlert || isStockAlert) ? 'urgent' : 'informational';

  let eventStartAt = rawPayload.event_start_at ? new Date(rawPayload.event_start_at).toISOString() : null;
  let eventEndAt = rawPayload.event_end_at ? new Date(rawPayload.event_end_at).toISOString() : null;

  if (notifType === 'event_notice') {
    if (!eventStartAt || isNaN(new Date(eventStartAt).getTime())) {
      eventStartAt = new Date().toISOString();
    }
    if (!eventEndAt || isNaN(new Date(eventEndAt).getTime()) || new Date(eventEndAt) <= new Date(eventStartAt)) {
      eventEndAt = new Date(new Date(eventStartAt).getTime() + 60 * 60 * 1000).toISOString();
    }
  }

  const defaultTitle = isParentAlert ? 'Incident Alert' : (isStockAlert ? 'Alert: Low Supplies Restock Required' : 'Campus Notice');
  const payload = {
    notif_type: notifType,
    priority,
    contact_method: contactMethod,
    title: String(rawPayload.title || defaultTitle).trim().slice(0, 255),
    message: String(rawPayload.message || '').trim(),
    student_id: rawPayload.student_id || '11111111-1111-4111-8111-111111111111',
  };

  if (isParentAlert) {
    if (rawPayload.related_incident_id) payload.related_incident_id = rawPayload.related_incident_id;
    if (rawPayload.student_name) payload.student_name = rawPayload.student_name;
    if (rawPayload.student_grade) payload.student_grade = rawPayload.student_grade;
  } else if (isStockAlert) {
    payload.audience_group = String(rawPayload.audience_group || 'Clinic Staff / Stock Custodians').slice(0, 100);
  } else {
    payload.audience_group = String(rawPayload.audience_group || rawPayload.recipient_role || rawPayload.recipient_name || 'All Staff').slice(0, 100);
    payload.event_start_at = eventStartAt;
    payload.event_end_at = eventEndAt;
  }

  const fnUrl = window.OSAS.NOTIFY_FN_URL;
  if (fnUrl) {
    try {
      const token = await auth.currentAccessToken();
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
  if (record.notif_type === 'alert') {
    record.notif_type = 'incident_alert';
  }
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
  try {
    const [incidents, inspections, drills, supplies, contacts] = await Promise.all([
      restFetch('GET', 'incidents', { query: { select: '*' } }),
      restFetch('GET', 'inspections', { query: { select: '*' } }),
      restFetch('GET', 'drills', { query: { select: '*' } }),
      restFetch('GET', 'supplies', { query: { select: '*' } }),
      restFetch('GET', 'emergency_contacts', { query: { select: '*' } }),
    ]);
    provider = 'api';
    return computeStats(incidents || [], inspections || [], drills || [], supplies || [], contacts || []);
  } catch (err) {
    console.warn('API dashboard fetch failed, falling back to mock:', err);
    provider = 'mock';
    return computeStats(
      listMock('incidents'), listMock('inspections'), listMock('drills'),
      listMock('supplies'), listMock('emergency_contacts'),
    );
  }
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
