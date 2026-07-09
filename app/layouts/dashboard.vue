<template>
  <div class="min-h-screen bg-gray-100">
    <div v-if="authChecked" class="mx-auto max-w-6xl px-6 pt-6">
      <header class="mb-4 flex items-center justify-between rounded-2xl bg-white p-4 shadow">
        <NuxtLink to="/dashboard" class="flex items-center">
          <img
            v-if="dashboardLogoUrl"
            :src="dashboardLogoUrl"
            :alt="dashboardSiteName"
            class="h-10 w-auto object-contain"
          >

          <span v-else class="text-lg font-bold text-gray-900">
            {{ dashboardSiteName }}
          </span>
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

    <div v-else class="mx-auto max-w-6xl px-6 pt-6">
      <div class="rounded-2xl bg-white p-6 text-center text-gray-500 shadow">
        Loading dashboard...
      </div>
    </div>
  </div>
</template>

<script setup>
const supabase = useSupabaseClient()
const { data: siteContent } = await useSiteContent()
const authChecked = ref(false)
const dashboardDateTime = ref('')

let dashboardClockInterval

const dashboardSiteName = computed(() => siteContent.value?.settings?.site_name || 'ELcomputer')
const dashboardLogoUrl = computed(() => siteContent.value?.settings?.site_logo_url || '')

const updateDashboardDateTime = () => {
  dashboardDateTime.value = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date())
}

const logout = async () => {
  await supabase.auth.signOut()
  await navigateTo('/dashboard/login')
}

onMounted(async () => {
  const { data } = await supabase.auth.getSession()

  if (!data.session) {
    await navigateTo('/dashboard/login')
    return
  }

  updateDashboardDateTime()
  dashboardClockInterval = window.setInterval(updateDashboardDateTime, 1000)
  authChecked.value = true
})

onUnmounted(() => {
  if (dashboardClockInterval) {
    window.clearInterval(dashboardClockInterval)
  }
})
</script>

<style>

</style>
