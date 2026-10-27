import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,writeFile,chmod,symlink,rm,readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {createServer} from 'node:http'
import {createApp,createRouter,toNodeListener} from 'h3'
import {build} from 'esbuild'
import {parse,compileTemplate} from '@vue/compiler-sfc'
import {readPaymentMonitorReport,projectPaymentMonitorReport} from '../server/utils/paymentMonitorReport.js'
import {createEmailFixture} from './helpers/emailFixture.mjs'

const now=Date.parse('2026-10-27T20:10:00Z')
const report=()=>({version:1,status:'WARNING',complete:true,observed_utc:'2026-10-27T20:09:00Z',last_successful_check:'2026-10-27T20:09:00Z',new_paid_order_count:0,exception_count:1,staff_attention_count:1,
 exceptions:[{id:'exception-1',code:'OVERDUE_PAYMENT_UNVERIFIED',severity:'WARNING',order:'ORDER-1',provider_evidence:'UNVERIFIED'}],
 staff_attention:[{id:'order-1',order:'ORDER-2',status:'processing',stock_fulfillment_state:'untracked'}],email_enabled:false,notification_configured:false})

test('Dashboard report exposes a strict operational projection without customer data',()=>{
 const raw=report();raw.email='CUSTOMER-CANARY';raw.service_role_key='SECRET-CANARY';raw.exceptions[0].raw='PAYMENT-SECRET-CANARY'
 const safe=projectPaymentMonitorReport(raw,now)
 assert.equal(safe.available,true);assert.equal(safe.stale,false);assert.equal(safe.exceptions[0].providerEvidence,'UNVERIFIED')
 assert.equal(safe.emailEnabled,false);assert.doesNotMatch(JSON.stringify(safe),/CANARY|service_role|stock_fulfillment/)
})

test('Dashboard recomputes heartbeat age and preserves critical evidence',()=>{
 const raw=report();raw.status='HEALTHY';raw.exception_count=0;raw.exceptions=[]
 assert.equal(projectPaymentMonitorReport(raw,now).status,'HEALTHY')
 assert.equal(projectPaymentMonitorReport(raw,now+16*60000).status,'WARNING')
 raw.complete=false;assert.equal(projectPaymentMonitorReport(raw,now).status,'WARNING')
 raw.status='CRITICAL';assert.equal(projectPaymentMonitorReport(raw,now+16*60000).status,'CRITICAL')
 raw.status='HEALTHY';raw.complete=true;raw.last_successful_check='2026-10-27T21:00:00Z'
 assert.equal(projectPaymentMonitorReport(raw,now).stale,true)
})

test('Malformed, oversized, unsafe-mode and symlink report files fail closed',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'mon01-report-')),file=join(dir,'status.json')
 try{
  assert.equal((await readPaymentMonitorReport('')).reason,'not_configured')
  assert.equal((await readPaymentMonitorReport(file)).available,false)
  await writeFile(file,JSON.stringify(report()),{mode:0o640})
  assert.equal((await readPaymentMonitorReport(file,{now})).available,true)
  await chmod(file,0o644);assert.equal((await readPaymentMonitorReport(file,{now})).available,false)
  await chmod(file,0o640);await symlink(file,join(dir,'link.json'))
  assert.equal((await readPaymentMonitorReport(join(dir,'link.json'),{now})).available,false)
  await writeFile(file,'x'.repeat(131073));assert.equal((await readPaymentMonitorReport(file)).available,false)
  await writeFile(file,'{"error":"PRIVATE-PATH-CANARY"');assert.doesNotMatch(JSON.stringify(await readPaymentMonitorReport(file)),/CANARY/)
  for(const change of [{version:2},{new_paid_order_count:-1},{exceptions:[{id:'x',code:'RAW-CUSTOMER-CANARY',severity:'CRITICAL'}]},{staff_attention:[{id:'x',order:'buyer@example.invalid',status:'processing',stock_fulfillment_state:'untracked'}]}]){
   await writeFile(file,JSON.stringify({...report(),...change}))
   assert.equal((await readPaymentMonitorReport(file,{now})).available,false)
  }
 }finally{await rm(dir,{recursive:true,force:true})}
})

test('Monitor API requires current staff Orders permission and never runs the worker',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'mon01-api-')),file=join(dir,'status.json'),f=await createEmailFixture(),key='mon01Fixture'+Date.now()
 await writeFile(file,JSON.stringify(report()),{mode:0o640})
 globalThis[key]=f.client;globalThis.defineEventHandler=fn=>fn
 globalThis.useRuntimeConfig=()=>({paymentMonitorReportPath:file})
 await f.db.query('update public.admin_users set permissions=$1 where id=$2',[JSON.stringify({'dashboard.view':true,'dashboard.orders':true}),f.actors.manager])
 const compiled=await build({entryPoints:['server/api/admin-dashboard/payment-monitor.get.js'],bundle:true,write:false,format:'esm',platform:'node',alias:{'~':resolve('app')},plugins:[{name:'mon01-fixture',setup(b){
  b.onResolve({filter:/\/supabaseAdmin(?:\.js)?$/},()=>({path:'db',namespace:'mon01'}))
  b.onLoad({filter:/.*/,namespace:'mon01'},()=>({contents:`export const getSupabaseAdminClient=()=>globalThis.${key}`,loader:'js'}))
  b.onResolve({filter:/^h3$/},()=>({path:import.meta.resolve('h3'),external:true}))
 }}]})
 const handler=(await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'))).default
 const router=createRouter().get('/api/admin-dashboard/payment-monitor',handler),app=createApp().use(router),server=createServer(toNodeListener(app))
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/api/admin-dashboard/payment-monitor'
 const call=async(actor,method='GET')=>{const r=await fetch(url+'?file=/etc/private-path-canary',{method,headers:actor?{Authorization:'Bearer '+actor}:{}});return {status:r.status,cache:r.headers.get('cache-control'),vary:r.headers.get('vary'),body:await r.text()}}
 try{
  assert.equal((await call(null)).status,401)
  for(const actor of ['customer','viewer','inactive'])assert.equal((await call(actor)).status,403)
  for(const actor of ['manager','owner']){const r=await call(actor);assert.equal(r.status,200);assert.match(r.cache,/private, no-store/);assert.match(r.vary,/Authorization/);assert.equal(JSON.parse(r.body).monitor.available,true);assert.doesNotMatch(r.body,/private-path-canary/)}
  assert.ok([404,405].includes((await call('owner','POST')).status))
  await f.db.query('update public.admin_users set is_active=false where id=$1',[f.actors.manager])
  assert.equal((await call('manager')).status,403)
 }finally{await new Promise(r=>server.close(r));await f.db.close();delete globalThis[key];await rm(dir,{recursive:true,force:true})}
})

test('Dashboard banner compiles in the existing layout with complete EN/AR labels',async()=>{
 for(const name of ['app/components/dashboard/PaymentMonitor.vue','app/layouts/dashboard.vue']){
  const {descriptor,errors}=parse(await readFile(name,'utf8'));assert.deepEqual(errors,[])
  assert.deepEqual(compileTemplate({source:descriptor.template.content,filename:name,id:'monitor'}).errors,[])
 }
 const codes=report().exceptions.map(x=>x.code)
 for(const locale of ['en','ar']){
  const messages=JSON.parse(await readFile('i18n/locales/'+locale+'.json','utf8')).paymentMonitor
  assert.ok(messages.title);assert.ok(messages.stale);for(const code of codes)assert.ok(messages.codes[code])
 }
})
