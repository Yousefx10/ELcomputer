import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {getPaymobConfig,selectPaymobMethod,buildIntentionRequest,normalizePaymobCallback} from '../server/utils/payments/paymob.js'
import {paymobExperience} from '../server/utils/payments/methods.js'

const origin='https://independent.example.invalid'
const hostedApple={id:321,mode:'live',enabled:true,hosted:true}
const runtime=(apple=hostedApple,extra={})=>({paymobEnabled:true,paymobLiveRequestsEnabled:true,paymobMode:'live',paymobSecretKey:'sk_live_fixture',paymobPublicKey:'pk_live_fixture',paymobHmacSecret:'fixture',paymobCardIntegrationId:'123',paymobCardIntegrationMode:'live',paymobIntegrationIds:JSON.stringify({apple_pay:apple}),public:{siteUrl:origin},...extra})
const appleOf=config=>config.methods.find(method=>method.method==='apple_pay')
const cardOf=config=>config.methods.find(method=>method.method==='card')
const tx=(change={})=>({id:99,order:{id:88},amount_cents:100,currency:'EGP',integration_id:321,pending:false,success:true,error_occured:false,is_auth:false,is_capture:false,is_refunded:false,is_voided:false,is_standalone_payment:true,has_parent_transaction:false,source_data:{type:'card'},...change})

test('hosted Apple Pay needs no merchant domain or certificate flags',()=>{
 const config=getPaymobConfig(runtime())
 assert.equal(appleOf(config).available,true);assert.equal(appleOf(config).hosted,true)
 assert.equal(selectPaymobMethod(config,'apple_pay').integrationId,321)
 for(const embedded of [true,false])assert.equal(paymobExperience(appleOf(config),embedded),'redirect')
})

test('hosted Apple Pay stays closed unless enabled, live and explicitly hosted',()=>{
 for(const change of [{enabled:false},{hosted:false},{hosted:undefined}]){
  const config=getPaymobConfig(runtime({...hostedApple,...change}))
  assert.equal(paymobExperience(appleOf(config),false),null);assert.throws(()=>selectPaymobMethod(config,'apple_pay'))
  assert.equal(selectPaymobMethod(config,'card').integrationId,123)
 }
 assert.throws(()=>getPaymobConfig(runtime({...hostedApple,hosted:'true'})))
 const test=runtime({...hostedApple,mode:'test'},{paymobMode:'test',paymobLiveRequestsEnabled:false,paymobSecretKey:'sk_test_fixture',paymobPublicKey:'pk_test_fixture',paymobCardIntegrationMode:'test'})
 assert.equal(paymobExperience(appleOf(getPaymobConfig(test)),false),null)
})

test('embedded Apple Pay keeps its verification gates and Pixel rollout',()=>{
 const verified={id:321,mode:'live',enabled:true,pixelVerified:true,certificatesVerified:true,verifiedOrigin:origin}
 const config=getPaymobConfig(runtime(verified))
 assert.equal(paymobExperience(appleOf(config),true),'embedded');assert.equal(paymobExperience(appleOf(config),false),null)
 const unverified=getPaymobConfig(runtime({...verified,certificatesVerified:false}))
 assert.equal(paymobExperience(appleOf(unverified),true),null)
 assert.equal(paymobExperience(appleOf(getPaymobConfig(runtime({...verified,hosted:true}))),true),'redirect')
})

test('card experience still follows the Pixel rollout only',()=>{
 const config=getPaymobConfig(runtime())
 assert.equal(paymobExperience(cardOf(config),true),'embedded');assert.equal(paymobExperience(cardOf(config),false),'redirect')
 assert.equal(paymobExperience(undefined,true),null)
})

test('hosted Apple intention offers only the Apple Pay integration',()=>{
 const config=selectPaymobMethod(getPaymobConfig(runtime()),'apple_pay')
 const order={id:randomUUID(),order_number:'HOSTED-APPLE',total_amount:'325.00',currency:'EGP',first_name:'Fixture',phone:'01012345678',email:'fixture@example.invalid',street_address:'Fixture street',city:'Fixture city',governorate:'Fixture region'}
 const payload=buildIntentionRequest(config,order,{id:randomUUID(),amount_minor:32500})
 assert.deepEqual(payload.payment_methods,[321]);assert.equal(payload.amount,32500)
})

test('signed Apple Pay callbacks accept card or Apple Pay labels; card stays strict',()=>{
 const config=getPaymobConfig(runtime(),{callback:true})
 for(const type of ['card','apple_pay','apple-pay','APPLE_PAY','applepay','Apple Pay'])assert.equal(normalizePaymobCallback(tx({source_data:{type}}),config).status,'succeeded')
 for(const type of ['',undefined,'wallet','apple','apple_pay_x','google_pay'])assert.throws(()=>normalizePaymobCallback(tx({source_data:{type}}),config))
 assert.equal(normalizePaymobCallback(tx({integration_id:123}),config).integration_id,123)
 assert.throws(()=>normalizePaymobCallback(tx({integration_id:123,source_data:{type:'apple_pay'}}),config))
 assert.throws(()=>normalizePaymobCallback(tx({integration_id:999,source_data:{type:'apple_pay'}}),config))
 assert.equal(normalizePaymobCallback(tx({success:false}),config).status,'failed')
})

test('optional test accounts limit hosted Apple Pay to reviewed customers',()=>{
 const owner=randomUUID(),config=getPaymobConfig(runtime({...hostedApple,customerIds:[owner]}))
 assert.equal(paymobExperience(appleOf(config),false,owner),'redirect')
 for(const customer of [randomUUID(),'',undefined])assert.equal(paymobExperience(appleOf(config),false,customer),null)
 assert.equal(paymobExperience(appleOf(getPaymobConfig(runtime({...hostedApple,customerIds:[]}))),false,''),'redirect')
 for(const customerIds of ['all',[1],['not-a-uuid'],Array.from({length:101},()=>randomUUID())])assert.throws(()=>getPaymobConfig(runtime({...hostedApple,customerIds})))
 assert.equal(cardOf(config).customerIds.length,0)
})
