<template>
  <div class="min-h-[60vh] bg-slate-50 py-8 sm:py-12">
    <main class="store-container max-w-3xl">
      <section class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8">
        <h1 class="text-2xl font-bold text-slate-950">{{ $t('paymob.secureCard') }}</h1>
        <p class="mt-2 text-sm text-slate-600">{{ $t('paymob.secureFields') }}</p>
        <p v-if="capabilities?.card?.mode === 'test'" class="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">{{ $t('paymob.testOnly') }}</p>
        <p v-if="error || !cardAvailable" role="alert" class="mt-5 text-sm text-red-700">{{ $t('paymob.unavailable') }}</p>
        <ClientOnly><PaymentPaymobPixel v-if="session" :session="session" class="mt-6" @complete="showResult" @cancel="showResult" /></ClientOnly>
        <button v-if="!session && cardAvailable" type="button" :disabled="loading" class="mt-6 min-h-12 rounded-full bg-blue-600 px-6 font-semibold text-white disabled:opacity-50" @click="start">{{ loading ? $t('paymob.loading') : $t('paymob.openSecure') }}</button>
        <NuxtLinkLocale :to="`/account/orders/${orderId}`" class="mt-6 block text-sm font-semibold text-blue-700">{{ $t('paymob.viewOrder') }}</NuxtLinkLocale>
      </section>
    </main>
  </div>
</template>
<script setup>
definePageMeta({ middleware: 'customer-auth' })
const route = useRoute()
const { locale, t } = useI18n()
const { uiNavigateTo } = useUiNavigation()
const supabase = useSupabaseClient()
const orderId = String(route.params.id || '')
const { data: capabilities } = await useFetch('/api/payments/capabilities')
const { data: siteContent } = await useSiteContent()
const cardAvailable = computed(() => capabilities.value?.card?.available === true && siteContent.value?.settings?.payment_card_enabled === true)
const session = shallowRef(null)
const error = ref(false)
const loading = ref(false)
const showResult = () => uiNavigateTo({ path: '/checkout/payment-result', query: { order_id: orderId } })
const start = async () => {
  if (loading.value || session.value || !cardAvailable.value) return
  loading.value = true; error.value = false
  try {
    const { data } = await supabase.auth.getSession()
    if (!data.session?.access_token) throw new Error('Session required')
    session.value = await $fetch('/api/payments/intentions', { method: 'POST', headers: { authorization: `Bearer ${data.session.access_token}` }, body: { order_id: orderId, locale: locale.value } })
  } catch { error.value = true }
  finally { loading.value = false }
}
// Explicit button initializes Pixel; merely viewing a pending order never initiates a charge.
useHead(() => ({ title: t('paymob.secureCard'), meta: [{ name: 'referrer', content: 'no-referrer' }] }))
</script>
