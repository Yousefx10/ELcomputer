<script setup>
definePageMeta({ layout: 'dashboard' })
const { t } = useI18n()
const route=useUiRoute(),{hasPermission:can}=useAdminAccess()
useHead(() => ({ title: t('claims.staffTitle') }))
</script>
<template><div class="space-y-5"><nav v-if="can('claims.communications.view')" class="flex flex-wrap gap-3"><NuxtLinkLocale to="/dashboard/after-sales" class="rounded-lg border px-4 py-2 text-sm">{{ t('claims.allClaims') }}</NuxtLinkLocale><NuxtLinkLocale to="/dashboard/after-sales?tab=communications" class="rounded-lg border px-4 py-2 text-sm">{{ t('claimCommunications.title') }}</NuxtLinkLocale></nav><AfterSalesCommunicationSettings v-if="route.query.tab==='communications' && can('claims.communications.view')" /><AfterSalesCenter v-else staff /></div></template>
