<template><main class="store-container mx-auto max-w-3xl py-8"><PaymentApplePay :session-id="id" /></main></template>
<script setup>
definePageMeta({middleware:['customer-auth'],key:route=>route.fullPath})
const route=useRoute(),id=String(route.params.id||'')
if(!/^[0-9a-f-]{36}$/i.test(id))throw createError({statusCode:404,statusMessage:'Checkout not found.'})
const {t}=useI18n()
useHead(()=>({title:t('applePayment.title'),meta:[{name:'referrer',content:'no-referrer'},{name:'robots',content:'noindex, nofollow'}]}))
</script>
