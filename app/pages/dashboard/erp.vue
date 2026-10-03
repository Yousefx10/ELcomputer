<template>
  <div class="mx-auto max-w-6xl space-y-6">
    <DashboardPageIntro
      :title="$t('common.daftraErp')"
      :description="$t('interface.liveErpDataWithWebsiteOrdersKeptLocal')"
      layout-class="flex flex-wrap items-start justify-between gap-4"
    >
      <template #actions>
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          :disabled="loading"
          @click="loadData"
        >
          <Icon name="lucide:refresh-cw" size="17" :class="loading ? 'animate-spin' : ''" />
          {{ $t('common.refresh') }}
        </button>
      </template>
    </DashboardPageIntro>

    <DashboardSecondaryNav />
    <NuxtLinkLocale v-if="hasPermission('settings.view')" to="/dashboard/settings?tab=erp" class="inline-flex text-sm font-bold text-blue-700">{{ $t('erp.openSettings') }}</NuxtLinkLocale>

    <p v-if="errorMessage" class="rounded-2xl bg-red-50 p-5 text-sm text-red-700">
      {{ $uiMessage(errorMessage) }}
    </p>

    <div v-if="loading && !loaded" class="rounded-2xl bg-white p-8 text-sm text-gray-500 shadow">
      {{ $t('common.loadingDaftraData') }}
    </div>

    <template v-else-if="loaded && activeTab === 'overview'">
      <section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardStatCard v-for="card in overviewCards" :key="card.key" :label="$uiLabel(card.label)" :value="card.total ?? '—'" :icon="card.icon" :tone="card.tone" :badge="card.available ? '' : 'Unavailable'" />
      </section>

      <section class="grid gap-4 md:grid-cols-2">
        <article class="rounded-2xl bg-white p-6 shadow">
          <h3 class="text-lg font-bold">{{ $t('common.orderSynchronization') }}</h3>
          <div class="mt-5 grid grid-cols-2 gap-3">
            <div class="rounded-xl bg-amber-50 p-4">
              <p class="text-sm font-semibold text-amber-700">{{ $t('common.pending') }}</p>
              <p class="mt-1 text-2xl font-black text-amber-900">{{ response.sync?.pending || 0 }}</p>
            </div>
            <div class="rounded-xl bg-red-50 p-4">
              <p class="text-sm font-semibold text-red-700">{{ $t('common.failed') }}</p>
              <p class="mt-1 text-2xl font-black text-red-900">{{ response.sync?.failed || 0 }}</p>
            </div>
          </div>
          <NuxtLinkLocale to="/dashboard/erp?tab=sync" class="mt-4 inline-flex items-center gap-2 text-sm font-bold text-blue-700">
            {{ $t('common.openSyncQueue') }} <Icon name="lucide:arrow-right" size="16" class="directional-icon" />
          </NuxtLinkLocale>
        </article>

        <article class="rounded-2xl bg-white p-6 shadow">
          <h3 class="text-lg font-bold">{{ $t('common.systemOwnership') }}</h3>
          <p class="mt-3 text-sm text-gray-600">{{ $t('dashboard.erp.theWebsiteOwnsOrdersAndCustomerService') }}</p>
          <p class="mt-2 text-sm text-gray-600">{{ $t('dashboard.erp.daftraOwnsStockInvoicesAndAccounting') }}</p>
        </article>
      </section>
    </template>

    <section v-else-if="loaded && activeTab === 'invoices'" class="overflow-hidden rounded-2xl bg-white shadow">
      <div class="border-b border-gray-100 p-5">
        <h3 class="text-xl font-bold">{{ $t('common.daftraInvoices') }}</h3>
        <p class="mt-1 text-sm text-gray-500">{{ $t('dashboard.erp.readOnlyAccountingRecords') }}</p>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 text-sm">
          <thead class="bg-gray-50 text-start text-xs uppercase tracking-wide text-gray-500">
            <tr><th class="px-5 py-3">{{ $t('common.invoice') }}</th><th class="px-5 py-3">{{ $t('common.websiteOrder') }}</th><th class="px-5 py-3">{{ $t('common.client') }}</th><th class="px-5 py-3">{{ $t('common.date') }}</th><th class="px-5 py-3">{{ $t('common.total') }}</th><th class="px-5 py-3">{{ $t('common.status') }}</th><th class="px-5 py-3"></th></tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-for="invoice in response.items || []" :key="invoice.id">
              <td class="whitespace-nowrap px-5 py-4 font-bold text-gray-900">{{ invoice.number || invoice.id }}</td>
              <td class="whitespace-nowrap px-5 py-4 text-gray-600">{{ invoice.orderNumber || '—' }}</td>
              <td class="px-5 py-4 text-gray-700">{{ invoice.client || '—' }}</td>
              <td class="whitespace-nowrap px-5 py-4 text-gray-600">{{ invoice.date || '—' }}</td>
              <td class="whitespace-nowrap px-5 py-4 font-semibold">{{ formatMoney(invoice.total, invoice.currency) }}</td>
              <td class="px-5 py-4"><span class="rounded-full px-2.5 py-1 text-xs font-bold" :class="invoice.draft ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'">{{ invoice.draft ? $t('common.draft') : $t('common.issued') }}</span></td>
              <td class="px-5 py-4 text-end"><a v-if="invoice.pdfUrl" :href="invoice.pdfUrl" target="_blank" rel="noopener noreferrer" class="font-bold text-blue-700">PDF</a></td>
            </tr>
            <tr v-if="!response.items?.length"><td colspan="7" class="px-5 py-10 text-center text-gray-500">{{ $t('common.noInvoicesFound') }}</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-else-if="loaded && activeTab === 'inventory'" class="overflow-hidden rounded-2xl bg-white shadow">
      <div class="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 p-5">
        <div><h3 class="text-xl font-bold">{{ $t('common.daftraStock') }}</h3><p class="mt-1 text-sm text-gray-500">{{ $t('dashboard.erp.stockAndCostsComeFromDaftra') }}</p></div>
        <button v-if="canEditProducts" type="button" class="rounded-xl bg-black px-4 py-2 text-sm font-bold text-white disabled:opacity-50" :disabled="importingInventory" @click="importInventory">{{ importingInventory ? $t('common.updating') : $t('erp.queueStock') }}</button>
      </div>
      <div class="flex flex-wrap gap-5 p-5 text-sm text-gray-600"><p>{{ $t('erp.lastStockSuccess') }}: {{ formatDate(response.inventorySync?.lastSuccessfulAt) }}</p><p>{{ $t('erp.stockStatus') }}: {{ response.inventorySync?.status ? $uiLabel(response.inventorySync.status) : '—' }}</p><p v-if="response.inventorySync?.last_error" class="text-red-700">{{ $uiMessage(response.inventorySync.last_error) }}</p></div>
      <p v-if="response.remoteAvailable === false" class="px-5 pb-5 text-sm text-red-700" role="alert">{{ $t('erp.stockUnavailable') }}</p>
      <p v-if="inventoryMessage" class="m-5 rounded-xl bg-green-50 p-4 text-sm text-green-700">{{ inventoryMessage }}</p>
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 text-sm">
          <thead class="bg-gray-50 text-start text-xs uppercase tracking-wide text-gray-500">
            <tr><th class="px-5 py-3">{{ $t('common.product') }}</th><th class="px-5 py-3">{{ $t('common.code') }}</th><th class="px-5 py-3">{{ $t('common.stock') }}</th><th class="px-5 py-3">{{ $t('common.price') }}</th><th class="px-5 py-3">{{ $t('common.cost') }}</th></tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-for="product in response.items || []" :key="product.id">
              <td class="px-5 py-4 font-bold text-gray-900">{{ product.name }}</td>
              <td class="whitespace-nowrap px-5 py-4 text-gray-600">{{ product.code || '—' }}</td>
              <td class="whitespace-nowrap px-5 py-4 font-bold">{{ product.stock }}</td>
              <td class="whitespace-nowrap px-5 py-4">{{ formatMoney(product.price, 'EGP') }}</td>
              <td class="whitespace-nowrap px-5 py-4">{{ formatMoney(product.cost, 'EGP') }}</td>
            </tr>
            <tr v-if="response.remoteAvailable !== false && !response.items?.length"><td colspan="5" class="px-5 py-10 text-center text-gray-500">{{ $t('common.noProductsFound') }}</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-else-if="loaded" class="overflow-hidden rounded-2xl bg-white shadow">
      <div class="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 p-5">
        <div><h3 class="text-xl font-bold">{{ $t('common.syncQueue') }}</h3><p class="mt-1 text-sm text-gray-500">{{ $t('dashboard.erp.ordersRetrySafelyAfterFailures') }}</p></div>
        <button v-if="canProcessJobs" type="button" class="rounded-xl bg-black px-4 py-2 text-sm font-bold text-white disabled:opacity-50" :disabled="syncing" @click="processNextJob(null, false)">{{ syncing ? $t('common.syncing') : $t('common.processNext') }}</button>
      </div>
      <div class="divide-y divide-gray-100">
        <article v-for="job in response.items || []" :key="job.id" class="flex flex-wrap items-center gap-4 p-5">
          <div class="min-w-0 flex-1">
            <p class="font-bold text-gray-900">{{ job.operation === 'inventory.import' ? $t('erp.stockJob') : job.orderNumber || job.local_id }}</p>
            <p class="mt-1 text-xs font-semibold text-blue-700">{{ $t(job.operation === 'inventory.import' ? 'erp.fromDaftra' : 'erp.toDaftra') }}</p>
            <p class="mt-1 text-xs text-gray-500">{{ $t('dashboard.erp.valueAttemptValueValue' , { value0: (job.operation), value1: (job.attempts), value2: (job.max_attempts) }) }}</p>
            <p v-if="job.last_error" class="mt-2 text-sm text-red-700">{{ job.last_error }}</p>
          </div>
          <span class="rounded-full px-3 py-1 text-xs font-bold" :class="jobStatusClass(job.status)">{{ $uiLabel(job.status) }}</span>
          <button v-if="(job.operation === 'inventory.import' ? canEditProducts : canSyncOrders) && job.status === 'failed'" type="button" class="rounded-lg border px-3 py-2 text-sm font-bold" :disabled="syncing" @click="processNextJob(job.id, true)">{{ $t('common.retry') }}</button>
        </article>
        <p v-if="!response.items?.length" class="p-10 text-center text-sm text-gray-500">{{ $t('dashboard.erp.theSyncQueueIsEmpty') }}</p>
      </div>
    </section>

    <nav v-if="totalPages > 1" class="flex items-center justify-center gap-3" :aria-label="$t('common.daftraPages')">
      <button type="button" class="rounded-lg border bg-white px-4 py-2 text-sm font-bold disabled:opacity-40" :disabled="page <= 1 || loading" @click="changePage(page - 1)">{{ $t('common.previous') }}</button>
      <span class="text-sm text-gray-600">{{ $t('common.pageValueOfValue', { value0: (page), value1: (totalPages) }) }}</span>
      <button type="button" class="rounded-lg border bg-white px-4 py-2 text-sm font-bold disabled:opacity-40" :disabled="page >= totalPages || loading" @click="changePage(page + 1)">{{ $t('common.next') }}</button>
    </nav>
  </div>
</template>

<script setup>
const { t } = useI18n()
const { intlLocale, uiLabel } = useUiLocale()

import { getDashboardQueryValue } from '~/utils/dashboardNavigation'

definePageMeta({ layout: 'dashboard' })

const route = useUiRoute()
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
const canProcessJobs = computed(() => canSyncOrders.value || canEditProducts.value)
const totalPages = computed(() => Number(response.value.pagination?.page_count || 1))
const overviewCards = computed(() => [
  { key: 'clients', label: 'Clients', icon: 'lucide:users', tone: 'blue', ...response.value.overview?.clients },
  { key: 'products', label: 'Products', icon: 'lucide:boxes', tone: 'emerald', ...response.value.overview?.products },
  { key: 'invoices', label: 'Invoices', icon: 'lucide:receipt-text', tone: 'violet', ...response.value.overview?.invoices },
  { key: 'stores', label: 'Warehouses', icon: 'lucide:warehouse', tone: 'amber', ...response.value.overview?.stores }
])

const getAuthHeaders = async () => {
  const { data } = await supabase.auth.getSession()
  if (!data.session?.access_token) throw new Error('Your session expired. Sign in again.')
  return { authorization: `Bearer ${data.session.access_token}` }
}

const { data: activeErp } = await useActiveErp()
const formatDate = value => value ? new Intl.DateTimeFormat(intlLocale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—'
const loadData = async () => {
  if (activeErp.value?.mode !== 'daftra') { errorMessage.value = activeErp.value ? uiLabel('Active ERP: Built-in ERP') : t('erp.unavailable'); return }
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
    inventoryMessage.value = uiLabel('Stock refresh queued. Check the sync queue.')
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
    return new Intl.NumberFormat(intlLocale.value, {
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
