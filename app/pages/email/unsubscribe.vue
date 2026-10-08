<template><main class="mx-auto my-12 max-w-lg rounded-xl border bg-white p-6 text-gray-900 dark:bg-gray-900 dark:text-gray-100"><h1 class="text-xl font-semibold">{{ t('emailFoundation.unsubscribeTitle') }}</h1><p class="my-4">{{ t('emailFoundation.unsubscribeHint') }}</p><p v-if="notice" role="status">{{ notice }}</p><button v-else class="rounded-lg bg-gray-900 px-4 py-3 text-white dark:bg-gray-100 dark:text-gray-900 disabled:opacity-50" :disabled="busy || !token" @click="unsubscribe">{{ t('emailFoundation.unsubscribeAction') }}</button></main></template>
<script setup>
definePageMeta({layout:false})
const {t}=useI18n(),token=ref(''),busy=ref(false),notice=ref('')
useHead({meta:[{name:'robots',content:'noindex, nofollow'},{name:'referrer',content:'no-referrer'}]})
onMounted(()=>{const hash=window.location.hash.slice(1);if(/^[A-Za-z0-9_-]{43}$/.test(hash))token.value=hash;else notice.value=t('emailFoundation.unsubscribeUnavailable');window.history.replaceState(null,'',window.location.pathname)})
const unsubscribe=async()=>{busy.value=true;try{await $fetch('/api/email/unsubscribe',{method:'POST',body:{token:token.value}});notice.value=t('emailFoundation.unsubscribeDone')}catch{notice.value=t('emailFoundation.unsubscribeUnavailable')}finally{busy.value=false;token.value=''}}
</script>
