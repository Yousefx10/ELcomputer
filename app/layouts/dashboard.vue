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
        :aria-label="$t('common.closeDashboardNavigation')"
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
            <NuxtLinkLocale to="/dashboard" class="flex items-center">
              <BrandLogo :settings="siteContent?.settings" alt="ELcomputer" class="h-10 w-44" />
            </NuxtLinkLocale>

            <div class="flex flex-wrap items-center gap-3">
              <UiPreferences />
              <div class="hidden rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 sm:block">
                {{ dashboardDateTime }}
              </div>

              <button
                type="button"
                class="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
                @click="logout"
              >
                {{ $t('common.logout') }}
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
              :aria-label="$t('layouts.dashboard.openDashboardNavigation')"
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
                {{ $uiLabel(groupTitle) }}
              </p>
              <h1 class="dashboard-modern-title">
                {{ $uiLabel(pageTitle) }}
              </h1>
            </div>
          </div>

          <div class="ms-auto flex flex-wrap items-center gap-2 sm:gap-3">
            <UiPreferences />
            <div class="dashboard-modern-date hidden md:inline-flex">
              <Icon name="lucide:calendar-days" size="16" />
              {{ dashboardDateTime }}
            </div>

            <NuxtLinkLocale
              to="/"
              target="_blank"
              rel="noopener"
              class="dashboard-modern-store-link inline-flex"
            >
              <Icon name="lucide:external-link" size="16" />
              <span class="hidden sm:inline">{{ $t('common.viewStore') }}</span>
              <span class="sr-only sm:hidden">{{ $t('common.viewStore') }}</span>
            </NuxtLinkLocale>
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
const { intlLocale } = useUiLocale()

const { uiNavigateTo } = useUiNavigation()

const { uiLabel } = useUiLocale()
const supabase = useSupabaseClient()
const route = useUiRoute()
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
  title: uiLabel(documentTitle.value)
}))

const updateDashboardDateTime = () => {
  dashboardDateTime.value = new Intl.DateTimeFormat(intlLocale.value, {
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
  await uiNavigateTo('/dashboard/login')
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
      .querySelector('#detailed-dashboard-navigation .sidebar-close')
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
      await uiNavigateTo('/dashboard/login')
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
