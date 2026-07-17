<template>
  <div class="min-h-screen bg-gray-100 p-6">
    <div class="mx-auto max-w-6xl space-y-6">
      <div class="rounded-2xl bg-white p-6 shadow">
        <h2 class="text-4xl font-bold">Orders</h2>
        <p class="mt-2 text-sm text-gray-500">
          Review recent orders and update order statuses.
        </p>
      </div>

      <DashboardSecondaryNav :items="secondaryNavItems" />

      <div v-if="pageError" class="rounded-2xl bg-red-50 p-4 text-red-600 shadow">
        {{ pageError }}
      </div>

      <div class="grid gap-4 md:grid-cols-3">
        <div class="rounded-2xl bg-white p-5 shadow">
          <p class="text-sm text-gray-500">Today Orders</p>
          <p class="mt-2 text-3xl font-bold text-gray-900">{{ stats.today }}</p>
        </div>

        <div class="rounded-2xl bg-white p-5 shadow">
          <p class="text-sm text-gray-500">Week Orders</p>
          <p class="mt-2 text-3xl font-bold text-gray-900">{{ stats.week }}</p>
        </div>

        <div class="rounded-2xl bg-white p-5 shadow">
          <p class="text-sm text-gray-500">Month Orders</p>
          <p class="mt-2 text-3xl font-bold text-gray-900">{{ stats.month }}</p>
        </div>
      </div>

      <section class="rounded-2xl bg-white p-6 shadow">
        <div class="mb-5 flex items-center justify-between gap-3">
          <div>
            <h3 class="text-2xl font-bold">Recent Orders</h3>
            <p class="mt-1 text-sm text-gray-500">
              Latest orders created in the system.
            </p>
          </div>

          <div class="rounded-xl bg-gray-100 px-4 py-2 text-sm text-gray-600">
            {{ stats.total }} total
          </div>
        </div>

        <div v-if="loading" class="py-6 text-center text-gray-500">
          Loading orders...
        </div>

        <div v-else-if="!recentOrders.length" class="py-6 text-center text-gray-500">
          No orders found yet.
        </div>

        <div v-else class="space-y-3">
          <button
            v-for="order in recentOrders"
            :key="order.id"
            type="button"
            class="flex w-full flex-col gap-3 rounded-2xl border p-4 text-left transition hover:border-gray-300 hover:bg-gray-50 md:flex-row md:items-center md:justify-between"
            @click="openOrderDialog(order.id)"
          >
            <div>
              <p class="font-bold text-gray-900">
                {{ order.order_number || `Order #${order.id.slice(0, 8)}` }}
              </p>
              <p class="mt-1 text-sm text-gray-500">
                {{ order.first_name || 'Customer' }}
                <span v-if="order.last_name"> {{ order.last_name }}</span>
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-3 md:justify-end">
              <span class="text-sm text-gray-500">
                {{ order.governorate || 'No governorate' }}
              </span>

              <span
                class="rounded-full px-3 py-1 text-xs font-semibold uppercase"
                :class="getCustomerOrderStatusClass(order.status)"
              >
                {{ formatCustomerOrderStatus(order.status) }}
              </span>

              <span class="font-semibold text-gray-900">
                {{ formatCurrency(order.total_amount) }}
              </span>
            </div>
          </button>
        </div>
      </section>

      <section class="rounded-2xl bg-white p-6 shadow">
        <div class="flex flex-col gap-4">
          <div>
            <h3 class="text-2xl font-bold">All Orders</h3>
            <p class="mt-1 text-sm text-gray-500">
              Search by order number, first name, phone, email, or governorate and filter by date range.
            </p>
          </div>

          <div class="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_180px_180px_auto]">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search orders"
              class="rounded-lg border p-3 outline-none focus:border-blue-500"
            >

            <input
              v-model="fromDate"
              type="date"
              class="rounded-lg border p-3 outline-none focus:border-blue-500"
            >

            <input
              v-model="toDate"
              type="date"
              class="rounded-lg border p-3 outline-none focus:border-blue-500"
            >

            <button
              type="button"
              class="rounded-lg bg-black px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800"
              @click="applyFilters"
            >
              Apply
            </button>
          </div>

          <div class="flex flex-wrap gap-2">
            <button
              v-for="preset in quickFilterOptions"
              :key="preset.key"
              type="button"
              class="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
              @click="applyQuickFilter(preset.key)"
            >
              {{ preset.label }}
            </button>

            <button
              type="button"
              class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700"
              @click="clearFilters"
            >
              Clear
            </button>
          </div>
        </div>

        <div class="mt-6">
          <div class="mb-4 flex items-center justify-between rounded-xl border px-4 py-3">
            <p class="text-sm text-gray-500">
              Showing {{ pageStart }}-{{ pageEnd }} of {{ totalOrders }} orders
            </p>

            <p class="text-sm font-medium text-gray-600">
              Page {{ currentPage }} of {{ totalPages }}
            </p>
          </div>

          <div v-if="loading" class="py-6 text-center text-gray-500">
            Loading filtered orders...
          </div>

          <div v-else-if="!orders.length" class="py-6 text-center text-gray-500">
            No orders match the current filters.
          </div>

          <div v-else class="space-y-3">
            <button
              v-for="order in orders"
              :key="order.id"
              type="button"
              class="grid w-full gap-3 rounded-2xl border p-4 text-left transition hover:border-gray-300 hover:bg-gray-50 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_160px_160px]"
              @click="openOrderDialog(order.id)"
            >
              <div>
                <p class="font-bold text-gray-900">
                  {{ order.order_number || `Order #${order.id.slice(0, 8)}` }}
                </p>
                <p class="mt-1 text-sm text-gray-500">
                  {{ order.first_name || 'Customer' }}
                  <span v-if="order.last_name"> {{ order.last_name }}</span>
                </p>
              </div>

              <div class="text-sm text-gray-600">
                <p>{{ order.governorate || 'No governorate' }}</p>
                <p class="mt-1 text-xs text-gray-400">{{ formatDate(order.created_at) }}</p>
              </div>

              <div class="font-semibold text-gray-900">
                {{ formatCurrency(order.total_amount) }}
              </div>

              <div>
                <span
                  class="inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase"
                  :class="getCustomerOrderStatusClass(order.status)"
                >
                  {{ formatCustomerOrderStatus(order.status) }}
                </span>
              </div>
            </button>
          </div>

          <div class="mt-4 flex items-center justify-between rounded-xl border px-4 py-3">
            <button
              type="button"
              :disabled="currentPage === 1 || loading"
              class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
              @click="goToPreviousPage"
            >
              Previous
            </button>

            <p class="text-sm text-gray-500">
              Page {{ currentPage }} of {{ totalPages }}
            </p>

            <button
              type="button"
              :disabled="currentPage === totalPages || loading"
              class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
              @click="goToNextPage"
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>

    <DashboardOrderDetailsDialog
      v-model:open="isOrderDialogOpen"
      :order-id="selectedOrderId"
      @updated="handleOrderUpdated"
    />
  </div>
</template>

<script setup>
import { buildDashboardOverviewLinks } from '~/utils/dashboardOverviewLinks'
import { formatCustomerOrderStatus, getCustomerOrderStatusClass } from '~/utils/orderStatus'

definePageMeta({
  layout: 'dashboard'
})

const supabase = useSupabaseClient()
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

const quickFilterOptions = [
  { key: '1-week', label: '1 Week' },
  { key: '2-weeks', label: '2 Weeks' },
  { key: '1-month', label: '1 Month' },
  { key: '3-months', label: '3 Month' },
  { key: 'last-year', label: 'Last Year' }
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
  return `dashboard:orders:${page}:${searchQuery.value.trim().toLowerCase()}:${fromDate.value}:${toDate.value}`
}

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
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value))
}

const applyOrdersSnapshot = (snapshot) => {
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
  pageError.value = ''

  try {
    const response = await $fetch('/api/admin-orders', {
      query: {
        page,
        pageSize,
        search: searchQuery.value.trim() || undefined,
        from: fromDate.value || undefined,
        to: toDate.value || undefined
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
  await loadOrdersDashboard(1)
}

const clearFilters = async () => {
  searchQuery.value = ''
  fromDate.value = ''
  toDate.value = ''
  await loadOrdersDashboard(1)
}

const getPresetFromDate = (daysBack) => {
  const date = new Date()
  date.setDate(date.getDate() - daysBack)
  return date.toISOString().slice(0, 10)
}

const applyQuickFilter = async (presetKey) => {
  const today = new Date().toISOString().slice(0, 10)
  toDate.value = today

  if (presetKey === '1-week') {
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

  await loadOrdersDashboard(1)
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
