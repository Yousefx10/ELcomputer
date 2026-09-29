<script setup>
const { intlLocale } = useUiLocale()
const chatDateText = (value, options = {}) => baseChatDateText(value, { ...options, locale: intlLocale.value })
const chatDateTitle = (value, options = {}) => baseChatDateTitle(value, { ...options, locale: intlLocale.value })

const { uiNavigateTo } = useUiNavigation()

import { chatContactValid, chatDateText as baseChatDateText, chatDateTitle as baseChatDateTitle, chatMobileValid, chatRetryAfterSeconds, chatSecondsRemaining, chatSendWaitText, mergeChatMessages } from '~/utils/liveChat'

const route = useUiRoute()
const mainUser = useSupabaseUser()
const { getGuestClient, resolveActor, hasStoredGuestSession, ensureGuestSession, request,
  uploadAttachment, downloadAttachment } = useLiveChatClient()

const status = ref({ enabled: false, available: false })
const panelOpen = ref(false)
const mobilePanel = ref(false)
const loading = ref(false)
const sending = ref(false)
const loadingOlder = ref(false)
const screen = ref('start')
const errorText = ref('')
const actor = shallowRef(null)
const conversations = ref([])
const conversation = ref(null)
const messages = ref([])
const hasOlder = ref(false)
const draft = ref('')
const guestName = ref('')
const guestEmail = ref('')
const guestMobile = ref('')
const accountContact = ref(null)
const orders = ref([])
const orderNumber = ref('')
const selectedOrderId = ref('')
const orderBusy = ref(false)
const orderToolsOpen = ref(false)
const feedbackResolved = ref(null)
const feedbackRating = ref(0)
const feedbackBusy = ref(false)
const feedbackTicketReference = ref(null)
const callbackOpen = ref(false)
const callbackMobile = ref('')
const callbackBusy = ref(false)
const guestToLink = ref(null)
const conversationAttachmentPolicy = ref(null)
const selectedFiles = shallowRef([])
const fileInput = ref(null)
const staffTyping = ref(false)
const newBelow = ref(false)
const lastOwnSentAt = ref(null)
const retryAfterUntil = ref(0)
const clock = ref(Date.now())
const connectionState = ref('idle')
const liveAnnouncement = ref('')
const launcher = ref(null)
const panel = ref(null)
const closeButton = ref(null)
const messageList = ref(null)
const composer = ref(null)
const visible = computed(() => status.value.enabled && !route.path.startsWith('/checkout'))
const isGuest = computed(() => actor.value?.kind !== 'customer')
const cooldown = computed(() => Math.max(
  chatSecondsRemaining(lastOwnSentAt.value, status.value.cooldownSeconds, clock.value),
  Math.max(0, Math.ceil((retryAfterUntil.value - clock.value) / 1000))
))
const sendWaitText = computed(() => chatSendWaitText(cooldown.value))
const maxLength = computed(() => Number(status.value.maxMessageLength || 4000))
const canSend = computed(() => !sending.value && !cooldown.value && draft.value.trim().length > 0
  && draft.value.length <= maxLength.value)
const heading = computed(() => 'Customer support')
const statusCopy = computed(() => status.value.available ? 'Online now' : 'We’ll reply when available.')
const showThread = computed(() => screen.value === 'thread' && conversation.value)
const unreadTotal = computed(() => conversations.value.reduce((total, item) => total + Number(item.unreadCount || 0), 0))
const attachmentPolicy = computed(() => conversationAttachmentPolicy.value || {
  enabled: status.value.attachmentsEnabled === true,
  allowedMimes: status.value.allowedAttachmentMimes || [],
  maxBytes: Number(status.value.maxAttachmentBytes || 0),
  maxPerMessage: Number(status.value.maxAttachmentsPerMessage || 0)
})
const attachmentAccept = computed(() => (attachmentPolicy.value.allowedMimes || []).join(','))
const attachmentLimitText = computed(() => {
  const bytes = attachmentPolicy.value.maxBytes
  const size = bytes >= 1048576 ? `${Number((bytes / 1048576).toFixed(1))} MB`
    : `${Math.max(1, Math.floor(bytes / 1024))} KB`
  return `Up to ${attachmentPolicy.value.maxPerMessage} files, ${size} each.`
})
const orderChoices = computed(() => [...new Map(orders.value.map(order => [order.id, order])).values()])
const orderPanelLabel = computed(() => {
  const id = conversation.value?.order_id || selectedOrderId.value
  if (!id) return conversation.value ? 'Add an order' : 'Add an order (optional)'
  const order = orderChoices.value.find(item => item.id === id)
  return order ? `Order #${order.order_number || order.id.slice(0, 8)}` : 'Selected order'
})
const callbackNumber = computed(() => accountContact.value?.mobile
  || conversation.value?.contact_mobile || '')

let channel = null
let authSubscription = null
let refreshTimer = null
let tickTimer = null
let statusTimer = null
let fallbackTimer = null
let runId = 0
let selectionId = 0
let syncInProgress = false
let syncAgain = false
let pendingStart = null
let pendingSend = null
let previousBodyOverflow = ''
let bodyLocked = false
let chatHistoryEntry = false
let typingTimer = null
let lastTypingAt = 0
let readPending = false

const requestError = (error, fallback) => error?.data?.statusMessage
  || error?.statusMessage || error?.message || fallback
const applyRetryAfter = (error) => {
  const seconds = chatRetryAfterSeconds(error)
  if (seconds) retryAfterUntil.value = Math.max(retryAfterUntil.value, Date.now() + seconds * 1000)
}

const loadStatus = async () => {
  try {
    status.value = await $fetch('/api/chat/status', { cache: 'no-store' })
  } catch {
    status.value = { enabled: false, available: false }
  }
}

const latestOwnMessage = () => [...messages.value].reverse()
  .find(item => item.sender_kind === 'customer' || item.sender_kind === 'guest')

const atBottom = () => {
  const list = messageList.value
  return !list || list.scrollHeight - list.scrollTop - list.clientHeight < 90
}

const scrollBottom = async () => {
  await nextTick()
  if (messageList.value) messageList.value.scrollTop = messageList.value.scrollHeight
  newBelow.value = false
  markVisibleRead()
}

const updateConversation = item => {
  if (conversation.value?.id === item.id && conversation.value.order_id !== item.order_id) {
    selectedOrderId.value = item.order_id || ''
  }
  conversation.value = item
  conversations.value = [item, ...conversations.value.filter(entry => entry.id !== item.id)]
}
const chooseFiles = event => {
  const files = [...(event.target.files || [])]
  const policy = attachmentPolicy.value
  if (!policy.enabled || !files.length) { selectedFiles.value = []; return }
  if (files.length > policy.maxPerMessage) {
    errorText.value = `Choose up to ${policy.maxPerMessage} files.`
    event.target.value = ''; selectedFiles.value = []; return
  }
  if (files.some(file => file.size < 1 || file.size > policy.maxBytes
    || !policy.allowedMimes.includes(file.type))) {
    errorText.value = 'Choose a permitted file within the size limit.'
    event.target.value = ''; selectedFiles.value = []; return
  }
  selectedFiles.value = files.map(file => ({ id: crypto.randomUUID(), file }))
  errorText.value = ''
}
const clearFiles = () => {
  selectedFiles.value = []
  if (fileInput.value) fileInput.value.value = ''
}
const uploadSelectedFiles = async (conversationId, messageId) => {
  const items = []
  let failed = false
  for (const selected of selectedFiles.value) {
    try {
      const result = await uploadAttachment(actor.value, conversationId, messageId,
        selected.id, selected.file)
      items.push(result.item)
    } catch { failed = true }
  }
  clearFiles()
  return { items, failed }
}
const downloadFile = async file => {
  try { await downloadAttachment(actor.value, file.id, file.original_name) }
  catch (error) { errorText.value = requestError(error, 'Could not download file.') }
}
const markVisibleRead = async () => {
  if (!panelOpen.value || screen.value !== 'thread' || !conversation.value
    || document.visibilityState !== 'visible' || !atBottom() || readPending) return
  const incoming = [...messages.value].reverse().find(item => item.sender_kind === 'staff')
  if (!incoming || Number(incoming.sequence_number) <= Number(conversation.value.lastReadSequence || 0)) return
  const id = conversation.value.id
  readPending = true
  let saved = false
  try {
    const result = await request(actor.value, `/conversations/${id}/read`, {
      method: 'POST', body: { sequence: Number(incoming.sequence_number) }
    })
    if (conversation.value?.id === id) updateConversation({ ...conversation.value, ...result })
    saved = true
  } catch { /* Reconcile or another visible scroll can retry. */ }
  finally { readPending = false; if (saved || conversation.value?.id !== id) setTimeout(markVisibleRead, 0) }
}
const onTyping = payload => {
  if (payload?.kind !== 'staff' || payload.conversationId !== conversation.value?.id) return
  staffTyping.value = true
  if (typingTimer) clearTimeout(typingTimer)
  typingTimer = setTimeout(() => { staffTyping.value = false; typingTimer = null }, 6000)
}
const sendTyping = async () => {
  if (!panelOpen.value || !showThread.value || conversation.value.status !== 'active'
    || !draft.value.trim() || !channel || Date.now() - lastTypingAt < 4000) return
  lastTypingAt = Date.now()
  try { await request(actor.value, `/conversations/${conversation.value.id}/typing`, { method: 'POST', body: {} }) }
  catch { /* Typing is optional. */ }
}

const clearSubscription = async () => {
  if (refreshTimer) clearTimeout(refreshTimer)
  refreshTimer = null
  authSubscription?.unsubscribe()
  authSubscription = null
  const old = channel
  channel = null
  connectionState.value = 'idle'
  staffTyping.value = false
  if (typingTimer) clearTimeout(typingTimer)
  typingTimer = null
  if (old && actor.value?.client) await actor.value.client.removeChannel(old)
}

const mergeIncoming = async (incoming) => {
  if (!incoming.length) return
  const known = new Set(messages.value.map(item => item.id))
  const added = incoming.filter(item => !known.has(item.id))
  const stick = panelOpen.value && atBottom()
  messages.value = mergeChatMessages(messages.value, incoming)
  if (!added.length) return
  const own = latestOwnMessage()
  if (own) lastOwnSentAt.value = own.created_at
  const staffCount = added.filter(item => item.sender_kind === 'staff').length
  if (staffCount) {
    liveAnnouncement.value = ''
    await nextTick()
    liveAnnouncement.value = staffCount === 1
      ? 'New support message.' : `${staffCount} new support messages.`
  }
  if (panelOpen.value && !stick && staffCount) newBelow.value = true
  if (stick) await scrollBottom()
}
const refreshLatestMessages = async () => {
  if (!actor.value?.session || !conversation.value) return
  const id = conversation.value.id
  try {
    const result = await request(actor.value, `/conversations/${id}`)
    if (conversation.value?.id !== id) return
    updateConversation(result.item)
    conversationAttachmentPolicy.value = result.attachmentPolicy || conversationAttachmentPolicy.value
    messages.value = mergeChatMessages(messages.value, result.messages.items || [])
  } catch { scheduleReconcile() }
}

const reconcile = async () => {
  if (!actor.value?.session || !conversation.value) return
  if (syncInProgress) { syncAgain = true; return }
  syncInProgress = true
  const selected = selectionId
  const selectedConversation = conversation.value.id
  try {
    let pages = 0
    let more = true
    while (more && pages < 20 && selectionId === selected
      && conversation.value?.id === selectedConversation) {
      const cursor = messages.value.at(-1)?.sequence_number
      const suffix = cursor ? `?after=${encodeURIComponent(cursor)}` : ''
      const result = await request(actor.value, `/conversations/${selectedConversation}${suffix}`)
      if (selectionId !== selected || conversation.value?.id !== selectedConversation) break
      updateConversation(result.item)
      if (!cursor) hasOlder.value = result.messages.hasMore
      await mergeIncoming(result.messages.items || [])
      more = Boolean(cursor && result.messages.hasMore && result.messages.items?.length)
      pages += 1
    }
    if (more && pages === 20) syncAgain = true
    if (selectionId === selected) connectionState.value = 'connected'
  } catch (error) {
    if (selectionId === selected) {
      connectionState.value = 'reconnecting'
      if (panelOpen.value) errorText.value = requestError(error, 'Could not refresh messages.')
    }
  } finally {
    syncInProgress = false
    if (syncAgain) { syncAgain = false; scheduleReconcile() }
  }
}

const scheduleReconcile = () => {
  if (refreshTimer) return
  refreshTimer = setTimeout(() => {
    refreshTimer = null
    reconcile()
  }, 120)
}

const subscribe = async () => {
  await clearSubscription()
  if (!conversation.value || !actor.value?.session) return
  const client = actor.value.client
  const id = conversation.value.id
  const { data: auth } = await client.auth.getSession()
  if (!auth.session?.access_token) return
  actor.value = { ...actor.value, session: auth.session }
  await client.realtime.setAuth(auth.session.access_token)
  authSubscription = client.auth.onAuthStateChange((_event, session) => {
    if (session?.access_token && channel) client.realtime.setAuth(session.access_token)
  }).data.subscription
  channel = client.channel(`chat:public:${id}`, { config: { private: true } })
    .on('broadcast', { event: 'changed' }, ({ payload }) => {
      if (payload?.kind === 'attachment') refreshLatestMessages()
      else scheduleReconcile()
    })
    .on('broadcast', { event: 'typing' }, ({ payload }) => onTyping(payload))
    .subscribe((state) => {
      if (state === 'SUBSCRIBED') { connectionState.value = 'connected'; scheduleReconcile() }
      else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') connectionState.value = 'reconnecting'
    })
}

const selectConversation = async (item, currentRun = runId) => {
  const selected = ++selectionId
  errorText.value = ''
  loading.value = true
  orderToolsOpen.value = false
  callbackOpen.value = false
  callbackMobile.value = ''
  feedbackResolved.value = null
  feedbackRating.value = 0
  feedbackTicketReference.value = null
  await clearSubscription()
  if (currentRun !== runId || selected !== selectionId) return
  conversation.value = null
  try {
    const result = await request(actor.value, `/conversations/${item.id}`)
    if (currentRun !== runId || selected !== selectionId) return
    updateConversation(result.item)
    conversationAttachmentPolicy.value = result.attachmentPolicy || null
    selectedOrderId.value = result.item.order_id || ''
    messages.value = result.messages.items || []
    hasOlder.value = result.messages.hasMore
    lastOwnSentAt.value = latestOwnMessage()?.created_at || null
    screen.value = 'thread'
    await scrollBottom()
    await subscribe()
  } catch (error) {
    if (currentRun === runId && selected === selectionId) errorText.value = requestError(error, 'Could not load conversation.')
  } finally {
    if (currentRun === runId && selected === selectionId) loading.value = false
  }
}

const loadActor = async () => {
  const currentRun = ++runId
  selectionId += 1
  loading.value = true
  errorText.value = ''
  await clearSubscription()
  if (currentRun !== runId) return
  actor.value = null
  conversation.value = null
  conversationAttachmentPolicy.value = null
  clearFiles()
  selectedOrderId.value = ''
  messages.value = []
  conversations.value = []
  lastOwnSentAt.value = null
  accountContact.value = null
  orders.value = []
  guestToLink.value = null
  try {
    const resolved = await resolveActor()
    if (currentRun !== runId) return
    actor.value = resolved
    if (resolved.kind === 'customer') {
      const identity = await request(resolved, '/me')
      if (currentRun !== runId) return
      accountContact.value = identity.contact
      await Promise.all([loadOrders(resolved), findGuestChat(resolved)])
    }
    if (!resolved.session) { screen.value = 'start'; return }
    const result = await request(resolved, '/conversations')
    if (currentRun !== runId) return
    conversations.value = result.items || []
    const active = conversations.value.find(item => item.status !== 'closed')
    if (active) await selectConversation(active, currentRun)
    else screen.value = 'start'
  } catch (error) {
    if (currentRun === runId) errorText.value = requestError(error, 'Could not load chat.')
  } finally {
    if (currentRun === runId) loading.value = false
  }
}
const loadOrders = async (currentActor, number = '') => {
  try {
    const result = await request(currentActor, `/orders${number ? `?number=${encodeURIComponent(number)}` : ''}`)
    if (actor.value?.session?.user?.id !== currentActor.session.user.id) return
    orders.value = number ? [...new Map([...result.items, ...orders.value].map(order => [order.id, order])).values()]
      : result.items || []
    if (number && !result.items?.length) errorText.value = 'No order found for your account.'
  } catch (error) { errorText.value = requestError(error, 'Could not load orders.') }
}
const findGuestChat = async (currentActor) => {
  if (!hasStoredGuestSession()) return
  try {
    const client = getGuestClient()
    const { data } = await client.auth.getSession()
    if (!data.session?.access_token || data.session.user?.is_anonymous !== true) return
    const guestActor = { kind: 'guest', client, session: data.session }
    const result = await request(guestActor, '/conversations')
    if (actor.value?.session?.user?.id !== currentActor.session.user.id) return
    guestToLink.value = result.items?.[0] ? { actor: guestActor, chat: result.items[0] } : null
  } catch { /* An expired guest session cannot prove ownership. */ }
}
const searchOrders = async () => {
  const number = orderNumber.value.trim()
  if (number && !/^[A-Za-z0-9-]{1,64}$/.test(number)) { errorText.value = 'Enter a valid order number.'; return }
  if (actor.value?.kind === 'customer') await loadOrders(actor.value, number)
}
const setOrder = async (orderId) => {
  if (actor.value?.kind !== 'customer' || !conversation.value || orderBusy.value) return
  orderBusy.value = true
  errorText.value = ''
  try {
    const id = conversation.value.id
    const result = await request(actor.value, `/conversations/${id}/order`, {
      method: 'POST', body: { orderId, expectedRevision: conversation.value.revision }
    })
    if (conversation.value?.id === id) updateConversation({ ...conversation.value, ...result.item })
  } catch (error) {
    errorText.value = requestError(error, 'Could not link order.')
    if (error?.statusCode === 409 || error?.status === 409) scheduleReconcile()
  } finally { orderBusy.value = false }
}
const requestCallback = async () => {
  if (!conversation.value || callbackBusy.value) return
  const mobile = callbackNumber.value || callbackMobile.value.trim()
  if (!chatMobileValid(mobile)) {
    errorText.value = 'Enter a valid mobile number.'
    return
  }
  const id = conversation.value.id
  callbackBusy.value = true
  errorText.value = ''
  try {
    const result = await request(actor.value, `/conversations/${id}/callback`, {
      method: 'POST', body: callbackNumber.value ? {} : { mobile }
    })
    if (conversation.value?.id === id) {
      updateConversation(result.item)
      callbackOpen.value = false
    }
  } catch (error) { errorText.value = requestError(error, 'Could not request a call.') }
  finally { callbackBusy.value = false }
}
const submitFeedback = async () => {
  if (!conversation.value || feedbackBusy.value || typeof feedbackResolved.value !== 'boolean'
    || feedbackRating.value < 1 || feedbackRating.value > 5) return
  const id = conversation.value.id
  feedbackBusy.value = true
  errorText.value = ''
  try {
    const result = await request(actor.value, `/conversations/${id}/feedback`, {
      method: 'POST', body: { resolved: feedbackResolved.value, rating: feedbackRating.value }
    })
    if (conversation.value?.id === id) {
      updateConversation(result.item)
      feedbackTicketReference.value = result.feedback?.ticketReference || null
    }
  } catch (error) { errorText.value = requestError(error, 'Could not save your feedback.') }
  finally { feedbackBusy.value = false }
}
const linkGuestChat = async () => {
  if (!guestToLink.value || actor.value?.kind !== 'customer' || orderBusy.value) return
  orderBusy.value = true
  errorText.value = ''
  try {
    const guest = guestToLink.value
    const { data } = await guest.actor.client.auth.getSession()
    if (!data.session?.access_token) throw new Error('Guest session expired.')
    await request(actor.value, `/conversations/${guest.chat.id}/identify`, {
      method: 'POST', headers: { 'x-chat-guest-authorization': `Bearer ${data.session.access_token}` },
      body: { expectedRevision: guest.chat.revision }
    })
    await loadActor()
  } catch (error) { errorText.value = requestError(error, 'Could not link guest chat.') }
  finally { orderBusy.value = false }
}

const isMobile = () => window.matchMedia('(max-width: 640px)').matches
const lockBody = () => {
  if (bodyLocked) return
  previousBodyOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  bodyLocked = true
}
const unlockBody = () => {
  if (!bodyLocked) return
  document.body.style.overflow = previousBodyOverflow
  bodyLocked = false
}
const updateViewport = () => {
  const height = window.visualViewport?.height || window.innerHeight
  panel.value?.style.setProperty('--chat-viewport-height', `${Math.round(height)}px`)
}
const updatePanelMode = () => {
  const wasMobile = mobilePanel.value
  const nextMobile = isMobile()
  mobilePanel.value = nextMobile
  if (panelOpen.value && nextMobile) {
    lockBody()
    if (!wasMobile && !chatHistoryEntry) {
      window.history.pushState({ ...window.history.state, elChatPanel: true }, '', window.location.href)
      chatHistoryEntry = true
    }
  }
  else unlockBody()
  updateViewport()
}
const hidePanel = () => {
  panelOpen.value = false
  mobilePanel.value = false
  chatHistoryEntry = false
  unlockBody()
  nextTick(() => launcher.value?.focus())
}
const closePanel = () => {
  if (chatHistoryEntry && window.history.state?.elChatPanel) {
    window.history.back()
  } else hidePanel()
}
const onPopState = () => {
  if (panelOpen.value) hidePanel()
}
const openPanel = async () => {
  panelOpen.value = true
  mobilePanel.value = isMobile()
  if (mobilePanel.value) {
    lockBody()
    window.history.pushState({ ...window.history.state, elChatPanel: true }, '', window.location.href)
    chatHistoryEntry = true
  }
  await nextTick()
  updateViewport()
  closeButton.value?.focus()
  await loadStatus()
  if (!status.value.enabled) { closePanel(); return }
  if (actor.value) {
    if (conversation.value) scheduleReconcile()
    return
  }
  await loadActor()
}

const loadInitialUnread = async () => {
  if (!status.value.enabled || panelOpen.value || (!mainUser.value && !hasStoredGuestSession())) return
  try {
    const knownActor = await resolveActor()
    if (!knownActor.session) return
    const result = await request(knownActor, '/conversations')
    if (!panelOpen.value) conversations.value = result.items || []
  } catch { /* The badge refreshes when chat is opened. */ }
}

const loadOlder = async () => {
  if (!conversation.value || !hasOlder.value || loadingOlder.value) return
  const selected = selectionId
  const conversationId = conversation.value.id
  loadingOlder.value = true
  const list = messageList.value
  const oldHeight = list?.scrollHeight || 0
  try {
    const before = messages.value[0]?.sequence_number
    const result = await request(actor.value,
      `/conversations/${conversationId}/messages?before=${encodeURIComponent(before)}`)
    if (selectionId !== selected || conversation.value?.id !== conversationId) return
    messages.value = mergeChatMessages(result.items || [], messages.value)
    hasOlder.value = result.hasMore
    await nextTick()
    if (list) list.scrollTop += list.scrollHeight - oldHeight
  } catch (error) {
    errorText.value = requestError(error, 'Could not load older messages.')
  } finally {
    loadingOlder.value = false
  }
}

const startConversation = async () => {
  const text = draft.value.trim()
  if (!text || text.length > maxLength.value) return
  if (isGuest.value && !chatContactValid(guestName.value, guestEmail.value,
    guestMobile.value, status.value.guestContactRule)) {
    errorText.value = 'Enter your name and a valid contact method.'
    return
  }
  const fingerprint = JSON.stringify([text, guestName.value, guestEmail.value,
    guestMobile.value, selectedOrderId.value])
  if (!pendingStart || pendingStart.fingerprint !== fingerprint) {
    pendingStart = { fingerprint, creationKey: crypto.randomUUID(), messageKey: crypto.randomUUID() }
  }
  sending.value = true
  errorText.value = ''
  const currentRun = runId
  try {
    let activeActor = actor.value
    if (activeActor.kind === 'guest') activeActor = await ensureGuestSession(activeActor)
    actor.value = activeActor
    const result = await request(activeActor, '/conversations', {
      method: 'POST', body: {
        creationKey: pendingStart.creationKey, messageKey: pendingStart.messageKey,
        initialMessage: text,
        ...(activeActor.kind === 'customer' && selectedOrderId.value ? { orderId: selectedOrderId.value } : {}),
        ...(activeActor.kind === 'guest' ? {
          name: guestName.value, email: guestEmail.value, mobile: guestMobile.value
        } : {})
      }
    })
    if (currentRun !== runId) return
    pendingStart = null
    retryAfterUntil.value = 0
    if (draft.value.trim() === text) draft.value = ''
    conversations.value = [result.item, ...conversations.value.filter(item => item.id !== result.item.id)]
    const uploaded = result.messageId && selectedFiles.value.length
      ? await uploadSelectedFiles(result.item.id, result.messageId) : { items: [], failed: false }
    if (currentRun !== runId) return
    await selectConversation(result.item)
    if (uploaded.failed) errorText.value = 'Message sent. Some attachments could not be uploaded.'
  } catch (error) {
    if (currentRun === runId) {
      applyRetryAfter(error)
      errorText.value = requestError(error, 'Could not save your message. Try again.')
    }
  } finally {
    sending.value = false
  }
}

const sendMessage = async () => {
  if (!conversation.value || !canSend.value) return
  const selected = selectionId
  const conversationId = conversation.value.id
  const text = draft.value.trim()
  if (!pendingSend || pendingSend.text !== text) {
    pendingSend = { text, key: crypto.randomUUID() }
  }
  sending.value = true
  errorText.value = ''
  try {
    const result = await request(actor.value,
      `/conversations/${conversationId}/messages`, {
        method: 'POST', body: { body: text, idempotencyKey: pendingSend.key }
      })
    if (selectionId !== selected || conversation.value?.id !== conversationId) return
    pendingSend = null
    retryAfterUntil.value = 0
    if (draft.value.trim() === text) draft.value = ''
    const uploaded = selectedFiles.value.length
      ? await uploadSelectedFiles(conversationId, result.item.id) : { items: [], failed: false }
    if (selectionId !== selected || conversation.value?.id !== conversationId) return
    await mergeIncoming([{ ...result.item, attachments: uploaded.items }])
    if (uploaded.failed) errorText.value = 'Message sent. Some attachments could not be uploaded.'
    lastOwnSentAt.value = result.item.created_at
    await scrollBottom()
  } catch (error) {
    if (selectionId === selected) {
      applyRetryAfter(error)
      errorText.value = requestError(error, 'Could not send your message. Try again.')
      scheduleReconcile()
    }
  } finally {
    sending.value = false
  }
}

const submitDraft = () => screen.value === 'thread' ? sendMessage() : startConversation()
const onComposerKeydown = (event) => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault()
    submitDraft()
  }
}
const showHistory = () => { screen.value = 'history'; errorText.value = '' }
const backFromHistory = () => { screen.value = conversation.value ? 'thread' : 'start' }
const newConversation = async () => {
  selectionId += 1
  await clearSubscription()
  conversation.value = null
  selectedOrderId.value = ''
  orderToolsOpen.value = false
  callbackOpen.value = false
  callbackMobile.value = ''
  feedbackResolved.value = null
  feedbackRating.value = 0
  feedbackTicketReference.value = null
  conversationAttachmentPolicy.value = null
  clearFiles()
  messages.value = []
  draft.value = ''
  lastOwnSentAt.value = null
  pendingStart = null
  screen.value = 'start'
  await nextTick()
  composer.value?.focus()
}
const goToHelp = async () => {
  if (chatHistoryEntry && window.history.state?.elChatPanel) {
    await new Promise(resolve => {
      window.addEventListener('popstate', resolve, { once: true })
      window.history.back()
    })
  } else hidePanel()
  await uiNavigateTo('/help')
}
const onWindowFocus = () => {
  loadStatus()
  if (conversation.value) scheduleReconcile()
  if (!panelOpen.value) loadInitialUnread()
}
const onKeydown = (event) => {
  if (!panelOpen.value) return
  if (event.key === 'Escape') { closePanel(); return }
  if (event.key !== 'Tab' || !mobilePanel.value) return
  const focusable = [...(panel.value?.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled)') || [])]
    .filter(element => element.offsetParent !== null)
  if (!focusable.length) return
  const first = focusable[0]
  const last = focusable.at(-1)
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
}

watch(() => mainUser.value?.sub || mainUser.value?.id, async () => {
  if (panelOpen.value) await loadActor()
  else { conversations.value = []; await loadInitialUnread() }
})
watch(() => route.path, () => {
  if (route.path.startsWith('/checkout')) {
    hidePanel()
    clearSubscription()
  }
})
watch([draft, guestName, guestEmail, guestMobile, selectedOrderId], () => {
  sendTyping()
  if (pendingSend?.text !== draft.value.trim()) pendingSend = null
  if (pendingStart?.fingerprint !== JSON.stringify([
    draft.value.trim(), guestName.value, guestEmail.value, guestMobile.value,
    selectedOrderId.value
  ])) pendingStart = null
})

onMounted(() => {
  loadStatus().then(loadInitialUnread)
  tickTimer = setInterval(() => { clock.value = Date.now() }, 500)
  statusTimer = setInterval(loadStatus, 60000)
  fallbackTimer = setInterval(() => {
    if (panelOpen.value && conversation.value && document.visibilityState === 'visible') scheduleReconcile()
  }, 2500)
  window.addEventListener('focus', onWindowFocus)
  window.addEventListener('online', onWindowFocus)
  window.addEventListener('popstate', onPopState)
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('resize', updatePanelMode)
  window.visualViewport?.addEventListener('resize', updateViewport)
})
onBeforeUnmount(() => {
  if (tickTimer) clearInterval(tickTimer)
  if (statusTimer) clearInterval(statusTimer)
  if (fallbackTimer) clearInterval(fallbackTimer)
  if (refreshTimer) clearTimeout(refreshTimer)
  if (typingTimer) clearTimeout(typingTimer)
  window.removeEventListener('focus', onWindowFocus)
  window.removeEventListener('online', onWindowFocus)
  window.removeEventListener('popstate', onPopState)
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', updatePanelMode)
  window.visualViewport?.removeEventListener('resize', updateViewport)
  if (panelOpen.value) unlockBody()
  clearSubscription()
})
</script>

<template>
  <div v-if="visible" class="chat-root">
    <span class="sr-only" aria-live="polite" aria-atomic="true">{{ $uiLabel(liveAnnouncement) }}</span>
    <button ref="launcher" class="chat-launcher" type="button"
      :aria-label="unreadTotal ? $t('livechat.Launcher.liveSupportValueUnreadValue', { value0: (unreadTotal), value1: ($uiPluralSuffix(unreadTotal === 1 ? 'reply' : 'replies')) }) : $t('common.liveSupport')"
      :aria-expanded="panelOpen" aria-controls="live-chat-panel" @click="panelOpen ? closePanel() : openPanel()">
      <Icon :name="panelOpen ? 'lucide:x' : 'lucide:message-circle'" size="23" aria-hidden="true" />
      <span>{{ $t('common.chat') }}</span>
      <span v-if="unreadTotal" class="chat-badge" aria-hidden="true">{{ unreadTotal > 9 ? '9+' : unreadTotal }}</span>
    </button>

    <section v-show="panelOpen" id="live-chat-panel" ref="panel" class="chat-panel" role="dialog"
      :aria-modal="mobilePanel ? 'true' : undefined"
      aria-labelledby="live-chat-title" :aria-busy="loading">
      <header class="chat-header">
        <div class="chat-title-wrap">
          <div>
            <h2 id="live-chat-title">{{ $uiLabel(heading) }}</h2>
            <p><span class="chat-status-dot" :class="{ online: status.available }" />{{ $uiLabel(statusCopy) }}</p>
          </div>
        </div>
        <button ref="closeButton" type="button" class="chat-icon-button chat-header-close"
          :aria-label="$t('common.closeLiveSupport')" @click="closePanel">
          <Icon name="lucide:x" size="20" aria-hidden="true" />
        </button>
      </header>

      <div class="chat-toolbar">
        <button v-if="screen === 'history'" type="button" class="chat-text-button" @click="backFromHistory">
          <Icon name="lucide:arrow-left" size="16" aria-hidden="true" class="directional-icon" /> {{ $t('common.back') }}
        </button>
        <span v-else class="chat-toolbar-label">{{ showThread ? $t('common.conversationValue', { value0: (conversation.reference_number) }) : $t('common.howCanWeHelp') }}</span>
        <div v-if="screen !== 'history'" class="chat-toolbar-actions">
          <button v-if="status.requestCallEnabled && showThread && !conversation.callback_status" type="button"
            class="chat-text-button" @click="callbackOpen = !callbackOpen">{{ $t('common.requestACall') }}</button>
          <button v-if="conversations.length" type="button" class="chat-text-button" @click="showHistory">{{ $t('common.pastChats') }}</button>
        </div>
      </div>

      <div v-if="guestToLink && actor?.kind === 'customer'" class="chat-account-link">
        <span>{{ $t('livechat.Launcher.moveGuestChatValueToThisAccount', { value0: (guestToLink.chat.reference_number) }) }}</span>
        <button type="button" :disabled="orderBusy" @click="linkGuestChat">{{ $t('common.moveChat') }}</button>
      </div>

      <div v-if="loading && !actor" class="chat-center" role="status" aria-live="polite">{{ $t('common.openingChat') }}</div>

      <template v-else-if="screen === 'history'">
        <div class="chat-scroll chat-history" :aria-label="$t('common.previousConversations')" :aria-busy="loading">
          <button v-for="item in conversations" :key="item.id" type="button" class="chat-history-item"
            @click="selectConversation(item)">
            <span><strong>{{ $t('common.conversationValue', { value0: (item.reference_number) }) }}</strong><small>{{ chatDateText(item.created_at) }}</small></span>
            <span class="chat-history-status">{{ item.unreadCount ? $t('common.valueNew', { value0: (item.unreadCount) }) : $uiLabel(item.status) }}</span>
          </button>
          <p v-if="!conversations.length" class="chat-muted">{{ $t('common.noPreviousChats') }}</p>
        </div>
      </template>

      <template v-else-if="showThread">
        <div v-if="conversation.callback_status" class="chat-callback-status">
          <span>{{ $t('common.callRequestValue', { value0: ($uiLabel(conversation.callback_status)) }) }}</span>
          <span v-if="conversation.callback_mobile">{{ conversation.callback_mobile }}</span>
        </div>
        <form v-else-if="callbackOpen && status.requestCallEnabled" class="chat-callback-panel" @submit.prevent="requestCallback">
          <p v-if="callbackNumber">{{ $t('common.weLlCallValue', { value0: (callbackNumber) }) }}</p>
          <label v-else for="chat-callback-mobile">{{ $t('common.mobileNumber') }}</label>
          <input v-if="!callbackNumber" id="chat-callback-mobile" v-model="callbackMobile" type="tel"
            autocomplete="tel" maxlength="30" :placeholder="$t('common.yourMobileNumber')" required />
          <div class="chat-callback-actions">
            <button type="button" @click="callbackOpen = false">{{ $t('common.cancel') }}</button>
            <button type="submit" class="primary" :disabled="callbackBusy">{{ callbackBusy ? $t('common.sending') : $t('common.requestCall') }}</button>
          </div>
        </form>
        <div v-if="actor?.kind === 'customer' && conversation.status !== 'closed' && !conversation.ticket_id" class="chat-order-panel">
          <button type="button" class="chat-order-summary" :aria-expanded="orderToolsOpen" @click="orderToolsOpen = !orderToolsOpen">
            <span>{{ $uiLabel(orderPanelLabel) }}</span>
            <Icon :name="orderToolsOpen ? 'lucide:chevron-up' : 'lucide:chevron-down'" size="15" aria-hidden="true" />
          </button>
          <div v-if="orderToolsOpen" class="chat-order-link">
            <select v-model="selectedOrderId" :aria-label="$t('common.chooseYourOrder')"><option value="">{{ $t('common.chooseAnOrder') }}</option><option v-for="order in orderChoices" :key="order.id" :value="order.id">#{{ order.order_number || order.id.slice(0, 8) }} · {{ $uiLabel(order.status) }}</option></select>
            <div class="chat-order-actions">
              <button type="button" :disabled="orderBusy || !selectedOrderId || selectedOrderId === conversation.order_id" @click="setOrder(selectedOrderId)">{{ $t('common.linkOrder') }}</button>
              <button v-if="conversation.order_id" type="button" :disabled="orderBusy" @click="setOrder(null)">{{ $t('common.remove') }}</button>
            </div>
            <div class="chat-order-search">
              <input v-model="orderNumber" maxlength="64" :aria-label="$t('common.findOrderNumber')" :placeholder="$t('common.orderNumber')" />
              <button type="button" :disabled="orderBusy" @click="searchOrders">{{ $t('common.find') }}</button>
            </div>
          </div>
        </div>
        <p v-else-if="actor?.kind === 'customer' && conversation.ticket_id" class="chat-intake-note">{{ $t('livechat.Launcher.theRelatedOrderIsNowManagedOnYourSupportTicket') }}</p>
        <div ref="messageList" class="chat-scroll chat-messages" role="log" :aria-label="$t('common.chatMessages')"
          aria-live="polite" aria-relevant="additions" :aria-busy="loadingOlder" @scroll.passive="markVisibleRead">
          <button v-if="hasOlder" type="button" class="chat-load-more" :disabled="loadingOlder" @click="loadOlder">
            {{ loadingOlder ? $t('common.loading') : $t('common.loadEarlierMessages') }}
          </button>
          <p v-if="conversation.intake_mode === 'offline'" class="chat-intake-note">{{ conversation.ticket_id ? $t('livechat.Launcher.yourMessageIsSavedAsASupportTicket') : $t('livechat.Launcher.yourMessageIsSavedOurTeamWillReplyWhenAvailable') }}</p>
          <article v-for="message in messages" :key="message.id" class="chat-message"
            :aria-label="`${message.sender_kind === 'staff' ? $t('common.support') : $t('common.youVariant2')}, ${chatDateText(message.created_at)}`"
            :class="message.sender_kind === 'staff' ? 'from-support' : 'from-customer'">
            <span class="chat-message-sender">{{ message.sender_kind === 'staff' ? $t('common.support') : $t('common.youVariant2') }}</span>
            <p>{{ message.body }}</p>
            <button v-for="file in message.attachments || []" :key="file.id" type="button"
              class="chat-attachment" @click="downloadFile(file)">
              <Icon name="lucide:paperclip" size="13" aria-hidden="true" />
              {{ file.original_name }}
            </button>
            <time :datetime="message.created_at" :title="chatDateTitle(message.created_at)">{{ chatDateText(message.created_at) }}</time>
          </article>
          <p v-if="!messages.length" class="chat-muted">{{ $t('common.noMessagesYet') }}</p>
        </div>
        <p v-if="staffTyping" class="chat-connection" role="status">{{ $t('common.supportIsTyping') }}</p>
        <button v-if="newBelow" type="button" class="chat-new-below" @click="scrollBottom">{{ $t('common.newMessage') }}</button>
      </template>

      <div v-else class="chat-scroll chat-intro">
        <h3>{{ status.available ? $t('common.howCanWeHelp') : $t('common.sendUsAMessage') }}</h3>
        <p>{{ status.available ? status.welcomeMessage : status.offlineMessage }}</p>
        <div v-if="isGuest" class="chat-contact-fields">
          <label for="chat-name">{{ $t('common.name') }} <span aria-hidden="true">*</span></label>
          <input id="chat-name" v-model="guestName" autocomplete="name" maxlength="160" :placeholder="$t('common.yourName')" required />
          <label for="chat-email">{{ $t('common.email') }}</label>
          <input id="chat-email" v-model="guestEmail" type="email" autocomplete="email" maxlength="320" placeholder="you@example.com" aria-describedby="chat-contact-help" />
          <label for="chat-mobile">{{ $t('common.mobile') }}</label>
          <input id="chat-mobile" v-model="guestMobile" type="tel" autocomplete="tel" maxlength="30" :placeholder="$t('common.yourMobileNumber')" aria-describedby="chat-contact-help" />
          <small v-if="status.guestContactRule === 'both'" id="chat-contact-help">{{ $t('livechat.Launcher.enterBothEmailAndMobile') }}</small>
          <small v-else-if="status.guestContactRule === 'email'" id="chat-contact-help">{{ $t('common.enterYourEmail') }}</small>
          <small v-else-if="status.guestContactRule === 'mobile'" id="chat-contact-help">{{ $t('livechat.Launcher.enterYourMobileNumber') }}</small>
          <small v-else id="chat-contact-help">{{ $t('livechat.Launcher.enterAnEmailOrMobileNumber') }}</small>
        </div>
        <div v-if="actor?.kind === 'customer'" class="chat-order-panel chat-order-start">
          <button type="button" class="chat-order-summary" :aria-expanded="orderToolsOpen" @click="orderToolsOpen = !orderToolsOpen">
            <span>{{ $uiLabel(orderPanelLabel) }}</span>
            <Icon :name="orderToolsOpen ? 'lucide:chevron-up' : 'lucide:chevron-down'" size="15" aria-hidden="true" />
          </button>
          <div v-if="orderToolsOpen" class="chat-order-link">
            <select id="chat-order-start" v-model="selectedOrderId" :aria-label="$t('common.chooseYourOrder')"><option value="">{{ $t('common.noOrder') }}</option><option v-for="order in orderChoices" :key="order.id" :value="order.id">#{{ order.order_number || order.id.slice(0, 8) }} · {{ $uiLabel(order.status) }}</option></select>
            <div class="chat-order-search">
              <input v-model="orderNumber" maxlength="64" :aria-label="$t('common.findOrderNumber')" :placeholder="$t('common.orderNumber')" />
              <button type="button" :disabled="orderBusy" @click="searchOrders">{{ $t('common.find') }}</button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="errorText" class="chat-error" role="alert">{{ $uiMessage(errorText) }}</div>
      <div v-if="showThread && connectionState === 'reconnecting'" class="chat-connection" role="status">{{ $t('livechat.Launcher.reconnectingMessagesAreSaved') }}</div>

      <div v-if="screen !== 'history' && (!conversation || conversation.status !== 'closed')" class="chat-composer">
        <label for="chat-message" class="sr-only">{{ $t('common.yourMessage') }}</label>
        <textarea id="chat-message" ref="composer" v-model="draft" rows="2" :maxlength="maxLength"
          :aria-describedby="cooldown ? 'chat-send-status' : undefined"
          :placeholder="showThread ? $t('common.writeAMessage') : $t('common.whatCanWeHelpWith')"
          @keydown="onComposerKeydown" />
        <div class="chat-composer-bottom">
          <span v-if="cooldown" id="chat-send-status" role="status">{{ $uiLabel(sendWaitText) }}</span>
          <span v-else>{{ draft.length }}/{{ maxLength }}</span>
          <button type="button" class="chat-send" :disabled="!canSend" @click="submitDraft">
            {{ sending ? $t('common.sending') : (showThread ? $t('common.send') : $t('common.startChat')) }}
          </button>
        </div>
        <label v-if="attachmentPolicy.enabled" class="chat-file-picker">
          <Icon name="lucide:paperclip" size="14" aria-hidden="true" /> {{ $t('common.attachFiles') }}
          <input ref="fileInput" type="file" multiple :accept="attachmentAccept"
            :disabled="sending" @change="chooseFiles" />
        </label>
        <span v-if="attachmentPolicy.enabled && !selectedFiles.length" class="chat-file-limit">{{ $uiLabel(attachmentLimitText) }}</span>
        <span v-if="selectedFiles.length" class="chat-file-summary">
          {{ $t('livechat.Launcher.valueValueSelected', { value0: (selectedFiles.length), value1: (selectedFiles.length === 1 ? 'file' : $t('common.files')) }) }}
          <button type="button" :disabled="sending" @click="clearFiles">{{ $t('common.clear') }}</button>
        </span>
      </div>
      <div v-else-if="conversation?.status === 'closed' && screen === 'thread'" class="chat-closed">
        <template v-if="!conversation.resolution_feedback_at">
          <strong>{{ $t('livechat.Launcher.wasYourIssueResolved') }}</strong>
          <div class="chat-feedback-choice" role="group" :aria-label="$t('common.issueResolution')">
            <button type="button" :class="{ selected: feedbackResolved === true }" :aria-pressed="feedbackResolved === true" @click="feedbackResolved = true">{{ $t('common.yes') }}</button>
            <button type="button" :class="{ selected: feedbackResolved === false }" :aria-pressed="feedbackResolved === false" @click="feedbackResolved = false">{{ $t('common.no') }}</button>
          </div>
          <span>{{ $t('common.rateYourSupport') }}</span>
          <div class="chat-rating" role="group" :aria-label="$t('livechat.Launcher.rateYourSupportFrom1To5')">
            <button v-for="rating in 5" :key="rating" type="button"
              :class="{ selected: feedbackRating >= rating }" :aria-label="$t('common.valueStarvalue', { value0: (rating), value1: (rating === 1 ? '' : $uiPluralSuffix('s')) })"
              :aria-pressed="feedbackRating === rating" @click="feedbackRating = rating">★</button>
          </div>
          <button type="button" class="chat-feedback-submit"
            :disabled="feedbackBusy || typeof feedbackResolved !== 'boolean' || !feedbackRating"
            @click="submitFeedback">{{ feedbackBusy ? $t('common.saving') : $t('common.sendFeedback') }}</button>
        </template>
        <template v-else>
          <strong>{{ $t('common.thankYouForYourFeedback') }}</strong>
          <span v-if="conversation.ticket_id && (conversation.resolution_resolved === false || conversation.satisfaction_rating <= 2)">
            {{ $t('livechat.Launcher.aSupportTicketWasCreatedForFollowUp') }}<span v-if="feedbackTicketReference">: #{{ feedbackTicketReference }}</span>.
          </span>
        </template>
        <button type="button" class="chat-new-conversation" @click="newConversation">{{ $t('common.startANewChat') }}</button>
      </div>
      <div class="chat-footer"><button type="button" @click="goToHelp">{{ $t('common.browseTheHelpCenter') }}</button></div>
    </section>
  </div>
</template>

<style scoped>
.chat-root {
  --chat-blue: var(--store-blue, #0654e9);
  --chat-navy: var(--store-navy, #08265c);
  --chat-pale: var(--store-pale, #edf4ff);
  --chat-line: var(--store-line, #dfe5ee);
  --chat-muted: var(--store-muted, #5b6473);
  font-family: inherit;
}

.chat-launcher {
  position: fixed;
  inset-inline-end: 22px;
  bottom: calc(24px + env(safe-area-inset-bottom));
  z-index: 70;
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 46px;
  padding: 0 16px;
  border: 1px solid var(--chat-blue);
  border-radius: 10px;
  background: var(--chat-blue);
  color: white;
  box-shadow: 0 6px 18px #08265c26;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.chat-launcher:hover { background: #0344ba; }

.chat-launcher:focus-visible,
.chat-panel button:focus-visible,
.chat-panel a:focus-visible,
.chat-panel input:focus-visible,
.chat-panel select:focus-visible,
.chat-panel textarea:focus-visible {
  outline: 3px solid #e3a800;
  outline-offset: 2px;
}

.chat-file-picker:focus-within {
  outline: 3px solid #e3a800;
  outline-offset: 3px;
}

.chat-badge {
  position: absolute;
  top: -7px;
  inset-inline-end: -7px;
  display: grid;
  place-items: center;
  min-width: 22px;
  height: 22px;
  padding: 0 5px;
  border: 2px solid white;
  border-radius: 50%;
  background: #be2e38;
  color: white;
  font-size: 11px;
}

.chat-panel {
  position: fixed;
  inset-inline-end: 22px;
  bottom: calc(82px + env(safe-area-inset-bottom));
  z-index: 71;
  display: flex;
  flex-direction: column;
  width: min(390px, calc(100vw - 32px));
  height: min(600px, calc(100dvh - 108px));
  overflow: hidden;
  border: 1px solid var(--chat-line);
  border-radius: 12px;
  background: var(--surface);
  box-shadow: 0 16px 40px #08265c29;
  color: var(--text-primary);
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 68px;
  padding: 13px 16px;
  border-bottom: 1px solid var(--chat-line);
  background: var(--surface);
  color: var(--chat-navy);
}

.chat-title-wrap { min-width: 0; }
.chat-header h2 { margin: 0; font-size: 16px; font-weight: 700; line-height: 1.25; }
.chat-header p { display: flex; align-items: center; gap: 6px; margin: 4px 0 0; color: var(--chat-muted); font-size: 11px; }
.chat-status-dot { width: 7px; height: 7px; border-radius: 50%; background: #94a3b8; }
.chat-status-dot.online { background: #16a34a; }

.chat-icon-button {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--chat-navy);
  cursor: pointer;
}

.chat-header-close:hover { background: var(--chat-pale); }

.chat-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 42px;
  padding: 0 16px;
  border-bottom: 1px solid var(--chat-line);
  background: var(--surface);
}

.chat-toolbar-label {
  overflow: hidden;
  color: var(--chat-muted);
  font-size: 12px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-text-button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 7px 2px;
  border: 0;
  background: transparent;
  color: var(--chat-blue);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.chat-text-button:hover { text-decoration: underline; }

.chat-toolbar-actions { display: flex; align-items: center; gap: 12px; }

.chat-account-link {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 7px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--chat-line);
  background: var(--surface);
  font-size: 11px;
}

.chat-order-panel {
  border-bottom: 1px solid var(--chat-line);
  background: var(--surface);
}

.chat-order-start {
  margin-top: 16px;
  border: 1px solid var(--chat-line);
  border-radius: 8px;
  overflow: hidden;
}

.chat-order-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 38px;
  padding: 7px 14px;
  border: 0;
  background: transparent;
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.chat-order-panel .chat-order-link {
  display: grid;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid var(--chat-line);
  background: var(--surface);
}

.chat-account-link button,
.chat-order-link button {
  min-height: 32px;
  border: 0;
  background: transparent;
  color: var(--chat-blue);
  font-weight: 700;
  cursor: pointer;
}

.chat-order-link input,
.chat-order-link select {
  width: 100%;
  min-width: 0;
  min-height: 34px;
  padding: 6px 8px;
  border: 1px solid var(--chat-line);
  border-radius: 7px;
  background: var(--surface);
}

.chat-order-actions { display: flex; align-items: center; gap: 12px; }
.chat-order-search { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 8px; }

.chat-callback-panel {
  display: grid;
  gap: 8px;
  padding: 11px 14px;
  border-bottom: 1px solid var(--chat-line);
  background: var(--surface);
  font-size: 12px;
}

.chat-callback-panel p { margin: 0; color: var(--text-primary); }
.chat-callback-panel label { color: var(--text-primary); font-weight: 700; }
.chat-callback-panel input { width: 100%; min-height: 38px; padding: 7px 9px; border: 1px solid var(--chat-line); border-radius: 7px; background: var(--surface); }
.chat-callback-actions { display: flex; justify-content: flex-end; gap: 8px; }
.chat-callback-actions button { min-height: 34px; padding: 5px 10px; border: 0; border-radius: 7px; background: transparent; color: var(--chat-blue); font-weight: 700; cursor: pointer; }
.chat-callback-actions .primary { background: var(--chat-blue); color: white; }
.chat-callback-status { display: flex; justify-content: space-between; gap: 10px; padding: 7px 14px; border-bottom: 1px solid var(--chat-line); background: var(--surface); color: var(--text-secondary); font-size: 11px; text-transform: capitalize; }

.chat-scroll { min-height: 0; flex: 1; overflow-y: auto; overscroll-behavior: contain; }
.chat-center { display: grid; place-items: center; flex: 1; color: var(--chat-muted); font-size: 13px; }
.chat-intro { padding: 24px 22px 14px; }
.chat-intro h3 { margin: 0 0 7px; color: var(--chat-navy); font-size: 18px; font-weight: 700; }
.chat-intro > p { margin: 0; color: var(--chat-muted); font-size: 13px; line-height: 1.55; }
.chat-contact-fields { display: grid; gap: 6px; margin-top: 20px; }
.chat-contact-fields label { margin-top: 5px; color: var(--text-primary); font-size: 12px; font-weight: 700; }

.chat-contact-fields input {
  width: 100%;
  min-height: 39px;
  padding: 8px 10px;
  border: 1px solid var(--chat-line);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text-primary);
  font-size: 13px;
}

.chat-contact-fields small { color: var(--chat-muted); font-size: 11px; }
.chat-messages { display: flex; flex-direction: column; gap: 12px; padding: 16px; }

.chat-intake-note {
  align-self: center;
  max-width: 90%;
  margin: 0 0 4px;
  padding: 8px 11px;
  border: 1px solid #dceaff;
  border-radius: 8px;
  background: var(--chat-pale);
  color: var(--text-secondary);
  text-align: center;
  font-size: 11px;
  line-height: 1.4;
}

.chat-message { display: flex; flex-direction: column; max-width: 84%; gap: 3px; }
.chat-message.from-customer { align-self: flex-end; align-items: flex-end; }
.chat-message.from-support { align-self: flex-start; align-items: flex-start; }
.chat-message-sender { padding: 0 4px; color: var(--chat-muted); font-size: 10px; font-weight: 700; }

.chat-message p {
  max-width: 100%;
  margin: 0;
  padding: 10px 12px;
  border: 1px solid var(--chat-line);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text-primary);
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.chat-message.from-customer p {
  border-color: var(--chat-blue);
  border-bottom-right-radius: 3px;
  background: var(--chat-blue);
  color: white;
}

.chat-message.from-support p { border-bottom-left-radius: 3px; }
.chat-message time { padding: 0 4px; color: var(--text-secondary); font-size: 10px; }

.chat-load-more {
  align-self: center;
  padding: 5px 10px;
  border: 0;
  background: transparent;
  color: var(--chat-blue);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.chat-muted { margin: auto; color: var(--chat-muted); text-align: center; font-size: 12px; }

.chat-new-below {
  align-self: center;
  margin-bottom: 7px;
  padding: 6px 12px;
  border: 1px solid #b7c8e5;
  border-radius: 8px;
  background: var(--surface);
  color: var(--chat-blue);
  font-size: 11px;
  font-weight: 700;
  box-shadow: 0 3px 10px #08265c12;
  cursor: pointer;
}

.chat-attachment {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  gap: 5px;
  padding: 5px 7px;
  border: 1px solid #b7c8e5;
  border-radius: 7px;
  background: var(--surface);
  color: var(--chat-blue);
  font-size: 10px;
  font-weight: 700;
  overflow-wrap: anywhere;
  cursor: pointer;
}

.chat-file-picker { display: inline-flex; align-items: center; gap: 5px; margin-top: 7px; color: var(--chat-blue); font-size: 11px; font-weight: 700; cursor: pointer; }
.chat-file-picker input { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
.chat-file-limit { margin-inline-start: 8px; color: var(--text-secondary); font-size: 10px; }
.chat-file-summary { display: flex; justify-content: space-between; margin-top: 5px; color: var(--chat-muted); font-size: 10px; }
.chat-file-summary button { border: 0; background: transparent; color: var(--chat-blue); font-weight: 700; cursor: pointer; }
.chat-history { padding: 6px 10px; }

.chat-history-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 12px;
  padding: 14px 9px;
  border: 0;
  border-bottom: 1px solid var(--chat-line);
  background: var(--surface);
  text-align: start;
  cursor: pointer;
}

.chat-history-item:hover { background: var(--surface); }
.chat-history-item span:first-child { display: grid; gap: 4px; }
.chat-history-item strong { color: var(--text-primary); font-size: 12px; }
.chat-history-item small { color: var(--text-secondary); font-size: 11px; }
.chat-history-status { padding: 4px 7px; border-radius: 6px; background: var(--chat-pale); color: var(--text-secondary); font-size: 10px; text-transform: capitalize; }
.chat-error { margin: 7px 12px 0; padding: 8px 10px; border-radius: 7px; background: var(--surface-muted); color: #9d2332; font-size: 11px; }
.chat-connection { padding: 4px 12px; color: var(--text-secondary); font-size: 11px; }
.chat-composer { padding: 10px 12px 8px; border-top: 1px solid var(--chat-line); background: var(--surface); }

.chat-composer textarea {
  display: block;
  resize: none;
  width: 100%;
  min-height: 54px;
  max-height: 120px;
  padding: 8px 10px;
  border: 1px solid var(--chat-line);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text-primary);
  font: inherit;
  font-size: 13px;
  line-height: 1.45;
}

.chat-composer-bottom { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 7px; color: var(--text-secondary); font-size: 10px; }

.chat-send {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 78px;
  min-height: 38px;
  padding: 6px 13px;
  border: 0;
  border-radius: 8px;
  background: var(--chat-blue);
  color: white;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.chat-send:hover:not(:disabled) { background: #0344ba; }
.chat-send:disabled { cursor: not-allowed; opacity: .5; }
.chat-closed { display: grid; gap: 10px; padding: 14px; border-top: 1px solid var(--chat-line); color: var(--text-secondary); font-size: 12px; }
.chat-closed strong { color: var(--text-primary); font-size: 13px; }
.chat-feedback-choice { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.chat-feedback-choice button { min-height: 38px; border: 1px solid var(--chat-line); border-radius: 7px; background: var(--surface); color: var(--text-primary); font-weight: 700; cursor: pointer; }
.chat-feedback-choice button.selected { border-color: var(--chat-blue); background: var(--chat-pale); color: var(--chat-blue); }
.chat-rating { display: flex; gap: 4px; }
.chat-rating button { min-width: 34px; min-height: 34px; border: 0; background: transparent; color: #a0a9b5; font-size: 22px; line-height: 1; cursor: pointer; }
.chat-rating button.selected { color: #e3a800; }
.chat-feedback-submit { justify-self: start; min-height: 36px; padding: 6px 12px; border: 0; border-radius: 7px; background: var(--chat-blue); color: white; font-size: 11px; font-weight: 700; cursor: pointer; }
.chat-feedback-submit:disabled { cursor: not-allowed; opacity: .5; }
.chat-new-conversation { justify-self: start; min-height: 32px; padding: 0; border: 0; background: transparent; color: var(--chat-blue); font-size: 11px; font-weight: 700; cursor: pointer; }
.chat-footer { padding: 5px 12px 8px; text-align: center; }
.chat-footer button { min-height: 30px; border: 0; background: transparent; color: var(--chat-muted); font-size: 10px; text-decoration: underline; cursor: pointer; }
.chat-footer button:hover { color: var(--chat-blue); }

@media (max-width: 640px) {
  .chat-launcher { inset-inline-end: 15px; bottom: calc(82px + env(safe-area-inset-bottom)); min-height: 46px; padding: 0 14px; }
  .chat-panel { inset: 0; inset-inline-end: 0; bottom: 0; width: 100vw; height: var(--chat-viewport-height, 100dvh); max-height: none; border: 0; border-radius: 0; box-shadow: none; }
  .chat-header { padding-top: max(13px, env(safe-area-inset-top)); }
  .chat-icon-button,
  .chat-panel button { min-height: 44px; }
  .chat-composer { padding-bottom: max(8px, env(safe-area-inset-bottom)); }
  .chat-composer textarea,
  .chat-panel input,
  .chat-panel select { font-size: 16px; }
  .chat-intro { padding: 24px 20px; }
  .chat-message { max-width: 88%; }
  .chat-toolbar-actions { gap: 8px; }
}
</style>
