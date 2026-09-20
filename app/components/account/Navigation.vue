<script setup>
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

const isActive = item => item.exact
  ? route.path === item.to
  : route.path === item.to || route.path.startsWith(`${item.to}/`)
</script>

<template>
  <nav class="mt-3 flex gap-1 overflow-x-auto pb-1 lg:block lg:space-y-0.5 lg:overflow-visible lg:pb-0" aria-label="Customer account">
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
