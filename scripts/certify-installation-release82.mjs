// Compiler accepts no target/DSN/credentials. Every service belongs to a fresh
// laboratory created by this process. It never writes historical certificates.
import assert from 'node:assert/strict'
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {randomUUID} from 'node:crypto'
import {createRequire} from 'node:module'
import {createInstallerPlatform} from '../tests/helpers/installerPlatform.mjs'
import {applyCandidate,catalog,hash,json,verifyBundle} from './lib/cleanBaseline.mjs'
import {connectPlatform} from './install/platform.mjs'
import {bootstrapFirstOwner} from './lib/installationBootstrap.mjs'
import {normal82Files,release82Id} from './lib/release82Certification.mjs'
import {isApplicationInput,releaseApplicationCatalog,release79ManifestHash} from './lib/release79Certification.mjs'
const args=process.argv.slice(2);assert.ok(args.every(a=>a==='--write')&&args.length<=1,'Only --write; no remote input')
const root=resolve('.'),out=resolve(root,'supabase/bootstrap/release-82-v1'),run=promisify(execFile),inputCommit='084058e127f7964bf2ab2953f595f9abb9f1f521'
const {inventory}=await verifyBundle(),lab=await createInstallerPlatform();let platform
try{
 const req=createRequire(root+'/package.json'),pkg=req.resolve('@supabase/cli-'+process.platform+'-'+process.arch+'/package.json'),binary=resolve(pkg,'../bin/supabase')
 assert.equal(JSON.parse(await readFile(pkg)).version,'2.109.1')
 const work=join(lab.directory,'compiler'),migrationDir=join(work,'supabase/migrations'),pass=join(work,'database.pgpass');await mkdir(migrationDir,{recursive:true,mode:0o700});await writeFile(join(work,'supabase/config.toml'),'project_id = "owned-release82-compiler"\n',{mode:0o600})
 const escape=v=>String(v).replaceAll('\\','\\\\').replaceAll(':','\\:');await writeFile(pass,[lab.target.database.host,lab.target.database.port,'postgres','postgres',lab.credentials.database_password].map(escape).join(':')+'\n',{mode:0o600})
 const url=new URL('postgresql://postgres@127.0.0.1:'+lab.target.database.port+'/postgres');url.searchParams.set('sslmode','verify-full');url.searchParams.set('sslrootcert',lab.target.database.ca_file)
 const cliEnv={PATH:process.env.PATH,LANG:'C',DO_NOT_TRACK:'1',PGPASSFILE:pass,DYLD_LIBRARY_PATH:process.env.DYLD_LIBRARY_PATH||''}
 const cli=async words=>{await run(binary,['--workdir',work,'--agent','no',...words,'--db-url',url.href],{cwd:work,env:cliEnv,timeout:90000,maxBuffer:2*1024*1024})}
 for(const r of inventory)await writeFile(join(migrationDir,r.filename),await readFile(root+'/supabase/migrations/'+r.filename),{mode:0o600})
 await applyCandidate(lab.db,{installationId:lab.target.installation_id})
 await cli(['migration','repair',...inventory.map(r=>r.version),'--status','applied'])
 const artifacts={},schemaStages={},history=[],migrations=[...inventory.map((r,i)=>({ordinal:i+1,...r}))]
 const historyNow=async()=>{const rows=(await lab.db.query('select version,name,statements from supabase_migrations.schema_migrations order by version')).rows;return rows.map(r=>({version:r.version,name:r.name,statements_sha256:hash(json(r.statements))}))}
 for(let i=0;i<normal82Files.length;i++){
  const file=normal82Files[i],bytes=await readFile(root+'/supabase/migrations/'+file);migrations.push({ordinal:i+71,filename:file,version:file.slice(0,14),name:file.slice(15,-4),sha256:hash(bytes),bytes:bytes.length})
  await writeFile(join(migrationDir,file),bytes,{mode:0o600});await cli(['db','push','--yes'])
  assert.equal((await historyNow()).length,i+71)
  if(i===0){
   const old=JSON.parse(await readFile(root+'/supabase/bootstrap/portability-v1/manifest.json'));assert.equal(hash(json(await catalog(lab.db))),old.expected_public_catalog_sha256)
   platform=await connectPlatform(lab.target,lab.credentials,{mutating:true})
   for(const bucket of JSON.parse(await readFile(root+'/supabase/bootstrap/clean-v1/storage.json'))){
    const created=await platform.client.storage.createBucket(bucket.id,{public:false,fileSizeLimit:bucket.file_size_limit,allowedMimeTypes:bucket.allowed_mime_types||undefined})
    assert.equal(created.error,null)
   }
   // One actual Auth identity is linked/sealed before any72–79 SQL executes.
   await bootstrapFirstOwner({db:platform.db,authAdmin:platform.client.auth.admin,target:{installation_id:lab.target.installation_id,request_id:randomUUID(),target_digest:hash('owned-release82-compiler'),project_ref:lab.target.project_ref,site_origin:lab.target.site_origin},email:lab.owner.email,password:lab.owner.password,fullName:lab.owner.full_name,confirmOwner:true})
  }
  const seal=(await lab.db.query('select phase,auth_subject from private.installation_bootstrap')).rows[0]
  assert.equal(seal.phase,'complete');assert.equal((await lab.db.query('select count(*)::int n from auth.users')).rows[0].n,1)
  assert.equal((await lab.db.query('select count(*)::int n from storage.buckets where public=false')).rows[0].n,6)
  assert.equal((await lab.db.query('select count(*)::int n from storage.objects')).rows[0].n,0)
  const version=i+71,name='schema-'+version+'.json',schema=await releaseApplicationCatalog(lab.db)
  const schemaBytes=json(schema);schemaStages[version]=hash(schemaBytes);if(version<=79)assert.equal(await readFile(root+'/supabase/bootstrap/release-79-v1/'+name,'utf8'),schemaBytes,'Unexpected historical schema change');else artifacts[name]=schemaBytes;process.stdout.write(JSON.stringify({stage:version,history:version,owner_sealed:true})+'\n')
 }
 history.push(...await historyNow());assert.equal(history.length,82)
 const names=(await run('git',['ls-tree','-r','--name-only',inputCommit],{cwd:root})).stdout.trim().split('\n').filter(isApplicationInput),applicationInputs={}
 for(const name of names){const bytes=(await run('git',['show',inputCommit+':'+name],{cwd:root,encoding:'buffer',maxBuffer:4*1024*1024})).stdout;assert.equal(hash(bytes),hash(await readFile(root+'/'+name)));applicationInputs[name]=hash(bytes)}
 const m={format:1,version:release82Id,application_checkpoint:inputCommit,application_inputs:applicationInputs,last_migration:82,predecessor_certificate_sha256:release79ManifestHash,baseline:'clean-v1',baseline_manifest_sha256:hash(await readFile(root+'/supabase/bootstrap/clean-v1/manifest.json')),portability_manifest_sha256:hash(await readFile(root+'/supabase/bootstrap/portability-v1/manifest.json')),baseline_adopted:70,normal_execution_order:normal82Files.map(n=>n.slice(0,14)),owner_sealed_before:72,migrations,history,schema_stages:schemaStages,artifacts:Object.fromEntries(Object.entries(artifacts).map(([k,v])=>[k,hash(v)])),application_extension:{name:'pg_trgm',version:'1.6',schema:'extensions'},scope:'owned local compatibility; hosted staging acceptance pending',platform_fixtures:['Realtime'],providers:'all external integrations/workers OFF; no inherited credentials'}
 artifacts['manifest.json']=json(m)
 if(args.includes('--write')){
  const missing=[]
  for(const [name,bytes]of Object.entries(artifacts)){
   try{assert.equal(await readFile(join(out,name),'utf8'),bytes,'Immutable certificate: use a separately reviewed new version')}
   catch(error){if(error.code!=='ENOENT')throw error;missing.push([name,bytes])}
  }
  await mkdir(out,{recursive:true});for(const [name,bytes]of missing)await writeFile(join(out,name),bytes,{flag:'wx'})
 }
 else for(const [name,bytes]of Object.entries(artifacts))assert.equal(await readFile(join(out,name),'utf8'),bytes,'Certificate drift: '+name)
 process.stdout.write(JSON.stringify({result:'pass',manifest_sha256:hash(artifacts['manifest.json']),application_inputs:names.length,normal_migrations:12,baseline_adopted:70,history:82})+'\n')
}finally{await platform?.close();await lab.close()}
