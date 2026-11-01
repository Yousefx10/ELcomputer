<template>
 <section class="space-y-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
  <h2 class="text-lg font-semibold">{{ $t('transfer.settings') }}</h2>
  <p class="text-sm">{{ $t('transfer.activationSeparate') }}</p>
  <p v-if="error" role="alert" class="text-sm text-red-700">{{ $t('transfer.failed') }}</p>
  <form v-if="config" class="space-y-3" @submit.prevent="save">
   <label class="flex min-h-11 items-center gap-2 text-sm"><input v-model="config.enabled" type="checkbox" :disabled="busy" />{{ $t('transfer.enabled') }}</label>
   <div class="grid gap-3 sm:grid-cols-2"><label class="block text-sm">{{ $t('transfer.recipient') }}<input v-model="config.recipient_name" maxlength="120" :disabled="busy" class="mt-1 min-h-11 w-full rounded-lg border px-3" /></label><label class="block text-sm">{{ $t('transfer.address') }}<input v-model="config.recipient_address" maxlength="200" :disabled="busy" class="mt-1 min-h-11 w-full rounded-lg border px-3" dir="ltr" /></label></div>
   <label class="flex min-h-11 items-center gap-2 text-sm"><input v-model="config.recipient_verified" type="checkbox" :disabled="busy" />{{ $t('transfer.recipientVerified') }}</label>
   <label v-for="lang in ['en','ar']" :key="lang" class="block text-sm">{{ $t('transfer.instructions') }} ({{ lang.toUpperCase() }})<textarea v-model="config['instructions_'+lang]" :dir="lang==='ar'?'rtl':'ltr'" :disabled="busy" maxlength="2000" class="mt-1 w-full rounded-lg border p-3" /></label>
   <fieldset class="flex flex-wrap gap-3"><legend class="text-sm">{{ $t('transfer.types') }}</legend><label v-for="type in ['image/jpeg','image/png','application/pdf']" :key="type" class="flex min-h-11 items-center gap-2 text-sm"><input v-model="config.mime_types" type="checkbox" :value="type" :disabled="busy" />{{ type }}</label></fieldset>
   <div class="grid gap-3 sm:grid-cols-2"><label class="block text-sm">{{ $t('transfer.maxBytes') }}<input v-model.number="config.max_bytes" type="number" min="1024" max="5242880" step="1" required :disabled="busy" class="mt-1 min-h-11 w-full rounded-lg border px-3" /></label><label class="block text-sm">{{ $t('transfer.maxProofs') }}<input v-model.number="config.max_proofs" type="number" min="1" max="5" step="1" required :disabled="busy" class="mt-1 min-h-11 w-full rounded-lg border px-3" /></label></div>
   <button type="submit" :disabled="busy" class="min-h-11 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50">{{ $t('common.save') }}</button>
   <p v-if="saved" role="status" class="text-sm">{{ $t('transfer.saved') }}</p>
  </form>
 </section>
</template>
<script setup>
const {request}=useSupportClient(),scope=useCustomerScope(),config=ref(null),revision=ref(0),error=ref(false),busy=ref(false),saved=ref(false)
const fields=['enabled','recipient_name','recipient_address','recipient_verified','instructions_en','instructions_ar','mime_types','max_bytes','max_proofs']
let disposed=false
const accept=r=>{revision.value=r.revision;config.value=Object.fromEntries(fields.map(k=>[k,r[k]]))}
onMounted(async()=>{try{const r=await request('/api/admin-transfers/settings',{retry:0});if(!disposed)accept(r)}catch{if(!disposed)error.value=true}})
const save=async()=>{if(busy.value)return;busy.value=true;saved.value=false;try{const r=await request('/api/admin-transfers/settings',{method:'PATCH',body:{revision:revision.value,config:config.value},retry:0});if(!disposed){accept(r);saved.value=true;error.value=false}}catch{if(!disposed)error.value=true}finally{if(!disposed)busy.value=false}}
onBeforeUnmount(()=>{disposed=true});scope.onInvalidate(()=>{disposed=true;config.value=null;error.value=false;saved.value=false;busy.value=false})
</script>
