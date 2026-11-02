import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {paymentFirstFixture} from './helpers/paymentFirstFixture.mjs'
import {createEmailNativeDatabase,emailNativeAvailable} from './helpers/emailNativeDatabase.mjs'
test('schema107 already retains financial ownership when an Auth deletion is attempted',{skip:!emailNativeAvailable,timeout:120000},async()=>{
 const db=await createEmailNativeDatabase({stopBefore:'20261101220000'});try{
  const user=randomUUID(),id=randomUUID();await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'owned@fixture.invalid',now())",[user]);await db.query("insert into public.site_settings(key,payment_card_enabled) values('default',true) on conflict(key) do update set payment_card_enabled=true");await db.query("insert into public.customer_orders(id,user_id,order_number,first_name,phone,street_address,city,governorate,payment_method,total_amount) values($1,$2,'LOCAL-BASELINE-OWNERSHIP','Owned','01012345678','Owned street','Cairo','Cairo','card',100)",[id,user]);await db.query("insert into public.payment_attempts(order_id,mode,integration_id,amount_minor,currency,status,provider_order_id) values($1,'live',123,10000,'EGP','pending','990001')",[id]);await db.query('select public.commerce_reconcile_payment_transaction($1)',[JSON.stringify({provider_order_id:'990001',transaction_id:'990002',mode:'live',integration_id:123,amount_minor:10000,currency:'EGP',status:'succeeded'})]);await assert.rejects(db.query('delete from auth.users where id=$1',[user]),/Gateway order financial context cannot change/);assert.equal((await db.query('select count(*)::int n from auth.users where id=$1',[user])).rows[0].n,1)
 }finally{await db.close()}
})
test('new paid purchases preserve the financial owner across deletion, rebind attempts and callback replay',{skip:!emailNativeAvailable,timeout:120000},async()=>{
 const f=await paymentFirstFixture();try{
  const s=await f.prepare(),a=await f.claim(s);await f.store(a);const paid=await f.callback(a),other=await f.user();assert.ok(paid.order_id)
  for(const command of [()=>f.db.query('update public.customer_orders set user_id=$2 where id=$1',[paid.order_id,other.id]),()=>f.db.query('update public.customer_orders set user_id=null where id=$1',[paid.order_id]),()=>f.db.query('delete from auth.users where id=$1',[s.actor.id])])await assert.rejects(command,/financial identity is immutable/)
  const order=(await f.db.query('select * from public.customer_orders where id=$1',[paid.order_id])).rows[0];assert.equal(order.user_id,s.actor.id);assert.equal(order.payment_status,'paid');assert.equal(order.amount_paid,'250.70')
  assert.equal((await f.db.query('select user_id from private.payment_checkout_sessions where id=$1',[s.session.id])).rows[0].user_id,s.actor.id)
  assert.equal((await f.db.query('select count(*)::int n from private.payment_checkout_funds where session_id=$1',[s.session.id])).rows[0].n,1)
  await f.callback(a);assert.equal((await f.db.query('select count(*)::int n from public.customer_orders where checkout_session_id=$1',[s.session.id])).rows[0].n,1)
  await assert.rejects(f.rpc('commerce_read_payment_checkout',[other.id,s.session.id]),e=>e.code==='42501')
 }finally{await f.close()}
})
