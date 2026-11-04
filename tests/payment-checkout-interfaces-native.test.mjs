import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {paymentFirstFixture} from './helpers/paymentFirstFixture.mjs'
import {emailNativeAvailable} from './helpers/emailNativeDatabase.mjs'
import {createEmailFixture} from './helpers/emailFixture.mjs'

const migration='supabase/migrations/20261104020000_checkout_payment_interfaces.sql'
const metadata=['interface_state','interface_token','submission_started_at','submission_failure_id','replacement_cart_id','inquiry_transaction_id','inquiry_evidence_sha256','inquiry_checked_at']
let provider=91000,transaction=81000
async function journey(f,{actor,product=f.product,variant=f.variant,quantity=1,lineId=randomUUID(),cart=randomUUID(),revision=randomUUID(),locale='en'}={}){
 actor||=await f.user()
 const order={first_name:'Owned',last_name:'Fixture',email:actor.email,phone:'01012345678',street_address:'Fixture street',city:f.city,governorate:'Cairo',shipping_method:'shipping',shipping_company_id:f.company,payment_method:'card',locale}
 const items=[{product_id:product,variant_id:variant,quantity}],lines=[{cart_key:product+':'+variant,cart_line_id:lineId,quantity}]
 const review=await f.rpc('commerce_checkout_quote',[actor.id,cart,order,items])
 const result=await f.rpc('commerce_prepare_payment_checkout',[actor.id,cart,review.quoteId,order,items,revision,lines])
 return {actor,cart,revision,order,items,lines,review,session:result.checkout}
}
async function initialized(f,s){
 const a=await f.claim(s),id=String(++provider);await f.store(a,id)
 const open=await f.rpc('commerce_checkout_payment_interface',[s.actor.id,s.session.id,'open',null,'live',123])
 assert.equal(open.allowed,true);return {a,id,open}
}
const financialSnapshot=async f=>(await f.db.query("select * from (select 'sessions' kind,to_jsonb(s) value from private.payment_checkout_sessions s union all select 'attempts',to_jsonb(a)-$1::text[] from private.payment_checkout_attempts a union all select 'funds',to_jsonb(f) from private.payment_checkout_funds f union all select 'callbacks',to_jsonb(r) from private.payment_callback_inbox r) evidence order by kind,value::text",[metadata])).rows
const signed=async(f,a,id,status)=>f.rpc('commerce_accept_payment_callback',[{transaction_id:String(++transaction),provider_order_id:id,integration_id:123,mode:'live',currency:'EGP',amount_minor:Number(a.attempt.amount_minor),status,evidence_sha256:'a'.repeat(64),signature_sha256:'b'.repeat(64)}])

test('113 migration preserves five historical unknown attempts and rolls back exactly',{skip:!emailNativeAvailable,timeout:180000},async()=>{
 const f=await paymentFirstFixture({stopBefore:'20261104020000'})
 try{
  for(let i=0;i<5;i++){const s=await f.prepare(),a=await f.claim(s);await f.store(a,String(++provider))}
  const before=await financialSnapshot(f),schema=async()=>(await f.db.query("select n.nspname,p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('private','public') and p.prokind='f' order by 1,2")).rows
  const ddlBefore=await schema(),sql=(await readFile(migration,'utf8')).replace(/^begin;$/m,'').replace(/^commit;$/m,'')
  await f.db.query('begin');await f.db.query(sql)
  assert.deepEqual(await financialSnapshot(f),before)
  assert.equal((await f.db.query("select count(*)::int n from private.payment_checkout_attempts where interface_state='unknown' and interface_token is null and submission_started_at is null")).rows[0].n,5)
  assert.equal((await f.counts()).orders,0)
  await f.db.query('rollback');assert.deepEqual(await schema(),ddlBefore);assert.deepEqual(await financialSnapshot(f),before)
  assert.equal((await f.db.query("select to_regclass('private.payment_checkout_one_unresolved') is not null restored")).rows[0].restored,true)
 }finally{await f.close()}
})

test('initialized, submitted, declined and late-success checkout invariants',{skip:!emailNativeAvailable,timeout:240000},async t=>{
 const f=await paymentFirstFixture()
 try{
  await t.test('opening and immediate reopening reuse one intention without an order or financial cancellation',async()=>{
   const s=await journey(f),{a,open}=await initialized(f,s),before=await f.counts()
   const q=await f.rpc('commerce_checkout_quote',[s.actor.id,s.cart,s.order,s.items])
   const repeated=await f.rpc('commerce_prepare_payment_checkout',[s.actor.id,s.cart,q.quoteId,s.order,s.items,s.revision,s.lines])
   assert.equal(repeated.created,false);assert.equal(repeated.checkout.id,s.session.id)
   const again=await f.rpc('commerce_checkout_payment_interface',[s.actor.id,s.session.id,'open',null,'live',123])
   assert.equal(again.allowed,true);assert.notEqual(again.token,open.token);assert.equal(again.clientSecret,open.clientSecret)
   assert.equal(again.checkout.paymentStatus,'ready');assert.ok(again.checkout.canResume)
   assert.deepEqual(await f.counts(),before)
   assert.equal((await f.db.query('select status from private.payment_checkout_attempts where id=$1',[a.attempt.id])).rows[0].status,'pending')
   assert.ok(!JSON.stringify(again.checkout).includes(open.clientSecret));assert.ok(!JSON.stringify(again.checkout).includes(again.token))
  })
  await t.test('cart edits supersede only a new unsubmitted interface and preserve its callback mapping',async()=>{
   const first=await journey(f),old=await initialized(f,first)
   await assert.rejects(journey(f,{actor:first.actor,cart:first.cart,quantity:2,lineId:first.lines[0].cart_line_id}),/checkout:restart/)
   const second=await journey(f,{actor:first.actor,quantity:2,lineId:first.lines[0].cart_line_id}),fresh=await initialized(f,second)
   const row=(await f.db.query('select * from private.payment_checkout_attempts where id=$1',[old.a.attempt.id])).rows[0]
   assert.equal(row.interface_state,'superseded');assert.equal(row.provider_order_id,old.id);assert.equal(row.status,'pending')
   const denied=await f.rpc('commerce_checkout_payment_interface',[first.actor.id,first.session.id,'submit',old.open.token,'live',123]);assert.equal(denied.allowed,false)
   const submitted=await f.rpc('commerce_checkout_payment_interface',[second.actor.id,second.session.id,'submit',fresh.open.token,'live',123]);assert.equal(submitted.allowed,true)
   await signed(f,fresh.a,fresh.id,'succeeded');await signed(f,old.a,old.id,'succeeded')
   const orders=(await f.db.query('select * from public.customer_orders where user_id=$1',[first.actor.id])).rows
   assert.equal(orders.length,1);assert.equal(orders[0].total_amount,'250.70');assert.equal(orders[0].payment_status,'paid')
   const late=await f.rpc('commerce_read_payment_checkout',[first.actor.id,first.session.id]);assert.equal(late.paymentStatus,'verified_order_pending');assert.equal(late.fundsVerified,true);assert.equal(late.orderId,null)
   assert.equal((await f.db.query('select count(*)::int n from private.payment_checkout_funds where session_id=any($1::uuid[])',[[first.session.id,second.session.id]])).rows[0].n,2)
  })
  await t.test('two tabs can open but only the latest interface can submit once',async()=>{
   const s=await journey(f),{open}=await initialized(f,s),next=await f.rpc('commerce_checkout_payment_interface',[s.actor.id,s.session.id,'open',null,'live',123])
   const clients=await Promise.all([f.db.connect(),f.db.connect(),f.db.connect()])
   const results=await Promise.all([open.token,next.token,next.token].map((token,i)=>f.rpc('commerce_checkout_payment_interface',[s.actor.id,s.session.id,'submit',token,'live',123],clients[i])))
   assert.equal(results.filter(r=>r.allowed).length,1);assert.equal(results[0].allowed,false)
   assert.equal((await f.db.query('select count(*)::int n from private.payment_checkout_attempts where session_id=$1',[s.session.id])).rows[0].n,1)
  })
  await t.test('submitted or unknown results protect affected items while unrelated purchases remain available',async()=>{
   const s=await journey(f),{open}=await initialized(f,s)
   assert.equal((await f.rpc('commerce_checkout_payment_interface',[s.actor.id,s.session.id,'submit',open.token,'live',123])).allowed,true)
   await assert.rejects(journey(f,{actor:s.actor}),/payment_first:existing/)
   const product=(await f.db.query("insert into public.products(title,slug,price,is_serialized,is_published,primary_warehouse_id) values('Unrelated fixture',$1,33,true,true,$2) returning id",['unrelated-'+randomUUID(),f.warehouse])).rows[0].id
   const variant=(await f.db.query('select id from public.product_variants where product_id=$1',[product])).rows[0].id
   const unrelated=await journey(f,{actor:s.actor,product,variant});assert.ok(unrelated.session.id)
   assert.equal((await f.rpc('commerce_checkout_payment_interface',[s.actor.id,s.session.id,'open',null,'live',123])).allowed,false)
   assert.equal((await f.rpc('commerce_read_payment_checkout',[s.actor.id,s.session.id])).orderId,null)
  })
  await t.test('a trusted decline permits Try Again on the same intention; replay cannot unlock a further submission',async()=>{
   const s=await journey(f),{a,id,open}=await initialized(f,s)
   await f.rpc('commerce_checkout_payment_interface',[s.actor.id,s.session.id,'submit',open.token,'live',123])
   const tx=String(++transaction),receipt={transaction_id:tx,provider_order_id:id,integration_id:123,mode:'live',currency:'EGP',amount_minor:Number(a.attempt.amount_minor),status:'failed',evidence_sha256:'c'.repeat(64),signature_sha256:'d'.repeat(64)}
   await f.rpc('commerce_accept_payment_callback',[receipt]);let state=await f.rpc('commerce_read_payment_checkout',[s.actor.id,s.session.id])
   assert.equal(state.paymentStatus,'failed');assert.equal(state.canResume,true);assert.equal(state.orderId,null)
   const retry=await f.rpc('commerce_checkout_payment_interface',[s.actor.id,s.session.id,'open',null,'live',123]);assert.equal(retry.clientSecret,open.clientSecret)
   await f.rpc('commerce_checkout_payment_interface',[s.actor.id,s.session.id,'submit',retry.token,'live',123])
   await f.rpc('commerce_accept_payment_callback',[receipt]);state=await f.rpc('commerce_read_payment_checkout',[s.actor.id,s.session.id])
   assert.equal(state.canResume,false);assert.equal(state.paymentStatus,'unverified')
   assert.equal((await f.rpc('commerce_checkout_payment_interface',[s.actor.id,s.session.id,'open',null,'live',123])).allowed,false)
   const waitingId=String(++transaction)
   await f.rpc('commerce_accept_payment_callback',[{...receipt,transaction_id:waitingId,status:'pending'}])
   state=await f.rpc('commerce_read_payment_checkout',[s.actor.id,s.session.id]);assert.equal(state.canResume,false);assert.equal(state.paymentStatus,'unverified','A pending retry must not inherit the previous decline label')
   await signed(f,a,id,'succeeded');assert.equal((await f.rpc('commerce_read_payment_checkout',[s.actor.id,s.session.id])).paymentStatus,'paid')
  })
  await t.test('a delayed authenticated success and duplicate callback produce one paid order and one notification',async()=>{
   const email=await createEmailFixture({database:f.db});await email.activate();await email.configure({marketing_enabled:false,webhook_enabled:false});await f.rpc('order_email_configure',[email.actors.owner,0,true])
   const s=await journey(f,{locale:'ar'}),{a,id,open}=await initialized(f,s)
   await f.rpc('commerce_checkout_payment_interface',[s.actor.id,s.session.id,'submit',open.token,'live',123])
   await signed(f,a,id,'pending');assert.equal((await f.rpc('commerce_read_payment_checkout',[s.actor.id,s.session.id])).orderId,null)
   const tx=String(++transaction),receipt={transaction_id:tx,provider_order_id:id,integration_id:123,mode:'live',currency:'EGP',amount_minor:Number(a.attempt.amount_minor),status:'succeeded',evidence_sha256:'e'.repeat(64),signature_sha256:'f'.repeat(64)}
   await Promise.all([f.rpc('commerce_accept_payment_callback',[receipt],await f.db.connect()),f.rpc('commerce_accept_payment_callback',[receipt],await f.db.connect())])
   const paid=await f.rpc('commerce_read_payment_checkout',[s.actor.id,s.session.id]);assert.equal(paid.paymentStatus,'paid')
   assert.equal((await f.db.query('select count(*)::int n from public.customer_orders where checkout_session_id=$1',[s.session.id])).rows[0].n,1)
   const events=(await f.db.query('select event_type,locale from public.order_email_events where order_id=$1',[paid.orderId])).rows
   assert.deepEqual(events,[{event_type:'payment_verified',locale:'ar'}])
  })
  await t.test('a separate purchase after paid cart acknowledgement can buy remaining quantities',async()=>{
   const first=await journey(f),initial=await initialized(f,first);await signed(f,initial.a,initial.id,'succeeded')
   const second=await journey(f,{actor:first.actor,lineId:first.lines[0].cart_line_id}),next=await initialized(f,second);await signed(f,next.a,next.id,'succeeded')
   assert.equal((await f.db.query('select count(*)::int n from public.customer_orders where user_id=$1',[first.actor.id])).rows[0].n,2)
   assert.equal((await f.db.query('select replacement_cart_id from private.payment_checkout_attempts where id=$1',[initial.a.attempt.id])).rows[0].replacement_cart_id,null)
  })
  await t.test('COD can replace an unsubmitted form while a genuine late card success stays in review',async()=>{
   const first=await journey(f),initial=await initialized(f,first),cart=randomUUID(),cash={...first.order,payment_method:'cash'}
   const q=await f.rpc('commerce_checkout_quote',[first.actor.id,cart,cash,first.items])
   const result=await f.rpc('commerce_checkout_command',[first.actor.id,cart,q.quoteId,cash,first.items])
   assert.equal(result.created,true);const order=(await f.db.query('select * from public.customer_orders where checkout_cart_id=$1',[cart])).rows[0]
   assert.equal(order.payment_status,'pending');assert.equal(order.amount_paid,'0.00');assert.equal(order.payment_fee_amount,'10.00')
   await signed(f,initial.a,initial.id,'succeeded')
   assert.equal((await f.db.query('select count(*)::int n from public.customer_orders where user_id=$1',[first.actor.id])).rows[0].n,1)
   const late=await f.rpc('commerce_read_payment_checkout',[first.actor.id,first.session.id]);assert.equal(late.paymentStatus,'verified_order_pending');assert.equal(late.fundsVerified,true)
  })
  await t.test('a targeted authenticated inquiry is staff-scoped and never forges a signed callback receipt',async()=>{
   const s=await journey(f),initial=await initialized(f,s),tx={transaction_id:String(++transaction),provider_order_id:initial.id,integration_id:123,mode:'live',currency:'EGP',amount_minor:Number(initial.a.attempt.amount_minor),status:'succeeded'}
   await assert.rejects(f.rpc('commerce_record_checkout_inquiry',[f.actors.viewer,initial.a.attempt.id,tx,'1'.repeat(64)]),e=>e.code==='42501')
   await assert.rejects(f.rpc('commerce_record_checkout_inquiry',[f.actors.owner,initial.a.attempt.id,{...tx,amount_minor:1},'1'.repeat(64)]),/context mismatch/)
   const result=await f.rpc('commerce_record_checkout_inquiry',[f.actors.owner,initial.a.attempt.id,tx,'1'.repeat(64)])
   assert.equal(result.created,true);const paid=await f.rpc('commerce_read_payment_checkout',[s.actor.id,s.session.id]);assert.equal(paid.paymentStatus,'paid')
   assert.equal((await f.db.query('select count(*)::int n from private.payment_callback_receipts where transaction_id=$1',[tx.transaction_id])).rows[0].n,0)
   assert.equal((await f.db.query('select inquiry_evidence_sha256 from private.payment_checkout_attempts where id=$1',[initial.a.attempt.id])).rows[0].inquiry_evidence_sha256,'1'.repeat(64))
  })
  await t.test('customer roles cannot arm interfaces, inspect tokens or invoke private reconciliation',async()=>{
   const s=await journey(f);await initialized(f,s)
   await assert.rejects(f.rpc('commerce_checkout_payment_interface',[(await f.user()).id,s.session.id,'context']),e=>e.code==='42501')
   for(const role of ['anon','authenticated']){
    const client=await f.db.connect(role)
    await assert.rejects(client.query('select * from private.payment_checkout_attempts'),e=>e.code==='42501')
    await assert.rejects(f.rpc('commerce_checkout_payment_interface',[s.actor.id,s.session.id,'context'],client),e=>e.code==='42501')
   }
   await assert.rejects(f.rpc('commerce_claim_checkout_payment',[s.actor.id,s.session.id,'live',123]),/payment_first:refresh/)
  })
 }finally{await f.close()}
})
