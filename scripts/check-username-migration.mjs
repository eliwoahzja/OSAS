// Optional isolated PostgreSQL check. Point PGLITE_MODULE at an installed
// @electric-sql/pglite/dist/index.js; this never contacts the live project.
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, raw_app_meta_data jsonb DEFAULT '{}', raw_user_meta_data jsonb DEFAULT '{}', created_at timestamptz DEFAULT now());
    CREATE TABLE public.users (id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, email text, role text NOT NULL, full_name text NOT NULL, created_at timestamptz DEFAULT now());
    INSERT INTO auth.users (id, email) VALUES
      ('11000000-0000-4000-8000-000000000001', 'reyes@gmail.com'),
      ('11000000-0000-4000-8000-000000000002', 'reyes@saac.edu.ph'),
      ('11000000-0000-4000-8000-000000000003', '+@example.test');
    INSERT INTO public.users (id, email, full_name, role)
      VALUES ('11000000-0000-4000-8000-000000000001', 'reyes@gmail.com', 'Existing Profile', 'staff');
  `);
  await db.exec(await readFile(new URL('../supabase/migrations/20261029100000_account_usernames.sql', import.meta.url), 'utf8'));
  const { rows } = await db.query('SELECT username, email FROM public.users ORDER BY id');
  assert.deepEqual(rows, [
    { username: 'reyes', email: 'reyes@gmail.com' },
    { username: 'reyes-1', email: 'reyes@saac.edu.ph' },
    { username: 'account', email: '+@example.test' },
  ]);
  await db.exec(await readFile(new URL('../supabase/tests/account_usernames.sql', import.meta.url), 'utf8'));
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.users')).rows[0].n, 3);
  console.log('Username migration OK: existing profiles, missing profiles, collision-safe backfill, stable emails, uniqueness, validation, trusted rename, and rollback.');
} finally {
  await db.close();
}
