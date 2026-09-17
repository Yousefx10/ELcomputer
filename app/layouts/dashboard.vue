<template>
  <div
    class="min-h-screen"
    :class="dashboardLayout === 'detailed' ? 'dashboard-modern' : 'bg-gray-100'"
  >
    <div
      :class="dashboardLayout === 'standard'
        ? 'mx-auto max-w-6xl px-6 pt-6'
        : 'dashboard-modern-shell min-h-screen lg:flex'"
    >
      <button
        v-if="dashboardLayout === 'detailed' && detailedSidebarOpen"
        type="button"
        tabindex="-1"
        aria-label="Close dashboard navigation"
        class="fixed inset-0 z-40 bg-black/40 lg:hidden"
        @click="closeDetailedSidebar({ restoreFocus: true })"
      />

      <LayoutDashboardSideBar
        v-if="dashboardLayout === 'detailed'"
        :open="detailedSidebarOpen"
        @close="closeDetailedSidebar({ restoreFocus: true })"
        @logout="logout"
      />

      <div
        key="dashboard-content"
        class="min-w-0 flex-1"
        :class="dashboardLayout === 'detailed' ? 'dashboard-modern-stage' : ''"
        :inert="dashboardLayout === 'detailed' && detailedSidebarOpen || undefined"
      >
        <template v-if="dashboardLayout === 'standard'">
          <header class="mb-4 flex items-center justify-between rounded-2xl bg-white p-4 shadow">
            <NuxtLink to="/dashboard" class="flex items-center">
              <img
                src="/images/dashboard-logo.png"
                alt="ELcomputer Dashboard"
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
        </template>

        <header v-else class="dashboard-modern-topbar">
          <div class="flex min-w-0 items-center gap-3">
            <button
              ref="detailedSidebarButton"
              type="button"
              class="dashboard-modern-icon-button inline-flex lg:hidden"
              aria-label="Open dashboard navigation"
              aria-controls="detailed-dashboard-navigation"
              :aria-expanded="detailedSidebarOpen"
              @click="openDetailedSidebar"
            >
              <Icon name="lucide:menu" size="20" />
            </button>

            <div class="min-w-0">
              <p
                v-if="groupTitle"
                class="dashboard-modern-breadcrumb"
              >
                {{ groupTitle }}
              </p>
              <h1 class="dashboard-modern-title">
                {{ pageTitle }}
              </h1>
            </div>
          </div>

          <div class="ms-auto flex shrink-0 items-center gap-2 sm:gap-3">
            <div class="dashboard-modern-date hidden md:inline-flex">
              <Icon name="lucide:calendar-days" size="16" />
              {{ dashboardDateTime }}
            </div>

            <NuxtLink
              to="/"
              target="_blank"
              rel="noopener"
              class="dashboard-modern-store-link inline-flex"
            >
              <Icon name="lucide:external-link" size="16" />
              <span class="hidden sm:inline">View store</span>
              <span class="sr-only sm:hidden">View store</span>
            </NuxtLink>
          </div>
        </header>

        <main
          key="dashboard-page"
          class="min-w-0"
          :class="dashboardLayout === 'detailed' ? 'dashboard-modern-page' : ''"
        >
          <slot />
        </main>
      </div>
    </div>
  </div>
</template>

<script setup>
const supabase = useSupabaseClient()
const route = useRoute()
const [siteContentResult, dashboardAppearanceResult] = await Promise.all([
  useSiteContent(),
  useDashboardAppearance()
])
const { data: siteContent } = siteContentResult
const { data: dashboardAppearance } = dashboardAppearanceResult
const {
  clearAdminAccess
} = useAdminAccess()
const {
  documentTitle,
  groupTitle,
  pageTitle
} = useDashboardNavigation()
const {
  dashboardLayout,
  setDashboardLayout
} = useDashboardLayout()
const dashboardDateTime = ref('')
const detailedSidebarOpen = ref(false)
const detailedSidebarButton = ref(null)

let dashboardClockInterval
let authStateSubscription

useHead(() => ({
  title: documentTitle.value
}))

const updateDashboardDateTime = () => {
  dashboardDateTime.value = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date())
}

const openDetailedSidebar = () => {
  detailedSidebarOpen.value = true
}

const closeDetailedSidebar = async ({ restoreFocus = false } = {}) => {
  if (!detailedSidebarOpen.value) {
    return
  }

  detailedSidebarOpen.value = false

  if (restoreFocus) {
    await nextTick()
    detailedSidebarButton.value?.focus()
  }
}

const handleDashboardKeydown = (event) => {
  if (event.key === 'Escape' && detailedSidebarOpen.value) {
    event.preventDefault()
    closeDetailedSidebar({ restoreFocus: true })
    return
  }

  if (event.key !== 'Tab' || !detailedSidebarOpen.value) {
    return
  }

  const sidebar = document.getElementById('detailed-dashboard-navigation')
  const focusableElements = Array.from(sidebar?.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  ) || []).filter(element => !element.hidden && element.getClientRects().length)

  if (!focusableElements.length) {
    event.preventDefault()
    return
  }

  const firstElement = focusableElements[0]
  const lastElement = focusableElements[focusableElements.length - 1]
  const focusIsOutside = !sidebar?.contains(document.activeElement)

  if (event.shiftKey && (document.activeElement === firstElement || focusIsOutside)) {
    event.preventDefault()
    lastElement.focus()
  } else if (!event.shiftKey && (document.activeElement === lastElement || focusIsOutside)) {
    event.preventDefault()
    firstElement.focus()
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
  setDashboardLayout(
    dashboardAppearance.value?.dashboard_layout
    || siteContent.value?.settings?.dashboard_layout
  )
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
