<script setup>
definePageMeta({ layout: 'dashboard' })
const route = useUiRoute(), { t } = useI18n()
useHead(() => ({ title: t('claims.staffTitle') }))
</script>
<template><AfterSalesDetail :id="String(route.params.id)" staff /></template>
