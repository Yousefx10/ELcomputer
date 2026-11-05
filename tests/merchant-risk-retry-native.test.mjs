import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {paymentFirstFixture} from './helpers/paymentFirstFixture.mjs'
import {emailNativeAvailable} from './helpers/emailNativeDatabase.mjs'
test('merchant-risk retries retain every charge and exactly one fulfillment',{skip:!emailNativeAvailable,timeout:240000},async t=>{
 const f=await paymentFirstFixture();let serial=91000,tx=51000
 const make=async actor=>{const s=await f.prepare({actor});const a=await f.claim(s);const provider=String(serial++);await f.store(a,provider);return {s,a,provider}}
 const submit=async x=>{const opened=await f.rpc('commerce_checkout_payment_interface',[x.s.actor.id,x.s.session.id,'open',null,'live',123]);assert.equal(opened.allowed,true);assert.equal((await f.rpc('commerce_checkout_payment_interface',[x.s.actor.id,x.s.session.id,'submit',opened.token,'live',123])).allowed,true)}
 const pay=async(x,id=String(tx++),c=f.db)=>{const value={transaction_id:id,provider_order_id:x.provider,integration_id:123,mode:'live',currency:'EGP',amount_minor:Number(x.a.attempt.amount_minor),status:'succeeded',evidence_sha256:'a'.repeat(64),signature_sha256:'b'.repeat(64)};return {id,result:await f.rpc('commerce_accept_payment_callback',[value],c),value}}
 try{
  await t.test('policy is default OFF and only payment configuration staff can enable it',async()=>{
   assert.equal((await f.rpc('commerce_payment_checkout_readiness')).merchantRiskRetries,false)
   const actor=await f.user(),first=await make(actor);await submit(first);await assert.rejects(f.prepare({actor}),/payment_first:existing/)
   await assert.rejects(f.rpc('commerce_configure_payment_retry',[actor.id,0,true]),/permission denied/i)
   const result=await f.rpc('commerce_configure_payment_retry',[f.actors.owner,0,true]);assert.equal(result.merchantRiskRetries,true);await assert.rejects(f.rpc('commerce_configure_payment_retry',[f.actors.owner,0,false]),/changed/i)
  })
  await t.test('closed or submitted CARD permits an immediate fresh attempt without rewriting its financial status',async()=>{
   const actor=await f.user(),one=await make(actor);await submit(one)
   await f.rpc('commerce_retire_checkout_presentation',[actor.id,one.s.session.id]);const two=await make(actor)
   assert.notEqual(one.s.session.id,two.s.session.id);assert.notEqual(one.a.attempt.id,two.a.attempt.id);assert.notEqual(one.provider,two.provider)
   const rows=(await f.db.query('select state,commercial_obligation_id from private.payment_checkout_sessions where user_id=$1 order by created_at',[actor.id])).rows;assert.ok(rows.every(r=>r.commercial_obligation_id===one.s.session.id))
   const old=(await f.db.query('select status,interface_state,presentation_retired_at,provider_order_id from private.payment_checkout_attempts where id=$1',[one.a.attempt.id])).rows[0];assert.equal(old.status,'pending');assert.equal(old.interface_state,'submitted');assert.ok(old.presentation_retired_at);assert.equal(old.provider_order_id,one.provider)
   const reopen=await f.rpc('commerce_checkout_payment_interface',[actor.id,one.s.session.id,'open',null,'live',123]);assert.equal(reopen.allowed,false)
  })
  await t.test('CARD to Apple Pay to CARD uses new integration identities on one obligation',async()=>{
   const actor=await f.user(),first=await make(actor),second=await f.prepare({actor}),a2=await f.rpc('commerce_claim_checkout_payment',[actor.id,second.session.id,'live',456,2]);await f.store(a2,String(serial++))
   const third=await make(actor);const a=(await f.db.query('select integration_id from private.payment_checkout_attempts where session_id in($1,$2,$3) order by created_at',[first.s.session.id,second.session.id,third.s.session.id])).rows;assert.deepEqual(a.map(x=>Number(x.integration_id)),[123,456,123])
  })
  await t.test('newer success followed by an old success records two immutable funds and one order',async()=>{
   const actor=await f.user(),one=await make(actor);await submit(one);const two=await make(actor)
   const newer=await pay(two),older=await pay(one)
   const orders=(await f.db.query('select id,checkout_session_id from public.customer_orders where user_id=$1',[actor.id])).rows;assert.equal(orders.length,1);assert.equal(orders[0].checkout_session_id,two.s.session.id)
   const funds=(await f.db.query('select reference,is_primary,amount_minor from private.payment_checkout_funds where session_id in($1,$2) order by verified_at',[one.s.session.id,two.s.session.id])).rows;assert.equal(funds.length,2);assert.equal(funds.filter(x=>x.is_primary).length,1);assert.equal(funds.reduce((n,x)=>n+Number(x.amount_minor),0),Number(one.a.attempt.amount_minor)*2)
   assert.equal((await f.db.query('select review_reason from private.payment_checkout_sessions where id=$1',[one.s.session.id])).rows[0].review_reason,'additional_verified_payment')
   const view=await f.rpc('commerce_read_payment_checkout',[actor.id,one.s.session.id]);assert.equal(view.orderId,orders[0].id);assert.equal(view.paymentStatus,'paid');assert.equal(view.completionCheckoutId,two.s.session.id)
   await f.rpc('commerce_accept_payment_callback',[older.value]);await f.rpc('commerce_accept_payment_callback',[newer.value]);assert.equal((await f.db.query('select count(*)::int n from public.customer_orders where user_id=$1',[actor.id])).rows[0].n,1)
   assert.equal((await f.db.query('select count(*)::int n from private.payment_checkout_funds where session_id in($1,$2)',[one.s.session.id,two.s.session.id])).rows[0].n,2)
  })
  await t.test('old success followed by newer success also fulfills only once',async()=>{
   const actor=await f.user(),one=await make(actor),two=await make(actor);await pay(one);await pay(two)
   assert.equal((await f.db.query('select count(*)::int n from public.customer_orders where user_id=$1',[actor.id])).rows[0].n,1)
  })
  await t.test('simultaneous authenticated successes serialize funding across sessions',async()=>{
   const actor=await f.user(),one=await make(actor),two=await make(actor),c=await f.db.connect();await Promise.all([pay(one),pay(two,String(tx++),c)])
   const rows=(await f.db.query('select is_primary from private.payment_checkout_funds where session_id in($1,$2)',[one.s.session.id,two.s.session.id])).rows;assert.equal(rows.length,2);assert.equal(rows.filter(r=>r.is_primary).length,1)
   assert.equal((await f.db.query('select count(*)::int n from public.customer_orders where user_id=$1',[actor.id])).rows[0].n,1)
  })
  await t.test('an owned replay remains idempotent; new carts do not revive an older command',async()=>{
   const actor=await f.user(),one=await make(actor),s=one.s
   const replay=await f.rpc('commerce_prepare_payment_checkout',[actor.id,s.cart,s.review.quoteId,s.order,s.items,s.revision]);assert.equal(replay.created,false);assert.equal(replay.checkout.id,s.session.id)
   const two=await make(actor);assert.notEqual(two.s.session.id,s.session.id)
  })
  await t.test('cross-customer reads, retirement, quote tampering and transaction reuse stay denied',async()=>{
   const one=await make(),other=await f.user();await assert.rejects(f.rpc('commerce_retire_checkout_presentation',[other.id,one.s.session.id]),/not found/i);await assert.rejects(f.rpc('commerce_read_payment_checkout',[other.id,one.s.session.id]),/not found/i)
   const bad={...one.s.order,phone:'01000000001'};await assert.rejects(f.rpc('commerce_prepare_payment_checkout',[one.s.actor.id,randomUUID(),one.s.review.quoteId,bad,one.s.items,randomUUID()]),/quote/)
   const paid=await pay(one),two=await make(other);await assert.rejects(f.rpc('commerce_accept_payment_callback',[{...paid.value,provider_order_id:two.provider}]),/context mismatch/i)
  })
  await t.test('stable cart lines preserve one purchase through address, quantity and language changes',async()=>{
   const actor=await f.user(),base=await f.prepare({actor}),line=randomUUID()
   const prepare=async(order,quantity)=>{const cart=randomUUID(),revision=randomUUID(),items=base.items.map(x=>({...x,quantity})),lines=items.map(x=>({cart_key:x.product_id+':'+x.variant_id,cart_line_id:line,quantity})),quote=await f.rpc('commerce_checkout_quote',[actor.id,cart,order,items]);return (await f.rpc('commerce_prepare_payment_checkout',[actor.id,cart,quote.quoteId,order,items,revision,lines])).checkout}
   const one=await prepare(base.order,2),two=await prepare({...base.order,street_address:'Changed owned address',locale:'ar'},3)
   const rows=(await f.db.query('select commercial_obligation_id from private.payment_checkout_sessions where id=any($1)',[[one.id,two.id]])).rows;assert.equal(rows.length,2);assert.equal(rows[0].commercial_obligation_id,rows[1].commercial_obligation_id)
  })
  await t.test('verified funds awaiting order recovery never offer another charge',async()=>{
   const actor=await f.user(),one=await make(actor),definition=(await f.db.query("select pg_get_functiondef('private.finalize_payment_checkout(uuid)'::regprocedure) d")).rows[0].d
   try{await f.db.query("create or replace function private.finalize_payment_checkout(p_session_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$begin raise exception 'Fixture fulfillment unavailable';end$$");await pay(one)}finally{await f.db.query(definition)}
   const view=await f.rpc('commerce_read_payment_checkout',[actor.id,one.s.session.id]);assert.equal(view.merchantRiskRetryAllowed,false);assert.equal(view.paymentStatus,'verified_order_pending')
   const retry=await f.prepare({actor});assert.equal(retry.session.id,one.s.session.id);assert.equal(retry.session.fundsVerified,true)
  })
  await t.test('permanent retirement and obligation identities cannot be rewritten',async()=>{
   const actor=await f.user(),one=await make(actor),two=await make(actor);await f.rpc('commerce_retire_checkout_presentation',[actor.id,one.s.session.id]);await assert.rejects(f.db.query('update private.payment_checkout_attempts set presentation_retired_at=null where id=$1',[one.a.attempt.id]),/immutable/)
   await assert.rejects(f.db.query('update private.payment_checkout_sessions set commercial_obligation_id=$1 where id=$2',[two.s.session.id,one.s.session.id]),/immutable/)
  })
 }finally{await f.close()}
})
