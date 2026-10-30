import test from 'node:test';
import assert from 'node:assert/strict';

import { mintAgentToken, verifyAgentToken } from '../supabase/functions/_shared/agent-token.ts';
import { runAgentRequest } from '../supabase/functions/agent-tools/core.ts';

const KEY = 'test-agent-gateway-key-that-is-long-enough';
const ADMIN = '11000000-0000-4000-8000-000000000001';
const CLIENT = '11000000-0000-4000-8000-000000000002';
const STUDENT = '22000000-0000-4000-8000-000000000001';

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function makeSvc({ role = 'admin' } = {}) {
  const users = {
    [ADMIN]: { id: ADMIN, email: 'admin@example.test', app_metadata: { role: 'admin' }, user_metadata: { name: 'Admin One' } },
    [CLIENT]: { id: CLIENT, email: 'student@example.test', app_metadata: { role: 'client' }, user_metadata: { name: 'Student One' } },
  };
  if (role === 'client') users[ADMIN].app_metadata.role = 'client';
  const tables = {
    students: [{ id: STUDENT, name: 'John Cruz', grade: 11, section: 'A', phone: '0917', created_at: '2026-10-01T00:00:00Z' }],
    incidents: [],
    emergency_contacts: [{ id: '33000000-0000-4000-8000-000000000001', category: 'student', student_id: STUDENT, name: 'Maria Cruz', email: 'maria@example.test', priority: 1 }],
    notifications: [],
    agent_audit_log: [],
    agent_requests: [],
    agent_chat_log: [],
  };

  function matches(row, state) {
    return state.filters.every(([key, value]) => {
      if (key === '__gte') return String(row[value[0]]) >= String(value[1]);
      if (key === '__lte') return String(row[value[0]]) <= String(value[1]);
      if (key === '__ilike') return String(row[value[0]] || '').toLowerCase().includes(String(value[1]).replace(/%/g, '').toLowerCase());
      if (key === '__in') return value[1].includes(row[value[0]]);
      return row[key] === value;
    });
  }

  function table(name) {
    const rows = tables[name] || (tables[name] = []);
    const state = { filters: [], orders: [], limit: null, range: null, head: false, count: false };
    const builder = {
      select(_columns, options = {}) { state.head = !!options.head; state.count = !!options.count; return builder; },
      insert(row) {
        const values = Array.isArray(row) ? row : [row];
        state.insertedRows = [];
        for (const value of values) {
          const inserted = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...clone(value) };
          rows.push(inserted);
          state.insertedRows.push(inserted);
        }
        state.inserted = values.length;
        return builder;
      },
      update(values) { state.update = values; return builder; },
      delete() { state.delete = true; return builder; },
      eq(key, value) { state.filters.push([key, value]); return builder; },
      gte(key, value) { state.filters.push(['__gte', [key, value]]); return builder; },
      lte(key, value) { state.filters.push(['__lte', [key, value]]); return builder; },
      ilike(key, value) { state.filters.push(['__ilike', [key, value]]); return builder; },
      in(key, value) { state.filters.push(['__in', [key, value]]); return builder; },
      or() { return builder; },
      order(key, options = {}) { state.orders.push([key, options]); return builder; },
      limit(value) { state.limit = value; return builder; },
      range(from, to) { state.range = [from, to]; return builder; },
      maybeSingle() { state.single = true; return settle(); },
      single() { state.single = true; return settle(); },
      then(resolve, reject) { return settle().then(resolve, reject); },
    };

    async function settle() {
      if (state.inserted) {
        return { data: state.single ? clone(state.insertedRows[0]) : state.insertedRows.map(clone), error: null };
      }
      let selected = rows.filter((row) => matches(row, state));
      if (state.update) {
        for (const row of selected) Object.assign(row, clone(state.update));
        return { data: null, error: null };
      }
      if (state.delete) {
        for (const row of selected) rows.splice(rows.indexOf(row), 1);
        return { data: null, error: null };
      }
      for (const [key, options] of state.orders) {
        const direction = options.ascending === false ? -1 : 1;
        selected = [...selected].sort((a, b) => (String(a[key] ?? '') < String(b[key] ?? '') ? -1 : String(a[key] ?? '') > String(b[key] ?? '') ? 1 : 0) * direction);
      }
      if (state.range) selected = selected.slice(state.range[0], state.range[1] + 1);
      if (state.limit !== null) selected = selected.slice(0, state.limit);
      if (state.head) return { data: null, count: selected.length, error: null };
      return { data: state.single ? (clone(selected[0]) || null) : selected.map(clone), error: null };
    }
    return builder;
  }

  return {
    tables,
    auth: {
      admin: {
        async getUserById(id) {
          return { data: { user: users[id] ? clone(users[id]) : null }, error: null };
        },
      },
    },
    from(name) { return table(name); },
  };
}

async function tokenFor(sub = ADMIN, seconds = 600) {
  return mintAgentToken({ sub, exp: Math.floor(Date.now() / 1000) + seconds, jti: crypto.randomUUID() }, KEY);
}

async function call(svc, body, { token, now } = {}) {
  return runAgentRequest({
    svc,
    key: KEY,
    token: token === undefined ? await tokenFor() : token,
    body,
    supabaseUrl: 'https://project.example',
    serviceKey: 'service-key',
    fetchImpl: async () => { throw new Error('network should not be used in this test'); },
    now,
  });
}

test('agent tokens verify, reject tampering, and expire', async () => {
  const token = await tokenFor(ADMIN, 600);
  const payload = await verifyAgentToken(token, KEY);
  assert.equal(payload.sub, ADMIN);
  assert.equal(await verifyAgentToken(`${token}x`, KEY), null);
  assert.equal(await verifyAgentToken(token, `${KEY}x`), null);
  const expired = await tokenFor(ADMIN, -1);
  assert.equal(await verifyAgentToken(expired, KEY), null);
});

test('the gateway rejects missing, expired, and non-administrator identities', async () => {
  const svc = makeSvc();
  assert.equal((await call(svc, { action: 'overview' }, { token: '' })).status, 401);
  assert.equal((await call(svc, { action: 'overview' }, { token: await tokenFor(ADMIN, -5) })).status, 401);
  const client = makeSvc({ role: 'client' });
  assert.equal((await call(client, { action: 'overview' })).status, 403);
});

test('unknown actions and malformed filters are rejected before any write', async () => {
  const svc = makeSvc();
  assert.equal((await call(svc, { action: 'drop_everything' })).status, 400);
  assert.equal((await call(svc, { action: 'find_students', filters: '{broken' })).status, 400);
  assert.equal((await call(svc, { action: 'create_incident', data: '[]' })).status, 400);
  const noRequestId = await call(svc, {
    action: 'create_incident',
    data: { type: 'medical', severity: 'low', location: 'Clinic', description: 'Test.' },
  });
  assert.equal(noRequestId.status, 400);
  assert.match(noRequestId.body.error, /request_id/);
  assert.equal(svc.tables.incidents.length, 0);
});

test('students can be searched and read with guardian and incident context', async () => {
  const svc = makeSvc();
  const found = await call(svc, { action: 'find_students', filters: { query: 'Cruz' } });
  assert.equal(found.status, 200);
  assert.equal(found.body.data.students.length, 1);
  const profile = await call(svc, { action: 'get_student', filters: { student_id: STUDENT } });
  assert.equal(profile.status, 200);
  assert.equal(profile.body.data.student.name, 'John Cruz');
  assert.equal(profile.body.data.guardians[0].email, 'maria@example.test');
});

test('incident creation validates required fields and records an audit entry', async () => {
  const svc = makeSvc();
  const missing = await call(svc, { action: 'create_incident', request_id: 'missing-fields', data: { type: 'medical', severity: 'low' } });
  assert.equal(missing.status, 400);
  const created = await call(svc, {
    action: 'create_incident',
    request_id: 'run-1',
    data: { type: 'medical', severity: 'high', location: 'Clinic', description: 'Student fainted during class.' },
  });
  assert.equal(created.status, 200);
  assert.equal(created.body.ok, true);
  assert.equal(created.body.data.incident.description, 'Student fainted during class.');
  assert.equal(svc.tables.incidents.length, 1);
  const audit = svc.tables.agent_audit_log.find((row) => row.tool === 'create_incident' && row.status === 'ok');
  assert.equal(audit.status, 'ok');
  assert.equal(audit.actor_id, ADMIN);
});

test('a retried n8n run returns the cached write instead of duplicating it', async () => {
  const svc = makeSvc();
  const body = {
    action: 'create_incident',
    request_id: 'same-run',
    data: { type: 'security', severity: 'medium', location: 'Gate', description: 'Unlocked gate found during rounds.' },
  };
  const first = await call(svc, body);
  const second = await call(svc, body);
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(second.body.replayed, true);
  assert.equal(svc.tables.incidents.length, 1);
});

test('two different writes in one assistant turn are both kept', async () => {
  const svc = makeSvc();
  const first = await call(svc, {
    action: 'create_incident',
    request_id: 'one-turn',
    data: { type: 'security', severity: 'medium', location: 'Gate', description: 'Gate was unlocked.' },
  });
  const second = await call(svc, {
    action: 'create_incident',
    request_id: 'one-turn',
    data: { type: 'medical', severity: 'high', location: 'Clinic', description: 'Student needed first aid.' },
  });
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(second.body.replayed, undefined);
  assert.equal(svc.tables.incidents.length, 2);
});

test('destructive and external actions require explicit confirmation', async () => {
  const svc = makeSvc();
  assert.equal((await call(svc, { action: 'delete_record', request_id: 'confirm-1', data: { table: 'incidents', id: STUDENT } })).status, 409);
  assert.equal((await call(svc, { action: 'send_notification', request_id: 'confirm-2', data: { kind: 'guardian', student_id: STUDENT, title: 'Alert', message: 'Please contact the office.' } })).status, 409);
  assert.equal((await call(svc, { action: 'account_create', request_id: 'confirm-3', data: { email: 'new@example.test', name: 'New Admin', role: 'admin' } })).status, 409);
  assert.equal((await call(svc, { action: 'account_update', request_id: 'confirm-4', data: { id: ADMIN, name: 'Renamed' } })).status, 409);
  assert.equal((await call(svc, { action: 'account_delete', request_id: 'confirm-5', data: { id: CLIENT } })).status, 409);
  assert.equal((await call(svc, { action: 'account_send_reset', request_id: 'confirm-6', data: { id: CLIENT } })).status, 409);
});
