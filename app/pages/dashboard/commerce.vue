<template>
  <div class="">
    <div class="mx-auto max-w-6xl space-y-6">
      <div class="rounded-2xl bg-white p-6 shadow">
        <h2 class="text-4xl font-bold">{{ activeGroup?.label || 'Purchases & sales' }}</h2>
        <p class="mt-2 text-sm text-gray-500">
          {{ sectionDescription }}
        </p>
      </div>

      <DashboardSecondaryNav :items="secondaryNavItems" />

      <DashboardCommerceProcurementTab v-if="activeTab === 'procurement'" />
      <DashboardCommerceSalesTab v-else-if="activeTab === 'sales'" />
      <DashboardCommerceShippingTab v-else-if="activeTab === 'shipping'" />
      <DashboardCommerceWarehousesTab v-else-if="activeTab === 'warehouses'" />
      <DashboardCommerceSerializedItemsTab v-else-if="activeTab === 'serialized'" />
      <DashboardCommerceScanItemTab v-else-if="activeTab === 'scan'" />
      <DashboardCommerceReturnsTab v-else-if="activeTab === 'returns'" />
      <DashboardCommerceProcurementTab v-else />
    </div>
  </div>
</template>

<script setup>
import { getDashboardQueryValue } from '~/utils/dashboardNavigation'
import { commerceTabs } from '~/utils/commerce'

definePageMeta({
  layout: 'dashboard'
})

const route = useRoute()
const { activeGroup } = useDashboardNavigation()
const sectionDescription = computed(() => ({ inventory: 'Warehouses, item records and QR scanning.', shipping: 'Shipping companies and shipment settings.', commerce: 'Purchase invoices, sales and returns.' })[activeGroup.value?.key] || 'Purchase invoices, sales and returns.')

const validTabKeys = new Set(commerceTabs.map((tab) => tab.key))

const activeTab = computed(() => {
  const tab = getDashboardQueryValue(route, 'tab')
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
