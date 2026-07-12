<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      @click.self="closeDialog"
    >
      <div class="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div class="sticky top-0 z-10 border-b bg-white px-6 py-5">
          <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p class="text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">
                Order Details
              </p>

              <h3 class="mt-2 text-2xl font-bold text-gray-900">
                {{ orderDetail?.order_number || orderTitle }}
              </h3>

              <div class="mt-3 flex flex-wrap items-center gap-3">
                <span
                  class="rounded-full px-3 py-1 text-xs font-semibold uppercase"
                  :class="getCustomerOrderStatusClass(orderDetail?.status)"
                >
                  {{ formatCustomerOrderStatus(orderDetail?.status) }}
                </span>

                <span class="text-sm text-gray-500">
                  {{ formatDate(orderDetail?.created_at) }}
                </span>
              </div>
            </div>

            <button
              type="button"
              class="self-start rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
              @click="closeDialog"
            >
              Close
            </button>
          </div>
        </div>

        <div class="p-6">
          <div v-if="loading" class="rounded-2xl bg-gray-50 p-8 text-center text-gray-500">
            Loading order details...
          </div>

          <div v-else-if="errorMessage" class="rounded-2xl bg-red-50 p-4 text-red-600">
            {{ errorMessage }}
          </div>

          <div v-else-if="orderDetail" class="space-y-6">
            <section class="rounded-2xl border bg-gray-50 p-5">
              <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h4 class="text-lg font-bold text-gray-900">
                    Update Status
                  </h4>
                  <p class="mt-1 text-sm text-gray-500">
                    Select the next order status for shipping and fulfillment management.
                  </p>
                </div>

                <p v-if="statusMessage" class="text-sm text-green-700">
                  {{ statusMessage }}
                </p>
              </div>

              <div class="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <button
                  v-for="statusOption in customerOrderStatusOptions"
                  :key="statusOption.value"
                  type="button"
                  :disabled="statusLoading"
                  class="rounded-xl border px-4 py-3 text-left text-sm font-semibold transition"
                  :class="orderDetail.status === statusOption.value
                    ? 'border-black bg-black text-white'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'"
                  @click="updateOrderStatus(statusOption.value)"
                >
                  {{ statusOption.label }}
                </button>
              </div>
            </section>

            <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
              <section class="space-y-4">
                <div class="rounded-2xl border p-5">
                  <h4 class="text-lg font-bold text-gray-900">Customer</h4>

                  <div class="mt-4 space-y-2 text-sm text-gray-600">
                    <p>
                      {{ orderDetail.first_name || 'Customer' }}
                      <span v-if="orderDetail.last_name"> {{ orderDetail.last_name }}</span>
                    </p>
                    <p>{{ orderDetail.email || customerDetail?.email || 'No email saved' }}</p>
                    <p>{{ orderDetail.phone || customerDetail?.phone || 'No phone saved' }}</p>
                  </div>
                </div>

                <div class="rounded-2xl border p-5">
                  <h4 class="text-lg font-bold text-gray-900">Delivery Address</h4>

                  <div class="mt-4 space-y-2 text-sm text-gray-600">
                    <p>{{ orderDetail.street_address || customerDetail?.address_line_1 || 'No address saved' }}</p>
                    <p>
                      {{ orderDetail.city || customerDetail?.city || 'Unknown city' }}
                      <span v-if="orderDetail.governorate">, {{ orderDetail.governorate }}</span>
                    </p>
                    <p v-if="customerDetail?.country || orderDetail.governorate">
                      {{ customerDetail?.country || 'Egypt' }}
                    </p>
                  </div>
                </div>

                <div class="rounded-2xl border p-5">
                  <h4 class="text-lg font-bold text-gray-900">Order Info</h4>

                  <div class="mt-4 grid gap-3 sm:grid-cols-2 text-sm text-gray-600">
                    <div>
                      <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">Order Number</p>
                      <p class="mt-1">{{ orderDetail.order_number || orderTitle }}</p>
                    </div>

                    <div>
                      <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">Created</p>
                      <p class="mt-1">{{ formatDate(orderDetail.created_at) }}</p>
                    </div>

                    <div>
                      <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">Payment Method</p>
                      <p class="mt-1">{{ orderDetail.payment_method || 'Not selected yet' }}</p>
                    </div>

                    <div>
                      <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">Shipping Method</p>
                      <p class="mt-1">{{ orderDetail.shipping_method || 'Not selected yet' }}</p>
                    </div>
                  </div>
                </div>
              </section>

              <section class="space-y-4">
                <div class="rounded-2xl border p-5">
                  <h4 class="text-lg font-bold text-gray-900">Items</h4>

                  <div v-if="!orderItems.length" class="mt-4 text-sm text-gray-500">
                    No order items saved yet.
                  </div>

                  <div v-else class="mt-4 space-y-3">
                    <article
                      v-for="item in orderItems"
                      :key="item.id"
                      class="flex flex-col gap-4 rounded-2xl bg-gray-50 p-4 sm:flex-row sm:items-center"
                    >
                      <div class="flex h-16 w-16 items-center justify-center rounded-xl bg-white p-2">
                        <img
                          v-if="item.image_url"
                          :src="item.image_url"
                          :alt="item.product_title"
                          class="h-full w-full object-contain"
                        >
                      </div>

                      <div class="min-w-0 flex-1">
                        <p class="font-semibold text-gray-900">
                          {{ item.product_title }}
                        </p>
                        <p class="mt-1 text-sm text-gray-500">
                          Qty {{ item.quantity }}
                        </p>
                      </div>

                      <div class="text-right text-sm text-gray-600">
                        <p>{{ formatCurrency(item.unit_price) }} each</p>
                        <p class="mt-1 font-semibold text-gray-900">{{ formatCurrency(item.line_total) }}</p>
                      </div>
                    </article>
                  </div>
                </div>

                <div class="rounded-2xl border p-5">
                  <h4 class="text-lg font-bold text-gray-900">Totals</h4>

                  <div class="mt-4 space-y-3">
                    <div class="flex items-center justify-between text-sm text-gray-500">
                      <span>Subtotal</span>
                      <span>{{ formatCurrency(orderDetail.subtotal_amount) }}</span>
                    </div>

                    <div class="flex items-center justify-between text-sm text-gray-500">
                      <span>Coupon</span>
                      <span>{{ orderDetail.coupon_code || 'No coupon' }}</span>
                    </div>

                    <div class="flex items-center justify-between text-sm text-gray-500">
                      <span>Discount</span>
                      <span>- {{ formatCurrency(orderDetail.discount_amount) }}</span>
                    </div>

                    <div class="flex items-center justify-between border-t pt-3 text-lg font-bold text-gray-900">
                      <span>Total</span>
                      <span>{{ formatCurrency(orderDetail.total_amount) }}</span>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import {
  customerOrderStatusOptions,
  formatCustomerOrderStatus,
  getCustomerOrderStatusClass
} from '~/utils/orderStatus'

const props = defineProps({
  open: {
    type: Boolean,
    default: false
  },
  orderId: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:open', 'updated'])

const supabase = useSupabaseClient()
const loading = ref(false)
const statusLoading = ref(false)
const errorMessage = ref('')
const statusMessage = ref('')
const orderDetail = ref(null)
const orderItems = ref([])
const customerDetail = ref(null)

const orderTitle = computed(() => {
  if (!props.orderId) {
    return 'Order'
  }

  return `Order #${props.orderId.slice(0, 8)}`
})

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

const resetDialogState = () => {
  errorMessage.value = ''
  statusMessage.value = ''
  orderDetail.value = null
  orderItems.value = []
  customerDetail.value = null
}

const closeDialog = () => {
  emit('update:open', false)
}

const loadOrderDetails = async () => {
  if (!props.open || !props.orderId) {
    return
  }

  loading.value = true
  errorMessage.value = ''
  statusMessage.value = ''

  try {
    const response = await $fetch(`/api/admin-orders/${props.orderId}`, {
      headers: await getAuthHeaders()
    })

    orderDetail.value = response.order || null
    orderItems.value = response.items || []
    customerDetail.value = response.customer || null
  } catch (error) {
    errorMessage.value = error?.data?.statusMessage || error?.message || 'Could not load order details.'
  } finally {
    loading.value = false
  }
}

const updateOrderStatus = async (nextStatus) => {
  if (!props.orderId || !orderDetail.value || orderDetail.value.status === nextStatus) {
    return
  }

  statusLoading.value = true
  errorMessage.value = ''
  statusMessage.value = ''

  try {
    const response = await $fetch(`/api/admin-orders/${props.orderId}`, {
      method: 'PATCH',
      body: {
        status: nextStatus
      },
      headers: await getAuthHeaders()
    })

    orderDetail.value = response.order || orderDetail.value
    statusMessage.value = 'Order status updated successfully.'
    emit('updated', response.order)
  } catch (error) {
    errorMessage.value = error?.data?.statusMessage || error?.message || 'Could not update order status.'
  } finally {
    statusLoading.value = false
  }
}

watch(
  () => [props.open, props.orderId],
  async ([isOpen, orderId]) => {
    if (!isOpen) {
      resetDialogState()
      return
    }

    if (orderId) {
      await loadOrderDetails()
    }
  },
  { immediate: true }
)
</script>
