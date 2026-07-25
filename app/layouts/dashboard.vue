<template>
  <div class="min-h-screen bg-gray-100">
    <div
      v-if="dashboardLayout === 'standard'"
      class="mx-auto max-w-6xl px-6 pt-6"
    >
      <header class="mb-4 flex items-center justify-between rounded-2xl bg-white p-4 shadow">
        <NuxtLink to="/dashboard" class="flex items-center">
          <img
            :src="dashboardLogoUrl || '/images/dashboard-logo.png'"
            :alt="`${dashboardSiteName} Dashboard`"
            class="h-10 max-w-48 object-contain"
          >
        </NuxtLink>

        <div class="flex items-center gap-3">
          <div class="hidden rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 sm:block">
            {{ dashboardDateTime }}
          </div>

          <button
            type="button"
            class="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            @click="logout"
          >
            Logout
          </button>
        </div>
      </header>

      <div class="mb-6 rounded-2xl bg-white shadow">
        <LayoutDashboardNavBar />
      </div>

      <main class="min-w-0">
        <slot />
      </main>
    </div>

    <div
      v-else
      class="mx-auto min-h-screen max-w-[1600px] px-3 py-3 lg:flex lg:items-start lg:gap-6 lg:px-6 lg:py-6"
    >
      <button
        v-if="detailedSidebarOpen"
        type="button"
        aria-label="Close dashboard navigation"
        class="fixed inset-0 z-40 bg-black/40 lg:hidden"
        @click="detailedSidebarOpen = false"
      />

      <LayoutDashboardSideBar
        :open="detailedSidebarOpen"
        :logo-url="dashboardLogoUrl"
        :site-name="dashboardSiteName"
        @close="detailedSidebarOpen = false"
        @logout="logout"
      />

      <div
        class="min-w-0 flex-1"
        :inert="detailedSidebarOpen || undefined"
      >
        <header class="mb-6 flex items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow">
          <div class="flex min-w-0 items-center gap-3">
            <button
              type="button"
              class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-black text-white lg:hidden"
              aria-label="Open dashboard navigation"
              aria-controls="detailed-dashboard-navigation"
              :aria-expanded="detailedSidebarOpen"
              @click="detailedSidebarOpen = true"
            >
              <Icon name="lucide:menu" size="21" />
            </button>

            <div class="min-w-0">
              <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">
                {{ activeGroup?.detailedLabel || activeGroup?.label || 'Dashboard' }}
              </p>
              <p class="truncate font-bold text-gray-900">
                {{ activeItem?.detailedLabel || activeItem?.label || activeGroup?.label || 'Dashboard' }}
              </p>
            </div>
          </div>

          <div class="hidden rounded-xl bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 sm:block">
            {{ dashboardDateTime }}
          </div>
        </header>

        <main class="min-w-0">
          <slot />
        </main>
      </div>
    </div>
  </div>
</template>

<script setup>
const supabase = useSupabaseClient()
const route = useRoute()
const { data: siteContent } = await useSiteContent()
const {
  clearAdminAccess
} = useAdminAccess()
const {
  activeGroup,
  activeItem,
  documentTitle
} = useDashboardNavigation()
const {
  dashboardLayout,
  setDashboardLayout
} = useDashboardLayout()
const dashboardDateTime = ref('')
const detailedSidebarOpen = ref(false)

let dashboardClockInterval
let authStateSubscription

useHead(() => ({
  title: documentTitle.value
}))

const dashboardSiteName = computed(() => siteContent.value?.settings?.site_name || 'ELcomputer')
const dashboardLogoUrl = computed(() => siteContent.value?.settings?.site_logo_url || '')

const updateDashboardDateTime = () => {
  dashboardDateTime.value = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date())
}

const closeDetailedSidebar = () => {
  detailedSidebarOpen.value = false
}

const handleDashboardKeydown = (event) => {
  if (event.key === 'Escape' && detailedSidebarOpen.value) {
    closeDetailedSidebar()
  }
}

const handleDashboardResize = () => {
  if (window.innerWidth >= 1024) {
    closeDetailedSidebar()
  }
}

const logout = async () => {
  clearAdminAccess()
  await supabase.auth.signOut()
  await navigateTo('/dashboard/login')
}

watchEffect(() => {
  setDashboardLayout(siteContent.value?.settings?.dashboard_layout)
})

watch(
  () => route.fullPath,
  () => {
    closeDetailedSidebar()
  }
)

watch(detailedSidebarOpen, async (isOpen) => {
  if (!import.meta.client) {
    return
  }

  document.body.style.overflow = isOpen ? 'hidden' : ''

  await nextTick()

  if (isOpen) {
    document
      .querySelector('#detailed-dashboard-navigation [aria-label="Close dashboard navigation"]')
      ?.focus()
  }
})

watch(dashboardLayout, (layout) => {
  if (layout !== 'detailed') {
    closeDetailedSidebar()
  }
})

onMounted(() => {
  updateDashboardDateTime()
  dashboardClockInterval = window.setInterval(updateDashboardDateTime, 1000)
  window.addEventListener('keydown', handleDashboardKeydown)
  window.addEventListener('resize', handleDashboardResize)

  authStateSubscription = supabase.auth.onAuthStateChange(async (_event, session) => {
    if (!session) {
      clearAdminAccess()
      await navigateTo('/dashboard/login')
    }
  }).data.subscription
})

onUnmounted(() => {
  if (import.meta.client) {
    document.body.style.overflow = ''
  }

  if (dashboardClockInterval) {
    window.clearInterval(dashboardClockInterval)
  }

  window.removeEventListener('keydown', handleDashboardKeydown)
  window.removeEventListener('resize', handleDashboardResize)

  if (authStateSubscription) {
    authStateSubscription.unsubscribe()
  }
})
</script>
