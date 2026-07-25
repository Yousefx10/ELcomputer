<template>
  <section class="space-y-4">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h3 class="text-2xl font-bold text-gray-900">Customer Experience</h3>
        <p class="mt-1 text-sm text-gray-500">
          Customer loyalty, return visits, purchasing behavior, and storefront activity.
        </p>
      </div>

      <div class="flex flex-col gap-3 sm:items-end">
        <div class="flex flex-wrap gap-2" aria-label="Customer experience reporting period">
          <button
            v-for="option in windowOptions"
            :key="option"
            type="button"
            class="rounded-full px-4 py-2 text-sm font-semibold transition"
            :class="selectedWindowDays === option
              ? 'bg-black text-white'
              : 'bg-white text-gray-700 shadow hover:bg-gray-50'"
            :aria-pressed="selectedWindowDays === option"
            @click="selectWindow(option)"
          >
            {{ option }} days
          </button>
        </div>

        <button
          type="button"
          :disabled="loading"
          class="inline-flex items-center justify-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
          @click="refreshMetrics"
        >
          <Icon
            name="lucide:refresh-cw"
            size="16"
            :class="loading ? 'animate-spin' : ''"
          />
          Refresh
        </button>
      </div>
    </div>

    <div
      v-if="errorMessage"
      class="rounded-2xl bg-red-50 p-4 text-sm text-red-600 shadow"
      role="alert"
    >
      {{ errorMessage }}
    </div>

    <div
      v-if="loading && !hasOverview"
      class="rounded-2xl bg-white p-8 text-center text-sm text-gray-500 shadow"
    >
      Loading customer experience metrics...
    </div>

    <template v-else-if="hasOverview">
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article
          v-for="card in headlineCards"
          :key="card.key"
          class="rounded-2xl bg-white p-5 shadow"
        >
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="text-sm font-semibold text-gray-500">{{ card.label }}</p>
              <p
                class="mt-2 text-3xl font-black"
                :class="card.valueClass"
              >
                {{ card.value }}
              </p>
            </div>

            <span
              class="rounded-xl p-2.5"
              :class="card.iconClass"
              aria-hidden="true"
            >
              <Icon :name="card.icon" size="21" />
            </span>
          </div>

          <p class="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-400">
            {{ card.period }}
          </p>
          <p class="mt-2 text-sm text-gray-600">
            {{ card.denominator }}
          </p>
          <p class="mt-2 text-xs leading-5 text-gray-400">
            {{ card.definition }}
          </p>
        </article>
      </div>

      <section class="rounded-2xl bg-white p-6 shadow">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h4 class="text-xl font-bold text-gray-900">Store Activity</h4>
            <p class="mt-1 text-sm text-gray-500">
              Historical activity uses the selected {{ selectedWindowDays }}-day period; live visitors update separately.
            </p>
          </div>

          <p class="text-xs text-gray-400">
            Dwell time is averaged across completed product-view sessions.
          </p>
        </div>

        <div class="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <article
            v-for="metric in activityMetrics"
            :key="metric.key"
            class="rounded-2xl border bg-gray-50 p-4"
          >
            <div class="flex items-center gap-2 text-gray-500">
              <Icon :name="metric.icon" size="17" aria-hidden="true" />
              <p class="text-sm">{{ metric.label }}</p>
            </div>
            <p
              class="mt-2 text-2xl font-bold"
              :class="metric.valueClass || 'text-gray-900'"
            >
              {{ metric.value }}
            </p>
            <p
              v-if="metric.description"
              class="mt-2 text-xs text-gray-400"
            >
              {{ metric.description }}
            </p>
          </article>
        </div>
      </section>
    </template>
  </section>
</template>

<script setup>
const supabase = useSupabaseClient()
const { getSnapshot, isFresh, setSnapshot } = useDashboardCache()

const windowOptions = [7, 30, 90]
const selectedWindowDays = ref(30)
const loading = ref(true)
const errorMessage = ref('')
const overview = ref(null)
const liveVisitors = ref(0)
const liveVisitorsAvailable = ref(false)
const liveVisitorWindowSeconds = ref(180)

const LIVE_VISITOR_REFRESH_MS = 30 * 1000
const LIVE_VISITOR_REQUEST_TIMEOUT_MS = 5 * 1000
let liveVisitorRefreshTimerId
let liveVisitorRequestGeneration = 0
let liveVisitorRequestInFlight = false
let liveVisitorAbortController
let liveVisitorPollingActive = false

const createEmptyOverview = (windowDays = selectedWindowDays.value) => ({
  windowDays,
  nps: {
    score: null,
    total: 0,
    promoters: 0,
    passives: 0,
    detractors: 0,
    periodDays: 90
  },
  kpis: {
    returningVisitorRate: 0,
    totalVisits: 0,
    returningVisits: 0,
    uniqueVisitors: 0,
    cartAbandonmentRate: 0,
    matureCarts: 0,
    abandonedCarts: 0,
    repeatPurchaseRate: 0,
    purchasingCustomers: 0,
    repeatCustomers: 0
  },
  activity: {
    pageViews: 0,
    productViews: 0,
    uniqueProductViewers: 0,
    avgProductDwellSeconds: 0,
    addToCartEvents: 0,
    checkoutStarts: 0,
    ordersCreated: 0
  }
})

const normalizeNumber = (value, fallback = 0) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

const normalizeOverview = (value, windowDays = selectedWindowDays.value) => {
  const emptyOverview = createEmptyOverview(windowDays)

  return {
    windowDays: normalizeNumber(value?.windowDays, windowDays),
    nps: {
      score: value?.nps?.score === null || value?.nps?.score === undefined
        ? null
        : normalizeNumber(value.nps.score),
      total: normalizeNumber(value?.nps?.total),
      promoters: normalizeNumber(value?.nps?.promoters),
      passives: normalizeNumber(value?.nps?.passives),
      detractors: normalizeNumber(value?.nps?.detractors),
      periodDays: normalizeNumber(value?.nps?.periodDays, emptyOverview.nps.periodDays)
    },
    kpis: {
      ...emptyOverview.kpis,
      ...Object.fromEntries(
        Object.keys(emptyOverview.kpis).map((key) => [
          key,
          normalizeNumber(value?.kpis?.[key])
        ])
      )
    },
    activity: {
      ...emptyOverview.activity,
      ...Object.fromEntries(
        Object.keys(emptyOverview.activity).map((key) => [
          key,
          normalizeNumber(value?.activity?.[key])
        ])
      )
    }
  }
}

const hasOverview = computed(() => Boolean(overview.value))
const resolvedOverview = computed(() => overview.value || createEmptyOverview())
const nps = computed(() => resolvedOverview.value.nps)
const kpis = computed(() => resolvedOverview.value.kpis)
const activity = computed(() => resolvedOverview.value.activity)

const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0
})

const percentFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1
})

const formatNumber = (value) => numberFormatter.format(normalizeNumber(value))
const formatPercent = (value) => `${percentFormatter.format(normalizeNumber(value))}%`
const formatNpsScore = () => {
  if (!nps.value.total || nps.value.score === null) {
    return '—'
  }

  const score = Math.round(nps.value.score)
  return score > 0 ? `+${score}` : String(score)
}

const formatDuration = (seconds) => {
  const normalizedSeconds = Math.max(0, Math.round(normalizeNumber(seconds)))

  if (normalizedSeconds < 60) {
    return `${normalizedSeconds}s`
  }

  const minutes = Math.floor(normalizedSeconds / 60)
  const remainingSeconds = normalizedSeconds % 60
  return remainingSeconds ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
}

const headlineCards = computed(() => [
  {
    key: 'nps',
    label: 'NPS Score',
    value: formatNpsScore(),
    period: `Last ${nps.value.periodDays || 90} days`,
    denominator: `${formatNumber(nps.value.total)} responses · ${formatNumber(nps.value.promoters)} promoters · ${formatNumber(nps.value.passives)} passives · ${formatNumber(nps.value.detractors)} detractors`,
    definition: 'Promoters (9–10) percentage minus detractors (0–6) percentage. The score ranges from -100 to 100.',
    icon: 'lucide:message-circle-heart',
    iconClass: 'bg-violet-100 text-violet-700',
    valueClass: 'text-violet-700'
  },
  {
    key: 'returning-visitors',
    label: 'Returning Visitor Rate',
    value: formatPercent(kpis.value.returningVisitorRate),
    period: `Last ${selectedWindowDays.value} days`,
    denominator: `${formatNumber(kpis.value.returningVisits)} returning visits of ${formatNumber(kpis.value.totalVisits)} total · ${formatNumber(kpis.value.uniqueVisitors)} unique visitors`,
    definition: 'The share of store visits made by visitors who had previously visited the store.',
    icon: 'lucide:repeat-2',
    iconClass: 'bg-blue-100 text-blue-700',
    valueClass: 'text-blue-700'
  },
  {
    key: 'cart-abandonment',
    label: 'Cart Abandonment Rate',
    value: formatPercent(kpis.value.cartAbandonmentRate),
    period: `Last ${selectedWindowDays.value} days · lower is better`,
    denominator: `${formatNumber(kpis.value.abandonedCarts)} abandoned of ${formatNumber(kpis.value.matureCarts)} mature carts`,
    definition: 'Carts with an add-to-cart event but no created order. Unconverted carts are counted only after 24 hours without activity.',
    icon: 'lucide:shopping-cart',
    iconClass: 'bg-amber-100 text-amber-700',
    valueClass: 'text-amber-700'
  },
  {
    key: 'repeat-purchase',
    label: 'Repeat Purchase Rate',
    value: formatPercent(kpis.value.repeatPurchaseRate),
    period: 'All-time completed and delivered orders',
    denominator: `${formatNumber(kpis.value.repeatCustomers)} repeat customers of ${formatNumber(kpis.value.purchasingCustomers)} purchasing customers`,
    definition: 'The share of purchasing customers who have completed at least two successful orders.',
    icon: 'lucide:badge-check',
    iconClass: 'bg-green-100 text-green-700',
    valueClass: 'text-green-700'
  }
])

const activityMetrics = computed(() => [
  {
    key: 'live-visitors',
    label: 'Live on Store',
    value: liveVisitorsAvailable.value
      ? formatNumber(liveVisitors.value)
      : '—',
    description: liveVisitorsAvailable.value
      ? `Tracked visitors active during the last ${Math.ceil(liveVisitorWindowSeconds.value / 60)} minutes`
      : 'Live count unavailable',
    icon: 'lucide:radio',
    valueClass: 'text-green-600'
  },
  {
    key: 'page-views',
    label: 'Page Views',
    value: formatNumber(activity.value.pageViews),
    icon: 'lucide:mouse-pointer-click'
  },
  {
    key: 'product-views',
    label: 'Product Views',
    value: formatNumber(activity.value.productViews),
    icon: 'lucide:package-search'
  },
  {
    key: 'unique-product-viewers',
    label: 'Unique Product Viewers',
    value: formatNumber(activity.value.uniqueProductViewers),
    icon: 'lucide:users'
  },
  {
    key: 'product-dwell',
    label: 'Average Product Dwell',
    value: formatDuration(activity.value.avgProductDwellSeconds),
    icon: 'lucide:timer'
  },
  {
    key: 'add-to-cart',
    label: 'Add to Cart',
    value: formatNumber(activity.value.addToCartEvents),
    icon: 'lucide:shopping-cart'
  },
  {
    key: 'checkout-starts',
    label: 'Checkout Starts',
    value: formatNumber(activity.value.checkoutStarts),
    icon: 'lucide:credit-card'
  },
  {
    key: 'orders-created',
    label: 'Orders Created',
    value: formatNumber(activity.value.ordersCreated),
    icon: 'lucide:circle-check-big'
  }
])

const buildCacheKey = (windowDays = selectedWindowDays.value) => {
  return `dashboard:analysis:customer-experience:${windowDays}`
}

const getAuthHeaders = async () => {
  const { data, error } = await supabase.auth.getSession()

  if (error || !data.session?.access_token) {
    throw new Error('Your session expired. Please log in again.')
  }

  return {
    authorization: `Bearer ${data.session.access_token}`
  }
}

const loadLiveVisitors = async () => {
  if (
    !import.meta.client
    || !liveVisitorPollingActive
    || document.visibilityState !== 'visible'
    || liveVisitorRequestInFlight
  ) {
    return
  }

  const requestGeneration = ++liveVisitorRequestGeneration
  liveVisitorRequestInFlight = true
  const controller = new AbortController()
  liveVisitorAbortController = controller
  const timeoutId = window.setTimeout(() => {
    controller.abort()
  }, LIVE_VISITOR_REQUEST_TIMEOUT_MS)

  try {
    const response = await $fetch('/api/admin-analytics/live', {
      headers: await getAuthHeaders(),
      signal: controller.signal
    })

    if (requestGeneration !== liveVisitorRequestGeneration) {
      return
    }

    liveVisitors.value = normalizeNumber(response?.liveVisitors)
    liveVisitorWindowSeconds.value = Math.max(
      60,
      Math.min(
        600,
        normalizeNumber(response?.activeWindowSeconds, 180)
      )
    )
    liveVisitorsAvailable.value = true
  } catch {
    if (requestGeneration === liveVisitorRequestGeneration) {
      liveVisitorsAvailable.value = false
    }
  } finally {
    window.clearTimeout(timeoutId)

    if (requestGeneration === liveVisitorRequestGeneration) {
      liveVisitorRequestInFlight = false
      liveVisitorAbortController = undefined
    }
  }
}

const clearLiveVisitorRefresh = () => {
  if (liveVisitorRefreshTimerId !== undefined) {
    window.clearTimeout(liveVisitorRefreshTimerId)
  }

  liveVisitorRefreshTimerId = undefined
}

const scheduleLiveVisitorRefresh = () => {
  clearLiveVisitorRefresh()

  if (
    !liveVisitorPollingActive
    || document.visibilityState !== 'visible'
  ) {
    return
  }

  liveVisitorRefreshTimerId = window.setTimeout(async () => {
    liveVisitorRefreshTimerId = undefined
    await loadLiveVisitors()
    scheduleLiveVisitorRefresh()
  }, LIVE_VISITOR_REFRESH_MS)
}

const handleAnalyticsVisibilityChange = () => {
  if (!liveVisitorPollingActive) {
    return
  }

  if (document.visibilityState !== 'visible') {
    liveVisitorRequestGeneration += 1
    liveVisitorRequestInFlight = false
    liveVisitorAbortController?.abort()
    liveVisitorAbortController = undefined
    clearLiveVisitorRefresh()
    return
  }

  void loadLiveVisitors()
  scheduleLiveVisitorRefresh()
}

const loadOverview = async ({ force = false } = {}) => {
  const requestedWindowDays = selectedWindowDays.value
  const cacheKey = buildCacheKey(requestedWindowDays)
  const cachedSnapshot = getSnapshot(cacheKey)

  if (cachedSnapshot) {
    overview.value = normalizeOverview(cachedSnapshot, requestedWindowDays)
  }

  if (!force && cachedSnapshot && isFresh(cacheKey)) {
    loading.value = false
    return
  }

  loading.value = true
  errorMessage.value = ''

  try {
    const response = await $fetch('/api/admin-analytics/overview', {
      query: {
        windowDays: requestedWindowDays
      },
      headers: await getAuthHeaders()
    })

    if (selectedWindowDays.value !== requestedWindowDays) {
      return
    }

    overview.value = normalizeOverview(response, requestedWindowDays)
    setSnapshot(cacheKey, overview.value)
  } catch (error) {
    if (selectedWindowDays.value === requestedWindowDays) {
      errorMessage.value = error?.data?.statusMessage
        || error?.message
        || 'Could not load customer experience metrics.'
    }
  } finally {
    if (selectedWindowDays.value === requestedWindowDays) {
      loading.value = false
    }
  }
}

const selectWindow = async (windowDays) => {
  if (!windowOptions.includes(windowDays) || selectedWindowDays.value === windowDays) {
    return
  }

  selectedWindowDays.value = windowDays
  overview.value = null
  await loadOverview()
}

const refreshMetrics = () => {
  void loadLiveVisitors()
  void loadOverview({ force: true })
}

onMounted(() => {
  liveVisitorPollingActive = true
  void loadOverview()
  void loadLiveVisitors()
  document.addEventListener('visibilitychange', handleAnalyticsVisibilityChange)
  scheduleLiveVisitorRefresh()
})

onBeforeUnmount(() => {
  liveVisitorPollingActive = false
  liveVisitorRequestGeneration += 1
  liveVisitorRequestInFlight = false
  liveVisitorAbortController?.abort()
  liveVisitorAbortController = undefined
  clearLiveVisitorRefresh()
  document.removeEventListener('visibilitychange', handleAnalyticsVisibilityChange)
})
</script>
