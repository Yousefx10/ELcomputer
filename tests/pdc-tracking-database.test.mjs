import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { createResetDatabase } from './helpers/resetDatabase.mjs'
import { pdcEventKey } from '../server/utils/pdcTracking.js'

const migration = '20261005120000_pdc_customer_tracking.sql'

test('PDC tracking migration, transactional history, ordering and private customer broadcast', async t => {
  const db = await createResetDatabase({ stopBefore: migration })
  const owner = randomUUID(), stranger = randomUUID()
  const makeOrder = async (ref, awb = 'AWB-' + ref) => {
    const order = randomUUID(), job = randomUUID()
    await db.query("insert into public.customer_orders(id,user_id,order_number,status,first_name,phone,street_address,city,governorate) values($1,$2,$3,'processing','Fixture','01000000000','Street','Cairo','Cairo')",[order,owner,ref])
    await db.query("insert into public.shipping_order_jobs(id,order_id,to_ref,awb) values($1,$2,$3,$4)",[job,order,ref,awb])
    return { order,job,ref,awb }
  }
  const update = (shipment, changes = {}) => ({ awb: shipment.awb,ref:shipment.ref,status_id:4,status_name:'Out For Delivery',status_date:'2026-10-05T08:00:00Z',source:'webhook',reason:'',observed_at:'2026-10-05T09:00:00Z',...changes })
  const record = async data => (await db.query('select public.shipping_record_pdc_event($1::jsonb) result',[JSON.stringify({...data,event_key:pdcEventKey(data)})])).rows[0].result
  const job = async shipment => (await db.query('select * from public.shipping_order_jobs where id=$1',[shipment.job])).rows[0]
  const count = async shipment => (await db.query('select count(*)::int n from public.shipping_webhook_events where order_ref=$1',[shipment.ref])).rows[0].n
  try {
    await db.query("insert into auth.users(id,email) values($1,'pdc-owner@example.invalid'),($2,'pdc-stranger@example.invalid')",[owner,stranger])
    const historic = await makeOrder('HISTORIC')
    await db.query("insert into public.shipping_webhook_events(provider,event_key,awb,order_ref,provider_status_id,status_date,payload,processed_at) values('pdc','old-key-1',$1,$2,4,'2026-10-01T00:00:00Z','{}',now()),('pdc','old-key-2',$1,$2,4,'2026-10-02T00:00:00Z','{}',now())",[historic.awb,historic.ref])
    const oldEvents=(await db.query('select * from public.shipping_webhook_events order by event_key')).rows
    const oldSettings=(await db.query("select * from public.shipping_provider_settings where id='pdc'")).rows[0]
    await db.exec(await readFile(new URL('../supabase/migrations/'+migration,import.meta.url),'utf8'))
    await db.query("select set_config('request.jwt.claim.role','service_role',false)")

    await t.test('populated migration preserves configuration, 382 mappings, references and old duplicate history',async()=>{
      const newEvents=(await db.query('select * from public.shipping_webhook_events order by event_key')).rows
      assert.equal(newEvents.length,oldEvents.length)
      for(let i=0;i<oldEvents.length;i++)for(const key of Object.keys(oldEvents[i]))assert.deepEqual(newEvents[i][key],oldEvents[i][key])
      const config=(await db.query("select * from public.shipping_provider_settings where id='pdc'")).rows[0]
      for(const key of Object.keys(oldSettings))assert.deepEqual(config[key],oldSettings[key])
      assert.equal((await db.query('select count(*)::int n from public.shipping_city_mappings')).rows[0].n,382)
      assert.equal((await job(historic)).to_ref,historic.ref)
      assert.equal((await db.query('select normalized_state from public.shipping_status_mappings where provider_status_id=97')).rows[0].normalized_state,'unknown')
    })

    await t.test('atomic event updates shipment only and duplicate dates/reasons have no side effects',async()=>{
      const shipment=await makeOrder('DEDUP')
      const before=(await db.query('select * from public.customer_orders where id=$1',[shipment.order])).rows[0]
      const first=await record(update(shipment));assert.equal(first.received,true);assert.equal(first.stale,false)
      const saved=await job(shipment)
      const broadcasts=(await db.query('select count(*)::int n from realtime.messages')).rows[0].n
      assert.equal(saved.normalized_state,'out_for_delivery')
      const duplicate=await record(update(shipment,{status_date:'2026-10-05T10:00:00Z',reason:'Not Home'}))
      assert.equal(duplicate.duplicate,true);assert.equal(await count(shipment),1);assert.deepEqual(await job(shipment),saved)
      assert.equal((await db.query('select count(*)::int n from realtime.messages')).rows[0].n,broadcasts)
      assert.deepEqual((await db.query('select * from public.customer_orders where id=$1',[shipment.order])).rows[0],before)
    })

    await t.test('lookup uses REF first, verifies AWB and rejects unknown/unassigned combinations',async()=>{
      const one=await makeOrder('MATCH1'),two=await makeOrder('MATCH2'),unassigned=await makeOrder('UNASSIGNED',null)
      assert.equal((await record(update(one,{ref:two.ref}))).error,'awb_mismatch')
      assert.equal((await record(update(one,{ref:'UNKNOWN'}))).error,'unknown_ref')
      assert.equal((await record(update(unassigned,{awb:'arbitrary'}))).error,'awb_mismatch')
      assert.equal(await count(one),0);assert.equal(await count(two),0)
    })

    await t.test('late/out-of-order/equal-time events remain history without current-state regression',async()=>{
      const shipment=await makeOrder('ORDERING')
      await record(update(shipment,{status_id:5,status_name:'Delivered',status_date:'2026-10-05T11:00:00Z'}))
      const before=await job(shipment)
      assert.equal((await record(update(shipment))).stale,true)
      assert.equal((await record(update(shipment,{status_id:3,status_date:'2026-10-05T11:00:00Z'}))).stale,true)
      assert.deepEqual(await job(shipment),before);assert.equal(await count(shipment),3)
      assert.equal((await db.query('select provider_status_id from public.shipping_webhook_events where order_ref=$1 order by status_date,id',[shipment.ref])).rows[0].provider_status_id,4)
    })

    await t.test('unknown and ambiguous statuses retain raw data with neutral state and no order transitions',async()=>{
      const shipment=await makeOrder('UNKNOWN')
      await record(update(shipment,{status_id:777777,status_name:'Original vendor label',reason:'Original reason'}))
      assert.equal((await job(shipment)).normalized_state,'unknown')
      const event=(await db.query('select * from public.shipping_webhook_events where order_ref=$1',[shipment.ref])).rows[0]
      assert.equal(event.provider_status_name,'Original vendor label');assert.equal(event.reason_name,'Original reason');assert.deepEqual(event.payload,{})
      assert.equal((await db.query('select status from public.customer_orders where id=$1',[shipment.order])).rows[0].status,'processing')
      assert.equal((await db.query("select public.shipping_resolve_pdc_state(null,'Received At Hub') state")).rows[0].state,'unknown')
      assert.equal((await db.query("select public.shipping_resolve_pdc_state(null,'Delivered') state")).rows[0].state,'delivered')
    })

    await t.test('legacy processed duplicates are recognized; old unprocessed failure retries are not lost',async()=>{
      assert.equal((await record(update(historic))).duplicate,true)
      assert.equal(await count(historic),2)
      const shipment=await makeOrder('OLDFAILED')
      await db.query("insert into public.shipping_webhook_events(provider,event_key,awb,order_ref,provider_status_id,payload,processing_error) values('pdc','failed-legacy',$1,$2,4,'{}','failed')",[shipment.awb,shipment.ref])
      assert.equal((await record(update(shipment))).received,true);assert.equal((await job(shipment)).normalized_state,'out_for_delivery')
      assert.equal(await count(shipment),2)
    })

    await t.test('database failure rolls back event/current/broadcast, and a retry fully processes it',async()=>{
      const shipment=await makeOrder('ROLLBACK')
      await db.exec("create function public.pdc_test_failure() returns trigger language plpgsql as $$ begin raise exception 'fixture'; end $$; create trigger pdc_test_failure before update on public.shipping_order_jobs for each row execute function public.pdc_test_failure()")
      await assert.rejects(()=>record(update(shipment)),/fixture/);assert.equal(await count(shipment),0)
      assert.equal((await job(shipment)).provider_status_id,null)
      await db.exec('drop trigger pdc_test_failure on public.shipping_order_jobs; drop function public.pdc_test_failure()')
      assert.equal((await record(update(shipment))).received,true);assert.equal(await count(shipment),1)
    })

    await t.test('reconciliation claims are database throttled even when the provider call fails',async()=>{
      const shipment=await makeOrder('REFRESH')
      const first=(await db.query('select public.shipping_claim_pdc_refresh($1) result',[shipment.order])).rows[0].result
      assert.equal(first.awb,shipment.awb);assert.equal(first.ref,shipment.ref)
      assert.equal((await db.query('select public.shipping_claim_pdc_refresh($1) result',[shipment.order])).rows[0].result.error,'throttled')
      assert.equal((await db.query('select public.shipping_claim_pdc_lookup() result')).rows[0].result,true)
      assert.equal((await db.query('select public.shipping_claim_pdc_lookup() result')).rows[0].result,false)
    })

    await t.test('name-only API observations are retained without inventing numeric IDs/event timestamps',async()=>{
      const shipment=await makeOrder('SNAPSHOT')
      const observation=update(shipment,{status_id:null,status_name:'Shipment Delivered',source:'reconciliation',status_date:null})
      assert.equal((await record(observation)).received,true)
      const saved=await job(shipment);assert.equal(saved.normalized_state,'delivered');assert.equal(saved.provider_status_at,null)
      assert.equal(saved.provider_status_source,'reconciliation')
      assert.equal((await record(observation)).duplicate,true)
      assert.equal(await count(shipment),1)
    })

    await t.test('dated webhook enriches the same undated numeric API event once',async()=>{
      const shipment=await makeOrder('ENRICH')
      await record(update(shipment,{source:'reconciliation',status_date:null}))
      assert.equal((await job(shipment)).provider_status_at,null)
      const result=await record(update(shipment))
      assert.equal(result.duplicate,true);assert.equal(result.enriched,true)
      assert.equal(await count(shipment),1)
      assert.equal((await job(shipment)).provider_status_at.toISOString(),'2026-10-05T08:00:00.000Z')
      const saved=await job(shipment)
      const broadcastCount=(await db.query('select count(*)::int n from realtime.messages')).rows[0].n
      assert.equal((await record(update(shipment))).enriched,undefined)
      assert.deepEqual(await job(shipment),saved)
      assert.equal((await db.query('select count(*)::int n from realtime.messages')).rows[0].n,broadcastCount)
    })

    await t.test('API response started before a webhook cannot overwrite the newer callback',async()=>{
      const shipment=await makeOrder('SNAPSHOTRACE')
      await record(update(shipment,{status_id:5,status_name:'Delivered',status_date:'2026-10-05T08:00:00Z',observed_at:'2026-10-05T10:00:00Z'}))
      const before=await job(shipment)
      assert.equal((await record(update(shipment,{source:'reconciliation',status_date:null,observed_at:'2026-10-05T09:00:00Z'}))).stale,true)
      assert.deepEqual(await job(shipment),before)
    })

    await t.test('server-only tables and RPCs are not enumerable by customers/anonymous callers',async()=>{
      for(const role of ['anon','authenticated']) {
        for(const table of ['shipping_webhook_events','shipping_order_jobs','shipping_provider_settings','shipping_status_mappings']) assert.equal((await db.query('select has_table_privilege($1,$2,\'select\') allowed',[role,'public.'+table])).rows[0].allowed,false)
        assert.equal((await db.query("select has_function_privilege($1,'public.shipping_record_pdc_event(jsonb)','execute') allowed",[role])).rows[0].allowed,false)
      }
      await db.query("select set_config('request.jwt.claim.role','authenticated',false)")
      await assert.rejects(()=>record(update(historic)),/Service role/)
      await db.query("select set_config('request.jwt.claim.role','service_role',false)")
    })

    await t.test('private realtime permits the active owner only, no foreign AWB/REF/topic or disabled account',async()=>{
      const shipment=await makeOrder('REALTIME')
      await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner])
      assert.equal((await db.query('select public.shipping_can_receive_topic($1) allowed',['shipping:order:'+shipment.order])).rows[0].allowed,true)
      await db.query("select set_config('request.jwt.claim.sub',$1,false)",[stranger])
      assert.equal((await db.query('select public.shipping_can_receive_topic($1) allowed',['shipping:order:'+shipment.order])).rows[0].allowed,false)
      await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner])
      await db.query('update public.customer_profiles set is_active=false where id=$1',[owner])
      assert.equal((await db.query('select public.shipping_can_receive_topic($1) allowed',['shipping:order:'+shipment.order])).rows[0].allowed,false)
      await db.query('update public.customer_profiles set is_active=true where id=$1',[owner])
      await record(update(shipment))
      const broadcasts=(await db.query('select payload from realtime.messages where topic=$1',['shipping:order:'+shipment.order])).rows
      assert.deepEqual(broadcasts.map(row=>row.payload),[{changed:true}])
      await db.exec('begin')
      await db.query("select set_config('realtime.topic',$1,true)",['shipping:order:'+shipment.order])
      await db.exec('set local role authenticated')
      assert.equal((await db.query('select count(*)::int n from realtime.messages')).rows[0].n,1)
      await db.exec('reset role');await db.exec('rollback')
    })
  } finally { await db.close() }
})
