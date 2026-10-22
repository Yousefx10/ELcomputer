// Exact extracted artifact, disposable PostgreSQL/PostgREST and synthetic Auth.
// No deployment configuration, hosted database or real provider access is read.
import assert from 'node:assert/strict'
import {readFile,writeFile,mkdir,readdir,realpath} from 'node:fs/promises'
import {createServer} from 'node:http'
import {spawn} from 'node:child_process'
import {createHash} from 'node:crypto'
import {resolve,join} from 'node:path'
import {createCatalogRestFixture} from '../tests/helpers/catalogRestFixture.mjs'
import {encryptShippingSecret} from '../server/utils/shippingSecrets.js'
import {inventory} from './publish/inventory.mjs'
import {digest} from './live-sales-release/operator.mjs'
const output=await realpath(process.env.PDC_REPLAY_OUTPUT),dir=resolve(process.env.PDC_REPLAY_EVIDENCE)
assert.ok(output.endsWith('/archive-readback')&&dir!==output,'Explicit extracted archive and owned evidence directory required')
await mkdir(dir,{mode:0o700})
const expected=JSON.parse(await readFile(join(output,'../inventory.json'),'utf8'));assert.equal(digest(await inventory(output)),digest(expected))
const candidate=JSON.parse(await readFile(join(output,'../candidate-plan.json'),'utf8'))
assert.equal(createHash('sha256').update(await readFile(join(output,'../release.tar.gz'))).digest('hex'),candidate.archive_sha256)
assert.equal(digest(expected),candidate.inventory_sha256)
const key='synthetic-pdc-artifact-encryption-at-least-32-characters',token='SYNTHETIC-ARTIFACT-TOKEN',products=JSON.parse(await readFile('tests/fixtures/pdc-v6-products.json','utf8'))
const scenario=join(dir,'scenario.json'),calls=join(dir,'provider-calls.jsonl'),preload=join(dir,'provider-fixture.mjs'),checks=[]
await writeFile(calls,'',{flag:'wx',mode:0o600})
await writeFile(preload,`import {readFileSync,appendFileSync} from 'node:fs';import assert from 'node:assert/strict';import ${JSON.stringify(new URL('../tests/helpers/offlinePdcNetwork.mjs',import.meta.url).href)};
const original=globalThis.fetch;globalThis.fetch=async(input,options)=>{const u=new URL(String(input));if(u.origin!=='https://clientsapi.pdc-eg.com')return original(input,options);assert.equal(options.method,'GET');assert.equal(options.body,undefined);assert.equal(options.headers.AccessToken,${JSON.stringify(token)});assert.equal(options.headers.CompanyID,'123456');assert.equal(Object.keys(options.headers).some(k=>k.toLowerCase()==='cookie'),false);const operation=u.pathname.split('/').at(-1);assert.ok(['GetProducts','GetCities'].includes(operation));appendFileSync(${JSON.stringify(calls)},JSON.stringify({operation,method:options.method})+'\\n');const s=JSON.parse(readFileSync(${JSON.stringify(scenario)}));return Response.json(operation==='GetProducts'?s.products:s.cities)};`,{flag:'wx',mode:0o600})
const f=await createCatalogRestFixture({afterCatalog:async db=>{for(const name of(await readdir('supabase/migrations')).filter(n=>n.endsWith('.sql')&&n>'20261011120000_catalog_confidentiality.sql').sort())await db.exec(await readFile(join('supabase/migrations',name),'utf8'))}})
let proxy,nuxt,logs='',failure=null
const stop=async()=>{if(nuxt&&nuxt.exitCode===null){const ended=new Promise(r=>nuxt.once('exit',r));nuxt.kill('SIGTERM');await ended}}
const check=(v,label)=>{assert.ok(v,label);checks.push(label)}
const setScenario=async value=>{await writeFile(scenario,JSON.stringify(value),{mode:0o600})}
try{
 const authTokens=Object.fromEntries(Object.keys(f.actors).map(name=>[f.token(name),{id:f.actors[name],role:'authenticated',aud:'authenticated',email:name+'@owned.invalid'}]))
 proxy=createServer(async(req,res)=>{
  if(req.url==='/auth/v1/user'){const user=authTokens[req.headers.authorization?.slice(7)];res.writeHead(user?200:401,{'content-type':'application/json'}).end(JSON.stringify(user||{}));return}
  if(!req.url.startsWith('/rest/v1/')){res.writeHead(404).end();return}
  try{const parts=[];for await(const part of req)parts.push(part);const body=Buffer.concat(parts),headers={...req.headers};for(const k of ['host','connection','content-length'])delete headers[k]
   const r=await fetch(f.url+req.url.slice('/rest/v1'.length),{method:req.method,headers,...(body.length?{body}:{}),signal:AbortSignal.timeout(10000)})
   res.writeHead(r.status,Object.fromEntries([...r.headers].filter(([k])=>!['content-encoding','content-length','transfer-encoding','connection'].includes(k)))).end(Buffer.from(await r.arrayBuffer()))
  }catch{res.writeHead(503).end('{}')}
 })
 await new Promise(r=>proxy.listen(0,'127.0.0.1',r));const api='http://127.0.0.1:'+proxy.address().port
 globalThis.useRuntimeConfig=()=>({shippingCredentialsEncryptionKey:key})
 await f.db.query("update public.shipping_provider_settings set product_id=40,origin_city_id=1,company_id='123456',access_token_encrypted=$1,is_enabled=false,auto_create_labels=false,reverse_enabled=false,cod_enabled=false where id='pdc'",[encryptShippingSecret(token)])
 await f.db.query("update public.site_settings set product_page_style='premium' where key='default'")
 const before=(await f.db.query("select product_id,origin_city_id,access_token_encrypted,is_enabled,auto_create_labels,reverse_enabled,cod_enabled from public.shipping_provider_settings where id='pdc'")).rows[0]
 const cityBefore=(await f.db.query('select * from public.shipping_city_mappings order by id')).rows
 const start=async enabled=>{
  const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r))
  nuxt=spawn(process.execPath,['--import',preload,join(output,'server/index.mjs')],{cwd:output,env:{PATH:process.env.PATH,NODE_ENV:'production',NITRO_HOST:'127.0.0.1',NITRO_PORT:String(port),NUXT_PUBLIC_SUPABASE_URL:api,NUXT_PUBLIC_SUPABASE_KEY:f.token('anon'),NUXT_SUPABASE_SERVICE_ROLE_KEY:f.token('service'),NUXT_SHIPPING_CREDENTIALS_ENCRYPTION_KEY:key,NUXT_SHIPPING_LIVE_REQUESTS_ENABLED:String(enabled),NUXT_PUBLIC_PURCHASING_ENABLED:'false',NUXT_PUBLIC_SITE_URL:'https://merchant.example'},stdio:['ignore','pipe','pipe']})
  nuxt.stdout.on('data',c=>logs+=c);nuxt.stderr.on('data',c=>logs+=c)
  const origin='http://127.0.0.1:'+port
  for(let i=0;i<100;i++){try{if((await fetch(origin+'/api/admin-shipping/settings')).status===401)return origin}catch{}if(nuxt.exitCode!==null)throw Error('Owned artifact server exited');await new Promise(r=>setTimeout(r,100))}throw Error('Owned artifact server not ready')
 }
 let origin=await start(true)
 const call=async(path,actor='owner',action)=>{const r=await fetch(origin+path,{method:action?'POST':'GET',headers:{...(actor?{authorization:'Bearer '+f.token(actor)}:{}),...(action?{'content-type':'application/json'}:{})},...(action?{body:JSON.stringify({action})}:{})});return{status:r.status,body:await r.json(),headers:r.headers}}
 const lookup=(action='test',actor='owner')=>call('/api/admin-shipping/lookups',actor,action)
 const reset=()=>f.db.query("update public.shipping_provider_settings set lookup_attempted_at=null where id='pdc'")
 await setScenario({products,cities:[{id:1,name:'Cairo'},{id:2,name:'Destination'}]})
 check((await lookup('test',null)).status===401,'Built handler requires bearer authentication')
 const denied=Object.keys(f.actors).find(n=>n!=='owner'&&n!=='service'&&n!=='anon');assert.ok(denied)
 check((await lookup('test',denied)).status===403,'Built handler enforces settings permission')
 check((await readFile(calls,'utf8'))==='','Denied calls never invoke provider fixture')
 const connected=await lookup();check(connected.status===200&&connected.body.product_count===2,'Built GetProducts accepts both confirmed services')
 check((await lookup()).status===429,'Built lookup remains throttled')
 await reset();const synced=await lookup('sync');check(synced.status===200&&synced.body.city_count===2,'Built sync accepts documented cities and confirmed products')
 const settings=await call('/api/admin-shipping/settings');check(settings.status===200,'Built settings remains available to authorized staff')
 check(settings.headers.get('cache-control')==='private, no-store','Settings remains private and uncached')
 check(settings.body.settings.product_id===40,'Saved High Value service is preserved')
 check(JSON.stringify(settings.body.settings.products_cache)===JSON.stringify([{id:36,name:'General'},{id:40,name:'High Value(elc)'}]),'Built cache normalizes both service IDs and names')
 check(!JSON.stringify(settings.body).includes(token)&&!JSON.stringify(settings.body).includes(before.access_token_encrypted),'Built settings reveals neither raw nor encrypted credentials')
 await setScenario({products:[{productID:true,productName:'General'}],cities:[]});await reset();check((await lookup()).status===502,'Built normalizer rejects boolean ID coercion')
 await setScenario({products:[{productID:36,productName:''}],cities:[]});await reset();check((await lookup()).status===502,'Built normalizer masks empty names as provider failure')
 await setScenario({products,cities:[{productID:1,productName:'Unconfirmed city'}]});await reset();check((await lookup('sync')).status===502,'Built city parser does not infer product aliases')
 check(JSON.stringify((await f.db.query('select * from public.shipping_city_mappings order by id')).rows)===JSON.stringify(cityBefore),'All city aliases remain unchanged')
 check(JSON.stringify((await f.db.query("select product_id,origin_city_id,access_token_encrypted,is_enabled,auto_create_labels,reverse_enabled,cod_enabled from public.shipping_provider_settings where id='pdc'")).rows[0])===JSON.stringify(before),'Saved configuration and every disabled provider gate remain unchanged')
 const count=(await readFile(calls,'utf8')).trim().split('\n').length
 await stop();origin=await start(false);check((await lookup()).status===503,'Built runtime hold rejects lookups before provider access')
 check((await readFile(calls,'utf8')).trim().split('\n').length===count,'Disabled runtime makes zero fixture provider requests')
 check((await f.db.query('select count(*)::int n from public.shipping_order_jobs')).rows[0].n===0,'No booking job is created')
 check((await f.db.query('select count(*)::int n from public.shipping_webhook_events')).rows[0].n===0,'No callback event is created')
 check(digest(await inventory(output))===digest(expected),'Exact extracted artifact remains byte-identical after replay')
}catch(e){failure={name:e.name,message:e.message};throw e}
finally{await stop();if(proxy)await new Promise(r=>proxy.close(r));await f.close();await writeFile(join(dir,'server.log'),logs,{flag:'wx',mode:0o600});const report={result:failure?'FAIL':'PASS',checks:checks.length,archive_sha256:candidate.archive_sha256,inventory_sha256:candidate.inventory_sha256,assertions:checks,failure,provider_requests:0,hosted_connections:0,fixture_provider_operations:(await readFile(calls,'utf8')).trim().split('\n').filter(Boolean).length,scope:'Exact archive + disposable loopback native SQL/PostgREST + synthetic Auth/provider; runtime-on fixture does not activate production'};await writeFile(join(dir,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});console.log(JSON.stringify({result:report.result,checks:checks.length,provider_requests:0,failure}))}
