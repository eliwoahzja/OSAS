// Isolated PostgreSQL regression for the agent gateway migration.
// Run with PGLITE_MODULE pointing at an installed @electric-sql/pglite build.
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
const sql = (path) => readFile(new URL('../supabase/' + path, import.meta.url), 'utf8');

try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT NULLIF(current_setting('test.uid', true), '')::uuid;
    $$;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
      SELECT COALESCE(NULLIF(current_setting('test.jwt', true), '')::jsonb, '{}'::jsonb);
    $$;
    CREATE TABLE auth.users (
      id uuid PRIMARY KEY,
      email text,
      raw_app_meta_data jsonb DEFAULT '{}',
      raw_user_meta_data jsonb DEFAULT '{}',
      created_at timestamptz DEFAULT now()
    );
    CREATE TABLE public.users (
      id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      email text,
      role text NOT NULL,
      full_name text NOT NULL
    );
    CREATE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql STABLE AS $$
      SELECT COALESCE(current_setting('test.is_admin', true), 'false')::boolean;
    $$;
    CREATE TABLE public.incidents (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      date date NOT NULL,
      description text NOT NULL,
      reporter text,
      type text,
      severity text,
      location text,
      student_id uuid,
      status text NOT NULL DEFAULT 'open',
      submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
    );
    INSERT INTO auth.users (id, email) VALUES
      ('11000000-0000-4000-8000-000000000001', 'admin@example.test'),
      ('11000000-0000-4000-8000-000000000002', 'staff@example.test');
  `);

  await db.exec(await sql('migrations/20261030120000_agent_gateway.sql'));

  for (const table of ['agent_audit_log', 'agent_requests', 'agent_chat_log']) {
    const row = (await db.query(`SELECT to_regclass('public.${table}') AS name`)).rows[0];
    assert.equal(row.name, table);
  }
  const policy = (await db.query(`SELECT policyname FROM pg_policies WHERE tablename = 'agent_audit_log'`)).rows;
  assert.ok(policy.some((row) => row.policyname === 'read_admin'));

  // The production database already has this trigger from the earlier
  // stakeholder migration; recreate it here so the attribution behavior is
  // exercised against the updated function.
  await db.exec(`CREATE TRIGGER osas_incident_submitter
    BEFORE INSERT OR UPDATE ON public.incidents
    FOR EACH ROW EXECUTE FUNCTION public.osas_attribute_incident_submitter();`);

  // A service-role insert may attribute the incident to the administrator who
  // approved it, because auth.uid() is null for the gateway.
  await db.exec(`SELECT set_config('test.uid', '', false);
    INSERT INTO public.incidents (date, description, submitted_by)
    VALUES ('2026-10-30', 'gateway-created', '11000000-0000-4000-8000-000000000001');`);
  const preserved = (await db.query(`SELECT submitted_by FROM public.incidents WHERE description = 'gateway-created'`)).rows[0];
  assert.equal(preserved.submitted_by, '11000000-0000-4000-8000-000000000001');

  // A browser insert is still attributed to the signed-in user and cannot
  // spoof another submitter, classification, location or status.
  await db.exec(`SELECT set_config('test.uid', '11000000-0000-4000-8000-000000000002', false);
    SELECT set_config('test.jwt', '{"email":"staff@example.test","user_metadata":{"name":"Staff Two"}}', false);
    INSERT INTO public.incidents (date, description, reporter, type, severity, location, status, submitted_by)
    VALUES ('2026-10-30', 'browser-created', 'Spoofed Reporter', 'fire-related', 'high', 'Spoofed Location', 'resolved', '11000000-0000-4000-8000-000000000001');`);
  const overridden = (await db.query(`SELECT submitted_by, reporter, type, severity, location, status FROM public.incidents WHERE description = 'browser-created'`)).rows[0];
  assert.equal(overridden.submitted_by, '11000000-0000-4000-8000-000000000002');
  assert.equal(overridden.reporter, 'Staff Two');
  assert.equal(overridden.type, null);
  assert.equal(overridden.severity, null);
  assert.equal(overridden.location, null);
  assert.equal(overridden.status, 'open');

  // Updates must not move attribution between accounts.
  await db.exec(`UPDATE public.incidents SET submitted_by = '11000000-0000-4000-8000-000000000001' WHERE description = 'browser-created';`);
  const unchanged = (await db.query(`SELECT submitted_by FROM public.incidents WHERE description = 'browser-created'`)).rows[0];
  assert.equal(unchanged.submitted_by, '11000000-0000-4000-8000-000000000002');

  console.log('agent gateway migration OK');
} finally {
  await db.close();
}
