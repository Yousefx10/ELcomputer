<template>
 <section class="min-w-0 rounded-xl border border-slate-200 bg-white p-4 sm:p-6 dark:border-slate-700 dark:bg-slate-900" aria-live="polite">
  <h1 class="text-xl font-semibold">{{ $t('applePayment.title') }}</h1>
  <p v-if="checkout" class="mt-2 text-lg font-semibold">{{ checkout.totalAmount }} {{ checkout.currency }}</p>
  <p v-if="loading" role="status" class="mt-3 text-sm text-slate-600 dark:text-slate-400">{{ $t('applePayment.loading') }}</p>
  <p v-if="error" role="alert" class="mt-3 text-sm text-red-700 dark:text-red-400">{{ $t(error) }}</p>
  <p v-if="sheetClosed" role="status" class="mt-3 text-sm">{{ $t(checkout?.merchantRiskRetryAllowed ? 'merchantRetry.closed' : checkout?.canResume ? 'applePayment.closedReady' : 'applePayment.closedChecking') }}</p>
  <div v-show="!error && !sheetClosed" id="paymob-apple" ref="container" class="mt-4 min-w-0" />
  <div class="mt-4 flex flex-wrap gap-3">
   <button v-if="error && retrySafe" type="button" class="min-h-11 rounded-lg border px-4 text-sm font-semibold" @click="reload">{{ $t('embeddedCheckout.tryAgain') }}</button>
   <button v-if="sheetClosed && (checkout?.merchantRiskRetryAllowed || checkout?.canResume)" type="button" class="min-h-11 rounded-lg border px-4 text-sm font-semibold" @click="reload">{{ $t('embeddedCheckout.tryAgain') }}</button>
   <button v-if="checkout && !loading" type="button" class="min-h-11 rounded-lg border px-4 text-sm font-semibold" @click="status">{{ $t('paymentFirst.checkStatus') }}</button>
   <button type="button" class="min-h-11 px-2 text-sm font-semibold text-blue-700 dark:text-blue-400" @click="back">{{ $t('paymentInterface.back') }}</button>
  </div>
 </section>
</template>
<script setup>
import {applePayDeviceEligible,paymobPixelOptions} from '~/utils/paymobPixel'

const props=defineProps({sessionId:{type:String,required:true}})
const scope=useCustomerScope(),{uiNavigateTo}=useUiNavigation(),{locale}=useI18n(),colorMode=useColorMode()
const checkout=shallowRef(null),container=ref(null),loading=ref(true),error=ref(''),retrySafe=ref(false)
const sheetClosed=ref(false)
let disposed=false,arming=false,submitted=false,completed=false,payment=null,sdk,observer,loadTimer,expiryTimer
const navigate=path=>uiNavigateTo(path,{external:true})
const retire=()=>{if(checkout.value?.merchantRiskRetryAllowed)void scope.request(`/api/account/payment-checkouts/${props.sessionId}/retire`,{method:'POST',body:{},retry:0,timeout:10000}).catch(()=>{})}
const back=()=>{retire();navigate('/checkout')},status=()=>navigate('/checkout/session/'+props.sessionId)
const reload=()=>checkout.value?.merchantRiskRetryAllowed?back():window.location.reload()
const phase=code=>console.info('[apple-payment]',code)
const cancelled=()=>{
 if(disposed||completed||sheetClosed.value)return
 // Pixel calls beforePaymentComplete before begin(), not after native approval.
 // Its cancel callback carries no authoritative financial outcome.
 // Merchant-authorized retries retire only the local presentation.
 sheetClosed.value=true;loading.value=false;retrySafe.value=false
 if(checkout.value?.merchantRiskRetryAllowed){retire();payment=null;void navigate('/checkout')}
 console.warn('[apple-payment]','SHEET_CLOSED')
}
const sdkError=event=>{
 if(disposed||!payment)return
 const fromSdk=event.filename?.includes('/paymob-pixel/1.2.8/main.js')
  ||event.reason?.stack?.includes('/paymob-pixel/1.2.8/main.js')
 const nativeFailure=['InvalidAccessError','SecurityError','NotAllowedError'].includes(event.reason?.name)
 if(fromSdk||nativeFailure){event.preventDefault();fail('SDK_RUNTIME')}
}
const fail=(code,message='applePayment.unavailable')=>{
 if(disposed)return
 loading.value=false;error.value=message;retrySafe.value=!arming&&!submitted&&code!=='EXPIRED'&&code!=='INELIGIBLE'
 clearTimeout(loadTimer)
 // Fixed phase codes only. Never log provider errors, keys, URLs or payloads.
 console.warn('[apple-payment]',code)
}
const authorize=async()=>{
 if(disposed||arming||submitted||!scope.isCurrent()||!payment?.interfaceToken)return false
 if(Date.parse(payment.expiresAt)<=Date.now()){fail('EXPIRED','applePayment.expired');return false}
 arming=true;retrySafe.value=false
 phase('SUBMISSION_GATE_REQUESTED')
 try{
  const result=await scope.request(`/api/account/payment-checkouts/${props.sessionId}/interface`,{method:'POST',body:{version:2,action:'submit',token:payment.interfaceToken},retry:0,timeout:10000})
  if(disposed||!scope.isCurrent())return false
  checkout.value=result.checkout
  if(result.allowed!==true){fail('SUBMISSION_DENIED','paymentInterface.unavailable');return false}
  submitted=true;phase('SUBMISSION_GATE_ACCEPTED');return true
 }catch{fail('SUBMISSION_UNCERTAIN','paymentInterface.unavailable');return false}
 // Arming stays fenced after denial or transport uncertainty.
}
const mount=()=>{
 if(disposed||!scope.isCurrent())return
 if(Date.parse(payment.expiresAt)<=Date.now()){fail('EXPIRED','applePayment.expired');return}
 if(typeof window.Pixel!=='function'){fail('SDK_MISSING');return}
 phase('SDK_LOADED')
 try{
  new window.Pixel({...paymobPixelOptions({...payment,elementId:'paymob-apple',locale:locale.value,dark:colorMode.value==='dark'}),
   beforePaymentComplete:authorize,
   afterPaymentComplete:()=>{if(!disposed&&!completed){completed=true;phase('SDK_COMPLETED');status()}},
   onPaymentCancel:cancelled})
  const rendered=()=>{
   if(disposed)return
   const roots=[container.value,...container.value?.querySelectorAll('*')||[]].map(node=>node?.shadowRoot).filter(Boolean)
   for(const root of roots){
    if(root.querySelector('[role=alert]')){fail('SDK_INITIALIZATION');return}
    if(root.querySelector('#apple-pay-button')){if(loading.value)phase('SDK_READY');loading.value=false;clearTimeout(loadTimer);return}
   }
  }
  observer=new MutationObserver(rendered);observer.observe(container.value,{childList:true,subtree:true})
  // Shadow-root mutations do not reach the outer observer.
  const poll=()=>{if(!disposed&&loading.value&&!error.value){rendered();if(loading.value)setTimeout(poll,100)}}
  poll()
 }catch{fail('SDK_INITIALIZATION')}
}
onMounted(async()=>{
 window.addEventListener('pageshow',restore)
 window.addEventListener('error',sdkError);window.addEventListener('unhandledrejection',sdkError)
 // Apple APIs, the SDK and the user's button gesture share the eligible page.
 // CARD retains the existing disposable SDK frame.
 if(window!==window.top||!applePayDeviceEligible(window)){fail('INELIGIBLE','applePayment.ineligible');return}
 try{
  phase('INTERFACE_OPEN_REQUESTED')
  const result=await scope.request(`/api/account/payment-checkouts/${props.sessionId}/interface`,{method:'POST',body:{version:2,action:'open'},retry:0,timeout:10000})
  if(disposed||!scope.isCurrent())return
  checkout.value=result.checkout
  if(!result.allowed||result.checkout?.id!==props.sessionId||result.payment?.experience!=='embedded'||!Array.isArray(result.payment.paymentMethods)||result.payment.paymentMethods.length!==1||result.payment.paymentMethods[0]!=='apple-pay'){
   fail('SESSION_UNAVAILABLE','paymentInterface.unavailable');return
  }
  payment=result.payment
  phase('INTERFACE_READY')
  const expiry=Date.parse(payment.expiresAt)
  if(!Number.isFinite(expiry)||expiry<=Date.now()){fail('EXPIRED','applePayment.expired');return}
  expiryTimer=setTimeout(()=>fail('EXPIRED','applePayment.expired'),Math.min(expiry-Date.now(),3600000))
  loadTimer=setTimeout(()=>fail('SDK_TIMEOUT'),15000)
  sdk=document.createElement('script');sdk.src='/paymob-pixel/1.2.8/main.js'
  sdk.integrity='sha384-4ITAGSF5NsYiL+fauejz88cmuuYkGC7Yw0lgzHATTP0n/Az+BPASNgkDC5PfA1cM';sdk.crossOrigin='anonymous'
  sdk.onload=mount;sdk.onerror=()=>fail('SDK_LOAD');document.head.appendChild(sdk)
 }catch{fail('INTERFACE_UNAVAILABLE')}
})
const restore=event=>{if(event.persisted)window.location.reload()}
// Pixel1.2.8 has no public disposal API. Every exit replaces the document,
// disposing provider listeners and intent data without private vendor methods.
onBeforeRouteLeave(to=>{retire();window.location.assign(new URL(to.fullPath,window.location.origin).href);return false})
onBeforeUnmount(()=>{disposed=true;clearTimeout(loadTimer);clearTimeout(expiryTimer);observer?.disconnect();window.removeEventListener('pageshow',restore);window.removeEventListener('error',sdkError);window.removeEventListener('unhandledrejection',sdkError);if(sdk){sdk.onload=null;sdk.onerror=null}payment=null})
scope.onInvalidate(()=>{disposed=true;payment=null;checkout.value=null;container.value?.replaceChildren();navigate('/login')})
</script>
