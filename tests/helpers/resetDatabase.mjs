import { PGlite } from '@electric-sql/pglite'
import { readFile, readdir } from 'node:fs/promises'

// Real application schema and migrations, isolated in an in-memory PostgreSQL engine.
export const createResetDatabase = async () => {
  const db = new PGlite()
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}', created_at timestamptz default now());
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.role() returns text language sql as $$ select current_setting('request.jwt.claim.role',true) $$;
    create function auth.jwt() returns jsonb language sql as $$ select '{}'::jsonb $$;
    create table storage.buckets (id text primary key,name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid);
    create function storage.foldername(text) returns text[] language sql as $$ select string_to_array($1,'/') $$;
  `)
  await db.exec(await readFile(new URL('../../supabase/backups/schema.sql', import.meta.url), 'utf8'))
  const migrations = new URL('../../supabase/migrations/', import.meta.url)
  for (const name of (await readdir(migrations)).filter(name => name.endsWith('.sql')).sort()) {
    await db.exec(await readFile(new URL(name, migrations), 'utf8'))
  }
  return db
}
