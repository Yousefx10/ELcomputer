<template>
  <div class="space-y-6">
    <section class="rounded-2xl bg-white p-6 shadow">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 class="text-2xl font-bold">Sales Orders</h3>
          <p class="mt-1 text-sm text-gray-500">
            Record manual sales for CRM customers.
          </p>
        </div>

        <div class="grid gap-3 sm:grid-cols-3">
          <div class="rounded-2xl bg-gray-100 px-4 py-3">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Customers</p>
            <p class="mt-2 text-2xl font-bold text-gray-900">{{ customers.length }}</p>
          </div>

          <div class="rounded-2xl bg-gray-100 px-4 py-3">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Warehouses</p>
            <p class="mt-2 text-2xl font-bold text-gray-900">{{ warehouses.length }}</p>
          </div>

          <div class="rounded-2xl bg-gray-100 px-4 py-3">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Recent Sales</p>
            <p class="mt-2 text-2xl font-bold text-gray-900">{{ recentSales.length }}</p>
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
          <h3 class="text-2xl font-bold">New Manual Sale</h3>
          <p class="mt-1 text-sm text-gray-500">
            Sell to CRM customer.
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
            <label class="mb-2 block text-sm font-semibold text-gray-700">CRM Customer</label>
            <select
              v-model="customerId"
              class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
            >
              <option value="">Select customer</option>

              <option
                v-for="customer in customers"
                :key="customer.id"
                :value="customer.id"
              >
                {{ customer.name }}
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
            <label class="mb-2 block text-sm font-semibold text-gray-700">Sale Reference</label>
            <input
              v-model="orderNumber"
              type="text"
              class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
              placeholder="SALE-20260717..."
            >
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
              placeholder="Optional sale notes"
            />
          </div>
        </div>

        <div class="mt-6 rounded-2xl border bg-gray-50 p-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 class="text-lg font-bold text-gray-900">Products</h4>
              <p class="mt-1 text-sm text-gray-500">
                Prices start from the product selling price and can be changed for this sale.
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
                @change="applyProductPrice(item)"
              >
                <option value="">Select product</option>

                <option
                  v-for="product in productOptions"
                  :key="product.id"
                  :value="product.id"
                >
                  {{ product.title }}{{ product.slug ? ` (${product.slug})` : '' }} · Stock {{ product.stock_quantity }}
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
                v-model="item.unit_price"
                type="number"
                min="0"
                step="0.01"
                class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                placeholder="Price"
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
                Sale total: <span class="font-semibold text-gray-900">{{ formattedTotal }}</span>
              </p>
              <p class="text-sm text-gray-500">
                Settlement due: <span class="font-semibold text-gray-900">{{ formattedSettlementDue }}</span>
              </p>
              <p v-if="formError" class="text-sm text-red-600">{{ formError }}</p>
            </div>

            <button
              type="button"
              :disabled="saving || !isReadyToSubmit"
              class="rounded-lg px-5 py-3 font-bold text-white"
              :class="saving || !isReadyToSubmit
                ? 'cursor-not-allowed bg-gray-300'
                : 'bg-blue-600 hover:bg-blue-700'"
              @click="saveSale"
            >
              {{ saving ? 'Saving...' : 'Complete Manual Sale' }}
            </button>
          </div>
        </div>
      </div>
    </section>

    <section class="rounded-2xl bg-white p-6 shadow">
      <button
        type="button"
        class="flex w-full items-start justify-between gap-4 text-left"
        @click="isRecentSalesOpen = !isRecentSalesOpen"
      >
        <div>
          <h3 class="text-2xl font-bold">Recent Sales Orders</h3>
          <p class="mt-1 text-sm text-gray-500">Latest CRM manual sales.</p>
        </div>

        <div class="flex items-center gap-2 pt-1 text-sm font-medium text-gray-500">
          <span>{{ isRecentSalesOpen ? 'Collapse' : 'Expand' }}</span>
          <Icon
            name="lucide:chevron-down"
            size="18"
            class="transition-transform"
            :class="isRecentSalesOpen ? 'rotate-180' : ''"
          />
        </div>
      </button>

      <div v-if="isRecentSalesOpen" class="mt-6">
        <div class="mb-4 flex justify-end">
          <button
            type="button"
            class="rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
            @click="loadRecentSales"
          >
            Refresh
          </button>
        </div>

        <p v-if="pageError" class="text-sm text-red-600">{{ pageError }}</p>
        <p v-else-if="loading" class="text-sm text-gray-500">Loading sales orders...</p>
        <p v-else-if="!recentSales.length" class="text-sm text-gray-500">No manual sales created yet.</p>

        <div v-else class="space-y-3">
          <div
            v-for="sale in recentSales"
            :key="sale.id"
            class="rounded-2xl border p-4"
          >
            <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p class="font-bold text-gray-900">{{ sale.order_number || `Sale #${sale.id.slice(0, 8)}` }}</p>
                <p class="mt-1 text-sm text-gray-600">
                  {{ customerNameMap[sale.customer_id] || 'Unknown customer' }}
                  <span v-if="warehouseNameMap[sale.warehouse_id]"> · {{ warehouseNameMap[sale.warehouse_id] }}</span>
                </p>
                <p class="mt-1 text-xs text-gray-400">{{ formatCommerceDate(sale.created_at) }}</p>
              </div>

              <div class="text-left md:text-right">
                <p class="text-xl font-bold text-gray-900">{{ formatCommerceCurrency(sale.total_amount) }}</p>
                <p class="mt-1 text-sm text-gray-500">
                  Due {{ formatCommerceCurrency(getSettlementDue(sale)) }}
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
  formatCommerceCurrency,
  formatCommerceDate
} from '~/utils/commerce'

const supabase = useSupabaseClient()
const { recordAdminLog } = useAdminLogs()

const createEmptyItem = () => ({ product_id: '', quantity: 1, unit_price: '' })

const customers = ref([])
const warehouses = ref([])
const productOptions = ref([])
const recentSales = ref([])
const customerId = ref('')
const warehouseId = ref('')
const orderNumber = ref(buildCommerceReference('SALE'))
const notes = ref('')
const paidAmount = ref('')
const items = ref([createEmptyItem()])
const productSearchQuery = ref('')
const isFormOpen = ref(false)
const isRecentSalesOpen = ref(false)
const loading = ref(false)
const saving = ref(false)
const pageError = ref('')
const formError = ref('')
let productSearchTimeoutId = null

const customerNameMap = computed(() => Object.fromEntries(customers.value.map((customer) => [customer.id, customer.name])))
const warehouseNameMap = computed(() => Object.fromEntries(warehouses.value.map((warehouse) => [warehouse.id, warehouse.name])))

const totalValue = computed(() => items.value.reduce((total, item) => {
  return total + (Number(item.quantity || 0) * Number(item.unit_price || 0))
}, 0))

const formattedTotal = computed(() => formatCommerceCurrency(totalValue.value))
const formattedSettlementDue = computed(() => {
  return formatCommerceCurrency(Math.max(totalValue.value - Number(paidAmount.value || 0), 0))
})

const isReadyToSubmit = computed(() => {
  const paid = Number(paidAmount.value || 0)
  return Boolean(customerId.value && warehouseId.value)
    && paid >= 0
    && paid <= totalValue.value
    && items.value.every((item) => item.product_id && Number(item.quantity || 0) > 0 && Number(item.unit_price || 0) >= 0)
})

const isMissingSchemaError = (error) => {
  return error?.code === '42P01' || error?.code === '42703' || error?.code === 'PGRST202'
}

const addItem = () => items.value.push(createEmptyItem())

const removeItem = (index) => {
  if (items.value.length > 1) items.value.splice(index, 1)
}

const applyProductPrice = (item) => {
  const product = productOptions.value.find((option) => option.id === item.product_id)
  if (product) item.unit_price = String(Number(product.price || 0))
}

const resetForm = () => {
  customerId.value = ''
  warehouseId.value = ''
  orderNumber.value = buildCommerceReference('SALE')
  notes.value = ''
  paidAmount.value = ''
  items.value = [createEmptyItem()]
  formError.value = ''
}

const loadLookups = async () => {
  const [customersResult, warehousesResult] = await Promise.all([
    supabase.from('commerce_crm_accounts').select('id, name').eq('account_type', 'customer').eq('is_active', true).order('name'),
    supabase.from('commerce_warehouses').select('id, name').eq('is_active', true).order('name')
  ])
  if (customersResult.error) throw customersResult.error
  if (warehousesResult.error) throw warehousesResult.error
  customers.value = customersResult.data || []
  warehouses.value = warehousesResult.data || []
}

const loadProductOptions = async () => {
  let query = supabase
    .from('products')
    .select('id, title, slug, price, stock_quantity')
    .order('created_at', { ascending: false })
    .limit(30)

  const searchValue = productSearchQuery.value.trim()
  if (searchValue) query = query.or(`title.ilike.%${searchValue}%,slug.ilike.%${searchValue}%`)

  const { data, error } = await query
  if (error) throw error
  productOptions.value = data || []
}

const loadRecentSales = async () => {
  loading.value = true
  pageError.value = ''
  try {
    const { data, error } = await supabase
      .from('commerce_sales_orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(12)
    if (error) throw error
    recentSales.value = data || []
  } catch (error) {
    pageError.value = isMissingSchemaError(error)
      ? 'Run the latest Commerce SQL migration first, then refresh this page.'
      : error.message || 'Could not load sales orders.'
  } finally {
    loading.value = false
  }
}

const getSettlementDue = (sale) => {
  return Math.max(Number(sale.total_amount || 0) - Number(sale.paid_amount || 0), 0)
}

const saveSale = async () => {
  formError.value = ''
  if (!isReadyToSubmit.value) {
    formError.value = 'Complete the customer, warehouse, payment, and every product line first.'
    return
  }

  saving.value = true
  try {
    const payloadItems = items.value.map((item) => ({
      product_id: item.product_id,
      quantity: Number(item.quantity),
      unit_price: Number(item.unit_price)
    }))
    const { data, error } = await supabase.rpc('commerce_create_sales_order', {
      p_customer_id: customerId.value,
      p_warehouse_id: warehouseId.value,
      p_order_number: orderNumber.value.trim() || null,
      p_notes: notes.value.trim() || null,
      p_paid_amount: Number(paidAmount.value || 0),
      p_items: payloadItems
    })
    if (error) throw error

    await recordAdminLog({
      actionKey: 'commerce.sales.create',
      description: `Created manual sale ${orderNumber.value || String(data || '').slice(0, 8)}.`,
      metadata: { sales_order_id: data || null, customer_id: customerId.value, warehouse_id: warehouseId.value }
    })

    resetForm()
    await Promise.all([loadRecentSales(), loadProductOptions()])
  } catch (error) {
    formError.value = isMissingSchemaError(error)
      ? 'Run the latest Commerce SQL migration first, then try again.'
      : error.message || 'Could not create the manual sale.'
  } finally {
    saving.value = false
  }
}

watch(productSearchQuery, () => {
  clearTimeout(productSearchTimeoutId)
  productSearchTimeoutId = setTimeout(loadProductOptions, 300)
})

onBeforeUnmount(() => clearTimeout(productSearchTimeoutId))

onMounted(async () => {
  try {
    await Promise.all([loadLookups(), loadProductOptions(), loadRecentSales()])
  } catch (error) {
    pageError.value = isMissingSchemaError(error)
      ? 'Run the latest Commerce SQL migration first, then refresh this page.'
      : error.message || 'Could not load sales data.'
  }
})
</script>
