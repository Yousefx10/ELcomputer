<template>
  <div class="mx-auto max-w-6xl space-y-6">
    <div class="rounded-2xl bg-white p-6 shadow">
      <h2 class="text-4xl font-bold">CRM</h2>
      <p class="mt-2 text-sm text-gray-500">
        Manage contacts, calls, and customer or supplier cases.
      </p>
    </div>

    <DashboardSecondaryNav :items="secondaryNavItems" />

    <DashboardCrmActivitiesTab v-if="activeTab === 'activities'" />
    <DashboardCommerceCrmTab v-else />
  </div>
</template>

<script setup>
definePageMeta({
  layout: 'dashboard'
})

const route = useRoute()

const activeTab = computed(() => {
  return String(route.query.tab || '').trim().toLowerCase() === 'activities'
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
    label: 'Calls & Cases',
    to: '/dashboard/crm?tab=activities',
    active: activeTab.value === 'activities'
  }
])
</script>
