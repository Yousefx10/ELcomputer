<template>
  <div class="min-h-screen bg-gray-100">
    <div class="mx-auto max-w-6xl px-6 pt-6">
      <header class="mb-4 flex items-center justify-between rounded-2xl bg-white p-4 shadow">
        <NuxtLink to="/dashboard" class="flex items-center">
          <!-- <img
            v-if="dashboardLogoUrl"
            :src="dashboardLogoUrl"
            :alt="dashboardSiteName"
            class="h-10 w-auto object-contain" /> -->
          <img
            src="/images/dashboard-logo.png"
            alt="ELcomputer Dashboard"
            class="h-10 w-auto object-contain"
          >
        </NuxtLink>

        <div class="flex items-center gap-3">
          <div class="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700">
            {{ dashboardDateTime }}
          </div>

          <button
            @click="logout"
            class="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Logout
          </button>
        </div>
      </header>

      <div class="mb-6 rounded-2xl bg-white shadow">
        <LayoutDashboardNavBar />
      </div>

      <main>
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup>
const supabase = useSupabaseClient()
const { data: siteContent } = await useSiteContent()
const {
  clearAdminAccess
} = useAdminAccess()
const dashboardDateTime = ref('')

let dashboardClockInterval
let authStateSubscription

const dashboardSiteName = computed(() => siteContent.value?.settings?.site_name || 'ELcomputer')
const dashboardLogoUrl = computed(() => siteContent.value?.settings?.site_logo_url || '')

const updateDashboardDateTime = () => {
  dashboardDateTime.value = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date())
}

const logout = async () => {
  clearAdminAccess()
  await supabase.auth.signOut()
  await navigateTo('/dashboard/login')
}

onMounted(() => {
  updateDashboardDateTime()
  dashboardClockInterval = window.setInterval(updateDashboardDateTime, 1000)

  authStateSubscription = supabase.auth.onAuthStateChange(async (_event, session) => {
    if (!session) {
      clearAdminAccess()
      await navigateTo('/dashboard/login')
    }
  }).data.subscription
})

onUnmounted(() => {
  if (dashboardClockInterval) {
    window.clearInterval(dashboardClockInterval)
  }

  if (authStateSubscription) {
    authStateSubscription.unsubscribe()
  }
})
</script>

<style>

</style>
