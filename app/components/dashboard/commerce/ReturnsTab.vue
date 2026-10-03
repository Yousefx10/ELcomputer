<template>
  <div class="space-y-6">
    <p v-if="externalErp" class="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">{{ $t('erp.manualAccounting') }}</p>
    <section class="rounded-2xl bg-white p-6 shadow">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div class="dashboard-page-summary-copy">
          <h3 class="text-2xl font-bold">{{ $t('common.returns') }}</h3>
          <p class="mt-1 text-sm text-gray-500">
            {{ $t(externalErp ? 'erp.manualAccounting' : 'dashboard.commerce.recordReturnedItemsAndSendThemBackToTheSelectedWarehouse') }}
          </p>
        </div>

        <div class="grid gap-3 sm:grid-cols-3">
          <div class="rounded-2xl bg-gray-100 px-4 py-3">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">{{ $t('common.warehouses') }}</p>
            <p class="mt-2 text-2xl font-bold text-gray-900">{{ warehouses.length }}</p>
          </div>

          <div class="rounded-2xl bg-gray-100 px-4 py-3">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">{{ $t('common.recentReturns') }}</p>
            <p class="mt-2 text-2xl font-bold text-gray-900">{{ recentReturns.length }}</p>
          </div>

          <div class="rounded-2xl bg-gray-100 px-4 py-3">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">{{ $t('common.eligibleOrders') }}</p>
            <p class="mt-2 text-2xl font-bold text-gray-900">{{ orderOptions.length }}</p>
          </div>
        </div>
      </div>
    </section>

    <section class="rounded-2xl bg-white p-6 shadow">
      <button
        type="button"
        class="flex w-full items-start justify-between gap-4 text-start"
        @click="isFormOpen = !isFormOpen"
      >
        <div>
          <h3 class="text-2xl font-bold">{{ $t(externalErp ? 'erp.returnRequest' : 'common.createReturn') }}</h3>
          <p class="mt-1 text-sm text-gray-500">
            {{ $t(externalErp ? 'erp.returnRequest' : 'dashboard.commerce.chooseAnOrderAndTheItemsReturnedToStock') }}
          </p>
        </div>

        <div class="flex items-center gap-2 pt-1 text-sm font-medium text-gray-500">
          <span>{{ isFormOpen ? $t('common.collapse') : $t('common.expand') }}</span>
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
            {{ $t('common.reset') }}
          </button>
        </div>

        <div class="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.searchOrder') }}</label>
          <input
            v-model="orderSearchQuery"
            type="text"
            :placeholder="$t('dashboard.commerce.orderNumberCustomerPhoneEmail')"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          >
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.order') }}</label>
          <select
            v-model="returnForm.order_id"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          >
            <option value="">{{ $t('common.selectOrder') }}</option>

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
          <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.warehouse') }}</label>
          <select
            v-model="returnForm.warehouse_id"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          >
            <option value="">{{ $t('common.selectWarehouse') }}</option>

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
          <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.reason') }}</label>
          <input
            v-model="returnForm.reason"
            type="text"
            :placeholder="$t('dashboard.commerce.damagedBoxWrongItemCustomerReturn')"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          >
        </div>

        <div class="md:col-span-2">
          <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.notes') }}</label>
          <textarea
            v-model="returnForm.notes"
            rows="3"
            :placeholder="$t('common.optionalReturnNotes')"
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
                {{ selectedOrder.order_number || $t('common.orderValueVariant3', { value0: (selectedOrder.id.slice(0, 8)) }) }}
              </p>

              <p class="text-sm text-gray-600">
                {{ selectedOrder.first_name || $t('common.customer') }}<span v-if="selectedOrder.last_name"> {{ selectedOrder.last_name }}</span>
                <span v-if="selectedOrder.phone"> · {{ selectedOrder.phone }}</span>
              </p>

              <p class="text-sm text-gray-500">
                {{ selectedOrder.city || $t('common.noCity') }}<span v-if="selectedOrder.governorate">, {{ selectedOrder.governorate }}</span>
              </p>
            </div>

            <div class="flex flex-wrap gap-3 text-sm">
              <div class="rounded-xl bg-white px-4 py-3">
                <p class="text-gray-500">{{ $t('common.status') }}</p>
                <span
                  class="mt-1 inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase"
                  :class="getCustomerOrderStatusClass(selectedOrder.status)"
                >
                  {{ $uiLabel(formatCustomerOrderStatus(selectedOrder.status)) }}
                </span>
              </div>

              <div class="rounded-xl bg-white px-4 py-3">
                <p class="text-gray-500">{{ $t('common.total') }}</p>
                <p class="mt-1 text-lg font-bold text-gray-900">{{ formatCommerceCurrency(selectedOrder.total_amount) }}</p>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-6 rounded-2xl border bg-gray-50 p-4">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h4 class="text-lg font-bold text-gray-900">{{ $t('common.returnedItems') }}</h4>
              <p class="mt-1 text-sm text-gray-500">
                {{ $t('dashboard.commerce.enterQuantitiesOnlyForLegacyAggregateInventory') }}
              </p>
            </div>
          </div>

          <div class="mt-4 flex flex-col gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p class="text-sm text-blue-900">
              {{ $t('dashboard.commerce.qrTrackedProductsAreReturnedOnePhysicalItemAtATimeByScanningTheExactItemSQrCode') }}
              <span v-if="trackedOrderItemCount">
                {{ $t('dashboard.commerce.thisOrderHasValueTrackedLinevalueHiddenFromThisQuantityForm', { value0: (trackedOrderItemCount), value1: (trackedOrderItemCount === 1 ? '' : $uiPluralSuffix('s')) }) }}
              </span>
            </p>

            <NuxtLinkLocale
              to="/dashboard/commerce?tab=scan"
              class="shrink-0 text-sm font-bold text-blue-700 hover:text-blue-900 hover:underline"
            >
              {{ $t('common.scanItemQr') }}
            </NuxtLinkLocale>
          </div>

          <p v-if="loadingOrderItems" class="mt-4 text-sm text-gray-500">
            {{ $t('common.loadingOrderItems') }}
          </p>

          <p v-else-if="returnForm.order_id && !returnItems.length" class="mt-4 text-sm text-gray-500">
            {{ $t('dashboard.commerce.thisOrderDoesNotHaveReturnableLegacyInventoryItems') }}
          </p>

          <p v-else-if="!returnForm.order_id" class="mt-4 text-sm text-gray-500">
            {{ $t('common.selectAnOrderFirst') }}
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
                  {{ $t('common.orderedValue', { value0: (item.purchased_quantity) }) }}
                  <span v-if="item.already_returned_quantity"> {{ $t('common.returnedValue', { value0: (item.already_returned_quantity) }) }}</span>
                </p>
              </div>

              <div class="rounded-xl bg-gray-50 px-3 py-3 text-sm">
                <p class="text-gray-500">{{ $t('common.available') }}</p>
                <p class="mt-1 font-bold text-gray-900">{{ item.remaining_quantity }}</p>
              </div>

              <div class="rounded-xl bg-gray-50 px-3 py-3 text-sm">
                <p class="text-gray-500">{{ $t('common.price') }}</p>
                <p class="mt-1 font-bold text-gray-900">{{ formatCommerceCurrency(item.unit_price) }}</p>
              </div>

              <input
                v-model="item.return_quantity"
                type="number"
                min="0"
                :max="item.remaining_quantity"
                class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                :placeholder="$t('common.returnQty')"
              >
            </div>
          </div>

          <p v-if="formError" class="mt-4 text-sm text-red-600">
            {{ $uiMessage(formError) }}
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
              {{ saving ? $t('common.saving') : $t('common.receiveReturn') }}
            </button>
          </div>
        </div>
      </div>
    </section>

    <section class="rounded-2xl bg-white p-6 shadow">
      <div class="flex items-center justify-between gap-3">
        <button
          type="button"
          class="flex min-w-0 flex-1 items-start justify-between gap-4 text-start"
          @click="isRecentReturnsOpen = !isRecentReturnsOpen"
        >
          <div>
            <h3 class="text-2xl font-bold">{{ $t('common.recentReturns') }}</h3>
            <p class="mt-1 text-sm text-gray-500">
              {{ $t('dashboard.commerce.latestRecordedReturnsAcrossTheSystem') }}
            </p>
          </div>

          <div class="flex items-center gap-2 pt-1 text-sm font-medium text-gray-500">
            <span>{{ isRecentReturnsOpen ? $t('common.collapse') : $t('common.expand') }}</span>
            <Icon
              name="lucide:chevron-down"
              size="18"
              class="transition-transform"
              :class="isRecentReturnsOpen ? 'rotate-180' : ''"
            />
          </div>
        </button>

        <button
          v-if="isRecentReturnsOpen"
          type="button"
          class="rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
          @click="loadRecentReturns"
        >
          {{ $t('common.refresh') }}
        </button>
      </div>

      <div v-if="isRecentReturnsOpen">
      <p v-if="pageError" class="mt-5 text-sm text-red-600">
        {{ $uiMessage(pageError) }}
      </p>

      <p v-else-if="loadingReturns" class="mt-5 text-sm text-gray-500">
        {{ $t('common.loadingReturns') }}
      </p>

      <p v-else-if="!recentReturns.length" class="mt-5 text-sm text-gray-500">
        {{ $t('dashboard.commerce.noReturnsRecordedYet') }}
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
                {{ orderNameMap[returnRecord.order_id] || $t('common.orderValueVariant3', { value0: (String(returnRecord.order_id || '').slice(0, 8)) }) }}
              </p>

              <p class="text-sm text-gray-500">
                {{ warehouseNameMap[returnRecord.warehouse_id] || $t('common.unknownWarehouse') }}
              </p>

              <p class="text-xs text-gray-400">
                {{ formatCommerceDate(returnRecord.created_at) }}
              </p>
            </div>

            <div class="text-start md:text-end">
              <p class="text-lg font-bold text-gray-900">
                {{ $t('common.valueItemvalue', { value0: (returnRecord.total_items), value1: (returnRecord.total_items === 1 ? '' : $uiPluralSuffix('s')) }) }}
              </p>

              <p class="text-sm text-gray-500">
                {{ returnRecord.reason || $t('common.noReasonProvided') }}
                <span v-if="returnRecord.erp_action_status === 'manual_required'" class="mt-1 block text-amber-700">{{ $t('erp.manualAccounting') }}</span>
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
const { data: erpState } = useNuxtData('active-erp')
const externalErp = computed(() => erpState.value?.mode === 'daftra')

const { intlLocale } = useUiLocale()
const formatCommerceCurrency = value => baseFormatCommerceCurrency(value, intlLocale.value)
const formatCommerceDate = value => baseFormatCommerceDate(value, intlLocale.value)

import { formatCustomerOrderStatus, getCustomerOrderStatusClass } from '~/utils/orderStatus'
import { formatCommerceCurrency as baseFormatCommerceCurrency, formatCommerceDate as baseFormatCommerceDate } from '~/utils/commerce'

const supabase = useSupabaseClient()
const { recordAdminLog } = useAdminLogs()

const warehouses = ref([])
const orderOptions = ref([])
const recentReturns = ref([])
const orderCatalog = ref([])
const selectedOrder = ref(null)
const returnItems = ref([])
const trackedOrderItemCount = ref(0)
const loadingOrders = ref(false)
const loadingOrderItems = ref(false)
const loadingReturns = ref(false)
const saving = ref(false)
const pageError = ref('')
const formError = ref('')
const isFormOpen = ref(false)
const isRecentReturnsOpen = ref(false)
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
  trackedOrderItemCount.value = 0
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
    trackedOrderItemCount.value = 0
    return
  }

  loadingOrderItems.value = true
  formError.value = ''
  trackedOrderItemCount.value = 0

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

    const productIds = [...new Set(
      (orderItemsData || [])
        .map((item) => item.product_id)
        .filter(Boolean)
    )]
    const serializedProductIds = new Set()

    if (productIds.length) {
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, is_serialized')
        .in('id', productIds)

      if (productsError) {
        throw productsError
      }

      for (const product of productsData || []) {
        if (product.is_serialized) {
          serializedProductIds.add(product.id)
        }
      }
    }

    trackedOrderItemCount.value = (orderItemsData || [])
      .filter((item) => item.product_id && serializedProductIds.has(item.product_id))
      .length

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
          is_serialized: serializedProductIds.has(item.product_id),
          purchased_quantity: purchasedQuantity,
          already_returned_quantity: alreadyReturnedQuantity,
          remaining_quantity: remainingQuantity,
          unit_price: Number(item.unit_price || 0),
          return_quantity: 0
        }
      })
      .filter((item) => !item.is_serialized && item.remaining_quantity > 0)
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
    if (item.is_serialized) {
      formError.value = `${item.product_title} is QR-tracked. Return the exact item through the QR scanner.`
      return
    }

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
