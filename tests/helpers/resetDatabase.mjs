import { PGlite } from '@electric-sql/pglite'
import { readFile, readdir } from 'node:fs/promises'

// Real application schema and migrations, isolated in an in-memory PostgreSQL engine.
export const createResetDatabase = async () => {
  const db = new PGlite()
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage; create schema realtime;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text, is_anonymous boolean not null default false, raw_user_meta_data jsonb default '{}', created_at timestamptz default now());
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.role() returns text language sql as $$ select current_setting('request.jwt.claim.role',true) $$;
    create function auth.jwt() returns jsonb language sql as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb) $$;
    grant usage on schema auth to authenticated, anon;
    create table realtime.messages (id bigint generated always as identity primary key, topic text not null, extension text not null, payload jsonb not null default '{}'::jsonb);
    create function realtime.topic() returns text language sql as $$ select current_setting('realtime.topic',true) $$;
    create function realtime.send(jsonb,text,text,boolean default true) returns void language sql as $$
      insert into realtime.messages(topic,extension,payload) values ($3,'broadcast',$1);
    $$;
    alter table realtime.messages enable row level security;
    grant usage on schema realtime to authenticated, anon;
    grant select, insert on realtime.messages to authenticated, anon;
    grant usage on sequence realtime.messages_id_seq to authenticated, anon;
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
