// Isolated PostgreSQL regression; PGLITE_MODULE may point to a separate install.
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
const sql = (path) => readFile(new URL('../supabase/' + path, import.meta.url), 'utf8');
const finalMigration = 'migrations/20261029133532_all_account_student_ids.sql';
try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, raw_app_meta_data jsonb DEFAULT '{}', raw_user_meta_data jsonb DEFAULT '{}', created_at timestamptz DEFAULT now());
    CREATE TABLE public.users (id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, email text, role text NOT NULL CHECK(role IN ('admin','staff')), full_name text NOT NULL, created_at timestamptz DEFAULT now());
    INSERT INTO auth.users (id,email,raw_app_meta_data) VALUES
      ('11000000-0000-4000-8000-000000000001','existing@gmail.com','{"role":"client"}'),
      ('11000000-0000-4000-8000-000000000002','admin@gmail.com','{"role":"admin"}'),
      ('11000000-0000-4000-8000-000000000003','another@gmail.com','{"role":"client"}');
  `);
  for (const file of ['20261029100000_account_usernames.sql', '20261029110000_student_login_ids.sql', '20261029110100_backfill_missing_student_profiles.sql']) {
    await db.exec(await sql('migrations/' + file));
  }
  const initial = (await db.query('SELECT id, student_id, email, username, full_name, role FROM public.users ORDER BY id')).rows;
  assert.equal(initial.filter((row) => row.student_id).length, 2);
  // Reproduce a legacy account whose public profile was manually removed.
  await db.exec(`INSERT INTO auth.users(id,email,raw_app_meta_data)
    VALUES ('11000000-0000-4000-8000-000000000004','legacy@example.invalid','{"role":"legacy"}');
    DELETE FROM public.users WHERE email='legacy@example.invalid';
    SELECT setval('public.osas_student_id_sequence',1,false);`);
  // The sequence rewind above is confined to this disposable database and
  // verifies that restored sequences cannot collide with already issued IDs.
  await db.exec(await sql(finalMigration));
  const migrated = (await db.query('SELECT id, student_id, email, username, full_name, role FROM public.users ORDER BY id')).rows;
  assert.equal(migrated.length, 4);
  for (const original of initial) {
    const current = migrated.find((row) => row.id === original.id);
    for (const field of ['id', 'email', 'username', 'full_name', 'role']) assert.equal(current[field], original[field]);
    if (original.student_id) assert.equal(current.student_id, original.student_id);
  }
  for (const row of migrated) assert.match(row.student_id, /^s\d{9}$/);
  assert.equal(new Set(migrated.map((row) => row.student_id)).size, 4);
  assert.equal(migrated.find((row) => row.email === 'admin@gmail.com').role, 'admin');
  assert.equal(migrated.find((row) => row.email === 'legacy@example.invalid').role, 'staff');

  await db.exec(await sql('tests/student_login_ids.sql'));
  await db.exec(await sql('tests/all_account_student_ids.sql'));
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.users')).rows[0].n, 4);
  // Assign a mixed-role batch; IDs must also be unique within one statement.
  await db.exec(`INSERT INTO auth.users(id,email,raw_app_meta_data)
    SELECT gen_random_uuid(), 'batch-'||n||'@example.invalid',
      jsonb_build_object('role', CASE WHEN n % 2 = 0 THEN 'admin' ELSE 'client' END)
    FROM generate_series(1,100) n;`);
  const counts = (await db.query('SELECT count(student_id)::int AS ids, count(DISTINCT student_id)::int AS unique_ids FROM public.users')).rows[0];
  assert.equal(counts.ids, 104);
  assert.equal(counts.unique_ids, 104);
  const beforeRerun = (await db.query('SELECT * FROM public.users ORDER BY id')).rows;
  await db.exec(await sql(finalMigration));
  assert.deepEqual((await db.query('SELECT * FROM public.users ORDER BY id')).rows, beforeRerun);
  assert.equal((await db.query("SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='student_id'")).rows[0].is_nullable, 'NO');
  const permissions = (await db.query("SELECT has_function_privilege('anon','public.osas_assign_student_id()','EXECUTE') AS anon, has_function_privilege('authenticated','public.osas_assign_student_id()','EXECUTE') AS authenticated")).rows[0];
  assert.deepEqual(permissions, { anon: false, authenticated: false });
  console.log('Student ID migration OK: all four migrations, every account role, missing profile repair, two issued IDs preserved, stale sequence collision skipped, immutable mapping, delayed Auth metadata, 100-account mixed-role batch, stable rerun, and rolled-back fixtures.');
} finally { await db.close(); }
