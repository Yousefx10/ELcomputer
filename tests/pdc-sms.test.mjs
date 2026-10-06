import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { createApp, defineEventHandler, toNodeListener } from 'h3'
import { createOrderSmsFixture } from './helpers/orderSmsFixture.mjs'
import { processOrderSmsEvents, renderOrderSms, validateOrderSmsSetting } from '../server/utils/sms/orderEvents.js'
import { createSmsService, processSmsQueue } from '../server/utils/sms/service.js'
import { persistPdcUpdate, pdcEventKey } from '../server/utils/pdcTracking.js'
import { reconcilePdcShipment } from '../server/utils/pdcLookups.js'
import { handlePdcWebhook } from '../server/utils/pdcWebhook.js'
import { encryptShippingSecret } from '../server/utils/shippingSecrets.js'
import { shipmentReasonKey } from '../app/utils/shipmentTracking.js'
import { pdcSmsEvents } from '../app/utils/orderSms.js'

const migration = '20261006120000_pdc_sms_notifications.sql'
const webhookSecret = 'pdc-sms-fictional-webhook-secret-at-least-32-characters'
globalThis.useRuntimeConfig = () => ({ credentialsEncryptionKey:'pdc-sms-fictional-master-at-least-32-characters', shippingCredentialsEncryptionKey:'pdc-sms-fictional-shipping-master-at-least-32-characters', shippingLiveRequestsEnabled:false })

test('PDC normalized durable transitions consume the existing SMS intent/Notification architecture', async t => {
  const f=await createOrderSmsFixture({stopBefore:migration}), {db,client}=f
  const sql=(text,args=[])=>db.query(text,args)
  const make=async ({locale='en',phone}={})=>{
    const order=await f.checkout({locale}), row=await f.order(order.id), id=randomUUID(), awb='AWB-'+randomUUID()
    if(phone!==undefined) await sql('update public.customer_orders set phone=$2 where id=$1',[order.id,phone])
    await sql('insert into public.shipping_order_jobs(id,order_id,to_ref,awb) values($1,$2,$3,$4)',[id,order.id,row.order_number,awb])
    return {id,order:order.id,ref:row.order_number,awb}
  }
  const date=(offset=0)=>new Date(Date.now()+2500+offset).toISOString()
  const update=(job,changes={})=>({awb:job.awb,ref:job.ref,status_id:4,status_name:'Out For Delivery',reason:'',status_date:date(),source:'webhook',...changes})
  const record=async data=>persistPdcUpdate(client,data)
  const events=async job=>(await f.events(job.order)).filter(e=>e.event_type.startsWith('pdc_'))
  const jobRow=async job=>(await sql('select * from public.shipping_order_jobs where id=$1',[job.id])).rows[0]
  const clear=async()=>db.exec("update public.sms_order_events set status='suppressed',reason='expired',lease_token=null where status in ('pending','preparing'); update public.sms_batches set status='failed',failure_category='expired' where status='queued'; update public.sms_provider_settings set next_request_at=null")
  const enable=async()=>{
    await f.enable()
    await db.exec("update public.sms_order_event_settings set is_enabled=false where event_type not like 'pdc_%'; update public.sms_templates set is_enabled=true where category='pdc'; update public.sms_order_event_settings set is_enabled=true where event_type like 'pdc_%'")
  }
  try {
    const historical=await make()
    await record(update(historical,{status_id:5,status_name:'Delivered',status_date:new Date(Date.now()-86400000).toISOString()}))
    const historicEvents=(await sql('select * from public.shipping_webhook_events')).rows
    const historicJobs=(await sql('select * from public.shipping_order_jobs')).rows
    const mappings=(await sql('select * from public.shipping_status_mappings')).rows
    const provider=(await sql('select * from public.sms_provider_settings')).rows
    const originals=(await sql("select proname,prosrc from pg_proc where proname in ('shipping_record_pdc_event','sms_order_event_reason') order by proname")).rows
    await db.exec(await readFile(new URL('../supabase/migrations/'+migration,import.meta.url),'utf8'))
    await t.test('migration preserves PDC/order/provider data and original bodies; defaults three controls/templates off with no backfill',async()=>{
      assert.deepEqual((await sql('select * from public.shipping_webhook_events')).rows,historicEvents)
      assert.deepEqual((await sql('select * from public.shipping_order_jobs')).rows,historicJobs)
      assert.deepEqual((await sql('select * from public.shipping_status_mappings')).rows,mappings)
      assert.deepEqual((await sql('select * from public.sms_provider_settings')).rows,provider)
      assert.equal((await sql("select count(*)::int n from public.sms_order_events where event_type like 'pdc_%'")).rows[0].n,0)
      const controls=(await sql("select * from public.sms_order_event_settings where event_type like 'pdc_%'")).rows
      assert.equal(controls.length,3);assert.ok(controls.every(c=>!c.is_enabled&&c.config_revision===0))
      assert.equal((await sql("select count(*)::int n from public.sms_templates where category='pdc' and is_enabled")).rows[0].n,0)
      for(const original of originals){const name=original.proname==='shipping_record_pdc_event'?'shipping_record_pdc_event_before_sms':'sms_order_event_reason_before_pdc_sms';assert.equal((await sql('select prosrc from pg_proc where proname=$1',[name])).rows[0].prosrc,original.prosrc)}
      assert.equal((await record(update(historical,{status_id:5,status_name:'Delivered'}))).duplicate,true)
      assert.equal((await events(historical)).length,0)
    })
    await t.test('existing RLS/RBAC boundaries deny browser tables and all canonical/renamed PDC functions',async()=>{
      for(const role of ['anon','authenticated']){
        await db.exec('set role '+role)
        for(const table of ['sms_order_events','sms_order_event_settings','shipping_webhook_events']) await assert.rejects(()=>sql('select * from public.'+table),/permission denied/)
        for(const name of ['shipping_record_pdc_event','shipping_record_pdc_event_before_sms']) await assert.rejects(()=>sql("select public."+name+"('{}')"),/permission denied/)
        await db.exec('reset role')
      }
      assert.equal((await sql("select has_function_privilege('service_role','public.shipping_record_pdc_event_before_sms(jsonb)','execute') allowed")).rows[0].allowed,false)
      assert.equal((await sql("select has_function_privilege('service_role','public.shipping_record_pdc_event(jsonb)','execute') allowed")).rows[0].allowed,true)
    })
    await t.test('Vodafone disabled commits tracking and terminal history; enabling cannot revive it',async()=>{
      const job=await make();await record(update(job))
      assert.equal((await jobRow(job)).normalized_state,'out_for_delivery')
      assert.equal((await events(job))[0].reason,'provider_disabled')
      await enable();await processOrderSmsEvents(client)
      assert.equal((await events(job))[0].batch_id,null);assert.equal((await f.batches()).length,0)
    })
    await t.test('Out for Delivery is transition-based and normalized mapping, not raw ID/name',async()=>{
      await sql("insert into public.shipping_status_mappings(provider_status_id,provider_label,normalized_state) values(424242,'Unrelated provider text','out_for_delivery')")
      const job=await make();await record(update(job,{status_id:424242,status_name:'NOT OUT FOR DELIVERY'}))
      assert.equal((await events(job))[0].event_type,'pdc_out_for_delivery')
      const first=(await events(job))[0]
      await record(update(job,{status_id:424242,reason:'changed',status_date:date(2000)}))
      await record(update(job,{status_date:date(3000)}))
      assert.deepEqual((await events(job))[0],first);assert.equal((await events(job)).length,1)
      await clear()
    })
    await t.test('concurrent webhook/reconciliation and worker preparation create one intent/batch/message',async()=>{
      const job=await make(), data=update(job)
      await Promise.all([record(data),record({...data,source:'reconciliation'})])
      assert.equal((await events(job)).length,1)
      await Promise.all([processOrderSmsEvents(client),processOrderSmsEvents(client)])
      const intent=(await events(job))[0]
      assert.equal(intent.status,'queued');assert.ok(intent.batch_id)
      assert.equal((await sql('select count(*)::int n from public.sms_batches where id=$1',[intent.batch_id])).rows[0].n,1)
      const message=(await sql('select * from public.sms_messages where batch_id=$1',[intent.batch_id])).rows[0]
      assert.equal(message.recipient,'+201012345678');assert.ok(message.body.includes(job.awb))
      assert.equal((await sql('select traffic_type from public.sms_batches where id=$1',[intent.batch_id])).rows[0].traffic_type,'notification')
      await clear()
    })
    await t.test('Delivered is authoritative and at most once; older Out for Delivery cannot regress state or notify',async()=>{
      const job=await make(), delivered=date(30000)
      await record(update(job,{status_id:5,status_name:'Arbitrary raw label',status_date:delivered}))
      const before=await jobRow(job)
      assert.equal((await events(job))[0].event_type,'pdc_delivered')
      assert.equal((await record(update(job,{status_date:date()}))).stale,true)
      assert.deepEqual(await jobRow(job),before)
      assert.equal((await events(job)).length,1)
      await record(update(job,{status_id:5,status_date:date(40000)}))
      assert.equal((await events(job)).length,1)
      await clear()
    })
    await t.test('Delivered is not inferred from raw unknown labels and ambiguous StatusID 97 stays neutral',async()=>{
      for(const id of [97,987654]){
        const job=await make();await record(update(job,{status_id:id,status_name:'Delivered'}))
        assert.equal((await jobRow(job)).normalized_state,'unknown');assert.equal((await events(job)).length,0)
      }
    })
    await t.test('only meaningful delivery_attempted exceptions notify; internal held/delayed/reason updates do not',async()=>{
      const job=await make(), start=Date.now()+10000
      for(const [index,id] of [91,94,96].entries()) await record(update(job,{status_id:id,status_date:new Date(start+index*1000).toISOString(),reason:'Not Home'}))
      assert.equal((await events(job)).length,0)
      await record(update(job,{status_id:15,status_date:new Date(start+4000).toISOString(),reason:'Not Home'}))
      assert.equal((await events(job))[0].event_type,'pdc_delivery_exception')
      await record(update(job,{status_id:87,status_date:new Date(start+5000).toISOString(),reason:'No Answer'}))
      assert.equal((await events(job)).length,1)
      await clear()
    })
    await t.test('exception duplicate/re-entry remains once per AWB because PDC has no reliable separate attempt identity',async()=>{
      const job=await make(), start=Date.now()+10000
      await record(update(job,{status_id:15,status_date:new Date(start).toISOString(),reason:'Not Home'}))
      await record(update(job,{status_id:15,status_date:new Date(start+1000).toISOString(),reason:'No Answer'}))
      await record(update(job,{status_date:new Date(start+2000).toISOString()}))
      await record(update(job,{status_id:89,status_date:new Date(start+3000).toISOString(),reason:'Wrong Phone Number'}))
      assert.equal((await events(job)).filter(e=>e.event_type==='pdc_delivery_exception').length,1)
      assert.equal((await sql('select count(*)::int n from public.shipping_webhook_events where shipment_job_id=$1',[job.id])).rows[0].n,3)
      await clear()
    })
    await t.test('unknown provider reasons remain private; controlled known categories and neutral fallback render in EN/AR',async()=>{
      for(const locale of ['en','ar']) for(const reason of ['INTERNAL_DIAGNOSTIC_CANARY','Not Home']){
        const job=await make({locale});await record(update(job,{status_id:15,reason}))
        const intent=(await events(job))[0]
        assert.equal(JSON.stringify(intent).includes(reason),false)
        await processOrderSmsEvents(client)
        const saved=(await events(job))[0], message=(await sql('select body from public.sms_messages where batch_id=$1',[saved.batch_id])).rows[0]
        assert.ok(!message.body.includes('INTERNAL_DIAGNOSTIC_CANARY'))
        if(reason==='Not Home') assert.ok(message.body.includes(locale==='en'?'Recipient unavailable':'المستلم غير متواجد'))
        else assert.ok(message.body.includes(locale==='en'?'Please contact us':'يرجى التواصل'))
        const known=renderOrderSms(intent,shipmentReasonKey(reason));assert.equal(known,message.body)
        assert.ok(!renderOrderSms(intent,'PRIVATE_RAW_CANARY').includes('CANARY'))
        await clear()
      }
    })
    await t.test('each event disabled at capture is terminal with no later activation backlog',async()=>{
      for(const [type,id] of [['pdc_out_for_delivery',4],['pdc_delivery_exception',15],['pdc_delivered',5]]){
        await sql('update public.sms_order_event_settings set is_enabled=false where event_type=$1',[type])
        const job=await make();await record(update(job,{status_id:id}))
        assert.equal((await events(job))[0].reason,'event_disabled')
        await sql('update public.sms_order_event_settings set is_enabled=true where event_type=$1',[type])
        await processOrderSmsEvents(client);assert.equal((await events(job))[0].batch_id,null)
      }
    })
    await t.test('unconfigured credentials, missing runtime encryption and unavailable template cannot build a backlog',async()=>{
      const encrypted=(await sql('select hash_secret_encrypted from public.sms_provider_settings')).rows[0].hash_secret_encrypted
      await assert.rejects(()=>sql('update public.sms_provider_settings set hash_secret_encrypted=null'),/check constraint/)
      await sql('update public.sms_provider_settings set is_enabled=false,hash_secret_encrypted=null')
      const job=await make();await record(update(job));assert.equal((await events(job))[0].reason,'provider_disabled')
      await sql('update public.sms_provider_settings set hash_secret_encrypted=$1',[encrypted]);await enable()
      await processOrderSmsEvents(client);assert.equal((await events(job))[0].batch_id,null)
      const missing=await make();await record(update(missing))
      const runtime=globalThis.useRuntimeConfig;globalThis.useRuntimeConfig=()=>({credentialsEncryptionKey:''})
      try{await processOrderSmsEvents(client)}finally{globalThis.useRuntimeConfig=runtime}
      assert.equal((await events(missing))[0].reason,'provider_not_ready')
      await sql("update public.sms_templates set is_enabled=false where code='pdc_out_for_delivery'")
      const unavailable=await make();await record(update(unavailable));assert.equal((await events(unavailable))[0].reason,'template_unavailable')
      await sql("update public.sms_templates set is_enabled=true where code='pdc_out_for_delivery'")
      await processOrderSmsEvents(client);assert.equal((await events(unavailable))[0].batch_id,null)
    })
    await t.test('invalid/missing order phone skips safely; later account/order phone changes cannot redirect the snapshot',async()=>{
      for(const phone of ['', 'not-a-phone']){
        const job=await make({phone});await record(update(job));await processOrderSmsEvents(client)
        assert.equal((await events(job))[0].reason,'invalid_phone');assert.equal((await jobRow(job)).normalized_state,'out_for_delivery')
      }
      const job=await make({phone:'01012345678'});await record(update(job))
      await sql("update public.customer_orders set phone='01187654321' where id=$1",[job.order])
      await processOrderSmsEvents(client)
      const intent=(await events(job))[0]
      assert.equal((await sql('select recipient from public.sms_messages where batch_id=$1',[intent.batch_id])).rows[0].recipient,'+201012345678')
      await clear()
    })
    await t.test('safe PDC variables and historical English locale fallback use order contact/AWB, not provider labels',async()=>{
      const job=await make(), intentTemplate={event_type:'pdc_delivered',locale:'en',template_text:'{{customer_name}} {{order_number}} {{awb}} {{courier_name}}',payload:{customer_name:'Buyer',order_number:job.ref,awb:job.awb}}
      assert.equal(renderOrderSms(intentTemplate),'Buyer '+job.ref+' '+job.awb+' PDC')
      await record(update(job,{status_id:5,status_name:'Arabic?'}));assert.equal((await events(job))[0].locale,'en')
      const template=(await sql("select id from public.sms_templates where code='pdc_delivered'")).rows[0].id
      await assert.rejects(()=>validateOrderSmsSetting(client,{event_type:'pdc_delivered',is_enabled:true,config_revision:0,template_en_id:null,template_ar_id:template}),e=>e.statusCode===400)
      const orderTemplate=(await sql("select id from public.sms_templates where code='order_confirmed'")).rows[0].id
      await assert.rejects(()=>validateOrderSmsSetting(client,{event_type:'pdc_delivered',is_enabled:true,config_revision:0,template_en_id:orderTemplate,template_ar_id:orderTemplate}),e=>e.statusCode===400)
      assert.throws(()=>renderOrderSms({...intentTemplate,template_text:'{{provider_status_id}}'}))
      const intent=(await events(job))[0]
      await assert.rejects(()=>createSmsService(client).sendCampaign({recipients:['01012345678'],text:'Fixture',idempotencyKey:intent.idempotency_key,orderEvent:{id:intent.id,token:randomUUID(),templateId:template}}),e=>e.statusCode===400)
      await clear()
    })
    await t.test('a new dated reconciliation transition can notify; its matching webhook cannot duplicate',async()=>{
      const job=await make(), providerDate=date(), config=(await sql('select * from public.shipping_provider_settings')).rows[0]
      config.access_token_encrypted=encryptShippingSecret('pdc-sms-fictional-access-token')
      const requests=[]
      const result=await reconcilePdcShipment(client,config,job.order,async(url,request)=>{
        requests.push([url,JSON.parse(request.body)])
        return new Response(JSON.stringify([{AWB:job.awb,Ref:job.ref,StatusID:4,Status:'Out For Delivery',Reason:'',StatusDate:providerDate}]))
      })
      assert.equal(result.received,true);assert.equal(requests.length,1)
      assert.deepEqual(requests[0][1],{awBs:job.awb,reFs:job.ref})
      assert.equal((await events(job))[0].provider_event_at.toISOString(),providerDate)
      await record(update(job,{status_date:providerDate}));assert.equal((await events(job)).length,1)
      await clear()
    })
    await t.test('undated reconciliation is terminal, and later enrichment cannot revive a skipped event',async()=>{
      const job=await make();await record(update(job,{source:'reconciliation',status_date:null}))
      assert.equal((await events(job))[0].reason,'event_time_unknown')
      assert.equal((await record(update(job))).enriched,true)
      assert.equal((await events(job)).length,1);assert.equal((await events(job))[0].batch_id,null)
      await processOrderSmsEvents(client);assert.equal((await events(job))[0].status,'suppressed')
    })
    await t.test('pre-feature event observations and duplicates cannot backfill historical SMS',async()=>{
      const job=await make();await record(update(job,{status_id:5,status_date:new Date(Date.now()-86400000).toISOString()}))
      assert.equal((await jobRow(job)).normalized_state,'delivered');assert.equal((await events(job)).length,0)
    })
    await t.test('event before current enablement, expired or implausibly future time cannot enqueue',async()=>{
      const job=await make()
      const started=(await sql("select capture_started_at from public.sms_order_event_settings where event_type='pdc_out_for_delivery'")).rows[0].capture_started_at
      await sql("update public.sms_order_event_settings set is_enabled=false where event_type='pdc_out_for_delivery'")
      await sql("update public.sms_order_event_settings set is_enabled=true where event_type='pdc_out_for_delivery'")
      await record(update(job,{status_date:new Date(new Date(started).getTime()+1).toISOString()}))
      assert.equal((await events(job))[0].reason,'stale_event')
      const future=await make();await record(update(future,{status_date:date(600000)}));assert.equal((await events(future))[0].reason,'stale_event')
      const expired=await make();await record(update(expired));await sql("update public.sms_order_events set expires_at=now()-interval '1 second' where shipment_job_id=$1",[expired.id])
      await processOrderSmsEvents(client);assert.equal((await events(expired))[0].reason,'expired')
    })
    await t.test('reconciliation started before a delivered webhook remains stale and cannot notify Out for Delivery',async()=>{
      const job=await make(), before=new Date().toISOString()
      await record(update(job,{status_id:5,status_date:date(1000)}))
      const saved=await jobRow(job)
      const result=await record(update(job,{source:'reconciliation',status_date:null,observed_at:before}))
      assert.equal(result.stale,true);assert.deepEqual(await jobRow(job),saved)
      assert.deepEqual((await events(job)).map(e=>e.event_type),['pdc_delivered'])
      await clear()
    })
    await t.test('queued older milestone is cancelled when shipment advances or mapping changes before dispatch',async()=>{
      const job=await make();await record(update(job));await processOrderSmsEvents(client)
      const queued=(await events(job))[0]
      await record(update(job,{status_id:5,status_date:date(10000)}))
      let posts=0;await processSmsQueue(client,{provider:{submit:async()=>{posts++;throw Error('Unexpected send')}}})
      assert.equal(posts,0);assert.equal((await sql('select status from public.sms_batches where id=$1',[queued.batch_id])).rows[0].status,'failed')
      await clear()
      const changed=await make();await record(update(changed));await processOrderSmsEvents(client)
      const pending=(await events(changed))[0]
      await sql("update public.shipping_status_mappings set normalized_state='unknown' where provider_status_id=4")
      await processSmsQueue(client,{provider:{submit:async()=>{posts++;throw Error('Unexpected send')}}})
      assert.equal(posts,0);assert.equal((await sql('select status from public.sms_batches where id=$1',[pending.batch_id])).rows[0].status,'failed')
      await sql("update public.shipping_status_mappings set normalized_state='out_for_delivery' where provider_status_id=4");await clear()
    })
    await t.test('final post-DNS guard blocks PDC disablement before any mocked provider POST',async()=>{
      const job=await make();await record(update(job));await processOrderSmsEvents(client)
      const intent=(await events(job))[0];let posts=0
      const provider={submit:async(_a,_b,_c,_d,_e,beforePost)=>{
        await sql("update public.sms_order_event_settings set is_enabled=false where event_type='pdc_out_for_delivery'")
        await beforePost();posts++;throw Error('Unexpected POST')
      }}
      await processSmsQueue(client,{provider});assert.equal(posts,0)
      assert.equal((await sql('select status from public.sms_batches where id=$1',[intent.batch_id])).rows[0].status,'failed')
      await sql("update public.sms_order_event_settings set is_enabled=true where event_type='pdc_out_for_delivery'");await clear()
    })
    await t.test('Arabic transactional output uses the central segment cap without changing tracking',async()=>{
      const template=(await sql("select * from public.sms_templates where code='pdc_out_for_delivery'")).rows[0]
      await sql("update public.sms_templates set text_ar=$1 where id=$2",['😀'.repeat(400),template.id])
      const job=await make({locale:'ar'});await record(update(job));await processOrderSmsEvents(client)
      assert.equal((await events(job))[0].reason,'segment_limit');assert.equal((await events(job))[0].batch_id,null)
      assert.equal((await jobRow(job)).normalized_state,'out_for_delivery')
      await sql('update public.sms_templates set text_ar=$1 where id=$2',[template.text_ar,template.id])
    })
    await t.test('SMS settings/template edits and disablement invalidate pending preparation without changing tracking',async()=>{
      const job=await make();await record(update(job));const before=await jobRow(job)
      await sql("update public.sms_order_event_settings set is_enabled=false where event_type='pdc_out_for_delivery'")
      await sql("update public.sms_order_event_settings set is_enabled=true where event_type='pdc_out_for_delivery'")
      await processOrderSmsEvents(client);assert.equal((await events(job))[0].reason,'configuration_changed')
      assert.deepEqual(await jobRow(job),before)
    })
    await t.test('unexpected SMS capture failure preserves tracking/history/Broadcast and attempts a safe terminal audit',async()=>{
      const job=await make(), beforeOrder=await f.order(job.order)
      await db.exec("create function public.pdc_sms_test_failure() returns trigger language plpgsql as $$ begin if new.event_type like 'pdc_%' and new.payload<>'{}' then raise exception 'PRIVATE_PDC_FAILURE_CANARY'; end if; return new; end $$; create trigger pdc_sms_test_failure before insert on public.sms_order_events for each row execute function public.pdc_sms_test_failure()")
      assert.equal((await record(update(job))).received,true)
      assert.equal((await events(job))[0].reason,'capture_failed');assert.deepEqual((await events(job))[0].payload,{})
      assert.equal((await jobRow(job)).normalized_state,'out_for_delivery');assert.deepEqual(await f.order(job.order),beforeOrder)
      assert.equal((await sql('select count(*)::int n from public.shipping_webhook_events where shipment_job_id=$1',[job.id])).rows[0].n,1)
      await db.exec('drop trigger pdc_sms_test_failure on public.sms_order_events;drop function public.pdc_sms_test_failure()')
    })
    await t.test('actual secret-authenticated webhook is independent of Vodafone latency and acknowledges committed tracking despite total SMS-storage failure',async()=>{
      const job=await make()
      await sql('update public.shipping_provider_settings set is_enabled=true,webhook_secret_encrypted=$1',[encryptShippingSecret(webhookSecret)])
      const app=createApp();app.use('/pdc',defineEventHandler(event=>handlePdcWebhook(event,client)))
      const server=createServer(toNodeListener(app));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
      const url=`http://127.0.0.1:${server.address().port}/pdc`
      const body={AWB:job.awb,REF:job.ref,StatusID:4,CustomerStatusName:'Out For Delivery',StatusDate:date(),ReasonName:'PRIVATE_REASON_CANARY',AccessToken:'PRIVATE_TOKEN_CANARY'}
      const headers={'content-type':'application/json','x-webhook-secret':webhookSecret}
      try{
        const history=(await sql('select count(*)::int n from public.shipping_webhook_events')).rows[0].n
        assert.equal((await fetch(url,{method:'POST',headers:{...headers,'x-webhook-secret':'wrong'},body:JSON.stringify(body)})).status,401)
        assert.equal((await sql('select count(*)::int n from public.shipping_webhook_events')).rows[0].n,history)
        await db.exec("create function public.pdc_sms_test_failure() returns trigger language plpgsql as $$ begin if new.event_type like 'pdc_%' then raise exception 'PRIVATE_FAILURE_CANARY'; end if; return new; end $$;create trigger pdc_sms_test_failure before insert on public.sms_order_events for each row execute function public.pdc_sms_test_failure()")
        const started=Date.now(), response=await fetch(url,{method:'POST',headers,body:JSON.stringify(body)})
        assert.equal(response.status,200);assert.ok(Date.now()-started<1500)
        const text=await response.text();for(const secret of [webhookSecret,'PRIVATE_','01012345678']) assert.ok(!text.includes(secret))
        assert.equal((await jobRow(job)).normalized_state,'out_for_delivery');assert.equal((await events(job)).length,0)
        await db.exec('drop trigger pdc_sms_test_failure on public.sms_order_events;drop function public.pdc_sms_test_failure()')
        assert.equal((await record(update(job))).duplicate,true);assert.equal((await events(job)).length,0)
        const fresh=await make(), request={...body,AWB:fresh.awb,REF:fresh.ref,StatusDate:date()}
        assert.equal((await fetch(url,{method:'POST',headers,body:JSON.stringify(request)})).status,200)
        assert.equal((await events(fresh))[0].status,'pending');assert.equal((await events(fresh))[0].batch_id,null)
        await clear()
      }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
    })
    await t.test('SMS enqueue outage retries locally without changing shipment state or duplicating the eventual central message',async()=>{
      const job=await make();await record(update(job));const before=await jobRow(job)
      const failing={...client,rpc:(name,args)=>name==='sms_enqueue_order_event'?Promise.resolve({error:{message:'PRIVATE_QUEUE_CANARY'}}):client.rpc(name,args)}
      await processOrderSmsEvents(failing);assert.equal((await events(job))[0].status,'pending')
      await sql('update public.sms_order_events set available_at=now() where shipment_job_id=$1',[job.id])
      await processOrderSmsEvents(client);const intent=(await events(job))[0]
      assert.equal(intent.status,'queued');assert.deepEqual(await jobRow(job),before)
      assert.equal((await sql('select count(*)::int n from public.sms_messages where batch_id=$1',[intent.batch_id])).rows[0].n,1)
      await clear()
    })
    await t.test('ambiguous Vodafone result remains uncertain with no automatic resend or tracking side effect',async()=>{
      const job=await make();await record(update(job));await processOrderSmsEvents(client)
      const intent=(await events(job))[0], before=await jobRow(job);let posts=0
      const provider={submit:async(_a,_b,_c,_d,_e,beforePost)=>{await beforePost();posts++;throw Error('mock post uncertainty')}}
      await processSmsQueue(client,{provider});await processSmsQueue(client,{provider})
      assert.equal(posts,1);assert.equal((await sql('select status from public.sms_batches where id=$1',[intent.batch_id])).rows[0].status,'uncertain')
      assert.deepEqual(await jobRow(job),before)
    })
    await t.test('a mapping correction cannot masquerade as a new milestone on the next different raw observation',async()=>{
      const job=await make(), start=Date.now()+10000
      await record(update(job,{status_id:424243,status_name:'Previously unknown',status_date:new Date(start).toISOString()}))
      assert.equal((await jobRow(job)).normalized_state,'unknown')
      await sql("insert into public.shipping_status_mappings(provider_status_id,provider_label,normalized_state) values(424243,'Previously unknown','out_for_delivery')")
      await record(update(job,{status_date:new Date(start+1000).toISOString()}))
      assert.equal((await jobRow(job)).normalized_state,'out_for_delivery')
      assert.equal((await events(job)).length,0)
    })
    await t.test('state changes from manual maintenance and mapping edits cannot themselves create courier SMS intents',async()=>{
      const job=await make();await sql("update public.shipping_order_jobs set normalized_state='delivered' where id=$1",[job.id])
      await sql("update public.shipping_status_mappings set updated_at=now() where provider_status_id=4")
      assert.equal((await events(job)).length,0)
      assert.equal(pdcSmsEvents.length,3)
    })
  }finally{await db.close()}
})
