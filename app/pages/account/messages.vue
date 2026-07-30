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
const replyMessageId = ref('')
const replyDraft = ref('')
const replyLoading = ref(false)
const replyError = ref('')
const replyNotice = reactive({
  messageId: '',
  text: '',
  returnedToProcessing: false
})

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

const isCustomerMessage = (message = {}) => {
  return String(message.sender_type || '').trim().toLowerCase() === 'customer'
}

const canReplyToMessage = (message = {}) => {
  return Boolean(
    message.id
    && message.order_id
    && !isCustomerMessage(message)
    && (
      message.response_requested
      || message.message_kind === 'packing_problem'
    )
    && message.is_awaiting_response
    && !(message.responded_at || message.replied_at)
  )
}

const loadMessages = async ({ silent = false } = {}) => {
  if (!silent) {
    loading.value = true
  }

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
      || error?.data?.message
      || error?.message
      || 'Could not load your messages.'
  } finally {
    if (!silent) {
      loading.value = false
    }
  }
}

const markAsRead = async (message) => {
  if (
    !message?.id
    || message.read_at
    || isCustomerMessage(message)
    || markingMessageId.value
  ) {
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

const openReply = (message) => {
  if (!canReplyToMessage(message)) {
    return
  }

  replyMessageId.value = message.id
  replyDraft.value = ''
  replyError.value = ''
  replyNotice.messageId = ''
  replyNotice.text = ''
  replyNotice.returnedToProcessing = false
}

const closeReply = () => {
  if (replyLoading.value) {
    return
  }

  replyMessageId.value = ''
  replyDraft.value = ''
  replyError.value = ''
}

const submitReply = async (message) => {
  const body = replyDraft.value.trim()

  if (
    !message?.id
    || !canReplyToMessage(message)
    || replyLoading.value
  ) {
    return
  }

  if (!body) {
    replyError.value = 'Write a reply before sending.'
    return
  }

  replyLoading.value = true
  replyError.value = ''
  errorMessage.value = ''

  try {
    const response = await $fetch(
      `/api/account/messages/${encodeURIComponent(message.id)}/reply`,
      {
        method: 'POST',
        body: {
          message: body
        },
        headers: await getAuthHeaders()
      }
    )
    const returnedOrderStatus = String(
      response?.orderStatus
      || response?.order_status
      || response?.item?.order_status
      || response?.reply?.order_status
      || ''
    ).trim().toLowerCase()
    const returnedToProcessing = Boolean(
      response?.orderResumed ?? response?.order_resumed
    )
    const returnedReply = response?.reply && typeof response.reply === 'object'
      ? response.reply
      : response?.item && typeof response.item === 'object'
        ? response.item
        : null

    if (returnedReply?.id) {
      const replyAlreadyExists = messages.value.some((item) => {
        return item.id === returnedReply.id
      })
      const normalizedReply = {
        ...returnedReply,
        sender_type: returnedReply.sender_type || 'customer',
        order_id: returnedReply.order_id || message.order_id,
        order_number: returnedReply.order_number || message.order_number || null,
        order_status: returnedReply.order_status || returnedOrderStatus || null
      }

      messages.value = [
        normalizedReply,
        ...messages.value.filter((item) => item.id !== returnedReply.id)
      ]

      if (!replyAlreadyExists) {
        totalMessages.value += 1
      }
    }

    replyMessageId.value = ''
    replyDraft.value = ''
    replyNotice.messageId = message.id
    replyNotice.returnedToProcessing = returnedToProcessing
    replyNotice.text = returnedToProcessing
      ? 'Reply sent. This order has returned to the processing queue.'
      : 'Your reply was sent to the store team.'

    await loadMessages({
      silent: true
    })
  } catch (error) {
    replyError.value = error?.data?.statusMessage
      || error?.data?.message
      || error?.message
      || 'Could not send your reply.'
  } finally {
    replyLoading.value = false
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
              <div
                v-for="message in messages"
                :key="message.id"
                class="flex"
                :class="isCustomerMessage(message) ? 'justify-end' : 'justify-start'"
              >
                <article
                  class="w-full max-w-3xl rounded-2xl border p-5 transition"
                  :class="isCustomerMessage(message)
                    ? 'border-blue-600 bg-blue-600 text-white sm:ml-12'
                    : message.read_at
                      ? 'border-gray-200 bg-white sm:mr-12'
                      : 'border-blue-200 bg-blue-50/60 sm:mr-12'"
                >
                  <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div class="min-w-0">
                      <div class="flex flex-wrap items-center gap-2">
                        <span
                          v-if="!isCustomerMessage(message) && !message.read_at"
                          class="rounded-full bg-blue-600 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-white"
                        >
                          New
                        </span>
                        <span
                          class="rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide"
                          :class="isCustomerMessage(message)
                            ? 'bg-white/15 text-blue-50'
                            : 'bg-gray-900 text-white'"
                        >
                          {{ isCustomerMessage(message) ? 'Your reply' : 'Store message' }}
                        </span>
                        <span
                          v-if="message.order_number"
                          class="rounded-full px-2.5 py-1 text-xs font-semibold"
                          :class="isCustomerMessage(message)
                            ? 'bg-white/15 text-blue-50'
                            : 'bg-gray-100 text-gray-600'"
                        >
                          {{ message.order_number }}
                        </span>
                      </div>

                      <h2
                        class="mt-3 text-xl font-bold"
                        :class="isCustomerMessage(message) ? 'text-white' : 'text-gray-900'"
                      >
                        {{ message.subject || (isCustomerMessage(message) ? 'Your reply' : 'Order update') }}
                      </h2>
                      <p
                        class="mt-1 text-sm"
                        :class="isCustomerMessage(message) ? 'text-blue-100' : 'text-gray-500'"
                      >
                        <template v-if="isCustomerMessage(message)">
                          Sent by you
                        </template>
                        <template v-else>
                          From {{ message.sender_name || 'ELcomputer Team' }}
                        </template>
                        · {{ formatDate(message.created_at) }}
                      </p>
                    </div>

                    <div
                      v-if="!isCustomerMessage(message)"
                      class="flex shrink-0 flex-wrap gap-2"
                    >
                      <button
                        v-if="!message.read_at"
                        type="button"
                        class="rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                        :disabled="Boolean(markingMessageId)"
                        @click="markAsRead(message)"
                      >
                        {{ markingMessageId === message.id ? 'Saving...' : 'Mark as read' }}
                      </button>

                      <button
                        v-if="canReplyToMessage(message)"
                        type="button"
                        class="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                        :disabled="replyLoading"
                        @click="replyMessageId === message.id ? closeReply() : openReply(message)"
                      >
                        <Icon
                          :name="replyMessageId === message.id ? 'lucide:x' : 'lucide:reply'"
                          size="16"
                        />
                        {{ replyMessageId === message.id ? 'Cancel' : 'Reply' }}
                      </button>
                    </div>
                  </div>

                  <p
                    class="mt-5 whitespace-pre-wrap text-sm leading-7"
                    :class="isCustomerMessage(message) ? 'text-blue-50' : 'text-gray-700'"
                  >
                    {{ message.body }}
                  </p>

                  <p
                    v-if="!isCustomerMessage(message) && message.read_at"
                    class="mt-4 text-xs font-medium text-gray-400"
                  >
                    Read {{ formatDate(message.read_at) }}
                  </p>

                  <div
                    v-if="replyNotice.messageId === message.id"
                    role="status"
                    class="mt-5 flex items-start gap-3 rounded-xl p-4 text-sm font-semibold"
                    :class="replyNotice.returnedToProcessing
                      ? 'bg-green-50 text-green-800'
                      : 'bg-blue-50 text-blue-800'"
                  >
                    <Icon
                      :name="replyNotice.returnedToProcessing
                        ? 'lucide:package-check'
                        : 'lucide:circle-check'"
                      size="19"
                      class="mt-0.5 shrink-0"
                    />
                    <span>{{ replyNotice.text }}</span>
                  </div>

                  <form
                    v-if="replyMessageId === message.id && !isCustomerMessage(message)"
                    class="mt-5 border-t border-gray-200 pt-5"
                    @submit.prevent="submitReply(message)"
                  >
                    <label
                      :for="`message-reply-${message.id}`"
                      class="block text-sm font-bold text-gray-900"
                    >
                      Reply to the store team
                    </label>
                    <p
                      v-if="message.is_awaiting_response"
                      class="mt-2 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-800"
                    >
                      <Icon name="lucide:info" size="18" class="mt-0.5 shrink-0" />
                      <span>
                        This order is on hold. Sending your reply will return it to the processing queue.
                      </span>
                    </p>
                    <textarea
                      :id="`message-reply-${message.id}`"
                      v-model="replyDraft"
                      rows="4"
                      maxlength="2000"
                      :disabled="replyLoading"
                      placeholder="Write your reply about this order..."
                      class="mt-3 w-full rounded-xl border border-gray-300 bg-white p-3 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-100"
                    />
                    <div class="mt-2 flex items-center justify-between gap-3 text-xs text-gray-500">
                      <span>Your reply will be shared with the order-processing team.</span>
                      <span>{{ replyDraft.length }} / 2000</span>
                    </div>
                    <p v-if="replyError" role="alert" class="mt-3 text-sm font-semibold text-red-600">
                      {{ replyError }}
                    </p>
                    <div class="mt-4 flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        class="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
                        :disabled="replyLoading"
                        @click="closeReply"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        class="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        :disabled="replyLoading || !replyDraft.trim()"
                      >
                        <Icon
                          :name="replyLoading ? 'lucide:loader-circle' : 'lucide:send'"
                          size="16"
                          :class="{ 'animate-spin': replyLoading }"
                        />
                        {{ replyLoading ? 'Sending...' : 'Send reply' }}
                      </button>
                    </div>
                  </form>
                </article>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  </div>
</template>
