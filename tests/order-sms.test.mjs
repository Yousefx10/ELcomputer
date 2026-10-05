import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createOrderSmsFixture } from './helpers/orderSmsFixture.mjs'
import { processOrderSmsEvents, renderOrderSms, validateOrderSmsSetting } from '../server/utils/sms/orderEvents.js'
import { createSmsService, processSmsQueue } from '../server/utils/sms/service.js'
import { normalizeSmsPhone } from '../app/utils/sms.js'
import { vodafoneProvider, VODAFONE_NAMESPACE } from '../server/utils/sms/vodafone.js'

globalThis.useRuntimeConfig = () => ({ credentialsEncryptionKey: 'order-sms-isolated-master-at-least-32-characters' })
const migration = '20261006100000_order_sms_notifications.sql'

test('order transitions, durable intent, central Notification queue and terminal suppression', async t => {
  const f = await createOrderSmsFixture({ stopBefore: migration })
  const { db, client } = f
  const sql = (text, args = []) => db.query(text, args)
  const clear = async () => db.exec("update public.sms_order_events set status='suppressed',reason='expired',lease_token=null where status in ('pending','preparing'); update public.sms_batches set status='failed',failure_category='expired' where status='queued'; update public.sms_provider_settings set next_request_at=null")
  try {
    const historical = await f.checkout()
    const before = await f.order(historical.id)
    const pdc = (await sql('select * from public.shipping_provider_settings')).rows
    await db.exec(await readFile(new URL('../supabase/migrations/' + migration, import.meta.url), 'utf8'))
    await t.test('additive migration preserves historical orders/PDC, creates no replay and defaults automation/templates off', async () => {
      const after = await f.order(historical.id)
      assert.deepEqual({ ...after, sms_locale: undefined }, { ...before, sms_locale: undefined })
      assert.deepEqual((await sql('select * from public.shipping_provider_settings')).rows, pdc)
      assert.equal((await sql('select count(*)::int n from public.sms_order_events')).rows[0].n, 0)
      assert.equal((await sql('select count(*)::int n from public.sms_order_event_settings where is_enabled')).rows[0].n, 0)
      assert.equal((await sql("select count(*)::int n from public.sms_templates where category='orders' and is_enabled")).rows[0].n, 0)
    })
    await t.test('RLS and grants deny browser access to intents/configuration and worker RPCs', async () => {
      for (const role of ['anon','authenticated']) {
        await db.exec('set role ' + role)
        for (const table of ['sms_order_events','sms_order_event_settings']) await assert.rejects(() => sql('select * from public.' + table), /permission denied/)
        await assert.rejects(() => sql('select public.sms_claim_order_event()'), /permission denied/)
        await assert.rejects(() => sql('select public.commerce_create_customer_order_before_order_sms(null,null,null,false,null)'), /permission denied/)
        await db.exec('reset role')
      }
    })
    await t.test('successful Cash checkout records confirmed only; disabled Vodafone never queues historical backlog', async () => {
      const cart = randomUUID(), created = await f.checkout({ cart })
      assert.equal((await f.order(created.id)).payment_status, 'pending')
      assert.deepEqual((await f.events(created.id)).map(e => [e.event_type,e.status,e.reason]), [['order_confirmed','suppressed','provider_disabled']])
      assert.equal((await f.checkout({ cart })).id, created.id)
      assert.equal((await f.events(created.id)).length, 1)
      await f.enable()
      await processOrderSmsEvents(client)
      assert.equal((await f.batches()).length, 0)
      assert.equal((await f.events(created.id))[0].status, 'suppressed')
    })
    await t.test('rolled-back and failed checkout persist neither order nor notification', async () => {
      let id
      await db.exec('begin')
      id = (await f.checkout()).id
      assert.equal((await f.events(id)).length, 1)
      await assert.rejects(() => sql('select 1/0'), /division by zero/)
      await db.exec('rollback')
      assert.equal(await f.order(id), undefined)
      assert.equal((await f.events(id)).length, 0)
      const count = (await sql('select count(*)::int n from public.sms_order_events')).rows[0].n
      await assert.rejects(() => sql("select public.commerce_create_customer_order($1,'{}','[]',false,$2)", [f.customer,randomUUID()]))
      assert.equal((await sql('select count(*)::int n from public.sms_order_events')).rows[0].n, count)
    })
    await t.test('processing/cancellation use transitions, ignore repeated saves and suppress re-entry duplicates', async () => {
      const created = await f.checkout()
      await sql("update public.customer_orders set status='processing' where id=$1", [created.id])
      await sql("update public.customer_orders set status='processing',updated_at=now() where id=$1", [created.id])
      await sql("update public.customer_orders set status='on_hold' where id=$1", [created.id])
      await sql("update public.customer_orders set status='processing' where id=$1", [created.id])
      assert.equal((await f.events(created.id)).filter(e => e.event_type==='processing').length, 1)
      await db.exec('begin')
      await sql("update public.customer_orders set status='cancelled' where id=$1", [created.id])
      await assert.rejects(() => sql('select 1/0'))
      await db.exec('rollback')
      assert.equal((await f.events(created.id)).filter(e => e.event_type==='cancelled').length, 0)
      assert.equal((await f.order(created.id)).status, 'processing')
      await sql("update public.customer_orders set status='cancelled' where id=$1", [created.id])
      await sql("update public.customer_orders set status='cancelled' where id=$1", [created.id])
      assert.equal((await f.events(created.id)).filter(e => e.event_type==='cancelled').length, 1)
      await clear()
    })
    await t.test('verified preorder partial payment is separate; full paid transition notifies once', async () => {
      const created = await f.checkout({ preorder:true, method:'bank_transfer' })
      await sql('select public.commerce_record_preorder_payment($1,$2,10,$3)', [created.id,f.owner,'receipt-partial'])
      assert.equal((await f.order(created.id)).payment_status, 'partially_paid')
      assert.equal((await f.events(created.id)).filter(e => e.event_type==='payment_confirmed').length, 0)
      const balance = Number((await f.order(created.id)).total_amount)-10
      await sql('select public.commerce_record_preorder_payment($1,$2,$3,$4)', [created.id,f.owner,balance,'receipt-final'])
      await assert.rejects(() => sql('select public.commerce_record_preorder_payment($1,$2,1,$3)', [created.id,f.owner,'receipt-final']))
      assert.equal((await f.events(created.id)).filter(e => e.event_type==='payment_confirmed').length, 1)
      assert.equal((await f.order(created.id)).status, 'on_hold')
      await clear()
    })
    await t.test('Paymob test success never confirms commerce payment; live fixture success/replays notify once', async () => {
      for (const mode of ['test','live']) {
        const created = await f.checkout({ method:'card' }), providerOrder = mode==='test'?'810001':'810002'
        const total = Number((await f.order(created.id)).total_amount)
        await sql("insert into public.payment_attempts(order_id,mode,integration_id,amount_minor,currency,status,provider_order_id) values($1,$2,12345,$3,'EGP','pending',$4)", [created.id,mode,total*100,providerOrder])
        const transaction = { status:'succeeded',mode,transaction_id: mode==='test'?'910001':'910002',provider_order_id:providerOrder,integration_id:12345,amount_minor:total*100,currency:'EGP' }
        await sql('select public.commerce_reconcile_payment_transaction($1)', [JSON.stringify(transaction)])
        await sql('select public.commerce_reconcile_payment_transaction($1)', [JSON.stringify(transaction)])
        await sql('select public.commerce_reconcile_payment_transaction($1)', [JSON.stringify({ ...transaction,status:'failed' })])
        const events = await f.events(created.id)
        assert.equal(events.filter(e => e.event_type==='payment_confirmed').length, mode==='live'?1:0)
        assert.equal(events.filter(e => e.event_type==='processing').length, mode==='live'?1:0)
        assert.equal((await f.order(created.id)).payment_status, mode==='live'?'paid':'pending')
      }
      await clear()
    })
    await t.test('event disabled at capture remains skipped after re-enable with no sendable queue', async () => {
      await sql("update public.sms_order_event_settings set is_enabled=false where event_type='order_confirmed'")
      const created = await f.checkout()
      assert.equal((await f.events(created.id))[0].reason, 'event_disabled')
      await sql("update public.sms_order_event_settings set is_enabled=true where event_type='order_confirmed'")
      await processOrderSmsEvents(client)
      assert.equal((await f.events(created.id))[0].status, 'suppressed')
      assert.equal((await f.events(created.id))[0].batch_id, null)
    })
    await t.test('missing runtime encryption is terminal; later readiness cannot revive the event', async () => {
      const created=await f.checkout()
      const runtime=globalThis.useRuntimeConfig
      globalThis.useRuntimeConfig=()=>({credentialsEncryptionKey:''})
      try { await processOrderSmsEvents(client) } finally { globalThis.useRuntimeConfig=runtime }
      assert.equal((await f.events(created.id))[0].reason,'provider_not_ready')
      await processOrderSmsEvents(client)
      assert.equal((await f.events(created.id))[0].batch_id,null)
    })
    await t.test('English/Arabic locale snapshots, safe variables and authoritative money use order values', async () => {
      for (const locale of ['en','ar']) {
        const created = await f.checkout({ locale })
        const event = (await f.events(created.id))[0]
        assert.equal((await f.order(created.id)).sms_locale, locale)
        assert.equal(event.locale, locale)
        assert.equal(event.payload.order_total, '130.50')
        const text = renderOrderSms(event)
        const all = renderOrderSms({ ...event, template_text:'{{customer_name}}|{{order_number}}|{{order_total}}|{{currency}}|{{order_status}}|{{payment_method}}' })
        assert.ok(all.includes('Buyer Fixture'));assert.ok(all.includes('EGP'))
        assert.ok(all.includes(locale==='ar'?JSON.parse(await readFile(new URL('../i18n/locales/ar.json',import.meta.url),'utf8')).common.cash:'Cash'))
        assert.ok(text.includes(created.order_number))
        assert.ok(text.includes('130.50'))
        assert.ok(locale==='ar'?text.includes('تم تأكيد'):text.includes('confirmed'))
        await sql('update public.products set price=199.99 where id=$1', [f.product])
        await sql("update public.customer_profiles set phone='01199999999' where id=$1", [f.customer])
        assert.equal(event.payload.phone,'01012345678')
        assert.equal(renderOrderSms(event),text)
        await sql('update public.products set price=125.50 where id=$1', [f.product])
      }
      const fallback = await f.checkout({locale:'unrecognized'})
      assert.equal((await f.order(fallback.id)).sms_locale,'en')
      await clear()
    })
    await t.test('missing/invalid order phone is skipped without account fallback or commerce failure', async () => {
      for(const phone of ['', 'not a phone']) {
      const created = await f.checkout()
      await sql("update public.customer_orders set phone=$2,status='processing' where id=$1", [created.id,phone])
      await processOrderSmsEvents(client)
      assert.equal((await f.events(created.id)).find(e=>e.event_type==='processing').reason,'invalid_phone')
      assert.equal((await f.order(created.id)).status,'processing')
      await clear()
      }
    })
    await t.test('Notification-only bindings reject Campaign, unknown variables, missing translation and inactive templates', async () => {
      const row = (await sql("select * from public.sms_order_event_settings where event_type='order_confirmed'")).rows[0]
      await validateOrderSmsSetting(client,{ ...row,is_enabled:true })
      const campaign = (await sql("insert into public.sms_templates(code,name,text_en,traffic_type,is_enabled) values('wrong_campaign','Campaign','Fixture','campaign',true) returning id")).rows[0].id
      await assert.rejects(()=>validateOrderSmsSetting(client,{...row,template_en_id:campaign}),/Invalid/)
      await sql("update public.sms_templates set text_ar='' where id=$1",[row.template_ar_id])
      await assert.rejects(()=>validateOrderSmsSetting(client,{...row,is_enabled:true}),/Invalid/)
      await sql("update public.sms_templates set text_ar='تم تأكيد الطلب {{order_number}}. الإجمالي: {{order_total}}.' where id=$1",[row.template_ar_id])
      assert.throws(()=>renderOrderSms({payload:{},locale:'en',template_text:'{{private_notes}}'}),/Unsupported/)
      await assert.rejects(()=>createSmsService(client).sendCampaign({orderEvent:{id:randomUUID()}}),/Notification/)
    })
    await t.test('Arabic uses shared segmentation; oversized rendered output is terminal without affecting orders', async () => {
      const template = (await sql("select id from public.sms_templates where code='order_confirmed'")).rows[0].id
      await sql('update public.sms_templates set text_ar=$1,updated_at=clock_timestamp() where id=$2',['ا'.repeat(1000),template])
      const created = await f.checkout({locale:'ar'})
      await processOrderSmsEvents(client)
      assert.equal((await f.events(created.id))[0].reason,'segment_limit')
      assert.equal((await f.order(created.id)).payment_status,'pending')
      await sql("update public.sms_templates set text_ar='تم تأكيد الطلب {{order_number}}. الإجمالي: {{order_total}}.',updated_at=clock_timestamp() where id=$1",[template])
    })
    await t.test('concurrent worker preparation enqueues one central batch and one message per event with history linkage', async () => {
      const created = await f.checkout()
      await Promise.all([processOrderSmsEvents(client),processOrderSmsEvents(client),processOrderSmsEvents(client)])
      const event = (await f.events(created.id))[0]
      assert.equal(event.status,'queued')
      const batch = (await sql('select * from public.sms_batches where id=$1',[event.batch_id])).rows[0]
      assert.equal(batch.traffic_type,'notification')
      assert.equal(batch.trigger_source,'order:order_confirmed')
      assert.equal(batch.idempotency_key,'order:'+created.id+':order_confirmed')
      assert.equal(batch.template_id,event.template_id)
      assert.match(batch.external_trx_id,/^ELC-/)
      const messages = (await sql('select * from public.sms_messages where batch_id=$1',[batch.id])).rows
      assert.equal(messages.length,1);assert.equal(messages[0].recipient,normalizeSmsPhone('01012345678'))
      assert.equal(messages[0].body,renderOrderSms(event));assert.ok(messages[0].segments>0)
      assert.equal((await f.events(created.id))[0].recipient_masked,'+201••••••678')
      await clear()
    })
    await t.test('queue failure leaves a bounded durable retry and atomically completes only once after recovery', async () => {
      const created = await f.checkout()
      const fault = { ...client,rpc:(name,args)=>name==='sms_enqueue_order_event'?Promise.resolve({error:{message:'PRIVATE_DB_FIXTURE'}}):client.rpc(name,args) }
      const result = await processOrderSmsEvents(fault)
      assert.ok(result.processed.some(p=>p.status==='deferred'))
      assert.equal((await f.events(created.id))[0].status,'pending');assert.equal((await f.events(created.id))[0].batch_id,null)
      await sql("update public.sms_order_events set available_at=now()-interval '1 second' where order_id=$1",[created.id])
      await processOrderSmsEvents(client)
      const event=(await f.events(created.id))[0]
      assert.equal(event.status,'queued')
      assert.equal((await sql('select count(*)::int n from public.sms_batches where idempotency_key=$1',[event.idempotency_key])).rows[0].n,1)
      await clear()
    })
    await t.test('order intent reaches the central Vodafone Notification serializer through a mocked transport', async () => {
      const created=await f.checkout({locale:'ar'});await processOrderSmsEvents(client)
      const before=await f.order(created.id),paths=[]
      const provider={submit:(s,c,b,m,_transport,beforePost)=>vodafoneProvider.submit(s,c,b,m,async(url,_xml,_timeout,checkDispatch)=>{
        await checkDispatch();paths.push(url.pathname)
        return {status:200,body:`<SubmitSMSResponse xmlns="${VODAFONE_NAMESPACE}"><SMSStatus>SUBMITTED</SMSStatus><ResultStatus>SUCCESS</ResultStatus></SubmitSMSResponse>`}
      },beforePost)}
      const result=await processSmsQueue(client,{provider})
      assert.deepEqual(paths,['/web2sms/sms/submit/Notification'])
      assert.equal(result.processed[0].status,'submitted')
      assert.deepEqual(await f.order(created.id),before)
      const event=(await f.events(created.id))[0]
      assert.equal((await sql('select encoding from public.sms_messages where batch_id=$1',[event.batch_id])).rows[0].encoding,'utf16')
      for(const value of ['isolated-account','isolated-password','AB'.repeat(16),'01012345678'])assert.ok(!JSON.stringify(result).includes(value))
    })
    await t.test('a late live payment fixture for a cancelled order cannot create paid or processing notifications', async () => {
      const created=await f.checkout({method:'card'})
      await sql("insert into public.payment_attempts(order_id,mode,integration_id,amount_minor,currency,status,provider_order_id) values($1,'live',12345,12550,'EGP','pending','810003')",[created.id])
      await sql("update public.customer_orders set status='cancelled' where id=$1",[created.id])
      await sql('select public.commerce_reconcile_payment_transaction($1)',[JSON.stringify({status:'succeeded',mode:'live',transaction_id:'910003',provider_order_id:'810003',integration_id:12345,amount_minor:12550,currency:'EGP'})])
      const events=await f.events(created.id)
      assert.equal(events.filter(e=>e.event_type==='payment_confirmed'||e.event_type==='processing').length,0)
      assert.equal((await f.order(created.id)).payment_status,'pending')
      await clear()
    })
    await t.test('disable/re-enable, template edits and expiry invalidate pending work without backlog', async () => {
      const created=await f.checkout()
      await sql("update public.sms_order_event_settings set is_enabled=false where event_type='order_confirmed'")
      await sql("update public.sms_order_event_settings set is_enabled=true where event_type='order_confirmed'")
      await processOrderSmsEvents(client)
      assert.equal((await f.events(created.id))[0].reason,'configuration_changed')
      const edited=await f.checkout()
      await sql("update public.sms_templates set updated_at=clock_timestamp() where code='order_confirmed'")
      await processOrderSmsEvents(client)
      assert.equal((await f.events(edited.id))[0].reason,'template_unavailable')
      const expired=await f.checkout()
      await sql("update public.sms_order_events set expires_at=now()-interval '1 second' where order_id=$1",[expired.id])
      await processOrderSmsEvents(client)
      assert.equal((await f.events(expired.id))[0].reason,'expired')
    })
    await t.test('event disable after DNS/preflight blocks the first provider operation', async () => {
      const created=await f.checkout()
      await processOrderSmsEvents(client)
      let calls=0
      const provider={submit:async(_s,_c,_j,_m,_transport,beforePost)=>{
        await sql("update public.sms_order_event_settings set is_enabled=false where event_type='order_confirmed'")
        await beforePost();calls++
        return {messages:[{status:'submitted'}]}
      }}
      await processSmsQueue(client,{provider})
      assert.equal(calls,0)
      const event=(await f.events(created.id))[0]
      assert.equal((await sql('select status from public.sms_batches where id=$1',[event.batch_id])).rows[0].status,'failed')
      await sql("update public.sms_order_event_settings set is_enabled=true where event_type='order_confirmed'")
      assert.equal((await f.order(created.id)).payment_status,'pending')
    })
    await t.test('provider uncertainty never changes commerce and never automatically resends', async () => {
      const created=await f.checkout();await processOrderSmsEvents(client)
      await sql("update public.sms_provider_settings set next_request_at=null")
      const before=await f.order(created.id);let calls=0
      const provider={submit:async()=>{calls++;throw Error('PRIVATE_PROVIDER_FIXTURE')}}
      await processSmsQueue(client,{provider});await processSmsQueue(client,{provider})
      assert.equal(calls,1);assert.deepEqual(await f.order(created.id),before)
      const event=(await f.events(created.id))[0], batch=(await sql('select * from public.sms_batches where id=$1',[event.batch_id])).rows[0]
      assert.equal(batch.status,'uncertain');assert.equal(batch.failure_category,'provider_result_unknown')
      assert.ok(!JSON.stringify(batch).includes('PRIVATE_PROVIDER_FIXTURE'))
    })
    await t.test('preparation lease recovery rejects the resumed stale worker without duplicate queue insertion', async () => {
      const created=await f.checkout(), old=(await client.rpc('sms_claim_order_event')).data
      assert.equal(old.order_id,created.id)
      await sql("update public.sms_order_events set locked_at=now()-interval '3 minutes' where id=$1",[old.id])
      const current=(await client.rpc('sms_claim_order_event')).data
      assert.notEqual(old.lease_token,current.lease_token)
      await assert.rejects(()=>createSmsService(client).sendNotification({recipients:['01012345678'],text:renderOrderSms(old),sender:old.sender,idempotencyKey:old.idempotency_key,triggerSource:'order:'+old.event_type,expiresAt:new Date(old.expires_at).toISOString(),orderEvent:{id:old.id,token:old.lease_token,templateId:old.template_id}}),/could not be queued/)
      assert.equal((await f.events(created.id))[0].batch_id,null)
      await clear()
    })
    await t.test('capture storage error cannot roll back commerce; safe terminal audit records reason only', async () => {
      await db.exec("create function public.order_sms_fixture_fail() returns trigger language plpgsql as $$ begin if new.status='pending' then raise exception 'PRIVATE_CAPTURE_FIXTURE'; end if; return new; end $$; create trigger order_sms_fixture_fail before insert on public.sms_order_events for each row execute function public.order_sms_fixture_fail()")
      const created=await f.checkout()
      assert.equal((await f.order(created.id)).status,'pending_payment')
      const event=(await f.events(created.id))[0]
      assert.equal(event.reason,'capture_failed');assert.deepEqual(event.payload,{})
      await db.exec('drop trigger order_sms_fixture_fail on public.sms_order_events;drop function public.order_sms_fixture_fail()')
    })
  } finally { await db.close() }
})
