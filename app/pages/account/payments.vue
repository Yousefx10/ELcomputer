<template>
 <div class="min-w-0 space-y-4">
  <h1 class="text-2xl font-semibold">{{ $t('paymentFirst.activity') }}</h1>
  <p class="text-sm text-slate-600 dark:text-slate-400">{{ $t('paymentFirst.activityDetail') }}</p>
  <p v-if="error" role="alert">{{ $t('paymentFirst.unavailable') }}</p>
  <p v-else-if="loading" role="status">{{ $t('common.loading') }}</p>
  <p v-else-if="!items.length">{{ $t('paymentFirst.noActivity') }}</p>
  <ul v-else class="space-y-3"><li v-for="row in items" :key="row.id" class="min-w-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
   <div class="flex flex-wrap items-center justify-between gap-2"><strong class="break-all text-sm">{{ row.orderNumber || row.reference }}</strong><span class="text-sm">{{ row.totalAmount }} {{ row.currency }}</span></div>
   <p class="mt-2 text-sm">{{ $t(row.paymentStatus==='paid' ? 'paymentFirst.confirmed' : row.method==='instapay' ? 'transfer.states.'+row.transfer?.state : 'paymentFirst.verifying') }}</p>
   <NuxtLinkLocale :to="row.method==='instapay' && !row.orderId ? `/checkout/transfer/${row.id}` : `/checkout/session/${row.id}`" class="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-blue-700 dark:text-blue-400">{{ $t('paymentFirst.details') }}</NuxtLinkLocale>
  </li></ul>
 </div>
</template>
<script setup>
definePageMeta({layout:'account',middleware:['customer-auth']})
const scope=useCustomerScope(),items=ref([]),loading=ref(true),error=ref(false)
let disposed=false
onMounted(async()=>{try{const r=await scope.request('/api/account/payment-checkouts',{retry:0,timeout:10000});if(!disposed)items.value=r.items}catch{if(!disposed)error.value=true}finally{if(!disposed)loading.value=false}})
onBeforeUnmount(()=>{disposed=true})
scope.onInvalidate(()=>{disposed=true;items.value=[];loading.value=false;error.value=false})
const {t}=useI18n();useHead(()=>({title:t('paymentFirst.activity'),meta:[{name:'robots',content:'noindex,nofollow'},{name:'referrer',content:'no-referrer'}]}))
</script>
