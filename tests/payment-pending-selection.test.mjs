import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {readPendingCheckout,readPendingCheckoutForCart,savePendingCheckout,removePendingCheckout} from '../app/utils/checkoutRecovery.js'
const store=()=>{const values=new Map();return {values,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)}}
const command=(userId=randomUUID())=>({version:1,userId,body:{cart_id:randomUUID(),quote_id:randomUUID(),payment_method:'card'},cart:{revision:randomUUID()},review:{lines:[]}})
const cart=c=>({id:c.body.cart_id,revision:c.cart.revision})
test('a legacy unacknowledged request stays retained without selecting it for an independent basket',()=>{
 const s=store(),old=command();s.setItem('elcomputer-checkout-pending-'+old.userId,JSON.stringify(old))
 assert.equal(readPendingCheckoutForCart(s,old.userId,cart(command(old.userId))),null)
 assert.deepEqual(readPendingCheckout(s,old.userId),old)
 assert.deepEqual(readPendingCheckoutForCart(s,old.userId,cart(old)),old)
})
test('two tabs recover their own exact cart revisions after the account pointer moves',()=>{
 const s=store(),one=command(),two=command(one.userId);savePendingCheckout(s,one);savePendingCheckout(s,two)
 assert.deepEqual(readPendingCheckoutForCart(s,one.userId,cart(one)),one)
 assert.deepEqual(readPendingCheckoutForCart(s,one.userId,cart(two)),two)
 removePendingCheckout(s,one)
 assert.deepEqual(readPendingCheckout(s,one.userId),two)
 assert.deepEqual(readPendingCheckoutForCart(s,one.userId,cart(two)),two)
})
test('editing the same cart never replays its older frozen command',()=>{
 const s=store(),old=command(),next=structuredClone(old);next.cart.revision=randomUUID();next.body.quote_id=randomUUID()
 savePendingCheckout(s,old);assert.equal(readPendingCheckoutForCart(s,old.userId,cart(next)),null);savePendingCheckout(s,next)
 assert.deepEqual(readPendingCheckoutForCart(s,old.userId,cart(old)),old)
 assert.deepEqual(readPendingCheckoutForCart(s,old.userId,cart(next)),next)
})
test('account changes and old acknowledgements cannot consume another command',()=>{
 const s=store(),one=command(),two=command();savePendingCheckout(s,one);savePendingCheckout(s,two)
 assert.equal(readPendingCheckoutForCart(s,two.userId,cart(one)),null)
 const next=structuredClone(one);next.body.quote_id=randomUUID();savePendingCheckout(s,next);removePendingCheckout(s,one)
 assert.deepEqual(readPendingCheckoutForCart(s,one.userId,cart(next)),next)
 assert.deepEqual(readPendingCheckoutForCart(s,two.userId,cart(two)),two)
})
test('storage exhaustion stops request retention before the caller can submit',()=>{
 const s=store(),old=command();savePendingCheckout(s,old);s.setItem=()=>{throw Error('quota')}
 assert.throws(()=>savePendingCheckout(s,command(old.userId)),/quota/)
 assert.deepEqual(readPendingCheckout(s,old.userId),old)
})
