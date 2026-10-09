<script setup>
const props=defineProps({claimId:{type:String,required:true}})
const {t}=useI18n(),{intlLocale}=useUiLocale(),client=useSupportClient()
const {hasPermission:can}=useAdminAccess()
const label=key=>t('claimCommunications.'+key),data=ref({items:[],page:1,total:0}),loading=ref(false),error=ref('')
const deliveryLabel=key=>t(`emailFoundation.${key}`)
const date=value=>value?new Intl.DateTimeFormat(intlLocale.value,{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'—'
const load=async()=>{loading.value=true;error.value='';try{data.value=await client.request(`/api/admin-after-sales/claims/${props.claimId}/communications`,{query:{page:data.value.page}})}catch{error.value=label('unavailable')}finally{loading.value=false}}
watch(()=>props.claimId,()=>{data.value.page=1;load()});onMounted(load)
</script>
<template>
 <section class="claim-communication-history min-w-0 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900" data-claim-communication-history>
  <header class="flex flex-wrap items-center justify-between gap-3"><h2 class="text-lg font-bold">{{ label('history') }}</h2><button type="button" :disabled="loading" class="min-h-10 rounded-lg border px-3 text-sm" @click="load">{{ label('refresh') }}</button></header>
  <p class="mt-2 text-xs text-slate-600 dark:text-slate-300">{{ label('historyHint') }}</p><p v-if="error" class="mt-3 text-sm text-red-700" role="alert">{{ error }}</p><p v-if="loading" role="status">{{ label('loading') }}</p><p v-else-if="!data.items.length" class="mt-3 text-sm">{{ label('empty') }}</p>
  <ul class="mt-4 space-y-3"><li v-for="item in data.items" :key="item.id" class="min-w-0 rounded-xl border border-slate-200 p-4 text-sm dark:border-slate-700">
   <p class="font-semibold">{{ label('purposes.'+item.purpose) }} · {{ item.channel==='sms'?'SMS':'Email' }}</p><p class="mt-1 break-all" dir="ltr">{{ item.recipient_masked || '—' }} · {{ item.sender || '—' }}</p>
   <dl class="mt-3 grid min-w-0 gap-2 sm:grid-cols-2"><div class="break-all">{{ label('template') }}: {{ item.template_reference || '—' }}</div><div>{{ label('preparation') }}: {{ label('states.'+item.status) }}</div><div>{{ label('submission') }}: {{ item.queue_state?label('states.'+item.queue_state):'—' }}</div><div>{{ label('attempts') }}: {{ item.attempts ?? item.preparation_attempts ?? 0 }}</div><div>{{ label('reason') }}: {{ item.reason?label('reasons.'+item.reason):item.error_category?label('providerFailure'):'—' }}</div><div>{{ date(item.occurred_at) }}</div><div v-if="item.accepted_at || item.submitted_at">{{ label('accepted') }}: {{ date(item.accepted_at || item.submitted_at) }}</div><div v-if="item.delivery_state">{{ label('delivery') }}: {{ deliveryLabel(item.delivery_state) }}</div></dl>
   <NuxtLinkLocale v-if="item.email_message_id && can('email.history.view')" to="/dashboard/email?tab=history" class="mt-2 inline-block text-blue-700 dark:text-blue-300">{{ label('emailHistory') }}</NuxtLinkLocale><NuxtLinkLocale v-if="item.sms_batch_id && can('sms.history.view')" to="/dashboard/sms?tab=history" class="mt-2 inline-block text-blue-700 dark:text-blue-300">{{ label('smsHistory') }}</NuxtLinkLocale>
  </li></ul>
  <nav v-if="data.total>25" class="mt-4 flex gap-3"><button :disabled="loading || data.page<=1" class="min-h-10 rounded-lg border px-3 text-sm" @click="data.page--;load()">{{ label('previous') }}</button><button :disabled="loading || data.page*25>=data.total" class="min-h-10 rounded-lg border px-3 text-sm" @click="data.page++;load()">{{ label('next') }}</button></nav>
 </section>
</template>

<style>
.claim-communication-history { background: var(--surface); border-color: var(--border); color: var(--text-primary); }
.claim-communication-history li { border-color: var(--border); }
.claim-communication-history .text-slate-600 { color: var(--text-secondary); }
.claim-communication-history a { color: var(--brand-text); }
</style>
