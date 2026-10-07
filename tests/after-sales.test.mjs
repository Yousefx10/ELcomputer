import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createOrderSmsFixture } from './helpers/orderSmsFixture.mjs'
import { validateAfterSalesValues, validateAfterSalesReason, afterSalesScope, getWarrantyEligibility, getReturnEligibility } from '../server/utils/afterSalesPolicy.js'
import { afterSalesFields } from '../app/utils/afterSalesFields.js'
import { formatAccountCalendarDate } from '../app/utils/accountOrders.js'

const migration = '20261007160000_after_sales_policy.sql'
test('after-sales strict typed input allows inheritance without coercion or arbitrary rules', () => {
  assert.deepEqual(validateAfterSalesValues({ return_enabled: false, return_window_days: 20, return_fallback_bases: ['invoice_date','order_date'] }, { section: 'returns' }), { return_enabled: false, return_window_days: 20, return_fallback_bases: ['invoice_date','order_date'] })
  assert.deepEqual(validateAfterSalesValues(Object.fromEntries(afterSalesFields.map(f=>[f.key,null])),{scope:'product'}), Object.fromEntries(afterSalesFields.map(f=>[f.key,null])))
  for(const values of [{return_enabled:'false'},{return_window_days:0},{return_window_days:366},{return_window_days:14.2},{return_window_days:'14'},{return_opened:'expression'},{return_fallback_bases:['order_date','order_date']},{return_fallback_bases:[null]},{policy_timezone:'invented/timezone'},{return_enabled:null},{warranty_duration_value:12},{warranty_enabled:true}]) assert.throws(()=>validateAfterSalesValues(values,{section:'returns'}),e=>e.statusCode===400)
  assert.throws(()=>afterSalesScope('product','bad'),e=>e.statusCode===400)
  assert.equal(afterSalesScope('global'),'global')
  const reason={key:'stable_reason',label_en:'  Example  ',label_ar:'مثال',is_enabled:true,sort_order:1,fault:'neutral',shipping:null,opened:null,evidence:null,revision:0}
  assert.equal(validateAfterSalesReason(reason).label_en,'Example')
  for(const patch of [{key:'free text'},{label_ar:''},{fault:'arbitrary'},{shipping:'reason'},{opened:'reason'},{evidence:'maybe'},{is_enabled:1},{sort_order:-1},{revision:0.5},{expression:'script'}]) assert.throws(()=>validateAfterSalesReason({...reason,...patch}),e=>e.statusCode===400)
  assert.equal(formatAccountCalendarDate('2026-10-10','en-GB'),'10 Oct 2026')
})

test('after-sales migration, resolver, purchase versions, calendars and separate eligibility execute against real SQL', async t=>{
 const f=await createOrderSmsFixture({stopBefore:migration}); const {db}=f
 const query=(sql,args=[])=>db.query(sql,args)
 const scalar=async(sql,args=[])=>Object.values((await query(sql,args)).rows[0])[0]
 const rpc=async(name,args)=>{const result=await f.client.rpc(name,args);if(result.error)throw Object.assign(Error(result.error.message),{code:result.error.code});return result.data}
 const functions=await query("select proname,prosrc from pg_proc where proname in ('commerce_create_customer_order','commerce_create_preorder','commerce_snapshot_item_warranty') order by proname")
 await query("update public.products set warranty_status='included',warranty_duration_value=12,warranty_duration_unit='months' where id=$1",[f.product])
 const historical=await f.checkout()
 const itemFor=async o=>(await query('select * from public.customer_order_items where order_id=$1',[o.id])).rows[0]
 try {
  await db.exec(await readFile(new URL('../supabase/migrations/'+migration,import.meta.url),'utf8'))
  const resolve=(product=f.product,category=null)=>rpc('after_sales_resolve_policy',{p_product_id:product,p_category_id:category})
  const save=async(values,section='overrides',scope='global',revision)=>rpc('after_sales_save_policy',{p_admin_id:f.owner,p_scope_key:scope,p_section:section,p_revision:revision??Number(await scalar('select revision from public.after_sales_policies where scope_key=$1',[scope])||0),p_values:values})
  const eligibility=(id,facts={},now='2026-10-10T12:00:00Z')=>rpc('after_sales_item_eligibility',{p_item_id:id,p_facts:facts,p_now:now})
  const period=(basis,fallback,dates,value=12,unit='months',zone='Africa/Cairo',now='2026-10-10T12:00:00Z')=>rpc('after_sales_period',{p_basis:basis,p_fallback:'{'+fallback.join(',')+'}',p_dates:dates,p_value:value,p_unit:unit,p_timezone:zone,p_now:now})
  await t.test('additive migration leaves historical NULL and prior checkout/warranty bodies unchanged',async()=>{
   assert.equal((await itemFor(historical)).after_sales_policy_version_id,null)
   assert.deepEqual((await query("select proname,prosrc from pg_proc where proname in ('commerce_create_customer_order','commerce_create_preorder','commerce_snapshot_item_warranty') order by proname")).rows,functions.rows)
   const r=await resolve();assert.equal(r.policy.return_window_days,14);assert.equal(r.policy.warranty_configured,false);assert.equal(r.policy.return_configured,false)
   const current=await f.checkout();assert.ok((await itemFor(current)).after_sales_policy_version_id)
   const value=await eligibility((await itemFor(current)).id);assert.equal(value.warranty.reason,'policy_unconfigured');assert.equal(value.returns.reason,'policy_unconfigured')
   assert.equal((await scalar('select warranty_duration_value from public.storefront_products where id=$1',[f.product])),12)
  })
  let cat,otherCat
  await t.test('global, category and product merge individually; NULL restores inheritance; product chooses its real category',async()=>{
   await save({warranty_enabled:true,warranty_resolutions:['repair','replacement'],warranty_start_basis:'order_date',warranty_evidence:'optional',warranty_serial:'optional'},'warranty')
   await save({return_enabled:true,return_window_days:14,return_start_basis:'order_date',return_opened:'allowed',return_packaging:'not_required',return_evidence:'optional'},'returns')
   cat=randomUUID();otherCat=randomUUID();await query("insert into public.categories(id,name,slug) values($1,'Laptop',($1::uuid)::text),($2,'Other',($2::uuid)::text)",[cat,otherCat]);await query('update public.products set category_id=$1 where id=$2',[cat,f.product])
   await save({return_opened:'not_allowed',warranty_evidence:'required'},'overrides','category:'+cat,0)
   await save({return_window_days:21,warranty_shipping:'customer'},'overrides','product:'+f.product,0)
   let r=await resolve(f.product,otherCat);assert.equal(r.policy.return_opened,'not_allowed');assert.equal(r.policy.return_window_days,21);assert.equal(r.policy.warranty_evidence,'required');assert.equal(r.sources.return_window_days,'product');assert.equal(r.sources.return_opened,'category');assert.equal(r.sources.warranty_start_basis,'global')
   await save({return_window_days:null,warranty_shipping:null},'overrides','product:'+f.product)
   r=await resolve();assert.equal(r.policy.return_window_days,14);assert.equal(r.sources.return_window_days,'global');assert.equal(r.policy.warranty_shipping,'manual')
  })
  await t.test('invalid native SQL writes, stale revisions and missing authorization roll back with no audit side effects',async()=>{
   const before=await resolve();const count=await scalar("select count(*) from public.admin_activity_logs where action_key like 'settings.after_sales.%'")
   for(const values of [{return_window_days:0},{return_window_days:366},{return_window_days:1.5},{return_enabled:'true'},{return_fallback_bases:['order_date','order_date']},{return_fallback_bases:[null]},{return_opened:'arbitrary'},{policy_timezone:'wrong/zone'},{return_enabled:null},{warranty_duration_value:24},{warranty_configured:false}]) await assert.rejects(()=>save(values,'returns'))
   await assert.rejects(()=>save({return_enabled:false},'returns','global',0),e=>e.code==='40001')
   await assert.rejects(()=>save({return_enabled:false},null))
   await query("select set_config('request.jwt.claim.role','authenticated',false)")
   await assert.rejects(()=>save({return_enabled:false},'returns'),/Server authorization/)
   await query("select set_config('request.jwt.claim.role','service_role',false)")
   assert.deepEqual(await resolve(),before);assert.equal(await scalar("select count(*) from public.admin_activity_logs where action_key like 'settings.after_sales.%'"),count)
   const logs=(await query("select metadata from public.admin_activity_logs where action_key='settings.after_sales.policy' order by created_at")).rows
   assert.ok(logs.every(l=>l.metadata.before && l.metadata.after));assert.ok(logs.some(l=>l.metadata.before.return_enabled===false&&l.metadata.after.return_enabled===true))
  })
  const first=await f.checkout(), firstItem=await itemFor(first)
  await query("update public.customer_orders set created_at='2026-10-01T12:00:00Z',paid_at='2026-10-02T12:00:00Z' where id=$1",[first.id])
  await t.test('warranty and returns are separate; opened/evidence facts are required and bounded',async()=>{
   let r=await eligibility(firstItem.id,{reason_key:'changed_mind',opened:false});assert.equal(r.warranty.reason,'evidence_required');assert.equal(r.returns.status,'eligible');assert.equal(r.warranty.period.status,'active')
   r=await eligibility(firstItem.id,{reason_key:'changed_mind',opened:true,evidence:true});assert.equal(r.warranty.status,'eligible');assert.equal(r.returns.reason,'opened_not_allowed')
   r=await eligibility(firstItem.id,{reason_key:'changed_mind',opened:false,evidence:true},'2026-10-20T12:00:00Z');assert.equal(r.returns.status,'expired');assert.equal(r.warranty.status,'eligible')
   await assert.rejects(()=>eligibility(firstItem.id,{opened:'false'}),e=>e.code==='22023')
   await assert.rejects(()=>eligibility(firstItem.id,{return_window_days:999}),e=>e.code==='22023')
   assert.equal((await getWarrantyEligibility(f.client,firstItem.id)).period.start_date,'2026-10-01');assert.equal((await getReturnEligibility(f.client,firstItem.id)).period.start_date,'2026-10-01')
  })
  await t.test('reason revisions and stricter current policies cannot reduce purchased terms; new orders use new version',async()=>{
   const row=(await query("select * from public.after_sales_return_reasons where key='changed_mind'")).rows[0]
   await rpc('after_sales_save_reason',{p_admin_id:f.owner,p_reason:{key:row.key,label_en:'Changed label',label_ar:row.label_ar,is_enabled:false,sort_order:80,fault:'seller',shipping:'elcomputer',opened:'allowed',evidence:'required',revision:row.revision}})
   await assert.rejects(()=>rpc('after_sales_save_reason',{p_admin_id:f.owner,p_reason:{...row}}))
   await save({return_enabled:false,return_window_days:1},'returns');await save({warranty_enabled:false,warranty_start_basis:'delivery_date'},'warranty')
   const second=await f.checkout();const secondItem=await itemFor(second);assert.notEqual(secondItem.after_sales_policy_version_id,firstItem.after_sales_policy_version_id)
   assert.equal((await eligibility(firstItem.id,{reason_key:'changed_mind',opened:false,evidence:true})).returns.status,'eligible')
   const r=await eligibility(secondItem.id);assert.equal(r.warranty.status,'disabled');assert.equal(r.returns.status,'disabled');assert.equal(r.warranty.period.reason,'delivery_date_unavailable')
   const version=await scalar('select policy from public.after_sales_policy_versions where id=$1',[firstItem.after_sales_policy_version_id]);assert.equal(version.return_reasons.find(r=>r.key==='changed_mind').label_en,'Changed mind')
   await assert.rejects(()=>query('update public.after_sales_policy_versions set policy=$1 where id=$2',['{}',firstItem.after_sales_policy_version_id]),/immutable/)
   await assert.rejects(()=>query('delete from public.after_sales_policy_versions where id=$1',[secondItem.after_sales_policy_version_id]),/immutable/)
   await assert.rejects(()=>db.exec('truncate public.after_sales_policy_versions cascade'),/immutable/)
   await assert.rejects(()=>query('update public.customer_order_items set after_sales_policy_version_id=$1 where id=$2',[secondItem.after_sales_policy_version_id,firstItem.id]),/immutable/)
   await assert.rejects(()=>query('update public.customer_order_items set after_sales_policy_version_id=$1 where order_id=$2',[firstItem.after_sales_policy_version_id,historical.id]),/immutable/)
   const appended=(await query("insert into public.customer_order_items(order_id,product_id,product_title,quantity,after_sales_policy_version_id) values($1,$2,'Imported',1,$3) returning *",[historical.id,f.product,firstItem.after_sales_policy_version_id])).rows[0];assert.equal(appended.after_sales_policy_version_id,null)
  })
  await t.test('preorder purchase captures the same immutable policy reference',async()=>{
   const order=await f.checkout({preorder:true,method:'bank_transfer'});const item=await itemFor(order);assert.ok(item.after_sales_policy_version_id);assert.equal(order.preorder_fulfillment_state,'awaiting_stock');assert.equal(order.payment_status,'pending')
  })
  await t.test('explicit ordered fallbacks only; invoice and delivery remain unknown without real dates',async()=>{
   const dates={order_date:'2026-10-01T12:00:00Z',payment_date:'2026-10-02T12:00:00Z'}
   assert.equal((await period('delivery_date',[],dates)).reason,'delivery_date_unavailable')
   assert.equal((await period('invoice_date',[],dates)).reason,'invoice_date_unavailable')
   let p=await period('delivery_date',['invoice_date','payment_date','order_date'],dates);assert.equal(p.start_date,'2026-10-02');assert.equal(p.start_basis,'payment_date');assert.equal(p.used_fallback,true)
   p=await period('order_date',['payment_date'],dates);assert.equal(p.used_fallback,false);assert.equal(p.start_date,'2026-10-01')
   assert.equal((await period('order_date',[],dates,0)).reason,'invalid_period')
   assert.equal((await period('order_date',[],dates,121)).reason,'invalid_period')
  })
  await t.test('calendar months, leap years, exclusive local midnight and DST are deterministic',async()=>{
   const p=await period('order_date',[],{order_date:'2026-01-31T15:00:00Z'},1,'months','UTC','2026-02-28T00:00:00Z');assert.equal(p.expiry_date,'2026-02-28');assert.equal(p.status,'expired')
   const leap=await period('order_date',[],{order_date:'2024-02-29T15:00:00Z'},1,'years','UTC','2025-02-27T23:59:59Z');assert.equal(leap.expiry_date,'2025-02-28');assert.equal(leap.status,'active')
   const dates={order_date:'2026-10-10T14:00:00Z'}
   assert.equal((await period('order_date',[],dates,12,'months','Africa/Cairo','2026-10-10T13:59:59Z')).status,'not_started')
   let anniversary=await period('order_date',[],dates,12,'months','Africa/Cairo','2027-10-09T20:59:59Z');assert.equal(anniversary.expiry_date,'2027-10-10');assert.equal(anniversary.status,'active')
   assert.equal((await period('order_date',[],dates,12,'months','Africa/Cairo','2027-10-09T21:00:00Z')).status,'expired')
   const spring=await period('order_date',[],{order_date:'2026-03-07T17:00:00Z'},2,'days','America/New_York','2026-03-09T04:00:00Z');assert.equal(spring.status,'expired');assert.equal(spring.expiry_date,'2026-03-09');assert.equal(new Date(spring.expiry_at).toISOString(),'2026-03-09T04:00:00.000Z')
   const fall=await period('order_date',[],{order_date:'2026-10-31T16:00:00Z'},2,'days','America/New_York','2026-11-02T05:00:00Z');assert.equal(fall.status,'expired');assert.equal(new Date(fall.expiry_at).toISOString(),'2026-11-02T05:00:00.000Z')
  })
  await t.test('delivery requires dated processed matching evidence; status, partial and receive timestamps do not invent dates',async()=>{
   const job=randomUUID(),awb='POLICY-'+randomUUID(),ref='REF-'+randomUUID()
   await query('insert into public.shipping_order_jobs(id,order_id,to_ref,awb) values($1,$2,$3,$4)',[job,first.id,ref,awb])
   const event=async({state='delivered',source='webhook',date='2026-10-03T12:00:00Z',processed=true,eventAwb=awb,eventRef=ref,linked=job}={})=>query("insert into public.shipping_webhook_events(provider,event_key,awb,order_ref,provider_status_id,status_date,payload,processed_at,shipment_job_id,normalized_state,source) values('pdc',$1,$2,$3,null,$4,'{}',$5,$6,$7,$8)",[randomUUID(),eventAwb,eventRef,date,processed?'2026-10-03T13:00:00Z':null,linked,state,source])
   const dates=()=>rpc('after_sales_order_dates',{p_order_id:first.id,p_now:'2026-10-10T12:00:00Z'})
   await query("update public.customer_orders set status='completed' where id=$1",[first.id]);assert.equal((await dates()).delivery_date,null)
   for(const attrs of [{state:'partial_delivery'},{date:null},{source:'legacy'},{processed:false},{eventAwb:'FOREIGN'},{eventRef:'FOREIGN'},{linked:null},{date:'2026-09-30T12:00:00Z'},{date:'2026-10-20T12:00:00Z'}])await event(attrs)
   assert.equal((await dates()).delivery_date,null);assert.equal((await dates()).invoice_date,null)
   await event();let d=await dates();assert.equal(new Date(d.delivery_date).toISOString(),'2026-10-03T12:00:00.000Z')
   await query("update public.shipping_status_mappings set normalized_state='unknown' where normalized_state='delivered'")
   assert.equal(new Date((await dates()).delivery_date).toISOString(),'2026-10-03T12:00:00.000Z')
  })
  await t.test('reason overrides, required packaging/evidence/serial and explicit none stay separate',async()=>{
   await save({return_enabled:true,return_window_days:14,return_start_basis:'order_date',return_opened:'reason',return_packaging:'required',return_evidence:'required'},'returns')
   await save({warranty_enabled:true,warranty_start_basis:'order_date',warranty_resolutions:['refund','service_center'],warranty_serial:'required'},'warranty')
   await save({return_opened:null,warranty_evidence:null},'overrides','category:'+cat)
   const o=await f.checkout(),i=await itemFor(o);await query("update public.customer_orders set created_at='2026-10-01T12:00:00Z' where id=$1",[o.id])
   let r=await eligibility(i.id,{reason_key:'changed_mind'});assert.equal(r.returns.reason,'reason_disabled');assert.equal(r.warranty.reason,'serial_verification_required')
   r=await eligibility(i.id,{reason_key:'wrong_item',evidence:true,serial:true});assert.equal(r.warranty.status,'eligible');assert.equal(r.returns.reason,'opened_review_required')
   const row=(await query("select * from public.after_sales_return_reasons where key='wrong_item'")).rows[0]
   await rpc('after_sales_save_reason',{p_admin_id:f.owner,p_reason:{key:row.key,label_en:row.label_en,label_ar:row.label_ar,is_enabled:true,sort_order:row.sort_order,fault:'seller',shipping:'elcomputer',opened:'allowed',evidence:'required',revision:row.revision}})
   const o2=await f.checkout(),i2=await itemFor(o2);await query("update public.customer_orders set created_at='2026-10-01T12:00:00Z' where id=$1",[o2.id])
   r=await eligibility(i2.id,{reason_key:'wrong_item',opened:true});assert.equal(r.returns.reason,'packaging_required');assert.equal(r.returns.shipping,'elcomputer');assert.equal(r.returns.fault,'seller')
   r=await eligibility(i2.id,{reason_key:'wrong_item',packaging:true});assert.equal(r.returns.reason,'evidence_required')
   r=await eligibility(i2.id,{reason_key:'wrong_item',packaging:true,evidence:true});assert.equal(r.returns.status,'eligible');assert.equal(r.warranty.reason,'serial_verification_required')
   r=await eligibility(i.id,{reason_key:'wrong_item',packaging:true,evidence:true});assert.equal(r.returns.reason,'opened_review_required')
   await query("update public.products set warranty_status='none',warranty_duration_value=null,warranty_duration_unit=null where id=$1",[f.product]);const none=await f.checkout();r=await eligibility((await itemFor(none)).id);assert.equal(r.warranty.reason,'no_warranty')
   await query("update public.customer_orders set status='cancelled' where id=$1",[o2.id]);r=await eligibility(i2.id,{reason_key:'wrong_item',packaging:true,evidence:true,serial:true});assert.equal(r.warranty.reason,'order_closed');assert.equal(r.returns.reason,'order_closed')
  })
  await t.test('audit insertion failure rolls back policy revision and values atomically',async()=>{
   const before=await resolve();await db.exec("create function public.after_sales_test_audit_failure() returns trigger language plpgsql as $$ begin raise exception 'audit unavailable'; end $$; create trigger after_sales_test_audit_failure before insert on public.admin_activity_logs for each row execute function public.after_sales_test_audit_failure()")
   await assert.rejects(()=>save({return_window_days:30},'returns'),/audit unavailable/);assert.deepEqual(await resolve(),before)
   await db.exec('drop trigger after_sales_test_audit_failure on public.admin_activity_logs; drop function public.after_sales_test_audit_failure()')
  })
  await t.test('owned-customer projection blocks other users and hides policy version/admin identifiers',async()=>{
   const list=await rpc('after_sales_order_entitlements',{p_order_id:first.id,p_customer_id:f.customer});assert.equal(list[0].id,firstItem.id);assert.ok(list[0].after_sales.warranty.period)
   assert.doesNotMatch(JSON.stringify(list),/version_key|updated_by|admin_user|revision|scope_key/)
   await assert.rejects(()=>rpc('after_sales_order_entitlements',{p_order_id:first.id,p_customer_id:randomUUID()}))
   await query('update public.customer_profiles set is_active=false where id=$1',[f.customer]);await assert.rejects(()=>rpc('after_sales_order_entitlements',{p_order_id:first.id,p_customer_id:f.customer}));await query('update public.customer_profiles set is_active=true where id=$1',[f.customer])
  })
  await t.test('anon and authenticated have no private table or RPC privileges',async()=>{
   for(const role of ['anon','authenticated']){
    for(const table of ['after_sales_policies','after_sales_return_reasons','after_sales_policy_versions']) assert.equal(await scalar('select has_table_privilege($1,$2,\'SELECT\')',[role,'public.'+table]),false)
    const grants=(await query("select proname,has_function_privilege($1,p.oid,'EXECUTE') allowed from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname like 'after_sales_%'",[role])).rows;assert.ok(grants.every(r=>!r.allowed))
   }
   const rls=(await query("select relrowsecurity from pg_class where relname in ('after_sales_policies','after_sales_return_reasons','after_sales_policy_versions')")).rows;assert.ok(rls.every(r=>r.relrowsecurity))
  })
  await t.test('recreated override revisions cannot reuse a different purchased policy',async()=>{
   const a=await f.checkout(),ai=await itemFor(a)
   await query('delete from public.after_sales_policies where scope_key=$1',['product:'+f.product])
   await save({return_window_days:30},'overrides','product:'+f.product,0);await save({return_window_days:32},'overrides','product:'+f.product,1)
   const b=await f.checkout(),bi=await itemFor(b);assert.notEqual(ai.after_sales_policy_version_id,bi.after_sales_policy_version_id)
   assert.equal((await scalar('select policy from public.after_sales_policy_versions where id=$1',[bi.after_sales_policy_version_id])).return_window_days,32)
  })
  await t.test('product and full resets retain globals/reasons/purchase archives and recognize the schema',async()=>{
   const archived=await scalar('select policy from public.after_sales_policy_versions where id=$1',[firstItem.after_sales_policy_version_id]);const global=await resolve(null)
   const run=await rpc('system_reset_begin',{p_owner:f.owner,p_scope:'products',p_id:randomUUID()});await rpc('system_reset_finish',{p_owner:f.owner,p_id:run.id})
   assert.equal(await scalar("select count(*) from public.after_sales_policies where scope_key<>'global'"),0);assert.deepEqual(await resolve(null),global)
   assert.deepEqual(await scalar('select policy from public.after_sales_policy_versions where id=$1',[firstItem.after_sales_policy_version_id]),archived);assert.equal((await itemFor(first)).product_id,null)
   const plan=await rpc('system_reset_plan',{p_owner:f.owner,p_scope:'full'});assert.equal(plan.blockers.length,0)
   const full=await rpc('system_reset_begin',{p_owner:f.owner,p_scope:'full',p_id:randomUUID()});await rpc('system_reset_finish',{p_owner:f.owner,p_id:full.id})
   assert.equal(await scalar('select count(*) from public.customer_orders'),0);assert.deepEqual(await resolve(null),global);assert.equal(await scalar('select count(*) from public.after_sales_return_reasons'),7);assert.deepEqual(await scalar('select policy from public.after_sales_policy_versions where id=$1',[firstItem.after_sales_policy_version_id]),archived)
  })
 } finally {await db.close()}
})
