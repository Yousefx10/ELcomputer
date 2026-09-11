<template>
  <div class="mx-auto max-w-6xl space-y-6">
    <section class="rounded-2xl bg-white p-6 shadow">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 class="text-4xl font-bold">Daftra ERP</h2>
          <p class="mt-2 text-sm text-gray-500">Live ERP data with website orders kept local.</p>
        </div>
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          :disabled="loading"
          @click="loadData"
        >
          <Icon name="lucide:refresh-cw" size="17" :class="loading ? 'animate-spin' : ''" />
          Refresh
        </button>
      </div>
    </section>

    <DashboardSecondaryNav />

    <p v-if="errorMessage" class="rounded-2xl bg-red-50 p-5 text-sm text-red-700">
      {{ errorMessage }}
    </p>

    <div v-if="loading && !loaded" class="rounded-2xl bg-white p-8 text-sm text-gray-500 shadow">
      Loading Daftra data...
    </div>

    <template v-else-if="activeTab === 'overview'">
      <section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article v-for="card in overviewCards" :key="card.key" class="rounded-2xl bg-white p-5 shadow">
          <div class="flex items-center justify-between gap-3">
            <span class="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <Icon :name="card.icon" size="20" />
            </span>
            <span v-if="!card.available" class="text-xs font-bold text-red-600">Unavailable</span>
          </div>
          <p class="mt-4 text-sm font-semibold text-gray-500">{{ card.label }}</p>
          <p class="mt-1 text-3xl font-black text-gray-900">{{ card.total ?? '—' }}</p>
        </article>
      </section>

      <section class="grid gap-4 md:grid-cols-2">
        <article class="rounded-2xl bg-white p-6 shadow">
          <h3 class="text-lg font-bold">Order synchronization</h3>
          <div class="mt-5 grid grid-cols-2 gap-3">
            <div class="rounded-xl bg-amber-50 p-4">
              <p class="text-sm font-semibold text-amber-700">Pending</p>
              <p class="mt-1 text-2xl font-black text-amber-900">{{ response.sync?.pending || 0 }}</p>
            </div>
            <div class="rounded-xl bg-red-50 p-4">
              <p class="text-sm font-semibold text-red-700">Failed</p>
              <p class="mt-1 text-2xl font-black text-red-900">{{ response.sync?.failed || 0 }}</p>
            </div>
          </div>
          <NuxtLink to="/dashboard/erp?tab=sync" class="mt-4 inline-flex items-center gap-2 text-sm font-bold text-blue-700">
            Open sync queue <Icon name="lucide:arrow-right" size="16" />
          </NuxtLink>
        </article>

        <article class="rounded-2xl bg-white p-6 shadow">
          <h3 class="text-lg font-bold">System ownership</h3>
          <p class="mt-3 text-sm text-gray-600">The website owns orders and customer service.</p>
          <p class="mt-2 text-sm text-gray-600">Daftra owns stock, invoices and accounting.</p>
        </article>
      </section>
    </template>

    <section v-else-if="activeTab === 'invoices'" class="overflow-hidden rounded-2xl bg-white shadow">
      <div class="border-b border-gray-100 p-5">
        <h3 class="text-xl font-bold">Daftra invoices</h3>
        <p class="mt-1 text-sm text-gray-500">Read-only accounting records.</p>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 text-sm">
          <thead class="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr><th class="px-5 py-3">Invoice</th><th class="px-5 py-3">Website order</th><th class="px-5 py-3">Client</th><th class="px-5 py-3">Date</th><th class="px-5 py-3">Total</th><th class="px-5 py-3">Status</th><th class="px-5 py-3"></th></tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-for="invoice in response.items || []" :key="invoice.id">
              <td class="whitespace-nowrap px-5 py-4 font-bold text-gray-900">{{ invoice.number || invoice.id }}</td>
              <td class="whitespace-nowrap px-5 py-4 text-gray-600">{{ invoice.orderNumber || '—' }}</td>
              <td class="px-5 py-4 text-gray-700">{{ invoice.client || '—' }}</td>
              <td class="whitespace-nowrap px-5 py-4 text-gray-600">{{ invoice.date || '—' }}</td>
              <td class="whitespace-nowrap px-5 py-4 font-semibold">{{ formatMoney(invoice.total, invoice.currency) }}</td>
              <td class="px-5 py-4"><span class="rounded-full px-2.5 py-1 text-xs font-bold" :class="invoice.draft ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'">{{ invoice.draft ? 'Draft' : 'Issued' }}</span></td>
              <td class="px-5 py-4 text-right"><a v-if="invoice.pdfUrl" :href="invoice.pdfUrl" target="_blank" rel="noopener noreferrer" class="font-bold text-blue-700">PDF</a></td>
            </tr>
            <tr v-if="!response.items?.length"><td colspan="7" class="px-5 py-10 text-center text-gray-500">No invoices found.</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-else-if="activeTab === 'inventory'" class="overflow-hidden rounded-2xl bg-white shadow">
      <div class="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 p-5">
        <div><h3 class="text-xl font-bold">Daftra stock</h3><p class="mt-1 text-sm text-gray-500">Stock and costs come from Daftra.</p></div>
        <button v-if="canEditProducts" type="button" class="rounded-xl bg-black px-4 py-2 text-sm font-bold text-white disabled:opacity-50" :disabled="importingInventory" @click="importInventory">{{ importingInventory ? 'Updating...' : 'Update website stock' }}</button>
      </div>
      <p v-if="inventoryMessage" class="m-5 rounded-xl bg-green-50 p-4 text-sm text-green-700">{{ inventoryMessage }}</p>
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 text-sm">
          <thead class="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr><th class="px-5 py-3">Product</th><th class="px-5 py-3">Code</th><th class="px-5 py-3">Stock</th><th class="px-5 py-3">Price</th><th class="px-5 py-3">Cost</th></tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-for="product in response.items || []" :key="product.id">
              <td class="px-5 py-4 font-bold text-gray-900">{{ product.name }}</td>
              <td class="whitespace-nowrap px-5 py-4 text-gray-600">{{ product.code || '—' }}</td>
              <td class="whitespace-nowrap px-5 py-4 font-bold">{{ product.stock }}</td>
              <td class="whitespace-nowrap px-5 py-4">{{ formatMoney(product.price, 'EGP') }}</td>
              <td class="whitespace-nowrap px-5 py-4">{{ formatMoney(product.cost, 'EGP') }}</td>
            </tr>
            <tr v-if="!response.items?.length"><td colspan="5" class="px-5 py-10 text-center text-gray-500">No products found.</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-else class="overflow-hidden rounded-2xl bg-white shadow">
      <div class="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 p-5">
        <div><h3 class="text-xl font-bold">Sync queue</h3><p class="mt-1 text-sm text-gray-500">Orders retry safely after failures.</p></div>
        <button v-if="canSyncOrders" type="button" class="rounded-xl bg-black px-4 py-2 text-sm font-bold text-white disabled:opacity-50" :disabled="syncing" @click="processNextJob(null, false)">{{ syncing ? 'Syncing...' : 'Process next' }}</button>
      </div>
      <div class="divide-y divide-gray-100">
        <article v-for="job in response.items || []" :key="job.id" class="flex flex-wrap items-center gap-4 p-5">
          <div class="min-w-0 flex-1">
            <p class="font-bold text-gray-900">{{ job.orderNumber || job.local_id }}</p>
            <p class="mt-1 text-xs text-gray-500">{{ job.operation }} · Attempt {{ job.attempts }}/{{ job.max_attempts }}</p>
            <p v-if="job.last_error" class="mt-2 text-sm text-red-700">{{ job.last_error }}</p>
          </div>
          <span class="rounded-full px-3 py-1 text-xs font-bold" :class="jobStatusClass(job.status)">{{ job.status }}</span>
          <button v-if="canSyncOrders && job.status === 'failed'" type="button" class="rounded-lg border px-3 py-2 text-sm font-bold" :disabled="syncing" @click="processNextJob(job.id, true)">Retry</button>
        </article>
        <p v-if="!response.items?.length" class="p-10 text-center text-sm text-gray-500">The sync queue is empty.</p>
      </div>
    </section>

    <nav v-if="totalPages > 1" class="flex items-center justify-center gap-3" aria-label="Daftra pages">
      <button type="button" class="rounded-lg border bg-white px-4 py-2 text-sm font-bold disabled:opacity-40" :disabled="page <= 1 || loading" @click="changePage(page - 1)">Previous</button>
      <span class="text-sm text-gray-600">Page {{ page }} of {{ totalPages }}</span>
      <button type="button" class="rounded-lg border bg-white px-4 py-2 text-sm font-bold disabled:opacity-40" :disabled="page >= totalPages || loading" @click="changePage(page + 1)">Next</button>
    </nav>
  </div>
</template>

<script setup>
import { getDashboardQueryValue } from '~/utils/dashboardNavigation'

definePageMeta({ layout: 'dashboard' })

const route = useRoute()
const supabase = useSupabaseClient()
const { hasPermission } = useAdminAccess()
const response = ref({})
const loading = ref(false)
const loaded = ref(false)
const syncing = ref(false)
const importingInventory = ref(false)
const inventoryMessage = ref('')
const errorMessage = ref('')
const page = ref(1)
const validTabs = new Set(['overview', 'invoices', 'inventory', 'sync'])
const activeTab = computed(() => {
  const tab = getDashboardQueryValue(route, 'tab') || 'overview'
  return validTabs.has(tab) ? tab : 'overview'
})
const canSyncOrders = computed(() => hasPermission('dashboard.orders'))
const canEditProducts = computed(() => hasPermission('products.edit'))
const totalPages = computed(() => Number(response.value.pagination?.page_count || 1))
const overviewCards = computed(() => [
  { key: 'clients', label: 'Clients', icon: 'lucide:users', ...response.value.overview?.clients },
  { key: 'products', label: 'Products', icon: 'lucide:boxes', ...response.value.overview?.products },
  { key: 'invoices', label: 'Invoices', icon: 'lucide:receipt-text', ...response.value.overview?.invoices },
  { key: 'stores', label: 'Warehouses', icon: 'lucide:warehouse', ...response.value.overview?.stores }
])

const getAuthHeaders = async () => {
  const { data } = await supabase.auth.getSession()
  if (!data.session?.access_token) throw new Error('Your session expired. Sign in again.')
  return { authorization: `Bearer ${data.session.access_token}` }
}

const loadData = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    response.value = await $fetch('/api/admin-erp/dashboard', {
      headers: await getAuthHeaders(),
      query: { tab: activeTab.value, page: page.value }
    })
    loaded.value = true
  } catch (error) {
    errorMessage.value = error?.data?.statusMessage || error?.message || 'Could not load Daftra data.'
  } finally {
    loading.value = false
  }
}

const processNextJob = async (jobId, retry) => {
  syncing.value = true
  errorMessage.value = ''
  try {
    await $fetch('/api/admin-erp/sync', {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: { jobId, retry }
    })
    await loadData()
  } catch (error) {
    errorMessage.value = error?.data?.statusMessage || error?.message || 'Could not synchronize this order.'
    await loadData()
  } finally {
    syncing.value = false
  }
}

const importInventory = async () => {
  importingInventory.value = true
  inventoryMessage.value = ''
  errorMessage.value = ''
  try {
    const result = await $fetch('/api/admin-erp/sync', {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: { action: 'inventory' }
    })
    const inventory = result.inventory || {}
    inventoryMessage.value = `Updated ${inventory.updated || 0} products. ${inventory.unmatched || 0} need SKU mapping.`
    await loadData()
    await refreshNuxtData('products')
  } catch (error) {
    errorMessage.value = error?.data?.statusMessage || error?.message || 'Could not update website stock.'
  } finally {
    importingInventory.value = false
  }
}

const changePage = async (nextPage) => {
  page.value = nextPage
  await loadData()
}

const formatMoney = (amount, currency) => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'EGP',
      maximumFractionDigits: 2
    }).format(Number(amount || 0))
  } catch {
    return `${Number(amount || 0).toFixed(2)} ${currency || 'EGP'}`
  }
}

const jobStatusClass = (status) => ({
  completed: 'bg-green-100 text-green-700',
  processing: 'bg-blue-100 text-blue-700',
  pending: 'bg-amber-100 text-amber-700',
  failed: 'bg-red-100 text-red-700'
})[status] || 'bg-gray-100 text-gray-600'

watch(activeTab, async () => {
  page.value = 1
  await loadData()
})

onMounted(loadData)
</script>
