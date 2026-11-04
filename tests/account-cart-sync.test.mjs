import test from 'node:test'
import assert from 'node:assert/strict'
import {createCartSync} from '../app/utils/accountCartSync.js'
const snap = quantity => ({id:'cart',items:[{id:'product',quantity,cart_line_id:'line'}],coupon:null})
const tick = () => new Promise(resolve=>setTimeout(resolve,0))
test('lost acknowledgements retry the exact body without a second command',async()=>{
 const calls=[],statuses=[];let failures=1
 const sync=createCartSync({request:async body=>{calls.push(structuredClone(body));if(failures--)throw Error('lost');return {cart:{version:1}}},current:()=>true,apply:()=>{},status:x=>statuses.push(x),uuid:()=> 'same-command'})
 sync.initialize({version:0});sync.write(snap(1));await tick();assert.equal(statuses.at(-1),'error')
 await sync.retry();assert.deepEqual(calls[1],calls[0]);assert.equal(sync.clean,true)
})
test('a stale-device conflict retains the rejected edit until explicit review',async()=>{
 let shown;const sync=createCartSync({request:async body=>body?{conflict:true,cart:{version:2}}:{cart:{version:2,items:[{quantity:9}]}},current:()=>true,apply:x=>{shown=x},status:()=>{},uuid:()=> 'command'})
 sync.initialize({version:1});sync.write(snap(3));await tick();assert.equal(sync.clean,false);assert.equal(sync.rejected.items[0].quantity,3)
 assert.equal(sync.write(snap(5)),false);await sync.review();assert.equal(shown.items[0].quantity,9);assert.equal(sync.clean,true)
})
test('account invalidation discards late responses without exposing a cart',async()=>{
 let active=true,resolve,applied=0
 const sync=createCartSync({request:()=>new Promise(r=>{resolve=r}),current:()=>active,apply:()=>applied++,status:()=>{},uuid:()=> 'command'})
 sync.initialize({version:0});sync.write(snap(1));active=false;resolve({cart:{version:1}});await tick();assert.equal(applied,1)
})
test('a recovered receipt cannot rebase a queued stale snapshot over another device',async()=>{
 let calls=0,latest
 const sync=createCartSync({request:async()=>{if(++calls===1)throw Error('lost acknowledgement');return {appliedVersion:1,cart:{version:2}}},current:()=>true,apply:()=>{},status:s=>{latest=s},uuid:()=> 'command'})
 sync.initialize({version:0});sync.write(snap(1));sync.write(snap(2));await tick();await sync.retry()
 assert.equal(calls,2);assert.equal(latest,'conflict');assert.equal(sync.rejected.items[0].quantity,2)
})
