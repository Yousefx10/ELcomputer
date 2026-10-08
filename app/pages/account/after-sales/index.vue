<script setup>
definePageMeta({ layout: 'account', middleware: 'customer-auth' })
const { t } = useI18n()
useHead(() => ({ title: t('claims.title') }))
</script>
<template><AfterSalesCenter /></template>
