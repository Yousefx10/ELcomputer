<template>
  <div class="min-h-[60vh] bg-slate-50 py-8 sm:py-12">
    <main class="store-container max-w-3xl">
      <section class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8" aria-live="polite">
        <Icon :name="state === 'paid' ? 'lucide:circle-check' : 'lucide:shield-check'" class="text-blue-600" size="32" aria-hidden="true" />
        <h1 class="mt-4 text-2xl font-bold text-slate-950">{{ $t(`paymob.result.${displayState}`) }}</h1>
        <p class="mt-3 text-sm text-slate-600">{{ $t('paymob.resultNotice') }}</p>
        <p v-if="mode === 'test'" class="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">{{ $t('paymob.testOnly') }}</p>
        <NuxtLinkLocale v-if="orderId" :to="`/account/orders/${orderId}`" class="mt-6 inline-flex min-h-12 items-center rounded-full bg-blue-600 px-6 text-sm font-semibold text-white">{{ $t('paymob.viewOrder') }}</NuxtLinkLocale>
        <NuxtLinkLocale v-else to="/account/orders" class="mt-6 inline-block text-blue-700">{{ $t('paymob.viewOrders') }}</NuxtLinkLocale>
      </section>
    </main>
  </div>
</template>
<script setup>
// Query-only navigation must dispose the old poller and its order selector.
definePageMeta({ key: route => route.fullPath })
const route = useRoute()
const router = useRouter()
const supabase = useSupabaseClient()
const { t } = useI18n()
const state = ref('processing')
const mode = ref(null)
const orderId = ref('')
const displayState = computed(() => ['paid','failed','cancelled','expired','test_succeeded','unable'].includes(state.value) ? state.value : 'processing')
const selector = /^[0-9a-f-]{36}$/i.test(String(route.query.order_id || ''))
  ? { order_id: String(route.query.order_id) }
  : /^\d{1,18}$/.test(String(route.query.provider_order_id || route.query.order || '')) ? { provider_order_id: String(route.query.provider_order_id || route.query.order) } : null
let timer
let disposed = false
let refreshes = 0
const refresh = async () => {
  if (disposed) return
  try {
    const { data } = await supabase.auth.getSession()
    if (!selector || !data.session?.access_token) throw new Error('Status unavailable')
    const result = await $fetch('/api/payments/status', { headers: { authorization: `Bearer ${data.session.access_token}` }, query: selector, timeout: 10000 })
    if (disposed) return
    state.value = result.status; mode.value = result.mode; orderId.value = result.orderId
    if (['initiated','pending','not_started','processing'].includes(result.status) && ++refreshes < 10) timer = setTimeout(refresh, 3000)
    else if (['initiated','pending','not_started','processing'].includes(result.status)) state.value = 'unable'
  } catch { if (!disposed) state.value = 'unable' }
}
onMounted(async () => {
  // Discard all provider status/card/transaction query fields. Keep only the safe lookup.
  await router.replace({ path: route.path, query: selector || {} })
  await refresh()
})
onBeforeUnmount(() => { disposed = true; clearTimeout(timer) })
useHead(() => ({ title: t('paymob.resultTitle'), meta: [{ name: 'referrer', content: 'no-referrer' }] }))
</script>
