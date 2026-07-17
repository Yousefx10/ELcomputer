<template>
  <div class="mx-auto max-w-6xl space-y-6">
    <div class="rounded-2xl bg-white p-6 shadow">
      <h2 class="text-4xl font-bold">HR</h2>
      <p class="mt-2 text-sm text-gray-500">
        Manage employees, salary details, dashboard administrators, and store customers.
      </p>
    </div>

    <DashboardSecondaryNav :items="secondaryNavItems" />

    <DashboardHrUsersTab v-if="activeTab === 'users'" />
    <DashboardHrEmployeesTab v-else />
  </div>
</template>

<script setup>
definePageMeta({
  layout: 'dashboard'
})

const route = useRoute()
const { hasPermission } = useAdminAccess()

const canViewEmployees = computed(() => hasPermission('hr.view'))
const canViewUsers = computed(() => hasPermission('users.view'))

const activeTab = computed(() => {
  if (route.query.tab === 'users' && canViewUsers.value) {
    return 'users'
  }

  if (canViewEmployees.value) {
    return 'employees'
  }

  return 'users'
})

const secondaryNavItems = computed(() => {
  const items = []

  if (canViewEmployees.value) {
    items.push({
      label: 'Employees',
      to: '/dashboard/hr',
      active: activeTab.value === 'employees'
    })
  }

  if (canViewUsers.value) {
    items.push({
      label: 'Users',
      to: '/dashboard/hr?tab=users',
      active: activeTab.value === 'users'
    })
  }

  return items
})
</script>
