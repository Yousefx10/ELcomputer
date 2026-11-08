<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      @click.self="closeDialog"
    >
      <div ref="dialogElement" role="dialog" aria-modal="true" aria-labelledby="order-dialog-title" tabindex="-1" @keydown="handleDialogKeys" class="min-w-0 max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div class="sticky top-0 z-10 border-b bg-white px-6 py-5">
          <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p class="text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">
                {{ $t('common.orderDetails') }}
              </p>

              <h3 id="order-dialog-title" class="mt-2 break-all text-2xl font-bold text-gray-900">
                {{ orderDetail?.order_number || orderTitle }}
              </h3>

              <div class="mt-3 flex flex-wrap items-center gap-3">
                <span v-if="orderDetail?.is_preorder" class="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">{{ $t('common.preOrder') }}</span>
                <span
                  class="rounded-full px-3 py-1 text-xs font-semibold uppercase"
                  :class="getCustomerOrderStatusClass(orderDetail?.status)"
                >
                  {{ $uiLabel(formatCustomerOrderStatus(orderDetail?.status, orderDetail?.payment_method)) }}
                </span>

                <span class="text-sm text-gray-500">
                  {{ formatDate(orderDetail?.created_at) }}
                </span>
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <button
                v-if="orderBill || !externalErp"
                type="button"
                :disabled="loading || !orderIdentityCurrent || actionBusy || billLoading"
                class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                @click="openOrderPdf"
              >
                PDF
              </button>

              <button
                type="button"
                ref="closeButton" :disabled="actionBusy" class="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                @click="closeDialog"
              >
                {{ $t('common.close') }}
              </button>
            </div>
          </div>
        </div>

        <fieldset :disabled="actionBusy" class="min-w-0 border-0 p-6">
          <div v-if="loading" class="rounded-2xl bg-gray-50 p-8 text-center text-gray-500">
            {{ $t('dashboard.OrderDetailsDialog.loadingOrderDetails') }}
          </div>

          <div v-else-if="errorMessage && !orderDetail" class="rounded-2xl bg-red-50 p-4 text-red-600">
            {{ $uiMessage(errorMessage) }}
          </div>

          <div v-else-if="orderDetail" class="space-y-6">
            <p v-if="errorMessage" role="alert" class="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{{ $uiMessage(errorMessage) }}</p>
            <PaymentCodStatus v-if="orderDetail.payment_method === 'cash' && !orderDetail.is_preorder" :order="orderDetail" />
            <DashboardOrderCodCash v-if="codCash" :order="orderDetail" :cash="codCash" :external-erp="externalErp" @updated="refreshCash" />
            <DashboardOrderBill v-if="orderBill" :order-id="orderDetail.id" :bill="orderBill" />

            <section v-if="orderDetail.stock_fulfillment_state === 'awaiting_stock'" class="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p class="font-semibold">{{ $t('beta.awaitingStock') }}</p>
              <p class="mt-2 text-sm">{{ orderDetail.fulfillment_message }}</p>
              <button v-if="!externalErp && orderDetail.payment_status === 'paid' && orderDetail.status === 'on_hold'" type="button" :disabled="releaseSaving" class="mt-3 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" @click="releaseBackorder">{{ $t('dashboard.OrderDetailsDialog.assignArrivedStockAndRelease') }}</button>
            </section>
            <section v-if="orderDetail.is_preorder" class="rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
              <h4 class="text-lg font-bold text-gray-900">{{ $t('dashboard.OrderDetailsDialog.preOrderPaymentAndFulfillment') }}</h4>
              <p class="mt-1 text-sm text-gray-600">{{ orderDetail.preorder_fulfillment_state === 'ready' ? $t('dashboard.OrderDetailsDialog.physicalStockAssignedThisOrderCanProceedThroughNormalFulfillment') : $t('dashboard.OrderDetailsDialog.awaitingStockDoNotPackOrShipThisOrder') }}</p>
              <dl class="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt>{{ $t('common.orderValueVariant4') }}</dt><dd class="font-bold">{{ formatCurrency(orderDetail.total_amount) }}</dd></div><div><dt>{{ $t('common.requiredInitialPayment') }}</dt><dd class="font-bold">{{ formatCurrency(orderDetail.initial_amount_due) }}</dd></div><div><dt>{{ $t('common.verifiedPaid') }}</dt><dd class="font-bold">{{ formatCurrency(orderDetail.amount_paid) }}</dd></div><div><dt>{{ $t('common.balanceRemaining') }}</dt><dd class="font-bold">{{ formatCurrency(Number(orderDetail.total_amount) - Number(orderDetail.amount_paid)) }}</dd></div></dl>
              <p class="mt-3 text-sm font-semibold text-amber-900">{{ Number(orderDetail.amount_paid) >= Number(orderDetail.initial_amount_due) ? $t('common.initialPaymentReceived') : $t('common.initialPaymentPending') }}</p>
              <p v-if="orderDetail.status === 'cancelled' && Number(orderDetail.amount_paid) > 0" class="mt-2 text-sm font-semibold text-red-700">{{ $t('dashboard.OrderDetailsDialog.paymentWasRecordedReviewRefundHandlingManually') }}</p>
              <p v-if="externalErp && orderDetail.is_preorder" class="mt-3 text-sm text-amber-700">{{ $t('erp.preorderManual') }}</p>
              <button v-if="!externalErp && orderDetail.preorder_fulfillment_state === 'awaiting_stock' && orderDetail.payment_status === 'paid' && orderDetail.status === 'on_hold'" type="button" :disabled="releaseSaving" class="mt-3 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" @click="releasePreorder">{{ releaseSaving ? $t('common.checkingStock') : $t('dashboard.OrderDetailsDialog.assignArrivedStockAndRelease') }}</button>
              <ul v-if="preorderPayments.length" class="mt-4 space-y-1 text-xs text-gray-600"><li v-for="payment in preorderPayments" :key="payment.id">{{ formatCurrency(payment.amount) }} · {{ payment.reference }} · {{ formatDate(payment.recorded_at) }}</li></ul>
              <form v-if="!['cancelled', 'refunded'].includes(orderDetail.status) && Number(orderDetail.amount_paid) < Number(orderDetail.total_amount)" class="mt-5 grid gap-3 border-t pt-4 sm:grid-cols-[1fr_1.5fr_auto]" @submit.prevent="recordVerifiedPayment">
                <label class="text-sm font-semibold">{{ $t('common.verifiedAmount') }}<input v-model="paymentAmount" type="number" min="0.01" step="0.01" required class="mt-1 w-full rounded-lg border bg-white p-2"></label>
                <label class="text-sm font-semibold">{{ $t('dashboard.OrderDetailsDialog.bankOrInstapayReference') }}<input v-model="paymentReference" type="text" minlength="3" maxlength="120" required class="mt-1 w-full rounded-lg border bg-white p-2"></label>
                <button type="submit" :disabled="paymentSaving" class="self-end rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{{ paymentSaving ? $t('common.recording') : $t('common.recordVerifiedPayment') }}</button>
                <label class="flex items-start gap-2 text-xs text-gray-700 sm:col-span-3"><input v-model="paymentVerified" type="checkbox" required> {{ $t('dashboard.OrderDetailsDialog.iVerifiedReceiptOutsideThisSystemThisRecordsAccountingOnly') }}</label>
              </form>
            </section>

            <section v-if="shippingDetail" class="rounded-2xl border p-5">
              <h4 class="text-lg font-bold text-gray-900">{{ $t('common.pdcShipping') }}</h4>
              <p class="mt-1 text-sm text-gray-500">{{ shippingDetail.awb ? $t('common.awbValue', { value0: shippingDetail.awb }) : $t(`liveSales.states.${shippingDetail.state}`) }}</p>
              <p v-if="shippingDetail.provider_status_name" class="mt-1 text-sm text-gray-600">{{ shippingDetail.provider_status_name }}</p>
              <ShipmentTracking :shipping="shippingDetail" :format-date="formatDate" />
            </section>

            <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
              <section class="space-y-4">
                <div class="rounded-2xl border p-5">
                  <h4 class="text-lg font-bold text-gray-900">{{ $t('common.customer') }}</h4>

                  <div class="mt-4 space-y-2 text-sm text-gray-600">
                    <p>
                      {{ orderDetail.first_name || $t('common.customer') }}
                      <span v-if="orderDetail.last_name"> {{ orderDetail.last_name }}</span>
                    </p>
                    <p>{{ orderDetail.email || customerDetail?.email || $t('common.noEmailSaved') }}</p>
                    <p>{{ orderDetail.phone || customerDetail?.phone || $t('common.noPhoneSaved') }}</p>
                  </div>
                </div>

                <div class="rounded-2xl border p-5">
                  <h4 class="text-lg font-bold text-gray-900">{{ $t('common.deliveryAddress') }}</h4>

                  <div class="mt-4 space-y-2 text-sm text-gray-600">
                    <p>{{ orderDetail.street_address || customerDetail?.address_line_1 || $t('common.noAddressSaved') }}</p>
                    <p>
                      {{ orderDetail.city || customerDetail?.city || $t('common.unknownCity') }}
                      <span v-if="orderDetail.governorate">, {{ orderDetail.governorate }}</span>
                    </p>
                    <p v-if="customerDetail?.country || orderDetail.governorate">
                      {{ customerDetail?.country || $t('common.egypt') }}
                    </p>
                  </div>
                </div>

                <div class="rounded-2xl border p-5">
                  <h4 class="text-lg font-bold text-gray-900">{{ $t('common.orderInfo') }}</h4>

                  <div class="mt-4 grid gap-3 sm:grid-cols-2 text-sm text-gray-600">
                    <div>
                      <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">{{ $t('common.orderNumber') }}</p>
                      <p class="mt-1">{{ orderDetail.order_number || orderTitle }}</p>
                    </div>

                    <div>
                      <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">{{ $t('common.created') }}</p>
                      <p class="mt-1">{{ formatDate(orderDetail.created_at) }}</p>
                    </div>

                    <div>
                      <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">{{ $t('common.paymentMethod') }}</p>
                      <p class="mt-1">{{ $uiLabel(orderDetail.payment_method || $t('common.notSelectedYet')) }}</p>
                    </div>

                    <div>
                      <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">{{ $t('common.paymentStatus') }}</p>
                      <p class="mt-1 capitalize">{{ $uiLabel(orderDetail.payment_status || $t('common.pending')) }}</p>
                    </div>

                    <div>
                      <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">{{ $t('common.shippingMethod') }}</p>
                      <p class="mt-1">{{ $uiLabel(orderDetail.shipping_method || $t('common.notSelectedYet')) }}</p>
                    </div>
                  </div>
                </div>
              </section>

              <section class="space-y-4">
                <div class="rounded-2xl border p-5">
                  <h4 class="text-lg font-bold text-gray-900">{{ $t('common.items') }}</h4>

                  <div v-if="!orderItems.length" class="mt-4 text-sm text-gray-500">
                    {{ $t('dashboard.OrderDetailsDialog.noOrderItemsSavedYet') }}
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
                          {{ $t('common.qtyValue', { value0: (item.quantity) }) }}
                        </p>
                        <p v-if="item.is_preorder" class="mt-1 text-xs font-bold text-amber-800">{{ $t('common.preOrderValue', { value0: (item.preorder_payment_mode === 'deposit' ? $t('preorder.depositPercent', { value0: (item.preorder_deposit_percent) }) : $t('common.fullPayment')) }) }}</p>
                        <p v-if="item.expected_availability_date" class="text-xs text-gray-600">{{ $t('common.expectedValue', { value0: (expectedAvailabilityLabel(item.expected_availability_date)) }) }}</p>

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
                          <NuxtLinkLocale
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
                          </NuxtLinkLocale>
                        </div>
                      </div>

                      <div class="text-end text-sm text-gray-600">
                        <p>{{ $t('common.valueEach', { value0: (formatCurrency(item.unit_price)) }) }}</p>
                        <p class="mt-1 font-semibold text-gray-900">{{ formatCurrency(item.line_total) }}</p>
                      </div>
                    </article>
                  </div>
                </div>

                <div class="rounded-2xl border p-5">
                  <h4 class="text-lg font-bold text-gray-900">{{ $t('common.totals') }}</h4>

                  <div class="mt-4 space-y-3">
                    <div class="flex items-center justify-between text-sm text-gray-500">
                      <span>{{ $t('common.subtotal') }}</span>
                      <span>{{ formatCurrency(orderDetail.subtotal_amount) }}</span>
                    </div>

                    <div class="flex items-center justify-between text-sm text-gray-500">
                      <span>{{ $t('common.coupon') }}</span>
                      <span>{{ orderDetail.coupon_code || $t('common.noCoupon') }}</span>
                    </div>

                    <div class="flex items-center justify-between text-sm text-gray-500">
                      <span>{{ $t('common.discount') }}</span>
                      <span>- {{ formatCurrency(orderDetail.discount_amount) }}</span>
                    </div>

                    <div v-if="orderDetail.shipping_company_id" class="flex items-center justify-between text-sm text-gray-500">
                      <span>{{ $t('common.shipping') }} · {{ orderDetail.shipping_company_name }}</span>
                      <span>{{ formatCurrency(orderDetail.shipping_fee_amount) }}</span>
                    </div>
                    <div v-if="Number(orderDetail.payment_fee_amount)" class="flex items-center justify-between text-sm text-gray-500">
                      <span>{{ $t('common.paymentFee') }}</span>
                      <span>{{ formatCurrency(orderDetail.payment_fee_amount) }}</span>
                    </div>
                    <div class="flex items-center justify-between border-t pt-3 text-lg font-bold text-gray-900">
                      <span>{{ $t('common.total') }}</span>
                      <span>{{ formatCurrency(orderDetail.total_amount) }}</span>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </fieldset>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import ShipmentTracking from './ShipmentTracking.vue'
import { downloadPdf } from '~/utils/downloadPdf'
const { data: erpState } = useNuxtData('active-erp')
const externalErp = computed(() => erpState.value?.mode === 'daftra')

const expectedAvailabilityLabel = value => baseExpectedAvailabilityLabel(value, intlLocale.value)

const { intlLocale, uiLabel } = useUiLocale()
const { locale, t } = useI18n()

import {
  formatCustomerOrderStatus,
  getCustomerOrderStatusClass
} from '~/utils/orderStatus'
import { expectedAvailabilityLabel as baseExpectedAvailabilityLabel } from '~/utils/preorder'

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
const errorMessage = ref('')
const orderDetail = ref(null)
const orderItems = ref([])
const customerDetail = ref(null)
const shippingDetail = ref(null)
const preorderPayments = ref([])
const codCash = ref(null)
const orderBill = ref(null)
const paymentAmount = ref('')
const paymentReference = ref('')
const paymentVerified = ref(false)
const paymentSaving = ref(false)
const releaseSaving = ref(false)
const actionBusy = computed(() => paymentSaving.value || releaseSaving.value)
const orderIdentityCurrent = computed(() => props.open && orderDetail.value?.id === props.orderId)
let dialogEpoch = 0, detailVersion = 0, detailController = null
const contextCurrent = context => props.open && props.orderId === context.id && dialogEpoch === context.epoch
const beginAction = () => !loading.value && orderIdentityCurrent.value && !actionBusy.value ? {id:props.orderId,epoch:dialogEpoch} : null
const scopedRequest = async (context, path, options = {}) => {
  const headers = await getAuthHeaders()
  if (!contextCurrent(context)) return null
  const response = await $fetch(path, {...options, headers, retry:0})
  if (!contextCurrent(context)) return null
  if (response?.order && response.order.id !== context.id) throw new Error('Could not load order details.')
  return response
}
const dialogElement = ref(null), closeButton = ref(null)
let previousFocus = null, previousOverflow = '', modalActive = false
const dialogControls = () => [...(dialogElement.value?.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]') || [])].filter(node => node.getClientRects().length && !node.matches(':disabled') && !node.closest('[inert]'))
const containFocus = event => {
  if (props.open && !dialogElement.value?.contains(event.target)) (dialogControls()[0] || dialogElement.value)?.focus()
}
const handleDialogKeys = event => {
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeDialog(); return }
  if (event.key !== 'Tab') return
  const controls = dialogControls(), first = controls[0], last = controls.at(-1)
  if (!first) { event.preventDefault(); dialogElement.value?.focus(); return }
  if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogElement.value)) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
}
const releaseModalFocus = () => {
  if (!modalActive) return
  modalActive = false; document.removeEventListener('focusin', containFocus); document.body.style.overflow = previousOverflow
  if (previousFocus?.isConnected) previousFocus.focus()
  previousFocus = null
}
watch(() => props.open, async open => {
  if (!import.meta.client) return
  if (!open) { releaseModalFocus(); return }
  if (!modalActive) { previousFocus=document.activeElement; previousOverflow=document.body.style.overflow; document.body.style.overflow='hidden'; modalActive=true; document.addEventListener('focusin',containFocus) }
  await nextTick()
  if (props.open) closeButton.value?.focus()
}, {immediate:true,flush:'post'})
onMounted(() => { if (props.open) closeButton.value?.focus() })
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
  return new Intl.NumberFormat(intlLocale.value, {
    style: 'currency',
    currency: 'EGP',
    maximumFractionDigits: 2
  }).format(Number(value || 0))
}

const formatDate = (value) => {
  if (!value) {
    return 'Recently'
  }

  return new Intl.DateTimeFormat(intlLocale.value, {
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
          <td>${escapeHtml(item.product_title || uiLabel('Product'))}</td>
          <td>${escapeHtml(item.quantity)}</td>
          <td>${escapeHtml(formatCurrency(item.unit_price))}</td>
          <td>${escapeHtml(formatCurrency(item.line_total))}</td>
        </tr>
      `).join('')
    : `<tr><td colspan="4">${escapeHtml(uiLabel('No order items saved yet.'))}</td></tr>`

  const fullName = `${orderDetail.value.first_name || uiLabel('Customer')} ${orderDetail.value.last_name || ''}`.trim()
  const printableAddress = [
    orderDetail.value.street_address || customerDetail.value?.address_line_1 || uiLabel('No address saved'),
    [orderDetail.value.city || customerDetail.value?.city || uiLabel('Unknown city'), orderDetail.value.governorate].filter(Boolean).join(', '),
    customerDetail.value?.country || (orderDetail.value.governorate ? 'Egypt' : '')
  ].filter(Boolean)
  const printableLogoMarkup = printableSiteLogoUrl.value
    ? `<img src="${escapeHtml(printableSiteLogoUrl.value)}" alt="${escapeHtml(printableSiteName.value)}" class="logo">`
    : `<p class="brand-name">${escapeHtml(printableSiteName.value)}</p>`

  return `<!doctype html>
  <html lang="${locale.value}" dir="${locale.value === 'ar' ? 'rtl' : 'ltr'}">
    <head>
      <meta charset="UTF-8">
      <title>${escapeHtml(orderDetail.value.order_number || orderTitle.value)}</title>
      <style>
        body { --text-primary: #172842; --text-secondary: #526174; --surface-muted: #f1f5fa; font-family: Arial, sans-serif; margin: 32px; color: var(--text-primary); }
        h1, h2, h3, p { margin: 0; }
        .brand { margin-bottom: 24px; }
        .logo { max-width: 180px; max-height: 72px; display: block; object-fit: contain; }
        .brand-name { font-size: 24px; font-weight: 700; }
        .header { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 24px; }
        .muted { color: var(--text-secondary); }
        .status { display: inline-block; margin-top: 12px; padding: 6px 12px; border-radius: 999px; background: var(--surface-muted); font-size: 12px; font-weight: 700; text-transform: uppercase; }
        .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-bottom: 24px; }
        .card { border: 1px solid #e5e7eb; border-radius: 16px; padding: 16px; }
        .card h3 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-secondary); margin-bottom: 12px; }
        .stack > p + p { margin-top: 8px; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th, td { border-bottom: 1px solid #e5e7eb; padding: 12px 10px; text-align: start; font-size: 14px; vertical-align: top; }
        th { color: var(--text-secondary); font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; }
        .totals { width: 320px; margin-inline-start: auto; margin-top: 24px; }
        .totals-row { display: flex; justify-content: space-between; gap: 16px; padding: 8px 0; color: var(--text-primary); }
        .totals-row.total { border-top: 1px solid #e5e7eb; margin-top: 8px; padding-top: 12px; color: var(--text-primary); font-size: 18px; font-weight: 700; }
      </style>
    </head>
    <body>
      <div class="brand">
        ${printableLogoMarkup}
      </div>

      <div class="header">
        <div>
          <p class="muted">${escapeHtml(uiLabel('Order Details'))}</p>
          <h1>${escapeHtml(orderDetail.value.order_number || orderTitle.value)}</h1>
          <span class="status">${escapeHtml(uiLabel(formatCustomerOrderStatus(orderDetail.value.status, orderDetail.value.payment_method)))}</span>
        </div>

        <div class="muted">
          <p>${escapeHtml(formatDate(orderDetail.value.created_at))}</p>
        </div>
      </div>

      <div class="grid">
        <section class="card">
          <h3>${escapeHtml(uiLabel('Customer'))}</h3>
          <div class="stack">
            <p>${escapeHtml(fullName)}</p>
            <p>${escapeHtml(orderDetail.value.email || customerDetail.value?.email || uiLabel('No email saved'))}</p>
            <p>${escapeHtml(orderDetail.value.phone || customerDetail.value?.phone || uiLabel('No phone saved'))}</p>
          </div>
        </section>

        <section class="card">
          <h3>${escapeHtml(uiLabel('Delivery Address'))}</h3>
          <div class="stack">
            ${printableAddress.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}
          </div>
        </section>

        <section class="card">
          <h3>${escapeHtml(uiLabel('Order Info'))}</h3>
          <div class="stack">
            <p><strong>${escapeHtml(uiLabel('Payment'))}:</strong> ${escapeHtml(uiLabel(orderDetail.value.payment_method) || uiLabel('Not selected yet'))}</p>
            <p><strong>${escapeHtml(uiLabel('Shipping'))}:</strong> ${escapeHtml(uiLabel(orderDetail.value.shipping_method) || uiLabel('Not selected yet'))}</p>
            <p><strong>${escapeHtml(uiLabel('Coupon'))}:</strong> ${escapeHtml(orderDetail.value.coupon_code || uiLabel('No coupon'))}</p>
          </div>
        </section>
      </div>

      <section class="card">
        <h3>${escapeHtml(uiLabel('Items'))}</h3>
        <table>
          <thead>
            <tr>
              <th>${escapeHtml(uiLabel('Product'))}</th>
              <th>${escapeHtml(uiLabel('Qty'))}</th>
              <th>${escapeHtml(uiLabel('Unit Price'))}</th>
              <th>${escapeHtml(uiLabel('Line Total'))}</th>
            </tr>
          </thead>
          <tbody>${printableItems}</tbody>
        </table>
      </section>

      <div class="totals">
        <div class="totals-row">
          <span>${escapeHtml(uiLabel('Subtotal'))}</span>
          <span>${escapeHtml(formatCurrency(orderDetail.value.subtotal_amount))}</span>
        </div>
        <div class="totals-row">
          <span>${escapeHtml(uiLabel('Discount'))}</span>
          <span>- ${escapeHtml(formatCurrency(orderDetail.value.discount_amount))}</span>
        </div>
        ${orderDetail.value.shipping_company_id ? `<div class="totals-row">
          <span>${escapeHtml(uiLabel('Shipping'))} · ${escapeHtml(orderDetail.value.shipping_company_name)}</span>
          <span>${escapeHtml(formatCurrency(orderDetail.value.shipping_fee_amount))}</span>
        </div>` : ''}
        ${Number(orderDetail.value.payment_fee_amount) ? `<div class="totals-row">
          <span>${escapeHtml(uiLabel('Payment fee'))}</span>
          <span>${escapeHtml(formatCurrency(orderDetail.value.payment_fee_amount))}</span>
        </div>` : ''}
        <div class="totals-row total">
          <span>${escapeHtml(uiLabel('Total'))}</span>
          <span>${escapeHtml(formatCurrency(orderDetail.value.total_amount))}</span>
        </div>
      </div>
    </body>
  </html>`
}

// The same bill the customer receives. Stores with no bills keep the printable order sheet.
const billLoading = ref(false)
const openOrderPdf = async () => {
  if (!orderBill.value) { printOrderDetails(); return }
  if (billLoading.value) return
  billLoading.value = true; errorMessage.value = ''
  try { await downloadPdf(`/api/admin-orders/${props.orderId}/bill`, await getAuthHeaders(), `Bill-${String(orderBill.value.number).replace(/[^A-Za-z0-9_-]/g, '-')}.pdf`) }
  catch (error) { errorMessage.value = error?.statusMessage || 'The bill is unavailable. Try again later.' }
  finally { billLoading.value = false }
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
  dialogEpoch++; detailVersion++; detailController?.abort(); detailController=null
  paymentAmount.value=''; paymentReference.value=''; paymentVerified.value=false
  preorderPayments.value=[]; codCash.value=null; orderBill.value=null
  errorMessage.value = ''
  orderDetail.value = null
  orderItems.value = []
  customerDetail.value = null
  shippingDetail.value = null
}

const closeDialog = () => {
  if (actionBusy.value) return
  emit('update:open', false)
}

const loadOrderDetails = async (background = false) => {
  if(!props.open||!props.orderId)return
  const context={id:props.orderId,epoch:dialogEpoch},version=++detailVersion
  detailController?.abort();const controller=new AbortController();detailController=controller
  const timeout=setTimeout(()=>controller.abort(),20000)
  const current=()=>contextCurrent(context)&&version===detailVersion
  if(!background)loading.value=true
  errorMessage.value=''
  try{
    const response=await scopedRequest(context,`/api/admin-orders/${context.id}`,{signal:controller.signal})
    if(!response||!current())return
    orderDetail.value=response.order||null;orderItems.value=response.items||[];customerDetail.value=response.customer||null
    shippingDetail.value=response.shipping||null;preorderPayments.value=response.preorderPayments||[];codCash.value=response.codCash||null;orderBill.value=response.bill||null
  }catch(error){if(current()){if(!background)orderDetail.value=null;errorMessage.value=error?.data?.statusMessage||error?.message||'Could not load order details.'}}
  finally{clearTimeout(timeout);if(current()){if(!background)loading.value=false;detailController=null}}
}
const refreshCash = async () => {
  const context={id:props.orderId,epoch:dialogEpoch};await loadOrderDetails(true)
  if(contextCurrent(context)&&orderIdentityCurrent.value)emit('updated',orderDetail.value)
}
const recordVerifiedPayment = async () => {
  const context=beginAction();if(!context||!paymentVerified.value)return
  const body={amount:paymentAmount.value,reference:paymentReference.value,verified:true}
  paymentSaving.value=true;errorMessage.value=''
  try{
    const response=await scopedRequest(context,`/api/admin-orders/${context.id}/payments`,{method:'POST',body})
    if(!response)return
    paymentAmount.value='';paymentReference.value='';paymentVerified.value=false
    await loadOrderDetails()
    if(contextCurrent(context))emit('updated',response.order)
  }catch(error){if(contextCurrent(context))errorMessage.value=error?.data?.statusMessage||'Could not record the payment.'}finally{paymentSaving.value=false}
}
const releaseOrder = async (path, failure) => {
  const context=beginAction();if(!context)return
  releaseSaving.value=true;errorMessage.value=''
  try{
    const response=await scopedRequest(context,`/api/admin-orders/${context.id}/${path}`,{method:'POST'})
    if(!response)return
    await loadOrderDetails();if(contextCurrent(context))emit('updated',response.order)
  }catch(error){if(contextCurrent(context))errorMessage.value=error?.data?.statusMessage||failure}finally{releaseSaving.value=false}
}
const releasePreorder = () => releaseOrder('release','Could not release the preorder.')
const releaseBackorder = () => releaseOrder('release-backorder','Stock could not be assigned.')
onBeforeUnmount(()=>{resetDialogState();releaseModalFocus()})

watch(
  () => [props.open, props.orderId],
  async ([isOpen, orderId]) => {
    resetDialogState()
    if (!isOpen) return

    if (orderId) {
      await loadOrderDetails()
    }
  },
  { immediate: true }
)
</script>
