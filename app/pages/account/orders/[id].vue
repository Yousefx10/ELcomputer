<script setup>
import { formatAccountDate, formatAccountMoney, paymentStatusClass, paymentStatusLabel } from '~/utils/accountOrders'
import { formatCustomerOrderStatus, getCustomerOrderStatusClass } from '~/utils/orderStatus'
import { getPaymentMethodLabel, paymentMethodNeedsProof, paymentProofStatusClass, paymentProofStatusLabel } from '~/utils/paymentMethods'
import { getConfiguredStoreImageUrl } from '~/utils/storefront'

definePageMeta({ layout: 'account', middleware: 'customer-auth' })
const route = useRoute()
const { request, errorText } = useSupportClient()
const detail = ref(null)
const loading = ref(true)
const error = ref('')
const proofFile = ref(null)
const proofNotice = ref('')
let loadVersion = 0

const load = async () => {
  const version = ++loadVersion
  loading.value = true
  error.value = ''
  try {
    const result = await request(`/api/account/orders/${encodeURIComponent(String(route.params.id))}`)
    if (version === loadVersion) detail.value = result
  } catch (cause) {
    if (version === loadVersion) { detail.value = null; error.value = errorText(cause, 'Could not load this order.') }
  } finally {
    if (version === loadVersion) loading.value = false
  }
}

const stageProof = () => {
  proofNotice.value = proofFile.value
    ? 'Your proof is selected. Secure submission will be connected with the payment backend.'
    : ''
}

watch(() => route.params.id, load)
onMounted(load)
useHead(() => ({ title: detail.value?.order?.order_number ? `${detail.value.order.order_number} | Your Orders` : 'Order Details' }))
</script>

<template>
  <div class="space-y-5">
    <NuxtLink to="/account/orders" class="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"><Icon name="lucide:arrow-left" size="16" aria-hidden="true" /> All orders</NuxtLink>
    <p v-if="error" role="alert" class="rounded-xl bg-red-50 p-4 text-sm text-red-700">{{ error }}</p>
    <p v-if="loading" role="status" class="rounded-2xl bg-white p-8 text-center text-sm text-slate-600">Loading order…</p>

    <template v-else-if="detail?.order">
      <header class="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="min-w-0"><p class="text-sm font-semibold text-blue-700">Order details</p><h1 class="mt-1 break-all text-2xl font-bold text-slate-900">{{ detail.order.order_number || `Order ${detail.order.id.slice(0, 8)}` }}</h1><p class="mt-1 text-sm text-slate-600">Placed {{ formatAccountDate(detail.order.created_at, true) }}</p></div>
          <span class="rounded-full px-3 py-1.5 text-sm font-semibold" :class="getCustomerOrderStatusClass(detail.order.status)">{{ formatCustomerOrderStatus(detail.order.status) }}</span>
        </div>
        <div class="mt-5 flex flex-wrap items-center gap-3"><NuxtLink :to="{ path: '/account/support', query: { order: detail.order.id } }" class="inline-flex min-h-10 items-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700">Contact support about this order</NuxtLink><span class="text-xs text-slate-600">For a return or refund, tell us which item needs help.</span></div>
      </header>

      <AccountOrderProgress :order="detail.order" :shipping="detail.shipping" />

      <section v-if="paymentMethodNeedsProof(detail.order.payment_method)" class="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6" aria-labelledby="proof-title">
        <div class="flex flex-wrap items-start justify-between gap-3"><div><h2 id="proof-title" class="text-lg font-bold text-slate-900">Proof of payment</h2><p class="mt-1 text-sm text-slate-600">Use this section if you skipped proof during checkout or need to retry it.</p></div><span class="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold" :class="paymentProofStatusClass(detail.order.payment_proof_status)">{{ paymentProofStatusLabel(detail.order.payment_proof_status) }}</span></div>
        <p v-if="detail.order.payment_proof_file_name" class="mt-4 text-sm text-slate-700">Current file: <strong>{{ detail.order.payment_proof_file_name }}</strong></p>
        <PaymentProofUpload v-if="['pending_upload', 'rejected'].includes(detail.order.payment_proof_status)" v-model="proofFile" show-submit class="mt-5" backend-notice="Secure file submission is intentionally waiting for the payment backend." @submit="stageProof" />
        <p v-if="proofNotice" role="status" class="mt-3 rounded-xl bg-blue-50 p-3 text-sm text-blue-800">{{ proofNotice }}</p>
        <p v-if="detail.order.payment_proof_status === 'under_review'" class="mt-4 text-sm text-blue-800">Your proof was received and the order is under review.</p>
      </section>

      <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section class="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6" aria-labelledby="ordered-items-title">
          <h2 id="ordered-items-title" class="text-lg font-bold text-slate-900">Items ordered</h2>
          <div class="mt-4 divide-y divide-slate-100">
            <div v-for="item in detail.items" :key="item.id" class="flex flex-wrap gap-4 py-4 first:pt-0 last:pb-0"><div class="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-slate-400"><img v-if="getConfiguredStoreImageUrl(item.image_url)" :src="getConfiguredStoreImageUrl(item.image_url)" :alt="item.product_title" class="size-full object-cover"><Icon v-else name="lucide:package" size="24" aria-hidden="true" /></div><div class="min-w-0 flex-1"><p class="font-semibold text-slate-900">{{ item.product_title }}</p><p class="mt-1 text-sm text-slate-600">Qty {{ item.quantity }} · {{ formatAccountMoney(item.unit_price, detail.order.currency) }} each</p></div><p class="ml-auto whitespace-nowrap text-sm font-semibold text-slate-900">{{ formatAccountMoney(item.line_total, detail.order.currency) }}</p></div>
          </div>
        </section>

        <div class="space-y-5">
          <section class="rounded-2xl border border-slate-200 bg-white p-5" aria-labelledby="payment-title">
            <h2 id="payment-title" class="font-bold text-slate-900">Payment</h2>
            <span class="mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold" :class="paymentStatusClass(detail.order.payment_status)">{{ paymentStatusLabel(detail.order.payment_status) }}</span>
            <p v-if="detail.order.paid_at" class="mt-2 text-sm text-slate-600">Paid {{ formatAccountDate(detail.order.paid_at, true) }}</p>
            <p v-if="detail.order.payment_method" class="mt-2 text-sm text-slate-600">Method: {{ getPaymentMethodLabel(detail.order.payment_method) }}</p>
            <div class="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm"><div class="flex justify-between gap-3"><span class="text-slate-600">Subtotal</span><span>{{ formatAccountMoney(detail.order.subtotal_amount, detail.order.currency) }}</span></div><div v-if="Number(detail.order.discount_amount)" class="flex justify-between gap-3"><span class="text-slate-600">Discount</span><span>-{{ formatAccountMoney(detail.order.discount_amount, detail.order.currency) }}</span></div><div v-if="Number(detail.order.payment_fee_amount)" class="flex justify-between gap-3"><span class="text-slate-600">Payment fee</span><span>{{ formatAccountMoney(detail.order.payment_fee_amount, detail.order.currency) }}</span></div><div class="flex justify-between gap-3 border-t border-slate-100 pt-2 font-bold"><span>Total</span><span>{{ formatAccountMoney(detail.order.total_amount, detail.order.currency) }}</span></div></div>
          </section>
          <section class="rounded-2xl border border-slate-200 bg-white p-5" aria-labelledby="shipping-title"><h2 id="shipping-title" class="font-bold text-slate-900">Delivery</h2><p v-if="detail.order.shipping_method" class="mt-2 text-sm capitalize text-slate-600">{{ detail.order.shipping_method }}</p><p v-if="detail.order.shipping_review_status === 'required'" class="mt-2 text-sm font-semibold text-amber-800">Delivery details are under review.</p><p v-if="detail.order.shipping_review_status === 'rejected'" class="mt-2 text-sm font-semibold text-red-700">Delivery details need attention. Contact support.</p><p v-if="detail.shipping?.awb" class="mt-2 break-all text-sm text-slate-700">Courier reference: <strong>{{ detail.shipping.awb }}</strong></p><p v-if="detail.shipping?.provider_status_name" class="mt-2 text-sm text-slate-700">Latest update: {{ detail.shipping.provider_status_name }}</p><p v-else class="mt-2 text-sm text-slate-600">No courier update is available yet.</p><p class="mt-3 text-sm text-slate-600">{{ detail.order.street_address }}, {{ detail.order.city }}, {{ detail.order.governorate }}</p><p class="mt-3 text-xs text-slate-500">A delivery estimate is not available.</p></section>
        </div>
      </div>
    </template>
  </div>
</template>
