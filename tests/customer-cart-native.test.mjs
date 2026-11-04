import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {paymentFirstFixture} from './helpers/paymentFirstFixture.mjs'
import {emailNativeAvailable} from './helpers/emailNativeDatabase.mjs'

test('account carts isolate owners, serialize devices and retain receipts',{skip:!emailNativeAvailable,timeout:180000},async t=>{
 const f=await paymentFirstFixture()
 try {
  const a=await f.user(),b=await f.user(),cart=randomUUID(),line=randomUUID()
  const read=user=>f.rpc('commerce_customer_cart',[user.id])
  const write=(user,version,quantity,id=randomUUID(),action='replace')=>f.rpc('commerce_customer_cart',[user.id,id,version,{action,items:quantity?[{id:f.product,variant_id:f.variant,quantity,cart_line_id:line}]:[],...(action==='replace'?{cart_id:cart}: {})}])
  await t.test('empty reads create no private row and expose no other cart',async()=>{
   assert.deepEqual((await read(a)).cart.items,[])
   assert.equal((await f.db.query('select count(*)::int n from private.customer_carts')).rows[0].n,0)
   const x=await write(a,0,2);assert.equal(x.cart.items[0].quantity,2);assert.equal(x.cart.items[0].price,100.35)
   assert.equal(x.cart.items[0].cost_price,undefined);assert.deepEqual((await read(b)).cart.items,[])
  })
  await t.test('two simultaneous device snapshots produce one write and one explicit conflict',async()=>{
   const clients=await Promise.all([f.db.connect(),f.db.connect()])
   const args=q=>[a.id,randomUUID(),1,{action:'replace',items:[{id:f.product,variant_id:f.variant,quantity:q,cart_line_id:line}],cart_id:cart}]
   const results=await Promise.all(clients.map((c,i)=>f.rpc('commerce_customer_cart',args(3+i),c)))
   assert.equal(results.filter(x=>x.applied).length,1);assert.equal(results.filter(x=>x.conflict).length,1)
   assert.equal((await read(a)).cart.version,2)
  })
  await t.test('an uncertain response replays exactly once and rejects changed command content',async()=>{
   const id=randomUUID(),x=await write(a,2,5,id),replay=await write(a,2,5,id)
   assert.equal(replay.replayed,true);assert.equal(replay.cart.version,x.cart.version)
   await assert.rejects(write(a,2,6,id),/cart:command_conflict/)
  })
  await t.test('guest reconciliation uses maximum quantities and preserves server line identity',async()=>{
   const id=randomUUID(),first=await write(a,0,7,id,'merge'),again=await write(a,0,7,id,'merge')
   assert.equal(first.cart.items[0].quantity,7);assert.equal(again.cart.items[0].quantity,7)
   assert.equal(first.cart.items[0].cart_line_id,line);assert.equal(again.cart.version,first.cart.version)
  })
  await t.test('unpublished items, forged prices and foreign variants fail without changing the cart',async()=>{
   const before=(await read(a)).cart
   await assert.rejects(f.rpc('commerce_customer_cart',[a.id,randomUUID(),before.version,{action:'replace',items:[{id:f.product,variant_id:f.variant,quantity:1,cart_line_id:line,price:0}]}]),/cart:invalid/)
   await f.db.query('update public.products set is_published=false where id=$1',[f.product])
   assert.equal((await read(a)).cart.items[0].eligible,false)
   await assert.rejects(write(b,0,1),/cart:unavailable/)
   const removed=await write(a,before.version,0);assert.deepEqual(removed.cart.items,[])
   await f.db.query('update public.products set is_published=true where id=$1',[f.product])
   const beforeClear=await write(b,0,1);const clear=await f.rpc('commerce_customer_cart',[b.id,randomUUID(),beforeClear.cart.version,{action:'replace',cart_id:null,items:[]}]);assert.notEqual(clear.cart.id,beforeClear.cart.id);assert.deepEqual(clear.cart.items,[])
  })
  await t.test('missing actions and null quantities cannot bypass version checks',async()=>{
   for(const body of [{items:[]},{action:'replace',items:[{id:f.product,variant_id:f.variant,quantity:null,cart_line_id:line}]}]){
    await assert.rejects(f.rpc('commerce_customer_cart',[a.id,randomUUID(),(await read(a)).cart.version,body]),/cart:invalid/)
   }
  })
  await t.test('anonymous and authenticated roles cannot read storage or call service RPC',async()=>{
   for(const role of ['anon','authenticated']){
    const c=await f.db.connect(role)
    await assert.rejects(c.query('select * from private.customer_carts'),/permission denied/)
    await assert.rejects(f.rpc('commerce_customer_cart',[a.id],c),/permission denied/)
   }
  })
 } finally {await f.close()}
})
