import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { presentationCommand } from '../server/utils/productPresentation.js'
import { familySwatch } from '../app/utils/productFamily.js'
test('existing presentation command validates linked products without admitting arbitrary URLs or fields',()=>{
 const family={id:randomUUID(),axes:[{key:'model',label:'Model',label_ar:''}],members:['Basic','Pro'].map(model=>({product_id:randomUUID(),values:{model},values_ar:{}}))}
 const body={request_id:randomUUID(),expected_revision:0,content:{videos:[],related:[],compatible:[],family}}
 assert.deepEqual(presentationCommand(body).p_content,body.content)
 for(const invalid of [{...family,href:'https://wrong.invalid'}, {...family,members:family.members.map(m=>({...m,values:{model:'same'}}))}, {...family,members:[{...family.members[0],product_id:'https://wrong.invalid'},family.members[1]]}, {...family,members:family.members.map((m,i)=>({...m,values:{model:i?'basic':'Basic'}}))}])assert.throws(()=>presentationCommand({...body,content:{...body.content,family:invalid}}),e=>e.statusCode===400)
 assert.equal(familySwatch({values:{color:'Black'}}),'black');assert.equal(familySwatch({values:{color:'Unverified finish'}}),'');assert.equal(familySwatch({values:{color:'White'},color_hex:'#fafafa'}),'#fafafa')
})
