<script setup>
import { chatAuditDescription, mergeChatEvents, mergeChatMessages } from '~/utils/liveChat'

definePageMeta({ layout: 'dashboard' })
const client = useSupabaseClient()
const { request, errorText } = useSupportClient()
const { adminUser, hasPermission, loadAdminAccess } = useAdminAccess()
const views = [
  { key: 'waiting', label: 'Waiting' }, { key: 'mine', label: 'Assigned to me' },
  { key: 'active', label: 'Active' }, { key: 'unassigned', label: 'Unassigned' },
  { key: 'closed', label: 'Closed' }, { key: 'offline', label: 'Offline messages' }
]
const view = ref('waiting')
const filters = reactive({ reference: '', contact: '', order: '', agent: '', kind: '', from: '', to: '' })
const applied = ref({})
const page = ref(1)
const queue = ref([])
const queueMore = ref(false)
const queueLoading = ref(false)
const queueError = ref('')
const agents = ref([])
const selected = ref(null)
const messages = ref([])
const events = ref([])
const activityMore = ref(false)
const activityCursor = ref(null)
const activityLoading = ref(false)
const activityError = ref('')
const older = ref(false)
const detailLoading = ref(false)
const detailError = ref('')
const actionError = ref('')
const busy = ref(false)
const draft = ref('')
const note = ref(false)
const sendKey = ref(null)
const activePane = ref('queue')
const connection = ref('connecting')
const messageList = ref(null)
let inboxChannel = null
let threadChannel = null
let authSubscription = null
let queueTimer = null
let threadTimer = null
let queueRequest = 0
let detailRequest = 0
let syncing = false
let syncAgain = false
let mounted = false

const dateText = value => value ? new Date(value).toLocaleString() : '—'
const statusText = status => ({ waiting: 'Waiting', active: 'Active', closed: 'Closed' })[status] || status
const agentName = id => agents.value.find(agent => agent.id === id)?.name || (id ? 'Agent' : 'Unassigned')
const isMine = computed(() => selected.value?.assigned_admin_id === adminUser.value?.id)
const canReply = computed(() => hasPermission('support.reply') && selected.value?.status === 'active' && isMine.value)
const canClaim = computed(() => hasPermission('support.reply') && selected.value?.status === 'waiting' && !selected.value?.assigned_admin_id)
const canTransfer = computed(() => hasPermission('support.manage') && hasPermission('support.reply') && selected.value?.status === 'active')
const canAssign = computed(() => hasPermission('support.manage') && hasPermission('support.reply') && selected.value?.status === 'waiting' && !selected.value?.assigned_admin_id)
const canClose = computed(() => hasPermission('support.reply') && selected.value?.status !== 'closed' && (isMine.value || hasPermission('support.manage')))
const canReopen = computed(() => hasPermission('support.manage') && hasPermission('support.reply') && selected.value?.status === 'closed')
const lastSequence = () => messages.value.at(-1)?.sequence_number
const scrollBottom = async () => {
  await nextTick()
  if (messageList.value) messageList.value.scrollTop = messageList.value.scrollHeight
}
const refreshQueue = async () => {
  const run = ++queueRequest
  queueLoading.value = true
  queueError.value = ''
  try {
    const result = await request('/api/admin-chat/conversations', { query: { view: view.value, ...applied.value, page: page.value } })
    if (run !== queueRequest || !mounted) return
    queue.value = result.items || []
    queueMore.value = result.hasMore === true
    if (selected.value) {
      const fresh = queue.value.find(item => item.id === selected.value.id)
      if (fresh && fresh.revision > selected.value.revision) scheduleThread()
    }
  } catch (cause) {
    if (run === queueRequest && mounted) queueError.value = errorText(cause, 'Could not load the inbox.')
  } finally {
    if (run === queueRequest) queueLoading.value = false
  }
}
const scheduleQueue = () => {
  if (queueTimer) return
  queueTimer = setTimeout(() => { queueTimer = null; refreshQueue() }, 250)
}
const loadActivity = async (id, before = null) => {
  activityLoading.value = true
  activityError.value = ''
  try {
    const result = await request(`/api/admin-chat/conversations/${id}/events`, { query: before ? { before } : {} })
    if (selected.value?.id !== id) return
    const hadEvents = events.value.length > 0
    events.value = mergeChatEvents(events.value, result.items || [])
    if (before || !hadEvents) {
      activityMore.value = result.hasMore === true
      activityCursor.value = result.before
    }
  } catch (cause) {
    if (selected.value?.id === id) activityError.value = errorText(cause, 'Could not load activity.')
  } finally { activityLoading.value = false }
}
const loadThread = async (id) => {
  const run = ++detailRequest
  detailLoading.value = true
  detailError.value = ''
  try {
    const result = await request(`/api/admin-chat/conversations/${id}`)
    if (run !== detailRequest || !mounted) return
    selected.value = result.item
    messages.value = result.messages.items || []
    older.value = result.messages.hasMore === true
    await scrollBottom()
    await loadActivity(id)
  } catch (cause) {
    if (run === detailRequest && mounted) detailError.value = errorText(cause, 'Could not load the conversation.')
  } finally {
    if (run === detailRequest) detailLoading.value = false
  }
}
const reconcileThread = async () => {
  if (!selected.value || syncing) { syncAgain = true; return }
  syncing = true
  const id = selected.value.id
  const previousLast = lastSequence()
  const nearBottom = !messageList.value || messageList.value.scrollHeight - messageList.value.scrollTop - messageList.value.clientHeight < 100
  try {
    const result = await request(`/api/admin-chat/conversations/${id}`)
    if (!mounted || selected.value?.id !== id) return
    selected.value = result.item
    let pages = 0
    let after = previousLast
    let more = Boolean(after)
    while (more && pages < 20 && selected.value?.id === id) {
      const delta = await request(`/api/admin-chat/conversations/${id}/messages`, { query: { after } })
      if (!mounted || selected.value?.id !== id) return
      messages.value = mergeChatMessages(messages.value, delta.items || [])
      pages++
      after = delta.after
      more = Boolean(delta.hasMore && delta.items?.length)
    }
    if (!more) messages.value = mergeChatMessages(messages.value, result.messages.items || [])
    else syncAgain = true
    await loadActivity(id)
    detailError.value = ''
    if (nearBottom) await scrollBottom()
  } catch (cause) {
    if (selected.value?.id === id) detailError.value = errorText(cause, 'Could not refresh the conversation.')
  } finally {
    syncing = false
    if (syncAgain) { syncAgain = false; scheduleThread() }
  }
}
const scheduleThread = () => {
  if (threadTimer) return
  threadTimer = setTimeout(() => { threadTimer = null; reconcileThread() }, 150)
}
const removeThreadChannel = async () => {
  if (threadTimer) clearTimeout(threadTimer)
  threadTimer = null
  const old = threadChannel
  threadChannel = null
  if (old) await client.removeChannel(old)
}
const subscribeThread = async (id) => {
  await removeThreadChannel()
  if (!mounted || selected.value?.id !== id) return
  threadChannel = client.channel(`chat:staff:${id}`, { config: { private: true } })
    .on('broadcast', { event: 'changed' }, () => scheduleThread())
    .subscribe(state => {
      if (state === 'SUBSCRIBED') scheduleThread()
      if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') connection.value = 'reconnecting'
    })
}
const selectThread = async (item) => {
  detailRequest++
  await removeThreadChannel()
  selected.value = item
  messages.value = []
  events.value = []
  activityMore.value = false
  activityCursor.value = null
  activityError.value = ''
  draft.value = ''
  note.value = false
  sendKey.value = null
  assignTarget.value = ''
  transferTarget.value = ''
  actionError.value = ''
  activePane.value = 'thread'
  await loadThread(item.id)
  if (selected.value?.id === item.id) await subscribeThread(item.id)
}
const loadOlder = async () => {
  if (!selected.value || !older.value || detailLoading.value) return
  const id = selected.value.id
  const before = messages.value[0]?.sequence_number
  detailLoading.value = true
  try {
    const result = await request(`/api/admin-chat/conversations/${id}/messages`, { query: { before } })
    if (selected.value?.id === id) {
      messages.value = mergeChatMessages(result.items || [], messages.value)
      older.value = result.hasMore === true
    }
  } catch (cause) { detailError.value = errorText(cause, 'Could not load older messages.') }
  finally { detailLoading.value = false }
}
const transition = async (action, targetId = null) => {
  if (!selected.value || busy.value) return
  const id = selected.value.id
  busy.value = true
  actionError.value = ''
  try {
    const result = await request(`/api/admin-chat/conversations/${id}/transition`, {
      method: 'POST', body: { action, targetId, expectedRevision: selected.value.revision }
    })
    if (selected.value?.id === id) selected.value = result.item
    await refreshQueue()
    if (selected.value?.id === id) await loadActivity(id)
  } catch (cause) {
    if (selected.value?.id === id) actionError.value = errorText(cause, 'Could not change the conversation.')
    if (selected.value?.id === id && (cause?.statusCode === 409 || cause?.status === 409)) {
      await Promise.all([loadThread(id), refreshQueue()])
    }
  } finally { busy.value = false }
}
const transferTarget = ref('')
const assignTarget = ref('')
const assign = async () => {
  if (!assignTarget.value) return
  await transition('assign', assignTarget.value)
  assignTarget.value = ''
}
const transfer = async () => {
  if (!transferTarget.value || transferTarget.value === selected.value?.assigned_admin_id) return
  await transition('transfer', transferTarget.value)
  transferTarget.value = ''
}
const send = async () => {
  if (!canReply.value || busy.value || !draft.value.trim()) return
  const id = selected.value.id
  const body = draft.value.trim()
  if (!sendKey.value) sendKey.value = crypto.randomUUID()
  busy.value = true
  actionError.value = ''
  try {
    const result = await request(`/api/admin-chat/conversations/${id}/messages`, {
      method: 'POST', body: { body, isInternal: note.value, idempotencyKey: sendKey.value }
    })
    if (selected.value?.id === id) {
      messages.value = mergeChatMessages(messages.value, [result.item])
      if (draft.value.trim() === body) { draft.value = ''; sendKey.value = null }
      await scrollBottom()
      scheduleThread()
      scheduleQueue()
    }
  } catch (cause) { actionError.value = errorText(cause, 'Could not send the message.') }
  finally { busy.value = false }
}
const applyFilters = () => { applied.value = Object.fromEntries(Object.entries(filters).filter(([, value]) => value)); page.value = 1; refreshQueue() }
const clearFilters = () => { Object.keys(filters).forEach(key => { filters[key] = '' }); applied.value = {}; page.value = 1; refreshQueue() }
const refreshOnReturn = () => { if (document.visibilityState === 'visible') { scheduleQueue(); if (selected.value) scheduleThread() } }
const reconnectOnNetwork = () => { scheduleQueue(); if (selected.value) scheduleThread() }
watch([draft, note], () => { sendKey.value = null })
watch([view, page], () => { if (view.value) refreshQueue() })
onMounted(async () => {
  mounted = true
  await loadAdminAccess()
  const { data } = await client.auth.getSession()
  if (data.session?.access_token) {
    await client.realtime.setAuth(data.session.access_token)
    authSubscription = client.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) client.realtime.setAuth(session.access_token)
    }).data.subscription
    inboxChannel = client.channel('chat:inbox', { config: { private: true } })
      .on('broadcast', { event: 'changed' }, () => scheduleQueue())
      .subscribe(state => {
        if (state === 'SUBSCRIBED') { connection.value = 'connected'; scheduleQueue(); if (selected.value) scheduleThread() }
        if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') connection.value = 'reconnecting'
      })
  }
  await refreshQueue()
  try {
    const result = await request('/api/admin-support/assignees')
    agents.value = result.items || []
  } catch { /* Agent IDs remain visible if the directory is unavailable. */ }
  document.addEventListener('visibilitychange', refreshOnReturn)
  window.addEventListener('online', reconnectOnNetwork)
})
onBeforeUnmount(() => {
  mounted = false
  if (queueTimer) clearTimeout(queueTimer)
  if (threadTimer) clearTimeout(threadTimer)
  authSubscription?.unsubscribe()
  if (inboxChannel) client.removeChannel(inboxChannel)
  if (threadChannel) client.removeChannel(threadChannel)
  document.removeEventListener('visibilitychange', refreshOnReturn)
  window.removeEventListener('online', reconnectOnNetwork)
})
</script>

<template>
  <div class="mx-auto max-w-[1700px] space-y-4 pb-8">
    <DashboardPageIntro title="Live Chat" description="Manage customer conversations and offline messages." />
    <div class="flex flex-wrap items-center justify-between gap-3 text-sm">
      <NuxtLink to="/dashboard/support" class="font-semibold text-blue-700 hover:underline">← Support tickets</NuxtLink>
      <span class="text-gray-500" role="status">Updates: {{ connection === 'connected' ? 'live' : connection === 'reconnecting' ? 'reconnecting' : 'connecting' }}</span>
    </div>
    <div class="grid min-h-[640px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm lg:grid-cols-[320px_minmax(0,1fr)_260px] xl:grid-cols-[360px_minmax(0,1fr)_290px]">
      <section :class="activePane === 'thread' ? 'hidden lg:flex' : 'flex'" class="min-w-0 flex-col border-r border-gray-200" aria-label="Chat inbox">
        <div class="border-b border-gray-100 p-4">
          <h2 class="font-bold text-gray-900">Inbox</h2>
          <div class="mt-3 flex flex-wrap gap-1" role="group" aria-label="Inbox view">
            <button v-for="option in views" :key="option.key" type="button" class="rounded-lg px-2.5 py-1.5 text-xs font-semibold" :class="view === option.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-blue-50'" :aria-pressed="view === option.key" @click="view = option.key; page = 1">{{ option.label }}</button>
          </div>
          <form class="mt-4 grid grid-cols-2 gap-2" @submit.prevent="applyFilters">
            <label class="text-xs text-gray-600">Reference<input v-model="filters.reference" placeholder="#123" class="mt-1 w-full rounded-lg border border-gray-200 p-2 text-sm" /></label>
            <label class="text-xs text-gray-600">Contact<input v-model="filters.contact" placeholder="Name, email, phone" class="mt-1 w-full rounded-lg border border-gray-200 p-2 text-sm" /></label>
            <label class="text-xs text-gray-600">Agent<select v-model="filters.agent" class="mt-1 w-full rounded-lg border border-gray-200 p-2 text-sm"><option value="">Any</option><option value="unassigned">Unassigned</option><option v-for="agent in agents" :key="agent.id" :value="agent.id">{{ agent.name }}</option></select></label>
            <label class="text-xs text-gray-600">Customer<select v-model="filters.kind" class="mt-1 w-full rounded-lg border border-gray-200 p-2 text-sm"><option value="">All</option><option value="customer">Account</option><option value="guest">Guest</option></select></label>
            <label class="col-span-2 text-xs text-gray-600">Order ID<input v-model="filters.order" placeholder="Order UUID" class="mt-1 w-full rounded-lg border border-gray-200 p-2 text-sm" /></label>
            <label class="text-xs text-gray-600">From<input v-model="filters.from" type="date" class="mt-1 w-full rounded-lg border border-gray-200 p-2 text-sm" /></label>
            <label class="text-xs text-gray-600">To<input v-model="filters.to" type="date" class="mt-1 w-full rounded-lg border border-gray-200 p-2 text-sm" /></label>
            <div class="col-span-2 flex gap-2"><button type="submit" class="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white">Filter</button><button type="button" class="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold" @click="clearFilters">Clear</button></div>
          </form>
        </div>
        <p v-if="queueError" class="m-3 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{{ queueError }}</p>
        <p v-if="queueLoading && !queue.length" class="p-5 text-sm text-gray-500">Loading conversations...</p>
        <div v-else class="max-h-[700px] min-h-0 flex-1 overflow-y-auto divide-y divide-gray-100">
          <button v-for="item in queue" :key="item.id" type="button" class="block w-full p-4 text-left hover:bg-blue-50" :class="selected?.id === item.id ? 'bg-blue-50' : ''" @click="selectThread(item)">
            <span class="flex items-start justify-between gap-2"><strong class="truncate text-sm text-gray-900">{{ item.contact_name }}</strong><span class="shrink-0 text-xs text-gray-500">#{{ item.reference_number }}</span></span>
            <span class="mt-1 block truncate text-xs text-gray-500">{{ item.contact_email || item.contact_mobile || (item.customer_id ? 'Account customer' : 'Guest') }}</span>
            <span class="mt-2 flex items-center justify-between gap-2 text-xs"><span class="rounded-full bg-gray-100 px-2 py-1 text-gray-700">{{ statusText(item.status) }} · {{ item.intake_mode === 'offline' ? 'Offline' : agentName(item.assigned_admin_id) }}</span><time class="text-gray-500">{{ dateText(item.last_activity_at) }}</time></span>
          </button>
          <p v-if="!queue.length && !queueLoading" class="p-6 text-center text-sm text-gray-500">No conversations match this view.</p>
        </div>
        <div class="flex items-center justify-between border-t border-gray-100 p-3 text-xs"><button type="button" :disabled="page <= 1" class="font-semibold text-blue-700 disabled:opacity-40" @click="page--">Previous</button><span>Page {{ page }}</span><button type="button" :disabled="!queueMore" class="font-semibold text-blue-700 disabled:opacity-40" @click="page++">Next</button></div>
      </section>

      <section :class="activePane === 'queue' ? 'hidden lg:flex' : 'flex'" class="min-w-0 flex-col" aria-label="Conversation">
        <div v-if="selected" class="flex flex-wrap items-center gap-2 border-b border-gray-100 p-4">
          <button type="button" class="mr-1 text-sm font-semibold text-blue-700 lg:hidden" @click="activePane = 'queue'">← Inbox</button>
          <div class="min-w-0 flex-1"><h2 class="truncate font-bold text-gray-900">{{ selected.contact_name }} <span class="text-sm font-normal text-gray-500">#{{ selected.reference_number }}</span></h2><p class="text-xs text-gray-500">{{ statusText(selected.status) }} · {{ agentName(selected.assigned_admin_id) }}</p></div>
          <button v-if="canClaim" type="button" :disabled="busy" class="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50" @click="transition('claim')">Claim</button>
          <button v-if="canClose" type="button" :disabled="busy" class="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold disabled:opacity-50" @click="transition('close')">Close</button>
          <button v-if="canReopen" type="button" :disabled="busy" class="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold disabled:opacity-50" @click="transition('reopen')">Reopen</button>
        </div>
        <div v-if="selected && canAssign" class="flex gap-2 border-b border-gray-100 px-4 py-2"><select v-model="assignTarget" aria-label="Assign to agent" class="min-w-0 flex-1 rounded-lg border border-gray-200 px-2 py-1 text-xs"><option value="">Assign to agent...</option><option v-for="agent in agents" :key="agent.id" :value="agent.id">{{ agent.name }}</option></select><button type="button" :disabled="!assignTarget || busy" class="text-xs font-semibold text-blue-700 disabled:opacity-40" @click="assign">Assign</button></div>
        <div v-if="selected && canTransfer" class="flex gap-2 border-b border-gray-100 px-4 py-2"><select v-model="transferTarget" aria-label="Transfer to agent" class="min-w-0 flex-1 rounded-lg border border-gray-200 px-2 py-1 text-xs"><option value="">Transfer to agent...</option><option v-for="agent in agents.filter(agent => agent.id !== selected.assigned_admin_id)" :key="agent.id" :value="agent.id">{{ agent.name }}</option></select><button type="button" :disabled="!transferTarget || busy" class="text-xs font-semibold text-blue-700 disabled:opacity-40" @click="transfer">Transfer</button></div>
        <p v-if="detailError || actionError" class="m-3 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{{ actionError || detailError }}</p>
        <template v-if="selected">
          <div ref="messageList" class="min-h-0 flex-1 space-y-3 overflow-y-auto bg-gray-50 p-4" aria-label="Messages">
            <button v-if="older" type="button" :disabled="detailLoading" class="mx-auto block text-xs font-semibold text-blue-700 disabled:opacity-50" @click="loadOlder">Load older messages</button>
            <p v-if="detailLoading && !messages.length" class="text-center text-sm text-gray-500">Loading messages...</p>
            <div v-for="message in messages" :key="message.id" class="flex" :class="message.sender_kind === 'staff' ? 'justify-end' : 'justify-start'">
              <div class="max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm" :class="message.is_internal ? 'border border-amber-200 bg-amber-50 text-amber-950' : message.sender_kind === 'staff' ? 'bg-blue-600 text-white' : 'border border-gray-200 bg-white text-gray-900'">
                <p class="mb-1 text-xs font-bold opacity-80">{{ message.is_internal ? 'Internal note · ' : '' }}{{ message.sender_name || (message.sender_kind === 'staff' ? 'Agent' : 'Customer') }}</p>
                <p class="whitespace-pre-wrap break-words">{{ message.body }}</p><time class="mt-2 block text-[11px] opacity-70">{{ dateText(message.created_at) }}</time>
              </div>
            </div>
          </div>
          <form v-if="canReply" class="border-t border-gray-100 p-4" @submit.prevent="send"><label class="block text-xs font-semibold text-gray-600">{{ note ? 'Internal note — staff only' : 'Reply to customer' }}<textarea v-model="draft" maxlength="10000" rows="3" class="mt-1 w-full resize-y rounded-xl border border-gray-200 p-3 text-sm" :class="note ? 'bg-amber-50' : ''" placeholder="Write a message" /></label><div class="mt-2 flex items-center justify-between gap-2"><label class="flex items-center gap-2 text-xs text-gray-600"><input v-model="note" type="checkbox" /> Internal note</label><button type="submit" :disabled="busy || !draft.trim()" class="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{{ busy ? 'Sending...' : note ? 'Save note' : 'Send reply' }}</button></div></form>
          <p v-else class="border-t border-gray-100 p-4 text-center text-xs text-gray-500">{{ selected.status === 'closed' ? 'This conversation is closed.' : selected.status === 'waiting' ? 'Claim this conversation to reply.' : 'Only the assigned agent can reply.' }}</p>
        </template>
        <div v-else class="flex flex-1 items-center justify-center p-8 text-sm text-gray-500">Choose a conversation from the inbox.</div>
      </section>

      <aside v-if="selected" :class="activePane === 'queue' ? 'hidden lg:block' : 'block'" class="border-t border-gray-200 p-4 text-sm lg:border-l lg:border-t-0" aria-label="Customer context">
        <h2 class="font-bold text-gray-900">Customer context</h2>
        <dl class="mt-4 space-y-3 break-words text-xs"><div><dt class="font-semibold text-gray-500">Type</dt><dd>{{ selected.customer_id ? 'Account customer' : 'Guest' }}</dd></div><div><dt class="font-semibold text-gray-500">Name</dt><dd>{{ selected.contact_name }}</dd></div><div><dt class="font-semibold text-gray-500">Email</dt><dd>{{ selected.contact_email || 'Not provided' }}</dd></div><div><dt class="font-semibold text-gray-500">Mobile</dt><dd>{{ selected.contact_mobile || 'Not provided' }}</dd></div><div><dt class="font-semibold text-gray-500">Intake</dt><dd>{{ selected.intake_mode === 'offline' ? 'Offline message' : 'Live request' }}</dd></div><div><dt class="font-semibold text-gray-500">Order ID</dt><dd>{{ selected.order_id || 'None linked' }}</dd></div><div><dt class="font-semibold text-gray-500">Created</dt><dd>{{ dateText(selected.created_at) }}</dd></div></dl>
        <h3 class="mt-6 font-bold text-gray-900">Activity</h3>
        <p v-if="activityError" class="mt-2 text-xs text-red-700" role="alert">{{ activityError }}</p>
        <ol class="mt-3 space-y-3 text-xs"><li v-for="entry in events" :key="entry.id" class="border-l-2 border-blue-200 pl-3"><span class="font-semibold text-gray-900">{{ chatAuditDescription(entry) }}</span><time class="block text-gray-500">{{ dateText(entry.created_at) }}</time></li><li v-if="!events.length && !activityLoading" class="text-gray-500">No activity loaded.</li></ol>
        <button v-if="activityMore" type="button" :disabled="activityLoading" class="mt-3 text-xs font-semibold text-blue-700 disabled:opacity-40" @click="loadActivity(selected.id, activityCursor)">Load older activity</button>
      </aside>
    </div>
  </div>
</template>
