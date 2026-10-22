<template>
  <main class="store-container max-w-3xl py-8">
    <h1 class="text-2xl font-bold">{{ $t('controlledPurchase.title') }}</h1>
    <p v-if="error" role="alert" class="mt-4 text-sm text-red-700">{{ $t('controlledPurchase.unavailable') }}</p>
    <section v-if="purchase" class="mt-5 space-y-4 rounded-xl border bg-white p-5 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <p class="font-semibold">{{ purchase.product.title }} · {{ purchase.variant.name }} · {{ $t('common.quantity') }} 1</p>
      <p>{{ purchase.delivery.name }} · {{ money(purchase.totalMinor) }}</p>
      <p v-if="!purchase.active" class="text-sm">{{ $t('controlledPurchase.closed') }}</p>
      <template v-if="purchase.order">
        <p>{{ purchase.order.orderNumber }} · {{ $uiLabel(purchase.order.paymentStatus) }}</p>
        <p v-if="purchase.attempt" class="text-sm">{{ $t('controlledPurchase.receiptPending') }}</p>
        <button v-if="purchase.active && purchase.paymentEnabled && !purchase.attempt && purchase.order.paymentStatus !== 'paid' && !paymentStarted" type="button" :disabled="busy" class="min-h-11 rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-50" @click="startPayment">{{ $t('paymob.openSecure') }}</button>
        <ClientOnly><PaymentPaymobPixel v-if="session" :session="session" @complete="refresh" @cancel="refresh" /></ClientOnly>
        <button type="button" :disabled="busy" class="min-h-11 rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50" @click="refresh">{{ $t('controlledPurchase.checkOrder') }}</button>
      </template>
      <form v-else-if="purchase.active && !orderPending" class="space-y-4" @submit.prevent="review">
        <div class="grid gap-4 sm:grid-cols-2">
          <label v-for="field in addressFields" :key="field.key" class="text-sm font-semibold" :class="field.key === 'street_address' ? 'sm:col-span-2' : ''">
            {{ $t(field.label) }}
            <input v-model="address[field.key]" :type="field.type || 'text'" :autocomplete="field.autocomplete" :required="field.key !== 'last_name'" maxlength="300" class="mt-1 w-full rounded-lg border bg-transparent p-3" @input="quote = null">
          </label>
        </div>
        <button type="submit" :disabled="busy" class="min-h-11 rounded-lg border px-4 py-2 font-semibold disabled:opacity-50">{{ $t('controlledPurchase.review') }}</button>
        <div v-if="quote" class="space-y-3 border-t pt-4">
          <p>{{ money(Math.round(quote.totalAmount * 100)) }}</p>
          <button type="button" :disabled="busy" class="min-h-11 rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-50" @click="createOrder">{{ $t('common.confirmCheckout') }}</button>
        </div>
      </form>
      <template v-else-if="orderPending">
        <p class="text-sm">{{ $t('controlledPurchase.receiptPending') }}</p>
        <button type="button" :disabled="busy" class="min-h-11 rounded-lg border px-4 py-2 font-semibold disabled:opacity-50" @click="refresh">{{ $t('controlledPurchase.checkOrder') }}</button>
      </template>
    </section>
  </main>
</template>

<script setup>
definePageMeta({ middleware: 'customer-auth' })
const { locale, t } = useI18n()
const supabase = useSupabaseClient()
const purchase = ref(null)
const quote = ref(null)
const session = shallowRef(null)
const busy = ref(false)
const error = ref(false)
const orderPending = ref(false)
const paymentStarted = ref(false)
const address = reactive({ first_name: '', last_name: '', email: '', phone: '', street_address: '', city: '', governorate: '' })
const addressFields = [
  { key: 'first_name', label: 'common.firstNameVariant2', autocomplete: 'given-name' },
  { key: 'last_name', label: 'common.lastName', autocomplete: 'family-name' },
  { key: 'email', label: 'common.email', type: 'email', autocomplete: 'email' },
  { key: 'phone', label: 'common.phoneVariant2', type: 'tel', autocomplete: 'tel' },
  { key: 'street_address', label: 'common.streetAddress', autocomplete: 'street-address' },
  { key: 'city', label: 'common.cityVariant2', autocomplete: 'address-level2' },
  { key: 'governorate', label: 'common.governorate', autocomplete: 'address-level1' }
]
const money = minor => new Intl.NumberFormat(locale.value === 'ar' ? 'ar-EG' : 'en-EG', { style: 'currency', currency: 'EGP' }).format(minor / 100)
const request = async body => {
  const { data } = await supabase.auth.getSession()
  if (!data.session?.access_token) throw Error('Session required')
  return $fetch('/api/checkout/controlled', { method: body ? 'POST' : 'GET', retry: 0,
    headers: { authorization: `Bearer ${data.session.access_token}` }, ...(body ? { body } : {}) })
}
const refresh = async () => {
  if (busy.value) return
  busy.value = true; error.value = false
  try { purchase.value = await request(); if (purchase.value.order) orderPending.value = false } catch { error.value = true }
  finally { busy.value = false }
}
const review = async () => {
  if (busy.value) return
  busy.value = true; error.value = false; quote.value = null
  try { quote.value = await request({ action: 'quote', address: { ...address }, locale: locale.value }) } catch { error.value = true }
  finally { busy.value = false }
}
const createOrder = async () => {
  if (busy.value || !quote.value || orderPending.value) return
  busy.value = true; error.value = false; orderPending.value = true
  try {
    const result = await request({ action: 'order', address: { ...address }, locale: locale.value, quote_id: quote.value.quoteId, review_token: quote.value.reviewToken })
    purchase.value = { ...purchase.value, order: result.order }; orderPending.value = false
  } catch { error.value = true }
  finally { busy.value = false }
}
const startPayment = async () => {
  if (busy.value || paymentStarted.value || !purchase.value?.order) return
  busy.value = true; error.value = false; paymentStarted.value = true
  try { session.value = await request({ action: 'pay', order_id: purchase.value.order.id, locale: locale.value }) } catch { error.value = true }
  finally { busy.value = false }
}
onMounted(refresh)
useHead(() => ({ title: t('controlledPurchase.title'), meta: [{ name: 'robots', content: 'noindex,nofollow' }, { name: 'referrer', content: 'no-referrer' }] }))
</script>
