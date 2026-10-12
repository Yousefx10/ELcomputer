import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { execFile, spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { randomBytes,createHmac } from 'node:crypto'
import { promisify } from 'node:util'
import { join } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { createStorageNativeDatabase } from './storageNativeDatabase.mjs'

// Laboratory only: every connection derives from a cluster created by this
// process. No URL, existing cluster, hosted project or dotenv is accepted.
export async function createCleanBaselineLab() {
  const executed=[]
  const source = await createStorageNativeDatabase({ stopBefore: '20261012120001',onMigration:name=>executed.push(name) })
  const { default: pg } = await import(pathToFileURL(process.env.EMAIL_REVIEW_PG_DRIVER).href)
  const clients = []
  const connect = async (database, user = 'postgres') => {
    if (!['postgres', 'clean_candidate'].includes(database)) throw Error('Unknown owned laboratory database.')
    const client = new pg.Client({ host: '127.0.0.1', port: source.port, database, user, password: '', ssl: false, connectionTimeoutMillis: 2000 })
    clients.push(client)
    await client.connect()
    await client.query("select set_config('statement_timeout','60s',false),set_config('request.jwt.claim.role',$1,false)", [user === 'postgres' ? 'service_role' : user])
    return client
  }
  try {
    const bootstrap = await connect('postgres', 'storage_audit')
    await bootstrap.query('create database clean_candidate owner postgres')
    const platform = await connect('clean_candidate', 'storage_audit')
    await platform.query(`
      create schema auth; create schema storage; create schema realtime;
      create table auth.users (id uuid primary key default gen_random_uuid(), email text, is_anonymous boolean not null default false, raw_app_meta_data jsonb default '{}', email_confirmed_at timestamptz, raw_user_meta_data jsonb default '{}', created_at timestamptz default now());
      create function auth.uid() returns uuid language sql as $$ select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
      create function auth.role() returns text language sql as $$ select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role') $$;
      create function auth.jwt() returns jsonb language sql as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb) $$;
      grant usage on schema auth to postgres,anon,authenticated;
      grant all on auth.users to postgres;
      create table realtime.messages (id bigint generated always as identity primary key, topic text not null, extension text not null, payload jsonb not null default '{}'::jsonb);
      create function realtime.topic() returns text language sql as $$ select current_setting('realtime.topic',true) $$;
      create function realtime.send(jsonb,text,text,boolean default true) returns void language sql as $$ insert into realtime.messages(topic,extension,payload) values ($3,'broadcast',$1) $$;
      alter table realtime.messages enable row level security;
      grant usage on schema realtime to postgres,anon,authenticated;
      grant select,insert on realtime.messages to anon,authenticated;
      grant usage on sequence realtime.messages_id_seq to anon,authenticated;
      grant usage,create on schema storage to fixture_storage_owner;
      grant usage on schema storage to postgres,anon,authenticated,service_role;
    `)
    const storage = await connect('clean_candidate', 'fixture_storage_owner')
    await storage.query(`
      create table storage.buckets (id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects (id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid);
      alter table storage.objects enable row level security;
      alter table storage.buckets enable row level security;
      create function storage.foldername(text) returns text[] language sql as $$ select string_to_array($1,'/') $$;
      grant all on storage.buckets,storage.objects to postgres,anon,authenticated,service_role;
    `)
    const candidate = await connect('clean_candidate')
    return {
      source, candidate, storage, connect,executed,
      async dump() {
        const { stdout } = await promisify(execFile)(join(process.env.EMAIL_REVIEW_PG_BIN, 'pg_dump'), [
          '-h', '127.0.0.1', '-p', String(source.port), '-U', 'postgres', '-d', 'postgres',
          '--schema-only', '--schema=public', '--no-owner', '--no-privileges', '--no-comments', '--no-security-labels'
        ], { maxBuffer: 16 * 1024 * 1024, env: { PATH: process.env.PATH, LANG: 'C', PGSSLMODE: 'disable' } })
        // Preserve every function-body byte, including comments/blank lines.
        return stdout.replace(/^\\(?:un)?restrict .*\n/gm, '').replace(/^CREATE SCHEMA public;\n/gm, '')
      },
      async cli(args, names) {
        const project = join(source.directory, 'baseline-runner')
        const migrations = join(project, 'supabase/migrations')
        await mkdir(migrations, { recursive: true })
        await writeFile(join(project, 'supabase/config.toml'), 'project_id = "clean-baseline-laboratory"\n')
        for (const name of names) await writeFile(join(migrations, name), await readFile(new URL('../../supabase/migrations/' + name, import.meta.url)))
        const cli = fileURLToPath(new URL('../../node_modules/.bin/supabase', import.meta.url))
        if (args.some(arg=>['--linked','--db-url','--workdir','--local','--include-all','--include-seed'].includes(arg)) || !['migration repair','db push'].includes(args.slice(0,2).join(' '))) throw Error('Only explicit owned-laboratory history/upgrade commands are allowed.')
        if(args[0]==='migration' && (args.at(-2)!=='--status'||args.at(-1)!=='applied'||args.slice(2,-2).length!==70||new Set(args.slice(2,-2)).size!==70||args.slice(2,-2).some(v=>!/^\d{14}$/.test(v))))throw Error('Exactly 70 explicit applied versions are required; blind/reverted repair is forbidden.')
        if(args[0]==='db' && args.slice(2).some(v=>!['--dry-run','--yes'].includes(v)))throw Error('Unsupported laboratory push option.')
        const childEnv={ PATH: process.env.PATH, PGSSLMODE: 'disable', DO_NOT_TRACK: '1', LANG: 'C', DYLD_LIBRARY_PATH: process.env.DYLD_LIBRARY_PATH || '' }
        const version=await promisify(execFile)(cli,['--version'],{cwd:project,env:childEnv})
        if(version.stdout.trim()!=='2.109.1')throw Error('Pinned Supabase CLI 2.109.1 required.')
        return promisify(execFile)(cli, ['--workdir', project, '--agent', 'no', ...args,
          '--db-url', `postgresql://postgres@127.0.0.1:${source.port}/clean_candidate?sslmode=disable`], {
          timeout: 45000, maxBuffer: 8 * 1024 * 1024, cwd:project,env:childEnv
        })
      },
      async close() { await Promise.allSettled(clients.map(c => c.end())); await source.close() }
    }
  } catch (error) { await Promise.allSettled(clients.map(c => c.end())); await source.close(); throw error }
}

export async function startCandidateRest(lab) {
  const bootstrap=await lab.connect('clean_candidate','storage_audit')
  await bootstrap.query('create role clean_lab_authenticator login noinherit; grant anon,authenticated,service_role to clean_lab_authenticator;')
  const probe=createServer()
  await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve))
  const port=probe.address().port
  await new Promise(resolve=>probe.close(resolve))
  const secret=randomBytes(32).toString('hex'), config=join(lab.source.directory,'clean-postgrest.conf')
  await writeFile(config,`db-uri = "postgresql://clean_lab_authenticator@127.0.0.1:${lab.source.port}/clean_candidate"\ndb-schemas = "public"\ndb-anon-role = "anon"\nserver-host = "127.0.0.1"\nserver-port = ${port}\njwt-secret = "${secret}"\ndb-pool = 2\n`,{mode:0o600})
  const server=spawn(process.env.CATALOG_REVIEW_POSTGREST_BIN,[config],{stdio:['ignore','ignore','pipe'],env:{PATH:process.env.PATH,DYLD_LIBRARY_PATH:process.env.DYLD_LIBRARY_PATH||''}})
  let logs=''
  server.stderr.on('data',chunk=>{logs=(logs+chunk).slice(-1500)})
  const close=async()=>{
    if(server.exitCode===null&&server.signalCode===null){const ended=new Promise(resolve=>server.once('exit',resolve));server.kill('SIGTERM');await ended}
  }
  const request=async(path,{role=null,subject=null,method='GET',body}={})=>{
    const headers={'content-type':'application/json'}
    if(role){
      const payload=Buffer.from(JSON.stringify({role,sub:subject,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')
      const signed=Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')+'.'+payload
      headers.authorization='Bearer '+signed+'.'+createHmac('sha256',secret).update(signed).digest('base64url')
    }
    const response=await fetch(`http://127.0.0.1:${port}`+path,{method,headers,...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(3000)})
    return {status:response.status,body:await response.json()}
  }
  try{
    for(let i=0;i<100;i++){
      try{if((await request('/storefront_products?select=id')).status===200)return{request,close}}catch{}
      if(server.exitCode!==null||server.signalCode!==null)throw Error('Owned PostgREST stopped: '+logs)
      await new Promise(resolve=>setTimeout(resolve,50))
    }
    throw Error('Owned PostgREST readiness failed.')
  }catch(error){await close();throw error}
}
