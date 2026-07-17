<template>
  <div class="space-y-6">
    <section>
      <div class="mb-4">
        <h3 class="text-2xl font-bold text-gray-900">Overview</h3>
        <p class="mt-1 text-sm text-gray-500">
          Watch calendar periods.
        </p>
      </div>

      <div v-if="overviewLoading" class="rounded-2xl bg-white p-8 text-center text-sm text-gray-500 shadow">
        Loading analysis overview...
      </div>

      <div v-else class="grid gap-4 xl:grid-cols-3">
        <article v-for="period in overviewPeriods" :key="period.key" class="rounded-2xl bg-white p-5 shadow">
          <div class="mb-4 flex items-center justify-between gap-3 border-b pb-4">
            <div>
              <h4 class="text-xl font-bold text-gray-900">{{ period.label }}</h4>
              <p class="mt-1 text-xs text-gray-500">Compared with {{ period.comparisonLabel }}</p>
            </div>
            <Icon :name="period.icon" size="22" class="text-gray-400" />
          </div>

          <div class="space-y-4">
            <div v-for="metric in overviewMetrics" :key="metric.key" class="flex items-center justify-between gap-4">
              <div>
                <p class="text-sm text-gray-500">{{ metric.label }}</p>
                <p class="mt-1 text-2xl font-bold text-gray-900">
                  {{ formatOverviewValue(metric, period.current[metric.key]) }}
                </p>
              </div>

              <span class="rounded-full px-2.5 py-1 text-xs font-bold" :class="getChangeClass(getPercentageChange(period.current[metric.key], period.previous[metric.key]))">
                {{ formatPercentage(getPercentageChange(period.current[metric.key], period.previous[metric.key])) }}
              </span>
            </div>
          </div>
        </article>
      </div>
    </section>

    <section class="rounded-2xl bg-white p-6 shadow">
      <div class="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 class="text-2xl font-bold text-gray-900">Performance Chart</h3>
          <p class="mt-1 text-sm text-gray-500">
            Select a metric and reporting period.
          </p>
        </div>

        <button type="button" :disabled="chartLoading" class="inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-50" @click="loadChart({ force: true })">
          <Icon name="lucide:refresh-cw" size="16" :class="chartLoading ? 'animate-spin' : ''" />
          Refresh
        </button>
      </div>

      <div class="mt-6 flex gap-2 overflow-x-auto pb-2">
        <button
          v-for="metric in chartMetrics"
          :key="metric.key"
          type="button"
          class="shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition"
          :class="selectedMetric === metric.key ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
          @click="selectedMetric = metric.key"
        >
          {{ metric.label }}
        </button>
      </div>

      <div class="mt-4 flex flex-wrap gap-2">
        <button
          v-for="preset in rangePresets"
          :key="preset.key"
          type="button"
          class="rounded-lg px-4 py-2 text-sm font-medium"
          :class="selectedRange === preset.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
          @click="selectRange(preset.key)"
        >
          {{ preset.label }}
        </button>
      </div>

      <form v-if="selectedRange === 'custom'" class="mt-4 grid gap-3 rounded-xl bg-gray-50 p-4 sm:grid-cols-[1fr_1fr_auto]" @submit.prevent="applyCustomRange">
        <div>
          <label class="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">From</label>
          <input v-model="customFrom" required type="date" class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500">
        </div>
        <div>
          <label class="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">To</label>
          <input v-model="customTo" required type="date" class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500">
        </div>
        <button type="submit" class="self-end rounded-lg bg-black px-5 py-3 font-semibold text-white">Apply</button>
      </form>

      <div v-if="analysisError" class="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-600">
        {{ analysisError }}
      </div>

      <div v-else class="mt-6">
        <div class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p class="text-sm text-gray-500">{{ selectedMetricDefinition.label }} · {{ activeRangeLabel }}</p>
            <p class="mt-1 text-3xl font-bold text-gray-900">{{ formatChartValue(chartTotal) }}</p>
          </div>
          <p class="text-sm text-gray-500">{{ chartDateLabel }}</p>
        </div>

        <div v-if="chartLoading" class="flex h-80 items-center justify-center rounded-xl bg-gray-50 text-sm text-gray-500">
          Loading chart data...
        </div>

        <div v-else class="rounded-xl border bg-gray-50 p-3 sm:p-5">
          <div class="relative h-72 overflow-hidden">
            <div class="pointer-events-none absolute inset-0 flex flex-col justify-between py-3">
              <div v-for="line in 5" :key="line" class="border-t border-dashed border-gray-200" />
            </div>

            <svg viewBox="0 0 1000 280" preserveAspectRatio="none" class="relative h-full w-full overflow-visible" role="img" :aria-label="`${selectedMetricDefinition.label} chart`">
              <line v-if="chartHasNegativeValues" x1="0" :y1="zeroLineY" x2="1000" :y2="zeroLineY" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="7 7" />
              <path v-if="chartPoints.length > 1" :d="chartAreaPath" :fill="selectedMetricDefinition.fill" opacity="0.18" />
              <polyline v-if="chartPoints.length > 1" :points="chartPolyline" fill="none" :stroke="selectedMetricDefinition.color" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
              <circle v-for="point in visibleChartPoints" :key="point.index" :cx="point.x" :cy="point.y" r="5" :fill="selectedMetricDefinition.color" vector-effect="non-scaling-stroke">
                <title>{{ point.label }}: {{ formatChartValue(point.value) }}</title>
              </circle>
            </svg>
          </div>

          <div class="mt-3 flex justify-between gap-3 text-xs text-gray-500">
            <span v-for="label in chartAxisLabels" :key="label.index" class="text-center">{{ label.label }}</span>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
const supabase = useSupabaseClient()
const { getSnapshot, isFresh, setSnapshot } = useDashboardCache()

const overviewLoading = ref(true)
const chartLoading = ref(true)
const analysisError = ref('')
const overview = ref({})
const chartRows = ref([])
const selectedMetric = ref('orders')
const selectedRange = ref('last_7_days')
const customFrom = ref('')
const customTo = ref('')
const activeRange = reactive({ from: '', to: '', bucket: 'day' })

const overviewMetrics = [
  { key: 'revenue', label: 'Total Sales', currency: true },
  { key: 'orders', label: 'Total Orders' },
  { key: 'sales', label: 'Units Sold', suffix: ' units' }
]

const chartMetrics = [
  { key: 'orders', label: 'Orders', color: '#2563eb', fill: '#60a5fa' },
  { key: 'revenue', label: 'Sales', color: '#16a34a', fill: '#4ade80', currency: true },
  { key: 'sales', label: 'Units Sold', color: '#0891b2', fill: '#22d3ee' },
  { key: 'return_units', label: 'Returns', color: '#dc2626', fill: '#f87171' },
  { key: 'coupons', label: 'Coupons', color: '#d97706', fill: '#fbbf24' },
  { key: 'stock', label: 'Stock', color: '#4b5563', fill: '#9ca3af', signed: true },
  { key: 'expenses', label: 'Expenses', color: '#be123c', fill: '#fb7185', currency: true }
]

const rangePresets = [
  { key: 'year', label: 'Year' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'this_month', label: 'This Month' },
  { key: 'last_7_days', label: 'Last 7 Days' },
  { key: 'custom', label: 'Custom' }
]

const selectedMetricDefinition = computed(() => chartMetrics.find((metric) => metric.key === selectedMetric.value) || chartMetrics[0])

function buildOverviewPeriod(key, label, comparisonLabel, icon) {
  return {
    key,
    label,
    comparisonLabel,
    icon,
    current: overview.value?.[key]?.current || {},
    previous: overview.value?.[key]?.previous || {}
  }
}

const overviewPeriods = computed(() => [
  buildOverviewPeriod('today', 'Today', 'yesterday', 'lucide:sun'),
  buildOverviewPeriod('weekly', 'Weekly', 'last week', 'lucide:calendar-days'),
  buildOverviewPeriod('monthly', 'Monthly', 'last month', 'lucide:calendar-range')
])

const padDatePart = (value) => String(value).padStart(2, '0')
const toDateInput = (date) => `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`

const getPresetRange = (key) => {
  const today = new Date()
  const from = new Date(today)
  const to = new Date(today)
  let bucket = 'day'

  if (key === 'year') {
    from.setMonth(0, 1)
    bucket = 'month'
  } else if (key === 'last_month') {
    from.setMonth(today.getMonth() - 1, 1)
    to.setDate(0)
  } else if (key === 'this_month') {
    from.setDate(1)
  } else {
    from.setDate(today.getDate() - 6)
  }

  return { from: toDateInput(from), to: toDateInput(to), bucket }
}

const applyActiveRange = (range) => {
  activeRange.from = range.from
  activeRange.to = range.to
  activeRange.bucket = range.bucket
}

applyActiveRange(getPresetRange('last_7_days'))

const buildChartCacheKey = () => `dashboard:analysis:chart:${activeRange.from}:${activeRange.to}:${activeRange.bucket}`

const loadOverview = async ({ force = false } = {}) => {
  const cacheKey = 'dashboard:analysis:overview'
  const cached = getSnapshot(cacheKey)

  if (cached) overview.value = cached
  if (!force && cached && isFresh(cacheKey)) {
    overviewLoading.value = false
    return
  }

  overviewLoading.value = true

  const { data, error } = await supabase.rpc('dashboard_get_analysis_overview')
  overviewLoading.value = false

  if (error) throw error

  overview.value = data || {}
  setSnapshot(cacheKey, overview.value)
}

const loadChart = async ({ force = false } = {}) => {
  const cacheKey = buildChartCacheKey()
  const cached = getSnapshot(cacheKey)

  if (cached) chartRows.value = cached
  if (!force && cached && isFresh(cacheKey)) {
    chartLoading.value = false
    return
  }

  chartLoading.value = true
  analysisError.value = ''

  try {
    const { data, error } = await supabase.rpc('dashboard_get_analysis_chart', {
      p_start_date: activeRange.from,
      p_end_date: activeRange.to,
      p_bucket: activeRange.bucket
    })

    if (error) throw error

    chartRows.value = data || []
    setSnapshot(cacheKey, chartRows.value)
  } catch (error) {
    analysisError.value = ['42883', '42P01'].includes(error?.code)
      ? 'Run the latest dashboard Analysis SQL migration, then refresh this page.'
      : error.message || 'Could not load chart data.'
  } finally {
    chartLoading.value = false
  }
}

const loadAnalysis = async () => {
  analysisError.value = ''

  try {
    await Promise.all([loadOverview(), loadChart()])
  } catch (error) {
    analysisError.value = ['42883', '42P01'].includes(error?.code)
      ? 'Run the latest dashboard Analysis SQL migration, then refresh this page.'
      : error.message || 'Could not load analysis data.'
    overviewLoading.value = false
    chartLoading.value = false
  }
}

const selectRange = async (key) => {
  selectedRange.value = key

  if (key === 'custom') {
    if (!customFrom.value || !customTo.value) {
      const defaultRange = getPresetRange('last_7_days')
      customFrom.value = defaultRange.from
      customTo.value = defaultRange.to
    }
    return
  }

  applyActiveRange(getPresetRange(key))
  await loadChart()
}

const applyCustomRange = async () => {
  analysisError.value = ''

  if (customFrom.value > customTo.value) {
    analysisError.value = 'The custom start date must be before the end date.'
    return
  }

  const days = Math.floor((new Date(customTo.value) - new Date(customFrom.value)) / 86400000) + 1
  applyActiveRange({ from: customFrom.value, to: customTo.value, bucket: days > 120 ? 'month' : 'day' })
  await loadChart({ force: true })
}

const getPercentageChange = (currentValue, previousValue) => {
  const current = Number(currentValue || 0)
  const previous = Number(previousValue || 0)

  if (previous === 0) return current === 0 ? 0 : 100
  return Math.round(((current - previous) / Math.abs(previous)) * 100)
}

const getChangeClass = (change) => {
  if (change > 0) return 'bg-green-100 text-green-700'
  if (change < 0) return 'bg-red-100 text-red-700'
  return 'bg-gray-100 text-gray-600'
}

const formatPercentage = (value) => `${Number(value || 0)}%`
const formatCurrency = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EGP', maximumFractionDigits: 2 }).format(Number(value || 0))
const formatNumber = (value) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(value || 0))
const formatOverviewValue = (metric, value) => metric.currency ? formatCurrency(value) : `${formatNumber(value)}${metric.suffix || ''}`
const formatChartValue = (value) => selectedMetricDefinition.value.currency ? formatCurrency(value) : formatNumber(value)

const chartValues = computed(() => chartRows.value.map((row) => Number(row[selectedMetric.value] || 0)))
const chartTotal = computed(() => chartValues.value.reduce((total, value) => total + value, 0))
const chartMinimum = computed(() => Math.min(0, ...chartValues.value))
const chartMaximum = computed(() => Math.max(0, ...chartValues.value))
const chartHasNegativeValues = computed(() => chartMinimum.value < 0)
const chartRange = computed(() => Math.max(chartMaximum.value - chartMinimum.value, 1))
const zeroLineY = computed(() => 12 + ((chartMaximum.value / chartRange.value) * 256))

const chartPoints = computed(() => chartRows.value.map((row, index) => {
  const value = Number(row[selectedMetric.value] || 0)
  const denominator = Math.max(chartRows.value.length - 1, 1)
  return {
    index,
    value,
    label: formatBucketLabel(row.period_start),
    x: (index / denominator) * 1000,
    y: 12 + (((chartMaximum.value - value) / chartRange.value) * 256)
  }
}))

const chartPolyline = computed(() => chartPoints.value.map((point) => `${point.x},${point.y}`).join(' '))
const chartAreaPath = computed(() => {
  if (!chartPoints.value.length) return ''
  const baseline = chartHasNegativeValues.value ? zeroLineY.value : 268
  const lastPoint = chartPoints.value[chartPoints.value.length - 1]
  return `M ${chartPoints.value[0].x} ${baseline} L ${chartPoints.value.map((point) => `${point.x} ${point.y}`).join(' L ')} L ${lastPoint.x} ${baseline} Z`
})

const getVisibleIndexes = (length, count = 6) => {
  if (length <= count) return Array.from({ length }, (_, index) => index)
  return [...new Set(Array.from({ length: count }, (_, index) => Math.round((index * (length - 1)) / (count - 1))))]
}

const visibleChartPoints = computed(() => getVisibleIndexes(chartPoints.value.length, 12).map((index) => chartPoints.value[index]))
const chartAxisLabels = computed(() => getVisibleIndexes(chartPoints.value.length, 5).map((index) => chartPoints.value[index]))

const formatBucketLabel = (value) => {
  const rawDate = String(value || '').slice(0, 10)
  const date = new Date(`${rawDate}T00:00:00`)
  if (Number.isNaN(date.getTime())) return rawDate || '-'
  return new Intl.DateTimeFormat('en-US', activeRange.bucket === 'month' ? { month: 'short' } : { month: 'short', day: 'numeric' }).format(date)
}

const activeRangeLabel = computed(() => rangePresets.find((preset) => preset.key === selectedRange.value)?.label || 'Custom')
const chartDateLabel = computed(() => `${activeRange.from} to ${activeRange.to}`)

onMounted(() => loadAnalysis())
</script>
