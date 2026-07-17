<template>
  <div class="space-y-6">
    <section class="rounded-2xl bg-white p-6 shadow">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 class="text-2xl font-bold">Procurement</h3>
          <p class="mt-1 text-sm text-gray-500">
            Receive stock from suppliers, assign it to a warehouse, and update product cost.
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
            Link existing products to a supplier purchase and send stock into the selected warehouse.
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
          <label class="mb-2 block text-sm font-semibold text-gray-700">Warehouse</label>
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
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">Invoice / Reference</label>
          <input
            v-model="invoiceNumber"
            type="text"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
            placeholder="PO-20260715..."
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
                Each line increases both warehouse inventory and the main product stock quantity.
              </p>
            </div>

            <button
              type="button"
              class="rounded-lg bg-black px-4 py-3 text-sm font-medium text-white hover:bg-gray-800"
              @click="addItem"
            >
              Add Product
            </button>
          </div>

          <div class="mt-4 max-w-xl">
            <label class="mb-2 block text-sm font-semibold text-gray-700">Product Search</label>
            <input
              v-model="productSearchQuery"
              type="text"
              class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500"
              placeholder="Search by title or slug"
            >
          </div>

          <div class="mt-3 space-y-3">
            <div
              v-for="(item, index) in items"
              :key="index"
              class="grid gap-3 rounded-2xl border bg-white p-4 md:grid-cols-[minmax(0,2fr)_120px_140px_auto]"
            >
              <select
                v-model="item.product_id"
                class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
              >
                <option value="">Select product</option>

                <option
                  v-for="product in productOptions"
                  :key="product.id"
                  :value="product.id"
                >
                  {{ product.title }}{{ product.slug ? ` (${product.slug})` : '' }}
                </option>
              </select>

              <input
                v-model="item.quantity"
                type="number"
                min="1"
                class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                placeholder="Qty"
              >

              <input
                v-model="item.unit_cost"
                type="number"
                min="0"
                step="0.01"
                class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                placeholder="Cost"
              >

              <button
                type="button"
                class="rounded-lg bg-red-100 px-4 py-3 text-sm font-medium text-red-700 hover:bg-red-200"
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
              {{ saving ? 'Saving...' : 'Receive Procurement Order' }}
            </button>
          </div>
        </div>
      </div>
    </section>

    <section class="rounded-2xl bg-white p-6 shadow">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h3 class="text-2xl font-bold">Recent Procurement Orders</h3>
          <p class="mt-1 text-sm text-gray-500">
            Latest received purchase records.
          </p>
        </div>

        <button
          type="button"
          class="rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
          @click="loadRecentProcurements"
        >
          Refresh
        </button>
      </div>

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
                  {{ getProcurementItemCount(order.id) }} item{{ getProcurementItemCount(order.id) === 1 ? '' : 's' }}
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

const suppliers = ref([])
const warehouses = ref([])
const productOptions = ref([])
const recentProcurements = ref([])
const procurementItemCounts = ref({})
const loading = ref(false)
const saving = ref(false)
const pageError = ref('')
const formError = ref('')
const isFormOpen = ref(false)
const supplierId = ref('')
const warehouseId = ref('')
const invoiceNumber = ref(buildCommerceReference('PO'))
const notes = ref('')
const items = ref([createEmptyProcurementItem()])
const productSearchQuery = ref('')
let productSearchTimeoutId = null

const supplierNameMap = computed(() => {
  return Object.fromEntries(suppliers.value.map((supplier) => [supplier.id, supplier.name]))
})

const warehouseNameMap = computed(() => {
  return Object.fromEntries(warehouses.value.map((warehouse) => [warehouse.id, warehouse.name]))
})

const estimatedTotalCost = computed(() => {
  const total = items.value.reduce((sum, item) => {
    const quantity = Number(item.quantity || 0)
    const unitCost = Number(item.unit_cost || 0)
    return sum + (quantity * unitCost)
  }, 0)

  return formatCommerceCurrency(total)
})

const isReadyToSubmit = computed(() => {
  if (!supplierId.value || !warehouseId.value) {
    return false
  }

  return items.value.every((item) => {
    return item.product_id
      && Number(item.quantity || 0) > 0
      && Number(item.unit_cost || 0) >= 0
  })
})

const isMissingSchemaError = (error) => {
  return error?.code === '42P01' || error?.code === '42703' || error?.code === 'PGRST202'
}

const addItem = () => {
  items.value.push(createEmptyProcurementItem())
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
  items.value = [createEmptyProcurementItem()]
  formError.value = ''
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
    .select('id, title, slug')
    .order('created_at', { ascending: false })
    .limit(30)

  const searchValue = String(productSearchQuery.value || '').trim()

  if (searchValue) {
    const pattern = `%${searchValue}%`
    query = query.or(`title.ilike.${pattern},slug.ilike.${pattern}`)
  }

  const { data, error } = await query

  if (error) {
    throw error
  }

  productOptions.value = data || []
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
      return
    }

    const { data: lineItems, error: lineItemsError } = await supabase
      .from('commerce_procurement_items')
      .select('procurement_order_id')
      .in('procurement_order_id', recentProcurements.value.map((order) => order.id))

    if (lineItemsError) {
      throw lineItemsError
    }

    procurementItemCounts.value = (lineItems || []).reduce((counts, item) => {
      counts[item.procurement_order_id] = (counts[item.procurement_order_id] || 0) + 1
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

const getProcurementItemCount = (procurementId) => {
  return procurementItemCounts.value[procurementId] || 0
}

const saveProcurement = async () => {
  formError.value = ''

  if (!isReadyToSubmit.value) {
    formError.value = 'Complete supplier, warehouse, and every product line first.'
    return
  }

  saving.value = true

  try {
    const payloadItems = items.value.map((item) => ({
      product_id: item.product_id,
      quantity: Number(item.quantity || 0),
      unit_cost: Number(item.unit_cost || 0)
    }))

    const { data, error } = await supabase.rpc('commerce_create_procurement_order', {
      p_supplier_id: supplierId.value,
      p_warehouse_id: warehouseId.value,
      p_invoice_number: String(invoiceNumber.value || '').trim() || null,
      p_notes: String(notes.value || '').trim() || null,
      p_items: payloadItems
    })

    if (error) {
      throw error
    }

    await recordAdminLog({
      actionKey: 'commerce.procurement.create',
      description: `Created procurement order ${invoiceNumber.value || String(data || '').slice(0, 8)}.`,
      metadata: {
        procurement_order_id: data || null,
        supplier_id: supplierId.value,
        warehouse_id: warehouseId.value,
        lines: payloadItems.length
      }
    })

    resetForm()
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
