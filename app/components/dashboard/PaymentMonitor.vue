<template>
 <section class="mb-4 rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100" :aria-label="t('title')">
  <div class="flex flex-wrap items-center gap-3">
   <h2 class="font-semibold">{{ t('title') }}</h2>
   <span :class="status==='CRITICAL'?'text-red-700 dark:text-red-300':status==='WARNING'?'text-amber-800 dark:text-amber-300':status==='HEALTHY'?'text-green-800 dark:text-green-300':'text-gray-500 dark:text-gray-400'" role="status">{{ t(status) }}</span>
   <button type="button" class="ms-auto rounded border px-2 py-1 disabled:opacity-50" :disabled="busy" @click="load">{{ t('refresh') }}</button>
  </div>
  <p v-if="failed" class="mt-2 text-red-700 dark:text-red-300" role="alert">{{ t('loadFailed') }}</p>
  <p v-else-if="snapshot && !snapshot.available" class="mt-2">{{ t(snapshot.reason==='not_configured'?'notConfigured':'unavailable') }}</p>
  <template v-if="snapshot?.available">
   <dl class="mt-2 flex flex-wrap gap-x-5 gap-y-1">
    <div><dt class="inline text-gray-500 dark:text-gray-400">{{ t('lastCheck') }}: </dt><dd class="inline">{{ formatTime(snapshot.lastSuccessfulCheck) }}</dd></div>
    <div><dt class="inline text-gray-500 dark:text-gray-400">{{ t('newPaid') }}: </dt><dd class="inline">{{ snapshot.newPaidOrderCount }}</dd></div>
    <div><dt class="inline text-gray-500 dark:text-gray-400">{{ t('staffOrders') }}: </dt><dd class="inline">{{ snapshot.staffAttentionCount }}</dd></div>
    <div><dt class="inline text-gray-500 dark:text-gray-400">{{ t('exceptions') }}: </dt><dd class="inline">{{ snapshot.exceptionCount }}</dd></div>
   </dl>
   <p v-if="stale" class="mt-2 text-amber-800 dark:text-amber-300" role="alert">{{ t('stale') }}</p>
   <p v-if="!snapshot.complete" class="mt-2">{{ t('lastKnown') }}</p>
   <details v-if="snapshot.exceptions.length || snapshot.staffAttention.length" class="mt-2">
    <summary class="cursor-pointer font-medium">{{ t('viewAlerts') }}</summary>
    <ul class="mt-2 space-y-1">
     <li v-for="issue in snapshot.exceptions" :key="issue.id"><span v-if="issue.order" dir="ltr">{{ issue.order }} — </span>{{ t('codes.'+issue.code) }}<span v-if="issue.providerEvidence==='UNVERIFIED'"> · {{ t('unverified') }}</span></li>
     <li v-for="order in snapshot.staffAttention" :key="order.id"><span dir="ltr">{{ order.order }}</span> — {{ t('needsStaff') }}</li>
    </ul>
    <p v-if="snapshot.displayLimited" class="mt-2">{{ t('limited') }}</p>
    <NuxtLinkLocale to="/dashboard/orders" class="mt-2 inline-block font-medium text-blue-700 dark:text-blue-300">{{ t('viewOrders') }}</NuxtLinkLocale>
   </details>
   <p v-if="!snapshot.emailEnabled" class="mt-2 text-xs text-gray-500 dark:text-gray-400">{{ t('emailOptional') }}</p>
  </template>
 </section>
</template>

<script setup>
const {t:translate}=useI18n(),{intlLocale}=useUiLocale(),scope=useCustomerScope()
const t=key=>translate('paymentMonitor.'+key)
const snapshot=ref(null),busy=ref(false),failed=ref(false),now=ref(Date.now())
let timer,lastRequest=0,stopped=false
const stale=computed(()=>{
 const last=Date.parse(snapshot.value?.lastSuccessfulCheck)
 return snapshot.value?.stale||!Number.isFinite(last)||now.value-last>900000||last-now.value>60000
})
const status=computed(()=>{
 if(!snapshot.value&&!failed.value)return 'CHECKING'
 if(snapshot.value?.status==='CRITICAL')return 'CRITICAL'
 return failed.value||!snapshot.value?.available||stale.value?'WARNING':snapshot.value.status
})
const formatTime=value=>value?new Intl.DateTimeFormat(intlLocale.value,{dateStyle:'short',timeStyle:'medium'}).format(new Date(value)):t('never')
const load=async()=>{
 if(busy.value||stopped||!scope.isCurrent())return
 busy.value=true;lastRequest=Date.now()
 try{const result=await scope.request('/api/admin-dashboard/payment-monitor',{cache:'no-store',timeout:10000});scope.assertCurrent();snapshot.value=result.monitor;failed.value=false}
 catch{if(scope.isCurrent())failed.value=true}
 finally{busy.value=false;now.value=Date.now()}
}
const visible=()=>{now.value=Date.now();if(document.visibilityState==='visible'&&Date.now()-lastRequest>=30000)load()}
scope.onInvalidate(()=>{stopped=true;snapshot.value=null;failed.value=false;clearInterval(timer)})
onMounted(()=>{load();timer=setInterval(()=>{now.value=Date.now();if(document.visibilityState==='visible')load()},60000);document.addEventListener('visibilitychange',visible)})
onBeforeUnmount(()=>{stopped=true;clearInterval(timer);document.removeEventListener('visibilitychange',visible)})
</script>
