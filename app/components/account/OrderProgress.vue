<script setup>
import { formatAccountDate as baseFormatAccountDate, orderProgress } from '~/utils/accountOrders'
import { shipmentTimeline } from '~/utils/shipmentTracking'
const { intlLocale } = useUiLocale()
const formatAccountDate = value => baseFormatAccountDate(value, true, intlLocale.value)
const props = defineProps({ order: { type: Object, required: true }, shipping: { type: Object, default: null } })
const steps = computed(() => shipmentTimeline(props.order, props.shipping))
const currentOrderLabel = computed(() => orderProgress(props.order).find(step => step.current)?.label)
</script>

<template>
  <section class="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6" aria-labelledby="order-progress-title">
    <h2 id="order-progress-title" class="text-lg font-bold text-slate-900">{{ $t('common.orderProgress') }}</h2>
    <p v-if="currentOrderLabel" class="mt-1 text-sm text-slate-600">{{ $t('shipment.orderStatus') }} {{ $uiLabel(currentOrderLabel) }}</p>
    <ol class="mt-5 space-y-0">
      <li v-for="(step, index) in steps" :key="step.id" class="relative flex gap-4 pb-5 last:pb-0">
        <span v-if="index < steps.length - 1" class="absolute start-[11px] top-6 h-[calc(100%-24px)] w-px bg-blue-200" aria-hidden="true" />
        <span class="relative mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full" :class="step.exception ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-700'" aria-hidden="true"><Icon :name="step.exception ? 'lucide:circle-alert' : 'lucide:check'" size="14" /></span>
        <div class="min-w-0"><p class="font-semibold text-slate-900">{{ $t(step.label_key) }}</p>
          <p v-if="step.date" class="mt-0.5 text-sm text-slate-500"><span v-if="step.observed">{{ $t('shipment.checkedAt') }} </span><time :datetime="step.date">{{ formatAccountDate(step.date) }}</time></p>
          <p v-if="step.reason_key" class="mt-0.5 text-sm text-slate-600">{{ $t(step.reason_key) }}</p>
        </div>
      </li>
    </ol>
    <p v-if="!shipping?.events?.length" class="mt-4 text-sm text-slate-600">{{ $t(shipping?.has_update ? 'shipment.noHistory' : 'account.orders.noCourierUpdateIsAvailableYet') }}</p>
  </section>
</template>
