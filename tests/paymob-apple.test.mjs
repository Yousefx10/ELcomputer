import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {getPaymobConfig,selectPaymobMethod,buildIntentionRequest,normalizePaymobCallback} from '../server/utils/payments/paymob.js'
import {pixelEnabledFor} from '../server/utils/payments/methods.js'
import {applePayDeviceEligible,paymobPixelOptions} from '../app/utils/paymobPixel.js'
const origin='https://independent.example.invalid',id=randomUUID(),apple={id:321,mode:'live',enabled:true,pixelVerified:true,certificatesVerified:true,verifiedOrigin:origin}
const runtime={paymobEnabled:true,paymobLiveRequestsEnabled:true,paymobMode:'live',paymobSecretKey:'sk_live_fixture',paymobPublicKey:'pk_live_fixture',paymobHmacSecret:'fixture',paymobCardIntegrationId:'123',paymobCardIntegrationMode:'live',paymobIntegrationIds:JSON.stringify({apple_pay:apple}),paymobPixelEnabled:true,paymobPixelCustomerIds:JSON.stringify([id]),public:{siteUrl:origin}}
const tx={id:99,order:{id:88},amount_cents:100,currency:'EGP',integration_id:321,pending:false,success:true,error_occured:false,is_auth:false,is_capture:false,is_refunded:false,is_voided:false,is_standalone_payment:true,has_parent_transaction:false,source_data:{type:'card'}}
test('Apple requires live method, explicit Pixel/certificate verification and the configured origin',()=>{
 assert.equal(selectPaymobMethod(getPaymobConfig(runtime),'apple_pay').integrationId,321)
 for(const change of [{enabled:false},{pixelVerified:false},{certificatesVerified:false},{verifiedOrigin:'https://foreign.example.invalid'},{pixelVerified:undefined}]){
  const config=getPaymobConfig({...runtime,paymobIntegrationIds:JSON.stringify({apple_pay:{...apple,...change}})})
  assert.throws(()=>selectPaymobMethod(config,'apple_pay'));assert.equal(selectPaymobMethod(config,'card').integrationId,123)
 }
 const config=getPaymobConfig(runtime)
 for(const method of ['google_pay','mobile_wallet','apple-pay','unknown'])assert.throws(()=>selectPaymobMethod(config,method))
})
test('Apple intention uses its configured integration and the exact server EGP3050 quote',()=>{
 const config=selectPaymobMethod(getPaymobConfig(runtime),'apple_pay')
 const order={id:randomUUID(),order_number:'ISOLATED-APPLE',total_amount:'3050.00',currency:'EGP',first_name:'Fixture',phone:'01012345678',email:'fixture@example.invalid',street_address:'Fixture street',city:'Fixture city',governorate:'Fixture region'}
 const attempt={id:randomUUID(),amount_minor:305000}
 const payload=buildIntentionRequest(config,order,attempt,'ar')
 assert.deepEqual(payload.payment_methods,[apple.id]);assert.equal(payload.amount,305000);assert.equal(payload.currency,'EGP');assert.equal(payload.expiration,1800)
 assert.equal(new URL(payload.notification_url).origin,origin);assert.equal(new URL(payload.redirection_url).origin,origin)
 assert.throws(()=>buildIntentionRequest(config,order,{...attempt,amount_minor:305001}))
 assert.deepEqual(buildIntentionRequest(selectPaymobMethod(getPaymobConfig(runtime),'card'),order,attempt).payment_methods,[123])
})
test('rollout is bounded by authenticated customer IDs and fails closed for malformed settings',()=>{
 assert.equal(pixelEnabledFor(runtime,id),true);assert.equal(pixelEnabledFor(runtime,randomUUID()),false)
 assert.equal(pixelEnabledFor(runtime,''),false)
 for(const value of ['bad','{}','[1]',JSON.stringify(Array(101).fill(id))])assert.equal(pixelEnabledFor({...runtime,paymobPixelCustomerIds:value},id),false)
 assert.equal(pixelEnabledFor({...runtime,paymobPixelEnabled:false},id),false)
 assert.equal(pixelEnabledFor({...runtime,paymobPixelCustomerIds:'[]'},id),true)
})
test('Apple eligibility needs a secure eligible device and supported session version',()=>{
 const capable={isSecureContext:true,ApplePaySession:{canMakePayments:()=>true,supportsVersion:v=>v===3}}
 assert.equal(applePayDeviceEligible(capable),true)
 for(const env of [{},{...capable,isSecureContext:false},{isSecureContext:true,ApplePaySession:{canMakePayments:()=>false}},{isSecureContext:true,ApplePaySession:{canMakePayments:()=>true,supportsVersion:()=>false}},{isSecureContext:true,ApplePaySession:{canMakePayments:()=>{throw Error('unavailable')}}}])assert.equal(applePayDeviceEligible(env),false)
})
test('exactly one selected Pixel method is sent, with card saving disabled',()=>{
 for(const method of ['card','apple-pay']){const options=paymobPixelOptions({paymentMethods:[method]});assert.deepEqual(options.paymentMethods,[method]);assert.equal(options.showSaveCard,false);assert.equal(options.forceSaveCard,false)}
 for(const methods of [[],['google-pay'],['card','apple-pay']])assert.deepEqual(paymobPixelOptions({paymentMethods:methods}).paymentMethods,[])
})
test('late Apple callbacks retain the actual integration after new attempts are disabled',()=>{
 const config=getPaymobConfig({...runtime,paymobPixelEnabled:false,paymobIntegrationIds:JSON.stringify({apple_pay:{...apple,enabled:false}})})
 assert.equal(normalizePaymobCallback(tx,config).integration_id,321)
 assert.equal(normalizePaymobCallback({...tx,integration_id:123},config).integration_id,123)
 for(const change of [{integration_id:777},{currency:'USD'},{source_data:{type:'wallet'}},{success:'true'},{is_auth:true}])assert.throws(()=>normalizePaymobCallback({...tx,...change},config))
})
