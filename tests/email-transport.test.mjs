import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { postBrevoEmail } from '../server/utils/email/brevo.js'
const fakeNetwork=(respond=(_req,res)=>{res.statusCode=201;res.headers={};res.emit('data',Buffer.from('{"messageId":"mock@relay.example.invalid"}'));res.emit('end')})=>{
 const calls=[]
 return {calls,lookup:async()=>[{address:'8.8.8.8',family:4}],request:(url,options,listener)=>{
  const request=new EventEmitter();request.destroy=error=>{request.destroyed=true;request.emit('error',error)};request.end=bytes=>{calls.push({url:url.href,options,bytes:bytes.toString()});queueMicrotask(()=>{const response=new EventEmitter();listener(response);respond(request,response)})};return request
 }}
}
test('Brevo transport pins checked DNS, uses TLS and exact endpoint with bounded JSON and no redirects',async()=>{
 const n=fakeNetwork();let dispatched=0
 const result=await postBrevoEmail({subject:'Fixture'},'fixture-key',100,async()=>{dispatched++},n)
 assert.equal(result.status,201);assert.equal(dispatched,1);assert.equal(n.calls.length,1)
 const call=n.calls[0];assert.equal(call.url,'https://api.brevo.com/v3/smtp/email');assert.equal(call.options.minVersion,'TLSv1.2');assert.equal(call.options.agent,false);assert.equal(call.options.maxHeaderSize,16384);assert.equal(call.options.headers['api-key'],'fixture-key')
 await new Promise(done=>call.options.lookup('api.brevo.com',{},(err,address,family)=>{assert.equal(err,null);assert.equal(address,'8.8.8.8');assert.equal(family,4);done()}))
 const redirect=fakeNetwork((_req,res)=>{res.statusCode=302;res.headers={location:'http://localhost/private'};res.emit('end')})
 assert.equal((await postBrevoEmail({},'fixture-key',100,async()=>{},redirect)).status,302);assert.equal(redirect.calls.length,1)
})
test('Brevo DNS/payload preflight and final authorization prevent POST; post-dispatch limits stay ambiguous',async()=>{
 const n=fakeNetwork();let dispatch=0
 await assert.rejects(()=>postBrevoEmail({},'fixture-key',100,async()=>{dispatch++},{...n,lookup:async()=>[{address:'127.0.0.1',family:4}]}),e=>e.preflight===true)
 await assert.rejects(()=>postBrevoEmail({body:'x'.repeat(196608)},'fixture-key',100,async()=>{dispatch++},n),e=>e.preflight===true)
 await assert.rejects(()=>postBrevoEmail({},'fixture-key',10,async()=>{dispatch++},{...n,lookup:()=>new Promise(()=>{})}),e=>e.preflight===true)
 assert.equal(dispatch,0);assert.equal(n.calls.length,0)
 await assert.rejects(()=>postBrevoEmail({},'fixture-key',100,async()=>{throw Object.assign(Error('revoked'),{dispatchDenied:true})},n),e=>e.dispatchDenied===true);assert.equal(n.calls.length,0)
 const oversized=fakeNetwork((req,res)=>{res.statusCode=201;res.headers={};res.emit('data',Buffer.alloc(262145));if(!req.destroyed)res.emit('end')})
 await assert.rejects(()=>postBrevoEmail({},'fixture-key',100,async()=>{},oversized),e=>!e.preflight)
 const timeout=fakeNetwork(()=>{});await assert.rejects(()=>postBrevoEmail({},'fixture-key',10,async()=>{},timeout),/timeout/)
})
