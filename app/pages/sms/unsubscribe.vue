<script setup>
const {t}=useI18n(),token=ref(''),done=ref(false),failed=ref(false),busy=ref(false)
useHead({meta:[{name:'robots',content:'noindex, nofollow'},{name:'referrer',content:'no-referrer'}]})
onMounted(()=>{token.value=window.location.hash.slice(1);window.history.replaceState(null,'',window.location.pathname)})
const submit=async()=>{if(busy.value)return;busy.value=true;failed.value=false;try{await $fetch('/api/sms/unsubscribe',{method:'POST',retry:0,body:{token:token.value}});done.value=true;token.value=''}catch{failed.value=true}finally{busy.value=false}}
onBeforeUnmount(()=>{token.value=''})
</script>
<template><main class="mx-auto max-w-lg space-y-4 px-4 py-10"><h1 class="text-xl font-semibold">{{ t('smsMarketing.unsubscribeTitle') }}</h1><p v-if="done" role="status">{{ t('smsMarketing.unsubscribed') }}</p><template v-else><p>{{ t('smsMarketing.unsubscribeHelp') }}</p><p v-if="failed" role="alert">{{ t('smsMarketing.failed') }}</p><button :disabled="busy||!token" class="min-h-11 rounded-lg border px-4" @click="submit">{{ t('smsMarketing.unsubscribe') }}</button></template></main></template>
