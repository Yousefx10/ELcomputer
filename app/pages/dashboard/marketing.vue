<template>
 <main class="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
  <h1 class="text-xl font-semibold">{{ $t('metaTracking.title') }}</h1>
  <p v-if="error" role="alert" class="text-sm text-red-700">{{ $t('metaTracking.failed') }}</p>
  <p v-if="!config && !error" role="status" class="text-sm">{{ $t('common.loading') }}</p>
  <form v-if="config" class="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-700" @submit.prevent="save">
   <fieldset :disabled="busy || !canEdit" class="space-y-3">
    <label class="flex min-h-11 items-center gap-2 text-sm"><input v-model="config.enabled" type="checkbox">{{ $t('metaTracking.enabled') }}</label>
    <label class="block text-sm">{{ $t('metaTracking.pixelId') }}<input v-model="config.pixelId" maxlength="30" inputmode="numeric" pattern="[0-9]{5,30}" class="mt-1 min-h-11 w-full rounded-lg border px-3"></label>
    <label class="flex min-h-11 items-center gap-2 text-sm"><input v-model="config.capiEnabled" type="checkbox">{{ $t('metaTracking.capiEnabled') }}</label>
    <label class="block text-sm">{{ $t('metaTracking.token') }}<input v-model="token" type="password" autocomplete="new-password" maxlength="4096" class="mt-1 min-h-11 w-full rounded-lg border px-3"><span class="mt-1 block text-xs">{{ $t(config.tokenSet?'metaTracking.tokenSaved':'metaTracking.tokenEmpty') }}</span></label>
    <label class="flex min-h-11 items-center gap-2 text-sm"><input v-model="clearToken" type="checkbox">{{ $t('metaTracking.clearToken') }}</label>
    <div class="grid gap-3 sm:grid-cols-2"><label class="block text-sm">{{ $t('metaTracking.version') }}<input v-model="config.graphVersion" pattern="v[0-9]{2,3}\.0" class="mt-1 min-h-11 w-full rounded-lg border px-3"></label><label class="block text-sm">{{ $t('metaTracking.testCode') }}<input v-model="config.testEventCode" maxlength="100" class="mt-1 min-h-11 w-full rounded-lg border px-3"></label></div>
    <div v-if="config.testEventCode" class="grid gap-3 sm:grid-cols-3"><label class="block text-sm">{{ $t('metaTracking.testCustomer') }}<input v-model="config.testCustomerId" class="mt-1 min-h-11 w-full rounded-lg border px-3" maxlength="36"></label><label class="block text-sm">{{ $t('metaTracking.testMinutes') }}<input v-model.number="config.testWindowMinutes" type="number" min="1" max="30" class="mt-1 min-h-11 w-full rounded-lg border px-3"></label><label class="block text-sm">{{ $t('metaTracking.testLimit') }}<input v-model.number="config.testEventLimit" type="number" min="1" max="20" class="mt-1 min-h-11 w-full rounded-lg border px-3"></label></div>
    <p class="text-sm">{{ $t('metaTracking.purchaseRule') }}</p>
    <button type="submit" class="min-h-11 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white">{{ $t('common.save') }}</button>
   </fieldset>
   <p v-if="saved" role="status" class="text-sm">{{ $t('metaTracking.saved') }}</p>
  </form>
  <section v-if="diagnostics" class="rounded-lg border border-slate-200 p-4 dark:border-slate-700"><h2 class="font-semibold">{{ $t('metaTracking.diagnostics') }}</h2><p class="mt-2 text-sm">{{ $t('metaTracking.diagnosticsDetail') }}</p><div class="mt-3 overflow-x-auto"><table class="w-full text-start text-sm"><thead><tr><th class="p-2 text-start">{{ $t('metaTracking.event') }}</th><th class="p-2 text-start">{{ $t('metaTracking.status') }}</th><th class="p-2 text-start">{{ $t('metaTracking.attempts') }}</th></tr></thead><tbody><tr v-for="(row,index) in diagnostics.recent" :key="index" class="border-t"><td class="p-2">{{ row.event_name }}</td><td class="p-2">{{ $t('metaTracking.states.'+row.state) }}</td><td class="p-2">{{ row.attempts }}</td></tr></tbody></table><p v-if="!diagnostics.recent.length" class="text-sm">{{ $t('metaTracking.noEvents') }}</p></div></section>
 </main>
</template>
<script setup>
import {hasAdminPermission} from '~/utils/adminPermissions'
definePageMeta({layout:'dashboard'})
const {request}=useSupportClient(),{adminUser}=useAdminAccess(),scope=useCustomerScope(),config=ref(null),diagnostics=ref(null),error=ref(false),busy=ref(false),saved=ref(false),token=ref(''),clearToken=ref(false)
const canEdit=computed(()=>hasAdminPermission(adminUser.value,'settings.edit'))
let disposed=false
const load=async()=>{try{const r=await request('/api/admin-marketing/settings',{retry:0});if(!disposed){config.value=r.settings;diagnostics.value=r.diagnostics}}catch{if(!disposed)error.value=true}}
const save=async()=>{if(busy.value||!canEdit.value)return;busy.value=true;saved.value=false;error.value=false;try{const {enabled,capiEnabled,pixelId,graphVersion,testEventCode,testCustomerId,testWindowMinutes,testEventLimit,revision}=config.value,r=await request('/api/admin-marketing/settings',{method:'PATCH',body:{revision,config:{enabled,capiEnabled,pixelId,graphVersion,testEventCode,testCustomerId,testWindowMinutes,testEventLimit},...(token.value?{token:token.value}:{}),clearToken:clearToken.value},retry:0});if(!disposed){config.value=r;token.value='';clearToken.value=false;saved.value=true}}catch{if(!disposed)error.value=true}finally{if(!disposed)busy.value=false}}
scope.onInvalidate(()=>{disposed=true;token.value='';config.value=null;diagnostics.value=null;error.value=false;busy.value=false})
onMounted(load);onBeforeUnmount(()=>{disposed=true;token.value='';config.value=null})
</script>
