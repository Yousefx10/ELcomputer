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
                <span v-if="orderDetail?.is_preorder" class="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">PRE-ORDER</span>
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

            <div class="flex flex-wrap items-center gap-2">
              <button
                type="button"
                :disabled="loading || !orderDetail"
                class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                @click="printOrderDetails"
              >
                PDF
              </button>

              <button
                type="button"
                class="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
                @click="closeDialog"
              >
                Close
              </button>
            </div>
          </div>
        </div>

        <div class="p-6">
          <div v-if="loading" class="rounded-2xl bg-gray-50 p-8 text-center text-gray-500">
            Loading order details...
          </div>

          <div v-else-if="errorMessage && !orderDetail" class="rounded-2xl bg-red-50 p-4 text-red-600">
            {{ errorMessage }}
          </div>

          <div v-else-if="orderDetail" class="space-y-6">
            <p v-if="errorMessage" role="alert" class="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{{ errorMessage }}</p>
            <section class="rounded-2xl border bg-gray-50 p-5">
              <button
                type="button"
                class="flex w-full items-start justify-between gap-4 text-left"
                @click="statusPanelOpen = !statusPanelOpen"
              >
                <div class="min-w-0">
                  <h4 class="text-lg font-bold text-gray-900">
                    Update Status
                  </h4>
                  <p class="mt-1 text-sm text-gray-500">
                    Select the next order status for shipping and fulfillment management.
                  </p>
                </div>

                <div class="flex shrink-0 items-center gap-3">
                  <p v-if="statusMessage" class="text-sm text-green-700">
                    {{ statusMessage }}
                  </p>

                  <Icon
                    name="lucide:chevron-down"
                    size="20"
                    class="transition"
                    :class="statusPanelOpen ? 'rotate-180' : ''"
                  />
                </div>
              </button>

              <div v-if="statusPanelOpen" class="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <button
                  v-for="statusOption in visibleStatusOptions"
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

            <section v-if="orderDetail.is_preorder" class="rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
              <h4 class="text-lg font-bold text-gray-900">Pre-order payment and fulfillment</h4>
              <p class="mt-1 text-sm text-gray-600">{{ orderDetail.preorder_fulfillment_state === 'ready' ? 'Physical stock assigned. This order can proceed through normal fulfillment.' : 'Awaiting stock. Do not pack or ship this order.' }}</p>
              <dl class="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt>Order value</dt><dd class="font-bold">{{ formatCurrency(orderDetail.total_amount) }}</dd></div><div><dt>Required initial payment</dt><dd class="font-bold">{{ formatCurrency(orderDetail.initial_amount_due) }}</dd></div><div><dt>Verified paid</dt><dd class="font-bold">{{ formatCurrency(orderDetail.amount_paid) }}</dd></div><div><dt>Balance remaining</dt><dd class="font-bold">{{ formatCurrency(Number(orderDetail.total_amount) - Number(orderDetail.amount_paid)) }}</dd></div></dl>
              <p class="mt-3 text-sm font-semibold text-amber-900">{{ Number(orderDetail.amount_paid) >= Number(orderDetail.initial_amount_due) ? 'Initial payment received' : 'Initial payment pending' }}</p>
              <p v-if="orderDetail.status === 'cancelled' && Number(orderDetail.amount_paid) > 0" class="mt-2 text-sm font-semibold text-red-700">Payment was recorded. Review refund handling manually.</p>
              <button v-if="orderDetail.preorder_fulfillment_state === 'awaiting_stock' && orderDetail.payment_status === 'paid' && orderDetail.status === 'on_hold'" type="button" :disabled="releaseSaving" class="mt-3 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" @click="releasePreorder">{{ releaseSaving ? 'Checking stock…' : 'Assign arrived stock and release' }}</button>
              <ul v-if="preorderPayments.length" class="mt-4 space-y-1 text-xs text-gray-600"><li v-for="payment in preorderPayments" :key="payment.id">{{ formatCurrency(payment.amount) }} · {{ payment.reference }} · {{ formatDate(payment.recorded_at) }}</li></ul>
              <form v-if="!['cancelled', 'refunded'].includes(orderDetail.status) && Number(orderDetail.amount_paid) < Number(orderDetail.total_amount)" class="mt-5 grid gap-3 border-t pt-4 sm:grid-cols-[1fr_1.5fr_auto]" @submit.prevent="recordVerifiedPayment">
                <label class="text-sm font-semibold">Verified amount<input v-model="paymentAmount" type="number" min="0.01" step="0.01" required class="mt-1 w-full rounded-lg border bg-white p-2"></label>
                <label class="text-sm font-semibold">Bank or InstaPay reference<input v-model="paymentReference" type="text" minlength="3" maxlength="120" required class="mt-1 w-full rounded-lg border bg-white p-2"></label>
                <button type="submit" :disabled="paymentSaving" class="self-end rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{{ paymentSaving ? 'Recording…' : 'Record verified payment' }}</button>
                <label class="flex items-start gap-2 text-xs text-gray-700 sm:col-span-3"><input v-model="paymentVerified" type="checkbox" required> I verified receipt outside this system. This records accounting only.</label>
              </form>
            </section>

            <section v-if="shippingDetail" class="rounded-2xl border p-5">
              <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 class="text-lg font-bold text-gray-900">PDC Shipping</h4>
                  <p class="mt-1 text-sm text-gray-500">
                    {{ shippingDetail.awb ? `AWB ${shippingDetail.awb}` : 'Waiting for an AWB.' }}
                  </p>
                  <p v-if="shippingDetail.provider_status_name" class="mt-1 text-sm text-gray-600">
                    {{ shippingDetail.provider_status_name }}
                  </p>
                  <p v-if="shippingDetail.provider_reason_name" class="mt-1 text-sm text-gray-600">
                    {{ shippingDetail.provider_reason_name }}
                  </p>
                  <p v-if="shippingDetail.last_error" class="mt-2 text-sm text-red-600">
                    {{ shippingDetail.last_error }}
                  </p>
                </div>

                <div class="flex flex-wrap items-center gap-2">
                  <span class="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold uppercase text-gray-700">
                    {{ shippingDetail.state }}
                  </span>
                  <button
                    v-if="shippingDetail.label_ready"
                    type="button"
                    :disabled="labelLoading"
                    class="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
                    @click="downloadShippingLabel"
                  >
                    {{ labelLoading ? 'Downloading...' : 'Shipping Label' }}
                  </button>
                </div>
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
                      <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">Payment Status</p>
                      <p class="mt-1 capitalize">{{ orderDetail.payment_status || 'pending' }}</p>
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
                        <p v-if="item.is_preorder" class="mt-1 text-xs font-bold text-amber-800">PRE-ORDER · {{ item.preorder_payment_mode === 'deposit' ? `${item.preorder_deposit_percent}% deposit` : 'Full payment' }}</p>
                        <p v-if="item.expected_availability_date" class="text-xs text-gray-600">Expected {{ expectedAvailabilityLabel(item.expected_availability_date) }}</p>

                        <p
                          v-if="item.variant_name || item.variant_color_name"
                          class="mt-1 text-sm font-medium text-gray-600"
                        >
                          {{ item.variant_name || item.variant_color_name }}
                          <span v-if="item.variant_sku || item.variant_code" class="text-gray-400">
                            · {{ item.variant_sku || item.variant_code }}
                          </span>
                        </p>

                        <div
                          v-if="item.serialized_units?.length"
                          class="mt-2 flex flex-wrap gap-2"
                        >
                          <NuxtLink
                            v-for="unit in item.serialized_units"
                            :key="unit.id"
                            :to="{
                              path: '/dashboard/commerce',
                              query: {
                                tab: 'scan',
                                token: unit.unit_code
                              }
                            }"
                            class="rounded-full bg-purple-100 px-2.5 py-1 text-xs font-semibold text-purple-700 hover:bg-purple-200"
                          >
                            {{ unit.unit_code }}
                          </NuxtLink>
                        </div>
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
import { expectedAvailabilityLabel } from '~/utils/preorder'

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
const { data: siteContent } = await useSiteContent()
const loading = ref(false)
const statusLoading = ref(false)
const labelLoading = ref(false)
const errorMessage = ref('')
const statusMessage = ref('')
const statusPanelOpen = ref(false)
const orderDetail = ref(null)
const orderItems = ref([])
const customerDetail = ref(null)
const shippingDetail = ref(null)
const preorderPayments = ref([])
const paymentAmount = ref('')
const paymentReference = ref('')
const paymentVerified = ref(false)
const paymentSaving = ref(false)
const releaseSaving = ref(false)
const visibleStatusOptions = computed(() => orderDetail.value?.is_preorder && orderDetail.value?.preorder_fulfillment_state === 'awaiting_stock'
  ? customerOrderStatusOptions.filter(option => ['on_hold', 'cancelled'].includes(option.value))
  : customerOrderStatusOptions)

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

const printableSiteName = computed(() => {
  return String(siteContent.value?.settings?.site_name || 'Store').trim() || 'Store'
})

const printableSiteLogoUrl = computed(() => {
  return String(siteContent.value?.settings?.site_logo_url || '').trim()
})

const escapeHtml = (value) => {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

const buildPrintableOrderHtml = () => {
  if (!orderDetail.value) {
    return ''
  }

  const printableItems = orderItems.value.length
    ? orderItems.value.map((item) => `
        <tr>
          <td>${escapeHtml(item.product_title || 'Product')}</td>
          <td>${escapeHtml(item.quantity)}</td>
          <td>${escapeHtml(formatCurrency(item.unit_price))}</td>
          <td>${escapeHtml(formatCurrency(item.line_total))}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="4">No order items saved yet.</td></tr>'

  const fullName = `${orderDetail.value.first_name || 'Customer'} ${orderDetail.value.last_name || ''}`.trim()
  const printableAddress = [
    orderDetail.value.street_address || customerDetail.value?.address_line_1 || 'No address saved',
    [orderDetail.value.city || customerDetail.value?.city || 'Unknown city', orderDetail.value.governorate].filter(Boolean).join(', '),
    customerDetail.value?.country || (orderDetail.value.governorate ? 'Egypt' : '')
  ].filter(Boolean)
  const printableLogoMarkup = printableSiteLogoUrl.value
    ? `<img src="${escapeHtml(printableSiteLogoUrl.value)}" alt="${escapeHtml(printableSiteName.value)}" class="logo">`
    : `<p class="brand-name">${escapeHtml(printableSiteName.value)}</p>`

  return `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>${escapeHtml(orderDetail.value.order_number || orderTitle.value)}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 32px; color: #111827; }
        h1, h2, h3, p { margin: 0; }
        .brand { margin-bottom: 24px; }
        .logo { max-width: 180px; max-height: 72px; display: block; object-fit: contain; }
        .brand-name { font-size: 24px; font-weight: 700; }
        .header { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 24px; }
        .muted { color: #6b7280; }
        .status { display: inline-block; margin-top: 12px; padding: 6px 12px; border-radius: 999px; background: #f3f4f6; font-size: 12px; font-weight: 700; text-transform: uppercase; }
        .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-bottom: 24px; }
        .card { border: 1px solid #e5e7eb; border-radius: 16px; padding: 16px; }
        .card h3 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; margin-bottom: 12px; }
        .stack > p + p { margin-top: 8px; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th, td { border-bottom: 1px solid #e5e7eb; padding: 12px 10px; text-align: left; font-size: 14px; vertical-align: top; }
        th { color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; }
        .totals { width: 320px; margin-left: auto; margin-top: 24px; }
        .totals-row { display: flex; justify-content: space-between; gap: 16px; padding: 8px 0; color: #4b5563; }
        .totals-row.total { border-top: 1px solid #e5e7eb; margin-top: 8px; padding-top: 12px; color: #111827; font-size: 18px; font-weight: 700; }
      </style>
    </head>
    <body>
      <div class="brand">
        ${printableLogoMarkup}
      </div>

      <div class="header">
        <div>
          <p class="muted">Order Details</p>
          <h1>${escapeHtml(orderDetail.value.order_number || orderTitle.value)}</h1>
          <span class="status">${escapeHtml(formatCustomerOrderStatus(orderDetail.value.status))}</span>
        </div>

        <div class="muted">
          <p>${escapeHtml(formatDate(orderDetail.value.created_at))}</p>
        </div>
      </div>

      <div class="grid">
        <section class="card">
          <h3>Customer</h3>
          <div class="stack">
            <p>${escapeHtml(fullName)}</p>
            <p>${escapeHtml(orderDetail.value.email || customerDetail.value?.email || 'No email saved')}</p>
            <p>${escapeHtml(orderDetail.value.phone || customerDetail.value?.phone || 'No phone saved')}</p>
          </div>
        </section>

        <section class="card">
          <h3>Delivery Address</h3>
          <div class="stack">
            ${printableAddress.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}
          </div>
        </section>

        <section class="card">
          <h3>Order Info</h3>
          <div class="stack">
            <p><strong>Payment:</strong> ${escapeHtml(orderDetail.value.payment_method || 'Not selected yet')}</p>
            <p><strong>Shipping:</strong> ${escapeHtml(orderDetail.value.shipping_method || 'Not selected yet')}</p>
            <p><strong>Coupon:</strong> ${escapeHtml(orderDetail.value.coupon_code || 'No coupon')}</p>
          </div>
        </section>
      </div>

      <section class="card">
        <h3>Items</h3>
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Qty</th>
              <th>Unit Price</th>
              <th>Line Total</th>
            </tr>
          </thead>
          <tbody>${printableItems}</tbody>
        </table>
      </section>

      <div class="totals">
        <div class="totals-row">
          <span>Subtotal</span>
          <span>${escapeHtml(formatCurrency(orderDetail.value.subtotal_amount))}</span>
        </div>
        <div class="totals-row">
          <span>Discount</span>
          <span>- ${escapeHtml(formatCurrency(orderDetail.value.discount_amount))}</span>
        </div>
        <div class="totals-row total">
          <span>Total</span>
          <span>${escapeHtml(formatCurrency(orderDetail.value.total_amount))}</span>
        </div>
      </div>
    </body>
  </html>`
}

const printOrderDetails = () => {
  if (!orderDetail.value || typeof window === 'undefined') {
    return
  }

  const printWindow = window.open('', '_blank', 'width=960,height=900')

  if (!printWindow) {
    errorMessage.value = 'Please allow pop-ups so the order can be printed as PDF.'
    return
  }

  errorMessage.value = ''
  printWindow.addEventListener('load', () => {
    printWindow.focus()
    printWindow.print()
  }, { once: true })
  printWindow.document.open()
  printWindow.document.write(buildPrintableOrderHtml())
  printWindow.document.close()
}

const resetDialogState = () => {
  errorMessage.value = ''
  statusMessage.value = ''
  statusPanelOpen.value = false
  orderDetail.value = null
  orderItems.value = []
  customerDetail.value = null
  shippingDetail.value = null
}

const closeDialog = () => {
  emit('update:open', false)
}

const downloadShippingLabel = async () => {
  if (!props.orderId || !shippingDetail.value?.label_ready) {
    return
  }

  labelLoading.value = true
  errorMessage.value = ''

  try {
    const response = await fetch(`/api/admin-shipping/orders/${props.orderId}/label`, {
      headers: await getAuthHeaders()
    })

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}))
      throw new Error(errorBody?.statusMessage || 'Could not download the shipping label.')
    }

    const labelUrl = URL.createObjectURL(await response.blob())
    const link = document.createElement('a')
    link.href = labelUrl
    link.download = `PDC-${shippingDetail.value.awb || props.orderId}.pdf`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(labelUrl)
  } catch (error) {
    errorMessage.value = error?.message || 'Could not download the shipping label.'
  } finally {
    labelLoading.value = false
  }
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
    shippingDetail.value = response.shipping || null
    preorderPayments.value = response.preorderPayments || []
  } catch (error) {
    orderDetail.value = null
    errorMessage.value = error?.data?.statusMessage || error?.message || 'Could not load order details.'
  } finally {
    loading.value = false
  }
}

const recordVerifiedPayment = async () => {
  if (!paymentVerified.value || paymentSaving.value) return
  paymentSaving.value = true
  errorMessage.value = ''
  try {
    const response = await $fetch(`/api/admin-orders/${props.orderId}/payments`, {
      method: 'POST', headers: await getAuthHeaders(),
      body: { amount: paymentAmount.value, reference: paymentReference.value, verified: true }
    })
    orderDetail.value = response.order
    paymentAmount.value = ''
    paymentReference.value = ''
    paymentVerified.value = false
    await loadOrderDetails()
    emit('updated', response.order)
  } catch (error) {
    errorMessage.value = error?.data?.statusMessage || 'Could not record the payment.'
  } finally { paymentSaving.value = false }
}

const releasePreorder = async () => {
  if (releaseSaving.value) return
  releaseSaving.value = true
  errorMessage.value = ''
  try {
    const response = await $fetch(`/api/admin-orders/${props.orderId}/release`, { method: 'POST', headers: await getAuthHeaders() })
    orderDetail.value = response.order
    await loadOrderDetails()
    emit('updated', response.order)
  } catch (error) {
    errorMessage.value = error?.data?.statusMessage || 'Could not release the preorder.'
  } finally { releaseSaving.value = false }
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
