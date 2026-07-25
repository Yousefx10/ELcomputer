<template>
  <div class="space-y-6">
    <section class="rounded-2xl bg-white p-6 shadow">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 class="text-2xl font-bold">Serialized Items</h3>
          <p class="mt-1 max-w-2xl text-sm text-gray-500">
            Find individual units created by Procurement and print secure QR labels for warehouse use.
          </p>
        </div>

        <div class="grid gap-3 sm:grid-cols-3">
          <div class="rounded-2xl bg-gray-100 px-4 py-3">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Total Units</p>
            <p class="mt-2 text-2xl font-bold text-gray-900">{{ pagination.total }}</p>
          </div>

          <div class="rounded-2xl bg-gray-100 px-4 py-3">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">This Page</p>
            <p class="mt-2 text-2xl font-bold text-gray-900">{{ items.length }}</p>
          </div>

          <div class="rounded-2xl bg-gray-100 px-4 py-3">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Labels Selected</p>
            <p class="mt-2 text-2xl font-bold text-gray-900">{{ selectedItemCount }}</p>
          </div>
        </div>
      </div>
    </section>

    <div
      v-if="pageError || optionsError"
      class="rounded-2xl bg-red-50 p-4 text-sm text-red-700 shadow"
      role="alert"
    >
      {{ pageError || optionsError }}
    </div>

    <section class="rounded-2xl border border-blue-100 bg-blue-50 p-6 shadow">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 class="text-xl font-bold text-gray-900">Stock is created through Procurement</h3>
          <p class="mt-1 max-w-3xl text-sm text-gray-600">
            Products and variants are catalog references only. Enter received quantities in a Procurement order;
            the system creates one item ID and QR code for every physical unit.
          </p>
        </div>

        <NuxtLink
          to="/dashboard/commerce?tab=procurement"
          class="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <Icon name="lucide:shopping-cart" size="17" />
          Open Procurement
        </NuxtLink>
      </div>
    </section>

    <section class="rounded-2xl bg-white p-5 shadow">
      <div class="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 class="text-2xl font-bold">Inventory Units</h3>
          <p class="mt-1 text-sm text-gray-500">
            Search by item code or QR token, then narrow the results with the available filters.
          </p>
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            v-if="selectedItemCount"
            type="button"
            :disabled="printingLabels"
            class="inline-flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
            @click="printSelectedLabels"
          >
            <Icon name="lucide:printer" size="17" />
            {{ printingLabels ? 'Preparing...' : `Print ${selectedItemCount} Labels` }}
          </button>

          <button
            v-if="selectedItemCount"
            type="button"
            :disabled="printingLabels"
            class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-60"
            @click="clearSelectedItems"
          >
            Clear Selection
          </button>
        </div>
      </div>

      <p v-if="printError" class="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">
        {{ printError }}
      </p>

      <form
        class="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_190px_220px_220px_auto]"
        @submit.prevent="applyFilters"
      >
        <div>
          <label for="serialized-search" class="mb-2 block text-sm font-semibold text-gray-700">
            Search Items
          </label>
          <input
            id="serialized-search"
            v-model="filterForm.search"
            type="search"
            placeholder="Item code or QR token"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          >
        </div>

        <div>
          <label for="serialized-status" class="mb-2 block text-sm font-semibold text-gray-700">
            Status
          </label>
          <select
            id="serialized-status"
            v-model="filterForm.status"
            class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500"
          >
            <option value="">All statuses</option>
            <option
              v-for="statusOption in serializedItemStatusOptions"
              :key="statusOption.value"
              :value="statusOption.value"
            >
              {{ statusOption.label }}
            </option>
          </select>
        </div>

        <div>
          <label for="serialized-product-filter" class="mb-2 block text-sm font-semibold text-gray-700">
            Product
          </label>
          <select
            id="serialized-product-filter"
            v-model="filterForm.product_id"
            class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500"
          >
            <option value="">All products</option>
            <option
              v-for="product in productOptions"
              :key="product.id"
              :value="product.id"
            >
              {{ product.title }}
            </option>
          </select>
        </div>

        <div>
          <label for="serialized-warehouse-filter" class="mb-2 block text-sm font-semibold text-gray-700">
            Warehouse
          </label>
          <select
            id="serialized-warehouse-filter"
            v-model="filterForm.warehouse_id"
            class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500"
          >
            <option value="">All warehouses</option>
            <option
              v-for="warehouse in warehouseOptions"
              :key="warehouse.id"
              :value="warehouse.id"
            >
              {{ warehouse.name }}
            </option>
          </select>
        </div>

        <div class="flex items-end gap-2">
          <button
            type="submit"
            :disabled="loading"
            class="flex-1 rounded-lg bg-black px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Apply
          </button>

          <button
            v-if="hasActiveFilters"
            type="button"
            :disabled="loading"
            class="flex-1 rounded-lg border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
            @click="clearFilters"
          >
            Clear
          </button>
        </div>
      </form>

      <div
        v-if="loading"
        class="rounded-xl border border-dashed p-8 text-center text-gray-500"
      >
        Loading serialized inventory...
      </div>

      <div
        v-else-if="!items.length"
        class="rounded-xl border border-dashed p-8 text-center"
      >
        <h4 class="text-xl font-bold text-gray-900">
          {{ hasActiveFilters ? 'No matching units' : 'No serialized units yet' }}
        </h4>
        <p class="mt-2 text-sm text-gray-500">
          {{ hasActiveFilters
            ? 'Try a different search term or status.'
            : 'Receive a Procurement order to create the first item IDs and QR codes.' }}
        </p>
      </div>

      <div v-else>
        <div class="mb-4 flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <label class="inline-flex items-center gap-3 text-sm font-semibold text-gray-700">
            <input
              type="checkbox"
              :checked="allPageItemsSelected"
              class="h-4 w-4 rounded border-gray-300"
              @change="toggleAllPageItems"
            >
            Select all printable units on this page
          </label>

          <p class="text-sm text-gray-500">
            Showing {{ pageStart }}-{{ pageEnd }} of {{ pagination.total }} ·
            Page {{ pagination.page }} of {{ pagination.totalPages }}
          </p>
        </div>

        <div class="overflow-x-auto rounded-2xl border">
          <table class="min-w-full divide-y divide-gray-200 text-left text-sm">
            <thead class="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th class="w-12 px-4 py-3"><span class="sr-only">Select</span></th>
                <th class="px-4 py-3 font-semibold">Unit</th>
                <th class="px-4 py-3 font-semibold">Product / Variant</th>
                <th class="px-4 py-3 font-semibold">Status</th>
                <th class="px-4 py-3 font-semibold">Location / Order</th>
                <th class="px-4 py-3 font-semibold">Dates</th>
                <th class="px-4 py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>

            <tbody class="divide-y divide-gray-100 bg-white">
              <tr v-for="item in items" :key="item.id" class="align-top hover:bg-gray-50">
                <td class="px-4 py-4">
                  <input
                    type="checkbox"
                    :checked="isItemSelected(item.id)"
                    :disabled="!item.qrToken"
                    :aria-label="`Select label for ${item.unitCode}`"
                    class="h-4 w-4 rounded border-gray-300 disabled:cursor-not-allowed disabled:opacity-40"
                    @change="toggleSelectedItem(item)"
                  >
                </td>

                <td class="px-4 py-4">
                  <p class="font-mono font-bold text-gray-900">{{ item.unitCode }}</p>
                  <p v-if="item.qrToken" class="mt-1 text-xs text-gray-400">
                    QR {{ getTokenPreview(item.qrToken) }}
                  </p>
                  <p v-else class="mt-1 text-xs font-medium text-red-500">No QR token</p>
                </td>

                <td class="max-w-xs px-4 py-4">
                  <p class="font-bold text-gray-900">{{ item.product.title }}</p>
                  <p class="mt-1 text-gray-600">
                    {{ item.variant.name || 'Default variant' }}
                  </p>
                  <p v-if="item.variant.sku || item.product.sku" class="mt-1 text-xs text-gray-400">
                    SKU {{ item.variant.sku || item.product.sku }}
                  </p>
                  <div v-if="item.variant.colorName || item.variant.colorHex" class="mt-2 flex items-center gap-2 text-xs text-gray-500">
                    <span
                      v-if="isValidHexColor(item.variant.colorHex)"
                      class="h-3 w-3 rounded-full border"
                      :style="{ backgroundColor: item.variant.colorHex }"
                      aria-hidden="true"
                    />
                    <span>{{ item.variant.colorName || item.variant.colorHex }}</span>
                  </div>
                </td>

                <td class="px-4 py-4">
                  <span
                    class="inline-flex rounded-full px-3 py-1 text-xs font-semibold"
                    :class="getSerializedItemStatusClass(item.status)"
                  >
                    {{ formatSerializedItemStatus(item.status) }}
                  </span>
                  <p v-if="item.customerName" class="mt-2 max-w-40 text-xs text-gray-500">
                    {{ item.customerName }}
                  </p>
                </td>

                <td class="px-4 py-4">
                  <p class="font-medium text-gray-700">{{ item.warehouse.name || 'No warehouse' }}</p>
                  <p v-if="item.order.orderNumber" class="mt-1 text-xs text-gray-500">
                    {{ item.order.orderNumber }}
                  </p>
                  <p v-else class="mt-1 text-xs text-gray-400">No linked order</p>
                </td>

                <td class="whitespace-nowrap px-4 py-4 text-xs text-gray-500">
                  <p>Created {{ formatCommerceDate(item.createdAt) }}</p>
                  <p v-if="item.soldAt" class="mt-1">Sold {{ formatCommerceDate(item.soldAt) }}</p>
                  <p v-if="item.returnedAt" class="mt-1">Returned {{ formatCommerceDate(item.returnedAt) }}</p>
                </td>

                <td class="px-4 py-4 text-right">
                  <NuxtLink
                    v-if="item.qrToken"
                    :to="{
                      path: '/dashboard/commerce',
                      query: { tab: 'scan', token: item.qrToken }
                    }"
                    class="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                  >
                    <Icon name="lucide:scan-line" size="16" />
                    View
                  </NuxtLink>
                  <span v-else class="text-xs text-gray-400">Unavailable</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="mt-5 flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            :disabled="pagination.page <= 1 || loading"
            class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            @click="loadItems(pagination.page - 1)"
          >
            Previous
          </button>

          <p class="text-center text-sm text-gray-500">
            Page {{ pagination.page }} of {{ pagination.totalPages }}
          </p>

          <button
            type="button"
            :disabled="pagination.page >= pagination.totalPages || loading"
            class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            @click="loadItems(pagination.page + 1)"
          >
            Next
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import {
  formatCommerceDate,
  formatSerializedItemStatus,
  getSerializedItemStatusClass,
  serializedItemStatusOptions
} from '~/utils/commerce'

defineOptions({
  name: 'DashboardCommerceSerializedItemsTab'
})

const supabase = useSupabaseClient()
const route = useRoute()

const items = ref([])
const loading = ref(true)
const pageError = ref('')
const optionsError = ref('')
const printError = ref('')
const printingLabels = ref(false)
const selectedItemsById = ref(new Map())
const pageSize = 20

const pagination = reactive({
  page: 1,
  pageSize,
  total: 0,
  totalPages: 1
})

const filterForm = reactive({
  search: '',
  status: '',
  product_id: '',
  warehouse_id: ''
})

const appliedFilters = reactive({
  search: '',
  status: '',
  product_id: '',
  warehouse_id: ''
})

const catalogLoading = ref(false)
const catalogLoaded = ref(false)
const productOptions = ref([])
const warehouseOptions = ref([])

const selectedItemCount = computed(() => selectedItemsById.value.size)
const printablePageItems = computed(() => items.value.filter((item) => item.qrToken))
const allPageItemsSelected = computed(() => {
  return Boolean(
    printablePageItems.value.length
    && printablePageItems.value.every((item) => selectedItemsById.value.has(item.id))
  )
})

const hasActiveFilters = computed(() => {
  return Boolean(
    appliedFilters.search
    || appliedFilters.status
    || appliedFilters.product_id
    || appliedFilters.warehouse_id
  )
})

const pageStart = computed(() => {
  if (!pagination.total) {
    return 0
  }

  return ((pagination.page - 1) * pagination.pageSize) + 1
})

const pageEnd = computed(() => {
  return Math.min(pagination.page * pagination.pageSize, pagination.total)
})

const getAdminAuthHeaders = async () => {
  const { data } = await supabase.auth.getSession()

  if (!data.session?.access_token) {
    throw new Error('Your session expired. Please log in again.')
  }

  return {
    authorization: `Bearer ${data.session.access_token}`
  }
}

const getRelatedRecord = (record, keys = []) => {
  for (const key of keys) {
    const relatedValue = record?.[key]

    if (Array.isArray(relatedValue)) {
      if (relatedValue[0]) {
        return relatedValue[0]
      }

      continue
    }

    if (relatedValue && typeof relatedValue === 'object') {
      return relatedValue
    }
  }

  return {}
}

const normalizeItem = (record = {}) => {
  const product = getRelatedRecord(record, ['product', 'products'])
  const variant = getRelatedRecord(record, ['variant', 'product_variant', 'product_variants'])
  const warehouse = getRelatedRecord(record, ['warehouse', 'commerce_warehouses'])
  const order = getRelatedRecord(record, ['order', 'customer_order', 'customer_orders'])

  return {
    id: String(record.id || ''),
    unitCode: String(record.unit_code || record.unitCode || record.serial_number || 'Unassigned'),
    qrToken: String(record.qr_token || record.qrToken || record.public_token || ''),
    status: String(record.status || 'unknown').trim().toLowerCase(),
    createdAt: String(record.created_at || record.createdAt || ''),
    soldAt: String(record.sold_at || record.soldAt || ''),
    returnedAt: String(record.returned_at || record.returnedAt || ''),
    customerName: String(record.customer_name || record.customerName || ''),
    product: {
      id: String(product.id || record.product_id || ''),
      title: String(product.title || record.product_title || 'Unknown product'),
      sku: String(product.sku || record.product_sku || '')
    },
    variant: {
      id: String(variant.id || record.variant_id || ''),
      name: String(variant.name || record.variant_name || ''),
      code: String(variant.code || record.variant_code || ''),
      sku: String(variant.sku || record.variant_sku || ''),
      colorName: String(variant.color_name || variant.colorName || record.color_name || ''),
      colorHex: String(variant.color_hex || variant.colorHex || record.color_hex || '')
    },
    warehouse: {
      id: String(warehouse.id || record.warehouse_id || ''),
      name: String(warehouse.name || record.warehouse_name || '')
    },
    order: {
      id: String(order.id || record.order_id || ''),
      orderNumber: String(order.order_number || order.orderNumber || record.order_number || '')
    }
  }
}

const normalizeItemsResponse = (response, requestedPage) => {
  const payload = response?.data && typeof response.data === 'object'
    ? response.data
    : response || {}
  const records = Array.isArray(payload.items)
    ? payload.items
    : Array.isArray(payload.data)
      ? payload.data
      : []
  const responsePagination = payload.pagination || {}
  const total = Number(responsePagination.total ?? payload.total ?? records.length)
  const resolvedPageSize = Number(responsePagination.pageSize ?? responsePagination.page_size ?? payload.pageSize ?? pageSize)
  const resolvedPage = Number(responsePagination.page ?? payload.page ?? requestedPage)
  const totalPages = Number(
    responsePagination.totalPages
    ?? responsePagination.total_pages
    ?? payload.totalPages
    ?? Math.ceil(total / Math.max(1, resolvedPageSize))
  )

  return {
    records,
    pagination: {
      page: Number.isInteger(resolvedPage) && resolvedPage > 0 ? resolvedPage : requestedPage,
      pageSize: Number.isInteger(resolvedPageSize) && resolvedPageSize > 0 ? resolvedPageSize : pageSize,
      total: Number.isFinite(total) && total >= 0 ? total : records.length,
      totalPages: Number.isInteger(totalPages) && totalPages > 0 ? totalPages : 1
    }
  }
}

const loadItems = async (page = pagination.page) => {
  const requestedPage = Math.max(1, Number(page) || 1)
  loading.value = true
  pageError.value = ''

  try {
    const response = await $fetch('/api/admin-inventory/items', {
      query: {
        page: requestedPage,
        pageSize,
        search: appliedFilters.search || undefined,
        status: appliedFilters.status || undefined,
        product_id: appliedFilters.product_id || undefined,
        warehouse_id: appliedFilters.warehouse_id || undefined
      },
      headers: await getAdminAuthHeaders()
    })

    const normalizedResponse = normalizeItemsResponse(response, requestedPage)
    items.value = normalizedResponse.records.map(normalizeItem).filter((item) => item.id)
    Object.assign(pagination, normalizedResponse.pagination)

    if (pagination.page > pagination.totalPages) {
      await loadItems(pagination.totalPages)
      return
    }

    if (selectedItemsById.value.size) {
      const nextSelection = new Map(selectedItemsById.value)
      items.value.forEach((item) => {
        if (nextSelection.has(item.id)) {
          nextSelection.set(item.id, item)
        }
      })
      selectedItemsById.value = nextSelection
    }
  } catch (error) {
    items.value = []
    pagination.total = 0
    pagination.totalPages = 1
    pagination.page = requestedPage
    pageError.value = error?.data?.statusMessage || error?.message || 'Could not load serialized inventory.'
  } finally {
    loading.value = false
  }
}

const applyFilters = async () => {
  appliedFilters.search = String(filterForm.search || '').trim()
  appliedFilters.status = String(filterForm.status || '').trim()
  appliedFilters.product_id = String(filterForm.product_id || '').trim()
  appliedFilters.warehouse_id = String(filterForm.warehouse_id || '').trim()
  await loadItems(1)
}

const clearFilters = async () => {
  filterForm.search = ''
  filterForm.status = ''
  filterForm.product_id = ''
  filterForm.warehouse_id = ''
  appliedFilters.search = ''
  appliedFilters.status = ''
  appliedFilters.product_id = ''
  appliedFilters.warehouse_id = ''
  await loadItems(1)
}

const isItemSelected = (itemId) => {
  return selectedItemsById.value.has(itemId)
}

const toggleSelectedItem = (item) => {
  if (!item?.id || !item.qrToken) {
    return
  }

  const nextSelection = new Map(selectedItemsById.value)

  if (nextSelection.has(item.id)) {
    nextSelection.delete(item.id)
  } else {
    nextSelection.set(item.id, item)
  }

  selectedItemsById.value = nextSelection
  printError.value = ''
}

const toggleAllPageItems = () => {
  const nextSelection = new Map(selectedItemsById.value)

  if (allPageItemsSelected.value) {
    printablePageItems.value.forEach((item) => nextSelection.delete(item.id))
  } else {
    printablePageItems.value.forEach((item) => nextSelection.set(item.id, item))
  }

  selectedItemsById.value = nextSelection
  printError.value = ''
}

const clearSelectedItems = () => {
  selectedItemsById.value = new Map()
  printError.value = ''
}

const getTokenPreview = (token) => {
  const normalizedToken = String(token || '')

  if (normalizedToken.length <= 10) {
    return normalizedToken
  }

  return `…${normalizedToken.slice(-10)}`
}

const isValidHexColor = (value) => {
  return /^#[0-9a-f]{6}$/i.test(String(value || '').trim())
}

const escapeHtml = (value) => {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

const buildScanUrl = (token) => {
  const url = new URL('/dashboard/commerce', window.location.origin)
  url.searchParams.set('tab', 'scan')
  url.searchParams.set('token', token)
  return url.toString()
}

const printSelectedLabels = async () => {
  if (!import.meta.client || printingLabels.value) {
    return
  }

  const selectedItems = Array.from(selectedItemsById.value.values()).filter((item) => item.qrToken)

  if (!selectedItems.length) {
    printError.value = 'Select at least one item with a QR token.'
    return
  }

  const printWindow = window.open('', 'serialized-item-labels', 'width=980,height=760')

  if (!printWindow) {
    printError.value = 'The print window was blocked. Allow pop-ups for this dashboard and try again.'
    return
  }

  printWindow.opener = null
  printWindow.document.write('<p style="font-family: sans-serif; padding: 24px;">Preparing QR labels...</p>')
  printWindow.document.close()

  printingLabels.value = true
  printError.value = ''

  try {
    const qrCodeModule = await import('qrcode')
    const toDataURL = qrCodeModule.toDataURL || qrCodeModule.default?.toDataURL

    if (typeof toDataURL !== 'function') {
      throw new Error('QR label generation is not available in this build.')
    }

    const printableLabels = await Promise.all(selectedItems.map(async (item) => {
      const qrImage = await toDataURL(buildScanUrl(item.qrToken), {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 280
      })

      return {
        ...item,
        qrImage
      }
    }))

    const labelsHtml = printableLabels.map((item) => {
      const variantLabel = item.variant.name || 'Default variant'
      const sku = item.variant.sku || item.product.sku

      return `
        <article class="label">
          <img class="qr" src="${item.qrImage}" alt="">
          <div class="details">
            <h1>${escapeHtml(item.product.title)}</h1>
            <p>${escapeHtml(variantLabel)}</p>
            <p class="unit">${escapeHtml(item.unitCode)}</p>
            ${sku ? `<p>SKU ${escapeHtml(sku)}</p>` : ''}
            <p>${escapeHtml(formatSerializedItemStatus(item.status))}</p>
          </div>
        </article>
      `
    }).join('')

    printWindow.document.open()
    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Serialized Item Labels</title>
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              padding: 10mm;
              color: #111827;
              font-family: Arial, sans-serif;
            }
            .sheet {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 6mm;
            }
            .label {
              display: grid;
              grid-template-columns: 38mm minmax(0, 1fr);
              align-items: center;
              min-height: 45mm;
              border: 1px solid #d1d5db;
              border-radius: 3mm;
              padding: 3mm;
              break-inside: avoid;
            }
            .qr { display: block; width: 36mm; height: 36mm; }
            .details { min-width: 0; padding-left: 3mm; }
            h1 {
              margin: 0 0 2mm;
              font-size: 11pt;
              line-height: 1.25;
              overflow-wrap: anywhere;
            }
            p {
              margin: 1mm 0;
              color: #4b5563;
              font-size: 8.5pt;
              line-height: 1.25;
              overflow-wrap: anywhere;
            }
            .unit {
              color: #111827;
              font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
              font-size: 10pt;
              font-weight: 700;
            }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <main class="sheet">${labelsHtml}</main>
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    window.setTimeout(() => printWindow.print(), 250)
  } catch (error) {
    printWindow.close()
    printError.value = error?.message
      || 'QR label generation is unavailable. Install the qrcode package and rebuild the dashboard.'
  } finally {
    printingLabels.value = false
  }
}

const loadFilterOptions = async () => {
  if (catalogLoaded.value || catalogLoading.value) {
    return
  }

  catalogLoading.value = true
  optionsError.value = ''

  try {
    const response = await $fetch('/api/admin-inventory/options', {
      headers: await getAdminAuthHeaders()
    })
    const payload = response?.data && typeof response.data === 'object'
      ? response.data
      : response || {}

    productOptions.value = (Array.isArray(payload.products) ? payload.products : []).map((product) => ({
      id: String(product.id || ''),
      title: String(product.title || 'Untitled product'),
      sku: String(product.sku || '')
    })).filter((product) => product.id)

    warehouseOptions.value = (Array.isArray(payload.warehouses) ? payload.warehouses : []).map((warehouse) => ({
      id: String(warehouse.id || ''),
      name: String(warehouse.name || 'Unnamed warehouse'),
      code: String(warehouse.code || '')
    })).filter((warehouse) => warehouse.id)

    catalogLoaded.value = true
  } catch (error) {
    optionsError.value = error?.data?.statusMessage || error?.message || 'Could not load inventory filters.'
  } finally {
    catalogLoading.value = false
  }
}

onMounted(async () => {
  const routeProduct = Array.isArray(route.query.product)
    ? route.query.product[0]
    : route.query.product
  const routeProductId = String(routeProduct || '').trim()

  if (routeProductId) {
    filterForm.product_id = routeProductId
    appliedFilters.product_id = routeProductId
  }

  await Promise.all([
    loadItems(1),
    loadFilterOptions()
  ])
})
</script>
