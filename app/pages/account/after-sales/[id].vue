<script setup>
definePageMeta({ layout: 'account', middleware: 'customer-auth' })
const route = useUiRoute(), { t } = useI18n()
useHead(() => ({ title: t('claims.title') }))
</script>
<template><AfterSalesDetail :id="String(route.params.id)" /></template>
