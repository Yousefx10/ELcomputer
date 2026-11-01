import test from 'node:test'
import assert from 'node:assert/strict'
import {normalizeModernFooter,visibleFooterPayments} from '../app/utils/modernFooter.js'
test('footer cannot advertise a disabled or unsupported payment method',()=>{
 const config=normalizeModernFooter({payments:{enabled:true,items:['card','cash','paypal'].map(method=>({id:method,method,label:method,image_url:'/uploads/'+method+'.png'}))}})
 const settings={payment_card_enabled:true,payment_cash_enabled:true,payment_paypal_enabled:true}
 assert.deepEqual(visibleFooterPayments(config,settings,{}).map(x=>x.method),['cash'])
 assert.deepEqual(visibleFooterPayments(config,settings,{card:{available:true}}).map(x=>x.method),['card','cash'])
 assert.deepEqual(visibleFooterPayments(config,{...settings,payment_cash_enabled:false},{card:{available:false}}),[])
 const unknown=normalizeModernFooter({payments:{enabled:true,items:[{id:'future',method:'apple_pay',label:'Future wallet',image_url:'/uploads/wallet.png'}]}});assert.equal(unknown.payments.items[0].method,'');assert.deepEqual(visibleFooterPayments(unknown,settings,{card:{available:true}}),[])
})
