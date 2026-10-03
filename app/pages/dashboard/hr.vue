<template>
  <div class="mx-auto max-w-6xl space-y-6">
    <DashboardPageIntro
      :title="$t('common.people')"
      :description="$t('interface.employeeRecordsAdminAccountsAndStoreCustomers')"
    />

    <DashboardSecondaryNav :items="secondaryNavItems" />

    <DashboardHrUsersTab v-if="activeTab === 'users'" />
    <DashboardHrEmployeesTab v-else />
  </div>
</template>

<script setup>
import { getDashboardQueryValue } from '~/utils/dashboardNavigation'

definePageMeta({
  layout: 'dashboard'
})

const route = useUiRoute()
const { hasPermission } = useAdminAccess()

const { data: erpState } = useNuxtData('active-erp')
const canViewEmployees = computed(() => erpState.value?.mode === 'built_in' && hasPermission('hr.view'))
const canViewUsers = computed(() => hasPermission('users.view'))

const activeTab = computed(() => {
  if (getDashboardQueryValue(route, 'tab') === 'users' && canViewUsers.value) {
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
