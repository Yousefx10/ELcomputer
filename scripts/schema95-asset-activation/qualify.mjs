// Exact-version local Caddy proof. No hosted Auth, provider or production request.
import assert from 'node:assert/strict'
import {readFile,writeFile,mkdir,cp} from 'node:fs/promises'
import {spawn,execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {createServer} from 'node:http'
import {dirname,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {hash} from '../schema95-beta-release/database.mjs'
const run=promisify(execFile),here=dirname(fileURLToPath(import.meta.url)),w=resolve(process.argv[2]),parent=JSON.parse(await readFile(w+'/../schema95-beta-release-20261026/review-2/plan.json'))
const baseline=JSON.parse(await readFile(w+'/target-baseline.private.json')),binary=w+'/tools/caddy',raw=baseline.caddy_text
const patchCode='import importlib.util,json,sys;s=importlib.util.spec_from_file_location("patch",sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);q=json.load(sys.stdin);print(m.patch(q["raw"],q["root"],q["release"]),end="")'
const task=run('python3',['-I','-S','-B','-c',patchCode,here+'/remote.py']);task.child.stdin.end(JSON.stringify({raw,root:parent.target.root,release:parent.release_id}));const proposed=(await task).stdout
assert.ok(proposed.includes('@schema95_assets'))
for(const [name,body]of [['before',raw],['proposed',proposed]]){try{await writeFile(w+'/Caddyfile.'+name,body,{flag:'wx',mode:0o600})}catch(e){if(e.code!=='EEXIST')throw e;assert.equal(await readFile(w+'/Caddyfile.'+name,'utf8'),body)}}
const adapted=[]
for(const name of ['before','proposed'])adapted.push(JSON.parse((await run(binary,['adapt','--adapter','caddyfile','--config',w+'/Caddyfile.'+name],{maxBuffer:8e6})).stdout))
let removed=0
function withoutAssets(v){
 if(Array.isArray(v))return v.filter(r=>{const hit=Array.isArray(r?.match)&&r.match.some(m=>JSON.stringify(m.path)==='["/_nuxt/*"]'&&JSON.stringify(m.method)==='["GET","HEAD"]');if(hit){removed++;return false}return true}).map(withoutAssets)
 if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,withoutAssets(x)]))
 return v
}
assert.deepEqual(withoutAssets(structuredClone(adapted[1])),adapted[0]);assert.equal(removed,2,'One source handler on the existing HTTP and HTTPS listeners')
const stub=createServer((req,res)=>{res.statusCode=req.url.startsWith('/api/')?401:200;res.end('LOCAL_UPSTREAM')});await new Promise(r=>stub.listen(0,'127.0.0.1',r));const upstream=stub.address().port
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r))
const localFetch=(url,options={})=>{assert.ok(String(url).startsWith('http://127.0.0.1:'+port+'/'));return globalThis.fetch(url,{...options,redirect:'error'})}
await mkdir(w+'/local-current',{mode:0o700});await cp(w+'/application/public',w+'/local-current/public',{recursive:true})
// Local-only rollback fixture lacks a new95 file; immutable fallback must retain it.
const inventory=JSON.parse(await readFile(w+'/../schema95-beta-release-20261026/review-2/inventory.json'))
const newFiles=inventory.filter(e=>e.type==='file'&&/^public\/_nuxt\/[^/]+\.js$/.test(e.path)&&!baseline.assets[e.path.slice('public/_nuxt/'.length)]).slice(0,3)
const oldFiles=Object.keys(baseline.assets).filter(n=>n.endsWith('.js')).sort().slice(0,3)
let local=proposed.replace(/http:\/\/[^\n]+ \{/,'http://127.0.0.1:'+port+' {').replace(/http:\/\/ \{/,'http://127.0.0.1:'+(port+1)+' {')
local=local.replace('    admin off','    admin off\n    auto_https off\n    persist_config off\n    default_bind 127.0.0.1').replaceAll('127.0.0.1:'+parent.target.port,'127.0.0.1:'+upstream).replaceAll(parent.target.root+'/current/public',w+'/local-current/public').replaceAll(parent.target.root+'/releases/'+parent.release_id+'/public',w+'/application/public')
// Only the disposable HTTP fixture omits the canonical HTTPS redirect. The actual
// before/after production adapters above preserve it byte-for-byte. Never follow it.
const redirect='        redir @http https://'+parent.target.domain+'{uri} 308\n';assert.equal(local.split(redirect).length,2);local=local.replace(redirect,'')
await writeFile(w+'/local.Caddyfile',local,{flag:'wx',mode:0o600});await mkdir(w+'/local-caddy-config',{mode:0o700});await mkdir(w+'/local-caddy-data',{mode:0o700})
let log='';const child=spawn(binary,['run','--adapter','caddyfile','--config',w+'/local.Caddyfile'],{env:{PATH:'/usr/bin:/bin',HOME:process.env.HOME,XDG_CONFIG_HOME:w+'/local-caddy-config',XDG_DATA_HOME:w+'/local-caddy-data'},stdio:['ignore','pipe','pipe']});child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b)
const checks=[]
try{
 let ready=false,lastStatus;for(let i=0;i<40;i++){try{const r=await localFetch('http://127.0.0.1:'+port+'/_nuxt/'+oldFiles[0],{signal:AbortSignal.timeout(2000)});await r.arrayBuffer();lastStatus=r.status;if(r.status===200){ready=true;break}if(i>5)break}catch{}await new Promise(r=>setTimeout(r,100))}assert.ok(ready,'Local Caddy readiness, last status '+lastStatus)
 for(const name of [...oldFiles,...newFiles.map(e=>e.path.slice('public/_nuxt/'.length))]){
  const r=await localFetch('http://127.0.0.1:'+port+'/_nuxt/'+name);const b=Buffer.from(await r.arrayBuffer());console.log(JSON.stringify({asset:name,status:r.status}));assert.equal(r.status,200,name);assert.equal(hash(b),hash(await readFile(w+'/application/public/_nuxt/'+name)));assert.match(r.headers.get('cache-control'),/immutable/);checks.push({asset:name,status:200,byte_match:true})
 }
 const {rename}=await import('node:fs/promises');const missing=newFiles[0].path;await rename(w+'/local-current/'+missing,w+'/local-current/'+missing+'.held')
 const fallback=await localFetch('http://127.0.0.1:'+port+'/'+missing.slice('public/'.length));assert.equal(fallback.status,200);assert.equal(hash(Buffer.from(await fallback.arrayBuffer())),newFiles[0].sha256);checks.push({rollback_fallback:true,status:200})
 const latest=await localFetch('http://127.0.0.1:'+port+'/_nuxt/builds/latest.json');await latest.arrayBuffer();assert.equal(latest.status,200);assert.match(latest.headers.get('cache-control'),/max-age=1,/);assert.doesNotMatch(latest.headers.get('cache-control'),/immutable/)
 for(const [path,method,status]of [['/checkout','GET',403],['/cart','GET',403],['/api/payments/intentions','POST',403],['/_nuxt/.env','GET',404],['/_nuxt/private/anything','GET',404],['/_nuxt/not-a-real-file.js','GET',404],['/login','GET',200],['/ar/login','GET',200],['/api/payments/status','GET',401],['/api/payments/paymob/webhook','POST',401]]){
  const r=await localFetch('http://127.0.0.1:'+port+path,{method});await r.arrayBuffer();assert.equal(r.status,status,path);checks.push({path,method,status})
 }
 const result={result:'PASS',caddy_version:baseline.caddy_version,only_one_static_handler_added:true,all_other_adapted_policy_identical:true,config_sha256:hash(proposed),checks,production_requests:0,auth_submissions:0,provider_calls:0,application_archive_unchanged:true}
 await writeFile(w+'/local-caddy-qualification.json',JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});console.log(JSON.stringify({result:'CADDY_ASSET_CORRECTION_LOCAL_PASS',checks:checks.length,all_other_policy_unchanged:true}))
}finally{child.kill('SIGTERM');if(child.exitCode===null)await new Promise(r=>child.once('exit',r));await new Promise(r=>stub.close(r));await writeFile(w+'/local-caddy.log',log,{flag:'wx',mode:0o600})}
