import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {paymentFirstFixture} from './helpers/paymentFirstFixture.mjs'
import {emailNativeAvailable} from './helpers/emailNativeDatabase.mjs'

test('payment-first uses the actual schema107 checkout and verified settlement contracts',{skip:!emailNativeAvailable,timeout:180000},async t=>{
 const f=await paymentFirstFixture(process.env.PAYMENT_FIRST_CORE_ONLY?{stopBefore:'20261101221000'}:{});let n=0
 const next=()=>String(10000+(++n)),fund=async(s,status='succeeded')=>{const a=await f.claim(s),p=next();await f.store(a,p);return {a,p,result:await f.callback(a,{id:next(),provider:p,status})}}
 try{
 await t.test('unpaid checkout freezes exact trusted terms with zero commerce/stock/email effects',async()=>{
  const b=await f.counts(),s=await f.prepare();assert.equal(s.session.totalAmount,'250.70');assert.equal(s.session.orderId,null);const x=await f.counts();for(const k of ['orders','attempts','transactions','shipping','emails','stock'])assert.equal(x[k],b[k]);assert.equal(x.sessions,b.sessions+1)
  const repeated=await f.rpc('commerce_prepare_payment_checkout',[s.actor.id,s.cart,s.review.quoteId,s.order,s.items,s.revision]);assert.equal(repeated.created,false);assert.equal(repeated.checkout.id,s.session.id)
  await assert.rejects(f.prepare({actor:s.actor}),/payment_first:existing/)
 })
 await t.test('parallel claims dispatch once and never reveal a stored secret on replay',async()=>{
  const s=await f.prepare(),clients=await Promise.all([f.db.connect(),f.db.connect()]);const a=await Promise.all(clients.map(c=>f.rpc('commerce_claim_checkout_payment',[s.actor.id,s.session.id,'live',123,...(f.interfaceVersion===2?[2]:[])],c)));assert.equal(a.filter(v=>v.created).length,1);assert.deepEqual(a.find(v=>!v.created),{created:false})
  await assert.rejects(f.db.query('update private.payment_checkout_sessions set snapshot=\'{}\' where id=$1',[s.session.id]),/immutable/)
  await assert.rejects(f.db.query('update private.payment_checkout_attempts set amount_minor=1 where session_id=$1',[s.session.id]),/immutable/)
 })
 await t.test('signed success before intention persistence is durable and finalizes after mapping',async()=>{
  const s=await f.prepare(),a=await f.claim(s),id=next(),p=next(),before=await f.counts();const first=await f.callback(a,{id,provider:p});assert.equal(first.matched,false);assert.equal((await f.counts()).orders,before.orders)
  const result=await f.store(a,p);assert.equal(result.created,true);const row=(await f.db.query('select * from public.customer_orders where id=$1',[result.order_id])).rows[0];assert.equal(row.payment_status,'paid');assert.equal(row.amount_paid,'250.70');assert.equal(row.status,'processing');assert.equal(row.stock_fulfillment_state,'untracked')
  const x=await f.counts();assert.equal(x.orders,before.orders+1);assert.equal(x.transactions,before.transactions+1);assert.equal(x.shipping,before.shipping);assert.equal(x.stock,before.stock)
  for(const status of ['succeeded','pending','failed','succeeded'])await f.callback(a,{id,provider:p,status});assert.equal((await f.counts()).orders,x.orders);assert.equal((await f.db.query('select payment_status from public.customer_orders where id=$1',[row.id])).rows[0].payment_status,'paid')
 })
 await t.test('failed and locally expired attempts create no order; genuine late success is honored',async()=>{
  const s=await f.prepare(),a=await f.claim(s),p=next(),id=next(),before=await f.counts();await f.store(a,p);await f.callback(a,{id,provider:p,status:'failed'});assert.equal((await f.counts()).orders,before.orders)
  await f.db.query('alter table private.payment_checkout_sessions disable trigger checkout_snapshot_immutable');await f.db.query("update private.payment_checkout_sessions set expires_at=clock_timestamp()-interval '1 hour' where id=$1",[s.session.id]);await f.db.query('alter table private.payment_checkout_sessions enable trigger checkout_snapshot_immutable')
  await f.db.query('update public.products set price=999 where id=$1',[f.product]);const paid=await f.callback(a,{id,provider:p});assert.equal(paid.created,true);assert.equal((await f.db.query('select total_amount from public.customer_orders where id=$1',[paid.order_id])).rows[0].total_amount,'250.70');await f.db.query('update public.products set price=100.35 where id=$1',[f.product])
 })
 await t.test('wrong amount or mode remains private review evidence, never a paid order',async()=>{
  for(const patch of [{amount:1},{mode:'test'}]){const s=await f.prepare(),a=await f.claim(s),p=next(),before=await f.counts();await f.store(a,p);await f.callback(a,{id:next(),provider:p,...patch});assert.equal((await f.counts()).orders,before.orders);const state=await f.rpc('commerce_read_payment_checkout',[s.actor.id,s.session.id]);assert.equal(state.state,'review');assert.equal(state.orderId,null)}
 })
 await t.test('TEST provider success records evidence but creates no real order',async()=>{
  const s=await f.prepare(),a=await f.claim(s,'test'),p=next(),before=await f.counts();await f.store(a,p);await f.callback(a,{id:next(),provider:p});assert.equal((await f.counts()).orders,before.orders)
 })
 await t.test('finalization failures retain verified money and recover DB-only exactly once',async()=>{
  const s=await f.prepare(),a=await f.claim(s),p=next(),before=await f.counts();await f.store(a,p)
  await f.db.query("create function public.fixture_fail_order() returns trigger language plpgsql as $$ begin raise exception 'fixture insert failure';end $$;create trigger fixture_fail before insert on public.customer_orders for each row execute function public.fixture_fail_order()")
  await f.callback(a,{id:next(),provider:p});assert.equal((await f.counts()).orders,before.orders);assert.equal((await f.rpc('commerce_read_payment_checkout',[s.actor.id,s.session.id])).state,'review')
  assert.equal((await f.db.query('select count(*)::int n from private.payment_checkout_funds where session_id=$1',[s.session.id])).rows[0].n,1)
  await f.db.query('drop trigger fixture_fail on public.customer_orders;drop function public.fixture_fail_order()')
  const result=await f.rpc('commerce_recover_funded_checkout',[s.session.id]);assert.equal(result.created,true);assert.equal((await f.rpc('commerce_recover_funded_checkout',[s.session.id])).created,false);assert.equal((await f.counts()).orders,before.orders+1)
 })
 await t.test('stock policy changes after payment start produce a truthful paid hold, no invented stock',async()=>{
  const s=await f.prepare(),a=await f.claim(s),p=next(),b=await f.counts();await f.store(a,p);await f.db.query("update public.site_settings set inventory_tracking_required=true where key='default'");const result=await f.callback(a,{id:next(),provider:p});const o=(await f.db.query('select * from public.customer_orders where id=$1',[result.order_id])).rows[0];assert.equal(o.payment_status,'paid');assert.equal(o.status,'on_hold');assert.equal(o.stock_fulfillment_state,'awaiting_stock');assert.equal((await f.counts()).stock,b.stock);await f.db.query("update public.site_settings set inventory_tracking_required=false where key='default'")
 })
 await t.test('additional successful transactions remain audit evidence without another order',async()=>{
  const s=await f.prepare(),a=await f.claim(s),p=next();await f.store(a,p);await f.callback(a,{id:next(),provider:p});const b=await f.counts();await f.callback(a,{id:next(),provider:p});assert.equal((await f.counts()).orders,b.orders);assert.equal((await f.db.query('select count(*)::int n from private.payment_checkout_funds where session_id=$1',[s.session.id])).rows[0].n,2)
 })
 await t.test('COD stays an unpaid confirmation transaction without gateway dispatch',async()=>{
  const actor=await f.user(),cart=randomUUID(),order={first_name:'COD',email:actor.email,phone:'01012345678',street_address:'Fixture street',city:f.city,governorate:'Cairo',shipping_method:'shipping',shipping_company_id:f.company,payment_method:'cash',locale:'ar'},items=[{product_id:f.product,variant_id:f.variant,quantity:1}],q=await f.rpc('commerce_checkout_quote',[actor.id,cart,order,items]);const result=await f.rpc('commerce_checkout_command',[actor.id,cart,q.quoteId,order,items]);assert.equal(result.order.payment_status,'pending');assert.equal(result.order.amount_paid,0);assert.equal(result.order.payment_fee_amount,10)
 })
 await t.test('private sessions, funds and provider receipts have no browser/service table grants',async()=>{
  for(const role of ['anon','authenticated','service_role']){const c=await f.db.connect(role);for(const table of ['payment_checkout_sessions','payment_checkout_attempts','payment_checkout_funds','payment_callback_inbox','payment_callback_receipts'])await assert.rejects(c.query('select * from private.'+table),e=>e.code==='42501')}
  const s=await f.prepare();await assert.rejects(f.rpc('commerce_read_payment_checkout',[(await f.user()).id,s.session.id]));const read=await f.rpc('commerce_read_payment_checkout',[s.actor.id,s.session.id]);assert.ok(!JSON.stringify(read).includes('client_secret'))
 })
 await t.test('disabling new starts retains valid callbacks and immutable paid evidence',async()=>{
  const s=await f.prepare(),a=await f.claim(s),p=next();await f.store(a,p);await f.db.query('update private.payment_checkout_settings set enabled=false');const result=await f.callback(a,{id:next(),provider:p});assert.equal(result.created,true);await assert.rejects(f.rpc('commerce_checkout_command',[(await f.user()).id,randomUUID(),s.review.quoteId,s.order,s.items]),/payment_first:session_required/);await assert.rejects(f.prepare());await f.db.query('update private.payment_checkout_settings set enabled=true')
 })
 }finally{await f.close()}
})
