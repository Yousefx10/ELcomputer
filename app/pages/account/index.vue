<script setup>
import { formatAccountMoney } from '~/utils/accountOrders'
import { resolveAccountUser } from '~/utils/accountSession'
import { completedOrderStatuses, openOrderStatuses } from '~/utils/orderStatus'

definePageMeta({ layout: 'account', middleware: 'customer-auth' })
useHead({ title: 'Your Account' })

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const { data: accountAppearance } = await useAccountAppearance()
const isModern = computed(() => accountAppearance.value?.account_dashboard_style === 'modern')
const loading = ref(true)
const error = ref('')
const orders = ref([])
const profile = ref(null)
const accountEmail = ref('')
const stats = reactive({ total: 0, completed: 0, active: 0, wallet: 0 })
const displayName = computed(() => profile.value?.full_name
  || user.value?.user_metadata?.full_name
  || user.value?.email?.split('@')[0]
  || 'there')
const firstName = computed(() => displayName.value.trim().split(/\s+/)[0])
const address = computed(() => [profile.value?.address_line_1, profile.value?.city, profile.value?.state, profile.value?.country]
  .filter(Boolean).join(', '))
let active = true
let loadVersion = 0
onBeforeUnmount(() => { active = false })

const ensureProfile = async (currentUser, signal) => {
  const { data, error: lookupError } = await supabase.from('customer_profiles')
    .select('wallet_balance, full_name, phone, address_line_1, city, state, country')
    .eq('id', currentUser.id).maybeSingle().abortSignal(signal)
  if (lookupError) throw lookupError
  if (data) return data
  const { data: created, error: createError } = await supabase.from('customer_profiles')
    .upsert({ id: currentUser.id, email: currentUser.email || '',
      full_name: currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'Customer' })
    .select('wallet_balance, full_name, phone, address_line_1, city, state, country').single().abortSignal(signal)
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
        .select('id, order_id, product_id, variant_id, product_title, image_url, quantity')
        .in('order_id', recentRows.map(order => order.id)).order('created_at').abortSignal(signal)
      if (itemsResult.error) throw itemsResult.error
      itemRows = itemsResult.data || []
    }
    if (!active || version !== loadVersion) return
    stats.total = total.count || 0
    stats.completed = completed.count || 0
    stats.active = activeOrders.count || 0
    stats.wallet = Number(profileResult.wallet_balance || 0)
    profile.value = profileResult
    accountEmail.value = currentUser.email || ''
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
  <div v-if="isModern" class="space-y-5">
    <header class="flex flex-wrap items-start justify-between gap-4 pb-1">
      <div>
        <p class="text-sm font-semibold text-blue-700">Your account</p>
        <h1 class="mt-1 text-3xl font-bold tracking-tight text-slate-950">Welcome back, {{ firstName }}</h1>
        <p class="mt-2 text-sm text-slate-600">Your orders and account details, all in one place.</p>
      </div>
      <NuxtLink to="/account/wallet" class="flex min-w-[190px] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 transition hover:border-blue-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">
        <span class="flex size-10 items-center justify-center rounded-full bg-blue-50 text-blue-700"><Icon name="lucide:wallet" size="20" aria-hidden="true" /></span>
        <span><span class="block text-xs text-slate-500">Wallet balance</span><span class="block font-bold text-slate-950">{{ loading || error ? '—' : formatAccountMoney(stats.wallet) }}</span></span>
      </NuxtLink>
    </header>

    <p v-if="error" role="alert" class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{{ error }}</p>

    <section class="overflow-hidden rounded-2xl border border-slate-200 bg-white" aria-labelledby="modern-orders-title">
      <NuxtLink to="/account/orders" class="flex items-center gap-3 bg-blue-50/70 px-5 py-4 transition hover:bg-blue-100/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 sm:px-6">
        <Icon name="lucide:receipt-text" size="21" class="text-blue-700" aria-hidden="true" />
        <span class="min-w-0 flex-1"><span id="modern-orders-title" class="block text-lg font-bold text-slate-950">Purchase history</span><span v-if="!loading && !error" class="block text-sm text-slate-600">{{ stats.total }} {{ stats.total === 1 ? 'order' : 'orders' }} · {{ stats.active }} in progress</span></span>
        <Icon name="lucide:chevron-right" size="20" class="text-slate-600" aria-hidden="true" />
      </NuxtLink>
      <div class="p-4 sm:p-6">
        <p v-if="loading" role="status" class="py-6 text-center text-sm text-slate-600">Loading your orders…</p>
        <div v-else-if="!error && orders.length" class="grid gap-3 xl:grid-cols-2"><AccountOrderCard v-for="order in orders" :key="order.id" :order="order" compact /></div>
        <p v-else-if="!error" class="py-6 text-center text-sm text-slate-600">No purchases yet. Your orders will appear here.</p>
        <NuxtLink v-if="!loading && !error && orders.length" to="/account/orders" class="mt-5 inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-blue-700 hover:underline">View all orders <Icon name="lucide:arrow-right" size="16" aria-hidden="true" /></NuxtLink>
      </div>
    </section>

    <div class="grid gap-5 xl:grid-cols-2">
      <section class="overflow-hidden rounded-2xl border border-slate-200 bg-white" aria-labelledby="modern-wallet-title">
        <NuxtLink to="/account/wallet" class="flex items-center gap-3 bg-blue-50/70 px-5 py-4 transition hover:bg-blue-100/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">
          <Icon name="lucide:wallet" size="21" class="text-blue-700" aria-hidden="true" />
          <span id="modern-wallet-title" class="flex-1 text-lg font-bold text-slate-950">Wallet</span>
          <Icon name="lucide:chevron-right" size="20" class="text-slate-600" aria-hidden="true" />
        </NuxtLink>
        <div class="px-5 py-5"><p class="text-sm text-slate-500">Available balance</p><p class="mt-1 text-2xl font-bold text-slate-950">{{ loading || error ? '—' : formatAccountMoney(stats.wallet) }}</p><p class="mt-3 text-xs text-slate-500">A detailed activity list is not available yet.</p></div>
      </section>
      <section class="overflow-hidden rounded-2xl border border-slate-200 bg-white" aria-labelledby="modern-profile-title">
        <NuxtLink to="/account/profile" class="flex items-center gap-3 bg-blue-50/70 px-5 py-4 transition hover:bg-blue-100/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">
          <Icon name="lucide:user-round" size="21" class="text-blue-700" aria-hidden="true" />
          <span id="modern-profile-title" class="flex-1 text-lg font-bold text-slate-950">Account info</span>
          <Icon name="lucide:chevron-right" size="20" class="text-slate-600" aria-hidden="true" />
        </NuxtLink>
        <dl class="divide-y divide-slate-100 text-sm">
          <div class="px-5 py-3"><dt class="text-slate-500">Email</dt><dd class="mt-1 break-all font-medium text-slate-950">{{ loading || error ? '—' : accountEmail || 'Not provided' }}</dd></div>
          <div class="px-5 py-3"><dt class="text-slate-500">Phone</dt><dd class="mt-1 font-medium text-slate-950">{{ loading || error ? '—' : profile?.phone || 'Not added' }}</dd></div>
          <div class="px-5 py-3"><dt class="text-slate-500">Address</dt><dd class="mt-1 font-medium text-slate-950">{{ loading || error ? '—' : address || 'Not added' }}</dd></div>
        </dl>
      </section>
    </div>

    <section class="grid gap-3 sm:grid-cols-2" aria-label="Account help">
      <NuxtLink to="/account/messages" class="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-blue-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"><Icon name="lucide:mail" size="20" class="text-blue-700" aria-hidden="true" /><span class="flex-1"><span class="block font-semibold text-slate-950">Messages</span><span class="block text-xs text-slate-500">Updates from our team</span></span><Icon name="lucide:chevron-right" size="18" class="text-slate-500" aria-hidden="true" /></NuxtLink>
      <NuxtLink to="/account/support" class="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-blue-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"><Icon name="lucide:life-buoy" size="20" class="text-blue-700" aria-hidden="true" /><span class="flex-1"><span class="block font-semibold text-slate-950">Support</span><span class="block text-xs text-slate-500">View tickets or ask a question</span></span><Icon name="lucide:chevron-right" size="18" class="text-slate-500" aria-hidden="true" /></NuxtLink>
    </section>
  </div>
  <div v-else class="space-y-5">
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
