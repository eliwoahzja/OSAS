// OSAS administrative agent tool gateway.
//
// n8n never receives a Supabase service-role key. It relays a short-lived token
// minted by agent-chat after verifying the administrator's Supabase session.
// This module re-verifies the token, re-checks the administrator role, validates
// every field, writes an audit row, and only then touches the database.

import { verifyAgentToken } from '../_shared/agent-token.ts';

export const READ_ACTIONS = [
  'overview',
  'find_students',
  'get_student',
  'list_incidents',
  'get_incident',
  'incident_stats',
  'list_drills',
  'list_inspections',
  'list_supplies',
  'list_contacts',
  'list_risks',
  'list_accounts',
  'list_notifications',
  'list_audit',
  'list_roles',
  'list_plans',
] as const;

export const WRITE_ACTIONS = [
  'create_incident',
  'update_incident',
  'create_drill',
  'update_drill',
  'create_inspection',
  'update_inspection',
  'create_supply',
  'update_supply',
  'create_risk',
  'update_risk',
  'create_contact',
  'update_contact',
  'delete_record',
  'send_notification',
  'account_create',
  'account_update',
  'account_delete',
  'account_send_reset',
] as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MANILA = 'Asia/Manila';
const LIMIT = 100;
const DEFAULT_SITE_URL = 'https://osas.stagnesacademy-sms.com';

const INCIDENT_TYPES = ['medical', 'slips/falls', 'fire-related', 'security', 'equipment failure'];
const INCIDENT_SEVERITIES = ['low', 'medium', 'high'];
const INCIDENT_STATUSES = ['open', 'resolved'];
const DRILL_TYPES = ['Fire', 'Earthquake', 'Lockdown', 'Evacuation'];
const DRILL_STATUSES = ['upcoming', 'completed', 'cancelled'];
const INSPECTION_STATUSES = ['passed', 'pending', 'overdue', 'fail'];
const RISK_LEVELS = ['Low', 'Medium', 'Moderate', 'High', 'Critical'];
const RISK_FACTORS = ['Low', 'Medium', 'High'];
const CONTACT_CATEGORIES = ['student', 'school'];
const DELETABLE = ['incidents', 'drills', 'inspections', 'supplies', 'risks', 'emergency_contacts'];

class ToolError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export type AgentRequestOptions = {
  svc: any;
  key: string;
  token: string;
  body: any;
  supabaseUrl: string;
  serviceKey: string;
  fetchImpl?: typeof fetch;
  now?: number;
  siteUrl?: string;
};

export type AgentResponse = { status: number; body: any };

const text = (value: unknown): string => (value === null || value === undefined ? '' : String(value).trim());

function requiredText(value: unknown, label: string, min = 1, max = 4000): string {
  const out = text(value);
  if (out.length < min) throw new ToolError(`${label} is required.`);
  if (out.length > max) throw new ToolError(`${label} must be ${max} characters or fewer.`);
  return out;
}

function optionalText(value: unknown, max = 4000): string | null {
  const out = text(value);
  if (!out) return null;
  if (out.length > max) throw new ToolError(`That value must be ${max} characters or fewer.`);
  return out;
}

function requiredUuid(value: unknown, label: string): string {
  const out = text(value);
  if (!UUID_RE.test(out)) throw new ToolError(`${label} must be a valid record id.`);
  return out;
}

function optionalUuid(value: unknown, label: string): string | null {
  const out = text(value);
  if (!out) return null;
  return requiredUuid(out, label);
}

function enumValue(value: unknown, allowed: string[], label: string): string {
  const out = text(value);
  if (!allowed.includes(out)) throw new ToolError(`${label} must be one of: ${allowed.join(', ')}.`);
  return out;
}

function optionalEnum(value: unknown, allowed: string[], label: string): string | null {
  if (value === null || value === undefined || text(value) === '') return null;
  return enumValue(value, allowed, label);
}

function dateValue(value: unknown, label: string): string {
  const out = text(value);
  if (!DATE_RE.test(out) || Number.isNaN(Date.parse(`${out}T00:00:00Z`))) {
    throw new ToolError(`${label} must use YYYY-MM-DD.`);
  }
  return out;
}

function optionalDate(value: unknown, label: string): string | null {
  if (value === null || value === undefined || text(value) === '') return null;
  return dateValue(value, label);
}

function integer(value: unknown, label: string, min: number, max: number, fallback?: number): number {
  if (value === null || value === undefined || text(value) === '') {
    if (fallback !== undefined) return fallback;
    throw new ToolError(`${label} is required.`);
  }
  const out = Number(value);
  if (!Number.isInteger(out) || out < min || out > max) throw new ToolError(`${label} must be a whole number from ${min} to ${max}.`);
  return out;
}

function optionalInteger(value: unknown, label: string, min: number, max: number): number | null {
  if (value === null || value === undefined || text(value) === '') return null;
  return integer(value, label, min, max);
}

function booleanValue(value: unknown, fallback = false): boolean {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['true', 'yes', '1'].includes(text(value).toLowerCase());
}

function objectArg(value: unknown, label: string): Record<string, any> {
  if (value === null || value === undefined || value === '') return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {}
  }
  throw new ToolError(`${label} must be a JSON object.`);
}

function limitValue(value: unknown, fallback = 25): number {
  return integer(value, 'limit', 1, LIMIT, fallback);
}

function todayManila(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: MANILA, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function redact(value: any, depth = 0): any {
  if (depth > 8) return '[depth limit]';
  if (Array.isArray(value)) return value.slice(0, 200).map((item) => redact(item, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = /password|token|secret|api[_-]?key/i.test(key) ? '[redacted]' : redact(item, depth + 1);
    }
    return out;
  }
  if (typeof value === 'string') return value.length > 4000 ? `${value.slice(0, 4000)}…` : value;
  return value;
}

function ensure(result: any): any {
  if (result?.error) throw new ToolError(result.error.message || 'The database rejected the request.', 503);
  return result?.data;
}

async function audit(svc: any, payload: Record<string, any>): Promise<void> {
  try {
    await svc.from('agent_audit_log').insert(payload);
  } catch {
    // Auditing must not turn a successful write into a failed request.
  }
}

async function countSince(svc: any, table: string, actorId: string, since: string): Promise<number> {
  try {
    const result = await svc.from(table).select('id', { count: 'exact', head: true })
      .eq('actor_id', actorId).gte('created_at', since);
    return Number(result?.count || 0);
  } catch {
    return 0;
  }
}

async function actorFromToken(svc: any, token: string, key: string, now: number): Promise<any> {
  const payload = await verifyAgentToken(token, key, now);
  if (!payload) throw new ToolError('The assistant session has expired. Close the assistant and try again.', 401);
  const { data, error } = await svc.auth.admin.getUserById(payload.sub);
  const user = data?.user;
  if (error || !user) throw new ToolError('The assistant could not verify your administrator account.', 401);
  if (user.app_metadata?.role !== 'admin') throw new ToolError('Only administrators can use the OSAS assistant.', 403);
  return user;
}

async function cachedResult(svc: any, actorId: string, requestId: string, dedupeKey: string): Promise<any | null> {
  if (!requestId) return null;
  try {
    const { data, error } = await svc.from('agent_requests')
      .select('result').eq('actor_id', actorId).eq('request_id', requestId).eq('tool', dedupeKey).maybeSingle();
    if (!error && data?.result) return data.result;
  } catch {}
  return null;
}

async function rememberResult(svc: any, actorId: string, requestId: string, dedupeKey: string, result: any): Promise<void> {
  if (!requestId) return;
  try {
    await svc.from('agent_requests').insert({
      actor_id: actorId, request_id: requestId, tool: dedupeKey, result,
    });
  } catch {}
}

function stableStringify(value: any): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

async function fingerprint(value: any): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(stableStringify(value)));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, 24);
}

async function fetchAll(svc: any, table: string, columns: string, apply: (query: any) => any): Promise<any[]> {
  const rows: any[] = [];
  for (let from = 0; ; from += 1000) {
    let query = svc.from(table).select(columns).range(from, from + 999);
    query = apply(query) || query;
    const data = ensure(await query);
    if (!Array.isArray(data) || !data.length) break;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

function groupCount(rows: any[], field: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) {
    const key = text(row[field]) || 'Unspecified';
    out[key] = (out[key] || 0) + 1;
  }
  return out;
}

async function callFunction(
  name: string,
  payload: Record<string, any>,
  actor: any,
  key: string,
  supabaseUrl: string,
  serviceKey: string,
  fetchImpl: typeof fetch,
): Promise<any> {
  const response = await fetchImpl(`${supabaseUrl}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serviceKey}`,
      'x-agent-key': key,
      'x-agent-actor': actor.id,
    },
    body: JSON.stringify(payload),
  });
  let json: any = null;
  try { json = await response.json(); } catch {}
  if (!response.ok) throw new ToolError(json?.error || `${name} failed (${response.status}).`, 502);
  return json;
}

async function runRead(svc: any, action: string, filters: Record<string, any>, actor: any, opts: AgentRequestOptions): Promise<any> {
  switch (action) {
    case 'overview': {
      const [students, openIncidents, supplies, drills, inspections, risks, guardians, accounts] = await Promise.all([
        svc.from('students').select('id', { count: 'exact', head: true }),
        svc.from('incidents').select('id', { count: 'exact', head: true }).eq('status', 'open'),
        svc.from('supplies').select('id,item,quantity,unit,reorder_threshold,location,expiry'),
        svc.from('drills').select('id,type,date,time,building,status').eq('status', 'upcoming').order('date').limit(5),
        svc.from('inspections').select('id,item,area,status,last_inspected').in('status', ['overdue', 'pending']).order('last_inspected').limit(10),
        svc.from('risks').select('id,hazard,risk_level,risk_score').in('risk_level', ['High', 'Critical']).limit(10),
        svc.from('emergency_contacts').select('id', { count: 'exact', head: true }).eq('category', 'student').eq('active', true),
        callFunction('manage-accounts', { action: 'list' }, actor, opts.key, opts.supabaseUrl, opts.serviceKey, opts.fetchImpl || fetch),
      ]);
      const supplyRows = ensure(supplies) || [];
      return {
        today: todayManila(),
        counts: {
          students: Number(students?.count || 0),
          open_incidents: Number(openIncidents?.count || 0),
          guardians: Number(guardians?.count || 0),
          accounts: Array.isArray(accounts?.users) ? accounts.users.length : 0,
        },
        low_stock: supplyRows.filter((row: any) => Number(row.quantity) <= Number(row.reorder_threshold)).slice(0, 15),
        upcoming_drills: ensure(drills) || [],
        inspections_needing_attention: ensure(inspections) || [],
        high_risks: ensure(risks) || [],
      };
    }

    case 'find_students': {
      const limit = limitValue(filters.limit);
      let query = svc.from('students').select('id,name,grade,section,phone,created_at');
      const name = text(filters.query || filters.name);
      if (name) query = query.ilike('name', `%${name.replace(/[%_]/g, '')}%`);
      if (filters.grade !== undefined && text(filters.grade)) query = query.eq('grade', integer(filters.grade, 'grade', 7, 12));
      if (text(filters.section)) query = query.ilike('section', `%${text(filters.section).replace(/[%_]/g, '')}%`);
      const data = ensure(await query.order('name').limit(limit));
      return { students: data || [], count: (data || []).length };
    }

    case 'get_student': {
      const id = requiredUuid(filters.student_id || filters.id, 'student_id');
      const student = ensure(await svc.from('students').select('*').eq('id', id).maybeSingle());
      if (!student) throw new ToolError('No student matches that id.', 404);
      const contacts = ensure(await svc.from('emergency_contacts').select('*')
        .eq('category', 'student').eq('student_id', id).order('priority'));
      const incidents = ensure(await svc.from('incidents').select('id,date,time,type,severity,status,location,description')
        .eq('student_id', id).order('date', { ascending: false }).limit(15));
      return { student, guardians: contacts || [], recent_incidents: incidents || [] };
    }

    case 'list_incidents': {
      const limit = limitValue(filters.limit);
      let query = svc.from('incidents').select('id,date,time,type,location,description,reporter,severity,status,student_id,created_at,submitted_by');
      if (text(filters.student_id)) query = query.eq('student_id', requiredUuid(filters.student_id, 'student_id'));
      if (text(filters.status)) query = query.eq('status', enumValue(filters.status, INCIDENT_STATUSES, 'status'));
      if (text(filters.type)) query = query.eq('type', enumValue(filters.type, INCIDENT_TYPES, 'type'));
      if (text(filters.severity)) query = query.eq('severity', enumValue(filters.severity, INCIDENT_SEVERITIES, 'severity'));
      if (text(filters.from)) query = query.gte('date', dateValue(filters.from, 'from'));
      if (text(filters.to)) query = query.lte('date', dateValue(filters.to, 'to'));
      const search = text(filters.query).replace(/[,()]/g, ' ').trim();
      if (search) query = query.or(`description.ilike.%${search}%,location.ilike.%${search}%,reporter.ilike.%${search}%`);
      const data = ensure(await query.order('date', { ascending: false }).order('created_at', { ascending: false }).limit(limit));
      return { incidents: data || [], count: (data || []).length };
    }

    case 'get_incident': {
      const id = requiredUuid(filters.id || filters.incident_id, 'incident id');
      const incident = ensure(await svc.from('incidents').select('*').eq('id', id).maybeSingle());
      if (!incident) throw new ToolError('No incident matches that id.', 404);
      let student = null;
      if (incident.student_id) {
        student = ensure(await svc.from('students').select('id,name,grade,section').eq('id', incident.student_id).maybeSingle());
      }
      const notifications = ensure(await svc.from('notifications').select('id,notif_type,title,audience_group,delivery_status,sent_at')
        .eq('related_incident_id', id).order('created_at', { ascending: false }).limit(10));
      return { incident, student, notifications: notifications || [] };
    }

    case 'incident_stats': {
      const year = integer(filters.year, 'year', 2000, 2100, Number(todayManila().slice(0, 4)));
      const rows = await fetchAll(svc, 'incidents', 'id,date,type,severity,status,student_id', (query) => query
        .gte('date', `${year}-01-01`).lte('date', `${year}-12-31`));
      const byMonth: Record<string, number> = {};
      for (const row of rows) {
        const month = text(row.date).slice(5, 7);
        if (month) byMonth[month] = (byMonth[month] || 0) + 1;
      }
      return {
        year,
        total: rows.length,
        open: rows.filter((row) => row.status === 'open').length,
        resolved: rows.filter((row) => row.status === 'resolved').length,
        by_type: groupCount(rows, 'type'),
        by_severity: groupCount(rows, 'severity'),
        by_month: byMonth,
        students_involved: new Set(rows.map((row) => row.student_id).filter(Boolean)).size,
      };
    }

    case 'list_drills': {
      const limit = limitValue(filters.limit);
      let query = svc.from('drills').select('*');
      if (text(filters.status)) query = query.eq('status', enumValue(filters.status, DRILL_STATUSES, 'status'));
      if (text(filters.type)) query = query.eq('type', enumValue(filters.type, DRILL_TYPES, 'type'));
      if (text(filters.from)) query = query.gte('date', dateValue(filters.from, 'from'));
      if (text(filters.to)) query = query.lte('date', dateValue(filters.to, 'to'));
      const data = ensure(await query.order('date', { ascending: false }).limit(limit));
      return { drills: data || [], count: (data || []).length };
    }

    case 'list_inspections': {
      const limit = limitValue(filters.limit);
      let query = svc.from('inspections').select('*');
      if (text(filters.status)) query = query.eq('status', enumValue(filters.status, INSPECTION_STATUSES, 'status'));
      if (text(filters.area)) query = query.ilike('area', `%${text(filters.area).replace(/[%_]/g, '')}%`);
      const search = text(filters.query).replace(/[,()]/g, ' ').trim();
      if (search) query = query.or(`item.ilike.%${search}%,area.ilike.%${search}%,inspector.ilike.%${search}%`);
      const data = ensure(await query.order('last_inspected', { ascending: true, nullsFirst: true }).limit(limit));
      return { inspections: data || [], count: (data || []).length };
    }

    case 'list_supplies': {
      const limit = limitValue(filters.limit, 50);
      let query = svc.from('supplies').select('*');
      if (text(filters.category)) query = query.ilike('category', `%${text(filters.category).replace(/[%_]/g, '')}%`);
      const search = text(filters.query).replace(/[,()]/g, ' ').trim();
      if (search) query = query.or(`item.ilike.%${search}%,description.ilike.%${search}%,location.ilike.%${search}%`);
      let rows = ensure(await query.order('item').limit(500)) || [];
      if (booleanValue(filters.low_stock)) rows = rows.filter((row: any) => Number(row.quantity) <= Number(row.reorder_threshold));
      if (text(filters.expiring_days)) {
        const days = integer(filters.expiring_days, 'expiring_days', 1, 3650);
        const cutoff = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
        rows = rows.filter((row: any) => row.expiry && row.expiry <= cutoff);
      }
      return { supplies: rows.slice(0, limit), count: rows.length };
    }

    case 'list_contacts': {
      const limit = limitValue(filters.limit, 50);
      let query = svc.from('emergency_contacts').select('*');
      if (text(filters.category)) query = query.eq('category', enumValue(filters.category, CONTACT_CATEGORIES, 'category'));
      if (text(filters.student_id)) query = query.eq('student_id', requiredUuid(filters.student_id, 'student_id'));
      if (filters.active !== undefined && text(filters.active) !== '') query = query.eq('active', booleanValue(filters.active, true));
      const search = text(filters.query).replace(/[,()]/g, ' ').trim();
      if (search) query = query.or(`name.ilike.%${search}%,role.ilike.%${search}%,relationship.ilike.%${search}%,email.ilike.%${search}%`);
      const data = ensure(await query.order('category').order('priority').limit(limit));
      return { contacts: data || [], count: (data || []).length };
    }

    case 'list_risks': {
      const limit = limitValue(filters.limit, 50);
      let query = svc.from('risks').select('*');
      const search = text(filters.query).replace(/[,()]/g, ' ').trim();
      if (search) query = query.or(`hazard.ilike.%${search}%,mitigation.ilike.%${search}%,owner.ilike.%${search}%`);
      if (text(filters.risk_level)) query = query.eq('risk_level', enumValue(filters.risk_level, RISK_LEVELS, 'risk_level'));
      let rows = ensure(await query.order('risk_score', { ascending: false }).limit(500)) || [];
      if (text(filters.min_score)) {
        const min = integer(filters.min_score, 'min_score', 0, 100000);
        rows = rows.filter((row: any) => Number(row.risk_score || 0) >= min);
      }
      return { risks: rows.slice(0, limit), count: rows.length };
    }

    case 'list_accounts': {
      const payload = await callFunction('manage-accounts', { action: 'list' }, actor, opts.key, opts.supabaseUrl, opts.serviceKey, opts.fetchImpl || fetch);
      let users = Array.isArray(payload?.users) ? payload.users : [];
      const search = text(filters.query).toLowerCase();
      if (search) users = users.filter((user: any) => `${user.name || ''} ${user.email || ''} ${user.student_id || ''}`.toLowerCase().includes(search));
      if (text(filters.role)) users = users.filter((user: any) => user.role === filters.role);
      return { accounts: users, count: users.length };
    }

    case 'list_notifications': {
      const limit = limitValue(filters.limit, 25);
      let query = svc.from('notifications').select('id,notif_type,priority,student_id,related_incident_id,audience_group,title,message,delivery_status,sent_at,created_at');
      if (text(filters.student_id)) query = query.eq('student_id', requiredUuid(filters.student_id, 'student_id'));
      if (text(filters.status)) query = query.eq('delivery_status', text(filters.status));
      const data = ensure(await query.order('created_at', { ascending: false }).limit(limit));
      return { notifications: data || [], count: (data || []).length };
    }

    case 'list_audit': {
      const limit = limitValue(filters.limit, 25);
      let query = svc.from('audit_log').select('id,table_name,record_id,action,changed_by,changed_at');
      if (text(filters.table_name)) query = query.eq('table_name', text(filters.table_name));
      const data = ensure(await query.order('changed_at', { ascending: false }).limit(limit));
      return { audit: data || [], count: (data || []).length };
    }

    case 'list_roles': {
      const limit = limitValue(filters.limit, 50);
      let query = svc.from('emergency_roles').select('*');
      if (text(filters.query)) query = query.ilike('role', `%${text(filters.query).replace(/[%_]/g, '')}%`);
      const data = ensure(await query.order('role').limit(limit));
      return { roles: data || [], count: (data || []).length };
    }

    case 'list_plans': {
      const limit = limitValue(filters.limit, 50);
      let query = svc.from('evacuation_plans').select('*');
      if (text(filters.building)) query = query.ilike('building', `%${text(filters.building).replace(/[%_]/g, '')}%`);
      const data = ensure(await query.order('building').limit(limit));
      return { plans: data || [], count: (data || []).length };
    }

    default:
      throw new ToolError(`Unknown read action "${action}".`);
  }
}

function computeRiskScore(data: Record<string, any>): number | null {
  const keys = ['threat', 'vulnerability', 'exploit_likelihood', 'exploit_impact', 'asset_value', 'security_controls'];
  if (!keys.every((key) => Number.isFinite(Number(data[key])) && Number(data[key]) >= 1 && Number(data[key]) <= 5)) return null;
  const raw = Number(data.threat) * Number(data.vulnerability)
    * (Number(data.exploit_likelihood) * Number(data.exploit_impact))
    * Number(data.asset_value) - Number(data.security_controls);
  return Math.max(0, raw);
}

function scoreToLevel(score: number): string {
  if (score >= 751) return 'Critical';
  if (score >= 501) return 'High';
  if (score >= 251) return 'Moderate';
  return 'Low';
}

function randomPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
  const bytes = crypto.getRandomValues(new Uint8Array(28));
  let out = '';
  for (const byte of bytes) out += alphabet[byte % alphabet.length];
  return out;
}

async function runWrite(svc: any, action: string, data: Record<string, any>, actor: any, opts: AgentRequestOptions): Promise<any> {
  const actorName = text(actor.user_metadata?.name) || text(actor.email) || 'Administrator';
  const fetchImpl = opts.fetchImpl || fetch;

  switch (action) {
    case 'create_incident': {
      const row: Record<string, any> = {
        date: text(data.date) ? dateValue(data.date, 'date') : todayManila(),
        time: optionalText(data.time, 20),
        type: optionalEnum(data.type, INCIDENT_TYPES, 'type'),
        location: optionalText(data.location, 255),
        description: requiredText(data.description, 'description', 5, 10000),
        reporter: optionalText(data.reporter, 255) || actorName,
        severity: optionalEnum(data.severity, INCIDENT_SEVERITIES, 'severity'),
        status: text(data.status) ? enumValue(data.status, INCIDENT_STATUSES, 'status') : 'open',
        student_id: optionalUuid(data.student_id, 'student_id'),
        submitted_by: actor.id,
      };
      const created = ensure(await svc.from('incidents').insert(row).select('*').single());
      return { incident: created, message: 'Incident saved.' };
    }

    case 'update_incident': {
      const id = requiredUuid(data.id || data.incident_id, 'incident id');
      const changes: Record<string, any> = {};
      if ('status' in data) changes.status = enumValue(data.status, INCIDENT_STATUSES, 'status');
      if ('severity' in data) changes.severity = optionalEnum(data.severity, INCIDENT_SEVERITIES, 'severity');
      if ('type' in data) changes.type = optionalEnum(data.type, INCIDENT_TYPES, 'type');
      if ('location' in data) changes.location = optionalText(data.location, 255);
      if ('description' in data) changes.description = requiredText(data.description, 'description', 5, 10000);
      if ('reporter' in data) changes.reporter = optionalText(data.reporter, 255);
      if ('student_id' in data) changes.student_id = optionalUuid(data.student_id, 'student_id');
      if ('date' in data) changes.date = dateValue(data.date, 'date');
      if ('time' in data) changes.time = optionalText(data.time, 20);
      if (!Object.keys(changes).length) throw new ToolError('No incident fields were supplied to update.');
      const updated = ensure(await svc.from('incidents').update(changes).eq('id', id).select('*').maybeSingle());
      if (!updated) throw new ToolError('No incident matches that id.', 404);
      return { incident: updated, message: 'Incident updated.' };
    }

    case 'create_drill': {
      const row = {
        type: enumValue(data.type, DRILL_TYPES, 'type'),
        date: dateValue(data.date, 'date'),
        time: optionalText(data.time, 20),
        building: requiredText(data.building, 'building', 2, 255),
        person_in_charge: requiredText(data.person_in_charge, 'person_in_charge', 2, 255),
        status: text(data.status) ? enumValue(data.status, DRILL_STATUSES, 'status') : 'upcoming',
        notes: optionalText(data.notes, 4000),
      };
      const created = ensure(await svc.from('drills').insert(row).select('*').single());
      return { drill: created, message: 'Drill scheduled.' };
    }

    case 'update_drill': {
      const id = requiredUuid(data.id, 'drill id');
      const changes: Record<string, any> = {};
      if ('type' in data) changes.type = enumValue(data.type, DRILL_TYPES, 'type');
      if ('date' in data) changes.date = dateValue(data.date, 'date');
      if ('time' in data) changes.time = optionalText(data.time, 20);
      if ('building' in data) changes.building = requiredText(data.building, 'building', 2, 255);
      if ('person_in_charge' in data) changes.person_in_charge = requiredText(data.person_in_charge, 'person_in_charge', 2, 255);
      if ('status' in data) changes.status = enumValue(data.status, DRILL_STATUSES, 'status');
      if ('notes' in data) changes.notes = optionalText(data.notes, 4000);
      if (!Object.keys(changes).length) throw new ToolError('No drill fields were supplied to update.');
      const updated = ensure(await svc.from('drills').update(changes).eq('id', id).select('*').maybeSingle());
      if (!updated) throw new ToolError('No drill matches that id.', 404);
      return { drill: updated, message: 'Drill updated.' };
    }

    case 'create_inspection': {
      const row = {
        item: requiredText(data.item, 'item', 2, 255),
        area: requiredText(data.area, 'area', 2, 255),
        frequency: requiredText(data.frequency, 'frequency', 2, 50),
        last_inspected: optionalDate(data.last_inspected, 'last_inspected'),
        status: text(data.status) ? enumValue(data.status, INSPECTION_STATUSES, 'status') : 'pending',
        inspector: optionalText(data.inspector, 255),
        notes: optionalText(data.notes, 4000),
        photo_url: optionalText(data.photo_url, 2000),
        risk_level: optionalText(data.risk_level, 20),
        corrective_actions: optionalText(data.corrective_actions, 4000),
      };
      const created = ensure(await svc.from('inspections').insert(row).select('*').single());
      return { inspection: created, message: 'Inspection recorded.' };
    }

    case 'update_inspection': {
      const id = requiredUuid(data.id, 'inspection id');
      const changes: Record<string, any> = {};
      for (const key of ['item', 'area', 'frequency']) {
        if (key in data) changes[key] = requiredText(data[key], key, 2, key === 'frequency' ? 50 : 255);
      }
      if ('last_inspected' in data) changes.last_inspected = optionalDate(data.last_inspected, 'last_inspected');
      if ('status' in data) changes.status = enumValue(data.status, INSPECTION_STATUSES, 'status');
      if ('inspector' in data) changes.inspector = optionalText(data.inspector, 255);
      if ('notes' in data) changes.notes = optionalText(data.notes, 4000);
      if ('photo_url' in data) changes.photo_url = optionalText(data.photo_url, 2000);
      if ('risk_level' in data) changes.risk_level = optionalText(data.risk_level, 20);
      if ('corrective_actions' in data) changes.corrective_actions = optionalText(data.corrective_actions, 4000);
      if (!Object.keys(changes).length) throw new ToolError('No inspection fields were supplied to update.');
      const updated = ensure(await svc.from('inspections').update(changes).eq('id', id).select('*').maybeSingle());
      if (!updated) throw new ToolError('No inspection matches that id.', 404);
      return { inspection: updated, message: 'Inspection updated.' };
    }

    case 'create_supply': {
      const row = {
        item: requiredText(data.item, 'item', 2, 255),
        description: optionalText(data.description, 4000),
        category: optionalText(data.category, 80),
        quantity: integer(data.quantity, 'quantity', 0, 1000000, 0),
        unit: optionalText(data.unit, 20),
        location: requiredText(data.location, 'location', 2, 255),
        expiry: optionalDate(data.expiry, 'expiry'),
        reorder_threshold: integer(data.reorder_threshold, 'reorder_threshold', 0, 1000000, 0),
        last_restocked: optionalDate(data.last_restocked, 'last_restocked'),
      };
      const created = ensure(await svc.from('supplies').insert(row).select('*').single());
      return { supply: created, message: 'Supply item added.' };
    }

    case 'update_supply': {
      const id = requiredUuid(data.id, 'supply id');
      const changes: Record<string, any> = {};
      if ('item' in data) changes.item = requiredText(data.item, 'item', 2, 255);
      if ('description' in data) changes.description = optionalText(data.description, 4000);
      if ('category' in data) changes.category = optionalText(data.category, 80);
      if ('quantity' in data) changes.quantity = integer(data.quantity, 'quantity', 0, 1000000);
      if ('unit' in data) changes.unit = optionalText(data.unit, 20);
      if ('location' in data) changes.location = requiredText(data.location, 'location', 2, 255);
      if ('expiry' in data) changes.expiry = optionalDate(data.expiry, 'expiry');
      if ('reorder_threshold' in data) changes.reorder_threshold = integer(data.reorder_threshold, 'reorder_threshold', 0, 1000000);
      if ('last_restocked' in data) changes.last_restocked = optionalDate(data.last_restocked, 'last_restocked');
      if (!Object.keys(changes).length) throw new ToolError('No supply fields were supplied to update.');
      const updated = ensure(await svc.from('supplies').update(changes).eq('id', id).select('*').maybeSingle());
      if (!updated) throw new ToolError('No supply item matches that id.', 404);
      return { supply: updated, message: 'Supply item updated.' };
    }

    case 'create_risk': {
      const score = computeRiskScore(data);
      const level = text(data.risk_level)
        ? enumValue(data.risk_level, RISK_LEVELS, 'risk_level')
        : (score === null ? null : scoreToLevel(score));
      if (!level) throw new ToolError('risk_level is required unless all six 1–5 risk factors are supplied.');
      const row: Record<string, any> = {
        hazard: requiredText(data.hazard, 'hazard', 3, 4000),
        likelihood: enumValue(data.likelihood, RISK_FACTORS, 'likelihood'),
        impact: enumValue(data.impact, RISK_FACTORS, 'impact'),
        risk_level: level,
        mitigation: optionalText(data.mitigation, 4000),
        owner: optionalText(data.owner, 255),
        review_date: optionalDate(data.review_date, 'review_date'),
        threat: optionalInteger(data.threat, 'threat', 1, 5),
        vulnerability: optionalInteger(data.vulnerability, 'vulnerability', 1, 5),
        exploit_likelihood: optionalInteger(data.exploit_likelihood, 'exploit_likelihood', 1, 5),
        exploit_impact: optionalInteger(data.exploit_impact, 'exploit_impact', 1, 5),
        asset_value: optionalInteger(data.asset_value, 'asset_value', 1, 5),
        security_controls: optionalInteger(data.security_controls, 'security_controls', 1, 5),
        risk_score: score,
        custom_reason: optionalText(data.custom_reason, 4000),
      };
      const created = ensure(await svc.from('risks').insert(row).select('*').single());
      return { risk: created, message: 'Risk assessment saved.' };
    }

    case 'update_risk': {
      const id = requiredUuid(data.id, 'risk id');
      const existing = ensure(await svc.from('risks').select('*').eq('id', id).maybeSingle());
      if (!existing) throw new ToolError('No risk assessment matches that id.', 404);
      const merged = { ...existing, ...data };
      const changes: Record<string, any> = {};
      for (const key of ['hazard', 'likelihood', 'impact', 'risk_level', 'mitigation', 'owner']) {
        if (key in data) changes[key] = key === 'hazard' ? requiredText(data[key], 'hazard', 3, 4000)
          : key === 'likelihood' || key === 'impact' ? enumValue(data[key], RISK_FACTORS, key)
            : key === 'risk_level' ? enumValue(data[key], RISK_LEVELS, 'risk_level')
              : optionalText(data[key], key === 'owner' ? 255 : 4000);
      }
      if ('review_date' in data) changes.review_date = optionalDate(data.review_date, 'review_date');
      for (const key of ['threat', 'vulnerability', 'exploit_likelihood', 'exploit_impact', 'asset_value', 'security_controls']) {
        if (key in data) changes[key] = optionalInteger(data[key], key, 1, 5);
      }
      if ('custom_reason' in data) changes.custom_reason = optionalText(data.custom_reason, 4000);
      const score = computeRiskScore(merged);
      if (score !== null) {
        changes.risk_score = score;
        if (!('risk_level' in changes)) changes.risk_level = scoreToLevel(score);
      }
      if (!Object.keys(changes).length) throw new ToolError('No risk fields were supplied to update.');
      const updated = ensure(await svc.from('risks').update(changes).eq('id', id).select('*').maybeSingle());
      return { risk: updated, message: 'Risk assessment updated.' };
    }

    case 'create_contact': {
      const category = enumValue(data.category, CONTACT_CATEGORIES, 'category');
      const studentId = optionalUuid(data.student_id, 'student_id');
      if (category === 'student' && !studentId) throw new ToolError('student_id is required for a guardian contact.');
      const row = {
        category,
        name: requiredText(data.name, 'name', 2, 255),
        relationship: optionalText(data.relationship, 100),
        role: optionalText(data.role, 100),
        phone: requiredText(data.phone, 'phone', 5, 50),
        email: text(data.email) ? (EMAIL_RE.test(text(data.email)) ? text(data.email).toLowerCase() : (() => { throw new ToolError('Enter a valid email address.'); })()) : null,
        student_id: category === 'student' ? studentId : null,
        priority: optionalInteger(data.priority, 'priority', 1, 99),
        address: optionalText(data.address, 1000),
        active: booleanValue(data.active, true),
      };
      const created = ensure(await svc.from('emergency_contacts').insert(row).select('*').single());
      return { contact: created, message: 'Emergency contact saved.' };
    }

    case 'update_contact': {
      const id = requiredUuid(data.id, 'contact id');
      const changes: Record<string, any> = {};
      if ('category' in data) changes.category = enumValue(data.category, CONTACT_CATEGORIES, 'category');
      if ('name' in data) changes.name = requiredText(data.name, 'name', 2, 255);
      if ('relationship' in data) changes.relationship = optionalText(data.relationship, 100);
      if ('role' in data) changes.role = optionalText(data.role, 100);
      if ('phone' in data) changes.phone = requiredText(data.phone, 'phone', 5, 50);
      if ('email' in data) {
        const email = text(data.email);
        changes.email = email ? (EMAIL_RE.test(email) ? email.toLowerCase() : (() => { throw new ToolError('Enter a valid email address.'); })()) : null;
      }
      if ('student_id' in data) changes.student_id = optionalUuid(data.student_id, 'student_id');
      if ('priority' in data) changes.priority = optionalInteger(data.priority, 'priority', 1, 99);
      if ('address' in data) changes.address = optionalText(data.address, 1000);
      if ('active' in data) changes.active = booleanValue(data.active, true);
      if (!Object.keys(changes).length) throw new ToolError('No contact fields were supplied to update.');
      const updated = ensure(await svc.from('emergency_contacts').update(changes).eq('id', id).select('*').maybeSingle());
      if (!updated) throw new ToolError('No emergency contact matches that id.', 404);
      return { contact: updated, message: 'Emergency contact updated.' };
    }

    case 'delete_record': {
      const table = text(data.table);
      if (!DELETABLE.includes(table)) throw new ToolError(`table must be one of: ${DELETABLE.join(', ')}.`);
      if (data.confirm !== true && text(data.confirm).toLowerCase() !== 'true') {
        throw new ToolError('Deleting a record requires explicit confirmation. Ask the administrator, then retry with confirm: true.', 409);
      }
      const id = requiredUuid(data.id, 'record id');
      const existing = ensure(await svc.from(table).select('*').eq('id', id).maybeSingle());
      if (!existing) throw new ToolError('No matching record was found.', 404);
      ensure(await svc.from(table).delete().eq('id', id));
      return { deleted: { table, record: existing }, message: 'Record deleted.' };
    }

    case 'send_notification': {
      const kind = text(data.kind);
      if (!['guardian', 'clinic', 'event'].includes(kind)) throw new ToolError('kind must be guardian, clinic, or event.');
      if (data.confirm !== true && text(data.confirm).toLowerCase() !== 'true') {
        throw new ToolError('Sending an email requires explicit confirmation. Ask the administrator, then retry with confirm: true.', 409);
      }
      const payload: Record<string, any> = {
        title: requiredText(data.title, 'title', 2, 255),
        message: requiredText(data.message, 'message', 5, 2000),
      };
      if (kind === 'guardian') {
        const broadcast = booleanValue(data.broadcast);
        if (!broadcast && !text(data.student_id)) throw new ToolError('student_id is required unless this is a campus-wide guardian alert.');
        payload.notif_type = 'incident_alert';
        payload.priority = 'urgent';
        payload.contact_method = 'email';
        payload.notify_all_parents = broadcast;
        if (!broadcast) payload.student_id = requiredUuid(data.student_id, 'student_id');
        if (text(data.related_incident_id)) payload.related_incident_id = requiredUuid(data.related_incident_id, 'related_incident_id');
      } else if (kind === 'clinic') {
        payload.notif_type = 'alert';
        payload.priority = 'urgent';
        payload.contact_method = 'email';
        payload.audience_group = optionalText(data.audience_group, 100) || 'Clinic Staff / Stock Custodians';
      } else {
        const start = text(data.event_start_at);
        const end = text(data.event_end_at);
        if (!start || !end || Number.isNaN(Date.parse(start)) || Number.isNaN(Date.parse(end)) || Date.parse(end) <= Date.parse(start)) {
          throw new ToolError('event_start_at and event_end_at must be valid ISO timestamps, with the end after the start.');
        }
        payload.notif_type = 'event_notice';
        payload.priority = 'informational';
        payload.contact_method = 'email';
        payload.audience_group = requiredText(data.audience_group, 'audience_group', 2, 100);
        payload.event_start_at = new Date(start).toISOString();
        payload.event_end_at = new Date(end).toISOString();
      }
      const result = await callFunction('send-notification', payload, actor, opts.key, opts.supabaseUrl, opts.serviceKey, fetchImpl);
      return {
        notification: result,
        message: result?.ok === false ? 'The notification was recorded but the email provider did not deliver it.' : 'Notification sent.',
      };
    }

    case 'account_create': {
      if (data.confirm !== true && text(data.confirm).toLowerCase() !== 'true') {
        throw new ToolError('Creating an account requires explicit confirmation. Ask the administrator, then retry with confirm: true.', 409);
      }
      const email = requiredText(data.email, 'email', 5, 254).toLowerCase();
      if (!EMAIL_RE.test(email)) throw new ToolError('Enter a valid email address.');
      const name = requiredText(data.name, 'name', 2, 120);
      const role = enumValue(data.role, ['admin', 'client'], 'role');
      const created = await callFunction('manage-accounts', {
        action: 'create', email, name, role, password: randomPassword(),
      }, actor, opts.key, opts.supabaseUrl, opts.serviceKey, fetchImpl);
      const user = created?.user || null;
      let invitationSent = false;
      let warning = '';
      try {
        const site = text(opts.siteUrl) || DEFAULT_SITE_URL;
        const { error } = await svc.auth.resetPasswordForEmail(email, { redirectTo: `${site.replace(/\/$/, '')}/?recovery=1` });
        if (error) throw error;
        invitationSent = true;
      } catch {
        warning = 'The account was created, but the password setup email could not be sent. Use account_send_reset to retry.';
      }
      return { user, student_id: user?.student_id || null, invitation_sent: invitationSent, ...(warning ? { warning } : {}), message: 'Account created.' };
    }

    case 'account_update': {
      if (data.confirm !== true && text(data.confirm).toLowerCase() !== 'true') {
        throw new ToolError('Updating an account requires explicit confirmation. Ask the administrator, then retry with confirm: true.', 409);
      }
      const id = requiredUuid(data.id, 'account id');
      const payload: Record<string, any> = { action: 'update', id };
      for (const key of ['email', 'name', 'role']) if (key in data) payload[key] = data[key];
      if (payload.email !== undefined) {
        payload.email = requiredText(payload.email, 'email', 5, 254).toLowerCase();
        if (!EMAIL_RE.test(payload.email)) throw new ToolError('Enter a valid email address.');
      }
      if (payload.name !== undefined) payload.name = requiredText(payload.name, 'name', 2, 120);
      if (payload.role !== undefined) payload.role = enumValue(payload.role, ['admin', 'client'], 'role');
      if (Object.keys(payload).length === 2) throw new ToolError('No account fields were supplied to update.');
      const updated = await callFunction('manage-accounts', payload, actor, opts.key, opts.supabaseUrl, opts.serviceKey, fetchImpl);
      return { user: updated?.user || null, message: 'Account updated.' };
    }

    case 'account_delete': {
      if (data.confirm !== true && text(data.confirm).toLowerCase() !== 'true') {
        throw new ToolError('Deleting an account requires explicit confirmation. Ask the administrator, then retry with confirm: true.', 409);
      }
      const id = requiredUuid(data.id, 'account id');
      const result = await callFunction('manage-accounts', { action: 'delete', id }, actor, opts.key, opts.supabaseUrl, opts.serviceKey, fetchImpl);
      return { result, message: 'Account deleted.' };
    }

    case 'account_send_reset': {
      if (data.confirm !== true && text(data.confirm).toLowerCase() !== 'true') {
        throw new ToolError('Sending a password setup email requires explicit confirmation. Ask the administrator, then retry with confirm: true.', 409);
      }
      const id = requiredUuid(data.id || data.account_id, 'account id');
      const { data: found, error } = await svc.auth.admin.getUserById(id);
      const user = found?.user;
      if (error || !user) throw new ToolError('Account not found.', 404);
      const email = text(user.email).toLowerCase();
      if (!email) throw new ToolError('That account has no email address.');
      const site = text(opts.siteUrl) || DEFAULT_SITE_URL;
      const { error: sendError } = await svc.auth.resetPasswordForEmail(email, { redirectTo: `${site.replace(/\/$/, '')}/?recovery=1` });
      if (sendError) throw new ToolError('The password setup email could not be sent.', 502);
      return { email, message: `Password setup email sent to ${email}.` };
    }

    default:
      throw new ToolError(`Unknown write action "${action}".`);
  }
}

export async function runAgentRequest(opts: AgentRequestOptions): Promise<AgentResponse> {
  const now = opts.now ?? Date.now();
  const body = opts.body;
  const token = opts.token || text(body?.token);
  let actor: any;
  try {
    actor = await actorFromToken(opts.svc, token, opts.key, now);
  } catch (error) {
    const status = error instanceof ToolError ? error.status : 401;
    return { status, body: { ok: false, error: (error as Error).message } };
  }

  const since = new Date(now - 60000).toISOString();
  if (await countSince(opts.svc, 'agent_audit_log', actor.id, since) >= 60) {
    return { status: 429, body: { ok: false, error: 'Too many assistant actions in one minute. Wait a moment and try again.' } };
  }

  const action = text(body?.action);
  if (!action) return { status: 400, body: { ok: false, error: 'action is required.' } };
  const isRead = (READ_ACTIONS as readonly string[]).includes(action);
  const isWrite = (WRITE_ACTIONS as readonly string[]).includes(action);
  if (!isRead && !isWrite) return { status: 400, body: { ok: false, error: `Unknown action "${action}".` } };

  const requestId = text(body?.request_id).slice(0, 120);
  if (isWrite && !requestId) {
    return { status: 400, body: { ok: false, error: 'request_id is required for write actions.' } };
  }
  let input: { action: string; filters?: Record<string, any>; data?: Record<string, any> };
  try {
    input = isRead
      ? { action, filters: objectArg(body?.filters, 'filters') }
      : { action, data: objectArg(body?.data, 'data') };
  } catch (error) {
    return { status: 400, body: { ok: false, error: (error as Error).message } };
  }
  const redacted = redact(input);
  const dedupeKey = isWrite && requestId ? `${action}#${await fingerprint(input.data)}` : action;

  if (isWrite) {
    const cached = await cachedResult(opts.svc, actor.id, requestId, dedupeKey);
    if (cached) return { status: 200, body: { ok: true, data: cached, replayed: true } };
  }

  try {
    const data = isRead
      ? await runRead(opts.svc, action, input.filters, actor, opts)
      : await runWrite(opts.svc, action, input.data, actor, opts);
    if (isWrite) await rememberResult(opts.svc, actor.id, requestId, dedupeKey, data);
    const recordId = data?.incident?.id || data?.drill?.id || data?.inspection?.id || data?.supply?.id
      || data?.risk?.id || data?.contact?.id || data?.user?.id || data?.notification?.id || null;
    await audit(opts.svc, {
      actor_id: actor.id,
      actor_email: text(actor.email) || null,
      tool: action,
      input: redacted,
      status: 'ok',
      record_id: recordId ? String(recordId) : null,
    });
    return { status: 200, body: { ok: true, data } };
  } catch (error) {
    const status = error instanceof ToolError ? error.status : 500;
    const message = error instanceof ToolError ? error.message : 'The assistant could not complete that action.';
    await audit(opts.svc, {
      actor_id: actor.id,
      actor_email: text(actor.email) || null,
      tool: action,
      input: redacted,
      status: 'error',
      error: message,
    });
    return { status, body: { ok: false, error: message } };
  }
}
