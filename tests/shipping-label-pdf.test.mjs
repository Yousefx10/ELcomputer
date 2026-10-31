import test from 'node:test'
import assert from 'node:assert/strict'
import {shippingLabelFixture} from './helpers/shippingLabelFixture.mjs'
import {validateShippingLabelPdf,shippingLabelIdentity,MAX_LABEL_BYTES} from '../server/utils/shippingLabelPdf.js'
const identity={awb:'FIXTURE-AWB-123',reference:'FIXTURE-REF-456'}
test('real structured PDF and compressed streams bind the exact shipment',async()=>{
 for(const compressed of [false,true])assert.deepEqual((await validateShippingLabelPdf(shippingLabelFixture({compressed}),identity)).pages,[{width:283.465,height:425.197}])
})
test('same saved identity is required on every page',async()=>{
 assert.equal((await validateShippingLabelPdf(shippingLabelFixture({pages:2}),identity)).pages.length,2)
 await assert.rejects(validateShippingLabelPdf(shippingLabelFixture({pages:2,texts:['FIXTURE-AWB-123 FIXTURE-REF-456','OTHER-AWB OTHER-REF']}),identity))
})
test('wrong AWB, wrong REF and partial identifier matches cannot pass',async()=>{
 for(const options of [{awb:'OTHER-AWB'},{reference:'OTHER-REF'},{awb:identity.awb+'0'},{reference:'0'+identity.reference}])await assert.rejects(validateShippingLabelPdf(shippingLabelFixture(options),identity))
})
test('text broken across PDF text runs can match; unrelated document metadata cannot',async()=>{
 assert.equal((await validateShippingLabelPdf(shippingLabelFixture({texts:['FIXTURE- AWB- 123\nFIXTURE- REF- 456']}),identity)).pages.length,1)
 const bytes=shippingLabelFixture({awb:'OTHER',reference:'OTHER'});const padded=Buffer.concat([bytes.subarray(0,-6),Buffer.from('% '+identity.awb+' '+identity.reference+'\n%%EOF')])
 await assert.rejects(validateShippingLabelPdf(padded,identity))
})
test('header-only, truncated, non-PDF and oversized content is rejected',async()=>{
 const pdf=shippingLabelFixture()
 for(const b of [Buffer.from('%PDF-1.7\nnot a document\n%%EOF'),pdf.subarray(0,-10),Buffer.from('<html>not pdf</html>'),Buffer.alloc(MAX_LABEL_BYTES+1),Buffer.concat([pdf,Buffer.from('<script>bad</script>')])])await assert.rejects(validateShippingLabelPdf(b,identity))
})
test('script actions are rejected, not executed',async()=>{await assert.rejects(validateShippingLabelPdf(shippingLabelFixture({javascript:true}),identity))})
test('page count, geometry and missing text are bounded',async()=>{
 for(const o of [{pages:5},{width:2000},{height:0},{texts:['image-only/no shipment text']}])await assert.rejects(validateShippingLabelPdf(shippingLabelFixture(o),identity))
})
test('only saved PDC UUID/job identity and safe filenames are accepted',()=>{
 const j={id:'00000000-0000-4000-8000-000000000001',order_id:'00000000-0000-4000-8000-000000000002',provider:'pdc',awb:identity.awb,to_ref:identity.reference}
 assert.equal(shippingLabelIdentity(j).orderId,j.order_id)
 for(const patch of [{provider:'manual'},{id:'other'},{order_id:'../other'},{awb:'bad\r\nHeader: data'},{awb:123},{to_ref:'unsafe/reference'}])assert.throws(()=>shippingLabelIdentity({...j,...patch}))
})
test('worker concurrency is bounded and resources are reusable afterward',async()=>{
 const results=await Promise.allSettled(Array.from({length:4},()=>validateShippingLabelPdf(shippingLabelFixture(),identity)))
 assert.equal(results.filter(r=>r.status==='fulfilled').length,2);assert.equal(results.filter(r=>r.status==='rejected').length,2)
 assert.equal((await validateShippingLabelPdf(shippingLabelFixture(),identity)).pages.length,1)
})
