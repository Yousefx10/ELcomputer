<script setup>
import { chatAuditDescription, chatDateText, chatDateTitle, mergeChatEvents, mergeChatMessages } from '~/utils/liveChat'

definePageMeta({ layout: 'dashboard' })
const route = useRoute()
const client = useSupabaseClient()
const { request, downloadFrom, errorText } = useSupportClient()
const { adminUser, hasPermission, loadAdminAccess } = useAdminAccess()
const views = [
  { key: 'waiting', label: 'Waiting' }, { key: 'mine', label: 'Assigned to me' },
  { key: 'active', label: 'Active' }, { key: 'unassigned', label: 'Unassigned' },
  { key: 'closed', label: 'Closed' }, { key: 'offline', label: 'Offline messages' }
]
const view = ref('waiting')
const filters = reactive({ reference: '', contact: '', customer: '', order: '', agent: '', kind: '', from: '', to: '' })
const applied = ref({})
const page = ref(1)
const queue = ref([])
const queueMore = ref(false)
const waitingCount = ref(0)
const queueLoading = ref(false)
const queueError = ref('')
const agents = ref([])
const selected = ref(null)
const context = ref(null)
const contextLoading = ref(false)
const contextError = ref('')
const orderNumber = ref('')
const selectedOrderId = ref('')
const attachmentPolicy = ref({ enabled: false, allowedMimes: [], maxBytes: 0, maxPerMessage: 0 })
const selectedFiles = shallowRef([])
const fileInput = ref(null)
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
const ticketNotice = ref('')
const ticketSubject = ref('')
const showTicketForm = ref(false)
const ticketConversionEnabled = ref(true)
const transfersEnabled = ref(true)
const reopenEnabled = ref(true)
const busy = ref(false)
const draft = ref('')
const note = ref(false)
const sendKey = ref(null)
const activePane = ref('queue')
const filtersOpen = ref(false)
const contextOpen = ref(false)
const newBelow = ref(false)
const liveAnnouncement = ref('')
const connection = ref('connecting')
const availability = ref('offline')
const availabilityBusy = ref(false)
const typingVisible = ref(false)
const messageList = ref(null)
const inboxHeading = ref(null)
const threadHeading = ref(null)
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
let availabilityTimer = null
let typingTimer = null
let lastTypingAt = 0
let readPending = false

const dateText = value => chatDateText(value)
const statusText = status => ({ waiting: 'Waiting', active: 'Active', closed: 'Closed' })[status] || status
const agentName = id => agents.value.find(agent => agent.id === id)?.name || (id ? 'Agent' : 'Unassigned')
const isMine = computed(() => selected.value?.assigned_admin_id === adminUser.value?.id)
const canReply = computed(() => hasPermission('support.reply') && selected.value?.status === 'active' && isMine.value)
const canClaim = computed(() => hasPermission('support.reply') && selected.value?.status === 'waiting' && !selected.value?.assigned_admin_id)
const canTransfer = computed(() => transfersEnabled.value && hasPermission('support.manage')
  && hasPermission('support.reply') && selected.value?.status === 'active')
const canAssign = computed(() => hasPermission('support.manage') && hasPermission('support.reply') && selected.value?.status === 'waiting' && !selected.value?.assigned_admin_id)
const canClose = computed(() => hasPermission('support.reply') && selected.value?.status !== 'closed' && (isMine.value || hasPermission('support.manage')))
const canReopen = computed(() => reopenEnabled.value && hasPermission('support.manage')
  && hasPermission('support.reply') && selected.value?.status === 'closed')
const canLinkOrder = computed(() => hasPermission('support.reply') && selected.value?.customer_id
  && !selected.value.ticket_id && selected.value.status !== 'closed'
  && (isMine.value || hasPermission('support.manage')))
const canCreateTicket = computed(() => hasPermission('support.reply') && selected.value
  && ticketConversionEnabled.value && !selected.value.ticket_id
  && (isMine.value || hasPermission('support.manage')))
const orderChoices = computed(() => [...new Map([
  ...(context.value?.orderMatches || []), ...(context.value?.openOrders || []),
  ...(context.value?.recentOrders || []), ...(context.value?.relatedOrder ? [context.value.relatedOrder] : [])
].map(order => [order.id, order])).values()])
const attachmentAccept = computed(() => attachmentPolicy.value.allowedMimes.join(','))
const attachmentSizeText = computed(() => attachmentPolicy.value.maxBytes >= 1048576
  ? `${Number((attachmentPolicy.value.maxBytes / 1048576).toFixed(1))} MB`
  : `${Math.max(1, Math.floor(attachmentPolicy.value.maxBytes / 1024))} KB`)
const unreadOnPage = computed(() => queue.value.reduce((total, item) => total + Number(item.unreadCount || 0), 0))
const lastSequence = () => messages.value.at(-1)?.sequence_number
const scrollBottom = async () => {
  await nextTick()
  if (messageList.value) messageList.value.scrollTop = messageList.value.scrollHeight
  newBelow.value = false
  markVisibleRead()
}
const threadVisible = () => document.visibilityState === 'visible'
  && (window.matchMedia('(min-width: 1024px)').matches || activePane.value === 'thread')
const atBottom = () => !messageList.value || messageList.value.scrollHeight
  - messageList.value.scrollTop - messageList.value.clientHeight < 100
const markVisibleRead = async () => {
  if (!selected.value || !threadVisible() || !atBottom() || readPending) return
  const incoming = [...messages.value].reverse().find(message => ['customer', 'guest'].includes(message.sender_kind))
  if (!incoming || Number(incoming.sequence_number) <= Number(selected.value.lastReadSequence || 0)) return
  const id = selected.value.id
  readPending = true
  let saved = false
  try {
    const result = await request(`/api/admin-chat/conversations/${id}/read`, {
      method: 'POST', body: { sequence: Number(incoming.sequence_number) }
    })
    if (selected.value?.id === id) {
      selected.value = { ...selected.value, ...result }
      queue.value = queue.value.map(item => item.id === id ? { ...item, ...result } : item)
    }
    saved = true
  } catch { /* A later reconcile can retry without hiding messages. */ }
  finally { readPending = false; if (saved || selected.value?.id !== id) setTimeout(markVisibleRead, 0) }
}
const showCustomerTyping = payload => {
  if (payload?.kind !== 'customer' || payload.conversationId !== selected.value?.id) return
  typingVisible.value = true
  if (typingTimer) clearTimeout(typingTimer)
  typingTimer = setTimeout(() => { typingVisible.value = false; typingTimer = null }, 6000)
}
const sendTyping = async () => {
  if (!canReply.value || note.value || !draft.value.trim() || !threadChannel
    || Date.now() - lastTypingAt < 4000) return
  lastTypingAt = Date.now()
  try { await request(`/api/admin-chat/conversations/${selected.value.id}/typing`, { method: 'POST', body: {} }) }
  catch { /* Typing is optional; messages remain durable. */ }
}
const setAvailability = async state => {
  if (availabilityBusy.value || !hasPermission('support.reply')) return
  availabilityBusy.value = true
  try {
    const result = await request('/api/admin-chat/availability', { method: 'POST', body: { state } })
    availability.value = result.state
    actionError.value = ''
  } catch (cause) { actionError.value = errorText(cause, 'Could not update availability.') }
  finally { availabilityBusy.value = false }
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
    waitingCount.value = result.waitingCount || 0
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
    ticketConversionEnabled.value = result.workflow?.ticketConversionEnabled === true
    transfersEnabled.value = result.workflow?.transfersEnabled === true
    reopenEnabled.value = result.workflow?.reopenEnabled === true
    if (!showTicketForm.value) ticketSubject.value = `Live chat #${result.item.reference_number}`
    attachmentPolicy.value = result.attachmentPolicy || attachmentPolicy.value
    selectedOrderId.value = result.item.order_id || ''
    messages.value = result.messages.items || []
    older.value = result.messages.hasMore === true
    await scrollBottom()
    await loadActivity(id)
    await loadContext(id)
  } catch (cause) {
    if (run === detailRequest && mounted) detailError.value = errorText(cause, 'Could not load the conversation.')
  } finally {
    if (run === detailRequest) detailLoading.value = false
  }
}
const loadContext = async (id, number = '') => {
  contextLoading.value = true
  contextError.value = ''
  try {
    const result = await request(`/api/admin-chat/conversations/${id}/context`, {
      query: number ? { number } : {}
    })
    if (selected.value?.id === id) {
      context.value = result
      if (number && !result.orderMatches?.length) contextError.value = 'No order found for this customer.'
    }
  } catch (cause) {
    if (selected.value?.id === id) contextError.value = errorText(cause, 'Could not load customer context.')
  } finally { contextLoading.value = false }
}
const searchOrder = () => {
  if (!selected.value) return
  const number = orderNumber.value.trim()
  if (number && !/^[A-Za-z0-9-]{1,64}$/.test(number)) {
    contextError.value = 'Enter a valid order number.'
    return
  }
  loadContext(selected.value.id, number)
}
const setOrder = async (orderId) => {
  if (!selected.value || !canLinkOrder.value || busy.value) return
  const id = selected.value.id
  busy.value = true
  actionError.value = ''
  try {
    const result = await request(`/api/admin-chat/conversations/${id}/order`, {
      method: 'POST', body: { orderId, expectedRevision: selected.value.revision }
    })
    if (selected.value?.id === id) {
      selected.value = result.item
      selectedOrderId.value = result.item.order_id || ''
      await Promise.all([loadContext(id), loadActivity(id), refreshQueue()])
    }
  } catch (cause) {
    if (selected.value?.id === id) actionError.value = errorText(cause, 'Could not link order.')
    if (selected.value?.id === id && (cause?.statusCode === 409 || cause?.status === 409)) {
      await Promise.all([loadThread(id), refreshQueue()])
    }
  } finally { busy.value = false }
}
const createTicket = async () => {
  if (!selected.value || !canCreateTicket.value || busy.value) return
  const subject = ticketSubject.value.trim()
  if (!subject || subject.length > 160) {
    actionError.value = 'Enter a ticket subject up to 160 characters.'
    return
  }
  const id = selected.value.id
  busy.value = true
  actionError.value = ''
  ticketNotice.value = ''
  try {
    const result = await request(`/api/admin-chat/conversations/${id}/ticket`, {
      method: 'POST', body: { subject, expectedRevision: selected.value.revision }
    })
    if (selected.value?.id === id) {
      selected.value = result.item
      showTicketForm.value = false
      ticketNotice.value = `Ticket #${result.ticket.reference_number} created.`
      await Promise.all([loadActivity(id), loadContext(id), refreshQueue()])
    }
  } catch (cause) {
    if (selected.value?.id === id) actionError.value = errorText(cause, 'Could not create support ticket.')
    if (selected.value?.id === id && (cause?.statusCode === 409 || cause?.status === 409)) {
      await Promise.all([loadThread(id), refreshQueue()])
    }
  } finally { busy.value = false }
}
const reconcileThread = async () => {
  if (!selected.value || syncing) { syncAgain = true; return }
  syncing = true
  const id = selected.value.id
  const previousLast = lastSequence()
  const previousRevision = selected.value.revision
  const nearBottom = !messageList.value || messageList.value.scrollHeight - messageList.value.scrollTop - messageList.value.clientHeight < 100
  const knownMessages = new Set(messages.value.map(message => message.id))
  let incomingCount = 0
  try {
    const result = await request(`/api/admin-chat/conversations/${id}`)
    if (!mounted || selected.value?.id !== id) return
    selected.value = result.item
    ticketConversionEnabled.value = result.workflow?.ticketConversionEnabled === true
    transfersEnabled.value = result.workflow?.transfersEnabled === true
    reopenEnabled.value = result.workflow?.reopenEnabled === true
    attachmentPolicy.value = result.attachmentPolicy || attachmentPolicy.value
    if (result.item.revision !== previousRevision) {
      selectedOrderId.value = result.item.order_id || ''
      loadContext(id)
    }
    let pages = 0
    let after = previousLast
    let more = Boolean(after)
    while (more && pages < 20 && selected.value?.id === id) {
      const delta = await request(`/api/admin-chat/conversations/${id}/messages`, { query: { after } })
      if (!mounted || selected.value?.id !== id) return
      incomingCount += (delta.items || []).filter(message => !knownMessages.has(message.id)
        && ['customer', 'guest'].includes(message.sender_kind)).length
      for (const message of delta.items || []) knownMessages.add(message.id)
      messages.value = mergeChatMessages(messages.value, delta.items || [])
      pages++
      after = delta.after
      more = Boolean(delta.hasMore && delta.items?.length)
    }
    if (!more) messages.value = mergeChatMessages(messages.value, result.messages.items || [])
    else syncAgain = true
    await loadActivity(id)
    detailError.value = ''
    if (incomingCount) {
      liveAnnouncement.value = ''
      await nextTick()
      liveAnnouncement.value = incomingCount === 1
        ? 'New customer message.' : `${incomingCount} new customer messages.`
      if (!nearBottom) newBelow.value = true
    }
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
  typingVisible.value = false
  if (typingTimer) clearTimeout(typingTimer)
  typingTimer = null
}
const subscribeThread = async (id) => {
  await removeThreadChannel()
  if (!mounted || selected.value?.id !== id) return
  threadChannel = client.channel(`chat:staff:${id}`, { config: { private: true } })
    .on('broadcast', { event: 'changed' }, () => scheduleThread())
    .on('broadcast', { event: 'typing' }, ({ payload }) => showCustomerTyping(payload))
    .subscribe(state => {
      if (state === 'SUBSCRIBED') { connection.value = 'connected'; scheduleThread() }
      if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') connection.value = 'reconnecting'
    })
}
const selectThread = async (item) => {
  detailRequest++
  await removeThreadChannel()
  selected.value = item
  context.value = null
  contextError.value = ''
  orderNumber.value = ''
  selectedOrderId.value = item.order_id || ''
  messages.value = []
  events.value = []
  activityMore.value = false
  activityCursor.value = null
  activityError.value = ''
  draft.value = ''
  note.value = false
  sendKey.value = null
  selectedFiles.value = []
  if (fileInput.value) fileInput.value.value = ''
  assignTarget.value = ''
  transferTarget.value = ''
  actionError.value = ''
  ticketNotice.value = ''
  showTicketForm.value = false
  ticketSubject.value = `Live chat #${item.reference_number || ''}`.trim()
  contextOpen.value = false
  newBelow.value = false
  activePane.value = 'thread'
  await loadThread(item.id)
  if (selected.value?.id === item.id) await subscribeThread(item.id)
  await nextTick()
  threadHeading.value?.focus()
}

const showInbox = async () => {
  activePane.value = 'queue'
  await nextTick()
  inboxHeading.value?.focus()
}

const onPageKeydown = event => {
  if (event.key === 'Escape' && activePane.value === 'thread'
    && window.matchMedia('(max-width: 1023px)').matches) showInbox()
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
const chooseFiles = event => {
  const files = [...(event.target.files || [])]
  const policy = attachmentPolicy.value
  if (files.length > policy.maxPerMessage) {
    actionError.value = `Choose up to ${policy.maxPerMessage} files.`
    event.target.value = ''; selectedFiles.value = []; return
  }
  if (files.some(file => file.size < 1 || file.size > policy.maxBytes
    || !policy.allowedMimes.includes(file.type))) {
    actionError.value = 'Choose a permitted file within the size limit.'
    event.target.value = ''; selectedFiles.value = []; return
  }
  selectedFiles.value = files.map(file => ({ id: crypto.randomUUID(), file }))
  actionError.value = ''
}
const clearFiles = () => {
  selectedFiles.value = []
  if (fileInput.value) fileInput.value.value = ''
}
const uploadSelectedFiles = async (conversationId, messageId) => {
  const items = []
  let failed = false
  for (const selectedFile of selectedFiles.value) {
    const form = new FormData()
    form.append('messageId', messageId)
    form.append('attachmentId', selectedFile.id)
    form.append('file', selectedFile.file)
    try {
      const result = await request(`/api/admin-chat/conversations/${conversationId}/attachments`, {
        method: 'POST', body: form
      })
      items.push(result.item)
    } catch { failed = true }
  }
  clearFiles()
  return { items, failed }
}
const downloadFile = async file => {
  try {
    await downloadFrom(`/api/admin-chat/attachments/${encodeURIComponent(file.id)}`, file.original_name)
  } catch (cause) { actionError.value = errorText(cause, 'Could not download file.') }
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
      if (draft.value.trim() === body) { draft.value = ''; sendKey.value = null }
      const uploaded = selectedFiles.value.length
        ? await uploadSelectedFiles(id, result.item.id) : { items: [], failed: false }
      if (selected.value?.id !== id) return
      messages.value = mergeChatMessages(messages.value,
        [{ ...result.item, attachments: uploaded.items }])
      if (uploaded.failed) actionError.value = 'Message sent. Some attachments could not be uploaded.'
      await scrollBottom()
      scheduleThread()
      scheduleQueue()
    }
  } catch (cause) { actionError.value = errorText(cause, 'Could not send the message.') }
  finally { busy.value = false }
}
const applyFilters = () => { applied.value = Object.fromEntries(Object.entries(filters).filter(([, value]) => value)); page.value = 1; refreshQueue() }
const clearFilters = () => { Object.keys(filters).forEach(key => { filters[key] = '' }); applied.value = {}; page.value = 1; refreshQueue() }
const refreshOnReturn = () => { if (document.visibilityState === 'visible') { scheduleQueue(); if (selected.value) scheduleThread(); if (availability.value === 'online') setAvailability('online') } }
const reconnectOnNetwork = () => { scheduleQueue(); if (selected.value) scheduleThread() }
watch([draft, note], () => { sendKey.value = null; sendTyping() })
watch(activePane, () => { if (activePane.value === 'thread') markVisibleRead() })
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
  const linkedConversation = typeof route.query.conversation === 'string' ? route.query.conversation : ''
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(linkedConversation)) {
    await selectThread({ id: linkedConversation })
  }
  if (hasPermission('support.reply')) {
    try {
      const result = await request('/api/admin-chat/availability')
      availability.value = result.state
    } catch { /* Stay offline until the staff member chooses a state. */ }
    availabilityTimer = setInterval(() => {
      if (availability.value === 'online' && document.visibilityState === 'visible') setAvailability('online')
    }, 45000)
  }
  document.addEventListener('visibilitychange', refreshOnReturn)
  window.addEventListener('online', reconnectOnNetwork)
  window.addEventListener('keydown', onPageKeydown)
})
onBeforeUnmount(() => {
  mounted = false
  if (queueTimer) clearTimeout(queueTimer)
  if (threadTimer) clearTimeout(threadTimer)
  if (typingTimer) clearTimeout(typingTimer)
  if (availabilityTimer) clearInterval(availabilityTimer)
  authSubscription?.unsubscribe()
  if (inboxChannel) client.removeChannel(inboxChannel)
  if (threadChannel) client.removeChannel(threadChannel)
  document.removeEventListener('visibilitychange', refreshOnReturn)
  window.removeEventListener('online', reconnectOnNetwork)
  window.removeEventListener('keydown', onPageKeydown)
})
</script>

<template>
  <div class="live-chat-shell mx-auto max-w-[1700px] space-y-4 pb-8">
    <span class="sr-only" aria-live="polite" aria-atomic="true">{{ liveAnnouncement }}</span>
    <DashboardPageIntro title="Live Chat" description="Manage customer conversations and offline messages." />
    <div class="flex flex-wrap items-center justify-between gap-3 text-sm">
      <NuxtLink to="/dashboard/support" class="font-semibold text-blue-700 hover:underline">← Support tickets</NuxtLink>
      <div class="flex items-center gap-3">
        <label v-if="hasPermission('support.reply')" class="text-xs font-semibold text-gray-600">Agent status
          <select :value="availability" :disabled="availabilityBusy" class="ml-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs" @change="setAvailability($event.target.value)">
            <option value="offline">Offline</option><option value="online">Online</option><option value="away">Away</option>
          </select>
        </label>
        <span class="text-gray-500" role="status">Updates: {{ connection === 'connected' ? 'live' : connection === 'reconnecting' ? 'reconnecting' : 'connecting' }}</span>
      </div>
    </div>
    <div class="grid min-h-[calc(100dvh-12rem)] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm lg:min-h-[640px] lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)_290px]">
      <section :class="activePane === 'thread' ? 'hidden lg:flex' : 'flex'" class="min-w-0 flex-col border-r border-gray-200" aria-label="Chat inbox">
        <div class="border-b border-gray-100 p-4">
          <div class="flex items-center justify-between gap-2">
            <h2 ref="inboxHeading" tabindex="-1" class="font-bold text-gray-900">Inbox <span v-if="unreadOnPage" class="ml-1 rounded-full bg-blue-600 px-2 py-0.5 text-xs text-white">{{ unreadOnPage }} unread on page</span></h2>
            <button type="button" class="rounded-lg px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50"
              :aria-expanded="filtersOpen" aria-controls="live-chat-filters" @click="filtersOpen = !filtersOpen">
              {{ filtersOpen ? 'Hide filters' : 'Filters' }}
            </button>
          </div>
          <div class="mt-3 flex flex-wrap gap-1" role="group" aria-label="Inbox view">
            <button v-for="option in views" :key="option.key" type="button" class="rounded-lg px-2.5 py-1.5 text-xs font-semibold" :class="view === option.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-blue-50'" :aria-pressed="view === option.key" @click="view = option.key; page = 1">{{ option.label }}<span v-if="option.key === 'waiting' && waitingCount" class="ml-1 rounded-full bg-white px-1.5 py-0.5 text-blue-700">{{ waitingCount }}</span></button>
          </div>
          <form v-show="filtersOpen" id="live-chat-filters" class="mt-4 grid grid-cols-2 gap-2" @submit.prevent="applyFilters">
            <label class="text-xs text-gray-600">Reference<input v-model="filters.reference" placeholder="#123" class="mt-1 w-full rounded-lg border border-gray-200 p-2 text-sm" /></label>
            <label class="text-xs text-gray-600">Contact<input v-model="filters.contact" placeholder="Name, email, phone" class="mt-1 w-full rounded-lg border border-gray-200 p-2 text-sm" /></label>
            <label class="text-xs text-gray-600">Agent<select v-model="filters.agent" class="mt-1 w-full rounded-lg border border-gray-200 p-2 text-sm"><option value="">Any</option><option value="unassigned">Unassigned</option><option v-for="agent in agents" :key="agent.id" :value="agent.id">{{ agent.name }}</option></select></label>
            <label class="text-xs text-gray-600">Customer<select v-model="filters.kind" class="mt-1 w-full rounded-lg border border-gray-200 p-2 text-sm"><option value="">All</option><option value="customer">Account</option><option value="guest">Guest</option></select></label>
            <label class="col-span-2 text-xs text-gray-600">Customer ID<input v-model="filters.customer" placeholder="Account UUID" class="mt-1 w-full rounded-lg border border-gray-200 p-2 text-sm" /></label>
            <label class="col-span-2 text-xs text-gray-600">Order<input v-model="filters.order" placeholder="Order number or UUID" class="mt-1 w-full rounded-lg border border-gray-200 p-2 text-sm" /></label>
            <label class="text-xs text-gray-600">From<input v-model="filters.from" type="date" class="mt-1 w-full rounded-lg border border-gray-200 p-2 text-sm" /></label>
            <label class="text-xs text-gray-600">To<input v-model="filters.to" type="date" class="mt-1 w-full rounded-lg border border-gray-200 p-2 text-sm" /></label>
            <div class="col-span-2 flex gap-2"><button type="submit" class="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white">Filter</button><button type="button" class="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold" @click="clearFilters">Clear</button></div>
          </form>
        </div>
        <p v-if="queueError" class="m-3 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{{ queueError }}</p>
        <p v-if="queueLoading && !queue.length" class="p-5 text-sm text-gray-500" role="status">Loading conversations...</p>
        <div v-else class="max-h-[700px] min-h-0 flex-1 overflow-y-auto divide-y divide-gray-100" :aria-busy="queueLoading">
          <button v-for="item in queue" :key="item.id" type="button" class="block w-full p-4 text-left hover:bg-blue-50" :class="selected?.id === item.id ? 'bg-blue-50' : ''" :aria-current="selected?.id === item.id ? 'true' : undefined" @click="selectThread(item)">
            <span class="flex items-start justify-between gap-2"><strong class="truncate text-sm text-gray-900">{{ item.contact_name }}</strong><span class="shrink-0 text-xs text-gray-500">#{{ item.reference_number }}</span></span>
            <span class="mt-1 block truncate text-xs text-gray-500">{{ item.contact_email || item.contact_mobile || (item.customer_id ? 'Account customer' : 'Guest') }}</span>
            <span class="mt-2 flex items-center justify-between gap-2 text-xs"><span class="rounded-full bg-gray-100 px-2 py-1 text-gray-700">{{ statusText(item.status) }} · {{ item.intake_mode === 'offline' ? 'Offline' : agentName(item.assigned_admin_id) }}</span><time class="text-gray-500" :datetime="item.last_activity_at" :title="chatDateTitle(item.last_activity_at)">{{ dateText(item.last_activity_at) }}</time></span>
            <span v-if="item.unreadCount" class="mt-2 inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800">{{ item.unreadCount }} new {{ item.unreadCount === 1 ? 'message' : 'messages' }}</span>
          </button>
          <p v-if="!queue.length && !queueLoading" class="p-6 text-center text-sm text-gray-500">No conversations match this view.</p>
        </div>
        <div class="flex items-center justify-between border-t border-gray-100 p-3 text-xs"><button type="button" :disabled="page <= 1" class="font-semibold text-blue-700 disabled:opacity-40" @click="page--">Previous</button><span>Page {{ page }}</span><button type="button" :disabled="!queueMore" class="font-semibold text-blue-700 disabled:opacity-40" @click="page++">Next</button></div>
      </section>

      <section :class="activePane === 'queue' ? 'hidden lg:flex' : 'flex'" class="min-w-0 flex-col" aria-label="Conversation">
        <div v-if="selected" class="flex flex-wrap items-center gap-2 border-b border-gray-100 p-4">
          <button type="button" class="mr-1 min-h-11 text-sm font-semibold text-blue-700 lg:hidden" @click="showInbox">← Inbox</button>
          <div class="min-w-0 flex-1"><h2 ref="threadHeading" tabindex="-1" class="truncate font-bold text-gray-900">{{ selected.contact_name }} <span class="text-sm font-normal text-gray-500">#{{ selected.reference_number }}</span></h2><p class="text-xs text-gray-500">{{ statusText(selected.status) }} · {{ agentName(selected.assigned_admin_id) }}</p></div>
          <button type="button" class="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold xl:hidden" :aria-expanded="contextOpen" aria-controls="live-chat-context" @click="contextOpen = !contextOpen">{{ contextOpen ? 'Hide details' : 'Details' }}</button>
          <button v-if="canClaim" type="button" :disabled="busy" class="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50" @click="transition('claim')">Claim</button>
          <button v-if="canClose" type="button" :disabled="busy" class="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold disabled:opacity-50" @click="transition('close')">Close</button>
          <button v-if="canReopen" type="button" :disabled="busy" class="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold disabled:opacity-50" @click="transition('reopen')">Reopen</button>
        </div>
        <div v-if="selected && canAssign" class="flex gap-2 border-b border-gray-100 px-4 py-2"><select v-model="assignTarget" aria-label="Assign to agent" class="min-w-0 flex-1 rounded-lg border border-gray-200 px-2 py-1 text-xs"><option value="">Assign to agent...</option><option v-for="agent in agents" :key="agent.id" :value="agent.id">{{ agent.name }}</option></select><button type="button" :disabled="!assignTarget || busy" class="text-xs font-semibold text-blue-700 disabled:opacity-40" @click="assign">Assign</button></div>
        <div v-if="selected && canTransfer" class="flex gap-2 border-b border-gray-100 px-4 py-2"><select v-model="transferTarget" aria-label="Transfer to agent" class="min-w-0 flex-1 rounded-lg border border-gray-200 px-2 py-1 text-xs"><option value="">Transfer to agent...</option><option v-for="agent in agents.filter(agent => agent.id !== selected.assigned_admin_id)" :key="agent.id" :value="agent.id">{{ agent.name }}</option></select><button type="button" :disabled="!transferTarget || busy" class="text-xs font-semibold text-blue-700 disabled:opacity-40" @click="transfer">Transfer</button></div>
        <p v-if="detailError || actionError" class="m-3 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{{ actionError || detailError }}</p>
        <template v-if="selected">
          <div ref="messageList" class="min-h-0 flex-1 space-y-3 overflow-y-auto bg-gray-50 p-4" role="log"
            aria-label="Conversation messages" aria-live="polite" aria-relevant="additions" :aria-busy="detailLoading" @scroll.passive="markVisibleRead">
            <button v-if="older" type="button" :disabled="detailLoading" class="mx-auto block text-xs font-semibold text-blue-700 disabled:opacity-50" @click="loadOlder">Load older messages</button>
            <p v-if="detailLoading && !messages.length" class="text-center text-sm text-gray-500" role="status">Loading messages...</p>
            <p v-else-if="!messages.length" class="text-center text-sm text-gray-500">No messages yet.</p>
            <article v-for="message in messages" :key="message.id" class="flex"
              :aria-label="`${message.sender_name || (message.sender_kind === 'staff' ? 'Agent' : 'Customer')}, ${dateText(message.created_at)}${message.is_internal ? ', internal note' : ''}`"
              :class="message.sender_kind === 'staff' ? 'justify-end' : 'justify-start'">
              <div class="max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm" :class="message.is_internal ? 'border border-amber-200 bg-amber-50 text-amber-950' : message.sender_kind === 'staff' ? 'bg-blue-600 text-white' : 'border border-gray-200 bg-white text-gray-900'">
                <p class="mb-1 text-xs font-bold opacity-80">{{ message.is_internal ? 'Internal note · ' : '' }}{{ message.sender_name || (message.sender_kind === 'staff' ? 'Agent' : 'Customer') }}</p>
                <p class="whitespace-pre-wrap break-words">{{ message.body }}</p>
                <div v-if="message.attachments?.length" class="mt-2 flex flex-wrap gap-1"><button v-for="file in message.attachments" :key="file.id" type="button" class="inline-flex max-w-full items-center gap-1 rounded-lg border border-current/20 bg-white/90 px-2 py-1 text-left text-[11px] font-semibold text-blue-800" @click="downloadFile(file)"><Icon name="lucide:paperclip" size="13" aria-hidden="true" /><span class="break-all">{{ file.original_name }}</span></button></div>
                <time class="mt-2 block text-[11px] opacity-70" :datetime="message.created_at" :title="chatDateTitle(message.created_at)">{{ dateText(message.created_at) }}</time>
              </div>
            </article>
          </div>
          <button v-if="newBelow" type="button" class="mx-auto -mt-12 mb-2 rounded-full border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-blue-700 shadow-md" @click="scrollBottom">New messages ↓</button>
          <p v-if="typingVisible" class="bg-gray-50 px-4 py-1 text-xs text-gray-500" role="status">Customer is typing…</p>
          <form v-if="canReply" class="border-t border-gray-100 p-4" @submit.prevent="send"><label class="block text-xs font-semibold text-gray-600">{{ note ? `Internal note for chat #${selected.reference_number}` : `Reply to ${selected.contact_name} in chat #${selected.reference_number}` }}<textarea v-model="draft" maxlength="10000" rows="3" class="mt-1 w-full resize-y rounded-xl border border-gray-200 p-3 text-sm" :class="note ? 'bg-amber-50' : ''" placeholder="Write a message" /></label><label v-if="attachmentPolicy.enabled" class="mt-2 block text-xs font-semibold text-gray-600">Attachments<input ref="fileInput" type="file" multiple :accept="attachmentAccept" :disabled="busy" class="mt-1 block w-full text-xs" @change="chooseFiles" /><span class="mt-1 block font-normal text-gray-500">Up to {{ attachmentPolicy.maxPerMessage }} files, {{ attachmentSizeText }} each.</span></label><div v-if="selectedFiles.length" class="mt-1 flex justify-between text-xs text-gray-500"><span>{{ selectedFiles.length }} selected</span><button type="button" :disabled="busy" class="font-semibold text-blue-700" @click="clearFiles">Clear</button></div><div class="mt-2 flex items-center justify-between gap-2"><label class="flex items-center gap-2 text-xs text-gray-600"><input v-model="note" type="checkbox" /> Internal note</label><button type="submit" :disabled="busy || !draft.trim()" class="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{{ busy ? 'Sending...' : note ? 'Save note' : 'Send reply' }}</button></div></form>
          <p v-else class="border-t border-gray-100 p-4 text-center text-xs text-gray-500">{{ selected.status === 'closed' ? 'This conversation is closed.' : selected.status === 'waiting' ? 'Claim this conversation to reply.' : 'Only the assigned agent can reply.' }}</p>
        </template>
        <div v-else class="flex flex-1 items-center justify-center p-8 text-sm text-gray-500">Choose a conversation from the inbox.</div>
      </section>

      <aside v-if="selected" id="live-chat-context"
        :class="activePane === 'queue' ? 'hidden xl:block' : contextOpen ? 'block lg:col-start-2 xl:col-start-auto' : 'hidden xl:block'"
        class="border-t border-gray-200 p-4 text-sm lg:border-l xl:row-start-1 xl:border-t-0" aria-label="Customer context">
        <h2 class="font-bold text-gray-900">Customer context</h2>
        <dl class="mt-4 space-y-3 break-words text-xs"><div><dt class="font-semibold text-gray-500">Type</dt><dd>{{ selected.customer_id ? 'Account customer' : 'Guest' }}</dd></div><div v-if="selected.customer_id"><dt class="font-semibold text-gray-500">Account ID</dt><dd>{{ selected.customer_id }}</dd></div><div v-if="context?.profile"><dt class="font-semibold text-gray-500">Account status</dt><dd>{{ context.profile.is_active ? 'Active' : 'Inactive' }}</dd></div><div v-if="context?.profile"><dt class="font-semibold text-gray-500">Account name</dt><dd>{{ context.profile.full_name || 'Not provided' }}</dd></div><div v-if="context?.profile"><dt class="font-semibold text-gray-500">Account email</dt><dd>{{ context.profile.email || 'Not provided' }}</dd></div><div v-if="context?.profile"><dt class="font-semibold text-gray-500">Account mobile</dt><dd>{{ context.profile.phone || 'Not provided' }}</dd></div><div><dt class="font-semibold text-gray-500">Chat name</dt><dd>{{ selected.contact_name }}</dd></div><div><dt class="font-semibold text-gray-500">Chat email</dt><dd>{{ selected.contact_email || 'Not provided' }}</dd></div><div><dt class="font-semibold text-gray-500">Chat mobile</dt><dd>{{ selected.contact_mobile || 'Not provided' }}</dd></div><div><dt class="font-semibold text-gray-500">Intake</dt><dd>{{ selected.intake_mode === 'offline' ? 'Offline message' : 'Live request' }}</dd></div><div><dt class="font-semibold text-gray-500">Created</dt><dd>{{ dateText(selected.created_at) }}</dd></div></dl>
        <p v-if="contextLoading" class="mt-3 text-xs text-gray-500" role="status">Loading context…</p>
        <p v-if="contextError" class="mt-3 text-xs text-red-700" role="alert">{{ contextError }}</p>
        <section class="mt-5 border-t border-gray-100 pt-4" aria-label="Support ticket">
          <h3 class="text-xs font-bold text-gray-900">Support ticket</h3>
          <p v-if="ticketNotice" class="mt-2 text-xs text-green-700" role="status">{{ ticketNotice }}</p>
          <NuxtLink v-if="selected.ticket_id" :to="`/dashboard/support/${selected.ticket_id}`" class="mt-2 inline-flex text-xs font-semibold text-blue-700 hover:underline">Open support ticket →</NuxtLink>
          <template v-else-if="canCreateTicket">
            <button v-if="!showTicketForm" type="button" class="mt-2 text-xs font-semibold text-blue-700" @click="showTicketForm = true; ticketSubject = `Live chat #${selected.reference_number}`">Create support ticket</button>
            <form v-else class="mt-3 space-y-2" @submit.prevent="createTicket">
              <label class="block text-xs text-gray-600">Subject<input v-model="ticketSubject" required maxlength="160" class="mt-1 w-full rounded-lg border border-gray-200 p-2" /></label>
              <p class="text-[11px] text-gray-500">Transcript and files stay linked to this chat.</p>
              <div class="flex gap-3"><button type="submit" :disabled="busy" class="text-xs font-semibold text-blue-700 disabled:opacity-40">{{ busy ? 'Creating…' : 'Create ticket' }}</button><button type="button" :disabled="busy" class="text-xs font-semibold text-gray-600" @click="showTicketForm = false">Cancel</button></div>
            </form>
          </template>
          <p v-else class="mt-2 text-xs text-gray-500">{{ ticketConversionEnabled ? 'Claim this conversation to create a ticket.' : 'Ticket conversion is disabled.' }}</p>
        </section>
        <section class="mt-5 border-t border-gray-100 pt-4" aria-label="Related order">
          <h3 class="text-xs font-bold text-gray-900">Related order</h3>
          <p class="mt-2 text-xs text-gray-600">{{ context?.relatedOrder ? `#${context.relatedOrder.order_number || context.relatedOrder.id.slice(0, 8)} · ${context.relatedOrder.status}` : selected.order_id ? `Saved order ID: ${selected.order_id}` : 'None linked' }}</p>
          <p v-if="context?.relatedOrder" class="mt-1 text-xs text-gray-600">Payment: {{ context.relatedOrder.payment_status }} · Total: {{ context.relatedOrder.total_amount }} {{ context.relatedOrder.currency }}</p>
          <ul v-if="context?.relatedItems?.length" class="mt-2 space-y-1 text-xs text-gray-600"><li v-for="item in context.relatedItems" :key="item.id">{{ item.quantity }} × {{ item.product_title }}</li></ul>
          <form v-if="canLinkOrder" class="mt-3 space-y-2" @submit.prevent="setOrder(selectedOrderId || null)">
            <label class="block text-xs text-gray-600">Find order number<input v-model="orderNumber" maxlength="64" class="mt-1 w-full rounded-lg border border-gray-200 p-2" placeholder="Order number" /></label>
            <button type="button" class="text-xs font-semibold text-blue-700" @click="searchOrder">Find order</button>
            <label class="block text-xs text-gray-600">Customer orders<select v-model="selectedOrderId" class="mt-1 w-full rounded-lg border border-gray-200 p-2"><option value="">Choose an order</option><option v-for="order in orderChoices" :key="order.id" :value="order.id">#{{ order.order_number || order.id.slice(0, 8) }} · {{ order.status }}</option></select></label>
            <div class="flex gap-3"><button type="submit" :disabled="busy || !selectedOrderId || selectedOrderId === selected.order_id" class="text-xs font-semibold text-blue-700 disabled:opacity-40">Link order</button><button v-if="selected.order_id" type="button" :disabled="busy" class="text-xs font-semibold text-red-700 disabled:opacity-40" @click="setOrder(null)">Unlink</button></div>
          </form>
        </section>
        <section v-if="selected.customer_id" class="mt-5 border-t border-gray-100 pt-4" aria-label="Customer orders">
          <h3 class="text-xs font-bold text-gray-900">Open orders</h3><p v-if="!context?.openOrders?.length" class="mt-2 text-xs text-gray-500">None found.</p><ul v-else class="mt-2 space-y-1 text-xs"><li v-for="order in context.openOrders" :key="order.id">#{{ order.order_number || order.id.slice(0, 8) }} · {{ order.status }}</li></ul>
          <h3 class="mt-4 text-xs font-bold text-gray-900">Recent orders</h3><p v-if="!context?.recentOrders?.length" class="mt-2 text-xs text-gray-500">None found.</p><ul v-else class="mt-2 space-y-1 text-xs"><li v-for="order in context.recentOrders" :key="order.id">#{{ order.order_number || order.id.slice(0, 8) }} · {{ order.status }}</li></ul>
          <h3 class="mt-4 text-xs font-bold text-gray-900">Support tickets</h3><p v-if="!context?.tickets?.length" class="mt-2 text-xs text-gray-500">None found.</p><ul v-else class="mt-2 space-y-1 text-xs"><li v-for="ticket in context.tickets" :key="ticket.id"><NuxtLink :to="`/dashboard/support/${ticket.id}`" class="text-blue-700 hover:underline">#{{ ticket.reference_number }} · {{ ticket.subject }}</NuxtLink> · {{ ticket.status }}</li></ul>
        </section>
        <section class="mt-5 border-t border-gray-100 pt-4" aria-label="Previous chats"><h3 class="text-xs font-bold text-gray-900">Previous chats</h3><p v-if="!context?.previousChats?.length" class="mt-2 text-xs text-gray-500">None found.</p><ul v-else class="mt-2 space-y-1 text-xs"><li v-for="chat in context.previousChats" :key="chat.id"><button type="button" class="text-left text-blue-700 hover:underline" @click="selectThread(chat)">#{{ chat.reference_number }} · {{ chat.status }}</button></li></ul></section>
        <h3 class="mt-6 font-bold text-gray-900">Activity</h3>
        <p v-if="activityError" class="mt-2 text-xs text-red-700" role="alert">{{ activityError }}</p>
        <ol class="mt-3 space-y-3 text-xs"><li v-for="entry in events" :key="entry.id" class="border-l-2 border-blue-200 pl-3"><span class="font-semibold text-gray-900">{{ chatAuditDescription(entry) }}</span><time class="block text-gray-500">{{ dateText(entry.created_at) }}</time></li><li v-if="!events.length && !activityLoading" class="text-gray-500">No activity loaded.</li></ol>
        <button v-if="activityMore" type="button" :disabled="activityLoading" class="mt-3 text-xs font-semibold text-blue-700 disabled:opacity-40" @click="loadActivity(selected.id, activityCursor)">Load older activity</button>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.live-chat-shell :is(button,a,input,select,textarea):focus-visible,
.live-chat-shell [tabindex="-1"]:focus-visible{outline:3px solid #f0b429;outline-offset:2px}
.live-chat-shell [role="log"]{overscroll-behavior:contain;scrollbar-gutter:stable}
@media(prefers-reduced-motion:reduce){.live-chat-shell *{scroll-behavior:auto!important}}
</style>
