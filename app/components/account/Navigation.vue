<script setup>
defineProps({ variant: { type: String, default: 'classic' } })

const route = useRoute()
const { request } = useSupportClient()
const unreadSupportTickets = ref(0)

const loadUnreadSupportTickets = async () => {
  try {
    const result = await request('/api/support/unread')
    unreadSupportTickets.value = result.unreadTicketCount || 0
  } catch {
    unreadSupportTickets.value = 0
  }
}

onMounted(() => {
  loadUnreadSupportTickets()
  window.addEventListener('support:unread-changed', loadUnreadSupportTickets)
})
onBeforeUnmount(() => window.removeEventListener('support:unread-changed', loadUnreadSupportTickets))

const items = [
  {
    label: 'Overview',
    icon: 'lucide:layout-dashboard',
    to: '/account',
    exact: true
  },
  {
    label: 'Orders',
    icon: 'lucide:package',
    to: '/account/orders'
  },
  {
    label: 'Messages',
    icon: 'lucide:mail',
    to: '/account/messages'
  },
  {
    label: 'Support',
    icon: 'lucide:life-buoy',
    to: '/account/support'
  },
  {
    label: 'Wallet',
    icon: 'lucide:wallet',
    to: '/account/wallet'
  },
  {
    label: 'Profile',
    icon: 'lucide:user-round',
    to: '/account/profile'
  }
]

const modernGroups = [
  { label: 'Your activity', items: [items[0], items[1], items[2]] },
  { label: 'Manage account', items: [items[4], items[5]] },
  { label: 'Get help', items: [items[3], { label: 'Help Center', icon: 'lucide:book-open', to: '/help' }] }
]
const modernItems = [...items, { label: 'Help Center', icon: 'lucide:book-open', to: '/help' }]

const isActive = item => item.exact
  ? route.path === item.to
  : route.path === item.to || route.path.startsWith(`${item.to}/`)
</script>

<template>
  <nav v-if="variant === 'modern'" class="mt-5 space-y-5" aria-label="Customer account">
    <details class="lg:hidden">
      <summary class="cursor-pointer rounded-xl bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">Account menu</summary>
      <div class="mt-2 grid grid-cols-2 gap-1">
        <NuxtLink v-for="item in modernItems" :key="item.to" :to="item.to" :aria-current="isActive(item) ? 'page' : undefined"
          class="flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
          :class="isActive(item) ? 'bg-blue-50 text-blue-800' : 'text-slate-700 hover:bg-slate-50'">
          <Icon :name="item.icon" size="17" aria-hidden="true" /><span>{{ item.label }}</span>
          <span v-if="item.to === '/account/support' && unreadSupportTickets" class="rounded-full bg-blue-600 px-1.5 py-0.5 text-xs text-white" :aria-label="`${unreadSupportTickets} support tickets with new replies`">{{ unreadSupportTickets }}</span>
        </NuxtLink>
      </div>
    </details>
    <div class="hidden lg:block lg:space-y-5">
      <div v-for="group in modernGroups" :key="group.label" class="border-t border-slate-200 pt-4 first:border-0 first:pt-0">
        <p class="px-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{{ group.label }}</p>
        <div class="mt-2 space-y-0.5">
          <NuxtLink v-for="item in group.items" :key="item.to" :to="item.to"
            :aria-current="isActive(item) ? 'page' : undefined"
            class="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            :class="isActive(item) ? 'bg-blue-50 font-semibold text-blue-800' : 'text-slate-700 hover:bg-slate-50 hover:text-slate-950'">
            <Icon :name="item.icon" size="18" aria-hidden="true" />
            <span class="flex-1">{{ item.label }}</span>
            <span v-if="item.to === '/account/support' && unreadSupportTickets" class="rounded-full bg-blue-600 px-1.5 py-0.5 text-xs text-white" :aria-label="`${unreadSupportTickets} support tickets with new replies`">{{ unreadSupportTickets }}</span>
          </NuxtLink>
        </div>
      </div>
    </div>
  </nav>
  <nav v-else class="mt-3 flex gap-1 overflow-x-auto pb-1 lg:block lg:space-y-0.5 lg:overflow-visible lg:pb-0" aria-label="Customer account">
    <NuxtLink
      v-for="item in items"
      :key="item.to"
      :to="item.to"
      :aria-current="isActive(item) ? 'page' : undefined"
      class="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 lg:flex lg:w-full"
      :class="isActive(item)
        ? 'bg-blue-50 text-blue-800'
        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'"
    >
      <Icon :name="item.icon" size="17" aria-hidden="true" />
      <span>{{ item.label }}</span>
      <span v-if="item.to === '/account/support' && unreadSupportTickets" class="rounded-full bg-blue-600 px-1.5 py-0.5 text-xs text-white" :aria-label="`${unreadSupportTickets} support tickets with new replies`">{{ unreadSupportTickets }}</span>
    </NuxtLink>
  </nav>
</template>
