<script setup>
import { codPaymentState } from '~/utils/codCheckout'
const props = defineProps({ order: { type: Object, required: true } })
const state = computed(() => codPaymentState(props.order))
</script>

<template>
  <div class="mt-3 space-y-1 text-sm" aria-live="polite">
    <p class="font-semibold" :class="state === 'collected' ? 'text-emerald-800' : 'text-slate-700'">{{ $t(`codCheckout.status.${state}`) }}</p>
    <p v-if="state === 'awaiting'" class="text-slate-600">{{ $t('codCheckout.payOnDelivery') }}</p>
  </div>
</template>
