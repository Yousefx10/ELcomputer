<script setup>
import { formatAccountDate, formatAccountMoney, paymentStatusClass, paymentStatusLabel } from '~/utils/accountOrders'
import { formatCustomerOrderStatus, getCustomerOrderStatusClass } from '~/utils/orderStatus'
import { getConfiguredStoreImageUrl } from '~/utils/storefront'
import { paymentMethodNeedsProof, paymentProofStatusClass, paymentProofStatusLabel } from '~/utils/paymentMethods'

defineProps({ order: { type: Object, required: true }, compact: { type: Boolean, default: false } })
</script>

<template>
  <article class="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <h2 class="break-all text-base font-bold text-slate-900">{{ order.order_number || `Order ${order.id.slice(0, 8)}` }}</h2>
        <p class="mt-1 text-xs text-slate-500">{{ formatAccountDate(order.created_at) }} · {{ order.itemCount || 0 }} {{ order.itemCount === 1 ? 'item' : 'items' }}</p>
      </div>
      <p class="whitespace-nowrap text-base font-bold text-slate-900">{{ formatAccountMoney(order.total_amount, order.currency) }}</p>
    </div>
    <div class="mt-3 flex flex-wrap items-center gap-2">
      <span class="rounded-full px-2.5 py-1 text-xs font-semibold" :class="getCustomerOrderStatusClass(order.status)">{{ formatCustomerOrderStatus(order.status) }}</span>
      <span v-if="!compact && order.payment_status" class="rounded-full px-2.5 py-1 text-xs font-semibold" :class="paymentStatusClass(order.payment_status)">{{ paymentStatusLabel(order.payment_status) }}</span>
      <span v-if="!compact && paymentMethodNeedsProof(order.payment_method)" class="rounded-full px-2.5 py-1 text-xs font-semibold" :class="paymentProofStatusClass(order.payment_proof_status)">{{ paymentProofStatusLabel(order.payment_proof_status) }}</span>
    </div>
    <div v-if="order.items?.length" class="mt-4 flex items-center gap-3 border-t border-slate-100 pt-4">
      <div class="flex shrink-0 -space-x-2">
        <div v-for="item in order.items.slice(0, 3)" :key="item.id" class="flex size-11 items-center justify-center overflow-hidden rounded-lg border-2 border-white bg-slate-100 text-slate-400">
          <img v-if="getConfiguredStoreImageUrl(item.image_url)" :src="getConfiguredStoreImageUrl(item.image_url)" :alt="item.product_title" class="size-full object-cover" loading="lazy" />
          <Icon v-else name="lucide:package" size="18" aria-hidden="true" />
        </div>
      </div>
      <p class="min-w-0 flex-1 truncate text-sm text-slate-600">{{ order.items.map(item => item.product_title).join(', ') }}</p>
    </div>
    <div class="mt-4 flex justify-end">
      <NuxtLink :to="`/account/orders/${order.id}`" class="inline-flex min-h-10 items-center gap-1 rounded-lg px-3 text-sm font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">View order <Icon name="lucide:arrow-right" size="16" aria-hidden="true" /></NuxtLink>
    </div>
  </article>
</template>
