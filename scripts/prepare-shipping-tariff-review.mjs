#!/usr/bin/env node
// Local artifact preparation only. No SSH, database connection or apply mode.
import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir, readdir, lstat, chmod, cp } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { createServer } from 'node:net'
import { create as tarCreate } from 'tar'
import { inventory } from './publish/inventory.mjs'
import { hash } from './publish/contracts.mjs'
import { canonical } from './commerce-release/operator.mjs'
import { retainClientAssets } from './premium-product-finishing-release/assets.mjs'

const run = promisify(execFile), repo = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const digest = value => hash(canonical(value))
const migration = 'supabase/migrations/20261023010000_shipping_tariff_drafts.sql'
export const tariffApplicationFiles = [
  'app/components/dashboard/commerce/ShippingTab.vue', 'app/components/dashboard/commerce/ShippingTariffManager.vue',
  'app/utils/shippingTariffs.js', 'i18n/locales/en.json', 'i18n/locales/ar.json', 'server/utils/shippingTariffs.js',
  'server/api/admin-shipping/companies/[id]/tariffs.get.js', 'server/api/admin-shipping/companies/[id]/tariffs.post.js'
].sort()
export const argumentsForTariffReview = args => {
  if (args.length === 3 && args[0] === 'prepare') return { spec: resolve(args[1]), directory: resolve(args[2]) }
  throw Error('Only local prepare SPEC NEW_DIRECTORY is supported. No apply mode.')
}
export const assertTariffScope = paths => {
  const application = paths.filter(p => /^(app|server|i18n|supabase)\//.test(p)).sort()
  assert.deepEqual(application, [...tariffApplicationFiles, migration].sort(), 'Review unrelated/missing application or schema changes')
}
const save = (file, data) => writeFile(file, JSON.stringify(data, null, 2) + '\n', { flag:'wx', mode:0o600 })
const cleanEnv = () => ({ PATH:dirname(process.execPath)+':/usr/local/bin:/usr/bin:/bin', HOME:process.env.HOME, LANG:'C', NODE_ENV:'production' })
async function logged(command, args, cwd, path) {
  const child = spawn(command,args,{cwd,env:cleanEnv(),stdio:['ignore','pipe','pipe'],timeout:600000}), chunks=[]
  child.stdout.on('data',b=>chunks.push(b));child.stderr.on('data',b=>chunks.push(b))
  const code=await new Promise((res,rej)=>{child.once('error',rej);child.once('close',res)})
  await writeFile(path,Buffer.concat(chunks),{flag:'wx',mode:0o600});assert.equal(code,0,'Review log retained: '+path)
}
async function modes(path) {
  const stat=await lstat(path);if(stat.isSymbolicLink())return
  await chmod(path,stat.isDirectory()?0o755:0o644)
  if(stat.isDirectory())for(const name of await readdir(path))await modes(path+'/'+name)
}
async function compiledSmoke(output, work) {
  const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r))
  // No provider/hosted access is needed for anonymous authorization boundaries.
  const preload=work+'/offline.cjs'
  await writeFile(preload,"const original=globalThis.fetch;globalThis.fetch=(url,options)=>{const u=new URL(typeof url==='string'?url:url.url);if(u.hostname!=='127.0.0.1')throw Error('External fetch forbidden during artifact qualification');return original(url,options)};\n",{flag:'wx',mode:0o600})
  const child=spawn(process.execPath,['--require',preload,output+'/server/index.mjs'],{cwd:work,env:{...cleanEnv(),HOST:'127.0.0.1',PORT:String(port),NUXT_PUBLIC_SUPABASE_URL:'https://supabase.invalid',NUXT_PUBLIC_SUPABASE_KEY:'isolated-placeholder'},stdio:['ignore','pipe','pipe']})
  const chunks=[];child.stdout.on('data',b=>chunks.push(b));child.stderr.on('data',b=>chunks.push(b));const ended=new Promise(r=>child.once('close',r));child.once('error',()=>{})
  const url='http://127.0.0.1:'+port, results=[]
  try {
    let available=false
    for(let n=0;n<160;n++){
      if(child.exitCode!==null)throw Error('Compiled server stopped before qualification')
      try{const response=await fetch(url+'/api/checkout/controlled',{signal:AbortSignal.timeout(1000)});if(response.status===401){available=true;break}}catch{}
      await new Promise(r=>setTimeout(r,125))
    }
    assert.ok(available,'Compiled server did not become ready')
    for(const path of ['/api/admin-shipping/companies/00000000-0000-4000-8000-000000000001/tariffs','/api/checkout/controlled'])for(const method of ['GET','POST']){
      const response=await fetch(url+path,{method,headers:{'content-type':'application/json'},...(method==='POST'?{body:'{}'}:{}),signal:AbortSignal.timeout(3000)})
      assert.equal(response.status,401,path+' '+method)
      if(path.includes('/tariffs'))assert.equal(response.headers.get('cache-control'),'private, no-store')
      results.push({path,method,status:response.status})
    }
  } finally {
    child.kill('SIGTERM');const kill=setTimeout(()=>child.kill('SIGKILL'),3000)
    try{await ended}finally{clearTimeout(kill)}
    await writeFile(work+'/compiled-server.log',Buffer.concat(chunks),{flag:'wx',mode:0o600})
  }
  await save(work+'/compiled-smoke.json',{result:'PASS',checks:results,provider_requests:0,database_writes:0})
}
export async function prepareTariffReview({ spec:specFile,directory:work }) {
  assert.equal(process.version,'v22.23.1');const spec=JSON.parse(await readFile(specFile,'utf8'))
  assert.ok(work!==repo&&!work.startsWith(repo+'/'),'Prepare outside the source checkout')
  assert.equal((await run('git',['status','--porcelain'],{cwd:repo})).stdout,'','Commit owned inputs before preparation')
  assert.equal((await run('git',['rev-parse','HEAD'],{cwd:repo})).stdout.trim(),spec.application_commit)
  const base=JSON.parse(await readFile(spec.accepted_plan,'utf8')),{seal,...baseBody}=base
  assert.equal(digest(baseBody),seal);assert.equal(base.schema_version,90)
  assert.equal(hash(await readFile(spec.accepted_archive)),base.archive_sha256)
  assert.equal(digest(await inventory(resolve(spec.accepted_output))),base.inventory_sha256,'Accepted local output changed')
  const changed=(await run('git',['diff','--name-only',base.application_commit,spec.application_commit],{cwd:repo})).stdout.trim().split('\n')
  assertTariffScope(changed)
  const q=JSON.parse(await readFile(spec.qualification,'utf8'));assert.equal(q.result,'PASS');assert.equal(q.application_commit,spec.application_commit)
  assert.equal(q.typecheck,'PASS');assert.equal(q.native_database,'PASS');assert.equal(q.browser_ui,'PASS');assert.equal(q.provider_requests,0)
  for(const [file,sha]of Object.entries(q.evidence_sha256))assert.equal(hash(await readFile(file)),sha)
  assert.equal((await run(process.execPath,[spec.npm_cli,'--version'],{env:cleanEnv()})).stdout.trim(),'10.9.8')
  await mkdir(work,{mode:0o700});const source=work+'/source';await mkdir(source,{mode:0o700})
  await logged('git',['archive','--format=tar','--output='+work+'/source.tar',spec.application_commit],repo,work+'/source.log')
  await logged('tar',['-xf',work+'/source.tar','-C',source],repo,work+'/extract-source.log')
  await writeFile(work+'/empty.env','',{flag:'wx',mode:0o600})
  await logged(process.execPath,[spec.npm_cli,'ci','--no-audit','--no-fund'],source,work+'/npm-ci.log')
  assert.equal(hash(await readFile(source+'/package-lock.json')),hash(await readFile(repo+'/package-lock.json')))
  await logged(process.execPath,[source+'/node_modules/nuxt/bin/nuxt.mjs','build','--dotenv',work+'/empty.env'],source,work+'/build.log')
  const output=source+'/.output',assets={}
  for(const entry of await inventory(resolve(spec.accepted_output)))if(entry.type==='file'&&entry.path.startsWith('public/_nuxt/'))assets[entry.path.slice('public/_nuxt/'.length)]={sha256:entry.sha256}
  await retainClientAssets(resolve(spec.accepted_output)+'/public/_nuxt',output+'/public/_nuxt',assets);await modes(output)
  const entries=await inventory(output);await save(work+'/inventory.json',entries)
  await tarCreate({cwd:source,file:work+'/application.tar.gz',gzip:true,portable:true,noMtime:true,follow:false,onWriteEntry:entry=>{if(entry.type==='SymbolicLink')entry.stat.mode=(entry.stat.mode&~0o7777)|0o755}},['.output'])
  await chmod(work+'/application.tar.gz',0o600);const readback=work+'/readback';await mkdir(readback,{mode:0o700})
  const readbackScript='import importlib.util,json,sys,pathlib; s=importlib.util.spec_from_file_location("extractor",sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);m.extract_release(sys.argv[2],pathlib.Path(sys.argv[3]),json.loads(pathlib.Path(sys.argv[4]).read_text()))'
  await logged('python3',['-B','-c',readbackScript,repo+'/scripts/clean-reinstall/deploy.py',work+'/application.tar.gz',readback,work+'/inventory.json'],repo,work+'/archive-readback.log')
  assert.equal(digest(await inventory(readback)),digest(entries));await compiledSmoke(readback,work)
  await cp(source+'/'+migration,work+'/migration91.sql',{errorOnExist:true,force:false})
  const importFile='docs/operations/shipping-tariffs/last-mile-owner-draft-v1.json'
  await cp(source+'/'+importFile,work+'/owner-draft.import.json',{errorOnExist:true,force:false})
  const manifest={format:'shipping-tariff-review/v1',result:'SEALED_LOCAL_REVIEW_ARTIFACT',application_commit:spec.application_commit,
    base:{release:base.release_id,application_commit:base.application_commit,seal:base.seal,target_sha256:digest(base.target),schema:90},
    proposed_schema:91,migrations:[{file:migration,sha256:hash(await readFile(work+'/migration91.sql'))}],
    archive_sha256:hash(await readFile(work+'/application.tar.gz')),inventory_sha256:digest(entries),entries:entries.length,retained_assets:Object.keys(assets).length,
    qualification_sha256:hash(await readFile(spec.qualification)),compiled_smoke_sha256:hash(await readFile(work+'/compiled-smoke.json')),
    import_sha256:hash(await readFile(work+'/owner-draft.import.json')),business_import_in_deployment:false,provider_requests:0,
    production_application_authorized:false,production_business_writes_authorized:false,production_preflight:'REQUIRED',fresh_execution_backups:'REQUIRED',
    deployment_operator:'NOT_PREPARED',checkout_change:false,credential_change:false,caddy_change:false,automatic_retry:false,automatic_rollback:false}
  manifest.seal=digest(manifest);await save(work+'/review-manifest.json',manifest)
  console.log(JSON.stringify({result:manifest.result,seal:manifest.seal,archive_sha256:manifest.archive_sha256,entries:entries.length,retained_assets:manifest.retained_assets,production_writes:0}))
  return manifest
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{await prepareTariffReview(argumentsForTariffReview(process.argv.slice(2)))}catch(error){console.error(error.message);process.exitCode=1}
}
