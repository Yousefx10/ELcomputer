import { spawn, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, isAbsolute } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createServer } from 'node:net'
import { prepareResetDatabase } from './resetDatabase.mjs'

export const storageNativeAvailable = !!process.env.EMAIL_REVIEW_PG_BIN && !!process.env.EMAIL_REVIEW_PG_DRIVER && !!process.env.SUPAUTILS_REVIEW_LIBRARY

// Only a new owned loopback cluster is accepted. Storage is created under a
// synthetic owner from the outset; its ownership is never changed. Application
// schema/migrations use an actual non-superuser postgres login, without SET ROLE
// or membership in the Storage owner/bootstrap roles. No managed role is used.
export const createStorageNativeDatabase = async ({ stopBefore = '20261008120000_after_sales_claims_core.sql', onMigration = null, delegation = true, rls = true, conflict = false, partitioned = false } = {}) => {
  const bin = process.env.EMAIL_REVIEW_PG_BIN, library = process.env.SUPAUTILS_REVIEW_LIBRARY
  if (!isAbsolute(bin || '') || !isAbsolute(library || '') || !(await stat(library)).isFile()) throw Error('Absolute native PostgreSQL and Supautils library paths required.')
  const { default: pg } = await import(pathToFileURL(process.env.EMAIL_REVIEW_PG_DRIVER).href)
  const directory = await mkdtemp(join(tmpdir(), 'storage-audit-pg-')), clients = []
  const probe = createServer()
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve))
  const port = probe.address().port
  await new Promise(resolve => probe.close(resolve))
  let server, bootstrap, owner, executor, active, logs = ''
  const connect = async user => {
    const client = new pg.Client({ host: '127.0.0.1', port, user, database: 'postgres', connectionTimeoutMillis: 1000 })
    clients.push(client)
    await client.connect()
    await client.query("select set_config('statement_timeout','15s',false),set_config('request.jwt.claim.role',$1,false)", [user === 'postgres' ? 'service_role' : user])
    return client
  }
  const close = async () => {
    await Promise.allSettled(clients.map(client => client.end()))
    if (server && server.exitCode === null && server.signalCode === null) {
      await new Promise(resolve => { server.once('exit', resolve); server.kill('SIGTERM') })
    }
    await rm(directory, { recursive: true, force: true })
  }
  try {
    await promisify(execFile)(join(bin, 'initdb'), ['-D', directory, '-U', 'storage_audit', '-A', 'trust', '--no-sync', '--locale=C', '--encoding=UTF8'])
    server = spawn(join(bin, 'postgres'), ['-D', directory, '-h', '127.0.0.1', '-p', String(port), '-k', directory,
      '-c', 'session_preload_libraries=' + library,
      '-c', 'supautils.superuser=storage_audit',
      '-c', 'supautils.policy_grants=' + JSON.stringify({ postgres: ['realtime.messages', ...(delegation ? ['storage.objects', 'storage.buckets'] : [])] })], { stdio: ['ignore', 'ignore', 'pipe'] })
    server.stderr.on('data', chunk => { logs = (logs + chunk).slice(-5000) })
    for (let i = 0; i < 100 && !bootstrap; i++) {
      if (server.exitCode !== null || server.signalCode !== null) throw Error('Disposable PostgreSQL exited: ' + logs)
      try { bootstrap = await connect('storage_audit') } catch { await new Promise(resolve => setTimeout(resolve, 50)) }
    }
    if (!bootstrap) throw Error('Disposable PostgreSQL did not become ready: ' + logs)
    const preload = (await bootstrap.query('show session_preload_libraries')).rows[0].session_preload_libraries
    active = bootstrap
    await bootstrap.query('create role postgres login nosuperuser nocreaterole nocreatedb inherit bypassrls; create role fixture_storage_owner login nosuperuser nocreaterole nocreatedb noinherit nobypassrls; grant create on database postgres to postgres; grant usage,create on schema public to postgres;')
    const adapter = { exec: sql => active.query(sql), query: (sql, values) => active.query(sql, values) }
    await prepareResetDatabase(adapter, {
      stopBefore, onMigration,
      prepareStorage: async () => {
        await bootstrap.query('grant usage,create on schema storage to fixture_storage_owner; grant usage on schema storage to postgres,anon,authenticated,service_role;')
        owner = await connect('fixture_storage_owner')
        await owner.query(`
          create table storage.buckets (id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
          create table storage.objects (id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid) ${partitioned ? 'partition by hash(id)' : ''};
          ${rls ? 'alter table storage.objects enable row level security;' : ''}
          alter table storage.buckets enable row level security;
          create function storage.foldername(text) returns text[] language sql as $$ select string_to_array($1,'/') $$;
          grant all on storage.buckets,storage.objects to postgres,anon,authenticated,service_role;
          ${conflict ? 'create policy after_sales_evidence_server_boundary on storage.objects for select to anon using(true);' : ''}
        `)
      },
      onPlatformReady: async () => {
        await bootstrap.query('grant usage on schema auth,realtime to postgres; grant all on auth.users to postgres; alter role anon login; alter role authenticated login; alter role service_role login;')
        executor = await connect('postgres')
        active = executor
      }
    })
    return { ...adapter, owner, connect, close, directory, port, preload, version: (await executor.query('show server_version')).rows[0].server_version }
  } catch (error) { await close(); throw error }
}
