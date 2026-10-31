import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID,createHash} from 'node:crypto'
import {loadShippingLabel} from '../server/utils/shippingLabelAccess.js'
import {readShippingLabelResponse} from '../app/utils/shippingLabelDownload.js'
import {shippingLabelFixture} from './helpers/shippingLabelFixture.mjs'
const orderId=randomUUID(),jobId=randomUUID(),bytes=shippingLabelFixture(),sha=createHash('sha256').update(bytes).digest('hex')
const job={id:jobId,order_id:orderId,provider:'pdc',to_ref:'FIXTURE-REF-456',awb:'FIXTURE-AWB-123',state:'ready',label_storage_path:`vps-v1/orders/${orderId}/${jobId}.pdf`,label_sha256:sha,label_size_bytes:bytes.length}
const setup=(rows=[job,job])=>{let calls=0,reads=0;const filters=[];const q={select(){return q},eq(...v){filters.push(v);return q},async maybeSingle(){return {data:rows[Math.min(calls++,rows.length-1)]}}};return {db:{from(name){assert.equal(name,'shipping_order_jobs');return q}},readDocument:async()=>{reads++;return bytes},validatePdf:async()=>({pages:[{width:283,height:425}]}),get calls(){return calls},get reads(){return reads},filters}}
test('private retrieval reads only the exact saved order/provider and rechecks identity',async()=>{
 const f=setup();let authorized=0;const result=await loadShippingLabel({...f,orderId,authorize:async()=>authorized++});assert.deepEqual(result.bytes,bytes);assert.equal(f.calls,2);assert.equal(authorized,1);assert.ok(f.filters.some(x=>x[0]==='order_id'&&x[1]===orderId));assert.ok(f.filters.some(x=>x[0]==='provider'&&x[1]==='pdc'))
})
test('absent, foreign-order and cross-order file references cannot reveal bytes',async()=>{
 for(const value of [null,{...job,order_id:randomUUID()},{...job,label_storage_path:`vps-v1/orders/${randomUUID()}/${jobId}.pdf`}]){const f=setup([value]);await assert.rejects(loadShippingLabel({...f,orderId}));assert.equal(f.reads,0)}
})
test('permission revoked during document work withholds the response',async()=>{const f=setup();await assert.rejects(loadShippingLabel({...f,orderId,authorize:async()=>{throw Error('Revoked')}}),/Revoked/);assert.equal(f.calls,1)})
test('job state, AWB, REF and stored hash cannot change during retrieval',async()=>{
 for(const update of [{state:'label_pending'},{awb:'OTHER'},{to_ref:'OTHER'},{label_sha256:'0'.repeat(64)},null]){const f=setup([job,update?{...job,...update}:null]);await assert.rejects(loadShippingLabel({...f,orderId}))}
})
test('missing disk bytes and invalid PDF withhold labels without calling any provider',async()=>{
 for(const patch of [{readDocument:async()=>{throw Error('Private path canary')}},{validatePdf:async()=>{throw Error('Wrong PDF canary')}}])await assert.rejects(loadShippingLabel({...setup(),...patch,orderId}),e=>e.statusCode===503&&!String(e).includes('canary'))
})
const response=(headers={},data=bytes)=>new Response(data,{headers:{'content-type':'application/pdf','content-length':String(data.length),'x-shipping-order':orderId,'x-shipping-job':jobId,'x-shipping-awb':job.awb,'x-shipping-ref':job.to_ref,'x-label-sha256':sha,...headers}})
const expected={orderId,jobId,awb:job.awb}
test('browser receives exactly the validated original bytes and server identity',async()=>{const got=await readShippingLabelResponse(response(),expected);assert.deepEqual(Buffer.from(got.bytes),bytes);assert.equal(got.identity.reference,job.to_ref)})
test('browser rejects mismatched order/job/AWB and malformed content',async()=>{
 for(const h of [{'x-shipping-order':randomUUID()},{'x-shipping-job':randomUUID()},{'x-shipping-awb':'OTHER'},{'x-shipping-ref':'../unsafe'},{'content-type':'text/html'},{'content-length':'99999999'},{'content-length':'0'},{'x-label-sha256':'0'.repeat(64)}])await assert.rejects(readShippingLabelResponse(response(h),expected))
})
test('browser never downloads error HTML or a changed PDF body',async()=>{
 await assert.rejects(readShippingLabelResponse(new Response('error',{status:503}),expected));await assert.rejects(readShippingLabelResponse(response({},shippingLabelFixture({awb:'OTHER'})),expected))
})
