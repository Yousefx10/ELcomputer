<script setup>
const { uiLabel } = useUiLocale()
const { intlLocale } = useUiLocale()
const expectedAvailabilityLabel = value => baseExpectedAvailabilityLabel(value, intlLocale.value)
const formatAccountMoney = (value, option = 'EGP') => baseFormatAccountMoney(value, option, intlLocale.value)
const formatAccountDate = (value, option = false) => baseFormatAccountDate(value, option, intlLocale.value)

import { formatAccountDate as baseFormatAccountDate, formatAccountMoney as baseFormatAccountMoney, paymentStatusClass, paymentStatusLabel } from '~/utils/accountOrders'
import { formatCustomerOrderStatus, getCustomerOrderStatusClass } from '~/utils/orderStatus'
import { getPaymentMethodLabel, paymentMethodNeedsProof, paymentProofStatusClass, paymentProofStatusLabel } from '~/utils/paymentMethods'
import { getConfiguredStoreImageUrl } from '~/utils/storefront'
import { expectedAvailabilityLabel as baseExpectedAvailabilityLabel } from '~/utils/preorder'
import { shipmentStateKey } from '~/utils/shipmentTracking'

definePageMeta({ layout: 'account', middleware: 'customer-auth' })
const route = useUiRoute()
const { request, errorText } = useSupportClient()
const detail = ref(null)
const loading = ref(true)
const error = ref('')
const proofFile = ref(null)
const proofNotice = ref('')
const reordering = ref(false)
const reorderMessage = ref('')
const { addOrderToCart } = useReorder()
let loadVersion = 0

const load = async (quiet = false) => {
  const version = ++loadVersion
  if (!quiet) loading.value = true
  error.value = ''
  try {
    const result = await request(`/api/account/orders/${encodeURIComponent(String(route.params.id))}`)
    if (version === loadVersion) detail.value = result
  } catch (cause) {
    if (version === loadVersion) { if (!quiet || cause?.statusCode === 401 || cause?.statusCode === 403) detail.value = null; error.value = errorText(cause, 'Could not load this order.') }
  } finally {
    if (version === loadVersion) loading.value = false
  }
}

const stageProof = () => {
  proofNotice.value = proofFile.value
    ? 'Your proof is selected. Secure submission will be connected with the payment backend.'
    : ''
}

const reorder = async () => {
  if (reordering.value || !detail.value?.items?.length) return
  reordering.value = true
  reorderMessage.value = ''
  try {
    const result = await addOrderToCart(detail.value.items)
    reorderMessage.value = result.message
  } catch {
    reorderMessage.value = 'Could not add this order. Please try again.'
  } finally {
    reordering.value = false
  }
}

watch(() => route.params.id, () => load())
onMounted(() => load())
onBeforeUnmount(() => { loadVersion++ })
useShipmentUpdates(computed(() => String(route.params.id || '')), () => load(true))
useHead(() => ({ title: detail.value?.order?.order_number ? `${detail.value.order.order_number} | ${uiLabel('Your Orders')}` : uiLabel('Order Details') }))
</script>

<template>
  <div class="space-y-5">
    <NuxtLinkLocale to="/account/orders" class="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"><Icon name="lucide:arrow-left" size="16" aria-hidden="true" class="directional-icon" /> {{ $t('common.allOrders') }}</NuxtLinkLocale>
    <NuxtLinkLocale v-if="detail?.order" :to="{ path: '/account/after-sales', query: { order: detail.order.id } }" class="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-blue-700"><Icon name="lucide:clipboard-check" size="16" />{{ $t('claims.title') }}</NuxtLinkLocale>
    <p v-if="error" role="alert" class="rounded-xl bg-red-50 p-4 text-sm text-red-700">{{ $uiMessage(error) }}</p>
    <p v-if="loading" role="status" class="rounded-2xl bg-white p-8 text-center text-sm text-slate-600">{{ $t('common.loadingOrder') }}</p>

    <template v-else-if="detail?.order">
      <header class="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="min-w-0"><p class="text-sm font-semibold text-blue-700">{{ $t('common.orderDetails') }}</p><h1 class="mt-1 break-all text-2xl font-bold text-slate-900">{{ detail.order.order_number || $t('common.orderValueVariant2', { value0: (detail.order.id.slice(0, 8)) }) }}</h1><p class="mt-1 text-sm text-slate-600">{{ $t('common.placedValue', { value0: (formatAccountDate(detail.order.created_at, true)) }) }}</p></div>
          <span class="rounded-full px-3 py-1.5 text-sm font-semibold" :class="getCustomerOrderStatusClass(detail.order.status)">{{ $uiLabel(formatCustomerOrderStatus(detail.order.status)) }}</span>
        </div>
        <div class="mt-5 flex flex-wrap items-center gap-3"><button v-if="detail.items?.some(item => item.product_id)" type="button" :disabled="reordering" class="inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60" @click="reorder"><Icon name="lucide:rotate-ccw" size="16" aria-hidden="true" />{{ reordering ? $t('common.adding') : $t('common.orderAgain') }}</button><NuxtLinkLocale :to="{ path: '/account/support', query: { order: detail.order.id } }" class="inline-flex min-h-10 items-center rounded-lg border border-blue-200 px-4 text-sm font-semibold text-blue-700 hover:bg-blue-50">{{ $t('common.contactSupport') }}</NuxtLinkLocale><span class="text-xs text-slate-600">{{ $t('account.orders.forAReturnOrRefundTellUsWhichItemNeedsHelp') }}</span></div>
        <p v-if="reorderMessage" class="mt-3 text-sm text-slate-600" role="status">{{ $uiLabel(reorderMessage) }} <NuxtLinkLocale v-if="reorderMessage.includes('added')" to="/cart" class="font-semibold text-blue-700 hover:underline">{{ $t('common.viewCart') }}</NuxtLinkLocale></p>
      </header>

      <section v-if="detail.order.is_preorder" class="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-slate-800 sm:p-6">
        <h2 class="text-base font-bold text-amber-900">{{ $t('common.preOrder') }}</h2>
        <p class="mt-1">{{ $t('account.orders.thisItemIsAwaitingAvailabilityAndIsNotReadyForDelivery') }}</p>
        <dl class="mt-4 grid gap-3 sm:grid-cols-2"><div><dt>{{ $t('common.orderValueVariant4') }}</dt><dd class="font-bold">{{ formatAccountMoney(detail.order.total_amount, detail.order.currency) }}</dd></div><div><dt>{{ $t('common.requiredInitialPayment') }}</dt><dd class="font-bold">{{ formatAccountMoney(detail.order.initial_amount_due, detail.order.currency) }}</dd></div><div><dt>{{ $t('common.verifiedPaid') }}</dt><dd class="font-bold">{{ formatAccountMoney(detail.order.amount_paid, detail.order.currency) }}</dd></div><div><dt>{{ $t('common.balanceRemaining') }}</dt><dd class="font-bold">{{ formatAccountMoney(Number(detail.order.total_amount) - Number(detail.order.amount_paid), detail.order.currency) }}</dd></div></dl>
        <p class="mt-3 font-semibold">{{ Number(detail.order.amount_paid) >= Number(detail.order.initial_amount_due) ? $t('common.initialPaymentReceived') : $t('common.initialPaymentPending') }}</p>
        <p v-if="detail.order.status === 'cancelled' && Number(detail.order.amount_paid) > 0" class="mt-2 text-red-700">{{ $t('account.orders.contactSupportAboutRefundHandling') }}</p>
      </section>

      <AccountOrderProgress :order="detail.order" :shipping="detail.shipping" />

      <section v-if="detail.order.is_preorder" class="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700 sm:p-6">{{ $t('account.orders.bankAndInstapayTransfersAreVerifiedByStoreStaffKeepYourTransferReferenceAndContactTheStoreIfYourPaymentHasNotAppearedHere') }}</section>
      <section v-else-if="paymentMethodNeedsProof(detail.order.payment_method)" class="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6" aria-labelledby="proof-title">
        <div class="flex flex-wrap items-start justify-between gap-3"><div><h2 id="proof-title" class="text-lg font-bold text-slate-900">{{ $t('common.proofOfPayment') }}</h2><p class="mt-1 text-sm text-slate-600">{{ $t('account.orders.useThisSectionIfYouSkippedProofDuringCheckoutOrNeedToRetryIt') }}</p></div><span class="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold" :class="paymentProofStatusClass(detail.order.payment_proof_status)">{{ $uiLabel(paymentProofStatusLabel(detail.order.payment_proof_status)) }}</span></div>
        <p v-if="detail.order.payment_proof_file_name" class="mt-4 text-sm text-slate-700">{{ $t('common.currentFile') }} <strong>{{ detail.order.payment_proof_file_name }}</strong></p>
        <PaymentProofUpload v-if="['pending_upload', 'rejected'].includes(detail.order.payment_proof_status)" v-model="proofFile" show-submit class="mt-5" backend-notice="Secure file submission is intentionally waiting for the payment backend." @submit="stageProof" />
        <p v-if="proofNotice" role="status" class="mt-3 rounded-xl bg-blue-50 p-3 text-sm text-blue-800">{{ $uiLabel(proofNotice) }}</p>
        <p v-if="detail.order.payment_proof_status === 'under_review'" class="mt-4 text-sm text-blue-800">{{ $t('account.orders.yourProofWasReceivedAndTheOrderIsUnderReview') }}</p>
      </section>

      <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section class="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6" aria-labelledby="ordered-items-title">
          <h2 id="ordered-items-title" class="text-lg font-bold text-slate-900">{{ $t('common.itemsOrdered') }}</h2>
          <div class="mt-4 divide-y divide-slate-100">
            <div v-for="item in detail.items" :key="item.id" class="flex flex-wrap gap-4 py-4 first:pt-0 last:pb-0"><div class="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-slate-400"><img v-if="getConfiguredStoreImageUrl(item.image_url)" :src="getConfiguredStoreImageUrl(item.image_url)" :alt="item.product_title" class="size-full object-cover"><Icon v-else name="lucide:package" size="24" aria-hidden="true" /></div><div class="min-w-0 flex-1"><p class="font-semibold text-slate-900">{{ item.product_title }}</p><p v-if="item.is_preorder" class="mt-1 text-xs font-bold text-amber-900">{{ $t('common.preOrderValue', { value0: (item.preorder_payment_mode === 'deposit' ? $t('preorder.depositPercent', { value0: (item.preorder_deposit_percent) }) : $t('common.fullPayment')) }) }}</p><p v-if="item.expected_availability_date" class="text-xs text-slate-600">{{ $t('common.expectedValue', { value0: (expectedAvailabilityLabel(item.expected_availability_date)) }) }}</p><p v-if="item.availability_message" class="text-xs text-slate-600">{{ item.availability_message }}</p><p class="mt-1 text-sm text-slate-600">{{ $t('account.orders.qtyValueValueEach', { value0: (item.quantity), value1: (formatAccountMoney(item.unit_price, detail.order.currency)) }) }}</p><AccountItemWarranty :item="item" /></div><p class="ms-auto whitespace-nowrap text-sm font-semibold text-slate-900">{{ formatAccountMoney(item.line_total, detail.order.currency) }}</p></div>
          </div>
        </section>

        <div class="space-y-5">
          <section class="rounded-2xl border border-slate-200 bg-white p-5" aria-labelledby="payment-title">
            <h2 id="payment-title" class="font-bold text-slate-900">{{ $t('common.payment') }}</h2>
            <span class="mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold" :class="paymentStatusClass(detail.order.payment_status)">{{ $uiLabel(paymentStatusLabel(detail.order.payment_status)) }}</span>
            <p v-if="detail.order.paid_at" class="mt-2 text-sm text-slate-600">{{ $t('common.paidValue', { value0: (formatAccountDate(detail.order.paid_at, true)) }) }}</p>
            <p v-if="detail.order.payment_method" class="mt-2 text-sm text-slate-600">{{ $t('common.methodValue', { value0: (getPaymentMethodLabel(detail.order.payment_method)) }) }}</p>
            <NuxtLinkLocale v-if="!detail.order.is_preorder && detail.order.payment_method === 'card' && ['pending', 'failed'].includes(detail.order.payment_status) && ['pending_payment', 'on_hold'].includes(detail.order.status)" :to="`/checkout/payment/${detail.order.id}`" class="mt-4 inline-flex min-h-11 items-center rounded-full bg-blue-600 px-5 text-sm font-semibold text-white">{{ $t('paymob.openSecure') }}</NuxtLinkLocale>
            <div class="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm"><div class="flex justify-between gap-3"><span class="text-slate-600">{{ $t('common.subtotal') }}</span><span>{{ formatAccountMoney(detail.order.subtotal_amount, detail.order.currency) }}</span></div><div v-if="Number(detail.order.discount_amount)" class="flex justify-between gap-3"><span class="text-slate-600">{{ $t('common.discount') }}</span><span>-{{ formatAccountMoney(detail.order.discount_amount, detail.order.currency) }}</span></div><div v-if="Number(detail.order.payment_fee_amount)" class="flex justify-between gap-3"><span class="text-slate-600">{{ $t('common.paymentFee') }}</span><span>{{ formatAccountMoney(detail.order.payment_fee_amount, detail.order.currency) }}</span></div><div class="flex justify-between gap-3 border-t border-slate-100 pt-2 font-bold"><span>{{ $t('common.total') }}</span><span>{{ formatAccountMoney(detail.order.total_amount, detail.order.currency) }}</span></div></div>
          </section>
          <section class="rounded-2xl border border-slate-200 bg-white p-5" aria-labelledby="shipping-title">
            <h2 id="shipping-title" class="font-bold text-slate-900">{{ $t('common.delivery') }}</h2>
            <p v-if="detail.shipping?.provider === 'pdc'" class="mt-2 text-sm text-slate-600">PDC</p>
            <p v-else-if="detail.order.shipping_method" class="mt-2 text-sm capitalize text-slate-600">{{ $uiLabel(detail.order.shipping_method) }}</p>
            <p v-if="detail.order.shipping_review_status === 'required'" class="mt-2 text-sm font-semibold text-amber-800">{{ $t('account.orders.deliveryDetailsAreUnderReview') }}</p>
            <p v-if="detail.order.shipping_review_status === 'rejected'" class="mt-2 text-sm font-semibold text-red-700">{{ $t('account.orders.deliveryDetailsNeedAttentionContactSupport') }}</p>
            <p v-if="detail.shipping?.awb" class="mt-2 break-all text-sm text-slate-700">{{ $t('common.courierReference') }} <strong dir="ltr">{{ detail.shipping.awb }}</strong></p>
            <div v-if="detail.shipping?.has_update" class="mt-3 text-sm text-slate-700" aria-live="polite">
              <p class="font-semibold">{{ $t(shipmentStateKey(detail.shipping.current_state)) }}</p>
              <p v-if="detail.shipping.reason_key" class="mt-1">{{ $t(detail.shipping.reason_key) }}</p>
              <p v-if="detail.shipping.status_at" class="mt-1">{{ $t('shipment.lastUpdate') }} <time :datetime="detail.shipping.status_at">{{ formatAccountDate(detail.shipping.status_at, true) }}</time></p>
              <p v-else-if="detail.shipping.observed_at" class="mt-1">{{ $t('shipment.checkedAt') }} <time :datetime="detail.shipping.observed_at">{{ formatAccountDate(detail.shipping.observed_at, true) }}</time></p>
            </div>
            <p v-else class="mt-2 text-sm text-slate-600">{{ $t('account.orders.noCourierUpdateIsAvailableYet') }}</p>
            <button type="button" class="mt-3 min-h-11 rounded-lg px-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600" @click="load(true)">{{ $t('shipment.refresh') }}</button>
            <p class="mt-3 text-sm text-slate-600">{{ detail.order.street_address }}, {{ detail.order.city }}, {{ detail.order.governorate }}</p>
          </section>
        </div>
      </div>
    </template>
  </div>
</template>
