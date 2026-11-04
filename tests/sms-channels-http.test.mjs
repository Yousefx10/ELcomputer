import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {resolve} from 'node:path'
import {createServer} from 'node:http'
import {build} from 'esbuild'
import {createApp,createRouter,toNodeListener} from 'h3'
import {createOrderSmsFixture} from './helpers/orderSmsFixture.mjs'
import {unsubscribeToken} from '../server/utils/sms/marketing.js'
test('actual authenticated SMS channel HTTP handlers, disabled workers and generic unsubscribe',async()=>{
 const f=await createOrderSmsFixture(),{db,client}=f,key='smsHttp'+randomUUID().replaceAll('-',''),viewer=randomUUID()
 await db.query("insert into auth.users(id,email) values($1,'sms-channel-viewer@example.invalid')",[viewer]);await db.query("insert into public.admin_users(id,email,role,permissions) values($1,'sms-channel-viewer@example.invalid','admin','{\"sms.view\":true,\"sms.marketing.view\":true,\"sms.settings.view\":true}')",[viewer])
 const actors={owner:f.owner,viewer};client.auth={getUser:async token=>({data:{user:actors[token]?{id:actors[token]}:null},error:null})};globalThis[key]=client;globalThis.defineEventHandler=fn=>fn
 const runtime={credentialsEncryptionKey:'isolated-http-master-at-least-32-characters',smsWorkerSecret:'isolated-worker-secret-at-least-32-characters',smsTransactionalEnabled:false,smsMarketingEnabled:false,smsUnsubscribeSecret:'isolated-unsubscribe-secret-at-least-32-characters',smsUnsubscribePreviousSecrets:'[]',public:{siteUrl:'https://merchant.example.invalid'}}
 globalThis.useRuntimeConfig=()=>runtime
 const router=createRouter()
 for(const file of ['server/api/admin-sms/transactional.get.js','server/api/admin-sms/transactional.patch.js','server/api/admin-sms/marketing.get.js','server/api/admin-sms/marketing.post.js','server/api/admin-sms/send.post.js','server/api/sms/unsubscribe.post.js','server/api/internal/sms/process.post.js']){
  const match=file.match(/\.(get|post|patch)\.js$/),path='/'+file.replace(/^server\//,'').replace(/\.(get|post|patch)\.js$/,'')
  const compiled=await build({entryPoints:[resolve(file)],bundle:true,write:false,format:'esm',platform:'node',alias:{'~':resolve('app')},plugins:[{name:'isolated-sms-db',setup(b){b.onResolve({filter:/\/supabaseAdmin(?:\.js)?$/},()=>({path:'db',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`export const getSupabaseAdminClient=()=>globalThis.${key}`,loader:'js'}));b.onResolve({filter:/^h3$/},()=>({path:import.meta.resolve('h3'),external:true}))}}]})
  router[match[1]](path,(await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'))).default)
 }
 const server=createServer(toNodeListener(createApp().use(router)));await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port
 const call=async(path,{actor='owner',method='GET',body}={})=>{const r=await fetch(origin+path,{method,headers:{authorization:actor?'Bearer '+actor:'','content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,headers:r.headers,text:await r.text()}}
 try{
  for(const path of ['/api/admin-sms/transactional','/api/admin-sms/marketing']){const anon=await call(path,{actor:''});assert.equal(anon.status,401);assert.equal(anon.headers.get('cache-control'),'private, no-store');assert.equal((await call(path,{actor:'viewer'})).status,200)}
  const denied=await call('/api/admin-sms/marketing',{actor:'viewer',method:'POST',body:{action:'import',contacts:[]}});assert.equal(denied.status,403)
  assert.equal((await call('/api/admin-sms/marketing',{method:'POST',body:{action:'import',contacts:[{phone:'01012345678',opt_in:false}]}})).status,400)
  assert.equal((await call('/api/admin-sms/marketing',{method:'POST',body:{action:'import',contacts:[{phone:'01012345678',locale:'ar',tags:[],opt_in:true,consented_at:new Date(Date.now()-1000).toISOString(),consent_reference:'isolated-owner-consent',source_reference:'isolated-owned-source'}]}})).status,200)
  const contact=(await db.query('select id from private.sms_marketing_contacts')).rows[0].id,token=unsubscribeToken(contact,runtime)
  const valid=await call('/api/sms/unsubscribe',{actor:'',method:'POST',body:{token}}),invalid=await call('/api/sms/unsubscribe',{actor:'',method:'POST',body:{token:'invalid'}})
  assert.equal(valid.status,200);assert.equal(valid.text,invalid.text);assert.equal(valid.headers.get('referrer-policy'),'no-referrer');assert.equal((await db.query('select count(*)::int n from private.sms_marketing_suppressions')).rows[0].n,1)
  assert.equal((await call('/api/internal/sms/process',{actor:'',method:'POST',body:{}})).status,404)
  assert.equal((await call('/api/admin-sms/send',{method:'POST',body:{trafficType:'campaign',idempotencyKey:randomUUID()}})).status,409)
  const settings=await call('/api/admin-sms/marketing');for(const secret of [runtime.credentialsEncryptionKey,runtime.smsWorkerSecret,runtime.smsUnsubscribeSecret,token])assert.ok(!settings.text.includes(secret),'Private configuration must stay absent')
 }finally{await new Promise(r=>server.close(r));delete globalThis[key];await db.close()}
})
