<script setup>
import { formatAccountMoney } from '~/utils/accountOrders'
import { resolveAccountUser } from '~/utils/accountSession'
import { completedOrderStatuses, openOrderStatuses } from '~/utils/orderStatus'

definePageMeta({ layout: 'account', middleware: 'customer-auth' })
useHead({ title: 'Your Account' })

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const loading = ref(true)
const error = ref('')
const orders = ref([])
const stats = reactive({ total: 0, completed: 0, active: 0, wallet: 0 })
let active = true
let loadVersion = 0
onBeforeUnmount(() => { active = false })

const ensureProfile = async (currentUser, signal) => {
  const { data, error: lookupError } = await supabase.from('customer_profiles')
    .select('wallet_balance').eq('id', currentUser.id).maybeSingle().abortSignal(signal)
  if (lookupError) throw lookupError
  if (data) return data
  const { data: created, error: createError } = await supabase.from('customer_profiles')
    .upsert({ id: currentUser.id, email: currentUser.email || '',
      full_name: currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'Customer' })
    .select('wallet_balance').single().abortSignal(signal)
  if (createError) throw createError
  return created
}

const load = async () => {
  const version = ++loadVersion
  loading.value = true
  error.value = ''
  try {
    const currentUser = await resolveAccountUser(supabase, user.value)
    if (!currentUser) throw new Error('No customer session')
    const signal = AbortSignal.timeout(20000)
    const [profileResult, total, completed, activeOrders, recent] = await Promise.all([
      ensureProfile(currentUser, signal),
      supabase.from('customer_orders').select('id', { count: 'exact', head: true }).eq('user_id', currentUser.id).abortSignal(signal),
      supabase.from('customer_orders').select('id', { count: 'exact', head: true }).eq('user_id', currentUser.id).in('status', completedOrderStatuses).abortSignal(signal),
      supabase.from('customer_orders').select('id', { count: 'exact', head: true }).eq('user_id', currentUser.id).in('status', openOrderStatuses).abortSignal(signal),
      supabase.from('customer_orders').select('id, order_number, status, total_amount, currency, created_at')
        .eq('user_id', currentUser.id).order('created_at', { ascending: false }).limit(4).abortSignal(signal)
    ])
    for (const result of [total, completed, activeOrders, recent]) if (result.error) throw result.error
    const recentRows = recent.data || []
    let itemRows = []
    if (recentRows.length) {
      const itemsResult = await supabase.from('customer_order_items')
        .select('id, order_id, product_title, image_url, quantity')
        .in('order_id', recentRows.map(order => order.id)).order('created_at').abortSignal(signal)
      if (itemsResult.error) throw itemsResult.error
      itemRows = itemsResult.data || []
    }
    if (!active || version !== loadVersion) return
    stats.total = total.count || 0
    stats.completed = completed.count || 0
    stats.active = activeOrders.count || 0
    stats.wallet = Number(profileResult.wallet_balance || 0)
    orders.value = recentRows.map(order => {
      const items = itemRows.filter(item => item.order_id === order.id)
      return { ...order, items, itemCount: items.reduce((count, item) => count + item.quantity, 0) }
    })
  } catch {
    if (active && version === loadVersion) error.value = 'Could not load your account. Please try again.'
  } finally {
    if (active && version === loadVersion) loading.value = false
  }
}

onMounted(load)
watch(() => user.value?.sub || user.value?.id, load)
</script>

<template>
  <div class="space-y-5">
    <header class="flex flex-wrap items-end justify-between gap-3">
      <div><p class="text-sm font-semibold text-blue-700">Your account</p><h1 class="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">Overview</h1><p class="mt-1 text-sm text-slate-600">Your orders and account at a glance.</p></div>
      <NuxtLink to="/account/orders" class="inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">All orders <Icon name="lucide:arrow-right" size="16" class="ml-1" aria-hidden="true" /></NuxtLink>
    </header>
    <p v-if="error" role="alert" class="rounded-xl bg-red-50 p-4 text-sm text-red-700">{{ error }}</p>
    <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Account summary">
      <NuxtLink v-for="stat in [
        { label: 'Total orders', value: stats.total, icon: 'lucide:package', to: '/account/orders' },
        { label: 'In progress', value: stats.active, icon: 'lucide:clock-3', to: '/account/orders?filter=active' },
        { label: 'Completed', value: stats.completed, icon: 'lucide:check-circle-2', to: '/account/orders?filter=completed' },
        { label: 'Wallet balance', value: formatAccountMoney(stats.wallet), icon: 'lucide:wallet', to: '/account/wallet' }
      ]" :key="stat.label" :to="stat.to" class="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-blue-200 hover:bg-blue-50/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">
        <div class="flex items-center gap-3"><span class="flex size-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><Icon :name="stat.icon" size="19" aria-hidden="true" /></span><span class="text-sm text-slate-600">{{ stat.label }}</span></div>
        <p class="mt-3 text-2xl font-bold text-slate-900">{{ loading || error ? '—' : stat.value }}</p>
      </NuxtLink>
    </section>
    <section aria-labelledby="recent-orders-heading" class="space-y-3">
      <div class="flex items-center justify-between gap-3"><h2 id="recent-orders-heading" class="text-xl font-bold text-slate-900">Recent orders</h2><span v-if="!loading && !error" class="text-sm text-slate-500">{{ stats.total }} total</span></div>
      <p v-if="loading" role="status" class="rounded-2xl bg-white p-8 text-center text-sm text-slate-600">Loading your orders…</p>
      <div v-else-if="!error && orders.length" class="grid gap-3 xl:grid-cols-2"><AccountOrderCard v-for="order in orders" :key="order.id" :order="order" compact /></div>
      <div v-else-if="!error" class="rounded-2xl border border-slate-200 bg-white p-8 text-center"><Icon name="lucide:package-open" size="28" class="mx-auto text-slate-400" aria-hidden="true" /><p class="mt-3 font-semibold text-slate-900">No orders yet</p><p class="mt-1 text-sm text-slate-600">Your purchases will appear here.</p><NuxtLink to="/search" class="mt-4 inline-flex min-h-10 items-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700">Browse products</NuxtLink></div>
    </section>
  </div>
</template>
