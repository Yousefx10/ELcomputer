<script setup>
definePageMeta({
  middleware: 'customer-auth'
})

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const loading = ref(true)
const errorMessage = ref('')
const messages = ref([])
const totalMessages = ref(0)
const unreadCount = ref(0)
const markingMessageId = ref('')

const displayName = computed(() => {
  return user.value?.user_metadata?.full_name
    || user.value?.user_metadata?.name
    || user.value?.email?.split('@')[0]
    || 'Customer'
})

const userEmail = computed(() => user.value?.email || '')

const getAuthHeaders = async () => {
  const { data } = await supabase.auth.getSession()

  if (!data.session?.access_token) {
    throw new Error('Your session expired. Please log in again.')
  }

  return {
    authorization: `Bearer ${data.session.access_token}`
  }
}

const loadMessages = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await $fetch('/api/account/messages', {
      query: {
        page: 1,
        pageSize: 100
      },
      headers: await getAuthHeaders()
    })

    messages.value = response.items || []
    totalMessages.value = response.total || 0
    unreadCount.value = response.unreadCount || 0
  } catch (error) {
    errorMessage.value = error?.data?.statusMessage
      || error?.message
      || 'Could not load your messages.'
  } finally {
    loading.value = false
  }
}

const markAsRead = async (message) => {
  if (!message?.id || message.read_at || markingMessageId.value) {
    return
  }

  markingMessageId.value = message.id
  errorMessage.value = ''

  try {
    const response = await $fetch(`/api/account/messages/${message.id}/read`, {
      method: 'PATCH',
      headers: await getAuthHeaders()
    })
    const updatedMessage = response.item

    messages.value = messages.value.map((item) => {
      return item.id === updatedMessage.id
        ? {
            ...item,
            ...updatedMessage
          }
        : item
    })
    unreadCount.value = Math.max(0, unreadCount.value - 1)
  } catch (error) {
    errorMessage.value = error?.data?.statusMessage
      || error?.message
      || 'Could not mark this message as read.'
  } finally {
    markingMessageId.value = ''
  }
}

const logout = async () => {
  await supabase.auth.signOut()
  await navigateTo('/')
}

const formatDate = (value) => {
  if (!value) {
    return 'Recently'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Recently'
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date)
}

onMounted(loadMessages)
</script>

<template>
  <div class="min-h-screen bg-gray-100 py-8">
    <div class="mx-auto max-w-7xl px-4 md:px-6">
      <div class="mb-6 rounded-3xl bg-white p-6 shadow">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p class="text-sm font-semibold text-blue-600">Customer Account</p>
            <h1 class="mt-1 text-3xl font-bold text-gray-900">Messages</h1>
            <p class="mt-2 text-sm text-gray-500">
              Order updates and notes sent by the store team.
            </p>
          </div>

          <button
            type="button"
            class="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
            :disabled="loading"
            @click="loadMessages"
          >
            <Icon name="lucide:refresh-cw" size="17" :class="{ 'animate-spin': loading }" />
            Refresh
          </button>
        </div>
      </div>

      <div
        v-if="errorMessage"
        role="alert"
        class="mb-6 rounded-2xl bg-red-50 p-4 text-red-600 shadow"
      >
        {{ errorMessage }}
      </div>

      <div class="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside class="h-fit overflow-hidden rounded-3xl bg-white shadow">
          <div class="bg-blue-600 px-6 py-7 text-white">
            <div class="flex h-16 w-16 items-center justify-center rounded-full border-2 border-white/30 bg-white/10">
              <Icon name="lucide:user-round" size="32" />
            </div>
            <p class="mt-4 text-xl font-bold">{{ displayName }}</p>
            <p class="mt-1 break-all text-sm text-blue-100">{{ userEmail }}</p>
          </div>

          <div class="p-5">
            <p class="px-3 text-xs font-bold uppercase tracking-[0.2em] text-gray-400">
              Account
            </p>

            <AccountNavigation />

            <button
              type="button"
              class="mt-6 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left font-semibold text-red-600 transition hover:bg-red-50"
              @click="logout"
            >
              <Icon name="lucide:log-out" size="18" />
              <span>Log Out</span>
            </button>
          </div>
        </aside>

        <main class="space-y-6">
          <section class="grid gap-4 sm:grid-cols-2">
            <div class="rounded-2xl bg-white p-5 shadow">
              <p class="text-sm font-semibold text-gray-500">All Messages</p>
              <p class="mt-2 text-3xl font-bold text-gray-900">{{ totalMessages }}</p>
            </div>

            <div class="rounded-2xl bg-white p-5 shadow">
              <p class="text-sm font-semibold text-gray-500">Unread</p>
              <p class="mt-2 text-3xl font-bold text-blue-600">{{ unreadCount }}</p>
            </div>
          </section>

          <section class="rounded-3xl bg-white p-6 shadow">
            <div v-if="loading" class="py-16 text-center text-gray-500" role="status">
              Loading messages...
            </div>

            <div v-else-if="!messages.length" class="py-16 text-center">
              <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                <Icon name="lucide:mail-open" size="28" />
              </div>
              <h2 class="mt-4 text-xl font-bold text-gray-900">No messages yet</h2>
              <p class="mt-2 text-sm text-gray-500">
                Messages about your orders will appear here.
              </p>
            </div>

            <div v-else class="space-y-4">
              <article
                v-for="message in messages"
                :key="message.id"
                class="rounded-2xl border p-5 transition"
                :class="message.read_at
                  ? 'border-gray-200 bg-white'
                  : 'border-blue-200 bg-blue-50/60'"
              >
                <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                      <span
                        v-if="!message.read_at"
                        class="rounded-full bg-blue-600 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-white"
                      >
                        New
                      </span>
                      <span
                        v-if="message.order_number"
                        class="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600"
                      >
                        {{ message.order_number }}
                      </span>
                    </div>

                    <h2 class="mt-3 text-xl font-bold text-gray-900">
                      {{ message.subject || 'Order update' }}
                    </h2>
                    <p class="mt-1 text-sm text-gray-500">
                      From {{ message.sender_name || 'ELcomputer Team' }}
                      · {{ formatDate(message.created_at) }}
                    </p>
                  </div>

                  <button
                    v-if="!message.read_at"
                    type="button"
                    class="shrink-0 rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                    :disabled="Boolean(markingMessageId)"
                    @click="markAsRead(message)"
                  >
                    {{ markingMessageId === message.id ? 'Saving...' : 'Mark as read' }}
                  </button>
                </div>

                <p class="mt-5 whitespace-pre-wrap text-sm leading-7 text-gray-700">
                  {{ message.body }}
                </p>

                <p v-if="message.read_at" class="mt-4 text-xs font-medium text-gray-400">
                  Read {{ formatDate(message.read_at) }}
                </p>
              </article>
            </div>
          </section>
        </main>
      </div>
    </div>
  </div>
</template>
