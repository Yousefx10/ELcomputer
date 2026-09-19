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
    key: 'profile',
    label: 'My Profile',
    icon: 'lucide:user-round',
    to: '/account'
  },
  {
    key: 'orders',
    label: 'Orders',
    icon: 'lucide:file-text',
    to: {
      path: '/account',
      hash: '#orders'
    }
  },
  {
    key: 'messages',
    label: 'Messages',
    icon: 'lucide:mail',
    to: '/account/messages'
  },
  {
    key: 'support',
    label: 'Support',
    icon: 'lucide:life-buoy',
    to: '/account/support'
  },
  {
    key: 'wallet',
    label: 'Wallet',
    icon: 'lucide:wallet',
    to: {
      path: '/account',
      hash: '#wallet'
    }
  }
]

const isActive = (item) => {
  if (item.key === 'messages') {
    return route.path === '/account/messages'
  }

  if (item.key === 'support') return route.path.startsWith('/account/support')

  if (route.path !== '/account') {
    return false
  }

  if (item.key === 'profile') {
    return !route.hash || route.hash === '#profile'
  }

  return route.hash === item.to?.hash
}
</script>

<template>
  <nav class="mt-4 space-y-2" aria-label="Customer account">
    <NuxtLink
      v-for="item in items"
      :key="item.key"
      :to="item.to"
      class="flex items-center gap-3 rounded-2xl px-4 py-3 transition"
      :class="isActive(item)
        ? 'bg-blue-50 text-blue-700'
        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'"
    >
      <Icon :name="item.icon" size="18" />
      <span class="font-semibold">{{ item.label }}</span>
      <span v-if="item.key === 'support' && unreadSupportTickets" class="ms-auto rounded-full bg-blue-600 px-2 py-0.5 text-xs font-bold text-white" :aria-label="`${unreadSupportTickets} support tickets with new replies`">{{ unreadSupportTickets }}</span>
    </NuxtLink>
  </nav>
</template>
