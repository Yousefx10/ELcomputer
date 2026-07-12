<script setup>
import {
  completedOrderStatuses,
  formatCustomerOrderStatus,
  getCustomerOrderStatusClass,
  openOrderStatuses
} from '~/utils/orderStatus'

definePageMeta({
  middleware: 'customer-auth'
})

const supabase = useSupabaseClient()
const user = useSupabaseUser()

const loading = ref(true)
const errorMessage = ref('')
const profile = ref(null)
const recentOrders = ref([])
const stats = reactive({
  totalOrders: 0,
  delivered: 0,
  inProgress: 0,
  wallet: 0
})

const sidebarItems = [
  { key: 'profile', label: 'My Profile', icon: 'lucide:user-round', active: true },
  { key: 'orders', label: 'Orders', icon: 'lucide:file-text', active: false },
  { key: 'wallet', label: 'Wallet', icon: 'lucide:wallet', active: false },
  { key: 'settings', label: 'Settings', icon: 'lucide:settings', active: false }
]

const getCustomerDisplayName = (accountUser, accountProfile) => {
  return accountProfile?.full_name
    || accountUser?.user_metadata?.full_name
    || accountUser?.user_metadata?.name
    || accountUser?.email?.split('@')[0]
    || 'Customer'
}

const ensureCustomerProfile = async (accountUser) => {
  const { data: existingProfile, error: existingProfileError } = await supabase
    .from('customer_profiles')
    .select('*')
    .eq('id', accountUser.id)
    .maybeSingle()

  if (existingProfileError) {
    throw existingProfileError
  }

  if (existingProfile) {
    return existingProfile
  }

  const { data: createdProfile, error: createProfileError } = await supabase
    .from('customer_profiles')
    .upsert({
      id: accountUser.id,
      email: accountUser.email || '',
      full_name: getCustomerDisplayName(accountUser),
      avatar_url: accountUser.user_metadata?.avatar_url || null
    })
    .select('*')
    .single()

  if (createProfileError) {
    throw createProfileError
  }

  return createdProfile
}

const loadAccountPage = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    const { data: userData, error: userError } = await supabase.auth.getUser()

    if (userError) {
      throw userError
    }

    if (!userData.user) {
      await navigateTo('/login')
      return
    }

    const accountUser = userData.user
    const accountProfile = await ensureCustomerProfile(accountUser)

    if (accountProfile.is_active === false) {
      await supabase.auth.signOut()
      await navigateTo({
        path: '/login',
        query: {
          error: 'account-disabled'
        }
      })
      return
    }

    const [
      totalOrdersResult,
      deliveredOrdersResult,
      inProgressOrdersResult,
      recentOrdersResult
    ] = await Promise.all([
      supabase
        .from('customer_orders')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', accountUser.id),
      supabase
        .from('customer_orders')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', accountUser.id)
        .in('status', completedOrderStatuses),
      supabase
        .from('customer_orders')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', accountUser.id)
        .in('status', openOrderStatuses),
      supabase
        .from('customer_orders')
        .select('id, order_number, status, total_amount, currency, created_at')
        .eq('user_id', accountUser.id)
        .order('created_at', { ascending: false })
        .limit(5)
    ])

    if (totalOrdersResult.error) {
      throw totalOrdersResult.error
    }

    if (deliveredOrdersResult.error) {
      throw deliveredOrdersResult.error
    }

    if (inProgressOrdersResult.error) {
      throw inProgressOrdersResult.error
    }

    if (recentOrdersResult.error) {
      throw recentOrdersResult.error
    }

    profile.value = accountProfile
    stats.totalOrders = totalOrdersResult.count || 0
    stats.delivered = deliveredOrdersResult.count || 0
    stats.inProgress = inProgressOrdersResult.count || 0
    stats.wallet = Number(accountProfile.wallet_balance || 0)
    recentOrders.value = recentOrdersResult.data || []
  } catch (error) {
    errorMessage.value = error?.message || 'Could not load your account page.'
  } finally {
    loading.value = false
  }
}

const logout = async () => {
  await supabase.auth.signOut()
  await navigateTo('/')
}

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'EGP',
    maximumFractionDigits: 2
  }).format(Number(value || 0))
}

const formatDate = (value) => {
  if (!value) {
    return 'Recently'
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium'
  }).format(new Date(value))
}

const getStatusLabel = (value) => {
  return formatCustomerOrderStatus(value)
}

const getStatusClass = (value) => {
  return getCustomerOrderStatusClass(value)
}

const displayName = computed(() => getCustomerDisplayName(user.value, profile.value))
const userEmail = computed(() => user.value?.email || '')
const memberSince = computed(() => {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric'
  }).format(new Date(profile.value?.created_at || user.value?.created_at || Date.now()))
})

await loadAccountPage()
</script>

<template>
  <div class="min-h-screen bg-gray-100 py-8">
    <div class="mx-auto max-w-7xl px-4 md:px-6">
      <div v-if="errorMessage" class="mb-6 rounded-2xl bg-red-50 p-4 text-red-600 shadow">
        {{ errorMessage }}
      </div>

      <div class="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside class="overflow-hidden rounded-3xl bg-white shadow">
          <div class="bg-blue-600 px-6 py-8 text-white">
            <div class="mx-auto flex h-28 w-28 items-center justify-center rounded-full border-4 border-white/30 bg-white/10">
              <Icon name="lucide:user-round" size="56" />
            </div>

            <h1 class="mt-6 text-center text-3xl font-bold">
              {{ displayName }}
            </h1>

            <p class="mt-2 text-center text-sm text-blue-100">
              {{ userEmail }}
            </p>

            <p class="mx-auto mt-5 inline-flex rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-blue-50">
              Since {{ memberSince }}
            </p>
          </div>

          <div class="p-5">
            <p class="px-3 text-xs font-bold uppercase tracking-[0.2em] text-gray-400">
              Account
            </p>

            <div class="mt-4 space-y-2">
              <div
                v-for="item in sidebarItems"
                :key="item.key"
                class="flex items-center gap-3 rounded-2xl px-4 py-3"
                :class="item.active ? 'bg-blue-50 text-blue-700' : 'text-gray-500'"
              >
                <Icon :name="item.icon" size="18" />
                <span class="font-semibold">{{ item.label }}</span>
              </div>
            </div>

            <button
              type="button"
              class="mt-6 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left font-semibold text-red-600 hover:bg-red-50"
              @click="logout"
            >
              <Icon name="lucide:log-out" size="18" />
              <span>Log Out</span>
            </button>
          </div>
        </aside>

        <section class="space-y-6">
          <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div class="rounded-2xl bg-white p-5 shadow">
              <div class="flex items-center gap-4">
                <div class="rounded-2xl bg-blue-50 p-4 text-blue-600">
                  <Icon name="lucide:file-text" size="22" />
                </div>

                <div>
                  <p class="text-3xl font-bold text-gray-900">{{ stats.totalOrders }}</p>
                  <p class="text-sm font-semibold text-gray-500">Total Orders</p>
                </div>
              </div>
            </div>

            <div class="rounded-2xl bg-white p-5 shadow">
              <div class="flex items-center gap-4">
                <div class="rounded-2xl bg-green-50 p-4 text-green-600">
                  <Icon name="lucide:check" size="22" />
                </div>

                <div>
                  <p class="text-3xl font-bold text-gray-900">{{ stats.delivered }}</p>
                  <p class="text-sm font-semibold text-gray-500">Delivered</p>
                </div>
              </div>
            </div>

            <div class="rounded-2xl bg-white p-5 shadow">
              <div class="flex items-center gap-4">
                <div class="rounded-2xl bg-amber-50 p-4 text-amber-600">
                  <Icon name="lucide:clock-3" size="22" />
                </div>

                <div>
                  <p class="text-3xl font-bold text-gray-900">{{ stats.inProgress }}</p>
                  <p class="text-sm font-semibold text-gray-500">In Progress</p>
                </div>
              </div>
            </div>

            <div class="rounded-2xl bg-white p-5 shadow">
              <div class="flex items-center gap-4">
                <div class="rounded-2xl bg-cyan-50 p-4 text-cyan-700">
                  <Icon name="lucide:wallet" size="22" />
                </div>

                <div>
                  <p class="text-3xl font-bold text-gray-900">{{ formatCurrency(stats.wallet) }}</p>
                  <p class="text-sm font-semibold text-gray-500">Wallet</p>
                </div>
              </div>
            </div>
          </div>

          <div class="rounded-3xl bg-white p-6 shadow">
            <div class="flex items-center justify-between gap-3">
              <div>
                <h2 class="text-2xl font-bold text-gray-900">Recent Orders</h2>
                <p class="mt-1 text-sm text-gray-500">
                  Your latest order activity appears here.
                </p>
              </div>

              <div class="rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-600">
                {{ stats.totalOrders }} total
              </div>
            </div>

            <div v-if="loading" class="py-16 text-center text-gray-500">
              Loading account details...
            </div>

            <div v-else-if="!recentOrders.length" class="py-16 text-center text-gray-400">
              No orders yet.
            </div>

            <div v-else class="mt-6 divide-y">
              <div
                v-for="order in recentOrders"
                :key="order.id"
                class="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p class="font-bold text-gray-900">
                    {{ order.order_number || `Order #${order.id.slice(0, 8)}` }}
                  </p>

                  <p class="mt-1 text-sm text-gray-500">
                    {{ formatDate(order.created_at) }}
                  </p>
                </div>

                <div class="flex items-center gap-3">
                  <span
                    class="rounded-full px-3 py-1 text-xs font-semibold"
                    :class="getStatusClass(order.status)"
                  >
                    {{ getStatusLabel(order.status) }}
                  </span>

                  <p class="font-semibold text-gray-900">
                    {{ formatCurrency(order.total_amount) }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
