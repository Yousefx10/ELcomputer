<script setup>
import { accountOrderFilters, getAccountOrderFilter } from '~/utils/accountOrders'
import { resolveAccountUser } from '~/utils/accountSession'

definePageMeta({ layout: 'account', middleware: 'customer-auth' })
useHead({ title: 'Your Orders' })

const route = useRoute()
const supabase = useSupabaseClient()
const user = useSupabaseUser()
const filter = computed(() => getAccountOrderFilter(route.query.filter).value)
const page = ref(1)
const pageSize = 10
const orders = ref([])
const total = ref(0)
const loading = ref(true)
const error = ref('')
let loadVersion = 0

const load = async () => {
  const version = ++loadVersion
  loading.value = true
  error.value = ''
  try {
    const currentUser = await resolveAccountUser(supabase, user.value)
    if (!currentUser) throw new Error('No customer session')
    const signal = AbortSignal.timeout(20000)
    let query = supabase.from('customer_orders')
      .select('id, order_number, status, payment_status, total_amount, currency, created_at', { count: 'exact' })
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false })
      .range((page.value - 1) * pageSize, page.value * pageSize - 1).abortSignal(signal)
    const statuses = getAccountOrderFilter(filter.value).statuses
    if (statuses) query = query.in('status', statuses)
    const { data, count, error: ordersError } = await query
    if (ordersError) throw ordersError
    const rows = data || []
    let items = []
    if (rows.length) {
      const result = await supabase.from('customer_order_items')
        .select('id, order_id, product_title, image_url, quantity')
        .in('order_id', rows.map(order => order.id)).order('created_at').abortSignal(signal)
      if (result.error) throw result.error
      items = result.data || []
    }
    if (version !== loadVersion) return
    orders.value = rows.map(order => {
      const orderItems = items.filter(item => item.order_id === order.id)
      return { ...order, items: orderItems, itemCount: orderItems.reduce((sum, item) => sum + item.quantity, 0) }
    })
    total.value = count || 0
  } catch {
    if (version === loadVersion) error.value = 'Could not load your orders. Please try again.'
  } finally {
    if (version === loadVersion) loading.value = false
  }
}

watch(filter, () => { page.value = 1; load() })
watch(page, load)
watch(() => user.value?.sub || user.value?.id, load)
onMounted(load)
</script>

<template>
  <div class="space-y-5">
    <header><p class="text-sm font-semibold text-blue-700">Your account</p><h1 class="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">Orders</h1><p class="mt-1 text-sm text-slate-600">See what you ordered and where it stands.</p></header>
    <nav class="flex gap-2 overflow-x-auto pb-1" aria-label="Filter orders">
      <NuxtLink v-for="item in accountOrderFilters" :key="item.value" :to="{ path: '/account/orders', query: item.value === 'all' ? {} : { filter: item.value } }" :aria-current="filter === item.value ? 'page' : undefined" class="inline-flex min-h-10 shrink-0 items-center rounded-full px-4 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600" :class="filter === item.value ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-blue-50'">{{ item.label }}</NuxtLink>
    </nav>
    <p v-if="error" role="alert" class="rounded-xl bg-red-50 p-4 text-sm text-red-700">{{ error }}</p>
    <p v-if="loading" role="status" class="rounded-2xl bg-white p-8 text-center text-sm text-slate-600">Loading orders…</p>
    <div v-else-if="!error && orders.length" class="space-y-3"><AccountOrderCard v-for="order in orders" :key="order.id" :order="order" /></div>
    <div v-else-if="!error" class="rounded-2xl border border-slate-200 bg-white p-8 text-center"><Icon name="lucide:package-open" size="28" class="mx-auto text-slate-400" aria-hidden="true" /><p class="mt-3 font-semibold text-slate-900">No {{ filter === 'all' ? '' : filter }} orders</p><p class="mt-1 text-sm text-slate-600">Orders in this view will appear here.</p></div>
    <div v-if="!error && total > pageSize" class="flex items-center justify-between gap-3 text-sm"><button type="button" :disabled="page <= 1 || loading" class="min-h-10 rounded-lg px-3 font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-40" @click="page--">Previous</button><span class="text-slate-600">Page {{ page }} of {{ Math.ceil(total / pageSize) }}</span><button type="button" :disabled="page * pageSize >= total || loading" class="min-h-10 rounded-lg px-3 font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-40" @click="page++">Next</button></div>
  </div>
</template>
