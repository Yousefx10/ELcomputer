<script setup>
const { intlLocale } = useUiLocale()
const formatAccountDate = (value, option = false) => baseFormatAccountDate(value, option, intlLocale.value)

import { formatAccountDate as baseFormatAccountDate, orderProgress } from '~/utils/accountOrders'

const props = defineProps({ order: { type: Object, required: true }, shipping: { type: Object, default: null } })
const steps = computed(() => orderProgress(props.order))
</script>

<template>
  <section class="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6" aria-labelledby="order-progress-title">
    <h2 id="order-progress-title" class="text-lg font-bold text-slate-900">{{ $t('common.orderProgress') }}</h2>
    <p class="mt-1 text-sm text-slate-600">{{ $t('account.OrderProgress.onlyConfirmedInformationIsShownEarlierStatusChangesAreNotRecorded') }}</p>
    <ol class="mt-5 space-y-0">
      <li v-for="(step, index) in steps" :key="`${step.label}-${index}`" class="relative flex gap-4 pb-5 last:pb-0">
        <span v-if="index < steps.length - 1" class="absolute start-[11px] top-6 h-[calc(100%-24px)] w-px bg-blue-200" aria-hidden="true" />
        <span class="relative mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full" :class="step.current ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-700'" aria-hidden="true"><Icon :name="step.current ? 'lucide:circle-dot' : 'lucide:check'" size="14" /></span>
        <div><p class="font-semibold text-slate-900">{{ $uiLabel(step.label) }}</p><p v-if="step.date" class="mt-0.5 text-sm text-slate-500">{{ formatAccountDate(step.date, true) }}</p><p v-if="step.detail" class="mt-0.5 text-sm text-slate-600">{{ step.detail }}</p></div>
      </li>
    </ol>
    <div v-if="shipping?.provider_status_name" class="mt-5 rounded-xl bg-sky-50 p-4 text-sm text-sky-900">
      <p class="font-semibold">{{ $t('account.OrderProgress.latestCourierUpdateValue', { value0: (shipping.provider_status_name) }) }}</p>
      <p v-if="shipping.provider_status_at" class="mt-1">{{ formatAccountDate(shipping.provider_status_at, true) }}</p>
    </div>
  </section>
</template>
