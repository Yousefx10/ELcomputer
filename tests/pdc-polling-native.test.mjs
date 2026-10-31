import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createPrivatePackingFixture} from './helpers/privatePackingFixture.mjs'
import {emailNativeAvailable} from './helpers/emailNativeDatabase.mjs'
import {encryptShippingSecret} from '../server/utils/shippingSecrets.js'
import {processPdcTracking,defaultTrackingPolicy} from '../server/utils/pdcTrackingPolling.js'
import {pdcEventKey} from '../server/utils/pdcTracking.js'
import {resolve} from 'node:path'

test('bounded tracking on real disposable107 PostgreSQL',{skip:!emailNativeAvailable},async t=>{
 const f=await createPrivatePackingFixture({extraRoutes:[['post','/api/admin-shipping/orders/:id/refresh',resolve('server/api/admin-shipping/orders/[id]/refresh.post.js')],['post','/api/internal/shipping/tracking',resolve('server/api/internal/shipping/tracking.post.js')],['get','/api/account/orders/:id',resolve('server/api/account/orders/[id].get.js')],['post','/api/webhooks/pdc',resolve('server/api/webhooks/pdc.post.js')]]})
 const previous=globalThis.useRuntimeConfig;globalThis.useRuntimeConfig=()=>f.config
 Object.assign(f.config,{shippingCredentialsEncryptionKey:'owned-local-only-shipping-encryption-key-32-characters',pdcTrackingRequestsEnabled:true,pdcTrackingWorkerEnabled:true,pdcWebhookEnabled:true,pdcTrackingWorkerSecret:'owned-tracking-worker-independent-secret-32-characters'})
 const originalRpc=f.client.rpc;f.client.rpc=(...args)=>{const promise=originalRpc(...args);promise.abortSignal=()=>promise;return promise}
 const policy={...defaultTrackingPolicy,enabled:true,max_requests_minute:5,max_requests_hour:60,max_requests_day:500,concurrency:2}
 const setting=async patch=>{const p={...policy,...patch};await f.db.query("update public.shipping_provider_settings set tracking_policy=$1,tracking_request_times='{}' where id='pdc'",[JSON.stringify(p)])}
 const make=async(opts={})=>{
  const order=randomUUID(),id=randomUUID(),ref='LOCAL-'+randomUUID(),awb='FIXTURE-'+randomUUID()
  await f.db.query("insert into public.customer_orders(id,user_id,order_number,status,payment_method,first_name,phone,street_address,city,governorate) values($1,$2,$3,'processing','cash','Owned fixture','01000000000','Owned street','Cairo','Cairo')",[order,f.actors.customer,ref])
  await f.db.query("insert into public.shipping_order_jobs(id,order_id,to_ref,awb,state,created_at,awb_verified_at,provider_identity) select $1,$2,$3,$4,'ready',now()-interval '1 day',now()-interval '1 hour',jsonb_build_object('base_url',base_url,'api_mode',api_mode,'company_id',company_id) from public.shipping_provider_settings where id='pdc'",[id,order,ref,awb])
  if(opts.verified!==false)await f.db.query("insert into private.pdc_dispatches(job_id,order_id,to_ref,token,state,awb) values($1,$2,$3,$4,'created',$5)",[id,order,ref,randomUUID(),awb])
  return {id,order,ref,awb}
 }
 const query=async(sql,args)=>f.db.query(sql,args),claim=async order=>(await query('select public.shipping_claim_pdc_tracking($1) result',[order])).rows[0].result
 const finish=async(c,success=true,code=null)=>(await query('select public.shipping_finish_pdc_tracking($1,$2,$3,$4) result',[c.job_id,c.token,success,code])).rows[0].result
 const record=async(s,patch={})=>{const u={awb:s.awb,ref:s.ref,status_id:4,status_name:'Out For Delivery',status_date:new Date(Date.now()-60000).toISOString(),source:'webhook',...patch};return (await query('select public.shipping_record_pdc_event($1) result',[JSON.stringify({...u,event_key:pdcEventKey(u)})])).rows[0].result}
 try{
  await query("update public.shipping_provider_settings set is_enabled=true,api_mode='production',company_id='123456',access_token_encrypted=$1,auto_create_labels=false where id='pdc'",[encryptShippingSecret('OWNED-LOCAL-TOKEN')]);await query("update public.shipping_provider_settings set webhook_secret_encrypted=$1 where id='pdc'",[encryptShippingSecret('owned-independent-callback-secret-over-32-characters')]);await setting({})
  await t.test('default migration leaves all outbound tracking controls disabled',async()=>{assert.equal(defaultTrackingPolicy.enabled,false);assert.equal((await query("select auto_create_labels from public.shipping_provider_settings where id='pdc'")).rows[0].auto_create_labels,false)})
  await t.test('unverified and wrong account AWBs cannot claim or ingest',async()=>{
   const s=await make({verified:false});assert.equal((await claim(s.order)).error,'not_due_or_ineligible');assert.equal((await record(s)).error,'unverified_shipment')
   const other=await make();await query("update public.shipping_order_jobs set provider_identity=provider_identity||'{\"company_id\":\"999\"}' where id=$1",[other.id]);assert.equal((await claim(other.order)).error,'not_due_or_ineligible')
  })
  await t.test('parallel native sessions claim one job once and share concurrency',async()=>{
   const s=await make(),a=await f.db.connect('service_role'),b=await f.db.connect('service_role')
   const results=await Promise.all([a,b].map(c=>c.query('select public.shipping_claim_pdc_tracking($1) result',[s.order])));const claims=results.map(r=>r.rows[0].result).filter(r=>r.token);assert.equal(claims.length,1);await finish(claims[0])
  })
  await t.test('durable minute/hour/day quotas include failed and abandoned attempts',async()=>{
   for(const [limitKey,at,count]of [['max_requests_minute','tracking_minute_at','tracking_minute_count'],['max_requests_hour','tracking_hour_at','tracking_hour_count'],['max_requests_day','tracking_day_at','tracking_day_count']]){
    await setting({[limitKey]:1});const s=await make(),c=await claim(s.order);assert.ok(c.token);await finish(c,false,'PROVIDER_UNAVAILABLE');assert.equal((await claim((await make()).order)).error,'budget')
   }await setting({})
  })
  await t.test('missing or unclaimed tokens cannot fabricate successful-check freshness',async()=>{const s=await make();assert.equal((await finish({job_id:s.id,token:null})).error,'lease_conflict');assert.equal((await query('select tracking_success_at from public.shipping_order_jobs where id=$1',[s.id])).rows[0].tracking_success_at,null)})
  await t.test('expired worker tokens cannot finish or overwrite a newer lease',async()=>{
   const s=await make(),c=await claim(s.order);await query("update public.shipping_order_jobs set tracking_lease_until=now()-interval '1 second',tracking_checked_at=now()-interval '1 hour' where id=$1",[s.id]);const next=await claim(s.order);assert.ok(next.token);assert.notEqual(next.token,c.token);assert.equal((await finish(c)).error,'lease_conflict');await finish(next)
  })
  await t.test('exponential backoff pauses automatic attempts but manual respects next due',async()=>{
   await setting({max_failures:1});const s=await make(),c=await claim(s.order),out=await finish(c,false,'PROVIDER_UNAVAILABLE');assert.equal(out.automatic_paused,true);assert.equal((await claim(s.order)).error,'not_due_or_ineligible');const row=(await query('select tracking_failures,extract(epoch from tracking_next_at-now()) seconds from public.shipping_order_jobs where id=$1',[s.id])).rows[0];assert.equal(row.tracking_failures,1);assert.ok(Number(row.seconds)>1700);await setting({})
  })
  await t.test('shared ingestion deduplicates and never regresses terminal shipment or payment',async()=>{
   const s=await make(),before=(await query('select * from public.customer_orders where id=$1',[s.order])).rows[0]
   await record(s,{status_id:5,status_name:'Delivered',status_date:new Date(Date.now()-120000).toISOString()})
   const duplicate=await record(s,{status_id:5,status_name:'Delivered'});assert.equal(duplicate.duplicate,true)
   const regression=await record(s,{status_id:4,status_name:'Out For Delivery'});assert.equal(regression.regression,true)
   assert.equal((await query('select normalized_state from public.shipping_order_jobs where id=$1',[s.id])).rows[0].normalized_state,'delivered')
   assert.equal((await claim(s.order)).error,'not_due_or_ineligible');assert.deepEqual((await query('select * from public.customer_orders where id=$1',[s.order])).rows[0],before)
   assert.equal((await query("select projection_disposition from public.shipping_webhook_events where order_ref=$1 and provider_status_id=4",[s.ref])).rows[0].projection_disposition,'regression')
  })
  await t.test('conflicting numeric ID and provider label never fabricate delivery',async()=>{const s=await make();const r=await record(s,{status_id:5,status_name:'Shipped'});assert.equal(r.regression,true);assert.equal((await query('select normalized_state from public.shipping_order_jobs where id=$1',[s.id])).rows[0].normalized_state,'unknown');assert.equal((await query('select projection_disposition from public.shipping_webhook_events where order_ref=$1',[s.ref])).rows[0].projection_disposition,'conflict')})
  await t.test('out-of-order and future callbacks do not fabricate delivery',async()=>{
   const s=await make();await record(s)
   const old=await record(s,{status_id:3,status_name:'Received At Branch',status_date:new Date(Date.now()-3600000).toISOString()});assert.equal(old.stale,true)
   assert.equal((await record(s,{status_id:5,status_name:'Delivered',status_date:new Date(Date.now()+3600000).toISOString()})).error,'future_event')
   assert.equal((await query('select normalized_state from public.shipping_order_jobs where id=$1',[s.id])).rows[0].normalized_state,'out_for_delivery')
  })
  await t.test('scheduler uses only GetShipmentsStatus and unchanged updates keep one event',async()=>{
   await setting({});const s=await make(),calls=[]
   const fetcher=async(url,options)=>{calls.push({url:String(url),body:JSON.parse(options.body)});assert.ok(String(url).endsWith('/GetShipmentsStatus'));assert.equal(options.redirect,'error');return Response.json([{AWB:s.awb,Ref:s.ref,Status:'Out For Delivery',StatusID:4}])}
   const r=await processPdcTracking({db:f.client,orderId:s.order,fetcher});assert.equal(r.checked,1);assert.equal(calls.length,1)
   await query("update public.shipping_order_jobs set tracking_next_at=now()-interval '1 second',tracking_checked_at=now()-interval '1 hour' where id=$1",[s.id]);await processPdcTracking({db:f.client,orderId:s.order,fetcher});assert.equal((await query('select count(*)::int n from public.shipping_webhook_events where order_ref=$1',[s.ref])).rows[0].n,1)
  })
  await t.test('strict rolling windows cannot burst across a clock boundary',async()=>{
   await setting({max_requests_minute:2});await query("update public.shipping_provider_settings set tracking_request_times=array[clock_timestamp()-interval '59 seconds',clock_timestamp()-interval '1 second'] where id='pdc'")
   assert.equal((await claim((await make()).order)).error,'budget');await setting({})
  })
  await t.test('policy constraints reject missing, unknown and out-of-range controls',async()=>{
   for(const policyValue of [{...policy,concurrency:3},{...policy,max_requests_day:501},{...policy,enabled:'true'},{...policy,unknown:1},Object.fromEntries(Object.entries(policy).filter(([k])=>k!=='interval_seconds'))])await assert.rejects(query("update public.shipping_provider_settings set tracking_policy=$1 where id='pdc'",[JSON.stringify(policyValue)]))
  })
  await t.test('verified owner timeline hides diagnostics; foreign ownership and unverified AWBs withheld',async()=>{
   await setting({});const owned=await make();await record(owned,{reason:'PRIVATE_DIAGNOSTIC_CANARY'});
   const r=await f.call('/api/account/orders/'+owned.order,{actor:'customer'});assert.equal(r.response.status,200,JSON.stringify(r.body));assert.equal(r.body.shipping.booking_verified,true);assert.equal(r.body.shipping.awb,owned.awb);assert.ok(!JSON.stringify(r.body.shipping).includes('PRIVATE_DIAGNOSTIC_CANARY'));assert.ok(!JSON.stringify(r.body.shipping).includes('provider_identity'))
   assert.equal((await f.call('/api/account/orders/'+owned.order,{actor:'owner'})).response.status,404)
   const unverified=await make({verified:false}),hidden=await f.call('/api/account/orders/'+unverified.order,{actor:'customer'});assert.equal(hidden.response.status,200);assert.equal(hidden.body.shipping.awb,null);assert.equal(hidden.body.shipping.events.length,0)
  })
  await t.test('authenticated scheduled route has bounded requests with global booking OFF',async()=>{
   await setting({});await make();f.config.shippingLiveRequestsEnabled=false;f.config.pdcWebhookEnabled=false
   const original=globalThis.fetch,calls=[]
   globalThis.fetch=async(url,options)=>{
    if(new URL(String(url)).hostname==='127.0.0.1')return original(url,options)
    assert.ok(String(url).endsWith('/GetShipmentsStatus'));const body=JSON.parse(options.body);calls.push(body);const row=(await query('select to_ref from public.shipping_order_jobs where awb=$1',[body.awBs])).rows[0]
    return Response.json([{AWB:body.awBs,Ref:row.to_ref,Status:'Out For Delivery',StatusID:4}])
   }
   try{const r=await f.call('/api/internal/shipping/tracking',{actor:null,method:'POST',headers:{'x-pdc-tracking-secret':f.config.pdcTrackingWorkerSecret}});assert.equal(r.response.status,200,JSON.stringify(r.body));assert.ok(r.body.checked>0&&r.body.checked<=3);assert.ok(calls.length<=3);assert.equal(r.body.provider_writes,0);assert.deepEqual(Object.keys(r.body).sort(),['checked','empty','failed','provider_writes'])}finally{globalThis.fetch=original;f.config.pdcWebhookEnabled=true}
  })
  await t.test('authenticated callbacks share ingestion, replay protection and financial separation',async()=>{
   const s=await make(),before=(await query('select * from public.customer_orders where id=$1',[s.order])).rows[0],body={AWB:s.awb,REF:s.ref,StatusID:'5',CustomerStatusName:'Delivered',StatusDate:new Date(Date.now()-60000).toISOString(),ReasonName:'PRIVATE-CALLBACK-DIAGNOSTIC'}
   for(const secret of ['', 'wrong'])assert.equal((await f.call('/api/webhooks/pdc',{actor:null,method:'POST',body,headers:{'x-webhook-secret':secret}})).response.status,401)
   const headers={'x-webhook-secret':'owned-independent-callback-secret-over-32-characters'}
   const first=await f.call('/api/webhooks/pdc',{actor:null,method:'POST',body,headers});assert.equal(first.response.status,200,JSON.stringify(first.body));assert.equal(first.body.received,true)
   const duplicate=await f.call('/api/webhooks/pdc',{actor:null,method:'POST',body,headers});assert.equal(duplicate.body.duplicate,true)
   assert.equal((await query('select count(*)::int n from public.shipping_webhook_events where order_ref=$1',[s.ref])).rows[0].n,1)
   assert.deepEqual((await query('select * from public.customer_orders where id=$1',[s.order])).rows[0],before)
   assert.equal((await f.call('/api/webhooks/pdc',{actor:null,method:'POST',body:{...body,AWB:'OTHER'},headers})).response.status,409)
   f.config.pdcWebhookEnabled=false;assert.equal((await f.call('/api/webhooks/pdc',{actor:null,method:'POST',body,headers})).response.status,503);f.config.pdcWebhookEnabled=true
  })
  await t.test('slow polling response cannot overwrite a newer authenticated callback',async()=>{
   await setting({});const s=await make(),c=await claim(s.order);assert.ok(c.token);await record(s,{status_id:5,status_name:'Delivered'})
   const old=await record(s,{status_id:4,status_name:'Out For Delivery',status_date:null,source:'reconciliation',observed_at:c.observed_at});assert.equal(old.stale,true);assert.equal(old.regression,true);await finish(c)
   assert.equal((await query('select normalized_state from public.shipping_order_jobs where id=$1',[s.id])).rows[0].normalized_state,'delivered')
  })
  await t.test('public database callers cannot reserve quotas or read private tracking metadata',async()=>{
   for(const role of ['anon','authenticated']){const c=await f.db.connect(role);for(const sql of ["select public.shipping_claim_pdc_tracking(null)","select public.shipping_pdc_tracking_metadata(null)","select * from private.pdc_dispatches"])await assert.rejects(c.query(sql),e=>e.code==='42501')}
  })
  await t.test('worker secret and staff permissions gate every provider-capable endpoint',async()=>{
   const s=await make();for(const actor of [null,'customer','viewer','disabled']){const r=await f.call('/api/admin-shipping/orders/'+s.order+'/refresh',{actor,method:'POST'});assert.ok([401,403].includes(r.response.status))}
   assert.equal((await f.call('/api/internal/shipping/tracking',{actor:null,method:'POST'})).response.status,401)
   f.config.pdcTrackingWorkerEnabled=false;assert.equal((await f.call('/api/internal/shipping/tracking',{actor:null,method:'POST',headers:{'x-pdc-tracking-secret':f.config.pdcTrackingWorkerSecret}})).response.status,503)
  })
  await t.test('disabled tracking gates reserve nothing and make no provider calls',async()=>{
   const s=await make();f.config.pdcTrackingRequestsEnabled=false;let calls=0;await assert.rejects(processPdcTracking({db:f.client,orderId:s.order,fetcher:async()=>calls++}),e=>e.statusCode===503);assert.equal(calls,0);assert.equal((await query('select tracking_token from public.shipping_order_jobs where id=$1',[s.id])).rows[0].tracking_token,null)
  })
 }finally{globalThis.useRuntimeConfig=previous;await f.close()}
})
