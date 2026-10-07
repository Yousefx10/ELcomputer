import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { createServer } from 'node:http'
import { build } from 'esbuild'
import { createApp, createRouter, toNodeListener } from 'h3'
import { createOrderSmsFixture } from './helpers/orderSmsFixture.mjs'

test('real after-sales HTTP routes enforce Settings RBAC, customer ownership, private responses and bounded writes',async t=>{
 const f=await createOrderSmsFixture(),{db,client}=f
 const actors={owner:f.owner,buyer:f.customer,viewer:randomUUID(),editor:randomUUID(),disabled:randomUUID(),orphanEditor:randomUUID(),stranger:randomUUID(),anonymous:randomUUID()}
 for(const name of ['viewer','editor','disabled','orphanEditor','stranger','anonymous']) await db.query('insert into auth.users(id,email) values($1,$2)',[actors[name],name+'@example.invalid'])
 for(const [name,permissions] of [['viewer',{'settings.view':true}],['editor',{'settings.view':true,'settings.edit':true}],['disabled',{'settings.view':true,'settings.edit':true}],['orphanEditor',{'settings.edit':true}]]) await db.query("insert into public.admin_users(id,email,role,permissions,is_active) values($1,$2,'admin',$3,$4)",[actors[name],name+'@example.invalid',JSON.stringify(permissions),name!=='disabled'])
 client.auth={getUser:async token=>({data:{user:actors[token]?{id:actors[token],is_anonymous:token==='anonymous'}:null},error:null})}
 globalThis.afterSalesApiDatabase=client;globalThis.defineEventHandler=handler=>handler
 const router=createRouter()
 for(const [method,route,file]of [
  ['get','/api/admin-after-sales/policy','server/api/admin-after-sales/policy.get.js'],['patch','/api/admin-after-sales/policy','server/api/admin-after-sales/policy.patch.js'],['get','/api/admin-after-sales/reasons','server/api/admin-after-sales/reasons.get.js'],['post','/api/admin-after-sales/reasons','server/api/admin-after-sales/reasons.post.js'],['get','/api/admin-after-sales/catalog','server/api/admin-after-sales/catalog.get.js'],['get','/api/account/orders/:id','server/api/account/orders/[id].get.js']]){
  const compiled=await build({entryPoints:[resolve(file)],bundle:true,write:false,format:'esm',platform:'node',alias:{'~':resolve('app')},plugins:[{name:'isolated-database',setup(builder){builder.onResolve({filter:/\/supabaseAdmin$/},()=>({path:'supabaseAdmin',namespace:'after-sales-test'}));builder.onLoad({filter:/.*/,namespace:'after-sales-test'},()=>({contents:'export const getSupabaseAdminClient=()=>globalThis.afterSalesApiDatabase',loader:'js'}));builder.onResolve({filter:/^h3$/},()=>({path:import.meta.resolve('h3'),external:true}))}}]})
  router[method](route,(await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'))).default)
 }
 const server=createServer(toNodeListener(createApp().use(router)));await new Promise(r=>server.listen(0,'127.0.0.1',r))
 const call=async(path,{actor='owner',method='GET',body,raw}={})=>{const response=await fetch('http://127.0.0.1:'+server.address().port+path,{method,headers:{authorization:actor?'Bearer '+actor:'','content-type':'application/json'},...(body||raw?{body:raw??JSON.stringify(body)}:{})});return {response,body:await response.json()}}
 const patch={scope:'global',section:'returns',revision:1,values:{return_enabled:true,return_start_basis:'order_date',return_opened:'allowed',return_packaging:'not_required'}}
 try{
  await t.test('staff read requires settings.view; write requires view + edit; inactive and customer actors denied',async()=>{
   for(const [actor,status]of [[null,401],['buyer',403],['stranger',403],['anonymous',403],['disabled',403],['orphanEditor',403]])for(const path of ['/api/admin-after-sales/policy','/api/admin-after-sales/reasons','/api/admin-after-sales/catalog?kind=product']) assert.equal((await call(path,{actor})).response.status,status,actor+' '+path)
   for(const actor of ['viewer','buyer','disabled','orphanEditor'])assert.equal((await call('/api/admin-after-sales/policy',{actor,method:'PATCH',body:patch})).response.status,403)
   const view=await call('/api/admin-after-sales/policy',{actor:'viewer'});assert.equal(view.response.status,200);assert.equal(view.response.headers.get('cache-control'),'private, no-store');assert.equal(view.body.record.updated_by,undefined)
   assert.equal((await call('/api/admin-after-sales/policy',{actor:'editor',method:'PATCH',body:patch})).response.status,200)
   assert.equal((await call('/api/admin-after-sales/policy',{method:'PATCH',body:patch})).response.status,409)
  })
  await t.test('malformed, oversized, unknown fields and invalid scalar/list bodies cannot mutate policies',async()=>{
   for(const values of [{return_enabled:'true'},{return_window_days:366},{return_window_days:1.2},{return_opened:'code'},{return_fallback_bases:['order_date','order_date']},{policy_timezone:'bad/zone'},{warranty_duration_value:12},{return_enabled:null}])assert.equal((await call('/api/admin-after-sales/policy',{method:'PATCH',body:{...patch,revision:2,values}})).response.status,400)
   assert.equal((await call('/api/admin-after-sales/policy',{method:'PATCH',raw:'['})).response.status,400)
   assert.equal((await call('/api/admin-after-sales/policy',{method:'PATCH',raw:JSON.stringify({padding:'a'.repeat(17000)})})).response.status,413)
   assert.equal((await call('/api/admin-after-sales/policy?scope=product&id=bad')).response.status,400)
   assert.equal((await call('/api/admin-after-sales/policy?scope=product&id='+randomUUID())).response.status,400)
  })
  await t.test('product scoped editor returns inherited policy and actual item label; nullable overrides restore inheritance',async()=>{
   const path='/api/admin-after-sales/policy?scope=product&id='+f.product
   let result=await call(path);assert.equal(result.response.status,200);assert.equal(result.body.scope_item.id,f.product);assert.equal(result.body.parent.policy.return_window_days,14)
   const body={scope:'product',id:f.product,section:'overrides',revision:0,values:{return_window_days:30,return_enabled:false}}
   assert.equal((await call('/api/admin-after-sales/policy',{method:'PATCH',body})).response.status,200)
   result=await call(path);assert.equal(result.body.effective.policy.return_window_days,30);assert.equal(result.body.parent.policy.return_window_days,14)
   assert.equal((await call('/api/admin-after-sales/policy',{method:'PATCH',body:{...body,revision:1,values:{return_window_days:null,return_enabled:null}}})).response.status,200)
   assert.equal((await call(path)).body.effective.policy.return_window_days,14)
   assert.equal((await call('/api/admin-after-sales/catalog?kind=product&q=Order')).body.items[0].id,f.product)
  })
  await t.test('stable bilingual reasons have bounded metadata, stale revision and atomic audit',async()=>{
   const reason={key:'new_reason',label_en:'New reason',label_ar:'سبب جديد',is_enabled:true,sort_order:12,fault:'seller',shipping:'elcomputer',opened:'allowed',evidence:'required',revision:0}
   for(const actor of ['viewer','buyer','disabled'])assert.equal((await call('/api/admin-after-sales/reasons',{actor,method:'POST',body:reason})).response.status,403)
   assert.equal((await call('/api/admin-after-sales/reasons',{method:'POST',body:reason})).response.status,200)
   assert.equal((await call('/api/admin-after-sales/reasons',{method:'POST',body:reason})).response.status,409)
   assert.equal((await call('/api/admin-after-sales/reasons',{method:'POST',body:{...reason,key:'arbitrary text'}})).response.status,400)
   const logs=(await db.query("select metadata from public.admin_activity_logs where action_key='settings.after_sales.reason'")).rows;assert.equal(logs.length,1);assert.equal(logs[0].metadata.after.key,'new_reason')
  })
  await db.query("update public.products set warranty_status='included',warranty_duration_value=12,warranty_duration_unit='months' where id=$1",[f.product]);
  let revision=(await call('/api/admin-after-sales/policy')).body.record.revision
  await call('/api/admin-after-sales/policy',{method:'PATCH',body:{scope:'global',section:'warranty',revision,values:{warranty_enabled:true,warranty_start_basis:'order_date',warranty_resolutions:['repair']}}})
  const order=await f.checkout()
  await t.test('owner gets server-derived warranty dates; stranger/anonymous/disabled denied, sensitive metadata absent',async()=>{
   const path='/api/account/orders/'+order.id,result=await call(path,{actor:'buyer'});assert.equal(result.response.status,200,JSON.stringify(result.body));assert.equal(result.response.headers.get('cache-control'),'private, no-store');assert.equal(result.body.items[0].after_sales.warranty.period.status,'active');assert.ok(result.body.items[0].after_sales.warranty.period.expiry_date);assert.doesNotMatch(JSON.stringify(result.body),/after_sales_policy_version_id|version_key|updated_by|author_email/)
   for(const [actor,status]of [[null,401],['stranger',404],['anonymous',403]])assert.equal((await call(path,{actor})).response.status,status)
   await db.query('update public.customer_profiles set is_active=false where id=$1',[f.customer]);assert.equal((await call(path,{actor:'buyer'})).response.status,403)
  })
 }finally{await new Promise(r=>server.close(r));delete globalThis.afterSalesApiDatabase;await db.close()}
})
