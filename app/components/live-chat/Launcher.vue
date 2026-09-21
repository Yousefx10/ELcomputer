<script setup>
import { chatContactValid, chatMobileValid, chatSecondsRemaining, mergeChatMessages } from '~/utils/liveChat'

const route = useRoute()
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
const customerMobile = ref('')
const accountContact = ref(null)
const orders = ref([])
const orderNumber = ref('')
const selectedOrderId = ref('')
const orderBusy = ref(false)
const guestToLink = ref(null)
const conversationAttachmentPolicy = ref(null)
const selectedFiles = shallowRef([])
const fileInput = ref(null)
const staffTyping = ref(false)
const newBelow = ref(false)
const lastOwnSentAt = ref(null)
const clock = ref(Date.now())
const connectionState = ref('idle')
const launcher = ref(null)
const closeButton = ref(null)
const messageList = ref(null)
const composer = ref(null)
const visible = computed(() => status.value.enabled && !route.path.startsWith('/checkout'))
const isGuest = computed(() => actor.value?.kind !== 'customer')
const needsCustomerMobile = computed(() => !isGuest.value
  && ['mobile', 'both'].includes(status.value.guestContactRule)
  && !accountContact.value?.mobile)
const cooldown = computed(() => chatSecondsRemaining(lastOwnSentAt.value, status.value.cooldownSeconds, clock.value))
const maxLength = computed(() => Number(status.value.maxMessageLength || 4000))
const canSend = computed(() => !sending.value && !cooldown.value && draft.value.trim().length > 0
  && draft.value.length <= maxLength.value)
const heading = computed(() => status.value.available ? 'Live support' : 'Leave a message')
const statusCopy = computed(() => status.value.available ? 'A support agent is online.' : 'Our team will reply when available.')
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

let channel = null
let authSubscription = null
let refreshTimer = null
let tickTimer = null
let statusTimer = null
let runId = 0
let selectionId = 0
let syncInProgress = false
let syncAgain = false
let pendingStart = null
let pendingSend = null
let previousBodyOverflow = ''
let chatHistoryEntry = false
let typingTimer = null
let lastTypingAt = 0
let readPending = false

const requestError = (error, fallback) => error?.data?.statusMessage
  || error?.statusMessage || error?.message || fallback

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
  customerMobile.value = ''
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
const unlockBody = () => { document.body.style.overflow = previousBodyOverflow }
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
    previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.history.pushState({ ...window.history.state, elChatPanel: true }, '', window.location.href)
    chatHistoryEntry = true
  }
  await nextTick()
  closeButton.value?.focus()
  await loadStatus()
  if (!status.value.enabled) { closePanel(); return }
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
  if (needsCustomerMobile.value && !chatMobileValid(customerMobile.value)) {
    errorText.value = 'Enter a valid mobile number.'
    return
  }
  const fingerprint = JSON.stringify([text, guestName.value, guestEmail.value,
    guestMobile.value, customerMobile.value, selectedOrderId.value])
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
        } : needsCustomerMobile.value ? { mobile: customerMobile.value } : {})
      }
    })
    if (currentRun !== runId) return
    pendingStart = null
    if (draft.value.trim() === text) draft.value = ''
    conversations.value = [result.item, ...conversations.value.filter(item => item.id !== result.item.id)]
    const uploaded = result.messageId && selectedFiles.value.length
      ? await uploadSelectedFiles(result.item.id, result.messageId) : { items: [], failed: false }
    if (currentRun !== runId) return
    await selectConversation(result.item)
    if (uploaded.failed) errorText.value = 'Message sent. Some attachments could not be uploaded.'
  } catch (error) {
    if (currentRun === runId) errorText.value = requestError(error, 'Could not save your message. Try again.')
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
  await navigateTo('/help')
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
  const focusable = [...document.querySelectorAll('#live-chat-panel button:not(:disabled), #live-chat-panel input:not(:disabled), #live-chat-panel textarea:not(:disabled)')]
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
watch([draft, guestName, guestEmail, guestMobile, customerMobile, selectedOrderId], () => {
  sendTyping()
  if (pendingSend?.text !== draft.value.trim()) pendingSend = null
  if (pendingStart?.fingerprint !== JSON.stringify([
    draft.value.trim(), guestName.value, guestEmail.value, guestMobile.value,
    customerMobile.value, selectedOrderId.value
  ])) pendingStart = null
})

onMounted(() => {
  loadStatus().then(loadInitialUnread)
  tickTimer = setInterval(() => { clock.value = Date.now() }, 500)
  statusTimer = setInterval(loadStatus, 60000)
  window.addEventListener('focus', onWindowFocus)
  window.addEventListener('online', onWindowFocus)
  window.addEventListener('popstate', onPopState)
  window.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  if (tickTimer) clearInterval(tickTimer)
  if (statusTimer) clearInterval(statusTimer)
  if (refreshTimer) clearTimeout(refreshTimer)
  if (typingTimer) clearTimeout(typingTimer)
  window.removeEventListener('focus', onWindowFocus)
  window.removeEventListener('online', onWindowFocus)
  window.removeEventListener('popstate', onPopState)
  window.removeEventListener('keydown', onKeydown)
  if (panelOpen.value) unlockBody()
  clearSubscription()
})
</script>

<template>
  <div v-if="visible" class="chat-root">
    <button ref="launcher" class="chat-launcher" type="button" aria-label="Live support"
      :aria-expanded="panelOpen" aria-controls="live-chat-panel" @click="panelOpen ? closePanel() : openPanel()">
      <Icon :name="panelOpen ? 'lucide:x' : 'lucide:message-circle'" size="23" aria-hidden="true" />
      <span>Support</span>
      <span v-if="unreadTotal" class="chat-badge" :aria-label="`${unreadTotal} unread replies`">{{ unreadTotal > 9 ? '9+' : unreadTotal }}</span>
    </button>

    <section v-show="panelOpen" id="live-chat-panel" class="chat-panel" role="dialog"
      :aria-modal="mobilePanel ? 'true' : undefined"
      aria-label="Live support conversation">
      <header class="chat-header">
        <div class="chat-title-wrap">
          <span class="chat-header-icon"><Icon name="lucide:headset" size="19" aria-hidden="true" /></span>
          <div>
            <h2>{{ heading }}</h2>
            <p><span class="chat-status-dot" :class="{ online: status.available }" />{{ statusCopy }}</p>
          </div>
        </div>
        <button ref="closeButton" type="button" class="chat-icon-button chat-header-close"
          aria-label="Close live support" @click="closePanel">
          <Icon name="lucide:x" size="20" aria-hidden="true" />
        </button>
      </header>

      <div class="chat-toolbar">
        <button v-if="screen === 'history'" type="button" class="chat-text-button" @click="backFromHistory">
          <Icon name="lucide:arrow-left" size="16" aria-hidden="true" /> Back
        </button>
        <span v-else class="chat-toolbar-label">{{ showThread ? `Conversation #${conversation.reference_number}` : 'How can we help?' }}</span>
        <button v-if="conversations.length && screen !== 'history'" type="button" class="chat-text-button" @click="showHistory">
          History
        </button>
      </div>

      <div v-if="guestToLink && actor?.kind === 'customer'" class="chat-account-link">
        <span>Move guest chat #{{ guestToLink.chat.reference_number }} to this account?</span>
        <button type="button" :disabled="orderBusy" @click="linkGuestChat">Move chat</button>
      </div>

      <div v-if="loading" class="chat-center" role="status">Loading your conversation…</div>

      <template v-else-if="screen === 'history'">
        <div class="chat-scroll chat-history" aria-label="Previous conversations">
          <button v-for="item in conversations" :key="item.id" type="button" class="chat-history-item"
            @click="selectConversation(item)">
            <span><strong>Conversation #{{ item.reference_number }}</strong><small>{{ new Date(item.created_at).toLocaleDateString() }}</small></span>
            <span class="chat-history-status">{{ item.unreadCount ? `${item.unreadCount} new` : item.status }}</span>
          </button>
          <p v-if="!conversations.length" class="chat-muted">No previous chats.</p>
        </div>
      </template>

      <template v-else-if="showThread">
        <div v-if="actor?.kind === 'customer' && conversation.status !== 'closed' && !conversation.ticket_id" class="chat-order-link">
          <span>{{ conversation.order_id ? 'Order linked' : 'No order linked' }}</span>
          <select v-model="selectedOrderId" aria-label="Choose your order"><option value="">Choose an order</option><option v-for="order in orderChoices" :key="order.id" :value="order.id">#{{ order.order_number || order.id.slice(0, 8) }} · {{ order.status }}</option></select>
          <button type="button" :disabled="orderBusy || !selectedOrderId || selectedOrderId === conversation.order_id" @click="setOrder(selectedOrderId)">Link</button>
          <button v-if="conversation.order_id" type="button" :disabled="orderBusy" @click="setOrder(null)">Unlink</button>
          <input v-model="orderNumber" maxlength="64" aria-label="Find order number" placeholder="Order number" />
          <button type="button" :disabled="orderBusy" @click="searchOrders">Find</button>
        </div>
        <p v-else-if="actor?.kind === 'customer' && conversation.ticket_id" class="chat-intake-note">The related order is now managed on your support ticket.</p>
        <div ref="messageList" class="chat-scroll chat-messages" aria-label="Chat messages" aria-live="polite" @scroll.passive="markVisibleRead">
          <button v-if="hasOlder" type="button" class="chat-load-more" :disabled="loadingOlder" @click="loadOlder">
            {{ loadingOlder ? 'Loading…' : 'Load earlier messages' }}
          </button>
          <p v-if="conversation.intake_mode === 'offline'" class="chat-intake-note">{{ conversation.ticket_id ? 'Your message is saved as a support ticket.' : 'Your message is saved. Our team will reply when available.' }}</p>
          <div v-for="message in messages" :key="message.id" class="chat-message"
            :class="message.sender_kind === 'staff' ? 'from-support' : 'from-customer'">
            <span class="chat-message-sender">{{ message.sender_kind === 'staff' ? 'Support' : 'You' }}</span>
            <p>{{ message.body }}</p>
            <button v-for="file in message.attachments || []" :key="file.id" type="button"
              class="chat-attachment" @click="downloadFile(file)">
              <Icon name="lucide:paperclip" size="13" aria-hidden="true" />
              {{ file.original_name }}
            </button>
            <time :datetime="message.created_at">{{ new Date(message.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) }}</time>
          </div>
          <p v-if="!messages.length" class="chat-muted">No messages yet.</p>
        </div>
        <p v-if="staffTyping" class="chat-connection" role="status">Support is typing…</p>
        <button v-if="newBelow" type="button" class="chat-new-below" @click="scrollBottom">New message ↓</button>
      </template>

      <div v-else class="chat-scroll chat-intro">
        <div class="chat-welcome-icon"><Icon name="lucide:messages-square" size="25" aria-hidden="true" /></div>
        <h3>{{ status.available ? 'Hi! How can we help?' : 'We’re here to help.' }}</h3>
        <p>{{ status.available ? status.welcomeMessage : status.offlineMessage }}</p>
        <div v-if="isGuest" class="chat-contact-fields">
          <label for="chat-name">Name <span aria-hidden="true">*</span></label>
          <input id="chat-name" v-model="guestName" autocomplete="name" maxlength="160" placeholder="Your name" />
          <label for="chat-email">Email</label>
          <input id="chat-email" v-model="guestEmail" type="email" autocomplete="email" maxlength="320" placeholder="you@example.com" />
          <label for="chat-mobile">Mobile</label>
          <input id="chat-mobile" v-model="guestMobile" type="tel" autocomplete="tel" maxlength="30" placeholder="Your mobile number" />
          <small v-if="status.guestContactRule === 'both'">Enter both email and mobile.</small>
          <small v-else-if="status.guestContactRule === 'email'">Enter your email.</small>
          <small v-else-if="status.guestContactRule === 'mobile'">Enter your mobile number.</small>
          <small v-else>Enter an email or mobile number.</small>
        </div>
        <div v-else-if="needsCustomerMobile" class="chat-contact-fields">
          <label for="chat-customer-mobile">Mobile</label>
          <input id="chat-customer-mobile" v-model="customerMobile" type="tel" autocomplete="tel"
            maxlength="30" placeholder="Your mobile number" />
          <small>We need a mobile number to reply.</small>
        </div>
        <div v-if="actor?.kind === 'customer'" class="chat-order-link">
          <label for="chat-order-start">Related order (optional)</label>
          <select id="chat-order-start" v-model="selectedOrderId"><option value="">No order</option><option v-for="order in orderChoices" :key="order.id" :value="order.id">#{{ order.order_number || order.id.slice(0, 8) }} · {{ order.status }}</option></select>
          <input v-model="orderNumber" maxlength="64" aria-label="Find order number" placeholder="Order number" />
          <button type="button" @click="searchOrders">Find order</button>
        </div>
      </div>

      <div v-if="errorText" class="chat-error" role="alert">{{ errorText }}</div>
      <div v-if="showThread && connectionState === 'reconnecting'" class="chat-connection" role="status">Reconnecting. Messages are saved.</div>

      <div v-if="screen !== 'history' && (!conversation || conversation.status !== 'closed')" class="chat-composer">
        <label for="chat-message" class="sr-only">Your message</label>
        <textarea id="chat-message" ref="composer" v-model="draft" rows="2" :maxlength="maxLength"
          :placeholder="showThread ? 'Write a message…' : 'What can we help with?'"
          @keydown="onComposerKeydown" />
        <div class="chat-composer-bottom">
          <span v-if="cooldown">Send again in {{ cooldown }}s</span>
          <span v-else>{{ draft.length }}/{{ maxLength }}</span>
          <button type="button" class="chat-send" :disabled="!canSend" @click="submitDraft">
            {{ sending ? 'Sending…' : (showThread ? 'Send' : 'Start chat') }}
            <Icon name="lucide:arrow-up" size="17" aria-hidden="true" />
          </button>
        </div>
        <label v-if="attachmentPolicy.enabled" class="chat-file-picker">
          <Icon name="lucide:paperclip" size="14" aria-hidden="true" /> Attach files
          <input ref="fileInput" type="file" multiple :accept="attachmentAccept"
            :disabled="sending" @change="chooseFiles" />
        </label>
        <span v-if="attachmentPolicy.enabled && !selectedFiles.length" class="chat-file-limit">{{ attachmentLimitText }}</span>
        <span v-if="selectedFiles.length" class="chat-file-summary">
          {{ selectedFiles.length }} {{ selectedFiles.length === 1 ? 'file' : 'files' }} selected
          <button type="button" :disabled="sending" @click="clearFiles">Clear</button>
        </span>
      </div>
      <div v-else-if="conversation?.status === 'closed' && screen === 'thread'" class="chat-closed">
        <span>This conversation is closed.</span>
        <button type="button" @click="newConversation">Start a new chat</button>
      </div>
      <div class="chat-footer"><button type="button" @click="goToHelp">Browse the Help Center</button></div>
    </section>
  </div>
</template>

<style scoped>
.chat-root{--chat-blue:#174a97;--chat-navy:#102b53;font-family:inherit}
.chat-account-link,.chat-order-link{display:flex;flex-wrap:wrap;align-items:center;gap:7px;padding:8px 12px;border-bottom:1px solid #e8edf5;background:#f8fafc;font-size:11px}.chat-account-link button,.chat-order-link button{border:0;background:transparent;color:var(--chat-blue);font-weight:700;cursor:pointer}.chat-order-link input,.chat-order-link select{min-width:0;max-width:150px;padding:5px;border:1px solid #cad5e5;border-radius:7px;background:white}
.chat-attachment{display:inline-flex;align-items:center;max-width:100%;gap:5px;padding:5px 7px;border:1px solid #bfd1ec;border-radius:8px;background:white;color:#174a97;font-size:10px;font-weight:700;overflow-wrap:anywhere;cursor:pointer}.chat-file-picker{display:inline-flex;align-items:center;gap:5px;margin-top:7px;color:var(--chat-blue);font-size:11px;font-weight:700;cursor:pointer}.chat-file-picker input{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}.chat-file-limit{margin-left:8px;color:#718096;font-size:10px}.chat-file-summary{display:flex;justify-content:space-between;margin-top:5px;color:#607187;font-size:10px}.chat-file-summary button{border:0;background:transparent;color:var(--chat-blue);font-weight:700;cursor:pointer}
.chat-launcher{position:fixed;right:22px;bottom:calc(24px + env(safe-area-inset-bottom));z-index:70;display:flex;align-items:center;gap:9px;min-height:50px;padding:0 18px;border:1px solid #174a97;border-radius:999px;background:#174a97;color:white;box-shadow:0 10px 28px #0b2a5860;font-size:14px;font-weight:700;cursor:pointer}
.chat-launcher:hover{background:#123b7a;transform:translateY(-1px)}
.chat-launcher:focus-visible,.chat-panel button:focus-visible,.chat-panel a:focus-visible,.chat-panel input:focus-visible,.chat-panel textarea:focus-visible{outline:3px solid #eebd50;outline-offset:2px}
.chat-badge{position:absolute;top:-7px;right:-7px;display:grid;place-items:center;min-width:22px;height:22px;padding:0 5px;border:2px solid white;border-radius:50%;background:#be2e38;color:white;font-size:11px}
.chat-panel{position:fixed;right:22px;bottom:calc(86px + env(safe-area-inset-bottom));z-index:71;display:flex;flex-direction:column;width:min(390px,calc(100vw - 32px));height:min(600px,calc(100dvh - 112px));overflow:hidden;border:1px solid #d9e2ee;border-radius:20px;background:white;box-shadow:0 18px 65px #102b5340;color:#1c2d47}
.chat-header{display:flex;align-items:center;justify-content:space-between;min-height:76px;padding:15px 17px;background:linear-gradient(120deg,#123968,#1d59a9);color:white}
.chat-title-wrap{display:flex;align-items:center;gap:12px;min-width:0}.chat-header-icon{display:grid;place-items:center;width:39px;height:39px;border:1px solid #ffffff55;border-radius:12px;background:#ffffff21}.chat-header h2{margin:0;font-size:16px;font-weight:750;line-height:1.25}.chat-header p{display:flex;align-items:center;gap:6px;margin:4px 0 0;font-size:11px;color:#e2ecfb}.chat-status-dot{width:7px;height:7px;border-radius:50%;background:#f7c75e}.chat-status-dot.online{background:#66dfac}.chat-icon-button{display:grid;place-items:center;width:35px;height:35px;border:0;border-radius:9px;background:transparent;color:inherit;cursor:pointer}.chat-header-close:hover{background:#ffffff25}
.chat-toolbar{display:flex;align-items:center;justify-content:space-between;min-height:42px;padding:0 17px;border-bottom:1px solid #e8edf5;background:#f8fafc}.chat-toolbar-label{overflow:hidden;color:#607187;font-size:12px;font-weight:650;text-overflow:ellipsis;white-space:nowrap}.chat-text-button{display:inline-flex;align-items:center;gap:4px;padding:7px 2px;border:0;background:transparent;color:var(--chat-blue);font-size:12px;font-weight:700;cursor:pointer}.chat-text-button:hover{text-decoration:underline}
.chat-scroll{min-height:0;flex:1;overflow-y:auto;overscroll-behavior:contain}.chat-center{display:grid;place-items:center;flex:1;color:#64748b;font-size:13px}.chat-intro{padding:22px 22px 14px}.chat-welcome-icon{display:grid;place-items:center;width:48px;height:48px;margin-bottom:14px;border-radius:15px;background:#eaf2ff;color:var(--chat-blue)}.chat-intro h3{margin:0 0 6px;font-size:18px;font-weight:750;color:var(--chat-navy)}.chat-intro>p{margin:0;color:#576a83;font-size:13px;line-height:1.55}.chat-contact-fields{display:grid;gap:6px;margin-top:20px}.chat-contact-fields label{margin-top:5px;font-size:12px;font-weight:700;color:#344863}.chat-contact-fields input{width:100%;min-height:39px;padding:8px 10px;border:1px solid #cad5e5;border-radius:9px;background:white;color:#1c2d47;font-size:13px}.chat-contact-fields small{color:#697b91;font-size:11px}
.chat-messages{display:flex;flex-direction:column;gap:12px;padding:16px}.chat-intake-note{align-self:center;max-width:90%;margin:0 0 4px;padding:8px 11px;border-radius:10px;background:#eef5ff;color:#3e597a;text-align:center;font-size:11px;line-height:1.4}.chat-message{display:flex;flex-direction:column;max-width:84%;gap:3px}.chat-message.from-customer{align-self:flex-end;align-items:flex-end}.chat-message.from-support{align-self:flex-start;align-items:flex-start}.chat-message-sender{padding:0 4px;color:#586b82;font-size:10px;font-weight:700}.chat-message p{max-width:100%;margin:0;padding:10px 13px;border-radius:14px;background:#edf2f8;color:#223850;font-size:13px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}.chat-message.from-customer p{border-bottom-right-radius:4px;background:#174a97;color:white}.chat-message.from-support p{border-bottom-left-radius:4px}.chat-message time{padding:0 4px;color:#73849a;font-size:10px}.chat-load-more{align-self:center;padding:5px 10px;border:0;background:transparent;color:var(--chat-blue);font-size:11px;font-weight:700;cursor:pointer}.chat-muted{margin:auto;color:#718096;text-align:center;font-size:12px}.chat-new-below{align-self:center;margin-bottom:7px;padding:6px 12px;border:1px solid #bfd1ec;border-radius:999px;background:white;color:var(--chat-blue);font-size:11px;font-weight:700;box-shadow:0 3px 10px #102b531c;cursor:pointer}
.chat-history{padding:6px 10px}.chat-history-item{display:flex;align-items:center;justify-content:space-between;width:100%;gap:12px;padding:14px 9px;border:0;border-bottom:1px solid #e8edf5;background:white;text-align:left;cursor:pointer}.chat-history-item:hover{background:#f4f8fe}.chat-history-item span:first-child{display:grid;gap:4px}.chat-history-item strong{font-size:12px;color:#233a56}.chat-history-item small{font-size:11px;color:#718096}.chat-history-status{padding:4px 7px;border-radius:7px;background:#edf2f8;color:#4e6480;font-size:10px;text-transform:capitalize}
.chat-error{margin:7px 12px 0;padding:8px 10px;border-radius:8px;background:#fff1f2;color:#9d2332;font-size:11px}.chat-connection{padding:4px 12px;color:#8a5c08;font-size:11px}.chat-composer{padding:10px 12px 8px;border-top:1px solid #e5ebf4;background:white}.chat-composer textarea{display:block;resize:none;width:100%;min-height:54px;max-height:120px;padding:8px 10px;border:1px solid #cbd7e6;border-radius:10px;background:#fbfcfe;color:#1e3048;font:inherit;font-size:13px;line-height:1.45}.chat-composer-bottom{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:7px;color:#6f8094;font-size:10px}.chat-send{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-width:80px;min-height:34px;padding:6px 10px;border:0;border-radius:9px;background:var(--chat-blue);color:white;font-size:12px;font-weight:700;cursor:pointer}.chat-send:hover:not(:disabled){background:#123b7a}.chat-send:disabled{cursor:not-allowed;opacity:.5}.chat-closed{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:13px;border-top:1px solid #e5ebf4;color:#61738b;font-size:11px}.chat-closed button{border:0;background:transparent;color:var(--chat-blue);font-size:11px;font-weight:700;cursor:pointer}.chat-footer{padding:5px 12px 8px;text-align:center}.chat-footer button{border:0;background:transparent;color:#60738d;font-size:10px;text-decoration:underline;cursor:pointer}.chat-footer button:hover{color:var(--chat-blue)}
@media(max-width:640px){.chat-launcher{right:15px;bottom:calc(82px + env(safe-area-inset-bottom));min-height:48px;padding:0 15px}.chat-panel{inset:0;right:0;bottom:0;width:100vw;height:100dvh;max-height:none;border:0;border-radius:0;box-shadow:none}.chat-header{padding-top:max(15px,env(safe-area-inset-top))}.chat-composer{padding-bottom:max(8px,env(safe-area-inset-bottom))}.chat-intro{padding:24px 20px}.chat-message{max-width:82%}}
@media(prefers-reduced-motion:no-preference){.chat-launcher{transition:background .16s ease,transform .16s ease}.chat-panel{animation:chat-appear .18s ease-out}@keyframes chat-appear{from{opacity:.7;transform:translateY(7px)}to{opacity:1;transform:translateY(0)}}}
</style>
