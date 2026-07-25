<template>
  <div class="space-y-6">
    <section class="rounded-2xl bg-white p-6 shadow">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 class="text-2xl font-bold">Procurement</h3>
          <p class="mt-1 text-sm text-gray-500">
            Receive physical items from suppliers. Every received unit gets its own item ID and QR code.
          </p>
        </div>

        <div class="grid gap-3 sm:grid-cols-3">
          <div class="rounded-2xl bg-gray-100 px-4 py-3">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Suppliers</p>
            <p class="mt-2 text-2xl font-bold text-gray-900">{{ suppliers.length }}</p>
          </div>

          <div class="rounded-2xl bg-gray-100 px-4 py-3">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Warehouses</p>
            <p class="mt-2 text-2xl font-bold text-gray-900">{{ warehouses.length }}</p>
          </div>

          <div class="rounded-2xl bg-gray-100 px-4 py-3">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Recent Orders</p>
            <p class="mt-2 text-2xl font-bold text-gray-900">{{ recentProcurements.length }}</p>
          </div>
        </div>
      </div>
    </section>

    <section class="rounded-2xl bg-white p-6 shadow">
      <button
        type="button"
        class="flex w-full items-start justify-between gap-4 text-left"
        @click="isFormOpen = !isFormOpen"
      >
        <div>
          <h3 class="text-2xl font-bold">New Procurement Order</h3>
          <p class="mt-1 text-sm text-gray-500">
            Select existing product and variant references, then enter only the quantity actually received.
          </p>
        </div>

        <div class="flex items-center gap-2 pt-1 text-sm font-medium text-gray-500">
          <span>{{ isFormOpen ? 'Collapse' : 'Expand' }}</span>
          <Icon
            name="lucide:chevron-down"
            size="18"
            class="transition-transform"
            :class="isFormOpen ? 'rotate-180' : ''"
          />
        </div>
      </button>

      <div v-if="isFormOpen" class="mt-6">
        <div
          v-if="formMessage"
          class="mb-4 flex flex-col gap-3 rounded-xl bg-green-50 p-4 text-sm text-green-800 sm:flex-row sm:items-center sm:justify-between"
          role="status"
        >
          <span>{{ formMessage }}</span>
          <NuxtLink
            to="/dashboard/commerce?tab=serialized"
            class="shrink-0 font-bold text-green-900 underline"
          >
            View item IDs & QR codes
          </NuxtLink>
        </div>

        <div class="flex justify-end">
          <button
            type="button"
            class="rounded-lg bg-gray-200 px-4 py-3 text-sm font-medium text-gray-800 hover:bg-gray-300"
            @click="resetForm"
          >
            Reset
          </button>
        </div>

        <div class="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">Supplier</label>
          <select
            v-model="supplierId"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          >
            <option value="">Select supplier</option>

            <option
              v-for="supplier in suppliers"
              :key="supplier.id"
              :value="supplier.id"
            >
              {{ supplier.name }}
            </option>
          </select>
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">Receiving Warehouse</label>
          <select
            v-model="warehouseId"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          >
            <option value="">Select warehouse</option>

            <option
              v-for="warehouse in warehouses"
              :key="warehouse.id"
              :value="warehouse.id"
            >
              {{ warehouse.name }}
            </option>
          </select>
          <p class="mt-1 text-xs text-gray-500">
            All product references on this order must use this as their primary warehouse.
          </p>
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">Invoice / Reference *</label>
          <input
            v-model="invoiceNumber"
            type="text"
            maxlength="160"
            required
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
            placeholder="PO-20260715..."
          >
          <p class="mt-1 text-xs text-gray-500">
            Required. Retrying the same supplier reference safely returns the original receipt.
          </p>
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">Amount Paid</label>
          <input
            v-model="paidAmount"
            type="number"
            min="0"
            step="0.01"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
            placeholder="0"
          >
        </div>

        <div class="md:col-span-2">
          <label class="mb-2 block text-sm font-semibold text-gray-700">Notes</label>
          <textarea
            v-model="notes"
            rows="3"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
            placeholder="Optional notes"
          />
        </div>
        </div>

        <div class="mt-6 rounded-2xl border bg-gray-50 p-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 class="text-lg font-bold text-gray-900">Products</h4>
              <p class="mt-1 text-sm text-gray-500">
                Procurement references the catalog; it does not create products or variants. One physical item
                record and QR code will be generated for every received unit.
              </p>
            </div>

            <button
              type="button"
              :disabled="items.length >= MAX_PROCUREMENT_LINES"
              class="rounded-lg bg-black px-4 py-3 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              @click="addItem"
            >
              {{ items.length >= MAX_PROCUREMENT_LINES ? '100 Line Limit' : 'Add Product' }}
            </button>
          </div>

          <div class="mt-4 max-w-xl">
            <label class="mb-2 block text-sm font-semibold text-gray-700">Product Reference Search</label>
            <input
              v-model="productSearchQuery"
              type="text"
              class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500"
              placeholder="Search by title, SKU, or slug"
            >
          </div>

          <div class="mt-3 space-y-3">
            <div
              v-for="(item, index) in items"
              :key="index"
              class="grid gap-3 rounded-2xl border bg-white p-4 xl:grid-cols-[minmax(240px,2fr)_minmax(220px,1.5fr)_120px_140px_auto]"
            >
              <div>
                <label :for="`procurement-product-${index}`" class="mb-2 block text-xs font-bold uppercase tracking-wide text-gray-500">
                  Product Reference
                </label>
                <select
                  :id="`procurement-product-${index}`"
                  v-model="item.product_id"
                  class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                  @change="handleProductChange(item)"
                >
                  <option value="">Select tracked product</option>

                  <option
                  v-for="product in productOptions"
                  :key="product.id"
                  :value="product.id"
                  :disabled="!product.primary_warehouse_id
                    || (Boolean(warehouseId) && product.primary_warehouse_id !== warehouseId)"
                >
                  {{ formatProductReference(product) }}
                  </option>
                </select>

                <p
                  v-if="isWarehouseMismatch(item)"
                  class="mt-1 text-xs font-medium text-red-600"
                >
                  This product belongs to {{ getProductWarehouseName(item) }}.
                </p>
              </div>

              <div>
                <label :for="`procurement-variant-${index}`" class="mb-2 block text-xs font-bold uppercase tracking-wide text-gray-500">
                  Variant Reference
                </label>
                <select
                  :id="`procurement-variant-${index}`"
                  v-model="item.variant_id"
                  :disabled="!item.product_id || !variantsForProduct(item.product_id).length"
                  class="w-full rounded-lg border p-3 outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
                >
                  <option value="">
                    {{ item.product_id && !variantsForProduct(item.product_id).length
                      ? 'No active variants available'
                      : 'Select variant / color' }}
                  </option>

                  <option
                    v-for="variant in variantsForProduct(item.product_id)"
                    :key="variant.id"
                    :value="variant.id"
                  >
                    {{ formatVariantReference(variant) }}
                  </option>
                </select>

                <NuxtLink
                  v-if="item.product_id && !variantsForProduct(item.product_id).length"
                  :to="`/dashboard/products/edit/${item.product_id}`"
                  class="mt-1 inline-block text-xs font-bold text-blue-700 underline"
                >
                  Define this product’s variant references in Catalog
                </NuxtLink>
              </div>

              <div>
                <label :for="`procurement-quantity-${index}`" class="mb-2 block text-xs font-bold uppercase tracking-wide text-gray-500">
                  Units Received
                </label>
                <input
                  :id="`procurement-quantity-${index}`"
                  v-model="item.quantity"
                  type="number"
                  min="1"
                  max="1000"
                  step="1"
                  inputmode="numeric"
                  class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                  placeholder="0"
                >
              </div>

              <div>
                <label :for="`procurement-cost-${index}`" class="mb-2 block text-xs font-bold uppercase tracking-wide text-gray-500">
                  Unit Cost
                </label>
                <input
                  :id="`procurement-cost-${index}`"
                  v-model="item.unit_cost"
                  type="number"
                  min="0"
                  step="0.01"
                  class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                  placeholder="0.00"
                >
              </div>

              <button
                type="button"
                class="self-end rounded-lg bg-red-100 px-4 py-3 text-sm font-medium text-red-700 hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="items.length === 1"
                @click="removeItem(index)"
              >
                Remove
              </button>
            </div>
          </div>

          <div class="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div class="space-y-1">
              <p class="text-sm text-gray-500">
                Estimated total: <span class="font-semibold text-gray-900">{{ estimatedTotalCost }}</span>
              </p>

              <p class="text-sm text-gray-500">
                Settlement due: <span class="font-semibold text-gray-900">{{ estimatedSettlementDue }}</span>
              </p>

              <p class="text-sm font-semibold text-blue-700">
                {{ totalUnitsToReceive }} {{ totalUnitsToReceive === 1 ? 'unit' : 'units' }}
                = {{ totalUnitsToReceive }} unique item {{ totalUnitsToReceive === 1 ? 'ID' : 'IDs' }} and QR codes
              </p>

              <p
                v-if="totalUnitsToReceive > MAX_PROCUREMENT_UNITS"
                class="text-sm font-semibold text-red-600"
              >
                One Procurement receipt can create at most {{ MAX_PROCUREMENT_UNITS.toLocaleString() }} physical items.
              </p>

              <p v-if="formError" class="text-sm text-red-600">
                {{ formError }}
              </p>
            </div>

            <button
              type="button"
              :disabled="saving || !isReadyToSubmit"
              class="rounded-lg px-5 py-3 font-bold text-white"
              :class="saving || !isReadyToSubmit
                ? 'cursor-not-allowed bg-gray-300'
                : 'bg-blue-600 hover:bg-blue-700'"
              @click="saveProcurement"
            >
              {{ saving
                ? 'Receiving...'
                : `Receive ${totalUnitsToReceive || ''} ${totalUnitsToReceive === 1 ? 'Item' : 'Items'}` }}
            </button>
          </div>
        </div>
      </div>
    </section>

    <section class="rounded-2xl bg-white p-6 shadow">
      <div class="flex items-center justify-between gap-3">
        <button
          type="button"
          class="flex min-w-0 flex-1 items-start justify-between gap-4 text-left"
          @click="isRecentOrdersOpen = !isRecentOrdersOpen"
        >
          <div>
            <h3 class="text-2xl font-bold">Recent Procurement Orders</h3>
            <p class="mt-1 text-sm text-gray-500">
              Latest received purchase records.
            </p>
          </div>

          <div class="flex items-center gap-2 pt-1 text-sm font-medium text-gray-500">
            <span>{{ isRecentOrdersOpen ? 'Collapse' : 'Expand' }}</span>
            <Icon
              name="lucide:chevron-down"
              size="18"
              class="transition-transform"
              :class="isRecentOrdersOpen ? 'rotate-180' : ''"
            />
          </div>
        </button>

        <button
          v-if="isRecentOrdersOpen"
          type="button"
          class="rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
          @click="loadRecentProcurements"
        >
          Refresh
        </button>
      </div>

      <div v-if="isRecentOrdersOpen">
      <p v-if="pageError" class="mt-5 text-sm text-red-600">
        {{ pageError }}
      </p>

      <p v-else-if="loading" class="mt-5 text-sm text-gray-500">
        Loading procurement orders...
      </p>

      <p v-else-if="!recentProcurements.length" class="mt-5 text-sm text-gray-500">
        No procurement orders created yet.
      </p>

      <div v-else class="mt-6 space-y-3">
        <div
          v-for="order in recentProcurements"
          :key="order.id"
          class="rounded-2xl border p-4"
        >
          <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div class="space-y-2">
              <div class="flex flex-wrap items-center gap-2">
                <p class="font-bold text-gray-900">
                  {{ order.invoice_number || `Procurement #${order.id.slice(0, 8)}` }}
                </p>

                <span class="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold uppercase text-gray-600">
                  {{ getProcurementLineCount(order.id) }}
                  {{ getProcurementLineCount(order.id) === 1 ? 'reference' : 'references' }}
                </span>

                <span class="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase text-blue-700">
                  {{ getProcurementUnitCount(order.id) }}
                  {{ getProcurementUnitCount(order.id) === 1 ? 'item ID' : 'item IDs' }}
                </span>
              </div>

              <p class="text-sm text-gray-600">
                {{ supplierNameMap[order.supplier_id] || 'Unknown supplier' }}
                <span v-if="warehouseNameMap[order.warehouse_id]"> · {{ warehouseNameMap[order.warehouse_id] }}</span>
              </p>

              <p class="text-xs text-gray-400">
                {{ formatCommerceDate(order.created_at) }}
              </p>
            </div>

            <div class="text-left md:text-right">
              <p class="text-sm text-gray-500">Total Cost</p>
              <p class="mt-1 text-xl font-bold text-gray-900">
                {{ formatCommerceCurrency(order.total_cost) }}
              </p>

              <p class="mt-1 text-sm text-gray-500">
                Due {{ formatCommerceCurrency(Math.max(Number(order.total_cost || 0) - Number(order.paid_amount || 0), 0)) }}
              </p>
            </div>
          </div>
        </div>
      </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import {
  buildCommerceReference,
  createEmptyProcurementItem,
  formatCommerceCurrency,
  formatCommerceDate
} from '~/utils/commerce'

const supabase = useSupabaseClient()
const { recordAdminLog } = useAdminLogs()
const MAX_PROCUREMENT_UNITS = 10000
const MAX_PROCUREMENT_LINES = 100
const MAX_PROCUREMENT_REFERENCE_LENGTH = 160

const suppliers = ref([])
const warehouses = ref([])
const productOptions = ref([])
const recentProcurements = ref([])
const procurementItemCounts = ref({})
const procurementUnitCounts = ref({})
const loading = ref(false)
const saving = ref(false)
const pageError = ref('')
const formError = ref('')
const formMessage = ref('')
const isFormOpen = ref(false)
const supplierId = ref('')
const warehouseId = ref('')
const invoiceNumber = ref(buildCommerceReference('PO'))
const notes = ref('')
const paidAmount = ref('')
const items = ref([createEmptyProcurementItem()])
const productSearchQuery = ref('')
const isRecentOrdersOpen = ref(false)
let productSearchTimeoutId = null

const supplierNameMap = computed(() => {
  return Object.fromEntries(suppliers.value.map((supplier) => [supplier.id, supplier.name]))
})

const warehouseNameMap = computed(() => {
  return Object.fromEntries(warehouses.value.map((warehouse) => [warehouse.id, warehouse.name]))
})

const estimatedTotalValue = computed(() => {
  return items.value.reduce((sum, item) => {
    const quantity = Number(item.quantity || 0)
    const unitCost = Number(item.unit_cost || 0)
    return sum + (quantity * unitCost)
  }, 0)
})

const totalUnitsToReceive = computed(() => {
  return items.value.reduce((total, item) => {
    const quantity = Number(item.quantity)
    return total + (Number.isInteger(quantity) && quantity > 0 ? quantity : 0)
  }, 0)
})

const estimatedTotalCost = computed(() => {
  return formatCommerceCurrency(estimatedTotalValue.value)
})

const estimatedSettlementDue = computed(() => {
  return formatCommerceCurrency(Math.max(estimatedTotalValue.value - Number(paidAmount.value || 0), 0))
})

const procurementValidationError = computed(() => {
  const normalizedReference = String(invoiceNumber.value || '').trim()

  if (!supplierId.value || !warehouseId.value || !normalizedReference) {
    return 'Enter a supplier, invoice/reference, and receiving warehouse.'
  }

  if (normalizedReference.length > MAX_PROCUREMENT_REFERENCE_LENGTH) {
    return `Invoice/reference cannot exceed ${MAX_PROCUREMENT_REFERENCE_LENGTH} characters.`
  }

  const normalizedPaidAmount = String(paidAmount.value ?? '').trim()
  const paidAmountNumber = normalizedPaidAmount === ''
    ? 0
    : Number(normalizedPaidAmount)

  if (!Number.isFinite(paidAmountNumber) || paidAmountNumber < 0) {
    return 'Paid amount must be a valid non-negative number.'
  }

  if (paidAmountNumber > estimatedTotalValue.value) {
    return 'Paid amount cannot be greater than the procurement total.'
  }

  if (totalUnitsToReceive.value > MAX_PROCUREMENT_UNITS) {
    return `One Procurement receipt can create at most ${MAX_PROCUREMENT_UNITS.toLocaleString()} physical items.`
  }

  if (!items.value.length || items.value.length > MAX_PROCUREMENT_LINES) {
    return `A Procurement receipt must contain between 1 and ${MAX_PROCUREMENT_LINES} product lines.`
  }

  const selectedReferences = new Set()

  for (const item of items.value) {
    const quantity = Number(item.quantity || 0)
    const unitCost = Number(item.unit_cost)
    const product = findProduct(item.product_id)
    const variantBelongsToProduct = variantsForProduct(item.product_id)
      .some((variant) => variant.id === item.variant_id)

    if (
      !item.product_id
      || !item.variant_id
      || !variantBelongsToProduct
      || product?.primary_warehouse_id !== warehouseId.value
      || isWarehouseMismatch(item)
    ) {
      return 'Select an existing product and variant assigned to the receiving warehouse for every line.'
    }

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) {
      return 'Every line must contain a whole quantity between 1 and 1,000.'
    }

    if (
      String(item.unit_cost ?? '').trim() === ''
      || !Number.isFinite(unitCost)
      || unitCost < 0
    ) {
      return 'Every line must contain a valid non-negative unit cost.'
    }

    const referenceKey = `${item.product_id}:${item.variant_id}`

    if (selectedReferences.has(referenceKey)) {
      return 'The same product variant cannot be repeated on one Procurement receipt.'
    }

    selectedReferences.add(referenceKey)
  }

  return ''
})

const isReadyToSubmit = computed(() => !procurementValidationError.value)

const isMissingSchemaError = (error) => {
  return error?.code === '42P01' || error?.code === '42703' || error?.code === 'PGRST202'
}

const addItem = () => {
  if (items.value.length >= MAX_PROCUREMENT_LINES) {
    formError.value = `A Procurement receipt cannot contain more than ${MAX_PROCUREMENT_LINES} product lines.`
    return
  }

  items.value.push(createEmptyProcurementItem())
  formMessage.value = ''
  formError.value = ''
}

const removeItem = (index) => {
  if (items.value.length === 1) {
    return
  }

  items.value.splice(index, 1)
}

const resetForm = () => {
  supplierId.value = ''
  warehouseId.value = ''
  invoiceNumber.value = buildCommerceReference('PO')
  notes.value = ''
  paidAmount.value = ''
  items.value = [createEmptyProcurementItem()]
  formError.value = ''
  formMessage.value = ''
}

const findProduct = (productId) => {
  return productOptions.value.find((product) => product.id === productId) || null
}

const variantsForProduct = (productId) => {
  return findProduct(productId)?.variants || []
}

const formatProductReference = (product) => {
  const reference = product.sku || product.slug || String(product.id || '').slice(0, 8)
  const warehouseName = warehouseNameMap.value[product.primary_warehouse_id]
  return `${product.title} · ${reference}${warehouseName ? ` · ${warehouseName}` : ''}`
}

const formatVariantReference = (variant) => {
  const details = [
    variant.code,
    variant.sku,
    variant.color_name
  ].filter(Boolean)

  return details.length
    ? `${variant.name} · ${details.join(' · ')}`
    : variant.name
}

const handleProductChange = (item) => {
  item.variant_id = ''
  formMessage.value = ''

  const product = findProduct(item.product_id)

  if (!warehouseId.value && product?.primary_warehouse_id) {
    warehouseId.value = product.primary_warehouse_id
  }

  const variants = variantsForProduct(item.product_id)

  if (variants.length === 1) {
    item.variant_id = variants[0].id
  }
}

const isWarehouseMismatch = (item) => {
  const product = findProduct(item.product_id)

  return Boolean(
    item.product_id
    && warehouseId.value
    && product
    && product.primary_warehouse_id !== warehouseId.value
  )
}

const getProductWarehouseName = (item) => {
  const primaryWarehouseId = findProduct(item.product_id)?.primary_warehouse_id
  return primaryWarehouseId
    ? warehouseNameMap.value[primaryWarehouseId] || 'a different primary warehouse'
    : 'not assigned to a receiving warehouse'
}

const loadLookups = async () => {
  const [
    suppliersResult,
    warehousesResult
  ] = await Promise.all([
    supabase
      .from('commerce_crm_accounts')
      .select('id, name')
      .eq('account_type', 'supplier')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('commerce_warehouses')
      .select('id, name')
      .eq('is_active', true)
      .order('name')
  ])

  if (suppliersResult.error) {
    throw suppliersResult.error
  }

  if (warehousesResult.error) {
    throw warehousesResult.error
  }

  suppliers.value = suppliersResult.data || []
  warehouses.value = warehousesResult.data || []
}

const loadProductOptions = async () => {
  let query = supabase
    .from('products')
    .select(`
      id,
      title,
      slug,
      sku,
      primary_warehouse_id,
      is_serialized,
      product_variants (
        id,
        product_id,
        name,
        code,
        sku,
        color_name,
        color_hex,
        is_active
      )
    `)
    .eq('is_serialized', true)
    .order('created_at', { ascending: false })
    .limit(30)

  const searchValue = String(productSearchQuery.value || '').trim()

  if (searchValue) {
    const pattern = `%${searchValue}%`
    query = query.or(`title.ilike.${pattern},sku.ilike.${pattern},slug.ilike.${pattern}`)
  }

  const { data, error } = await query

  if (error) {
    throw error
  }

  const loadedProducts = (data || []).map((product) => ({
    ...product,
    variants: (product.product_variants || [])
      .filter((variant) => variant.is_active)
      .sort((left, right) => {
        return String(left.name || '').localeCompare(String(right.name || ''))
      })
  }))

  const selectedProductIds = new Set(
    items.value.map((item) => item.product_id).filter(Boolean)
  )
  const retainedSelectedProducts = productOptions.value.filter((product) => {
    return selectedProductIds.has(product.id)
      && !loadedProducts.some((loadedProduct) => loadedProduct.id === product.id)
  })

  productOptions.value = [
    ...retainedSelectedProducts,
    ...loadedProducts
  ]
}

const loadRecentProcurements = async () => {
  loading.value = true
  pageError.value = ''

  try {
    const { data: orders, error: ordersError } = await supabase
      .from('commerce_procurement_orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(12)

    if (ordersError) {
      throw ordersError
    }

    recentProcurements.value = orders || []

    if (!recentProcurements.value.length) {
      procurementItemCounts.value = {}
      procurementUnitCounts.value = {}
      return
    }

    const { data: lineItems, error: lineItemsError } = await supabase
      .from('commerce_procurement_items')
      .select('procurement_order_id, received_quantity')
      .in('procurement_order_id', recentProcurements.value.map((order) => order.id))

    if (lineItemsError) {
      throw lineItemsError
    }

    procurementItemCounts.value = (lineItems || []).reduce((counts, item) => {
      counts[item.procurement_order_id] = (counts[item.procurement_order_id] || 0) + 1
      return counts
    }, {})

    procurementUnitCounts.value = (lineItems || []).reduce((counts, item) => {
      counts[item.procurement_order_id] = (
        counts[item.procurement_order_id] || 0
      ) + Number(item.received_quantity || 0)
      return counts
    }, {})
  } catch (error) {
    pageError.value = isMissingSchemaError(error)
      ? 'Run the new commerce SQL first, then refresh this page.'
      : error.message || 'Could not load procurement orders.'
  } finally {
    loading.value = false
  }
}

const getProcurementLineCount = (procurementId) => {
  return procurementItemCounts.value[procurementId] || 0
}

const getProcurementUnitCount = (procurementId) => {
  return procurementUnitCounts.value[procurementId] || 0
}

const saveProcurement = async () => {
  formError.value = ''
  formMessage.value = ''

  if (!isReadyToSubmit.value) {
    formError.value = procurementValidationError.value
      || 'Complete every Procurement field before receiving stock.'
    return
  }

  saving.value = true

  try {
    const payloadItems = items.value.map((item) => ({
      product_id: item.product_id,
      variant_id: item.variant_id,
      quantity: Number(item.quantity || 0),
      unit_cost: Number(item.unit_cost || 0)
    }))
    const receivedUnitCount = payloadItems.reduce((total, item) => total + item.quantity, 0)

    const { data, error } = await supabase.rpc('commerce_create_procurement_order', {
      p_supplier_id: supplierId.value,
      p_warehouse_id: warehouseId.value,
      p_invoice_number: String(invoiceNumber.value || '').trim() || null,
      p_notes: String(notes.value || '').trim() || null,
      p_paid_amount: Number(paidAmount.value || 0),
      p_items: payloadItems
    })

    if (error) {
      throw error
    }

    const procurementId = typeof data === 'string'
      ? data
      : data?.procurement_order_id || data?.order_id || null

    await recordAdminLog({
      actionKey: 'commerce.procurement.create',
      description: `Received procurement order ${invoiceNumber.value || String(procurementId || '').slice(0, 8)} with ${receivedUnitCount} serialized units.`,
      metadata: {
        procurement_order_id: procurementId,
        supplier_id: supplierId.value,
        warehouse_id: warehouseId.value,
        lines: payloadItems.length,
        serialized_units_created: receivedUnitCount
      }
    })

    resetForm()
    formMessage.value = `${receivedUnitCount} ${receivedUnitCount === 1 ? 'physical item was' : 'physical items were'} received. Each item now has its own ID and QR code.`
    await Promise.all([
      loadRecentProcurements(),
      loadProductOptions()
    ])
  } catch (error) {
    formError.value = isMissingSchemaError(error)
      ? 'Run the new commerce SQL first, then refresh this page.'
      : error.message || 'Could not save this procurement order.'
  } finally {
    saving.value = false
  }
}

watch(productSearchQuery, () => {
  if (productSearchTimeoutId) {
    clearTimeout(productSearchTimeoutId)
  }

  productSearchTimeoutId = setTimeout(() => {
    loadProductOptions()
  }, 300)
})

watch(warehouseId, (nextWarehouseId, previousWarehouseId) => {
  if (!nextWarehouseId || nextWarehouseId === previousWarehouseId) {
    return
  }

  let clearedLineCount = 0

  items.value.forEach((item) => {
    const product = findProduct(item.product_id)

    if (
      product
      && product.primary_warehouse_id !== nextWarehouseId
    ) {
      item.product_id = ''
      item.variant_id = ''
      clearedLineCount += 1
    }
  })

  if (clearedLineCount > 0) {
    formMessage.value = ''
    formError.value = `${clearedLineCount} ${clearedLineCount === 1 ? 'product reference was' : 'product references were'} cleared because the receiving warehouse changed.`
  }
})

onBeforeUnmount(() => {
  if (productSearchTimeoutId) {
    clearTimeout(productSearchTimeoutId)
  }
})

onMounted(async () => {
  try {
    await Promise.all([
      loadLookups(),
      loadProductOptions(),
      loadRecentProcurements()
    ])
  } catch (error) {
    pageError.value = isMissingSchemaError(error)
      ? 'Run the new commerce SQL first, then refresh this page.'
      : error.message || 'Could not load procurement data.'
  }
})
</script>
