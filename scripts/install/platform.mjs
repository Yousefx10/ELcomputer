import pg from 'pg'
import https from 'node:https'
import { isIP } from 'node:net'
import { createRequire } from 'node:module'
import { createReadStream } from 'node:fs'
import { createHash } from 'node:crypto'
import { readFile, mkdir, writeFile, realpath, unlink } from 'node:fs/promises'
import { resolve, join, dirname } from 'node:path'
import { spawn, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { hash } from '../lib/cleanBaseline.mjs'
import { ensure, fail, sourceRoot, cliVersion, migration71 } from './contracts.mjs'
import { readProtected, validateLaboratory, privateDirectory, writeAtomic } from './files.mjs'
import { refreshPolicy } from '../lib/targetPolicy.mjs'
import {loadRelease79,release79Descriptor} from '../lib/release79Certification.mjs'

async function binaryHash(path){const digest=createHash('sha256');for await(const bytes of createReadStream(path))digest.update(bytes);return digest.digest('hex')}
async function pinnedBinary(){
  const require=createRequire(resolve(sourceRoot,'package.json'))
  const suffix=process.platform+'-'+process.arch
  ensure(['darwin-x64','darwin-arm64','linux-x64','linux-arm64'].includes(suffix),'platform_unavailable')
  let packagePath
  for(const candidate of [suffix,...(process.platform==='linux'?[suffix+'-musl']:[])])try{packagePath=require.resolve('@supabase/cli-'+candidate+'/package.json');break}catch{}
  ensure(packagePath,'platform_unavailable')
  ensure(JSON.parse(await readFile(packagePath)).version===cliVersion,'source_changed')
  return realpath(join(dirname(packagePath),'bin/supabase'))
}

export async function connectPlatform(target,credentials,{mutating=false}={}) {
  await refreshPolicy(target)
  await validateLaboratory(target)
  const ca=await readProtected(target.database.ca_file,{json:false,privateMode:false}),apiCa=target.api_ca_file?await readProtected(target.api_ca_file,{json:false,privateMode:false}):undefined
  const controller=new AbortController()
  const db=new pg.Client({host:target.database.host,port:target.database.port,database:target.database.name,user:target.database.user,password:credentials.database_password,ssl:{ca,rejectUnauthorized:true,...(isIP(target.database.host)?{}:{servername:target.database.host}),minVersion:'TLSv1.2'},connectionTimeoutMillis:5000,application_name:'elcomputer-fresh-install'})
  let locked=false,closed=false,identity,apiFingerprint=null
  const lease=()=>ensure(!closed&&!controller.signal.aborted,'stage_uncertain')
  db.on('error',()=>{closed=true;controller.abort()});db.on('end',()=>{closed=true;controller.abort()})
  try {
    await db.connect()
    await db.query("set statement_timeout='60s';set lock_timeout='10s';set search_path=pg_catalog;select set_config('request.jwt.claim.role','service_role',false)")
    const metadata=(await db.query("select session_user,current_user,current_database() database,host(inet_server_addr()) server_address,inet_server_port() server_port,current_setting('server_version_num') version,pg_is_in_recovery() recovery,(select ssl from pg_stat_ssl where pid=pg_backend_pid()) ssl")).rows[0]
    ensure(metadata.session_user==='postgres' && metadata.current_user==='postgres' && metadata.database==='postgres' && metadata.ssl && !metadata.recovery && Number(metadata.version)>=170000 && Number(metadata.version)<180000,'platform_unavailable')
    const role=(await db.query('select rolsuper,rolcreaterole,rolcreatedb from pg_roles where rolname=current_user')).rows[0]
    ensure(!role.rolsuper,'platform_unavailable')
    const peer=db.connection.stream.getPeerCertificate()
    ensure(peer.raw && db.connection.stream.authorized,'target_changed')
    const extensions=(await db.query('select e.extname name,e.extversion version,n.nspname schema from pg_extension e join pg_namespace n on n.oid=e.extnamespace order by 1')).rows
    // Freeze managed prerequisites separately; no new public extension is hidden.
    const platformExtensions=extensions.filter(extension=>extension.name!=='plpgsql')
    ensure(platformExtensions.every(extension=>['extensions','vault','pg_catalog','graphql'].includes(extension.schema)),'platform_unavailable')
    const supautils=(await db.query("select setting,context from pg_settings where name='supautils.policy_grants'")).rows[0]
    ensure(supautils?.context==='sighup','platform_unavailable')
    const managed=(await db.query("select n.nspname schema,c.relname name,pg_get_userbyid(c.relowner) owner,c.relacl::text acl,c.relrowsecurity rls,c.relforcerowsecurity force_rls,pg_has_role(current_user,c.relowner,'MEMBER') operator_member from pg_class c join pg_namespace n on n.oid=c.relnamespace where (n.nspname,c.relname) in (('auth','users'),('storage','objects'),('storage','buckets'),('realtime','messages')) order by 1,2")).rows
    ensure(managed.length===4 && managed.every(row=>row.owner!=='postgres'&&!row.operator_member) && managed.find(row=>row.schema==='storage'&&row.name==='objects')?.rls && managed.find(row=>row.schema==='realtime')?.rls,'platform_unavailable')
    if(target.profile==='owned-laboratory')ensure((await db.query("select current_setting('elcomputer.laboratory_id',true) id")).rows[0].id===target.laboratory.instance_id,'target_changed')
    const publicNamespace=(await db.query("select pg_get_userbyid(nspowner) owner,nspacl::text acl from pg_namespace where nspname='public'")).rows[0]
    // Keep the historical identity format byte-compatible. New release plans
    // separately freeze namespace and managed ACLs as additional evidence.
    const securityIdentity={public_namespace:publicNamespace,managed_acls:managed.map(({schema,name,acl})=>({schema,name,acl}))}
    identity={...metadata,operator_role_flags:role,managed_objects:managed.map(({acl,...row})=>row),tls_peer_sha256:hash(peer.raw),database_ca_sha256:hash(ca),api_ca_sha256:apiCa?hash(apiCa):null,platform_extensions:platformExtensions,supautils_policy_grants:supautils.setting}
    const method=mutating?'pg_try_advisory_lock':'pg_try_advisory_lock_shared'
    const result=(await db.query(`select ${method}(hashtextextended('elcomputer-install:database',0)) acquired`)).rows[0]
    ensure(result.acquired,'lock_busy');locked=true
    ensure((await db.query(`select ${method}(hashtextextended($1,0)) acquired`,['elcomputer-install:'+target.installation_id])).rows[0].acquired,'lock_busy')
    const base=new URL(target.api_url)
    const transport=async(input,options={})=>{
      await refreshPolicy(target)
      lease()
      const url=new URL(typeof input==='string'?input:input.url)
      ensure(url.origin===base.origin && url.pathname.startsWith(base.pathname.replace(/\/$/,'')+'/') && /^\/(?:projects\/[a-z0-9]{20}\/)?(?:auth\/v1|storage\/v1|rest\/v1)(?:\/|$)/.test(url.pathname),'target_changed')
      const headers=Object.fromEntries(new Headers(options.headers).entries())
      if(options.body!=null){ensure(typeof options.body==='string'||options.body instanceof Uint8Array);delete headers['transfer-encoding'];headers['content-length']=String(Buffer.byteLength(options.body))}
      return new Promise((resolveResponse,reject)=>{
        const request=https.request(url,{method:options.method||'GET',headers,agent:false,ca:apiCa,rejectUnauthorized:true,minVersion:'TLSv1.2',signal:controller.signal,timeout:15000},response=>{
          const certificate=response.socket.getPeerCertificate()
          if(!response.socket.authorized||!certificate.raw){response.resume();reject(Error('TLS identity unavailable'));return}
          const fingerprint=hash(certificate.raw)
          if(apiFingerprint&&fingerprint!==apiFingerprint){response.resume();reject(Error('API TLS identity changed'));return}
          apiFingerprint=fingerprint
          if(response.statusCode>=300&&response.statusCode<400){response.resume();reject(Error('Redirect refused'));return}
          const chunks=[];let size=0
          response.on('data',chunk=>{size+=chunk.length;if(size>4*1024*1024)response.destroy();else chunks.push(chunk)})
          response.on('error',reject);response.on('end',()=>{try{resolveResponse(new Response([204,205,304].includes(response.statusCode)?null:Buffer.concat(chunks),{status:response.statusCode,headers:response.headers}))}catch{reject(Error('API response unavailable'))}})
        })
        request.on('timeout',()=>request.destroy());request.on('error',reject)
        if(options.body)request.write(options.body)
        request.end()
      })
    }
    const client=createClient(target.api_url,credentials.service_role_key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:transport}})
    const anon=createClient(target.api_url,credentials.anon_key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:transport}})
    const settingsResponse=await transport(target.api_url+'/auth/v1/settings',{headers:{apikey:credentials.anon_key,authorization:'Bearer '+credentials.anon_key}})
    ensure(settingsResponse.ok,'platform_unavailable')
    const authSettings=await settingsResponse.json()
    ensure(authSettings.disable_signup===true && authSettings.external?.anonymous_users===false,'platform_unavailable')
    const restResponse=await transport(target.api_url+'/rest/v1/',{headers:{apikey:credentials.anon_key,authorization:'Bearer '+credentials.anon_key}})
    ensure(restResponse.ok,'platform_unavailable')
    const users=await client.auth.admin.listUsers({page:1,perPage:2}),buckets=await client.storage.listBuckets()
    ensure(!users.error && !buckets.error,'platform_unavailable')
    identity.api_tls_peer_sha256=apiFingerprint
    // Run the pinned native package directly. Killing the npm Node wrapper
    // could otherwise leave its synchronous binary child holding a SQL lease.
    const cli=await pinnedBinary()
    const toolHash=await binaryHash(cli)
    const childEnv={PATH:process.env.PATH,LANG:'C',DO_NOT_TRACK:'1',DYLD_LIBRARY_PATH:process.env.DYLD_LIBRARY_PATH||''}
    ensure((await promisify(execFile)(cli,['--version'],{env:childEnv,cwd:dirnameForSource()})).stdout.trim()===cliVersion,'source_changed')
    identity.cli_binary_sha256=toolHash
    return {db,client,anon,identity,securityIdentity,lease,transport,async close(){controller.abort();if(locked&&!closed)try{await db.query('select pg_advisory_unlock_all()')}catch{}await db.end().catch(()=>{})},
      async cli(workspace,inventory,{repairVersions=null,dryRun=false,migrationHash,followOn=[]}={}) {
        await refreshPolicy(target)
        lease();ensure(mutating || dryRun,'invalid_input');await privateDirectory(workspace)
        const known=new Set(inventory.map(row=>row.version))
        if(repairVersions)ensure(repairVersions.length>0&&repairVersions.length<=70&&new Set(repairVersions).size===repairVersions.length&&repairVersions.every(version=>known.has(version)),'history_uncertain')
        if(followOn.length){
          ensure(!repairVersions&&followOn.length<=8,'history_uncertain')
          const approved=release79Descriptor(await loadRelease79()).normal_migrations.slice(1,followOn.length+1)
          ensure(JSON.stringify(followOn)===JSON.stringify(approved),'source_changed')
          const plan=await readProtected(join(workspace,'plan.json'))
          ensure(plan.engine===2&&JSON.stringify(plan.source.release)===JSON.stringify(release79Descriptor(await loadRelease79())),'source_changed')
        }
        const directory=join(workspace,'cli-'+randomUUID()),migrations=join(directory,'supabase/migrations')
        await mkdir(migrations,{recursive:true,mode:0o700})
        await writeFile(join(directory,'supabase/config.toml'),'project_id = "elcomputer-fresh-install"\n',{mode:0o600})
        for(const name of [...inventory.map(row=>row.filename),migration71,...followOn.map(r=>r.filename)]){
          const bytes=await readFile(resolve(sourceRoot,'supabase/migrations',name))
          ensure(hash(bytes)===(name===migration71?migrationHash:inventory.find(row=>row.filename===name)?.sha256||followOn.find(row=>row.filename===name)?.sha256),'source_changed')
          await writeFile(join(migrations,name),bytes,{mode:0o600})
        }
        const passfile=join(directory,'database.pgpass')
        const escape=value=>String(value).replaceAll('\\','\\\\').replaceAll(':','\\:')
        await writeFile(passfile,[target.database.host,target.database.port,'postgres','postgres',credentials.database_password].map(escape).join(':')+'\n',{mode:0o600})
        const dbUrl=new URL(`postgresql://postgres@${target.database.host}:${target.database.port}/postgres`)
        dbUrl.searchParams.set('sslmode','verify-full');dbUrl.searchParams.set('sslrootcert',target.database.ca_file)
        const args=['--workdir',directory,'--agent','no',...(repairVersions?['migration','repair',...repairVersions,'--status','applied']:['db','push',dryRun?'--dry-run':'--yes']),'--db-url',dbUrl.href]
        try{
          ensure(await binaryHash(cli)===identity.cli_binary_sha256,'source_changed')
          await new Promise((resolveChild,reject)=>{
            const specFile=join(directory,'supervisor.json')
            const child=spawn(process.execPath,[resolve(sourceRoot,'scripts/install/cli-supervisor.mjs'),specFile],{cwd:directory,env:childEnv,stdio:['ignore','ignore','ignore','ipc'],signal:controller.signal})
            child.on('error',reject);child.on('exit',code=>code===0?resolveChild():reject(Error('CLI stage failed')))
            child.once('spawn',async()=>{
              try{
                const plan=await readProtected(join(workspace,'plan.json'))
                ensure(plan.target.installation_id===target.installation_id,'target_changed')
                await writeAtomic(directory,'supervisor.json',{format:1,nonce:randomUUID(),parent_pid:process.pid,supervisor_pid:child.pid,installation_id:target.installation_id,plan_digest:plan.plan_digest,cli_binary_sha256:identity.cli_binary_sha256,executable:cli,args},{exclusive:true})
                lease();child.send('start')
              }catch{child.kill('SIGTERM');reject(Error('CLI authorization failed'))}
            })
          })
          lease()
        }catch{fail('stage_uncertain')}finally{await unlink(passfile).catch(()=>{})}
      }
    }
  }catch(error){controller.abort();await db.end().catch(()=>{});if(error.code&&error.constructor.name==='InstallationError')throw error;fail('platform_unavailable')}
}
const dirnameForSource=()=>sourceRoot
