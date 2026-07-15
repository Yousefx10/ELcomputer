<template>
  <div class="space-y-6">
    <section class="rounded-2xl bg-white p-6 shadow">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 class="text-2xl font-bold">Returns</h3>
          <p class="mt-1 text-sm text-gray-500">
            Record returned order items and restock them back into the selected warehouse.
          </p>
        </div>

        <div class="grid gap-3 sm:grid-cols-3">
          <div class="rounded-2xl bg-gray-100 px-4 py-3">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Warehouses</p>
            <p class="mt-2 text-2xl font-bold text-gray-900">{{ warehouses.length }}</p>
          </div>

          <div class="rounded-2xl bg-gray-100 px-4 py-3">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Recent Returns</p>
            <p class="mt-2 text-2xl font-bold text-gray-900">{{ recentReturns.length }}</p>
          </div>

          <div class="rounded-2xl bg-gray-100 px-4 py-3">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Open Order Options</p>
            <p class="mt-2 text-2xl font-bold text-gray-900">{{ orderOptions.length }}</p>
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
          <h3 class="text-2xl font-bold">Create Return</h3>
          <p class="mt-1 text-sm text-gray-500">
            Select a customer order, choose the returned items, and send them back to inventory.
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
            @click="resetReturnForm"
          >
            Reset
          </button>
        </div>

        <div class="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">Search Order</label>
          <input
            v-model="orderSearchQuery"
            type="text"
            placeholder="Order number, customer, phone, email"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          >
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">Order</label>
          <select
            v-model="returnForm.order_id"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          >
            <option value="">Select order</option>

            <option
              v-for="order in orderOptions"
              :key="order.id"
              :value="order.id"
            >
              {{ getOrderOptionLabel(order) }}
            </option>
          </select>
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">Warehouse</label>
          <select
            v-model="returnForm.warehouse_id"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          >
            <option value="">Select warehouse</option>

            <option
              v-for="warehouse in activeWarehouses"
              :key="warehouse.id"
              :value="warehouse.id"
            >
              {{ warehouse.name }}
            </option>
          </select>
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">Reason</label>
          <input
            v-model="returnForm.reason"
            type="text"
            placeholder="Damaged box, wrong item, customer return..."
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          >
        </div>

        <div class="md:col-span-2">
          <label class="mb-2 block text-sm font-semibold text-gray-700">Notes</label>
          <textarea
            v-model="returnForm.notes"
            rows="3"
            placeholder="Optional return notes"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          />
        </div>
        </div>

        <div
          v-if="selectedOrder"
          class="mt-6 rounded-2xl border bg-gray-50 p-4"
        >
          <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div class="space-y-2">
              <p class="text-lg font-bold text-gray-900">
                {{ selectedOrder.order_number || `Order #${selectedOrder.id.slice(0, 8)}` }}
              </p>

              <p class="text-sm text-gray-600">
                {{ selectedOrder.first_name || 'Customer' }}<span v-if="selectedOrder.last_name"> {{ selectedOrder.last_name }}</span>
                <span v-if="selectedOrder.phone"> · {{ selectedOrder.phone }}</span>
              </p>

              <p class="text-sm text-gray-500">
                {{ selectedOrder.city || 'No city' }}<span v-if="selectedOrder.governorate">, {{ selectedOrder.governorate }}</span>
              </p>
            </div>

            <div class="flex flex-wrap gap-3 text-sm">
              <div class="rounded-xl bg-white px-4 py-3">
                <p class="text-gray-500">Status</p>
                <span
                  class="mt-1 inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase"
                  :class="getCustomerOrderStatusClass(selectedOrder.status)"
                >
                  {{ formatCustomerOrderStatus(selectedOrder.status) }}
                </span>
              </div>

              <div class="rounded-xl bg-white px-4 py-3">
                <p class="text-gray-500">Total</p>
                <p class="mt-1 text-lg font-bold text-gray-900">{{ formatCommerceCurrency(selectedOrder.total_amount) }}</p>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-6 rounded-2xl border bg-gray-50 p-4">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h4 class="text-lg font-bold text-gray-900">Returned Items</h4>
              <p class="mt-1 text-sm text-gray-500">
                Enter only the quantities that are actually returned.
              </p>
            </div>
          </div>

          <p v-if="loadingOrderItems" class="mt-4 text-sm text-gray-500">
            Loading order items...
          </p>

          <p v-else-if="returnForm.order_id && !returnItems.length" class="mt-4 text-sm text-gray-500">
            This order does not have returnable product items.
          </p>

          <p v-else-if="!returnForm.order_id" class="mt-4 text-sm text-gray-500">
            Select an order first.
          </p>

          <div v-else class="mt-4 space-y-3">
            <div
              v-for="item in returnItems"
              :key="item.order_item_id"
              class="grid gap-3 rounded-2xl border bg-white p-4 md:grid-cols-[minmax(0,2fr)_120px_120px_140px]"
            >
              <div>
                <p class="font-bold text-gray-900">{{ item.product_title }}</p>
                <p class="mt-1 text-sm text-gray-500">
                  Ordered {{ item.purchased_quantity }}
                  <span v-if="item.already_returned_quantity"> · Returned {{ item.already_returned_quantity }}</span>
                </p>
              </div>

              <div class="rounded-xl bg-gray-50 px-3 py-3 text-sm">
                <p class="text-gray-500">Available</p>
                <p class="mt-1 font-bold text-gray-900">{{ item.remaining_quantity }}</p>
              </div>

              <div class="rounded-xl bg-gray-50 px-3 py-3 text-sm">
                <p class="text-gray-500">Price</p>
                <p class="mt-1 font-bold text-gray-900">{{ formatCommerceCurrency(item.unit_price) }}</p>
              </div>

              <input
                v-model="item.return_quantity"
                type="number"
                min="0"
                :max="item.remaining_quantity"
                class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                placeholder="Return qty"
              >
            </div>
          </div>

          <p v-if="formError" class="mt-4 text-sm text-red-600">
            {{ formError }}
          </p>

          <div class="mt-5 flex justify-end">
            <button
              type="button"
              :disabled="saving || !isReadyToSubmit"
              class="rounded-lg px-5 py-3 font-bold text-white"
              :class="saving || !isReadyToSubmit
                ? 'cursor-not-allowed bg-gray-300'
                : 'bg-blue-600 hover:bg-blue-700'"
              @click="saveReturn"
            >
              {{ saving ? 'Saving...' : 'Receive Return' }}
            </button>
          </div>
        </div>
      </div>
    </section>

    <section class="rounded-2xl bg-white p-6 shadow">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h3 class="text-2xl font-bold">Recent Returns</h3>
          <p class="mt-1 text-sm text-gray-500">
            Latest recorded returns across the system.
          </p>
        </div>

        <button
          type="button"
          class="rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
          @click="loadRecentReturns"
        >
          Refresh
        </button>
      </div>

      <p v-if="pageError" class="mt-5 text-sm text-red-600">
        {{ pageError }}
      </p>

      <p v-else-if="loadingReturns" class="mt-5 text-sm text-gray-500">
        Loading returns...
      </p>

      <p v-else-if="!recentReturns.length" class="mt-5 text-sm text-gray-500">
        No returns recorded yet.
      </p>

      <div v-else class="mt-6 space-y-3">
        <div
          v-for="returnRecord in recentReturns"
          :key="returnRecord.id"
          class="rounded-2xl border p-4"
        >
          <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div class="space-y-2">
              <p class="font-bold text-gray-900">
                {{ orderNameMap[returnRecord.order_id] || `Order #${String(returnRecord.order_id || '').slice(0, 8)}` }}
              </p>

              <p class="text-sm text-gray-500">
                {{ warehouseNameMap[returnRecord.warehouse_id] || 'Unknown warehouse' }}
              </p>

              <p class="text-xs text-gray-400">
                {{ formatCommerceDate(returnRecord.created_at) }}
              </p>
            </div>

            <div class="text-left md:text-right">
              <p class="text-lg font-bold text-gray-900">
                {{ returnRecord.total_items }} item{{ returnRecord.total_items === 1 ? '' : 's' }}
              </p>

              <p class="text-sm text-gray-500">
                {{ returnRecord.reason || 'No reason provided' }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { formatCustomerOrderStatus, getCustomerOrderStatusClass } from '~/utils/orderStatus'
import { formatCommerceCurrency, formatCommerceDate } from '~/utils/commerce'

const supabase = useSupabaseClient()
const { recordAdminLog } = useAdminLogs()

const warehouses = ref([])
const orderOptions = ref([])
const recentReturns = ref([])
const orderCatalog = ref([])
const selectedOrder = ref(null)
const returnItems = ref([])
const loadingOrders = ref(false)
const loadingOrderItems = ref(false)
const loadingReturns = ref(false)
const saving = ref(false)
const pageError = ref('')
const formError = ref('')
const isFormOpen = ref(false)
const orderSearchQuery = ref('')
let orderSearchTimeoutId = null

const createEmptyReturnForm = () => ({
  order_id: '',
  warehouse_id: '',
  reason: '',
  notes: ''
})

const returnForm = reactive(createEmptyReturnForm())

const activeWarehouses = computed(() => {
  return warehouses.value.filter((warehouse) => warehouse.is_active)
})

const warehouseNameMap = computed(() => {
  return Object.fromEntries(warehouses.value.map((warehouse) => [warehouse.id, warehouse.name]))
})

const orderNameMap = computed(() => {
  return Object.fromEntries(orderCatalog.value.map((order) => [
    order.id,
    order.order_number || `Order #${String(order.id).slice(0, 8)}`
  ]))
})

const isReadyToSubmit = computed(() => {
  if (!returnForm.order_id || !returnForm.warehouse_id) {
    return false
  }

  return returnItems.value.some((item) => Number(item.return_quantity || 0) > 0)
})

const isMissingSchemaError = (error) => {
  return error?.code === '42P01' || error?.code === '42703' || error?.code === 'PGRST202'
}

const getOrderOptionLabel = (order) => {
  const title = order.order_number || `Order #${String(order.id).slice(0, 8)}`
  const customerName = [order.first_name, order.last_name].filter(Boolean).join(' ') || 'Customer'
  return `${title} · ${customerName}`
}

const resetReturnForm = () => {
  Object.assign(returnForm, createEmptyReturnForm())
  selectedOrder.value = null
  returnItems.value = []
  formError.value = ''
}

const loadWarehouses = async () => {
  const { data, error } = await supabase
    .from('commerce_warehouses')
    .select('id, name, is_active')
    .order('name')

  if (error) {
    throw error
  }

  warehouses.value = data || []
}

const loadOrderOptions = async () => {
  loadingOrders.value = true

  try {
    let query = supabase
      .from('customer_orders')
      .select('id, order_number, first_name, last_name, phone, email, city, governorate, status, total_amount, created_at')
      .order('created_at', { ascending: false })
      .limit(10)

    const searchValue = String(orderSearchQuery.value || '').trim()

    if (searchValue) {
      const pattern = `%${searchValue}%`
      query = query.or([
        `order_number.ilike.${pattern}`,
        `first_name.ilike.${pattern}`,
        `last_name.ilike.${pattern}`,
        `phone.ilike.${pattern}`,
        `email.ilike.${pattern}`
      ].join(','))
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    orderOptions.value = data || []
    mergeOrdersIntoCatalog(orderOptions.value)
  } finally {
    loadingOrders.value = false
  }
}

const mergeOrdersIntoCatalog = (orders = []) => {
  const map = new Map(orderCatalog.value.map((order) => [order.id, order]))
  orders.forEach((order) => {
    map.set(order.id, order)
  })
  orderCatalog.value = Array.from(map.values())
}

const loadSelectedOrder = async () => {
  if (!returnForm.order_id) {
    selectedOrder.value = null
    returnItems.value = []
    return
  }

  loadingOrderItems.value = true
  formError.value = ''

  try {
    const { data: orderRecord, error: orderError } = await supabase
      .from('customer_orders')
      .select('id, order_number, first_name, last_name, phone, city, governorate, status, total_amount, created_at')
      .eq('id', returnForm.order_id)
      .maybeSingle()

    if (orderError) {
      throw orderError
    }

    selectedOrder.value = orderRecord || null

    if (orderRecord) {
      mergeOrdersIntoCatalog([orderRecord])
    }

    const { data: orderItemsData, error: orderItemsError } = await supabase
      .from('customer_order_items')
      .select('id, product_id, product_title, quantity, unit_price')
      .eq('order_id', returnForm.order_id)
      .order('created_at')

    if (orderItemsError) {
      throw orderItemsError
    }

    const { data: returnRecords, error: returnsError } = await supabase
      .from('commerce_order_returns')
      .select('id')
      .eq('order_id', returnForm.order_id)

    if (returnsError) {
      throw returnsError
    }

    let returnedQuantitiesByItemId = {}

    if ((returnRecords || []).length) {
      const { data: returnLineItems, error: returnItemsError } = await supabase
        .from('commerce_order_return_items')
        .select('order_item_id, quantity')
        .in('order_return_id', returnRecords.map((record) => record.id))

      if (returnItemsError) {
        throw returnItemsError
      }

      returnedQuantitiesByItemId = (returnLineItems || []).reduce((accumulator, item) => {
        if (item.order_item_id) {
          accumulator[item.order_item_id] = (accumulator[item.order_item_id] || 0) + Number(item.quantity || 0)
        }
        return accumulator
      }, {})
    }

    returnItems.value = (orderItemsData || [])
      .filter((item) => item.product_id)
      .map((item) => {
        const purchasedQuantity = Number(item.quantity || 0)
        const alreadyReturnedQuantity = Number(returnedQuantitiesByItemId[item.id] || 0)
        const remainingQuantity = Math.max(0, purchasedQuantity - alreadyReturnedQuantity)

        return {
          order_item_id: item.id,
          product_id: item.product_id,
          product_title: item.product_title,
          purchased_quantity: purchasedQuantity,
          already_returned_quantity: alreadyReturnedQuantity,
          remaining_quantity: remainingQuantity,
          unit_price: Number(item.unit_price || 0),
          return_quantity: 0
        }
      })
      .filter((item) => item.remaining_quantity > 0)
  } finally {
    loadingOrderItems.value = false
  }
}

const loadRecentReturns = async () => {
  loadingReturns.value = true

  try {
    const { data, error } = await supabase
      .from('commerce_order_returns')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(12)

    if (error) {
      throw error
    }

    recentReturns.value = data || []

    const orderIds = [...new Set(recentReturns.value.map((record) => record.order_id).filter(Boolean))]

    if (orderIds.length) {
      const { data: orders, error: ordersError } = await supabase
        .from('customer_orders')
        .select('id, order_number')
        .in('id', orderIds)

      if (ordersError) {
        throw ordersError
      }

      mergeOrdersIntoCatalog(orders || [])
    }
  } finally {
    loadingReturns.value = false
  }
}

const saveReturn = async () => {
  formError.value = ''

  if (!isReadyToSubmit.value) {
    formError.value = 'Select an order, a warehouse, and at least one returned quantity.'
    return
  }

  const payloadItems = []

  for (const item of returnItems.value) {
    const requestedQuantity = Number(item.return_quantity || 0)

    if (!requestedQuantity) {
      continue
    }

    if (requestedQuantity < 0 || requestedQuantity > item.remaining_quantity) {
      formError.value = `Return quantity for ${item.product_title} is not valid.`
      return
    }

    payloadItems.push({
      order_item_id: item.order_item_id,
      product_id: item.product_id,
      quantity: requestedQuantity
    })
  }

  if (!payloadItems.length) {
    formError.value = 'Add at least one returned item quantity.'
    return
  }

  saving.value = true

  try {
    const { data, error } = await supabase.rpc('commerce_create_order_return', {
      p_order_id: returnForm.order_id,
      p_warehouse_id: returnForm.warehouse_id,
      p_reason: String(returnForm.reason || '').trim() || null,
      p_notes: String(returnForm.notes || '').trim() || null,
      p_items: payloadItems
    })

    if (error) {
      throw error
    }

    await recordAdminLog({
      actionKey: 'commerce.returns.create',
      description: `Recorded return for ${selectedOrder.value?.order_number || 'customer order'}.`,
      metadata: {
        order_return_id: data || null,
        order_id: returnForm.order_id,
        warehouse_id: returnForm.warehouse_id,
        lines: payloadItems.length
      }
    })

    await Promise.all([
      loadRecentReturns(),
      loadSelectedOrder()
    ])

    returnForm.reason = ''
    returnForm.notes = ''
  } catch (error) {
    formError.value = isMissingSchemaError(error)
      ? 'Run the new commerce SQL first, then refresh this page.'
      : error.message || 'Could not create this return.'
  } finally {
    saving.value = false
  }
}

watch(orderSearchQuery, () => {
  if (orderSearchTimeoutId) {
    clearTimeout(orderSearchTimeoutId)
  }

  orderSearchTimeoutId = setTimeout(() => {
    loadOrderOptions()
  }, 300)
})

watch(() => returnForm.order_id, () => {
  loadSelectedOrder()
})

onBeforeUnmount(() => {
  if (orderSearchTimeoutId) {
    clearTimeout(orderSearchTimeoutId)
  }
})

onMounted(async () => {
  pageError.value = ''

  try {
    await Promise.all([
      loadWarehouses(),
      loadOrderOptions(),
      loadRecentReturns()
    ])
  } catch (error) {
    pageError.value = isMissingSchemaError(error)
      ? 'Run the new commerce SQL first, then refresh this page.'
      : error.message || 'Could not load return data.'
  }
})
</script>
