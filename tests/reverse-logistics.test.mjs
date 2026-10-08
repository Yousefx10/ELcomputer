import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createReverseFixture, reverseFixtureRuntime } from './helpers/reverseFixture.mjs'
import { validateReverseBooking } from '../server/utils/pdcReverseValidation.js'
import { pdcReverseReady, verifyReverseResult, processPdcReverseQueue, operatePdcReverse } from '../server/utils/pdcReverseLogistics.js'
import { getPdcSettings, requestPdcJson, requestPdcLabel } from '../server/utils/pdcShipping.js'

const success = (ref, awb = 'EDC-FIXTURE-123') => ({ generalResponse: { success: true, summary: { totalShipments: 1, invalidShipments: 0 } }, badResponses: [], successResponses: [{ ref, awb, success: true, errors: null }] })
test('reverse input and response validation never accepts browser provider fields, Exchange or unverifiable identity', () => {
  const body = { revision: 1, idempotency_key: randomUUID(), pickup: { name: 'Buyer', phone: '01012345678', city_mapping_id: randomUUID(), address: 'Street' }, handling_resolution: 'repair', reason: 'Confirmed return', return_required: true }
  assert.equal(validateReverseBooking(body).input.pickup.phone, '01012345678')
  for (const patch of [{ awb: 'forged' }, { shipment_type_id: 5 }, { status: 'received' }, { return_required: false }, { handling_resolution: 'service_center' }, { revision: '1' }, { pickup: { ...body.pickup, phone: '123' } }, { pickup: { ...body.pickup, provider_city_id: 1 } }]) assert.throws(() => validateReverseBooking({ ...body, ...patch }))
  assert.equal(verifyReverseResult(success('ASREV-fixture'), 'ASREV-fixture').state, 'created')
  for (const response of [{}, success('wrong'), success('ASREV-fixture', 'bad\nawb'), success('ASREV-fixture', ''), { ...success('ASREV-fixture'), successResponses: [success('ASREV-fixture').successResponses[0], success('ASREV-fixture').successResponses[0]] }]) assert.equal(verifyReverseResult(response, 'ASREV-fixture').state, 'uncertain')
  assert.equal(verifyReverseResult({ generalResponse: { success: false, summary: { totalShipments: 1, invalidShipments: 1 } }, badResponses: [{}], successResponses: [] }, 'ref').state, 'failed')
})

test('the 65th migration preserves the 64-migration business checkpoint and existing outbound/SMS bodies', async () => {
  const name = '20261008160000_after_sales_reverse_logistics.sql', f = await createReverseFixture({ stopBefore: name })
  try {
    const tables = ['products','customer_orders','customer_order_items','after_sales_policies','after_sales_policy_versions','shipping_provider_settings','shipping_order_jobs','shipping_webhook_events','shipping_status_mappings','shipping_city_mappings','after_sales_claims','sms_order_events','sms_batches','payment_attempts']
    const snapshot = async () => Object.fromEntries(await Promise.all(tables.map(async table => [table,(await f.db.query('select to_jsonb(x) row from public.'+table+' x order by to_jsonb(x)::text')).rows.map(x=>x.row)])))
    const before = await snapshot(), functions = (await f.db.query("select proname,prosrc from pg_proc where pronamespace='public'::regnamespace and proname in ('shipping_record_pdc_event','queue_paid_order_for_shipping','queue_eligible_paid_orders_for_shipping','shipping_claim_pdc_refresh','shipping_resolve_pdc_state','sms_pdc_event_eligibility','after_sales_claim_staff_action','after_sales_claim_customer_action','after_sales_claim_detail')")).rows
    await f.db.exec(await readFile(new URL('../supabase/migrations/'+name, import.meta.url),'utf8'))
    const after = await snapshot()
    for (const table of tables) { assert.equal(after[table].length,before[table].length); for(let i=0;i<before[table].length;i++) for(const key of Object.keys(before[table][i])) assert.deepEqual(after[table][i][key],before[table][i][key],table+'.'+key) }
    for(const fn of functions) { const renamed = fn.proname === 'shipping_record_pdc_event' ? 'shipping_record_pdc_event_outbound' : fn.proname.startsWith('after_sales_claim_') ? fn.proname+'_before_reverse' : fn.proname; assert.equal((await f.db.query("select prosrc from pg_proc where pronamespace='public'::regnamespace and proname=$1",[renamed])).rows[0].prosrc,fn.prosrc,fn.proname) }
    assert.equal((await f.db.query('select count(*)::int n from public.shipping_claim_jobs')).rows[0].n,0)
    assert.equal(after.shipping_provider_settings[0].reverse_enabled,false);assert.equal(after.shipping_provider_settings[0].reverse_shipment_type_id,null)
  } finally { await f.db.close() }
})

test('actual SQL reverse logistics: approval, snapshots, locking, worker results and canonical tracking', async t => {
  const f = await createReverseFixture(), q = (sql,args=[])=>f.db.query(sql,args)
  try {
    await t.test('approval has no booking; disabled/invalid/ineligible requests preserve claim and records', async () => {
      const approved = await f.approve(); const revision = (await f.detail(approved.id)).claim.revision
      assert.equal((await f.view(approved.id)).jobs.length,0)
      await assert.rejects(()=>f.schedule(approved.id),/not ready/)
      assert.equal((await f.detail(approved.id)).claim.revision,revision)
      await f.configure()
      for(const pickup of [{...f.input().pickup,phone:'123'},{...f.input().pickup,city_mapping_id:randomUUID()}]) await assert.rejects(()=>f.schedule(approved.id,f.input({pickup})))
      await assert.rejects(()=>f.schedule(approved.id,f.input({return_required:false})))
      const item=await f.purchase(), claim=await f.create(f.body(item))
      await assert.rejects(()=>f.schedule(claim.id),/transition/); await f.action(claim.id,'review'); await assert.rejects(()=>f.schedule(claim.id),/transition/)
      await f.action(claim.id,'reject'); await assert.rejects(()=>f.schedule(claim.id),/transition/)
      const cancelled=await f.approve();await f.customerAction(cancelled.id,'cancel');await assert.rejects(()=>f.schedule(cancelled.id),/transition/)
      const service=await f.approve('warranty',1,{warranty:{warranty_resolutions:['service_center']}})
      await assert.rejects(()=>f.schedule(service.id,f.input({handling_resolution:'service_center'})));await assert.rejects(()=>f.schedule(service.id,f.input({handling_resolution:'repair'})))
      assert.equal((await f.view(service.id)).jobs.length,0)
      assert.equal((await q('select count(*)::int n from public.shipping_claim_jobs')).rows[0].n,0)
    })
    await t.test('one shared Return/Warranty path preserves quantity, destination and alternate pickup without rewriting order', async () => {
      for(const type of ['return','warranty']) {
        const claim=await f.approve(type,2), before=await f.order(claim.item.order_id), key=randomUUID(), input=f.input({handling_resolution:type==='return'?'refund':'replacement'})
        const attempts=await Promise.allSettled([f.schedule(claim.id,input,key),f.schedule(claim.id,input,key)])
        assert.ok(attempts.every(x=>x.status==='fulfilled'));assert.equal(attempts[0].value.id,attempts[1].value.id)
        await assert.rejects(()=>f.schedule(claim.id,input),/conflict/)
        const stored=await f.job(attempts[0].value.id);assert.match(stored.to_ref,/^ASREV-[a-f0-9]{32}$/);assert.equal(stored.quantity,2)
        const payload=stored.shipment_payload.shipments[0];assert.equal(payload.fromAddress,input.pickup.address);assert.equal(payload.toAddress,'Fixture store destination');assert.equal(payload.shipmentTypeID,3);assert.equal(payload.pieces,2);assert.equal(Number(payload.weight),2.5);assert.equal(payload.cod,0);assert.equal(payload.refuseCOD,0)
        assert.deepEqual(await f.order(claim.item.order_id),before)
        await assert.rejects(()=>f.customerAction(claim.id,'cancel'),/conflict/);await assert.rejects(()=>f.action(claim.id,'receive'),/conflict/)
        const work=(await f.take()).find(x=>x.id===stored.id); assert.ok(work); assert.equal((await f.take()).length,0)
        await f.finish(work);assert.equal((await f.detail(claim.id)).claim.status,'pickup_scheduled');const count=(await f.detail(claim.id)).events.length
        await f.finish(work);assert.equal((await f.detail(claim.id)).events.length,count)
        await assert.rejects(()=>f.rpc('shipping_claim_finish',{p_job:work.id,p_token:randomUUID(),p_state:'created',p_ref:work.to_ref,p_awb:'OTHER'}))
      }
    })
    await t.test('uncertain results block rebooking; failed pre-network intents require explicit retry with preserved old reference', async () => {
      const claim=await f.approve(), first=await f.schedule(claim.id), work=(await f.take()).find(x=>x.id===first.id)
      await f.finish(work,'uncertain',null,'timeout');assert.equal((await f.detail(claim.id)).claim.status,'approved')
      await assert.rejects(()=>f.schedule(claim.id,f.input({previous_job_id:first.id})),/conflict/)
      await f.finish(work);assert.equal((await f.detail(claim.id)).claim.status,'pickup_scheduled')
      const retry=await f.approve(), prior=await f.schedule(retry.id);await f.take(false)
      assert.equal((await f.job(prior.id)).state,'failed');await assert.rejects(()=>f.schedule(retry.id),/conflict/)
      const next=await f.schedule(retry.id,f.input({previous_job_id:prior.id}));assert.notEqual(next.to_ref,prior.to_ref);assert.equal((await f.view(retry.id)).jobs.length,2)
      const second=(await f.take()).find(x=>x.id===next.id);await f.finish(second)
    })
    await t.test('final dispatch rechecks configuration; interrupted creating work becomes uncertain without another create', async () => {
      const claim=await f.approve(), staged=await f.schedule(claim.id), work=(await f.take()).find(x=>x.id===staged.id)
      await q("update public.shipping_provider_settings set reverse_enabled=false where id='pdc'")
      assert.equal(await f.rpc('shipping_claim_dispatch',{p_job:work.id,p_token:work.token,p_ready:true}),false);assert.equal((await f.job(work.id)).state,'failed')
      await q("update public.shipping_provider_settings set reverse_enabled=true where id='pdc'")
      const abandoned=await f.approve(), stage=await f.schedule(abandoned.id), active=(await f.take()).find(x=>x.id===stage.id)
      await q("select set_config('app.reverse_write','on',false)");await q("update public.shipping_claim_jobs set started_at=clock_timestamp()-interval '3 minutes' where id=$1",[active.id]);await q("select set_config('app.reverse_write','off',false)")
      assert.equal((await f.take()).length,0);assert.equal((await f.job(active.id)).state,'uncertain')
      await f.finish(active);assert.equal((await f.job(active.id)).state,'created')
    })
    await t.test('canonical REF/AWB routing, undated reconciliation enrichment, deduplication and dated transit/delivery', async () => {
      const claim=await f.approve(), staged=await f.schedule(claim.id), work=(await f.take()).find(x=>x.id===staged.id);await f.finish(work)
      let job=await f.job(work.id); assert.equal((await f.record(f.event(job,12,{awb:'WRONG'}))).error,'awb_mismatch');assert.equal((await f.record(f.event(job,12,{ref:'UNKNOWN'}))).error,'unknown_ref')
      const before=(await f.detail(claim.id)).events.length
      await f.record(f.event(job,12,{source:'reconciliation',status_date:null}));assert.equal((await f.detail(claim.id)).claim.status,'pickup_scheduled');assert.equal((await f.detail(claim.id)).events.length,before)
      const enriched=await f.record(f.event(job));assert.equal(enriched.enriched,true);assert.equal((await f.detail(claim.id)).claim.status,'in_transit')
      const count=(await f.detail(claim.id)).events.length;await f.record(f.event(job,12,{source:'reconciliation'}));assert.equal((await f.detail(claim.id)).events.length,count)
      assert.equal((await q('select count(*)::int n from public.shipping_webhook_events where claim_shipment_job_id=$1',[job.id])).rows[0].n,1)
      const delivered=f.event(job,5,{status_date:new Date(Date.now()+5000).toISOString(),observed_at:new Date(Date.now()+6000).toISOString()});await f.record(delivered)
      assert.equal((await f.detail(claim.id)).claim.status,'received');assert.equal((await f.job(job.id)).state,'delivered')
      assert.equal((await f.record(f.event(job,2))).stale,true);assert.equal((await f.detail(claim.id)).claim.status,'received')
      await f.action(claim.id,'inspect');assert.equal((await f.detail(claim.id)).claim.status,'under_inspection')
    })
    await t.test('unknown/exception/cancellation states never reject, cancel or receive Claims; explicit rebooking ignores old history', async () => {
      const claim=await f.approve(), staged=await f.schedule(claim.id), work=(await f.take()).find(x=>x.id===staged.id);await f.finish(work);const job=await f.job(work.id)
      for(const [sid,offset] of [[999999,1000],[15,2000],[9,3000],[97,4000]]) { await f.record(f.event(job,sid,{status_date:new Date(Date.now()+offset).toISOString(),observed_at:new Date(Date.now()+offset+1000).toISOString()}));assert.equal((await f.detail(claim.id)).claim.status,'pickup_scheduled') }
      await f.record(f.event(job,8,{status_date:new Date(Date.now()+7000).toISOString()}));assert.equal((await f.job(job.id)).state,'returned');assert.equal((await f.detail(claim.id)).claim.status,'pickup_scheduled')
      const next=await f.schedule(claim.id,f.input({previous_job_id:job.id})), nextWork=(await f.take()).find(x=>x.id===next.id);await f.finish(nextWork)
      await f.record(f.event(job,5,{status_date:new Date(Date.now()+9000).toISOString()}));assert.equal((await f.detail(claim.id)).claim.status,'pickup_scheduled')
    })
    await t.test('private projections, granular roles, immutable records and browser RPC/table denial', async () => {
      const claim=await f.approve(), staged=await f.schedule(claim.id), actor=randomUUID();await q("insert into auth.users(id,email) values($1,'reverse-viewer@example.invalid')",[actor]);await q("insert into public.admin_users(id,email,role,permissions) values($1,'reverse-viewer@example.invalid','admin','{\"claims.view\":true}')",[actor])
      await assert.rejects(()=>f.schedule(claim.id,f.input(),randomUUID(),actor),e=>e.code==='42501')
      assert.equal((await f.view(claim.id,true,actor)).prefill,null);assert.equal((await f.view(claim.id,true,actor)).jobs[0].pickup,null)
      const customer=await f.view(claim.id);const encoded=JSON.stringify(customer);for(const privateValue of ['settings_fingerprint','shipment_payload','Fixture store destination','confirmation_reason":"Confirmed','access_token','PRIVATE-PROVIDER'])assert.ok(!encoded.includes(privateValue),privateValue)
      await assert.rejects(()=>f.view(claim.id,false,actor),e=>e.code==='P0002')
      await assert.rejects(()=>q("update public.shipping_claim_jobs set awb='forged' where id=$1",[staged.id]),e=>e.code==='42501')
      await q('set role authenticated');for(const sql of ['select * from public.shipping_claim_jobs','select public.shipping_claim_take(true,10)','select public.shipping_record_claim_pdc_event(\'{}\')','select public.shipping_claim_schedule(null,null,1,null,\'{}\',true)'])await assert.rejects(()=>q(sql),e=>e.code==='42501');await q('reset role')
      const work=(await f.take()).find(x=>x.id===staged.id);await f.finish(work)
      const audit=(await q("select metadata from public.admin_activity_logs where action_key like 'claims.reverse_%'")).rows;assert.ok(audit.length);assert.ok(!JSON.stringify(audit).includes('Alternate pickup street'))
    })
    await t.test('manual receipt is separate; linked reverse history cannot be erased and staff audit failures roll back atomically', async () => {
      const manual=await f.approve();await f.action(manual.id,'receive',{text:'Walk-in item physically received by staff.'});assert.equal((await f.detail(manual.id)).claim.status,'received');assert.equal((await f.view(manual.id)).jobs.length,0)
      assert.ok((await f.detail(manual.id)).events.some(x=>x.event_type==='receive'));assert.ok(!(await f.detail(manual.id)).events.some(x=>x.event_type==='reverse_received'))
      const claim=await f.approve(), revision=(await f.detail(claim.id)).claim.revision
      await f.db.exec("create function public.reverse_test_audit_outage() returns trigger language plpgsql as $$ begin raise exception 'fixture audit outage'; end $$; create trigger reverse_test_audit_outage before insert on public.admin_activity_logs for each row execute function public.reverse_test_audit_outage()")
      await assert.rejects(()=>f.schedule(claim.id),/audit outage/);assert.equal((await f.view(claim.id)).jobs.length,0);assert.equal((await f.detail(claim.id)).claim.revision,revision)
      await q('drop trigger reverse_test_audit_outage on public.admin_activity_logs');const queued=await f.schedule(claim.id), work=(await f.take()).find(x=>x.id===queued.id);await f.finish(work);await f.record(f.event(await f.job(work.id)))
      await assert.rejects(()=>q('delete from public.shipping_webhook_events where claim_shipment_job_id=$1',[work.id]),e=>e.code==='42501');await assert.rejects(()=>q('truncate public.shipping_webhook_events cascade'),e=>e.code==='42501')
      const stored=await f.job(work.id);await q("select set_config('app.reverse_write','on',false)");await assert.rejects(()=>q("update public.shipping_claim_jobs set pickup='{}' where id=$1",[work.id]),e=>e.code==='42501');await q("select set_config('app.reverse_write','off',false)");assert.deepEqual(await f.job(work.id),stored)
    })
    await t.test('outbound routing/history/order SMS remains separate; reverse callbacks create no finance/inventory/notification writes', async () => {
      const order=await f.checkout(), before=await f.order(order.id), id=randomUUID()
      await q("insert into public.shipping_order_jobs(id,order_id,to_ref,awb) values($1,$2,$3,'OUTBOUND-ONLY')",[id,order.id,order.order_number])
      const counts=async()=>Object.fromEntries(await Promise.all(['sms_order_events','sms_batches','payment_attempts','commerce_serialized_units'].map(async table=>[table,(await q('select count(*)::int n from public.'+table)).rows[0].n])))
      const beforeCounts=await counts();await f.record({ref:order.order_number,awb:'OUTBOUND-ONLY',status_id:12,status_name:'Picked Up',source:'webhook',status_date:new Date().toISOString(),reason:''})
      assert.equal((await q('select normalized_state from public.shipping_order_jobs where id=$1',[id])).rows[0].normalized_state,'picked_up');assert.deepEqual(await f.order(order.id),before)
      assert.deepEqual(await counts(),beforeCounts)
      const claim=await f.approve(), beforeReverse=await counts(), staged=await f.schedule(claim.id), work=(await f.take()).find(x=>x.id===staged.id);await f.finish(work);await f.record(f.event(await f.job(work.id),5))
      assert.deepEqual(await counts(),beforeReverse);assert.deepEqual(await f.order(order.id),before)
      await assert.rejects(()=>q("insert into public.shipping_order_jobs(order_id,to_ref) values($1,$2)",[claim.item.order_id,'ASREV-'+randomUUID().replaceAll('-','')]),/Reserved/)
      assert.equal((await q('select shipment_job_id from public.shipping_webhook_events where claim_shipment_job_id=$1',[work.id])).rows[0].shipment_job_id,null)
    })
    await t.test('reverse label Storage boundary denies browser reads and writes without changing outbound paths',async()=>{
      await f.db.exec("grant usage on schema storage to anon; grant select,insert on storage.objects to anon; create policy reverse_fixture_broad_storage on storage.objects for all to anon using(true) with check(true); insert into storage.objects(bucket_id,name) values('shipping-labels','claims/fixture/label.pdf'),('shipping-labels','outbound-fixture/label.pdf')")
      await q('set role anon');assert.equal((await q("select count(*)::int n from storage.objects where bucket_id='shipping-labels' and name like 'claims/%'")).rows[0].n,0);assert.equal((await q("select count(*)::int n from storage.objects where name='outbound-fixture/label.pdf'")).rows[0].n,1)
      await assert.rejects(()=>q("insert into storage.objects(bucket_id,name) values('shipping-labels','claims/forged.pdf')"),e=>e.code==='42501');await q('reset role')
      await f.db.exec('drop policy reverse_fixture_broad_storage on storage.objects; revoke select,insert on storage.objects from anon; revoke usage on schema storage from anon')
    })
  } finally { await f.db.close() }
})

test('mocked provider uses existing adapter; timeout recovery queries stable REF and never recreates', async () => {
  const f=await createReverseFixture(), requests=[]
  try {
    await f.configure();const claim=await f.approve(), staged=await f.schedule(claim.id)
    const fetcher=async (url,options)=>{requests.push({url,body:JSON.parse(options.body)});throw Object.assign(Error('FIXTURE-PRIVATE-TOKEN-MUST-NOT-LEAK'),{name:'TimeoutError'})}
    await processPdcReverseQueue({supabaseAdmin:f.client,fetcher,runtime:reverseFixtureRuntime});assert.equal(requests.length,1);assert.equal((await f.job(staged.id)).state,'uncertain')
    await processPdcReverseQueue({supabaseAdmin:f.client,fetcher,runtime:reverseFixtureRuntime});assert.equal(requests.length,1)
    const recovery=async (url,options)=>{requests.push({url,body:JSON.parse(options.body)});return new Response(JSON.stringify([{Ref:staged.to_ref,AWB:'RECOVERED-FIXTURE',Status:'In Transit',StatusID:82,StatusDate:new Date(Date.now()+1000).toISOString()}]),{headers:{'content-type':'application/json'}})}
    await operatePdcReverse({id:f.owner,db:f.client},claim.id,{job:staged.id,action:'recover'},recovery)
    assert.equal(requests[1].body.reFs,staged.to_ref);assert.equal(requests[1].body.awBs,'');assert.equal((await f.detail(claim.id)).claim.status,'in_transit');assert.equal(requests.filter(x=>x.url.endsWith('SaveShipmentEx')).length,1)
    assert.ok(!JSON.stringify(await f.view(claim.id)).includes('FIXTURE-PRIVATE'))
    const config=await getPdcSettings(f.client);assert.equal(pdcReverseReady(config,reverseFixtureRuntime),true);assert.equal(pdcReverseReady({...config,reverse_enabled:false},reverseFixtureRuntime),false)
    const other=await f.approve('warranty'), queued=await f.schedule(other.id,f.input({handling_resolution:'repair'}))
    await processPdcReverseQueue({supabaseAdmin:f.client,runtime:reverseFixtureRuntime,fetcher:async(url,options)=>{requests.push({url,body:JSON.parse(options.body)});return new Response(JSON.stringify(success(queued.to_ref,'CREATED-FIXTURE')))}})
    assert.equal((await f.detail(other.id)).claim.status,'pickup_scheduled')
    let redirect;await requestPdcJson({settings:config,endpoint:'SaveShipmentEx',body:{},bounded:true,fetcher:async(url,options)=>{redirect=options.redirect;return new Response(JSON.stringify({}))}});assert.equal(redirect,'error')
    await assert.rejects(()=>requestPdcJson({settings:config,endpoint:'SaveShipmentEx',body:{},bounded:true,fetcher:async()=>new Response('x'.repeat(1048577))}))
    await assert.rejects(()=>requestPdcLabel({settings:config,awb:'CREATED-FIXTURE',bounded:true,fetcher:async()=>new Response('not a pdf',{headers:{'content-type':'application/pdf'}})}))
  } finally { await f.db.close() }
})

test('accepted provider work survives a failed durable commit as uncertain recovery, never another create', async () => {
  const f=await createReverseFixture();let creates=0
  try {
    await f.configure();const claim=await f.approve(), staged=await f.schedule(claim.id)
    await f.db.exec("create function public.reverse_commit_outage() returns trigger language plpgsql as $$ begin raise exception 'fixture audit unavailable'; end $$; create trigger reverse_commit_outage before insert on public.admin_activity_logs for each row execute function public.reverse_commit_outage()")
    const fetcher=async()=>{creates++;return new Response(JSON.stringify(success(staged.to_ref,'COMMIT-RECOVERY-FIXTURE')))}
    const result=await processPdcReverseQueue({supabaseAdmin:f.client,fetcher,runtime:reverseFixtureRuntime});assert.equal(result.processed[0].state,'uncertain');assert.equal((await f.job(staged.id)).state,'creating')
    await processPdcReverseQueue({supabaseAdmin:f.client,fetcher,runtime:reverseFixtureRuntime});assert.equal(creates,1)
    await f.db.exec('drop trigger reverse_commit_outage on public.admin_activity_logs');await f.db.exec("select set_config('app.reverse_write','on',false)");await f.db.query("update public.shipping_claim_jobs set started_at=clock_timestamp()-interval '3 minutes' where id=$1",[staged.id]);await f.db.exec("select set_config('app.reverse_write','off',false)")
    assert.equal((await f.take()).length,0);assert.equal((await f.job(staged.id)).state,'uncertain')
    await operatePdcReverse({id:f.owner,db:f.client},claim.id,{job:staged.id,action:'recover'},async()=>new Response(JSON.stringify([{Ref:staged.to_ref,AWB:'COMMIT-RECOVERY-FIXTURE',Status:'Shipment registered',StatusID:13}])))
    assert.equal((await f.job(staged.id)).awb,'COMMIT-RECOVERY-FIXTURE');assert.equal((await f.detail(claim.id)).claim.status,'pickup_scheduled');assert.equal(creates,1)
  } finally {await f.db.close()}
})
