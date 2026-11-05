<template>
 <section class="mx-auto max-w-6xl space-y-4 p-4">
  <h1 class="text-2xl font-semibold">{{ $t('paymentFirst.activity') }}</h1>
  <p class="text-sm text-slate-600 dark:text-slate-400">{{ $t('paymentFirst.staffDetail') }}</p>
  <p v-if="monitor" class="text-sm" role="status">{{ $t('paymentFirst.monitor',{pending:monitor.verified_order_pending,extra:monitor.additional_verified_payments,callbacks:monitor.unprocessed_callbacks}) }}</p>
  <section v-if="canConfigure" class="rounded-lg border p-4"><h2 class="font-semibold">{{ $t('paymentFirst.methodsTitle') }}</h2><p class="mt-1 text-sm">{{ $t('paymentFirst.methodsDetail') }}</p><ul class="mt-2 space-y-2 text-sm"><li v-for="method in methods" :key="method.method">{{ $t('paymentFirst.methods.'+method.method) }} · {{ $t(method.implemented ? method.configured?'paymentFirst.configured':'paymentFirst.notConfigured':'paymentFirst.qualificationPending') }}</li></ul><NuxtLink to="/dashboard/settings" class="mt-2 inline-flex min-h-11 items-center text-sm text-blue-700">{{ $t('paymentFirst.existingSettings') }}</NuxtLink></section>
  <section v-if="canConfigure && readiness" class="rounded-lg border p-4 space-y-2">
   <h2 class="font-semibold">{{ $t('merchantRetry.title') }}</h2>
   <p class="text-sm">{{ $t('merchantRetry.detail') }}</p>
   <label class="inline-flex min-h-11 items-center gap-2 text-sm"><input v-model="riskRetry" type="checkbox" :disabled="policySaving" />{{ $t('merchantRetry.enabled') }}</label>
   <button type="button" :disabled="policySaving || riskRetry===readiness.merchantRiskRetries" class="min-h-11 rounded border px-3 text-sm disabled:opacity-50" @click="saveRetryPolicy">{{ $t('merchantRetry.save') }}</button>
  </section>
  <p v-if="error" role="alert" class="text-sm text-red-700">{{ $t('paymentFirst.unavailable') }}</p>
  <p v-if="loading" role="status">{{ $t('paymentFirst.loading') }}</p>
  <div v-else class="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
   <table class="w-full text-start text-sm"><thead><tr class="border-b"><th class="p-3 text-start">{{ $t('paymentFirst.reference') }}</th><th class="p-3 text-start">{{ $t('paymentFirst.state') }}</th><th class="p-3 text-start">{{ $t('paymentFirst.amount') }}</th><th class="p-3 text-start">{{ $t('paymentFirst.details') }}</th></tr></thead>
    <tbody><tr v-for="row in rows" :key="row.id" class="border-b last:border-0"><td class="p-3">{{ row.reference }}</td><td class="p-3">{{ $t('paymentFirst.states.'+row.state) }}</td><td class="p-3">{{ row.totalAmount }} {{ row.currency }}</td><td class="p-3"><NuxtLink v-if="row.orderId" :to="'/dashboard/orders?order='+row.orderId" class="font-semibold text-blue-700 dark:text-blue-400">{{ $t('paymob.viewOrder') }}</NuxtLink><span v-else>{{ $t('paymentFirst.noOrder') }}</span><p v-if="row.reviewReason==='additional_verified_payment'" class="text-sm text-amber-700 dark:text-amber-300">{{ $t('merchantRetry.excess') }}</p></td></tr></tbody>
   </table>
  </div>
  <PaymentTransferAdmin v-if="manualInstalled && canReview" />
  <PaymentTransferSettings v-if="manualInstalled && canConfigure" />
 </section>
</template>
<script setup>
import {hasAdminPermission} from '~/utils/adminPermissions'
const {adminUser}=useAdminAccess(),canReview=computed(()=>hasAdminPermission(adminUser.value,'payments.review')),canConfigure=computed(()=>hasAdminPermission(adminUser.value,'payments.configure'))
definePageMeta({layout:'dashboard'})
const scope=useCustomerScope(),monitor=ref(null),methods=ref([]),readiness=ref(null),riskRetry=ref(false),policySaving=ref(false)
let disposed=false
const {request}=useSupportClient(),rows=ref([]),loading=ref(true),error=ref(false),manualInstalled=ref(false)
onMounted(async()=>{try{const r=await request('/api/admin-payment-checkouts');if(disposed)return;rows.value=r.items;monitor.value=r.monitor;readiness.value=r.readiness;riskRetry.value=r.readiness?.merchantRiskRetries===true;manualInstalled.value=r.readiness?.manual?.installed===true;if(canConfigure.value){const m=await request('/api/admin-payment-checkouts/methods',{retry:0});if(!disposed)methods.value=m.methods}}catch{error.value=true}finally{loading.value=false}})
const saveRetryPolicy=async()=>{if(policySaving.value||!readiness.value)return;policySaving.value=true;try{const r=await request('/api/admin-payment-checkouts/retry-policy',{method:'PATCH',body:{revision:readiness.value.revision,enabled:riskRetry.value},retry:0});if(!disposed){readiness.value=r;riskRetry.value=r.merchantRiskRetries===true;error.value=false}}catch{if(!disposed)error.value=true}finally{policySaving.value=false}}
onBeforeUnmount(()=>{disposed=true});scope.onInvalidate(()=>{disposed=true;rows.value=[];monitor.value=null;methods.value=[];manualInstalled.value=false;error.value=false;loading.value=false})
const {t}=useI18n();useHead(()=>({title:t('paymentFirst.activity'),meta:[{name:'robots',content:'noindex,nofollow'}]}))
</script>
