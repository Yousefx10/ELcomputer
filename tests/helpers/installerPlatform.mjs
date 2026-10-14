// Owned native platform. Official Auth/Storage migrations and HTTP services,
// real TLS/SCRAM, non-superuser operator, Supautils and PostgREST. No hosted URL.
import { mkdtemp, writeFile, readFile, chmod, realpath, rm, mkdir, cp, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { spawn, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createServer as tcpServer } from 'node:net'
import { createServer as tlsServer } from 'node:https'
import http from 'node:http'
import { randomUUID, randomBytes, createHmac } from 'node:crypto'
import pg from 'pg'
import { sourceRoot } from '../../scripts/install/contracts.mjs'

const run=promisify(execFile),tools=process.env.INSTALLER_REVIEW_SERVICE_TOOLS || '/private/tmp/elcomputer-install-service-tools'
const freePort=async()=>{const server=tcpServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const port=server.address().port;await new Promise(resolve=>server.close(resolve));return port}
const node=process.env.INSTALLER_REVIEW_NODE_BIN || '/private/tmp/elcomputer-preflight-20261010/node22/node-v22.23.1-darwin-x64/bin/node'
export const installerEnvironment={PATH:dirname(node)+':/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin',LANG:'C',DYLD_LIBRARY_PATH:process.env.DYLD_LIBRARY_PATH || ''}
export const installerNativeAvailable=!!process.env.EMAIL_REVIEW_PG_BIN&&!!process.env.SUPAUTILS_REVIEW_LIBRARY
export async function installerSourceCopy({extraFiles=[],release79=false}={}) {
  const directory=await realpath(await mkdtemp(join(tmpdir(),'elcomputer-install-source-')))
  const {stdout}=await run('git',['ls-files','-z'],{cwd:sourceRoot,env:installerEnvironment,maxBuffer:2*1024*1024})
  // Regression fixtures exercise the frozen, certified 1-71 installer.
  // Release79 tests opt into the separate certificate. Historical fixtures
  // continue exercising the unchanged 1-71 source membership and authority.
  // These are historical certificate fixtures, not certification of later SQL.
  const lastMigration=release79?'20261014200000_system_reset_compatibility.sql':'20261012160000_quick_setup_installation_bootstrap.sql'
  const names=stdout.split('\0').filter(name=>name &&
    !(name.startsWith('supabase/migrations/') && name.endsWith('.sql') &&
      name>'supabase/migrations/'+lastMigration))
  const newNames=['scripts/lib/targetPolicy.mjs','scripts/elcomputer-setup.mjs','scripts/guided/state.mjs','scripts/guided/workflow.mjs','scripts/elcomputer-install.mjs','scripts/install/contracts.mjs','scripts/install/files.mjs','scripts/install/platform.mjs','scripts/install/verify.mjs','scripts/install/workflow.mjs','scripts/install/cli-supervisor.mjs']
  for(const name of new Set([...names,...newNames,...extraFiles])){
    const destination=join(directory,name);await mkdir(resolve(destination,'..'),{recursive:true});await cp(join(sourceRoot,name),destination)
  }
  await symlink(join(sourceRoot,'node_modules'),join(directory,'node_modules'))
  await run('git',['init','-q'],{cwd:directory,env:installerEnvironment})
  await run('git',['add','.'],{cwd:directory,env:installerEnvironment})
  await run('git',['-c','user.name=Installer Fixture','-c','user.email=fixture@example.invalid','commit','-qm','Owned installer source fixture'],{cwd:directory,env:installerEnvironment})
  return {directory,node,env:installerEnvironment,close:()=>rm(directory,{recursive:true,force:true}),async cli(args,options={}){
    try{const result=await run(node,[join(directory,'scripts/elcomputer-install.mjs'),...args],{cwd:directory,env:{...installerEnvironment,...options.env},maxBuffer:2*1024*1024,timeout:120000});return {...result,code:0,result:JSON.parse(result.stdout.trim().split('\n').at(-1))}}
    catch(error){return {stdout:error.stdout||'',stderr:error.stderr||'',code:error.code,result:JSON.parse((error.stdout||'').trim().split('\n').at(-1)||'{}')}}
  }}
}
export async function createInstallerPlatform({siteOrigin='https://fresh.example.invalid'}={}) {
  const directory=await realpath(await mkdtemp('/tmp/elcomputer-install-lab-'))
  await chmod(directory,0o700)
  const projectRef=randomBytes(10).toString('hex'),instanceId=randomUUID(),databasePort=await freePort(),authPort=await freePort(),storagePort=await freePort(),storageAdminPort=await freePort(),restPort=await freePort(),apiPort=await freePort()
  const apiUrl=`https://127.0.0.1:${apiPort}/projects/${projectRef}`,password=randomBytes(32).toString('hex'),jwtSecret=randomBytes(40).toString('hex')
  const children=[],clients=[],requests=[],logs={},bin=process.env.INSTALLER_REVIEW_PG_BIN || process.env.EMAIL_REVIEW_PG_BIN
  let gateway,root,postgres,loseNext=null
  const certificate=join(directory,'server.pem'),key=join(directory,'server.key'),ca=join(directory,'ca.pem'),data=join(directory,'postgres')
  const token=role=>{const header=Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'),payload=Buffer.from(JSON.stringify({iss:apiUrl+'/auth/v1',aud:'authenticated',ref:projectRef,role,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+7200})).toString('base64url');return header+'.'+payload+'.'+createHmac('sha256',jwtSecret).update(header+'.'+payload).digest('base64url')}
  const credentials={project_ref:projectRef,database_password:password,service_role_key:token('service_role'),anon_key:token('anon')}
  const connect=async user=>{
    const client=new pg.Client({host:'127.0.0.1',port:databasePort,database:'postgres',user,password,ssl:{ca:await readFile(ca,'utf8'),rejectUnauthorized:true},connectionTimeoutMillis:2000})
    clients.push(client);await client.connect();return client
  }
  const start=(name,command,args,env)=>{
    const child=spawn(command,args,{cwd:name==='storage'?join(tools,'storage-1.28.0'):directory,env:{...installerEnvironment,...env},stdio:['ignore','pipe','pipe']});children.push(child);logs[name]=''
    const capture=chunk=>{logs[name]=(logs[name]+chunk).slice(-12000)};child.stdout.on('data',capture);child.stderr.on('data',capture)
    return child
  }
  const wait=async(predicate,label)=>{for(let i=0;i<200;i++){try{if(await predicate())return}catch{}if(children.some(child=>child.exitCode!==null&&child.exitCode!==0))throw Error('Owned '+label+' service failed');await new Promise(resolve=>setTimeout(resolve,50))}throw Error('Owned '+label+' readiness timeout')}
  const close=async()=>{
    if(gateway){gateway.closeAllConnections();await new Promise(resolve=>gateway.close(resolve))}
    await Promise.allSettled(clients.map(client=>client.end()))
    for(const child of children.reverse())if(child.exitCode===null&&child.signalCode===null){const ended=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGTERM');const timer=setTimeout(()=>child.kill('SIGKILL'),3000);await ended;clearTimeout(timer)}
    await rm(directory,{recursive:true,force:true})
  }
  try{
    await run('/usr/bin/openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',join(directory,'ca.key'),'-out',ca,'-days','2','-subj','/CN=ELcomputer Owned Laboratory CA'],{env:installerEnvironment})
    await run('/usr/bin/openssl',['req','-newkey','rsa:2048','-nodes','-keyout',key,'-out',join(directory,'server.csr'),'-subj','/CN=localhost'],{env:installerEnvironment})
    await writeFile(join(directory,'server.ext'),'subjectAltName=IP:127.0.0.1,DNS:localhost\nextendedKeyUsage=serverAuth\n')
    await run('/usr/bin/openssl',['x509','-req','-in',join(directory,'server.csr'),'-CA',ca,'-CAkey',join(directory,'ca.key'),'-CAcreateserial','-out',certificate,'-days','2','-extfile',join(directory,'server.ext')],{env:installerEnvironment})
    await chmod(key,0o600);await chmod(join(directory,'ca.key'),0o600)
    await run(join(bin,'initdb'),['-D',data,'-U','storage_audit','-A','trust','--no-sync','--locale=C','--encoding=UTF8'],{env:installerEnvironment})
    await writeFile(join(data,'pg_hba.conf'),'local all storage_audit trust\nhostssl all storage_audit 127.0.0.1/32 trust\nhostssl all all 127.0.0.1/32 scram-sha-256\nhostnossl all all 127.0.0.1/32 reject\n')
    start('postgres',join(bin,'postgres'),['-D',data,'-h','127.0.0.1','-p',String(databasePort),'-k',directory,'-c','ssl=on','-c','ssl_cert_file='+certificate,'-c','ssl_key_file='+key,'-c','session_preload_libraries='+process.env.SUPAUTILS_REVIEW_LIBRARY,'-c','supautils.superuser=storage_audit','-c','supautils.policy_grants={"postgres":["storage.objects","storage.buckets","realtime.messages"]}','-c','elcomputer.laboratory_id='+instanceId],{})
    await wait(async()=>{root=await connect('storage_audit');return true},'PostgreSQL')
    await root.query(`create role postgres login nosuperuser nocreatedb nocreaterole inherit bypassrls password '${password}';
      create role anon nologin nosuperuser nobypassrls;create role authenticated nologin nosuperuser nobypassrls;create role service_role nologin nosuperuser bypassrls;
      create role supabase_auth_admin login nosuperuser nocreatedb nocreaterole password '${password}';
      create role supabase_storage_admin login nosuperuser nocreatedb nocreaterole password '${password}';
      create role authenticator login noinherit password '${password}';
      grant anon,authenticated,service_role to authenticator,supabase_storage_admin;
      grant create on database postgres to postgres,supabase_storage_admin;
      grant usage,create on schema public to postgres;
      create schema auth authorization supabase_auth_admin;create schema storage authorization supabase_storage_admin;
      alter role supabase_auth_admin set search_path=auth,public;
      alter role supabase_storage_admin set search_path=storage,public;
      create schema realtime;grant usage on schema auth,realtime,storage to postgres,anon,authenticated,service_role;
      create table realtime.messages(id bigint generated always as identity primary key,topic text not null,extension text not null,payload jsonb not null default '{}');alter table realtime.messages enable row level security;
      create function realtime.topic() returns text language sql as $$select current_setting('realtime.topic',true)$$;
      create function realtime.send(jsonb,text,text,boolean default true) returns void language sql as $$insert into realtime.messages(topic,extension,payload) values($3,'broadcast',$1)$$;
      grant select,insert on realtime.messages to anon,authenticated;grant usage on sequence realtime.messages_id_seq to anon,authenticated;
    `)
    const dbUrl=user=>`postgresql://${user}:${password}@127.0.0.1:${databasePort}/postgres?sslmode=verify-full&sslrootcert=${encodeURIComponent(ca)}`
    start('auth',join(tools,'auth-server'),[],{GOTRUE_API_HOST:'127.0.0.1',GOTRUE_API_PORT:String(authPort),API_EXTERNAL_URL:apiUrl+'/auth/v1',GOTRUE_DB_DRIVER:'postgres',GOTRUE_DB_DATABASE_URL:dbUrl('supabase_auth_admin'),GOTRUE_DB_NAMESPACE:'auth',GOTRUE_SITE_URL:siteOrigin,GOTRUE_JWT_SECRET:jwtSecret,GOTRUE_JWT_AUD:'authenticated',GOTRUE_JWT_DEFAULT_GROUP_NAME:'authenticated',GOTRUE_JWT_ADMIN_ROLES:'service_role',GOTRUE_DISABLE_SIGNUP:'true',GOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED:'false',GOTRUE_EXTERNAL_EMAIL_ENABLED:'true',GOTRUE_MAILER_AUTOCONFIRM:'false',GOTRUE_LOG_LEVEL:'error'})
    await wait(async()=>{const response=await fetch(`http://127.0.0.1:${authPort}/health`);return response.ok},'Auth')
    await root.query('grant all on all tables in schema auth to postgres;grant usage on all sequences in schema auth to postgres;')
    start('storage',node,[join(tools,'storage-1.28.0/dist/start/server.js')],{SERVER_HOST:'127.0.0.1',SERVER_PORT:String(storagePort),SERVER_ADMIN_PORT:String(storageAdminPort),SERVER_REGION:'local',DATABASE_URL:dbUrl('supabase_storage_admin'),DATABASE_SSL_ROOT_CERT:await readFile(ca,'utf8'),DATABASE_MAX_CONNECTIONS:'4',DB_INSTALL_ROLES:'false',DB_SUPER_USER:'supabase_storage_admin',DB_ALLOW_MIGRATION_REFRESH:'false',AUTH_JWT_SECRET:jwtSecret,AUTH_JWT_ALGORITHM:'HS256',ANON_KEY:credentials.anon_key,SERVICE_KEY:credentials.service_role_key,TENANT_ID:projectRef,STORAGE_BACKEND:'file',STORAGE_FILE_BACKEND_PATH:join(directory,'objects'),PG_QUEUE_ENABLE:'false',LOG_LEVEL:'error',S3_PROTOCOL_ACCESS_KEY_ID:'fixture',S3_PROTOCOL_ACCESS_KEY_SECRET:'fixture-only-no-network',GLOBAL_S3_BUCKET:'fixture',SERVER_ADMIN_API_KEYS:'fixture-only'})
    await wait(async()=>{const response=await fetch(`http://127.0.0.1:${storagePort}/status`);return response.ok},'Storage')
    await root.query('grant all on all tables in schema storage to postgres,anon,authenticated,service_role;grant usage on all sequences in schema storage to postgres,anon,authenticated,service_role;grant execute on all functions in schema storage to postgres,anon,authenticated,service_role;')
    const restConfig=join(directory,'postgrest.conf')
    await writeFile(restConfig,`db-uri = "${dbUrl('authenticator')}"\ndb-schemas = "public"\ndb-anon-role = "anon"\nserver-host = "127.0.0.1"\nserver-port = ${restPort}\njwt-secret = "${jwtSecret}"\ndb-pool = 4\n`,{mode:0o600})
    start('postgrest',process.env.CATALOG_REVIEW_POSTGREST_BIN,[restConfig],{})
    await wait(async()=>{const response=await fetch(`http://127.0.0.1:${restPort}/`);return response.ok},'PostgREST')
    gateway=tlsServer({key:await readFile(key),cert:await readFile(certificate)},(request,response)=>{
      const prefix='/projects/'+projectRef
      if(!request.url.startsWith(prefix+'/')){response.writeHead(404);response.end();return}
      const route=request.url.slice(prefix.length),match=route.match(/^\/(auth|storage|rest)\/v1(\/.*)?$/)
      if(!match){response.writeHead(404);response.end();return}
      requests.push({method:request.method,path:route.split('?')[0]})
      const port={auth:authPort,storage:storagePort,rest:restPort}[match[1]],path=match[2]||'/'
      const upstream=http.request({host:'127.0.0.1',port,path,method:request.method,headers:{...request.headers,host:'127.0.0.1:'+port}},reply=>{
        if(loseNext&&request.method===loseNext.method&&route.split('?')[0]===loseNext.path){loseNext=null;reply.resume();reply.on('end',()=>response.destroy());return}
        response.writeHead(reply.statusCode,reply.headers);reply.pipe(response)
      });upstream.on('error',()=>response.destroy());request.pipe(upstream)
    })
    await new Promise(resolve=>gateway.listen(apiPort,'127.0.0.1',resolve))
    postgres=await connect('postgres');await postgres.query("select set_config('request.jwt.claim.role','service_role',false)")
    const target={format:1,profile:'owned-laboratory',installation_id:randomUUID(),project_ref:projectRef,api_url:apiUrl,site_origin:siteOrigin,database:{host:'127.0.0.1',port:databasePort,name:'postgres',user:'postgres',ca_file:ca},api_ca_file:ca,excluded_project_refs:[],laboratory:{instance_id:instanceId,identity_file:join(directory,'identity.json')}}
    await writeFile(target.laboratory.identity_file,JSON.stringify({instance_id:instanceId,pid:process.pid,project_ref:projectRef,api_url:apiUrl,database_port:databasePort}),{mode:0o600})
    const targetFile=join(directory,'target.json'),credentialsFile=join(directory,'credentials.json'),ownerFile=join(directory,'owner.json')
    const owner={email:'owner@'+projectRef+'.example.invalid',password:'OWNER-SECRET-CANARY-'+randomBytes(16).toString('hex'),full_name:'Fresh Owner'}
    await writeFile(targetFile,JSON.stringify(target),{mode:0o600});await writeFile(credentialsFile,JSON.stringify(credentials),{mode:0o600});await writeFile(ownerFile,JSON.stringify(owner),{mode:0o600})
    return {directory,target,targetFile,credentials,credentialsFile,owner,ownerFile,db:postgres,root,requests,connect,close,loseResponse(method,path){loseNext={method,path}},logs:()=>Object.fromEntries(Object.entries(logs).map(([name,value])=>[name,value.replaceAll(password,'[private]').replaceAll(jwtSecret,'[private]').replaceAll(credentials.service_role_key,'[private]').replaceAll(credentials.anon_key,'[private]').replaceAll(owner.password,'[private]')]))}
  }catch(error){const diagnostic=JSON.stringify(logs).replaceAll(password,'[private]').replaceAll(jwtSecret,'[private]').replaceAll(credentials.service_role_key,'[private]').replaceAll(credentials.anon_key,'[private]');await close();throw Error(error.message+'; '+diagnostic)}
}
