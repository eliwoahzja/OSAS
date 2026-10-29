// Isolated PostgreSQL regression; PGLITE_MODULE may point to a separate install.
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, raw_app_meta_data jsonb DEFAULT '{}', raw_user_meta_data jsonb DEFAULT '{}', created_at timestamptz DEFAULT now());
    CREATE TABLE public.users (id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, email text, role text NOT NULL, full_name text NOT NULL, created_at timestamptz DEFAULT now());
    INSERT INTO auth.users (id,email,raw_app_meta_data) VALUES
      ('11000000-0000-4000-8000-000000000001','existing@gmail.com','{"role":"client"}'),
      ('11000000-0000-4000-8000-000000000002','admin@gmail.com','{"role":"admin"}'),
      ('11000000-0000-4000-8000-000000000003','another@gmail.com','{"role":"client"}');
  `);
  for (const file of ['20261029100000_account_usernames.sql', '20261029110000_student_login_ids.sql']) {
    await db.exec(await readFile(new URL('../supabase/migrations/' + file, import.meta.url), 'utf8'));
  }
  const { rows } = await db.query('SELECT student_id, email FROM public.users ORDER BY id');
  const year = String(new Date().getFullYear()).slice(-2);
  assert.deepEqual(rows, [
    { student_id: `s${year}0000001`, email: 'existing@gmail.com' },
    { student_id: null, email: 'admin@gmail.com' },
    { student_id: `s${year}0000002`, email: 'another@gmail.com' },
  ]);
  await db.exec(await readFile(new URL('../supabase/tests/student_login_ids.sql', import.meta.url), 'utf8'));
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.users')).rows[0].n, 3);
  // Assign many students together; a sequence must be unique even within one statement.
  await db.exec(`INSERT INTO auth.users(id,email,raw_app_meta_data)
    SELECT gen_random_uuid(), 'batch-'||n||'@example.invalid', '{"role":"client"}'::jsonb FROM generate_series(1,100) n;`);
  const counts = (await db.query('SELECT count(student_id)::int AS ids, count(DISTINCT student_id)::int AS unique_ids FROM public.users')).rows[0];
  assert.equal(counts.ids, 102);
  assert.equal(counts.unique_ids, 102);
  await db.exec("DELETE FROM public.users WHERE email = 'existing@gmail.com'");
  await db.exec(await readFile(new URL('../supabase/migrations/20261029110100_backfill_missing_student_profiles.sql', import.meta.url), 'utf8'));
  const restored = (await db.query("SELECT student_id FROM public.users WHERE email = 'existing@gmail.com'")).rows[0];
  assert.match(restored.student_id, /^s\d{9}$/);
  assert.equal((await db.query("SELECT student_id FROM public.users WHERE email = 'another@gmail.com'")).rows[0].student_id, `s${year}0000002`);
  console.log('Student ID migration OK: short-format backfill, automatic registration, unique IDs, immutable mapping, admin exclusion, delayed Auth metadata, 100-account batch, and rolled-back fixtures.');
} finally { await db.close(); }
