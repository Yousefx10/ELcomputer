<template>
  <section class="space-y-4" aria-labelledby="business-overview-title">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h3 id="business-overview-title" class="text-2xl font-bold text-gray-900">Business overview</h3>
        <p class="mt-1 text-sm text-gray-500">Customers, orders and sales performance at a glance.</p>
      </div>
      <span class="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-gray-500 shadow-sm ring-1 ring-gray-200">
        <Icon name="lucide:calendar-days" size="14" /> Last 7 days
      </span>
    </div>

    <div v-if="overviewCards.length" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <DashboardStatCard
        v-for="card in overviewCards"
        :key="card.key"
        :label="card.label"
        :value="card.value"
        :icon="card.icon"
        :tone="card.tone"
        :caption="card.caption"
        :to="card.to"
      />
    </div>

    <div
      v-if="canSeeAnalysis || canSeeOrders"
      class="grid gap-4"
      :class="canSeeAnalysis && canSeeOrders ? 'xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.8fr)]' : ''"
    >
      <article v-if="canSeeAnalysis" class="overflow-hidden rounded-[1.35rem] border border-gray-200/80 bg-white p-5 shadow-sm sm:p-6">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="text-base font-bold text-gray-950">Sales performance</p>
            <p class="mt-1 text-xs text-gray-500">Daily revenue for the last seven days.</p>
          </div>
          <div class="text-right">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-400">7-day sales</p>
            <p class="mt-1 text-xl font-black tabular-nums text-gray-950">{{ analyticsLoading || analyticsError ? '—' : formatCurrency(chartTotal) }}</p>
          </div>
        </div>

        <div v-if="analyticsLoading" class="mt-6 h-56 animate-pulse rounded-2xl bg-gray-100" />
        <div v-else-if="analyticsError" class="mt-6 flex h-56 items-center justify-center rounded-2xl bg-gray-50 p-6 text-center text-sm text-gray-500">
          {{ analyticsError }}
        </div>
        <div v-else class="mt-6">
          <div class="relative h-52 overflow-hidden rounded-2xl bg-gradient-to-b from-blue-50/70 to-white px-3 pt-4">
            <div class="pointer-events-none absolute inset-x-3 inset-y-4 flex flex-col justify-between" aria-hidden="true">
              <span v-for="line in 4" :key="line" class="border-t border-dashed border-blue-100" />
            </div>
            <svg viewBox="0 0 1000 220" preserveAspectRatio="none" class="relative h-full w-full overflow-visible" role="img" aria-label="Seven-day sales chart">
              <defs>
                <linearGradient id="summary-sales-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.3" />
                  <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.02" />
                </linearGradient>
              </defs>
              <path v-if="chartPoints.length > 1" :d="chartAreaPath" fill="url(#summary-sales-fill)" />
              <polyline v-if="chartPoints.length > 1" :points="chartPolyline" fill="none" stroke="#2563eb" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
              <circle v-for="point in chartPoints" :key="point.index" :cx="point.x" :cy="point.y" r="5" fill="#2563eb" stroke="white" stroke-width="3" vector-effect="non-scaling-stroke">
                <title>{{ point.label }}: {{ formatCurrency(point.value) }}</title>
              </circle>
            </svg>
          </div>
          <div class="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-gray-400">
            <span v-for="point in chartPoints" :key="`label-${point.index}`">{{ point.shortLabel }}</span>
          </div>
        </div>
      </article>

      <article v-if="canSeeOrders" class="rounded-[1.35rem] border border-gray-200/80 bg-white p-5 shadow-sm sm:p-6">
        <div>
          <p class="text-base font-bold text-gray-950">Order status</p>
          <p class="mt-1 text-xs text-gray-500">Current open-order workload.</p>
        </div>

        <div class="mt-6 flex flex-col items-center gap-6 sm:flex-row xl:flex-col 2xl:flex-row">
          <div class="relative h-40 w-40 shrink-0 rounded-full" :style="{ background: orderStatusGradient }" role="img" :aria-label="`${formatNumber(summary.orders.open)} open orders`">
            <div class="absolute inset-7 grid place-items-center rounded-full bg-white text-center shadow-inner">
              <div><p class="text-2xl font-black tabular-nums text-gray-950">{{ formatNumber(summary.orders.open) }}</p><p class="text-[10px] font-bold uppercase tracking-wide text-gray-400">Open</p></div>
            </div>
          </div>

          <div class="w-full min-w-0 space-y-3">
            <div v-for="status in orderStatuses" :key="status.key" class="flex items-center gap-2.5 text-xs">
              <span class="h-2.5 w-2.5 shrink-0 rounded-full" :style="{ backgroundColor: status.color }" />
              <span class="min-w-0 flex-1 truncate text-gray-500">{{ status.label }}</span>
              <strong class="tabular-nums text-gray-900">{{ formatNumber(status.value) }}</strong>
            </div>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup>
const props = defineProps({
  summary: { type: Object, required: true },
  canSeeOrders: { type: Boolean, default: false },
  canSeeAnalysis: { type: Boolean, default: false },
  canSeeCustomers: { type: Boolean, default: false }
})

const supabase = useSupabaseClient()
const { getSnapshot, isFresh, setSnapshot } = useDashboardCache()
const analyticsOverview = ref({})
const chartRows = ref([])
const analyticsLoading = ref(props.canSeeAnalysis)
const analyticsError = ref('')
const ANALYTICS_CACHE_KEY = 'dashboard:summary:visual-overview:v1'

const numberFormatter = new Intl.NumberFormat('en-US')
const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'EGP',
  maximumFractionDigits: 0
})

const formatNumber = (value) => numberFormatter.format(Number(value || 0))
const formatCurrency = (value) => currencyFormatter.format(Number(value || 0))
const formatPercentage = (value) => `${value > 0 ? '+' : ''}${Number(value || 0).toFixed(1)}%`

const monthlyCurrent = computed(() => Number(analyticsOverview.value?.monthly?.current?.revenue || 0))
const monthlyPrevious = computed(() => Number(analyticsOverview.value?.monthly?.previous?.revenue || 0))
const monthlyGrowth = computed(() => {
  if (!monthlyPrevious.value) return monthlyCurrent.value ? 100 : 0
  return ((monthlyCurrent.value - monthlyPrevious.value) / Math.abs(monthlyPrevious.value)) * 100
})

const overviewCards = computed(() => {
  const cards = []

  if (props.canSeeCustomers) {
    cards.push({ key: 'customers', label: 'Total Customers', value: formatNumber(props.summary.users?.customers), icon: 'lucide:users', tone: 'emerald', caption: 'Registered store customers', to: '/dashboard/hr?tab=users&people=customers' })
  }

  if (props.canSeeOrders) {
    cards.push({ key: 'orders', label: 'Total Orders', value: formatNumber(props.summary.orders?.total), icon: 'lucide:shopping-bag', tone: 'rose', caption: `${formatNumber(props.summary.orders?.today)} added today`, to: '/dashboard/orders' })
  }

  if (props.canSeeAnalysis) {
    cards.push(
      { key: 'sales', label: 'Monthly Sales', value: analyticsLoading.value || analyticsError.value ? '—' : formatCurrency(monthlyCurrent.value), icon: 'lucide:circle-dollar-sign', tone: 'blue', caption: 'Revenue this month', to: '/dashboard?view=analysis' },
      { key: 'growth', label: 'Sales Growth', value: analyticsLoading.value || analyticsError.value ? '—' : formatPercentage(monthlyGrowth.value), icon: monthlyGrowth.value >= 0 ? 'lucide:chart-no-axes-combined' : 'lucide:trending-down', tone: monthlyGrowth.value >= 0 ? 'amber' : 'rose', caption: 'Compared with last month', to: '/dashboard?view=analysis' }
    )
  }

  return cards
})

const orderStatuses = computed(() => {
  const orders = props.summary.orders || {}
  const knownTotal = Number(orders.awaitingPayment || 0) + Number(orders.readyToDeliver || 0) + Number(orders.inDelivery || 0) + Number(orders.onHold || 0)

  return [
    { key: 'other', label: 'Other open', value: Math.max(0, Number(orders.open || 0) - knownTotal), color: '#3b82f6' },
    { key: 'payment', label: 'Awaiting payment', value: Number(orders.awaitingPayment || 0), color: '#f59e0b' },
    { key: 'ready', label: 'Ready to deliver', value: Number(orders.readyToDeliver || 0), color: '#10b981' },
    { key: 'delivery', label: 'In delivery', value: Number(orders.inDelivery || 0), color: '#06b6d4' },
    { key: 'hold', label: 'On hold', value: Number(orders.onHold || 0), color: '#f43f5e' }
  ]
})

const orderStatusGradient = computed(() => {
  const total = orderStatuses.value.reduce((sum, status) => sum + status.value, 0)
  if (!total) return '#e5e7eb'

  let start = 0
  const stops = orderStatuses.value
    .filter((status) => status.value > 0)
    .map((status) => {
      const end = start + (status.value / total) * 100
      const stop = `${status.color} ${start}% ${end}%`
      start = end
      return stop
    })

  return `conic-gradient(${stops.join(', ')})`
})

const chartTotal = computed(() => chartRows.value.reduce((total, row) => total + Number(row.revenue || 0), 0))
const chartPoints = computed(() => {
  const rows = chartRows.value
  const maximum = Math.max(1, ...rows.map((row) => Number(row.revenue || 0)))

  return rows.map((row, index) => {
    const date = new Date(`${row.period_start}T12:00:00`)
    return {
      index,
      value: Number(row.revenue || 0),
      x: rows.length > 1 ? (index / (rows.length - 1)) * 1000 : 500,
      y: 200 - (Number(row.revenue || 0) / maximum) * 170,
      label: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date),
      shortLabel: new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date)
    }
  })
})
const chartPolyline = computed(() => chartPoints.value.map((point) => `${point.x},${point.y}`).join(' '))
const chartAreaPath = computed(() => {
  if (chartPoints.value.length < 2) return ''
  const line = chartPoints.value.map((point) => `${point.x} ${point.y}`).join(' L ')
  return `M ${chartPoints.value[0].x} 220 L ${line} L ${chartPoints.value.at(-1).x} 220 Z`
})

const dateInput = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const loadAnalytics = async () => {
  if (!props.canSeeAnalysis) return

  const cached = getSnapshot(ANALYTICS_CACHE_KEY)
  if (cached) {
    analyticsOverview.value = cached.overview || {}
    chartRows.value = cached.chart || []
  }
  if (cached && isFresh(ANALYTICS_CACHE_KEY)) {
    analyticsLoading.value = false
    return
  }

  analyticsLoading.value = true
  analyticsError.value = ''

  const to = new Date()
  const from = new Date(to)
  from.setDate(to.getDate() - 6)

  try {
    const [{ data: overviewData, error: overviewError }, { data: chartData, error: chartError }] = await Promise.all([
      supabase.rpc('dashboard_get_analysis_overview'),
      supabase.rpc('dashboard_get_analysis_chart', {
        p_start_date: dateInput(from),
        p_end_date: dateInput(to),
        p_bucket: 'day'
      })
    ])

    if (overviewError || chartError) throw overviewError || chartError

    analyticsOverview.value = overviewData || {}
    chartRows.value = chartData || []
    setSnapshot(ANALYTICS_CACHE_KEY, { overview: analyticsOverview.value, chart: chartRows.value })
  } catch (error) {
    analyticsError.value = error?.message || 'Sales performance is unavailable.'
  } finally {
    analyticsLoading.value = false
  }
}

onMounted(loadAnalytics)

watch(() => props.canSeeAnalysis, (canSeeAnalysis) => {
  if (canSeeAnalysis && !chartRows.value.length) loadAnalytics()
})
</script>
