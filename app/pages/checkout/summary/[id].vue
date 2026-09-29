<template>
  <div class="min-h-screen bg-gray-100 py-8">
    <div class="mx-auto max-w-6xl px-4 md:px-6">
      <div v-if="pending" class="rounded-2xl bg-white p-8 text-center text-gray-500 shadow">
        {{ $t('checkout.summary.loadingOrderSummary') }}
      </div>

      <div v-else-if="error" class="rounded-2xl bg-red-50 p-8 text-red-600 shadow">
        {{ $uiMessage(error.message) }}
      </div>

      <div v-else-if="!orderData" class="rounded-2xl bg-white p-8 text-center text-gray-500 shadow">
        {{ $t('checkout.summary.orderSummaryNotFound') }}
      </div>

      <div v-else class="space-y-6">
        <div class="rounded-2xl bg-white p-6 shadow">
          <p class="text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">
            {{ $t('common.orderSummary') }}
          </p>

          <h1 class="mt-2 text-3xl font-bold text-gray-900 md:text-4xl">
            {{ orderData.order.order_number || $t('common.orderValueVariant3', { value0: (orderData.order.id.slice(0, 8)) }) }}
          </h1>

          <div class="mt-4 flex flex-wrap gap-3">
            <span v-if="orderData.order.is_preorder" class="rounded-full bg-amber-100 px-4 py-2 text-sm font-bold text-amber-900">{{ $t('common.preOrder') }}</span>
            <span class="rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold uppercase text-amber-700">
              {{ $uiLabel(formatStatus(orderData.order.status)) }}
            </span>

            <span class="rounded-full bg-gray-100 px-4 py-2 text-sm text-gray-700">
              {{ formatDate(orderData.order.created_at) }}
            </span>
          </div>
        </div>

        <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section class="space-y-4">
            <div class="rounded-2xl bg-white p-6 shadow">
              <h2 class="text-2xl font-bold text-gray-900">
                {{ $t('common.deliveryDetails') }}
              </h2>

              <div class="mt-4 space-y-2 text-sm text-gray-600">
                <p>{{ orderData.order.first_name }} {{ orderData.order.last_name || '' }}</p>
                <p>{{ orderData.order.street_address }}</p>
                <p>{{ orderData.order.city }}, {{ orderData.order.governorate }}</p>
                <p>{{ orderData.order.phone }}</p>
                <p>{{ orderData.order.email }}</p>
              </div>
            </div>

            <div class="rounded-2xl bg-white p-6 shadow">
              <h2 class="text-2xl font-bold text-gray-900">{{ $t('common.payment') }}</h2>
              <p v-if="orderData.order.is_preorder" class="mt-2 text-sm text-gray-700">{{ $t('checkout.summary.requiredNowValueVerifiedPaidValueTheBalanceRemainsDueWhenArrangedWithTheStore', { value0: (formatCurrency(orderData.order.initial_amount_due)), value1: (formatCurrency(orderData.order.amount_paid)) }) }}</p>
              <p class="mt-3 text-sm font-semibold text-gray-900">{{ $uiLabel(getPaymentMethodLabel(orderData.order.payment_method)) }}</p>
              <div v-if="orderData.order.is_preorder" class="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{{ $t('checkout.summary.theStoreWillVerifyYourBankOrInstapayTransferAndRecordTheActualAmountPaidKeepYourTransferReference') }}</div>
              <div v-else-if="paymentMethodNeedsProof(orderData.order.payment_method)" class="mt-4 rounded-xl bg-amber-50 p-4">
                <span class="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold" :class="paymentProofStatusClass(orderData.order.payment_proof_status)">{{ $uiLabel(paymentProofStatusLabel(orderData.order.payment_proof_status)) }}</span>
                <p class="mt-2 text-sm leading-6 text-amber-900">{{ $t('checkout.summary.youCanAddOrRetryProofOfPaymentFromThisOrderInMyAccount') }}</p>
              </div>
            </div>

            <div class="rounded-2xl bg-white p-6 shadow">
              <h2 class="text-2xl font-bold text-gray-900">
                {{ $t('common.orderedItems') }}
              </h2>

              <div class="mt-5 space-y-4">
                <article
                  v-for="item in orderData.items"
                  :key="item.id"
                  class="flex flex-col gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center"
                >
                  <div class="flex h-20 w-20 items-center justify-center rounded-xl bg-gray-50 p-2">
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
                    <p v-if="item.is_preorder" class="mt-1 text-xs font-bold text-amber-900">{{ $t('common.preOrderValue', { value0: (item.preorder_payment_mode === 'deposit' ? $t('preorder.depositPercent', { value0: (item.preorder_deposit_percent) }) : $t('common.fullPayment')) }) }}</p>
                    <p v-if="item.expected_availability_date" class="text-xs text-gray-600">{{ $t('common.expectedValue', { value0: (expectedAvailabilityLabel(item.expected_availability_date)) }) }}</p>

                    <p class="mt-1 text-sm text-gray-500">
                      {{ $t('common.qtyValue', { value0: (item.quantity) }) }}
                    </p>

                    <p
                      v-if="item.variant_name || item.variant_color_name"
                      class="mt-1 flex items-center gap-2 text-sm font-medium text-gray-600"
                    >
                      <span
                        v-if="isValidColor(item.variant_color_hex)"
                        class="h-4 w-4 rounded-full border border-black/10"
                        :style="{ backgroundColor: item.variant_color_hex }"
                      />
                      <span>{{ item.variant_name || item.variant_color_name }}</span>
                    </p>
                  </div>

                  <div class="text-end">
                    <p class="text-sm text-gray-500">
                      {{ $t('common.valueEach', { value0: (formatCurrency(item.unit_price)) }) }}
                    </p>

                    <p class="mt-1 font-semibold text-gray-900">
                      {{ formatCurrency(item.line_total) }}
                    </p>
                  </div>
                </article>
              </div>
            </div>
          </section>

          <aside class="h-fit rounded-2xl bg-white p-6 shadow">
            <h2 class="text-2xl font-bold text-gray-900">
              {{ $t('common.totals') }}
            </h2>

            <div class="mt-5 space-y-3">
              <div class="flex items-center justify-between text-sm text-gray-500">
                <span>{{ $t('common.subtotal') }}</span>
                <span>{{ formatCurrency(orderData.order.subtotal_amount) }}</span>
              </div>

              <div class="flex items-center justify-between text-sm text-gray-500">
                <span>{{ $t('common.coupon') }}</span>
                <span>{{ orderData.order.coupon_code || $t('common.noCoupon') }}</span>
              </div>

              <div class="flex items-center justify-between text-sm text-gray-500">
                <span>{{ $t('common.discount') }}</span>
                <span>- {{ formatCurrency(orderData.order.discount_amount) }}</span>
              </div>

              <div v-if="Number(orderData.order.payment_fee_amount)" class="flex items-center justify-between text-sm text-gray-500">
                <span>{{ $t('common.paymentFee') }}</span>
                <span>{{ formatCurrency(orderData.order.payment_fee_amount) }}</span>
              </div>

              <div class="flex items-center justify-between border-t pt-3 text-lg font-bold text-gray-900">
                <span>{{ $t('common.total') }}</span>
                <span>{{ formatCurrency(orderData.order.total_amount) }}</span>
              </div>
              <template v-if="orderData.order.is_preorder"><div class="flex justify-between text-sm font-semibold text-blue-800"><span>{{ $t('common.requiredInitialPayment') }}</span><span>{{ formatCurrency(orderData.order.initial_amount_due) }}</span></div><div class="flex justify-between text-sm text-gray-700"><span>{{ $t('common.balanceRemaining') }}</span><span>{{ formatCurrency(Number(orderData.order.total_amount) - Number(orderData.order.amount_paid)) }}</span></div></template>
            </div>

            <NuxtLinkLocale
              :to="`/account/orders/${orderData.order.id}`"
              class="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              {{ $t('checkout.summary.viewOrderInMyAccount') }}
            </NuxtLinkLocale>
          </aside>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const expectedAvailabilityLabel = value => baseExpectedAvailabilityLabel(value, intlLocale.value)

const { intlLocale } = useUiLocale()

import { getPaymentMethodLabel, paymentMethodNeedsProof, paymentProofStatusClass, paymentProofStatusLabel } from '~/utils/paymentMethods'
import { expectedAvailabilityLabel as baseExpectedAvailabilityLabel } from '~/utils/preorder'

definePageMeta({
  middleware: 'customer-auth'
})

const supabase = useSupabaseClient()
const route = useUiRoute()

const { data: orderData, pending, error } = await useAsyncData(`checkout-summary-${route.params.id}`, async () => {
  const [orderResult, itemsResult] = await Promise.all([
    supabase
      .from('customer_orders')
      .select('*')
      .eq('id', route.params.id)
      .maybeSingle(),
    supabase
      .from('customer_order_items')
      .select('*')
      .eq('order_id', route.params.id)
      .order('created_at')
  ])

  if (orderResult.error) {
    throw orderResult.error
  }

  if (itemsResult.error) {
    throw itemsResult.error
  }

  if (!orderResult.data) {
    return null
  }

  return {
    order: orderResult.data,
    items: itemsResult.data || []
  }
}, { lazy: true })

const formatCurrency = (value) => {
  return new Intl.NumberFormat(intlLocale.value, {
    style: 'currency',
    currency: 'EGP',
    maximumFractionDigits: 2
  }).format(Number(value || 0))
}

const formatDate = (value) => {
  return new Intl.DateTimeFormat(intlLocale.value, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value))
}

const formatStatus = (value) => {
  if (value === 'in_progress') {
    return 'In Progress'
  }

  return String(value || 'Unknown').replace(/_/g, ' ')
}

const isValidColor = (value) => {
  return /^#[0-9a-f]{6}$/i.test(String(value || '').trim())
}

useHead(() => ({
  title: orderData.value?.order?.order_number || 'Order Summary'
}))
</script>
