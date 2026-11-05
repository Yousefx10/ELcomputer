<template>
 <section class="min-w-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 sm:p-6" aria-live="polite">
  <Icon :name="confirmed ? 'lucide:circle-check' : 'lucide:clock-3'" size="28" class="text-blue-600" aria-hidden="true" />
  <h1 class="mt-3 text-xl font-semibold">{{ $t(payment ? 'embeddedCheckout.secureTitle' : confirmed ? 'paymentFirst.confirmed' : checkout?.paymentStatus === 'ready' ? 'paymentInterface.ready' : checkout?.paymentStatus === 'failed' ? 'embeddedCheckout.failed' : checkout?.paymentStatus === 'verified_order_pending' ? 'paymentFirst.orderReview' : 'embeddedCheckout.pending') }}</h1>
  <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">{{ $t(confirmed ? 'paymentFirst.confirmedDetail' : 'embeddedCheckout.cartSaved') }}</p>
  <p v-if="checkout" class="mt-3 break-words text-sm">{{ checkout.orderNumber || checkout.reference }} · {{ checkout.totalAmount }} {{ checkout.currency }}</p>
  <p v-if="confirmed && checkout.stockReview" class="mt-2 text-sm">{{ $t('paymentFirst.stockReview') }}</p>
  <p v-if="error" role="alert" class="mt-3 text-sm text-red-700">{{ $t('paymentFirst.unavailable') }}</p>
  <p v-if="checkout?.paymentStatus==='failed' && !confirmed" class="mt-2 text-sm">{{ $t('paymentFirst.failedDetail') }}</p>
  <p v-if="checkout && !confirmed && !checkout.canResume && !payment" class="mt-2 text-sm text-slate-600 dark:text-slate-400">{{ $t('paymentInterface.support') }}</p>
  <ClientOnly><PaymentPaymobPixel v-if="payment" :session="payment" :authorize="authorizePayment" class="mt-4" @complete="paymentComplete" @cancel="cancelPayment" @unavailable="paymentUnavailable" /></ClientOnly>
  <button v-if="fallback" type="button" :disabled="busy" class="mt-3 min-h-11 rounded-lg border px-4 text-sm font-semibold" @click="hostedFallback">{{ $t('embeddedCheckout.hosted') }}</button>
  <details v-if="checkout" class="mt-3 text-sm"><summary class="min-h-11 cursor-pointer font-medium">{{ $t('paymentFirst.checkoutDetails') }}</summary><ul class="space-y-2"><li v-for="(line,index) in checkout.items" :key="index" class="break-words">{{ line.product_title }} · {{ line.quantity }} · {{ line.line_total }} {{ checkout.currency }}</li></ul><p class="mt-3 whitespace-pre-wrap break-words">{{ [checkout.address?.first_name,checkout.address?.last_name,checkout.address?.street_address,checkout.address?.city,checkout.address?.governorate].filter(Boolean).join(', ') }}</p></details>
  <p v-if="cartNotice" role="status" class="mt-3 text-sm">{{ $t('paymentFirst.cartReview') }}</p>
  <div class="mt-4 flex flex-wrap gap-3">
   <button v-if="!payment && (checkout?.paymentStatus==='failed' || checkout?.canResume) && !confirmed" type="button" :disabled="!retrySafe || busy" @click="retryCheckout" class="min-h-11 rounded-lg border px-4 text-sm font-semibold disabled:opacity-50">{{ $t(checkout?.paymentStatus==='failed' ? 'embeddedCheckout.tryAgain' : 'paymentInterface.pay') }}</button>
   <NuxtLinkLocale v-if="confirmed" :to="`/account/orders/${checkout.orderId}`" class="inline-flex min-h-11 items-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white">{{ $t('paymob.viewOrder') }}</NuxtLinkLocale>
   <button v-else type="button" :disabled="busy" @click="refresh" class="min-h-11 rounded-lg border px-4 text-sm font-semibold disabled:opacity-50">{{ $t('paymentFirst.checkStatus') }}</button>
   <NuxtLinkLocale to="/account/payments" class="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-blue-700 dark:text-blue-400">{{ $t('paymentFirst.activity') }}</NuxtLinkLocale>
   <NuxtLinkLocale to="/cart" class="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-blue-700 dark:text-blue-400">{{ $t('paymentFirst.cart') }}</NuxtLinkLocale>
  </div>
 </section>
</template>
<script setup>
import {emitMetaEvent} from '~/utils/metaTracking'
import {readPendingCheckout,removePendingCheckout} from '~/utils/checkoutRecovery'
import {hostedPaymentUrl} from '~/utils/hostedPayment'
const props=defineProps({sessionId:{type:String,required:true}})
const scope=useCustomerScope(),{completePurchasedCart,renewCart}=useCart()
const {uiNavigateTo}=useUiNavigation()
const checkout=ref(null),busy=ref(false),error=ref(false),cartNotice=ref(false)
const payment=shallowRef(null),activeInterface=shallowRef(null),fallback=ref(false)
const confirmed=computed(()=>checkout.value?.paymentStatus==='paid'&&!!checkout.value?.orderId)
// A new submission reuses the same intention after server evidence permits it.
// This never treats a browser result as financial finality or creates a retry order.
const retiredRetry=computed(()=>checkout.value?.state==='retired'&&checkout.value?.paymentStatus==='failed'&&checkout.value?.fundsVerified===false&&!checkout.value?.orderId)
const retrySafe=computed(()=>checkout.value?.canResume===true||retiredRetry.value)
const retryCheckout=async()=>{
 if(!retrySafe.value||busy.value||!scope.isCurrent())return
 if(!retiredRetry.value){
  busy.value=true;const version=epoch
  try{
   const result=await scope.request(`/api/account/payment-checkouts/${props.sessionId}/interface`,{method:'POST',body:{version:2,action:'open'},retry:0,timeout:10000})
   if(disposed||version!==epoch)return
   checkout.value=result.checkout;error.value=false
   if(result.payment?.experience==='embedded'&&result.payment.paymentMethods?.length===1&&result.payment.paymentMethods[0]==='apple-pay')await uiNavigateTo(`/checkout/apple/${props.sessionId}`,{external:true})
   else if(result.payment?.experience==='embedded'){activeInterface.value=result.payment;payment.value=result.payment}
   else if(result.payment)window.location.assign(hostedPaymentUrl(result.payment))
  }catch{if(!disposed&&version===epoch)error.value=true}
  finally{if(version===epoch)busy.value=false}
  return
 }
 const pending=readPendingCheckout(window.localStorage,scope.accountId)
 if(pending&&pending.body.cart_id!==checkout.value.cartId)return
 if(pending)removePendingCheckout(window.localStorage,pending)
 renewCart()
 await uiNavigateTo('/checkout')
}
let disposed=false,last=0,epoch=0,acknowledged=''
const authorizePayment=async()=>{
 const current=activeInterface.value,version=epoch
 if(!current?.interfaceToken||disposed||!scope.isCurrent())return false
 try{
  const result=await scope.request(`/api/account/payment-checkouts/${props.sessionId}/interface`,{method:'POST',body:{version:2,action:'submit',token:current.interfaceToken},retry:0,timeout:10000})
  if(disposed||version!==epoch)return false
  checkout.value=result.checkout
  return result.allowed===true
 }catch{return false}
}
const paymentComplete=()=>{payment.value=null;activeInterface.value=null;fallback.value=false;last=0;refresh()}
const cancelPayment=()=>{payment.value=null;activeInterface.value=null;fallback.value=false;uiNavigateTo('/checkout')}
const paymentUnavailable=({beforeSubmit})=>{payment.value=null;fallback.value=beforeSubmit===true&&activeInterface.value?.redirectFallback===true;error.value=true}
const hostedFallback=async()=>{
 if(busy.value||!fallback.value||!activeInterface.value?.interfaceToken)return
 busy.value=true;fallback.value=false;const version=epoch,current=activeInterface.value
 try{
  const result=await scope.request(`/api/account/payment-checkouts/${props.sessionId}/interface`,{method:'POST',body:{version:2,action:'hosted',token:current.interfaceToken},retry:0,timeout:10000})
  if(disposed||version!==epoch)return
  checkout.value=result.checkout
  if(result.allowed===true)window.location.assign(hostedPaymentUrl(current))
 }catch{if(!disposed&&version===epoch)error.value=true}
 finally{if(version===epoch)busy.value=false}
}
const refresh=async()=>{
 if(disposed||busy.value||Date.now()-last<2500)return
 last=Date.now();busy.value=true;const version=epoch
 try{
  const result=await scope.request('/api/account/payment-checkouts/'+props.sessionId,{retry:0,timeout:10000})
  if(disposed||version!==epoch)return
  checkout.value=result.checkout;error.value=false
  if(confirmed.value&&acknowledged!==result.checkout.id){
   emitMetaEvent('Purchase',{orderId:result.checkout.orderId})
   try{
    const c=result.checkout,owner='account:'+scope.accountId
    const done=await completePurchasedCart({id:c.cartId,revision:c.cartRevision,owner,items:c.cartLines||[]},c.id)
    if(done){const pending=readPendingCheckout(window.localStorage,scope.accountId);if(pending?.body.cart_id===c.cartId)removePendingCheckout(window.localStorage,pending);acknowledged=c.id}else cartNotice.value=true
   }catch{cartNotice.value=true}
  }
 }catch{if(!disposed&&version===epoch)error.value=true}
 finally{if(version===epoch)busy.value=false}
}
watch(()=>props.sessionId,()=>{epoch++;checkout.value=null;payment.value=null;activeInterface.value=null;fallback.value=false;last=0;busy.value=false;refresh()})
onMounted(refresh)
onBeforeUnmount(()=>{disposed=true;epoch++})
scope.onInvalidate(()=>{disposed=true;epoch++;checkout.value=null;payment.value=null;activeInterface.value=null;fallback.value=false;error.value=false;cartNotice.value=false;busy.value=false})
</script>
