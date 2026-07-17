<template>
  <div class="">
    <div class="mx-auto max-w-6xl space-y-6">
      <div class="rounded-2xl bg-white p-6 shadow">
        <h2 class="text-4xl font-bold">Commerce</h2>
        <p class="mt-2 text-sm text-gray-500">
          Manage procurement, shipping companies, warehouses, and returned orders.
        </p>
      </div>

      <DashboardSecondaryNav :items="secondaryNavItems" />

      <DashboardCommerceProcurementTab v-if="activeTab === 'procurement'" />
      <DashboardCommerceSalesTab v-else-if="activeTab === 'sales'" />
      <DashboardCommerceShippingTab v-else-if="activeTab === 'shipping'" />
      <DashboardCommerceWarehousesTab v-else-if="activeTab === 'warehouses'" />
      <DashboardCommerceReturnsTab v-else />
    </div>
  </div>
</template>

<script setup>
import { commerceTabs } from '~/utils/commerce'

definePageMeta({
  layout: 'dashboard'
})

const route = useRoute()

const validTabKeys = new Set(commerceTabs.map((tab) => tab.key))

const activeTab = computed(() => {
  const tab = String(route.query.tab || '').trim().toLowerCase()
  return validTabKeys.has(tab) ? tab : 'procurement'
})

const secondaryNavItems = computed(() => {
  return commerceTabs.map((tab) => ({
    label: tab.label,
    to: tab.to,
    active: activeTab.value === tab.key
  }))
})
</script>
