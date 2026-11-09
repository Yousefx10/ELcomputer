import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {paymentFirstFixture} from './helpers/paymentFirstFixture.mjs'
import {emailNativeAvailable} from './helpers/emailNativeDatabase.mjs'

test('CARD preorder full/deposit settlement preserves payment-first and allocation safety',{skip:!emailNativeAvailable,timeout:180000},async t=>{
 const f=await paymentFirstFixture();let serial=700000,depositOrder,depositSession
 const prepare=async({product,variant,actor,accepted=true,quantity=1}={})=>{
  actor ||=await f.user();const cart=randomUUID(),revision=randomUUID(),line=randomUUID()
  const order={first_name:'Preorder',last_name:'Fixture',email:actor.email,phone:'01012345678',street_address:'Fixture street',city:f.city,governorate:'Cairo',shipping_method:'shipping',shipping_company_id:f.company,payment_method:'card',locale:'en',preorder_accepted:accepted}
  const items=[{product_id:product,variant_id:variant,quantity}],lines=[{cart_key:product+':'+variant,cart_line_id:line,quantity}]
  const review=await f.rpc('commerce_checkout_quote',[actor.id,cart,order,items])
  const result=await f.rpc('commerce_prepare_payment_checkout',[actor.id,cart,review.quoteId,order,items,revision,lines])
  return {actor,cart,revision,order,items,lines,review,session:result.checkout}
 }
 const product=async(mode='deposit',limit=20)=>{
  const id=(await f.db.query("insert into public.products(title,slug,price,is_serialized,is_published,primary_warehouse_id,selling_mode,preorder_payment_mode,preorder_deposit_percent,preorder_total_limit,preorder_customer_limit) values('Future option',$1,100.35,true,true,$2,'preorder',$3,25,$4,3) returning id",['pre-'+randomUUID(),f.warehouse,mode,limit])).rows[0].id
  return {product:id,variant:(await f.db.query('select id from public.product_variants where product_id=$1',[id])).rows[0].id}
 }
 const initialize=async s=>{const a=await f.claim(s),provider=String(++serial);await f.store(a,provider);const opened=await f.rpc('commerce_checkout_payment_interface',[s.actor.id,s.session.id,'open',null,'live',123]);return {a,provider,opened}}
 try {
  await t.test('installation leaves preorder CARD OFF and preserves normal CARD/COD',async()=>{
   const p=await product();await assert.rejects(prepare(p));assert.equal((await f.rpc('commerce_payment_checkout_readiness')).preorders.enabled,false)
   const normal=await f.prepare();assert.equal(normal.session.orderId,null)
  })
  await f.db.query('update public.site_settings set payment_preorder_card_enabled=true,inventory_tracking_required=true')
  await t.test('explicit consent is required before freezing a payable preorder',async()=>{
   await assert.rejects(prepare({...await product(),accepted:false}),/checkout:quote/)
  })
  for(const mode of ['full','deposit'])await t.test(mode+' charges only requiredNow and creates exactly one held preorder after verified success',async()=>{
   const p=await product(mode),s=await prepare(p),before=await f.counts(),a=await initialize(s)
   assert.equal(Number(a.a.attempt.amount_minor),mode==='full'?15035:7509)
   assert.equal(Number(s.review.totalAmount),150.35);assert.equal(Number(s.review.requiredNow),mode==='full'?150.35:75.09)
   if(mode==='deposit')await f.rpc('commerce_customer_cart',[s.actor.id,randomUUID(),0,{action:'replace',cart_id:s.cart,items:[{id:p.product,variant_id:p.variant,quantity:2,cart_line_id:s.lines[0].cart_line_id}]}])
   assert.equal((await f.counts()).orders,before.orders)
   await f.rpc('commerce_checkout_payment_interface',[s.actor.id,s.session.id,'submit',a.opened.token,'live',123])
   await f.callback(a.a,{provider:a.provider,id:String(++serial)})
   let status=await f.rpc('commerce_read_payment_checkout',[s.actor.id,s.session.id])
   status=await f.rpc('commerce_read_payment_checkout',[s.actor.id,s.session.id]);assert.ok(status.orderId)
   const o=(await f.db.query('select * from public.customer_orders where id=$1',[status.orderId])).rows[0]
   assert.equal(o.is_preorder,true);assert.equal(o.total_amount,'150.35');assert.equal(o.amount_paid,mode==='full'?'150.35':'75.09')
   if(mode==='deposit'){depositOrder=o;depositSession=s}
   assert.equal(o.initial_amount_due,mode==='full'?'150.35':'75.09');assert.equal(o.payment_status,mode==='full'?'paid':'partially_paid');assert.equal(o.status,'on_hold');assert.equal(o.preorder_fulfillment_state,'awaiting_stock')
   assert.equal(status.paymentStatus,'paid');assert.equal(Number(status.paymentAmount),Number(o.initial_amount_due));assert.equal(Number(status.remainingAmount),mode==='full'?0:75.26)
   const line=(await f.db.query('select * from public.customer_order_items where order_id=$1',[o.id])).rows[0];assert.equal(line.is_preorder,true);assert.equal(line.preorder_payment_mode,mode);assert.equal(line.initial_amount_due,mode==='full'?'100.35':'25.09')
   assert.equal((await f.counts()).stock,before.stock);assert.equal((await f.counts()).shipping,before.shipping)
   await f.rpc('commerce_read_payment_checkout',[s.actor.id,s.session.id]);assert.equal((await f.counts()).orders,before.orders+1)
   if(mode==='deposit'){const cart=(await f.rpc('commerce_customer_cart',[s.actor.id])).cart;assert.equal(cart.items[0].quantity,1);assert.equal(cart.items[0].cart_line_id,s.lines[0].cart_line_id)}
  })
  await t.test('deposit balance remains unpaid until explicit verified staff evidence',async()=>{
   await assert.rejects(f.rpc('commerce_release_preorder',[depositOrder.id,f.actors.owner]),/paid|payment|outstanding/i)
   await assert.rejects(f.rpc('commerce_record_preorder_payment',[depositOrder.id,f.actors.owner,75.26,'MISSING-METHOD']),/verified balance/)
   await assert.rejects(f.rpc('commerce_record_preorder_payment',[depositOrder.id,f.actors.owner,75.26,'BALANCE-FIXTURE','card']),/verified balance/)
   const paid=await f.rpc('commerce_record_preorder_payment',[depositOrder.id,f.actors.owner,75.26,'BALANCE-FIXTURE','bank_transfer'])
   assert.equal(paid.payment_status,'paid');assert.equal(paid.amount_paid,150.35);assert.equal(paid.payment_method,'card')
   await assert.rejects(f.rpc('commerce_record_preorder_payment',[depositOrder.id,f.actors.owner,75.26,'BALANCE-FIXTURE','bank_transfer']))
   const status=await f.rpc('commerce_read_payment_checkout',[depositSession.actor.id,depositSession.session.id]);assert.equal(status.remainingAmount,0);assert.equal(status.paymentStatus,'paid')
  })
  await t.test('paid preorder release requires actual serialized stock and keeps courier booking separate',async()=>{
   await assert.rejects(f.rpc('commerce_release_preorder',[depositOrder.id,f.actors.owner]),/stock|units|inventory/i)
   const line=(await f.db.query('select product_id,variant_id from public.customer_order_items where order_id=$1',[depositOrder.id])).rows[0]
   await f.db.query("select set_config('app.serialized_inventory_write','on',false)")
   await f.db.query('update public.products set stock_quantity=1 where id=$1',[line.product_id]);await f.db.query('update public.product_variants set stock_quantity=1 where id=$1',[line.variant_id])
   await f.db.query('insert into public.commerce_warehouse_inventory(warehouse_id,product_id,quantity) values($1,$2,1)',[f.warehouse,line.product_id])
   await f.db.query("insert into public.commerce_serialized_units(unit_code,product_id,variant_id,warehouse_id) values('PREORDER-ARRIVAL-FIXTURE',$1,$2,$3)",[line.product_id,line.variant_id,f.warehouse])
   await f.db.query("select set_config('app.serialized_inventory_write','off',false)")
   const released=await f.rpc('commerce_release_preorder',[depositOrder.id,f.actors.owner]);assert.equal(released.preorder_fulfillment_state,'ready');assert.equal(released.status,'processing')
   assert.equal((await f.db.query("select status from public.commerce_serialized_units where unit_code='PREORDER-ARRIVAL-FIXTURE'")).rows[0].status,'sold')
   assert.equal((await f.db.query('select count(*)::int n from public.shipping_order_jobs where order_id=$1',[depositOrder.id])).rows[0].n,0)
  })
  await t.test('changed deposit terms cannot pass an existing unsubmitted form',async()=>{
   const p=await product(),s=await prepare(p),a=await initialize(s)
   await f.db.query('update public.products set preorder_deposit_percent=30 where id=$1',[p.product])
   await assert.rejects(f.rpc('commerce_checkout_payment_interface',[s.actor.id,s.session.id,'submit',a.opened.token,'live',123]),/checkout:restart/)
   const state=(await f.db.query('select interface_state,submission_started_at from private.payment_checkout_attempts where id=$1',[a.a.attempt.id])).rows[0];assert.equal(state.interface_state,'initialized');assert.equal(state.submission_started_at,null)
  })
  await t.test('disabling new preorders preserves a late verified success and its quote',async()=>{
   const p=await product(),s=await prepare(p),a=await initialize(s)
   await f.rpc('commerce_checkout_payment_interface',[s.actor.id,s.session.id,'submit',a.opened.token,'live',123])
   await f.db.query('update public.site_settings set payment_preorder_card_enabled=false')
   await f.callback(a.a,{provider:a.provider,id:String(++serial)})
   const status=await f.rpc('commerce_read_payment_checkout',[s.actor.id,s.session.id]);assert.ok(status.orderId);assert.equal(status.paymentStatus,'paid');assert.equal(Number(status.paymentAmount),75.09)
   await f.db.query('update public.site_settings set payment_preorder_card_enabled=true')
  })
  await t.test('submission holds allocation across customers and never creates stock',async()=>{
   const p=await product('full',1),first=await prepare(p),second=await prepare(p),a=await initialize(first),b=await initialize(second)
   await f.rpc('commerce_checkout_payment_interface',[first.actor.id,first.session.id,'submit',a.opened.token,'live',123])
   await assert.rejects(f.rpc('commerce_checkout_payment_interface',[second.actor.id,second.session.id,'submit',b.opened.token,'live',123]),/preorder:sold_out/)
   assert.equal((await f.rpc('commerce_read_payment_checkout',[second.actor.id,second.session.id])).canRestart,true)
  })
  await t.test('a deposit rounded to zero cannot initialize a provider charge',async()=>{
   const p=await product();await f.db.query('update public.products set price=0.01,preorder_deposit_percent=0.01 where id=$1',[p.product])
   await f.db.query('update public.commerce_shipping_companies set client_shipping_price=0 where id=$1',[f.company])
   await assert.rejects(prepare(p),/preorder:payment_amount/)
  })
 } finally {await f.close()}
})

test('preorder installation preserves financial rows, rolls back, and denies browser RPC access',{skip:!emailNativeAvailable,timeout:180000},async()=>{
 const f=await paymentFirstFixture({stopBefore:'20261109100000'})
 const snapshot=async()=>{const all={};for(const table of ['private.payment_checkout_sessions','private.payment_checkout_attempts','private.payment_checkout_funds','private.payment_callback_inbox','public.customer_orders','public.customer_order_items','public.payment_attempts','public.payment_transactions'])all[table]=(await f.db.query('select to_jsonb(t) v from '+table+' t order by to_jsonb(t)::text')).rows;return all}
 const schema=async()=>(await f.db.query("select n.nspname,p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('private','public') and p.prokind='f' order by 1,2")).rows
 try{
  for(let i=0;i<4;i++){const s=await f.prepare(),a=await f.claim(s);await f.store(a,String(990001+i));if(i===3)await f.callback(a,{provider:String(990001+i),id:'999004'})}
  const before=await snapshot(),ddl=await schema(),sql=await readFile('supabase/migrations/20261109100000_preorder_card_and_balance.sql','utf8')
  await f.db.query('begin');await f.db.query(sql.replace(/^begin;$/m,'').replace(/^commit;$/m,''));assert.deepEqual(await snapshot(),before);await f.db.query('rollback')
  assert.deepEqual(await schema(),ddl);assert.deepEqual(await snapshot(),before)
  await f.db.query(sql);assert.deepEqual(await snapshot(),before);assert.equal((await f.rpc('commerce_payment_checkout_readiness')).preorders.enabled,false)
  for(const role of ['anon','authenticated']){const c=await f.db.connect(role);await assert.rejects(f.rpc('commerce_payment_checkout_readiness',[],c),/permission denied/);await assert.rejects(f.rpc('commerce_record_preorder_payment',[randomUUID(),f.actors.owner,1,'FORGED','bank_transfer'],c),/permission denied/)}
  for(const signature of ['private.validate_preorder_capacity(jsonb,uuid)','private.finalize_preorder_payment_checkout(uuid)','private.preorder_payment_verified(uuid,uuid)'])assert.equal((await f.db.query("select has_function_privilege('service_role',$1,'execute') allowed",[signature])).rows[0].allowed,false)
 }finally{await f.close()}
})

test('untracked stores take a deposit, collect the balance by card and release without stock',{skip:!emailNativeAvailable,timeout:180000},async t=>{
 const f=await paymentFirstFixture();let serial=800000
 await f.db.query("update public.site_settings set payment_preorder_card_enabled=true,allow_out_of_stock_purchases=true where key='default'")
 await f.db.query('alter table public.site_settings disable trigger user');await f.db.query("update public.site_settings set erp_mode='daftra' where key='default'");await f.db.query('alter table public.site_settings enable trigger user')
 await f.db.query('delete from public.erp_inventory_cache')
 const paidDeposit=async()=>{
  const actor=await f.user()
  const id=(await f.db.query("insert into public.products(title,slug,price,is_serialized,is_published,primary_warehouse_id,selling_mode,preorder_payment_mode,preorder_deposit_percent,preorder_total_limit,preorder_customer_limit) values('Future option',$1,100.35,true,true,$2,'preorder','deposit',25,20,3) returning id",['pre-'+randomUUID(),f.warehouse])).rows[0].id
  const variant=(await f.db.query('select id from public.product_variants where product_id=$1',[id])).rows[0].id
  const cart=randomUUID(),revision=randomUUID(),line=randomUUID()
  const order={first_name:'Preorder',last_name:'Fixture',email:actor.email,phone:'01012345678',street_address:'Fixture street',city:f.city,governorate:'Cairo',shipping_method:'shipping',shipping_company_id:f.company,payment_method:'card',locale:'en',preorder_accepted:true}
  const items=[{product_id:id,variant_id:variant,quantity:1}],lines=[{cart_key:id+':'+variant,cart_line_id:line,quantity:1}]
  const review=await f.rpc('commerce_checkout_quote',[actor.id,cart,order,items])
  const session=(await f.rpc('commerce_prepare_payment_checkout',[actor.id,cart,review.quoteId,order,items,revision,lines])).checkout
  const s={actor,session},a=await pay(s)
  await f.callback(a.a,{provider:a.provider,id:String(++serial)})
  const status=await f.rpc('commerce_read_payment_checkout',[actor.id,session.id])
  return {actor,order:await row(status.orderId)}
 }
 const row=async id=>(await f.db.query('select * from public.customer_orders where id=$1',[id])).rows[0]
 const open=async s=>{const a=await f.claim(s),provider=String(++serial);await f.store(a,provider);const opened=await f.rpc('commerce_checkout_payment_interface',[s.actor.id,s.session.id,'open',null,'live',123]);return {a,provider,opened}}
 const pay=async s=>{const a=await open(s);await f.rpc('commerce_checkout_payment_interface',[s.actor.id,s.session.id,'submit',a.opened.token,'live',123]);return a}
 const balance=(actor,order)=>f.rpc('commerce_prepare_preorder_balance',[actor.id,order.id])
 const payments=async id=>(await f.db.query('select * from public.preorder_payments where order_id=$1',[id])).rows
 try {
  let held
  await t.test('a deposit holds the order without touching stock',async()=>{
   const before=await f.counts();held=await paidDeposit();const o=held.order
   assert.equal(o.stock_fulfillment_state,'untracked');assert.equal(o.status,'on_hold');assert.equal(o.preorder_fulfillment_state,'awaiting_stock')
   assert.equal(o.payment_status,'partially_paid');assert.equal(o.amount_paid,'75.09');assert.equal((await f.counts()).stock,before.stock)
  })
  await t.test('the balance stays with staff until the store turns it on',async()=>{
   await assert.rejects(balance(held.actor,held.order),/preorder:balance_unavailable/)
   await f.db.query("update public.site_settings set payment_preorder_balance_mode='online'")
   assert.equal((await f.rpc('commerce_payment_checkout_readiness')).preorders.balanceOnline,true)
  })
  await t.test('only the owner can start a balance payment',async()=>{
   await assert.rejects(balance(await f.user(),held.order),/preorder:balance_unavailable/)
  })
  await t.test('the balance charges what is left and settles once',async()=>{
   const before=await f.counts(),first=await balance(held.actor,held.order),again=await balance(held.actor,held.order)
   assert.equal(first.created,true);assert.equal(again.created,false);assert.equal(again.checkout.id,first.checkout.id)
   assert.equal(first.checkout.isPreorderBalance,true);assert.equal(first.checkout.orderId,held.order.id);assert.equal(Number(first.checkout.paymentAmount),75.26)
   const s={actor:held.actor,session:first.checkout},a=await pay(s);assert.equal(Number(a.a.attempt.amount_minor),7526)
   assert.equal((await f.counts()).attempts,before.attempts);assert.equal((await row(held.order.id)).amount_paid,'75.09')
   const id=String(++serial);await f.callback(a.a,{provider:a.provider,id})
   const o=await row(held.order.id);assert.equal(o.payment_status,'paid');assert.equal(o.amount_paid,'150.35');assert.ok(o.paid_at);assert.equal(o.status,'on_hold')
   const rows=await payments(o.id);assert.equal(rows.length,1);assert.equal(rows[0].method,'card');assert.equal(rows[0].amount,'75.26');assert.equal(rows[0].verified_by,null);assert.equal(rows[0].checkout_session_id,first.checkout.id)
   const status=await f.rpc('commerce_read_payment_checkout',[held.actor.id,first.checkout.id]);assert.equal(status.state,'paid');assert.equal(status.paymentStatus,'paid');assert.equal(status.orderId,o.id);assert.equal(Number(status.remainingAmount),0)
   await f.callback(a.a,{provider:a.provider,id});assert.equal((await payments(o.id)).length,1);assert.equal((await row(o.id)).amount_paid,'150.35')
   assert.equal((await f.counts()).orders,before.orders);await assert.rejects(balance(held.actor,o),/preorder:balance_unavailable/)
   assert.equal((await f.db.query('select private.preorder_fully_paid(o) v from public.customer_orders o where id=$1',[o.id])).rows[0].v,true)
  })
  await t.test('release moves a fully paid order on without stock',async()=>{
   const before=await f.counts(),released=await f.rpc('commerce_release_preorder',[held.order.id,f.actors.owner])
   assert.equal(released.preorder_fulfillment_state,'ready');assert.equal(released.status,'processing');assert.equal(released.stock_fulfillment_state,'untracked');assert.equal((await f.counts()).stock,before.stock)
   const key='daftra:order:'+held.order.id+':status:'
   assert.equal((await f.db.query("select count(*)::int n from public.erp_sync_jobs where dedupe_key=$1",[key+'on_hold'])).rows[0].n,0)
   assert.equal((await f.db.query("select count(*)::int n from public.erp_sync_jobs where dedupe_key=$1",[key+'processing'])).rows[0].n,1)
   const monitor=await f.rpc('commerce_payment_checkout_monitor');assert.equal(Number(monitor.verified_order_pending),0);assert.equal(Number(monitor.overdue_unverified),0)
  })
  await t.test('an order with money still owed cannot be released',async()=>{
   const next=await paidDeposit();await assert.rejects(f.rpc('commerce_release_preorder',[next.order.id,f.actors.owner]),/paid|payment|outstanding/i)
   assert.equal((await f.db.query('select private.preorder_fully_paid(o) v from public.customer_orders o where id=$1',[next.order.id])).rows[0].v,false)
  })
  await t.test('money that cannot apply goes to review and is never counted twice',async()=>{
   const next=await paidDeposit(),started=await balance(next.actor,next.order),a=await pay({actor:next.actor,session:started.checkout})
   await f.rpc('commerce_record_preorder_payment',[next.order.id,f.actors.owner,75.26,'STAFF-FIXTURE','bank_transfer'])
   await f.callback(a.a,{provider:a.provider,id:String(++serial)})
   const session=(await f.db.query('select state,review_reason from private.payment_checkout_sessions where id=$1',[started.checkout.id])).rows[0];assert.equal(session.state,'review');assert.equal(session.review_reason,'preorder_balance_conflict')
   const o=await row(next.order.id);assert.equal(o.amount_paid,'150.35');assert.equal((await payments(o.id)).length,1)
  })
  await t.test('a wrong amount never settles the balance',async()=>{
   const next=await paidDeposit(),started=await balance(next.actor,next.order),a=await pay({actor:next.actor,session:started.checkout})
   await f.callback(a.a,{provider:a.provider,id:String(++serial),amount:100})
   const o=await row(next.order.id);assert.equal(o.payment_status,'partially_paid');assert.equal(o.amount_paid,'75.09');assert.equal((await payments(o.id)).length,0)
  })
  await t.test('an abandoned balance session is replaced',async()=>{
   const next=await paidDeposit(),first=await balance(next.actor,next.order)
   await open({actor:next.actor,session:first.checkout})
   await f.db.query('alter table private.payment_checkout_sessions disable trigger user');await f.db.query("update private.payment_checkout_sessions set expires_at=clock_timestamp()-interval '1 minute' where id=$1",[first.checkout.id]);await f.db.query('alter table private.payment_checkout_sessions enable trigger user')
   const second=await balance(next.actor,next.order);assert.equal(second.created,true);assert.notEqual(second.checkout.id,first.checkout.id)
   assert.equal((await f.db.query('select state from private.payment_checkout_sessions where id=$1',[first.checkout.id])).rows[0].state,'retired')
  })
  await t.test('a paid session stays out of browser roles',async()=>{
   for(const role of ['anon','authenticated']){const c=await f.db.connect(role);await assert.rejects(f.rpc('commerce_prepare_preorder_balance',[randomUUID(),randomUUID()],c),/permission denied/);await c.end?.()}
  })
 } finally {await f.close()}
})
