<template>
  <div class="mx-auto max-w-6xl space-y-5 pb-6">
    <header class="flex flex-col gap-4 rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div>
        <h2 class="text-3xl font-bold tracking-tight text-gray-950">Orders</h2>
        <p class="mt-1.5 text-sm text-gray-500">Track orders from checkout to delivery.</p>
      </div>
      <NuxtLink
        to="/dashboard/orders/confirm"
        class="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
      >
        <Icon name="lucide:scan-barcode" size="18" />
        Confirm orders
        <Icon name="lucide:arrow-up-right" size="16" class="ms-2 text-gray-400" />
      </NuxtLink>
    </header>

    <DashboardSecondaryNav :items="secondaryNavItems" />

    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Order summary">
      <DashboardStatCard
        v-for="metric in summaryMetrics"
        :key="metric.key"
        :label="metric.label"
        :value="hasLoadedStats ? formatCount(stats[metric.key]) : '—'"
        :icon="metric.icon"
        :tone="metric.tone"
        :caption="metric.caption"
      />
    </div>

    <div v-if="pageError" role="alert" class="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
      <Icon name="lucide:circle-alert" size="18" class="shrink-0" />
      {{ pageError }}
    </div>

    <section class="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm" :aria-busy="loading" aria-labelledby="orders-list-title">
      <div class="flex flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-6">
        <div class="flex items-center gap-2.5">
          <h3 id="orders-list-title" class="text-lg font-semibold tracking-tight text-gray-950">{{ showRecentOrders ? 'Recent orders' : 'All orders' }}</h3>
          <span v-if="hasLoadedStats" class="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-gray-600">
            {{ formatCount(showRecentOrders ? recentOrders.length : totalOrders) }}
          </span>
        </div>
        <NuxtLink v-if="showRecentOrders" to="/dashboard/orders" class="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-black">
          View all orders <Icon name="lucide:arrow-right" size="14" />
        </NuxtLink>
        <span v-else class="inline-flex items-center gap-1.5 text-xs text-gray-500">
          <Icon name="lucide:arrow-down-wide-narrow" size="14" />
          Newest first
        </span>
      </div>

      <form v-if="!showRecentOrders" class="border-t border-gray-100" @submit.prevent="applyFilters">
        <fieldset :disabled="loading" class="min-w-0 disabled:opacity-60">
          <legend class="sr-only">Filter orders</legend>
          <div class="flex flex-wrap items-center gap-1.5 border-b border-gray-100 bg-gray-50/60 px-5 py-3 sm:px-6" aria-label="Order date range">
            <button
              v-for="preset in quickFilterOptions"
              :key="preset.key"
              type="button"
              :aria-pressed="activePreset === preset.key"
              class="rounded-lg px-3 py-2 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
              :class="activePreset === preset.key ? 'bg-gray-950 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-200/70 hover:text-gray-900'"
              @click="applyQuickFilter(preset.key)"
            >
              {{ preset.label }}
            </button>
          </div>
          <div class="flex flex-wrap gap-2 px-5 py-4 sm:px-6">
            <div class="relative min-w-0 flex-[1_1_220px]">
              <label for="order-search" class="sr-only">Search orders or customers</label>
              <Icon name="lucide:search" size="17" class="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input id="order-search" v-model="searchQuery" type="search" placeholder="Search orders or customers…" class="order-input w-full pe-3 ps-10" />
            </div>
            <button type="submit" class="rounded-lg bg-gray-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900">Search</button>
            <button
              type="button"
              :aria-expanded="showDateFilters"
              aria-controls="order-date-filters"
              class="order-toolbar-button"
              :class="{ 'order-toolbar-button-active': showDateFilters || appliedFilters.from || appliedFilters.to }"
              @click="showDateFilters = !showDateFilters"
            >
              <Icon name="lucide:calendar-days" size="16" />
              Date range
              <Icon :name="showDateFilters ? 'lucide:chevron-up' : 'lucide:chevron-down'" size="14" />
            </button>
            <button v-if="hasActiveFilters" type="button" class="order-toolbar-button" @click="clearFilters">
              <Icon name="lucide:x" size="15" /> Reset
            </button>
            <button type="button" class="order-toolbar-button" aria-label="Refresh orders" title="Refresh orders" @click="loadOrdersDashboard(currentPage, { force: true })">
              <Icon name="lucide:refresh-cw" size="16" :class="{ 'motion-safe:animate-spin': loading }" />
            </button>
          </div>
          <div v-show="showDateFilters" id="order-date-filters" class="flex flex-wrap items-end gap-3 border-t border-gray-100 bg-gray-50/60 px-5 py-4 sm:px-6">
            <div class="min-w-0 flex-[1_1_160px]">
              <label for="order-from-date" class="mb-1.5 block text-xs font-medium text-gray-600">From</label>
              <input id="order-from-date" v-model="fromDate" type="date" :max="toDate || undefined" class="order-input w-full px-3" />
            </div>
            <div class="min-w-0 flex-[1_1_160px]">
              <label for="order-to-date" class="mb-1.5 block text-xs font-medium text-gray-600">To</label>
              <input id="order-to-date" v-model="toDate" type="date" :min="fromDate || undefined" class="order-input w-full px-3" />
            </div>
            <button type="submit" class="order-toolbar-button">Apply dates</button>
          </div>
        </fieldset>
      </form>

      <div v-if="loading" role="status" class="border-t border-gray-100 px-5 py-6 sm:px-6">
        <span class="sr-only">Loading orders…</span>
        <div aria-hidden="true" class="space-y-5 motion-safe:animate-pulse">
          <div v-for="row in 6" :key="row" class="flex items-center gap-5">
            <div class="h-10 w-10 shrink-0 rounded-xl bg-gray-100" />
            <div class="flex-1 space-y-2"><div class="h-3 w-24 rounded bg-gray-100" /><div class="h-2.5 w-36 rounded bg-gray-100" /></div>
            <div class="hidden h-3 w-24 rounded bg-gray-100 sm:block" />
            <div class="h-6 w-20 rounded-full bg-gray-100" />
          </div>
        </div>
      </div>

      <div v-else-if="!displayedOrders.length" class="flex flex-col items-center border-t border-gray-100 px-5 py-16 text-center">
        <span class="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-500"><Icon :name="pageError ? 'lucide:cloud-off' : 'lucide:package-search'" size="24" /></span>
        <h4 class="text-sm font-semibold text-gray-900">{{ pageError ? 'Orders could not load' : hasActiveFilters && !showRecentOrders ? 'No matching orders' : 'No orders yet' }}</h4>
        <p class="mt-1.5 text-sm text-gray-500">{{ pageError ? 'Try refreshing the list.' : hasActiveFilters && !showRecentOrders ? 'Try another search or date range.' : 'New orders will appear here.' }}</p>
        <button v-if="pageError" type="button" class="order-toolbar-button mt-5" @click="loadOrdersDashboard(currentPage, { force: true })">Try again</button>
        <button v-else-if="hasActiveFilters && !showRecentOrders" type="button" class="order-toolbar-button mt-5" @click="clearFilters">Reset filters</button>
      </div>

      <template v-else>
        <div class="hidden overflow-x-auto md:block">
          <table class="w-full text-left text-sm">
            <caption class="sr-only">{{ showRecentOrders ? 'Recent orders' : 'Orders matching the applied filters' }}. Select an order to view details.</caption>
            <thead class="border-y border-gray-200/70 bg-gray-50/80 text-xs font-medium text-gray-500">
              <tr>
                <th scope="col" class="px-6 py-3 font-medium">Order</th>
                <th scope="col" class="px-4 py-3 font-medium">Customer</th>
                <th scope="col" class="px-4 py-3 font-medium">Date</th>
                <th scope="col" class="px-4 py-3 font-medium">Status</th>
                <th scope="col" class="px-6 py-3 text-right font-medium">Total</th>
                <th scope="col" class="w-10 pe-5"><span class="sr-only">View order</span></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr v-for="order in displayedOrders" :key="order.id" class="group cursor-pointer transition-colors hover:bg-gray-50/80 focus-within:bg-gray-50/80" @click="openOrderDialog(order.id)">
                <td class="py-4 ps-6 pe-4">
                  <button type="button" class="rounded text-left text-sm font-semibold text-gray-900 underline-offset-4 group-hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gray-900" :aria-label="`View order ${orderLabel(order)}`" @click.stop="openOrderDialog(order.id)">{{ orderLabel(order) }}</button>
                </td>
                <td class="px-4 py-4">
                  <div class="flex items-center gap-2.5">
                    <span aria-hidden="true" class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200/70 bg-gray-100 text-[11px] font-semibold text-gray-600">{{ customerInitials(order) }}</span>
                    <div class="min-w-0">
                      <p class="max-w-44 truncate font-medium text-gray-800" :title="customerName(order)">{{ customerName(order) }}</p>
                      <p class="mt-0.5 max-w-44 truncate text-xs text-gray-500" :title="order.governorate || ''">{{ order.governorate || 'Location not provided' }}</p>
                    </div>
                  </div>
                </td>
                <td class="whitespace-nowrap px-4 py-4">
                  <p class="text-xs text-gray-700">{{ formatDate(order.created_at) }}</p>
                  <p class="mt-1 text-xs text-gray-500">{{ formatTime(order.created_at) }}</p>
                </td>
                <td class="whitespace-nowrap px-4 py-4">
                  <span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium" :class="getCustomerOrderStatusClass(order.status)">
                    <span class="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                    {{ formatCustomerOrderStatus(order.status) }}
                  </span>
                </td>
                <td class="whitespace-nowrap px-6 py-4 text-right text-xs font-semibold tabular-nums text-gray-900">{{ formatCurrency(order.total_amount) }}</td>
                <td class="pe-5 text-gray-300 transition-colors group-hover:text-gray-900"><Icon name="lucide:chevron-right" size="16" aria-hidden="true" /></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="divide-y divide-gray-100 border-t border-gray-100 md:hidden">
          <button v-for="order in displayedOrders" :key="order.id" type="button" class="block w-full space-y-3 px-5 py-4 text-left transition hover:bg-gray-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gray-900" :aria-label="`View order ${orderLabel(order)}`" @click="openOrderDialog(order.id)">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="text-sm font-semibold text-gray-900">{{ orderLabel(order) }}</span>
              <span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium" :class="getCustomerOrderStatusClass(order.status)">
                <span class="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />{{ formatCustomerOrderStatus(order.status) }}
              </span>
            </div>
            <div class="flex items-end justify-between gap-3">
              <div class="min-w-0">
                <p class="truncate text-sm text-gray-700">{{ customerName(order) }}</p>
                <p class="mt-1 text-xs text-gray-500">{{ order.governorate || 'Location not provided' }} · {{ formatDate(order.created_at) }}</p>
              </div>
              <span class="shrink-0 text-xs font-semibold tabular-nums text-gray-900">{{ formatCurrency(order.total_amount) }}</span>
            </div>
          </button>
        </div>
      </template>

      <footer class="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-5 py-4 sm:px-6">
        <p class="text-xs text-gray-500" aria-live="polite">
          <template v-if="loading">Loading orders…</template>
          <template v-else-if="showRecentOrders">Latest {{ displayedOrders.length }} orders</template>
          <template v-else><span class="font-medium text-gray-700">{{ pageStart }}–{{ pageEnd }}</span> of {{ formatCount(totalOrders) }} orders</template>
        </p>
        <div v-if="!showRecentOrders" class="flex items-center gap-2">
          <span class="me-2 text-xs tabular-nums text-gray-500">Page {{ currentPage }} of {{ totalPages }}</span>
          <button type="button" :disabled="currentPage === 1 || loading" class="order-toolbar-button !px-2.5" aria-label="Previous page" @click="goToPreviousPage"><Icon name="lucide:chevron-left" size="16" /></button>
          <button type="button" :disabled="currentPage === totalPages || loading" class="order-toolbar-button !px-2.5" aria-label="Next page" @click="goToNextPage"><Icon name="lucide:chevron-right" size="16" /></button>
        </div>
      </footer>
    </section>

    <DashboardOrderDetailsDialog v-model:open="isOrderDialogOpen" :order-id="selectedOrderId" @updated="handleOrderUpdated" />
  </div>
</template>

<script setup>
import { buildDashboardOverviewLinks } from '~/utils/dashboardOverviewLinks'
import { formatCustomerOrderStatus, getCustomerOrderStatusClass } from '~/utils/orderStatus'

definePageMeta({
  layout: 'dashboard'
})

const supabase = useSupabaseClient()
const route = useRoute()
const showRecentOrders = computed(() => String(route.query.view || '') === 'recent')
const {
  getSnapshot,
  invalidate,
  isFresh,
  setSnapshot
} = useDashboardCache()
const { hasPermission } = useAdminAccess()
const canSeeAnalysis = computed(() => hasPermission('dashboard.analysis'))
const canSeeOrders = computed(() => hasPermission('dashboard.orders'))
const secondaryNavItems = computed(() => buildDashboardOverviewLinks('orders', {
  canSeeAnalysis: canSeeAnalysis.value,
  canSeeOrders: canSeeOrders.value
}))
const stats = reactive({
  total: 0,
  today: 0,
  week: 0,
  month: 0
})
const recentOrders = ref([])
const orders = ref([])
const totalOrders = ref(0)
const currentPage = ref(1)
const pageSize = 10
const loading = ref(true)
const pageError = ref('')
const searchQuery = ref('')
const fromDate = ref('')
const toDate = ref('')
const isOrderDialogOpen = ref(false)
const selectedOrderId = ref('')
const hasLoadedStats = ref(false)
const showDateFilters = ref(false)
const activePreset = ref('all')
const appliedFilters = reactive({ search: '', from: '', to: '' })
const hasActiveFilters = computed(() => Boolean(appliedFilters.search || appliedFilters.from || appliedFilters.to))
const displayedOrders = computed(() => showRecentOrders.value ? recentOrders.value : orders.value)

const summaryMetrics = [
  { key: 'total', label: 'Total orders', caption: 'All time', icon: 'lucide:shopping-bag', tone: 'blue' },
  { key: 'today', label: 'Today', caption: 'Since midnight', icon: 'lucide:sun', tone: 'amber' },
  { key: 'week', label: 'Last 7 days', caption: 'Including today', icon: 'lucide:calendar-days', tone: 'violet' },
  { key: 'month', label: 'Last 30 days', caption: 'Including today', icon: 'lucide:calendar-range', tone: 'cyan' }
]

const quickFilterOptions = [
  { key: 'all', label: 'All time' },
  { key: '1-week', label: '7 days' },
  { key: '2-weeks', label: '14 days' },
  { key: '1-month', label: '30 days' },
  { key: '3-months', label: '90 days' },
  { key: 'last-year', label: '365 days' }
]

const totalPages = computed(() => {
  return Math.max(1, Math.ceil(totalOrders.value / pageSize))
})

const pageStart = computed(() => {
  if (!totalOrders.value) {
    return 0
  }

  return ((currentPage.value - 1) * pageSize) + 1
})

const pageEnd = computed(() => {
  return Math.min(currentPage.value * pageSize, totalOrders.value)
})

const buildOrdersCacheKey = (page = currentPage.value) => {
  return `dashboard:orders:${page}:${appliedFilters.search.toLowerCase()}:${appliedFilters.from}:${appliedFilters.to}`
}

const formatCount = (value) => new Intl.NumberFormat('en-US').format(value)
const orderLabel = (order) => order.order_number || `Order #${order.id.slice(0, 8)}`
const customerName = (order) => [order.first_name, order.last_name].filter(Boolean).join(' ') || 'Customer'
const customerInitials = (order) => [order.first_name, order.last_name].filter(Boolean).map((name) => String(name).trim().charAt(0)).join('').toUpperCase() || 'C'

const getAuthHeaders = async () => {
  const { data } = await supabase.auth.getSession()

  if (!data.session?.access_token) {
    throw new Error('Your session expired. Please log in again.')
  }

  return {
    authorization: `Bearer ${data.session.access_token}`
  }
}

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'EGP',
    maximumFractionDigits: 2
  }).format(Number(value || 0))
}

const formatDate = (value) => {
  if (!value) {
    return 'Recently'
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium'
  }).format(new Date(value))
}

const formatTime = (value) => value
  ? new Intl.DateTimeFormat('en-US', { timeStyle: 'short' }).format(new Date(value))
  : ''

const applyOrdersSnapshot = (snapshot) => {
  hasLoadedStats.value = true
  currentPage.value = snapshot?.page || 1
  stats.total = snapshot?.stats?.total || 0
  stats.today = snapshot?.stats?.today || 0
  stats.week = snapshot?.stats?.week || 0
  stats.month = snapshot?.stats?.month || 0
  recentOrders.value = snapshot?.recentOrders || []
  orders.value = snapshot?.items || []
  totalOrders.value = snapshot?.total || 0
}

const loadOrdersDashboard = async (page = currentPage.value, { force = false } = {}) => {
  currentPage.value = page
  pageError.value = ''
  const cacheKey = buildOrdersCacheKey(page)
  const cachedSnapshot = getSnapshot(cacheKey)

  if (cachedSnapshot) {
    applyOrdersSnapshot(cachedSnapshot)
  }

  if (!force && cachedSnapshot && isFresh(cacheKey)) {
    loading.value = false
    return
  }

  loading.value = true

  try {
    const response = await $fetch('/api/admin-orders', {
      query: {
        page,
        pageSize,
        search: appliedFilters.search || undefined,
        from: appliedFilters.from || undefined,
        to: appliedFilters.to || undefined
      },
      headers: await getAuthHeaders()
    })

    const snapshot = {
      page,
      stats: {
        total: response.stats?.total || 0,
        today: response.stats?.today || 0,
        week: response.stats?.week || 0,
        month: response.stats?.month || 0
      },
      recentOrders: response.recentOrders || [],
      items: response.items || [],
      total: response.total || 0
    }

    applyOrdersSnapshot(snapshot)
    setSnapshot(cacheKey, snapshot)

    if (currentPage.value > totalPages.value) {
      loading.value = false
      await loadOrdersDashboard(totalPages.value, { force })
    }
  } catch (error) {
    pageError.value = error?.data?.statusMessage || error?.message || 'Could not load orders.'
  } finally {
    loading.value = false
  }
}

const applyFilters = async () => {
  if (fromDate.value && toDate.value && fromDate.value > toDate.value) {
    return
  }
  if (appliedFilters.from !== fromDate.value || appliedFilters.to !== toDate.value) {
    activePreset.value = fromDate.value || toDate.value ? '' : 'all'
  }
  appliedFilters.search = searchQuery.value.trim()
  appliedFilters.from = fromDate.value
  appliedFilters.to = toDate.value
  await loadOrdersDashboard(1)
}

const clearFilters = async () => {
  searchQuery.value = ''
  fromDate.value = ''
  toDate.value = ''
  await applyFilters()
}

const getPresetFromDate = (daysBack) => {
  const date = new Date()
  date.setDate(date.getDate() - daysBack)
  return date.toISOString().slice(0, 10)
}

const applyQuickFilter = async (presetKey) => {
  const today = new Date().toISOString().slice(0, 10)
  toDate.value = today

  if (presetKey === 'all') {
    fromDate.value = ''
    toDate.value = ''
  } else if (presetKey === '1-week') {
    fromDate.value = getPresetFromDate(6)
  } else if (presetKey === '2-weeks') {
    fromDate.value = getPresetFromDate(13)
  } else if (presetKey === '1-month') {
    fromDate.value = getPresetFromDate(29)
  } else if (presetKey === '3-months') {
    fromDate.value = getPresetFromDate(89)
  } else {
    fromDate.value = getPresetFromDate(364)
  }

  await applyFilters()
  activePreset.value = presetKey
}

const openOrderDialog = (orderId) => {
  selectedOrderId.value = orderId
  isOrderDialogOpen.value = true
}

const handleOrderUpdated = async (updatedOrder) => {
  if (!updatedOrder?.id) {
    return
  }

  const patchOrder = (order) => {
    if (order.id !== updatedOrder.id) {
      return order
    }

    return {
      ...order,
      ...updatedOrder
    }
  }

  orders.value = orders.value.map(patchOrder)
  recentOrders.value = recentOrders.value.map(patchOrder)
  invalidate('dashboard:orders:')
}

const goToPreviousPage = async () => {
  if (currentPage.value === 1) {
    return
  }

  await loadOrdersDashboard(currentPage.value - 1)
}

const goToNextPage = async () => {
  if (currentPage.value === totalPages.value) {
    return
  }

  await loadOrdersDashboard(currentPage.value + 1)
}

onMounted(async () => {
  await loadOrdersDashboard()
})
</script>

<style scoped>
@reference "../../../assets/css/main.css";

.order-input {
  @apply min-h-10 min-w-0 rounded-lg border border-gray-200 bg-white py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-gray-100;
}

.order-toolbar-button {
  @apply inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50 hover:text-gray-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900 disabled:cursor-not-allowed disabled:opacity-40;
}

.order-toolbar-button-active {
  @apply border-gray-400 bg-gray-100 text-gray-950;
}
</style>
