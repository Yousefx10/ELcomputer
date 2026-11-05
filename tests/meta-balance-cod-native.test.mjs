import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {paymentFirstFixture} from './helpers/paymentFirstFixture.mjs'
import {emailNativeAvailable} from './helpers/emailNativeDatabase.mjs'
test('Meta distinguishes uncollected COD and requires a completed immutable balance debit',{skip:!emailNativeAvailable,timeout:120000},async t=>{
 const f=await paymentFirstFixture(),hash='f'.repeat(64)
 try{
  await f.rpc('commerce_meta_configure',[f.actors.owner,0,{enabled:true,capiEnabled:true,pixelId:'123456789'},'v1.YQ.Yg.Yw',false]);await f.rpc('commerce_meta_consent',[hash,true,'Local fixture'])
  const quote=async(method,actor)=>{
   const cart=randomUUID(),order={first_name:'Owned',last_name:'Fixture',email:actor.email,phone:'01012345678',street_address:'Fixture street',city:f.city,governorate:'Cairo',shipping_method:'shipping',shipping_company_id:f.company,payment_method:method,locale:'en'},items=[{product_id:f.product,variant_id:f.variant,quantity:1}],q=await f.rpc('commerce_checkout_quote',[actor.id,cart,order,items])
   await f.rpc('commerce_meta_bind_checkout',[actor.id,cart,hash]);return {cart,order,items,q,args:[actor.id,cart,q.quoteId,order,items,randomUUID(),[{cart_key:f.product+':'+f.variant,cart_line_id:randomUUID(),quantity:1}]]}
  }
  await t.test('unpaid COD placement is a distinct custom event with no Purchase',async()=>{
   const actor=await f.user(),q=await quote('cash',actor);q.order.order_number='COD-LOCAL-'+randomUUID()
   const r=await f.rpc('commerce_checkout_command',[actor.id,q.cart,q.q.quoteId,q.order,q.items])
   const events=(await f.db.query('select event_name,custom_data from private.meta_event_outbox where order_id=$1',[r.order.id])).rows
   assert.equal(events.length,1);assert.equal(events[0].event_name,'CODOrderPlaced');assert.equal(events[0].custom_data.payment_status,'uncollected')
   assert.equal(await f.rpc('commerce_meta_purchase',[actor.id,r.order.id,hash]),null)
  })
  await t.test('preserved balance candidate composes with Meta after a real isolated ledger debit',async()=>{
   await f.db.exec(await readFile('tests/fixtures/preserved-customer-account-balance.sql','utf8'))
   const actor=await f.user(),recipient='local-ledger@fixture.invalid'
   await f.rpc('commerce_balance_configure',[f.actors.owner,0,{enabled:true,funding_enabled:true,terms_approved:true,reconciliation_approved:true,funding_recipient:recipient,funding_recipient_verified:true}])
   await f.rpc('commerce_balance_adjust',[f.actors.owner,actor.id,randomUUID(),'deposit',20000,{currency:'EGP',authorized:true,reason:'Isolated verified funding fixture',reference:'LOCAL-'+randomUUID(),evidence_sha256:'a'.repeat(64),bank_credit_verified:true,recipient,bank_received_at:new Date().toISOString()}])
   const q=await quote('account_balance',actor),result=await f.rpc('commerce_pay_with_balance',q.args)
   assert.equal(result.checkout.paymentStatus,'paid')
   const events=(await f.db.query("select event_id from private.meta_event_outbox where event_name='Purchase' and order_id=$1",[result.checkout.orderId])).rows;assert.equal(events.length,1)
   const debit=(await f.db.query("select e.amount_minor,r.state from private.customer_balance_reservations r join private.customer_balance_entries e on e.id=r.debit_entry where r.session_id=$1",[result.checkout.id])).rows[0];assert.equal(debit.state,'spent');assert.equal(debit.amount_minor,'15035')
   await f.rpc('commerce_pay_with_balance',q.args);assert.equal((await f.db.query("select count(*)::int n from private.meta_event_outbox where event_name='Purchase' and order_id=$1",[result.checkout.orderId])).rows[0].n,1)
  })
 }finally{await f.close()}
})
