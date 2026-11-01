<template>
 <main class="store-container mx-auto max-w-3xl space-y-4 py-6">
  <h1 class="text-2xl font-semibold">{{ $t('transfer.title') }}</h1>
  <p v-if="error" role="alert" class="text-sm text-red-700">{{ $t('transfer.failed') }}</p>
  <p v-if="!checkout" role="status">{{ $t('common.loading') }}</p>
  <PaymentCheckoutStatus v-else-if="checkout.paymentStatus==='paid'" :session-id="id" />
  <section v-else-if="checkout.transfer" class="min-w-0 space-y-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 sm:p-6">
   <p class="break-all text-sm">{{ checkout.transfer.reference }}</p>
   <h2 class="text-lg font-semibold">{{ $t('transfer.states.'+checkout.transfer.state) }}</h2>
   <p class="text-sm">{{ $t('transfer.notPaid') }}</p>
   <dl class="grid min-w-0 gap-3 sm:grid-cols-2">
    <div><dt class="text-sm text-slate-600 dark:text-slate-400">{{ $t('paymentFirst.amount') }}</dt><dd class="font-semibold" dir="ltr">{{ checkout.totalAmount }} {{ checkout.currency }}</dd></div>
    <div><dt class="text-sm text-slate-600 dark:text-slate-400">{{ $t('transfer.recipient') }}</dt><dd class="break-words">{{ checkout.transfer.recipient.name }}</dd><dd class="break-all" dir="ltr">{{ checkout.transfer.recipient.address }}</dd></div>
   </dl>
   <p class="whitespace-pre-wrap break-words text-sm">{{ checkout.transfer.recipient[locale==='ar'?'instructions_ar':'instructions_en'] }}</p>
   <p v-if="checkout.transfer.reason" class="break-words text-sm" role="status">{{ checkout.transfer.reason }}</p>
   <form v-if="canUpload" class="space-y-3" @submit.prevent="submit">
    <label class="block text-sm font-medium">{{ $t('transfer.receipt') }}<input type="file" :accept="checkout.transfer.recipient.mime_types.join(',')" :disabled="busy" class="mt-1 block w-full text-sm" @change="choose" /></label>
    <p class="text-xs text-slate-600 dark:text-slate-400">{{ $t('transfer.fileLimit',{mb:Math.floor(checkout.transfer.recipient.max_bytes/1048576)}) }}</p>
    <label class="block text-sm font-medium">{{ $t('transfer.reference') }}<input v-model="reference" maxlength="120" :disabled="busy || !!submitted" class="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3" /></label>
    <button type="submit" :disabled="busy||!file" class="min-h-11 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50">{{ $t(busy?'common.loading':submitted?'transfer.retrySubmission':'transfer.submit') }}</button>
   </form>
   <div class="flex flex-wrap gap-3">
    <button type="button" :disabled="busy" class="min-h-11 rounded-lg border px-3 text-sm" @click="load">{{ $t('paymentFirst.checkStatus') }}</button>
    <button v-if="checkout.transfer.proofId" type="button" class="min-h-11 px-3 text-sm text-blue-700 dark:text-blue-400" @click="downloadFrom('/api/account/transfer-proofs/'+checkout.transfer.proofId,'receipt')">{{ $t('transfer.download') }}</button>
    <NuxtLinkLocale to="/account/payments" class="inline-flex min-h-11 items-center text-sm text-blue-700 dark:text-blue-400">{{ $t('paymentFirst.activity') }}</NuxtLinkLocale>
   </div>
  </section>
 </main>
</template>
<script setup>
definePageMeta({middleware:['customer-auth'],key:route=>route.fullPath})
const route=useRoute(),id=String(route.params.id||''),scope=useCustomerScope(),{downloadFrom}=useSupportClient(),{t,locale}=useI18n()
if(!/^[0-9a-f-]{36}$/i.test(id))throw createError({statusCode:404,statusMessage:'Transfer not found.'})
const checkout=ref(null),error=ref(false),busy=ref(false),file=shallowRef(null),reference=ref(''),submitted=shallowRef(null)
let disposed=false
const canUpload=computed(()=>['awaiting_proof','correction_requested','rejected'].includes(checkout.value?.transfer?.state))
const load=async()=>{if(busy.value||disposed)return;busy.value=true;try{const r=await scope.request('/api/account/payment-checkouts/'+id,{retry:0,timeout:10000});if(!disposed){checkout.value=r.checkout;error.value=false}}catch{if(!disposed)error.value=true}finally{if(!disposed)busy.value=false}}
const choose=event=>{file.value=event.target.files?.[0]||null;submitted.value=null;error.value=!!file.value&&(file.value.size>checkout.value.transfer.recipient.max_bytes||!checkout.value.transfer.recipient.mime_types.includes(file.value.type));if(error.value)file.value=null}
const submit=async()=>{if(busy.value||!file.value||!canUpload.value||disposed)return;submitted.value ||= {id:crypto.randomUUID(),revision:checkout.value.transfer.revision,reference:reference.value};const command=submitted.value,form=new FormData();form.append('file',file.value);form.append('revision',String(command.revision));form.append('requestId',command.id);form.append('reference',command.reference);busy.value=true;try{const r=await scope.request('/api/account/payment-checkouts/'+id+'/proof',{method:'POST',body:form,retry:0,timeout:30000});if(!disposed){checkout.value=r.checkout;file.value=null;submitted.value=null;error.value=false}}catch{if(!disposed)error.value=true}finally{if(!disposed)busy.value=false}}
onMounted(load);onBeforeUnmount(()=>{disposed=true;file.value=null;submitted.value=null});scope.onInvalidate(()=>{disposed=true;checkout.value=null;file.value=null;reference.value='';submitted.value=null;error.value=false;busy.value=false})
useHead(()=>({title:t('transfer.title'),meta:[{name:'robots',content:'noindex,nofollow'},{name:'referrer',content:'no-referrer'}]}))
</script>
