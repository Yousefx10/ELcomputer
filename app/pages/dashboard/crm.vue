<template>
  <div class="mx-auto max-w-6xl space-y-6">
    <DashboardPageIntro
      title="CRM"
      :description="$t('interface.manageContactsCallsAndCustomerOrSupplierTickets')"
    />

    <DashboardSecondaryNav :items="secondaryNavItems" />

    <DashboardCrmActivitiesTab v-if="activeTab === 'activities'" />
    <DashboardCommerceCrmTab v-else />
  </div>
</template>

<script setup>
import { getDashboardQueryValue } from '~/utils/dashboardNavigation'

definePageMeta({
  layout: 'dashboard'
})

const route = useUiRoute()

const activeTab = computed(() => {
  return getDashboardQueryValue(route, 'tab') === 'activities'
    ? 'activities'
    : 'contacts'
})

const secondaryNavItems = computed(() => [
  {
    label: 'Contacts',
    to: '/dashboard/crm',
    active: activeTab.value === 'contacts'
  },
  {
    label: 'Tickets & Activity',
    to: '/dashboard/crm?tab=activities',
    active: activeTab.value === 'activities'
  }
])
</script>
