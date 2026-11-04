<script setup>
import {hasAdminPermission} from '~/utils/adminPermissions'
const {request}=useSupportClient(),{adminUser}=useAdminAccess(),scope=useCustomerScope(),data=ref(null),templates=ref([]),enabled=ref(false),bindings=ref([]),failed=ref(false),busy=ref(false)
let generation=0
const canView=computed(()=>hasAdminPermission(adminUser.value,'sms.settings.view')),canManage=computed(()=>hasAdminPermission(adminUser.value,'sms.settings.manage'))
const load=async()=>{if(!canView.value)return;const v=generation;try{const r=await request('/api/admin-sms/transactional',{retry:0}),t=hasAdminPermission(adminUser.value,'sms.templates.view')?await request('/api/admin-sms/templates',{retry:0}):{templates:[]};scope.assertCurrent();if(v!==generation)return;data.value=r;enabled.value=r.settings.controls.transactional_enabled;bindings.value=r.settings.bindings;templates.value=t.templates.filter(x=>x.traffic_type==='notification')}catch{if(v===generation)failed.value=true}}
const save=async()=>{if(!canManage.value||busy.value)return;const v=generation;busy.value=true;failed.value=false;try{await request('/api/admin-sms/transactional',{method:'PATCH',retry:0,body:{revision:data.value.settings.controls.revision,enabled:enabled.value,bindings:bindings.value}});scope.assertCurrent();if(v===generation)await load()}catch{if(v===generation)failed.value=true}finally{if(v===generation)busy.value=false}}
scope.onInvalidate(()=>{generation++;data.value=null;templates.value=[];bindings.value=[];failed.value=false;busy.value=false});onMounted(load)
</script>
<template>
 <section v-if="canView" class="space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
  <h2 class="font-semibold">{{ $t('smsTransactional.title') }}</h2><p class="text-sm">{{ $t('smsTransactional.scope') }}</p>
  <p v-if="failed" role="alert" class="text-sm text-red-700">{{ $t('smsTransactional.failed') }}</p>
  <form v-if="data" class="space-y-3" @submit.prevent="save"><fieldset :disabled="!canManage||busy" class="space-y-3">
   <label class="flex items-center gap-2 text-sm"><input v-model="enabled" type="checkbox">{{ $t('smsTransactional.enabled') }}</label><p class="text-sm">{{ $t(data.runtimeEnabled?'smsTransactional.runtimeOn':'smsTransactional.runtimeOff') }}</p>
   <div class="overflow-x-auto"><table class="w-full text-start text-sm"><thead><tr><th class="p-2 text-start">{{ $t('smsTransactional.event') }}</th><th class="p-2 text-start">{{ $t('smsTransactional.template') }}</th><th class="p-2 text-start">{{ $t('smsTransactional.enabled') }}</th></tr></thead><tbody><tr v-for="binding in bindings" :key="binding.event_type" class="border-t"><td class="p-2">{{ $t('smsTransactional.'+binding.event_type) }}</td><td class="p-2"><select v-model="binding.template_id" class="min-h-11 rounded-lg border px-2"><option :value="null">—</option><option v-for="t in templates" :key="t.id" :value="t.id">{{ t.name }} ({{ t.revision }})</option></select></td><td class="p-2"><input v-model="binding.is_enabled" type="checkbox" :disabled="binding.event_type==='invoice_available'&&!data.settings.invoice_source_available"></td></tr></tbody></table></div>
   <p class="text-sm">{{ $t('smsTransactional.pdc') }}</p><p class="text-sm">{{ $t('smsTransactional.submission') }}</p><button class="min-h-11 rounded-lg border px-3 text-sm">{{ $t('smsTransactional.save') }}</button>
  </fieldset></form>
 </section>
</template>
