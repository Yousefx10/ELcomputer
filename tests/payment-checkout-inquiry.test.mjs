import test from 'node:test'
import assert from 'node:assert/strict'
import {inquirePaymobTransaction} from '../server/utils/payments/inquiry.js'

const config={mode:'live',integrationId:123,methods:[{integrationId:123,method:'card',flowImplemented:true}]}
const expected={mode:'live',currency:'EGP',amount_minor:15035,integration_id:123,provider_order_id:'91001'}
const object={id:81001,order:{id:91001,merchant_order_id:'00000000-0000-4000-8000-000000000001'},amount_cents:15035,currency:'EGP',integration_id:123,is_live:true,pending:false,success:true,error_occured:false,is_auth:false,is_capture:false,is_refunded:false,is_voided:false,has_parent_transaction:false,is_standalone_payment:true,source_data:{type:'card'}}
const base={apiKey:'offline-fixture-api-key-with-no-provider-access',config,expected}
const response=(body,status=200)=>({ok:status>=200&&status<300,status,json:async()=>body})
for(const target of [{transactionId:'81001'},{providerOrderId:'91001'},{merchantReference:object.order.merchant_order_id}])test('official targeted inquiry '+Object.keys(target)[0]+' retains authenticated evidence without manufacturing a callback HMAC',async()=>{
 const calls=[],result=await inquirePaymobTransaction({...base,...target,fetcher:async(url,options)=>{calls.push({url,options});return calls.length===1?response({token:'offline-only-auth-token-fixture'}):response(object)}})
 assert.equal(calls.length,2);assert.equal(calls[0].url,'https://accept.paymob.com/api/auth/tokens')
 if(target.transactionId){assert.ok(calls[1].url.endsWith('/api/acceptance/transactions/81001'));assert.equal(calls[1].options.method,'GET')}
 else{assert.ok(calls[1].url.endsWith('/api/ecommerce/orders/transaction_inquiry'));assert.equal(calls[1].options.method,'POST')}
 assert.equal(result.status,'succeeded');assert.equal(result.source,'authenticated_targeted_inquiry');assert.equal(result.financialFinality,false)
 assert.match(result.evidenceSha256,/^[a-f0-9]{64}$/);assert.equal(result.transaction.signature_sha256,undefined)
 assert.ok(!JSON.stringify(result).includes(base.apiKey));assert.ok(!JSON.stringify(result).includes('auth-token'))
})
for(const [name,body,status] of [['no matching transaction',null,404],['empty provider result',{},200],['ambiguous provider error',{},500],['wrong amount',{...object,amount_cents:1},200],['test/live mismatch',{...object,is_live:false},200],['wrong provider order',{...object,order:{id:91002}},200],['authorization-only',{...object,is_auth:true},200]])test(name+' remains unresolved and creates no synthetic finality',async()=>{
 let count=0;const result=await inquirePaymobTransaction({...base,providerOrderId:'91001',fetcher:async()=>++count===1?response({token:'offline-only-auth-token-fixture'}):response(body,status)})
 assert.equal(count,2);assert.equal(result.status,'unresolved');assert.equal(result.financialFinality,false);assert.equal(result.transaction,undefined)
})
test('provider inquiry timeout is bounded, never retried and never treated as a decline',async()=>{
 let count=0;const result=await inquirePaymobTransaction({...base,providerOrderId:'91001',fetcher:async()=>{if(++count===1)return response({token:'offline-only-auth-token-fixture'});throw new DOMException('fixture timeout','TimeoutError')}})
 assert.equal(count,2);assert.equal(result.status,'unresolved');assert.equal(result.financialFinality,false)
})
test('confirmed provider decline describes one transaction and does not retire its intention',async()=>{
 let count=0;const result=await inquirePaymobTransaction({...base,providerOrderId:'91001',fetcher:async()=>++count===1?response({token:'offline-only-auth-token-fixture'}):response({...object,success:false})})
 assert.equal(result.status,'failed');assert.equal(result.financialFinality,false)
})
