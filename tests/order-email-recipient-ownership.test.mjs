import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createEmailFixture} from './helpers/emailFixture.mjs'
import {createEmailNativeDatabase} from './helpers/emailNativeDatabase.mjs'
import {processOrderEmailNotifications,prepareOrderEmail} from '../server/utils/orderEmailNotifications.js'
import {emailRpc} from '../server/utils/email/core.js'
import {emailLayout} from '../app/utils/email.js'
import {smsDatabaseClient} from './helpers/smsDatabase.mjs'
import {nativeWaitFor} from './helpers/emailNativeDatabase.mjs'

test('verified owner recipients preserve bilingual order email safety on native PostgreSQL',async t=>{
 const db=await createEmailNativeDatabase(),f=await createEmailFixture({database:db})
 const ownerAddress='customer@email.example.invalid'
 const rpc=async(name,args={})=>{const r=await f.client.rpc(name,args);if(r.error)throw Object.assign(Error(r.error.message),r.error);return r.data}
 const configure=async enabled=>rpc('order_email_configure',{p_actor:f.actors.owner,p_revision:(await db.query('select revision from public.order_email_settings')).rows[0].revision,p_enabled:enabled})
 const reset=async()=>{
  await configure(false);await f.configure({marketing_enabled:false,webhook_enabled:false});await configure(true)
  await db.query('update auth.users set email=$2,email_confirmed_at=clock_timestamp() where id=$1',[f.actors.customer,ownerAddress])
 }
 const make=async({method='card',locale='en',email=ownerAddress,status=null,cart=randomUUID()}={})=>(await db.query(`insert into public.customer_orders(user_id,checkout_cart_id,order_number,email,first_name,last_name,phone,street_address,city,governorate,payment_method,status,payment_status,total_amount,currency,sms_locale)
 values($1,$2,$3,$4,'Synthetic','Buyer','01012345678','Synthetic street','Cairo','Cairo',$5,$6,'pending',200.35,'EGP',$7) returning *`,[f.actors.customer,cart,'ORD-LOCAL-SAFETY-'+randomUUID(),email,method,status||(method==='card'?'pending_payment':'processing'),locale])).rows[0]
 const events=async o=>(await db.query('select * from public.order_email_events where order_id=$1 order by created_at,id',[o.id])).rows
 const settle=async o=>{
  const providerOrder=String(100000000+Math.floor(Math.random()*100000000)),transaction=String(300000000+Math.floor(Math.random()*100000000))
  const a=(await db.query(`insert into public.payment_attempts(order_id,mode,integration_id,amount_minor,currency,status,provider_order_id) values($1,'live',12345,20035,'EGP','pending',$2) returning *`,[o.id,providerOrder])).rows[0]
  const tx={provider_order_id:providerOrder,transaction_id:transaction,status:'succeeded',mode:'live',integration_id:12345,amount_minor:20035,currency:'EGP'}
  await rpc('commerce_reconcile_payment_transaction',{p_transaction:tx});return {a,tx}
 }
 try{
  await db.query("insert into public.site_settings(key,payment_card_enabled,payment_cash_enabled) values('default',true,true) on conflict(key) do update set payment_card_enabled=true,payment_cash_enabled=true")
  await f.activate();await reset()
  for(const method of ['card','cash'])for(const locale of ['en','ar']){
   await t.test(method+' / '+locale+' captures and queues a truthful private receipt',async()=>{
    await reset();const o=await make({method,locale});const result=await processOrderEmailNotifications(f.client)
    assert.equal(result.processed.length,1);const [e]=await events(o),m=await f.message(e.email_message_id)
    assert.equal(e.event_type,'order_received');assert.equal(e.locale,locale);assert.equal(m.recipient,ownerAddress)
    assert.equal(m.classification,'transactional');assert.equal(m.state,'queued');assert.equal(m.delivery_state,'unobserved')
    assert.equal(m.locale,locale);assert.match(m.html_body,new RegExp('dir="'+(locale==='ar'?'rtl':'ltr')+'"'))
    assert.doesNotMatch(m.subject,/Payment confirmed|تم تأكيد الدفع/)
    assert.match(m.text_body,method==='card'?(locale==='ar'?/لم يتم تأكيد الدفع/:/not confirmed/):(locale==='ar'?/لم يتم تحصيل المبلغ/:/not collected/))
    assert.doesNotMatch(m.html_body,/<a\b|<img\b|href=|src=/i)
    for(const forbidden of ['Synthetic street','01012345678',f.actors.customer,o.id])assert.ok(!m.html_body.includes(forbidden))
    assert.equal(Number(o.amount_paid),0)
   })
  }
  for(const locale of ['en','ar'])await t.test(locale+' verified CARD payment queues once across repeated callbacks',async()=>{
   await reset();const o=await make({locale}),{tx}=await settle(o)
   for(let i=0;i<3;i++)await rpc('commerce_reconcile_payment_transaction',{p_transaction:tx})
   await processOrderEmailNotifications(f.client,{limit:3})
   const es=await events(o);assert.equal(es.length,2);const paid=es.find(e=>e.event_type==='payment_verified')
   assert.equal(paid.state,'queued');assert.match((await f.message(paid.email_message_id)).subject,locale==='ar'?/تم تأكيد الدفع/:/Payment confirmed/)
   assert.equal(es.find(e=>e.event_type==='order_received').state,'suppressed')
   assert.equal((await db.query('select count(*)::int n from public.email_messages where idempotency_key=$1',[paid.id])).rows[0].n,1)
  })
  await t.test('paid database flag without provider evidence never generates payment success',async()=>{
   await reset();const o=await make()
   await db.query("update public.customer_orders set payment_status='paid',amount_paid=total_amount,paid_at=clock_timestamp() where id=$1",[o.id])
   assert.ok((await events(o)).every(e=>e.event_type!=='payment_verified'))
   assert.equal((await db.query('select private.order_email_paid(o) ok from public.customer_orders o where id=$1',[o.id])).rows[0].ok,false)
  })
  await t.test('pending and provider-unverified attempts never generate payment success',async()=>{
   await reset();const o=await make()
   await db.query("insert into public.payment_attempts(order_id,mode,integration_id,amount_minor,currency,status,provider_order_id) values($1,'live',12345,20035,'EGP','pending',$2)",[o.id,'UNVERIFIED-'+randomUUID()])
   assert.ok((await events(o)).every(e=>e.event_type!=='payment_verified'))
   assert.equal((await db.query('select private.order_email_paid(o) ok from public.customer_orders o where id=$1',[o.id])).rows[0].ok,false)
  })
  await t.test('cancelled pending order is suppressed before queue materialization',async()=>{
   await reset();const o=await make();await db.query("update public.customer_orders set status='cancelled' where id=$1",[o.id])
   await processOrderEmailNotifications(f.client);const[e]=await events(o)
   assert.equal(e.state,'suppressed');assert.equal(e.email_message_id,null)
  })
  await t.test('cancelled verified-paid order is denied at the final dispatch gate',async()=>{
   await reset();const o=await make();await settle(o);await processOrderEmailNotifications(f.client,{limit:3})
   const paid=(await events(o)).find(e=>e.event_type==='payment_verified');await f.unthrottle()
   const m=await emailRpc(f.client,'claim');assert.equal(m.id,paid.email_message_id)
   await db.query("update public.customer_orders set status='cancelled' where id=$1",[o.id])
   const decision=await emailRpc(f.client,'dispatch',{id:m.id,work_token:m.work_token})
   assert.equal(decision.allowed,false);assert.equal((await f.message(m.id)).state,'suppressed')
  })
  await t.test('recipient change after capture is suppressed at the final dispatch gate',async()=>{
   await reset();const o=await make();await processOrderEmailNotifications(f.client);await f.unthrottle()
   const m=await emailRpc(f.client,'claim');await db.query('update public.customer_orders set email=$2 where id=$1',[o.id,'different@fixture.example.invalid'])
   assert.equal((await emailRpc(f.client,'dispatch',{id:m.id,work_token:m.work_token})).allowed,false)
  })
  await t.test('disabled-period orders create no backlog when activation changes',async()=>{
   await reset();await configure(false);const o=await make();await configure(true)
   assert.deepEqual(await events(o),[]);assert.deepEqual(await processOrderEmailNotifications(f.client),{processed:[]})
  })
  await t.test('expired event context fails the final eligibility helper',async()=>{
   await reset();const o=await make()
   const reason=(await db.query("select private.order_email_reason(jsonb_populate_record(null::public.order_email_events,to_jsonb(e)||jsonb_build_object('expires_at',clock_timestamp()-interval '1 second'))) reason from public.order_email_events e where order_id=$1",[o.id])).rows[0].reason
   assert.equal(reason,'expired')
  })
  await t.test('EN/AR templates escape injected markup and include no account bearer links',async()=>{
   for(const locale of ['en','ar'])for(const method of ['card','cash']){
    const row={id:randomUUID(),copy_version:1,event_type:'order_received',locale,recipient:ownerAddress,payload:{id:randomUUID(),order_number:'<script>canary</script>',payment_method:method,total_amount:'200.35',currency:'EGP'}}
    const draft=prepareOrderEmail(row),html=emailLayout({...draft,brand:'<fixture store>'})
    assert.doesNotMatch(html,/<script>|<a\b|href=|src=/i);assert.match(html,/&lt;script&gt;/)
   }
  })
  await t.test('marketing and provider-webhook controls remain off throughout automatic order processing',async()=>{
   const s=await f.settings();assert.equal(s.config.marketing_enabled,false);assert.equal(s.config.webhook_enabled,false)
   assert.equal((await db.query("select count(*)::int n from public.email_messages where classification='marketing'")).rows[0].n,0)
  })
  // These assertions are deliberately the launch requirements, not assertions
  // that bless current behavior. A failure is preserved as a qualification gap.
  await t.test('LAUNCH REQUIREMENT: alternate recipient not owned by the customer must not queue',async()=>{
   await reset();const foreign='unowned-other-person@fixture.example.invalid',o=await make({email:foreign})
   await processOrderEmailNotifications(f.client);const[e]=await events(o)
   const n=(await db.query("select count(*)::int n from public.email_messages where recipient=$1 and state='queued'",[foreign])).rows[0].n
   assert.equal(n,0,'Schema104 queues to arbitrary checkout email without customer mailbox ownership proof')
   assert.ok(!e||e.state==='suppressed')
  })
  await t.test('LAUNCH REQUIREMENT: unconfirmed customer mailbox must not queue automatic order details',async()=>{
   await reset();const o=await make()
   await db.query('update auth.users set email_confirmed_at=null where id=$1',[f.actors.customer])
   await processOrderEmailNotifications(f.client);const[e]=await events(o)
   assert.ok(!e||e.state==='suppressed','Schema104 does not verify the recipient mailbox confirmation at capture/enqueue')
  })
  const mutations=[
   ['mailbox changed',"update auth.users set email='new-owner-mailbox@fixture.example.invalid' where id=$1"],
   ['confirmation revoked','update auth.users set email_confirmed_at=null where id=$1'],
   ['customer disabled','update public.customer_profiles set is_active=false where id=$1'],
   ['account anonymous','update auth.users set is_anonymous=true where id=$1'],
   ['mailbox removed','update auth.users set email=null where id=$1']
  ]
  for(const [name,sql]of mutations){
   for(const stage of ['capture','dispatch'])await t.test(name+' at '+stage+' withholds without changing the order',async()=>{
    await reset();await db.query('update public.customer_profiles set is_active=true where id=$1',[f.actors.customer])
    await db.query('update auth.users set is_anonymous=false where id=$1',[f.actors.customer])
    let o,m
    if(stage==='dispatch'){
     o=await make();await processOrderEmailNotifications(f.client);await f.unthrottle();m=await emailRpc(f.client,'claim')
     assert.equal(m.id,(await events(o))[0].email_message_id)
    }
    await db.query(sql,[f.actors.customer])
    if(stage==='capture'){
     o=await make();assert.deepEqual(await events(o),[])
    }else{
     assert.equal((await emailRpc(f.client,'dispatch',{id:m.id,work_token:m.work_token})).allowed,false)
     assert.equal((await f.message(m.id)).state,'suppressed')
     assert.equal((await f.message(m.id)).dispatched_at,null)
    }
    const stored=(await db.query('select payment_status,amount_paid,status from public.customer_orders where id=$1',[o.id])).rows[0]
    assert.equal(stored.payment_status,'pending');assert.equal(Number(stored.amount_paid),0);assert.equal(stored.status,'pending_payment')
   })
  }
  await t.test('order reassigned to another owner is withheld at dispatch',async()=>{
   await reset();await db.query('update public.customer_profiles set is_active=true where id=$1',[f.actors.customer]);await db.query('update auth.users set is_anonymous=false where id=$1',[f.actors.customer])
   const o=await make();await processOrderEmailNotifications(f.client);await f.unthrottle();const m=await emailRpc(f.client,'claim')
   await db.query('update public.customer_orders set user_id=$2 where id=$1',[o.id,f.actors.viewer])
   assert.equal((await emailRpc(f.client,'dispatch',{id:m.id,work_token:m.work_token})).allowed,false)
  })
  await t.test('ownership restored after suppression never replays the old event',async()=>{
   await reset();const o=await make();await db.query('update auth.users set email_confirmed_at=null where id=$1',[f.actors.customer])
   await processOrderEmailNotifications(f.client);assert.equal((await events(o))[0].state,'suppressed')
   await db.query('update auth.users set email_confirmed_at=clock_timestamp() where id=$1',[f.actors.customer])
   await db.query('update public.customer_orders set payment_status=payment_status where id=$1',[o.id])
   assert.deepEqual(await processOrderEmailNotifications(f.client),{processed:[]});assert.equal((await events(o)).length,1)
  })
  await t.test('private ownership helper and ledgers are not browser or service write APIs',async()=>{
   for(const role of ['anon','authenticated','service_role']){
    assert.equal((await db.query("select has_function_privilege($1,'private.order_email_recipient_owned(public.customer_orders)','execute') ok",[role])).rows[0].ok,false)
   }
  })
  await t.test('concurrent final checks observe a committed identity change after provider-lock wait',async()=>{
   await reset();const o=await make();await processOrderEmailNotifications(f.client);await f.unthrottle();const m=await emailRpc(f.client,'claim')
   const blocker=await db.connect(),worker=await db.connect('service_role'),account=await db.connect()
   try{
    await blocker.query('begin');await blocker.query("select id from public.email_provider_settings where id='brevo' for update")
    const pending=emailRpc(smsDatabaseClient(worker),'dispatch',{id:m.id,work_token:m.work_token})
    await nativeWaitFor(async()=>Number((await db.query("select count(*) n from pg_stat_activity where pid=$1 and wait_event_type='Lock'",[worker.processID])).rows[0].n)===1)
    await account.query('update auth.users set email_confirmed_at=null where id=$1',[f.actors.customer])
    await blocker.query('commit');assert.equal((await pending).allowed,false)
    assert.equal((await f.message(m.id)).state,'suppressed');assert.equal((await f.message(m.id)).dispatched_at,null)
   }finally{await blocker.query('rollback');await Promise.all([blocker.end(),worker.end(),account.end()])}
  })
 }finally{await db.close()}
})
