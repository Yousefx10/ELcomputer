<template>
  <section v-if="remaining > 0 && !closed" class="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6" aria-labelledby="preorder-balance-title">
    <h2 id="preorder-balance-title" class="text-lg font-bold text-slate-900">{{ $t('preorderCard.balanceTitle') }}</h2>
    <p class="mt-1 text-sm text-slate-600">{{ $t('preorderCard.balanceDue', { amount: formatted }) }}</p>
    <div v-if="online" class="mt-4 flex flex-wrap gap-3">
      <button type="button" :disabled="busy" class="inline-flex min-h-11 items-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50" @click="pay('card')">{{ $t('preorderCard.payRest') }}</button>
      <button v-if="apple" type="button" :disabled="busy" class="inline-flex min-h-11 items-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-50" @click="pay('apple_pay')">{{ $t('checkoutModern.payApple') }}</button>
    </div>
    <p v-else-if="loaded" class="mt-3 text-sm text-slate-600">{{ $t('preorderCard.balanceStaff') }}</p>
    <p v-if="error" role="alert" class="mt-3 text-sm text-red-700">{{ error }}</p>
  </section>
</template>

<script setup>
import { applePayDeviceEligible } from '~/utils/paymobPixel'
import { hostedPaymentUrl } from '~/utils/hostedPayment'
import { formatAccountMoney } from '~/utils/accountOrders'

const props = defineProps({ order: { type: Object, required: true } })
const { t } = useI18n()
const { intlLocale } = useUiLocale()
const { uiNavigateTo } = useUiNavigation()
const scope = useCustomerScope()
const online = ref(false), apple = ref(false), loaded = ref(false), busy = ref(false), error = ref('')
const remaining = computed(() => Number(props.order.total_amount || 0) - Number(props.order.amount_paid || 0))
const closed = computed(() => ['cancelled', 'refunded'].includes(props.order.status))
const formatted = computed(() => formatAccountMoney(remaining.value, 'EGP', intlLocale.value))

onMounted(async () => {
  try {
    const caps = await scope.request('/api/payments/capabilities', { retry: 0, timeout: 10000 })
    online.value = caps?.purchase?.preorderBalanceOnline === true && caps?.card?.available === true
    apple.value = online.value && applePayDeviceEligible(window) && caps?.express?.some(item => item.method === 'apple_pay' && item.available) === true
  } catch { online.value = false }
  loaded.value = true
})

const pay = async method => {
  if (busy.value) return
  busy.value = true; error.value = ''
  try {
    const result = await scope.request('/api/checkout', { method: 'POST', retry: 0, body: { action: 'preorder_balance', order_id: props.order.id, paymob_method: method, payment_ui_version: 2 } })
    const session = `/checkout/session/${result.checkout.id}`
    if (result.payment?.experience === 'embedded' && result.payment.paymentMethods?.[0] === 'apple-pay') await uiNavigateTo(`/checkout/apple/${result.checkout.id}`, { external: true })
    else if (result.payment?.experience === 'embedded') await uiNavigateTo(`${session}?pay=1`)
    else if (result.payment) window.location.assign(hostedPaymentUrl(result.payment))
    else await uiNavigateTo(session)
  } catch { error.value = t('preorderCard.balanceUnavailable') }
  finally { busy.value = false }
}
</script>
