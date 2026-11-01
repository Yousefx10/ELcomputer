<template>
 <section class="space-y-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
  <h2 class="text-lg font-semibold">{{ $t('transfer.reviewTitle') }}</h2>
  <p v-if="error" role="alert" class="text-sm text-red-700">{{ $t('transfer.failed') }}</p>
  <button type="button" :disabled="busy" class="min-h-11 rounded-lg border px-3 text-sm" @click="load">{{ $t('paymentFirst.checkStatus') }}</button>
  <p v-if="!rows.length" class="text-sm">{{ $t('paymentFirst.noActivity') }}</p>
  <ul class="space-y-3"><li v-for="row in rows" :key="row.sessionId" class="min-w-0 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
   <div class="flex flex-wrap justify-between gap-2 text-sm"><strong class="break-all">{{ row.reference }}</strong><span>{{ row.totalAmount }} {{ row.currency }}</span></div>
   <p class="mt-1 text-sm">{{ $t('transfer.states.'+row.state) }}</p>
   <p class="mt-1 break-all text-sm">{{ row.recipient.name }} · {{ row.recipient.address }}</p>
   <p v-if="row.customerReference" class="mt-1 break-all text-sm">{{ $t('transfer.reference') }}: {{ row.customerReference }}</p>
   <button v-if="row.proofId" type="button" :disabled="busy" class="min-h-11 text-sm font-medium text-blue-700 dark:text-blue-400" @click="viewProof(row.proofId)">{{ $t('transfer.view') }}</button>
   <button v-if="row.state==='under_review'" type="button" :disabled="busy" class="min-h-11 px-3 text-sm font-medium" @click="select(row)">{{ $t('transfer.review') }}</button>
  </li></ul>
  <div v-if="proof" class="space-y-2 rounded-lg border p-3"><button type="button" class="min-h-11 text-sm" @click="closeProof">{{ $t('common.close') }}</button><iframe v-if="proof.type==='application/pdf'" :src="proof.url" sandbox class="h-96 w-full" :title="$t('transfer.receipt')" /><img v-else :src="proof.url" :alt="$t('transfer.receipt')" class="max-h-96 max-w-full object-contain" /></div>
  <form v-if="selected" class="space-y-3 border-t pt-4" @submit.prevent="review">
   <h3 class="break-all font-semibold">{{ selected.reference }}</h3>
   <label class="block text-sm">{{ $t('transfer.action') }}<select v-model="action" :disabled="busy || !!command" class="mt-1 min-h-11 w-full rounded-lg border px-2"><option value="correct">{{ $t('transfer.correct') }}</option><option value="reject">{{ $t('transfer.reject') }}</option><option v-if="canVerify" value="verify">{{ $t('transfer.verify') }}</option></select></label>
   <template v-if="action==='verify'">
    <p class="text-sm">{{ $t('transfer.bankRequired') }}</p>
    <label class="flex min-h-11 items-center gap-2 text-sm"><input v-model="credited" type="checkbox" :disabled="busy || !!command" required />{{ $t('transfer.creditChecked') }}</label>
    <label class="block text-sm">{{ $t('transfer.bankAmount') }}<input v-model="amount" inputmode="decimal" :disabled="busy || !!command" required class="mt-1 min-h-11 w-full rounded-lg border px-3" dir="ltr" /></label>
    <label class="block text-sm">{{ $t('transfer.bankRecipient') }}<input v-model="recipient" :disabled="busy || !!command" maxlength="200" required class="mt-1 min-h-11 w-full rounded-lg border px-3" dir="ltr" /></label>
    <label class="block text-sm">{{ $t('transfer.bankReference') }}<input v-model="bankReference" :disabled="busy || !!command" maxlength="120" required class="mt-1 min-h-11 w-full rounded-lg border px-3" dir="ltr" /></label>
    <label class="block text-sm">{{ $t('transfer.bankDate') }}<input v-model="receivedAt" type="datetime-local" :disabled="busy || !!command" required class="mt-1 min-h-11 w-full min-w-0 rounded-lg border px-3" /></label>
   </template>
   <label v-else class="block text-sm">{{ $t('transfer.reason') }}<textarea v-model="reason" :disabled="busy || !!command" maxlength="300" required class="mt-1 w-full rounded-lg border p-3" /></label>
   <button type="submit" :disabled="busy" class="min-h-11 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50">{{ $t('transfer.record') }}</button>
   <button type="button" :disabled="busy" class="min-h-11 px-3 text-sm" @click="selected=null;command=null">{{ $t('common.cancel') }}</button>
  </form>
 </section>
</template>
<script setup>
import {hasAdminPermission} from '~/utils/adminPermissions'
const {request}=useSupportClient(),scope=useCustomerScope(),{adminUser}=useAdminAccess(),rows=ref([]),selected=ref(null),proof=shallowRef(null),busy=ref(false),error=ref(false),action=ref('correct'),credited=ref(false),amount=ref(''),recipient=ref(''),bankReference=ref(''),receivedAt=ref(''),reason=ref(''),command=shallowRef(null)
const canVerify=computed(()=>hasAdminPermission(adminUser.value,'payments.verify'))
let disposed=false
const closeProof=()=>{if(proof.value)URL.revokeObjectURL(proof.value.url);proof.value=null}
const load=async()=>{if(busy.value||disposed)return;busy.value=true;try{const r=await request('/api/admin-transfers',{retry:0});if(!disposed){rows.value=r.items;error.value=false}}catch{if(!disposed)error.value=true}finally{if(!disposed)busy.value=false}}
const select=row=>{selected.value=row;command.value=null;action.value='correct';credited.value=false;amount.value='';recipient.value='';bankReference.value='';receivedAt.value='';reason.value=''}
const viewProof=async id=>{if(busy.value)return;busy.value=true;try{const r=await fetch('/api/admin-transfer-proofs/'+id,{headers:await scope.headers(),cache:'no-store'});scope.assertCurrent();if(!r.ok)throw Error();const blob=await r.blob();scope.assertCurrent();if(!disposed){closeProof();proof.value={url:URL.createObjectURL(blob),type:blob.type}}}catch{if(!disposed)error.value=true}finally{if(!disposed)busy.value=false}}
const review=async()=>{if(busy.value||!selected.value)return;const row=selected.value;busy.value=true;try{if(!command.value){if(action.value==='verify'&&!/^\d+(\.\d{1,2})?$/.test(amount.value))throw Error();const evidence=action.value==='verify'?{bank_credit_verified:credited.value,currency:'EGP',amount_minor:Math.round(Number(amount.value)*100),recipient:recipient.value,recipient_revision:row.settingsRevision,bank_reference:bankReference.value,bank_received_at:new Date(receivedAt.value).toISOString()}:{reason:reason.value};command.value={requestId:crypto.randomUUID(),revision:row.revision,action:action.value,evidence}}await request('/api/admin-transfers/'+row.sessionId,{method:'POST',body:command.value,retry:0,timeout:30000});if(!disposed){selected.value=null;command.value=null;error.value=false}}catch(e){if(!disposed){if([400,403,404,409,415].includes(e?.statusCode||e?.status||e?.response?.status))command.value=null;error.value=true}}finally{if(!disposed)busy.value=false}if(!selected.value)await load()}
onMounted(load);onBeforeUnmount(()=>{disposed=true;closeProof()});scope.onInvalidate(()=>{disposed=true;closeProof();rows.value=[];selected.value=null;command.value=null;amount.value='';recipient.value='';bankReference.value='';reason.value='';error.value=false;busy.value=false})
</script>
