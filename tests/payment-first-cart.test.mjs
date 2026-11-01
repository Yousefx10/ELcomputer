import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {acknowledgePurchasedCart,restoreCart} from '../app/utils/checkoutRecovery.js'
const store=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)}}
test('paid line markers preserve additions, options and removed/re-added lines',()=>{
 const storage=store(),id=randomUUID(),revision=randomUUID(),owner='account:'+randomUUID(),a={cart_key:'product:a',cart_line_id:randomUUID(),quantity:2},b={cart_key:'product:b',cart_line_id:randomUUID(),quantity:1},receipt=randomUUID(),next=randomUUID()
 assert.equal(acknowledgePurchasedCart(storage,{id,revision,items:[a]},next,receipt,owner),true)
 const restored=restoreCart(storage,{id,revision:'changed',items:[{...a,quantity:5},b],coupon:null},owner)
 assert.deepEqual(restored.items,[{...a,quantity:3},b]);assert.equal(restored.id,next)
 assert.deepEqual(restoreCart(storage,restored,owner),restored)
 assert.deepEqual(restoreCart(storage,{id,revision,items:[{...a,cart_line_id:randomUUID()},b]},owner).items.map(x=>x.quantity),[2,1])
 assert.deepEqual(restoreCart(storage,{id,revision,items:[a],coupon:{code:'OLD'}},owner).items,[])
 assert.equal(restoreCart(storage,{id,revision,items:[a],coupon:{code:'OLD'}},owner).coupon,null)
 assert.deepEqual(restoreCart(storage,{id,revision,items:[a]},'account:another').items,[a])
})
test('duplicate acknowledgements cannot subtract a purchased quantity twice',()=>{
 const storage=store(),owner='account:'+randomUUID(),id=randomUUID(),line={cart_key:'a:b',cart_line_id:randomUUID(),quantity:2},snapshot={id,revision:randomUUID(),items:[line]},receipt=randomUUID()
 acknowledgePurchasedCart(storage,snapshot,randomUUID(),receipt,owner)
 const once=restoreCart(storage,{...snapshot,items:[{...line,quantity:6}],coupon:null},owner)
 acknowledgePurchasedCart(storage,snapshot,randomUUID(),receipt,owner)
 assert.deepEqual(restoreCart(storage,once,owner),once);assert.equal(once.items[0].quantity,4)
})
test('failed, abandoned or unverified checkout does not write any completion marker',()=>{
 const storage=store(),state={id:randomUUID(),revision:randomUUID(),items:[{cart_key:'a',quantity:2}],coupon:null}
 assert.deepEqual(restoreCart(storage,state,'account:fixture'),state)
 assert.equal(acknowledgePurchasedCart(storage,state,randomUUID(),null,'account:fixture'),false)
 assert.deepEqual(restoreCart(storage,state,'account:fixture'),state)
})
