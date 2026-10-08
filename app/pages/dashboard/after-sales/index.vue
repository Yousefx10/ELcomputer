<script setup>
definePageMeta({ layout: 'dashboard' })
const { t } = useI18n()
useHead(() => ({ title: t('claims.staffTitle') }))
</script>
<template><AfterSalesCenter staff /></template>
