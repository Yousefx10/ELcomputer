<script setup>
const props = defineProps({ order: { type: Object, required: true }, actions: { type: Boolean, default: true } })
const customerScope = useCustomerScope()
const payment = shallowRef(props.order.customer_payment || null)
let version = 0
const status = computed(() => payment.value?.status === 'paid' && payment.value.verified !== true
  ? 'provider_uncertain' : payment.value?.status || 'checking')
const load = async () => {
  const current = ++version
  payment.value = props.order.customer_payment || null
  if (payment.value) return
  try {
    const result = await customerScope.request('/api/payments/status', { query: { order_id: props.order.id }, timeout: 10000 })
    if (current === version && customerScope.isCurrent()) payment.value = result
  } catch { if (current === version) payment.value = { status: 'unable' } }
}
onMounted(load)
watch(() => [props.order.id, props.order.customer_payment], load)
onBeforeUnmount(() => { version++ })
customerScope.onInvalidate(() => { version++; payment.value = null })
</script>

<template>
  <div class="mt-3 space-y-2 text-sm" aria-live="polite">
    <p class="font-semibold" :class="status === 'paid' ? 'text-emerald-800' : 'text-slate-700'">{{ $t(`paymentStatus.title.${status}`) }}</p>
    <p v-if="status !== 'checking' && status !== 'paid'" class="text-slate-600">{{ $t(`paymentStatus.detail.${status}`) }}</p>
    <NuxtLinkLocale v-if="actions && payment?.recovery === 'start'" :to="`/checkout/payment/${order.id}`" class="inline-flex min-h-10 items-center rounded-lg px-3 font-semibold text-blue-700 hover:bg-blue-50">{{ $t('paymob.openSecure') }}</NuxtLinkLocale>
    <NuxtLinkLocale v-else-if="actions && payment?.recovery === 'review'" :to="{ path: '/checkout/payment-result', query: { order_id: order.id } }" class="inline-flex min-h-10 items-center rounded-lg px-3 font-semibold text-blue-700 hover:bg-blue-50">{{ $t('paymentStatus.checkStatus') }}</NuxtLinkLocale>
  </div>
</template>
