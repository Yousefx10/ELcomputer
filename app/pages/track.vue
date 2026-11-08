<script setup>
import { formatAccountDate } from '~/utils/accountOrders'
import { shipmentStateKey, shipmentExceptionStates } from '~/utils/shipmentTracking'
import { formatCustomerOrderStatus } from '~/utils/orderStatus'

// Owner request 7 Nov 2026 (phase 3A): public AWB tracking; signed-in customers also see open orders.
const route = useRoute(), router = useRouter(), supabase = useSupabaseClient(), customerUser = useSupabaseUser()
const { t } = useI18n(), { intlLocale } = useUiLocale()
usePageSeo(() => ({ title: t('track.title') }))
const startQuery = route.query.q ?? route.query.awb
const awb = ref(typeof startQuery === 'string' ? startQuery.slice(0, 40) : '')
const courierName = ref(''), shipment = ref(null), searching = ref(false), errorMessage = ref('')
const orders = ref([]), ordersLoaded = ref(false)
const formatDate = value => formatAccountDate(value, true, intlLocale.value)
const steps = computed(() => {
  if (!shipment.value) return []
  const list = (shipment.value.events || []).map((event, index) => ({ key: 'e' + index, label: shipmentStateKey(event.state), date: event.status_at || event.observed_at,
    observed: !event.status_at, reason: event.reason_key, exception: shipmentExceptionStates.includes(event.state) }))
  if (shipment.value.booked_at) list.push({ key: 'booked', label: 'shipment.booked', date: shipment.value.booked_at })
  return list.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
})

async function track(value = awb.value) {
  const number = String(value || '').trim()
  errorMessage.value = ''; shipment.value = null
  if (!number) { errorMessage.value = 'Enter a valid AWB or order number.'; return }
  awb.value = number; searching.value = true
  try {
    const result = await $fetch('/api/storefront/track', { query: { q: number } })
    shipment.value = result.shipment; courierName.value = result.courierName || ''
    if (route.query.q !== number) { const { awb: _old, ...query } = route.query; router.replace({ query: { ...query, q: number } }) }
  } catch (error) { errorMessage.value = error?.data?.statusMessage || 'Tracking is unavailable. Please try again later.' }
  finally { searching.value = false }
}

async function loadOrders() {
  if (!customerUser.value) return
  try {
    const { data } = await supabase.auth.getSession()
    if (!data.session?.access_token) return
    orders.value = (await $fetch('/api/account/tracking', { headers: { authorization: `Bearer ${data.session.access_token}` } })).orders || []
    ordersLoaded.value = true
  } catch { ordersLoaded.value = false }
}

onMounted(() => { if (awb.value) track(); loadOrders() })
watch(customerUser, value => { if (value) loadOrders(); else { orders.value = []; ordersLoaded.value = false } })
</script>

<template>
  <main class="store-container py-10 sm:py-14">
    <div class="mx-auto max-w-2xl space-y-6">
      <section class="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-7" aria-labelledby="track-heading">
        <h1 id="track-heading" class="text-2xl font-bold text-[var(--text-primary)]">{{ $t('track.title') }}</h1>
        <p class="mt-2 text-[var(--text-secondary)]">{{ $t('track.intro') }}</p>
        <form class="mt-5 flex flex-col gap-3 sm:flex-row" @submit.prevent="track()">
          <label class="sr-only" for="track-awb">{{ $t('track.awbLabel') }}</label>
          <input id="track-awb" v-model="awb" type="text" dir="ltr" maxlength="40" autocomplete="off" autocapitalize="characters" spellcheck="false"
            :placeholder="$t('track.awbLabel')" class="min-h-11 flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-[var(--text-primary)]">
          <button type="submit" class="inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-700 px-5 font-semibold text-white disabled:opacity-60" :disabled="searching">
            {{ $t(searching ? 'track.searching' : 'track.submit') }}
          </button>
        </form>
        <p v-if="errorMessage" class="mt-3 text-sm text-red-700" role="alert">{{ $uiMessage(errorMessage) }}</p>

        <div v-if="shipment" class="mt-6 border-t border-[var(--border)] pt-5" aria-live="polite" data-track-result>
          <p class="text-sm text-[var(--text-secondary)]"><template v-if="courierName">{{ courierName }} · </template><span dir="ltr">{{ shipment.awb }}</span></p>
          <p class="mt-1 text-xl font-bold text-[var(--text-primary)]">{{ $t(shipment.has_update ? shipmentStateKey(shipment.current_state) : 'shipment.booked') }}</p>
          <p v-if="shipment.reason_key" class="mt-1 text-sm text-[var(--text-secondary)]">{{ $t(shipment.reason_key) }}</p>
          <p v-if="shipment.latest_update_at" class="mt-1 text-xs text-[var(--text-secondary)]">{{ $t('shipment.checkedAt') }} <time :datetime="shipment.latest_update_at">{{ formatDate(shipment.latest_update_at) }}</time></p>
          <p v-if="shipment.stale" class="mt-1 text-xs text-[var(--text-secondary)]">{{ $t('shipment.stale') }}</p>
          <ol v-if="steps.length" class="mt-5 space-y-4">
            <li v-for="step in steps" :key="step.key" class="flex gap-3">
              <span class="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full" :class="step.exception ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-700'" aria-hidden="true"><Icon :name="step.exception ? 'lucide:circle-alert' : 'lucide:check'" size="14" /></span>
              <div class="min-w-0">
                <p class="font-semibold text-[var(--text-primary)]">{{ $t(step.label) }}</p>
                <p v-if="step.date" class="text-sm text-[var(--text-secondary)]"><span v-if="step.observed">{{ `${$t('shipment.checkedAt')} ` }}</span><time :datetime="step.date">{{ formatDate(step.date) }}</time></p>
                <p v-if="step.reason" class="text-sm text-[var(--text-secondary)]">{{ $t(step.reason) }}</p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <section v-if="customerUser && ordersLoaded" class="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-7" aria-labelledby="open-orders-heading" data-track-orders>
        <h2 id="open-orders-heading" class="text-lg font-bold text-[var(--text-primary)]">{{ $t('track.openOrders') }}</h2>
        <p v-if="!orders.length" class="mt-2 text-sm text-[var(--text-secondary)]">{{ $t('track.noOpenOrders') }}</p>
        <ul v-else class="mt-3 divide-y divide-[var(--border)]">
          <li v-for="order in orders" :key="order.id" class="flex flex-wrap items-center justify-between gap-3 py-3">
            <div class="min-w-0">
              <NuxtLinkLocale :to="`/account/orders/${order.id}`" class="font-semibold text-blue-700" dir="ltr">{{ order.order_number }}</NuxtLinkLocale>
              <p class="text-sm text-[var(--text-secondary)]">
                {{ order.shipment?.has_update ? $t(shipmentStateKey(order.shipment.current_state)) : $uiLabel(formatCustomerOrderStatus(order.status, order.payment_method)) }}
                · <time :datetime="order.created_at">{{ formatAccountDate(order.created_at, false, intlLocale) }}</time>
              </p>
            </div>
            <button v-if="order.shipment?.awb" type="button" class="min-h-10 rounded-lg border border-[var(--border)] px-4 text-sm font-semibold text-[var(--text-primary)]" @click="track(order.shipment.awb)">{{ $t('track.trackThis') }}</button>
            <span v-else class="text-sm text-[var(--text-secondary)]">{{ $t('track.notShippedYet') }}</span>
          </li>
        </ul>
      </section>
    </div>
  </main>
</template>
