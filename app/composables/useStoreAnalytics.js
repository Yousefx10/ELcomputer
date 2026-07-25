import {
  getStorefrontAudienceAccessToken,
  getStorefrontAudienceStatus,
  STOREFRONT_AUDIENCE_ELIGIBLE,
  STOREFRONT_AUDIENCE_EXCLUDED,
  STOREFRONT_AUDIENCE_UNKNOWN,
  subscribeStorefrontAudience,
  useStorefrontAudience
} from './useStorefrontAudience'

const ANALYTICS_ENDPOINT = '/api/analytics/events'
const ANALYTICS_BATCH_SIZE = 20
const ANALYTICS_FLUSH_DELAY_MS = 250
const ANALYTICS_ELIGIBILITY_BUFFER_SIZE = 100
const MAX_DURATION_MS = 30 * 60 * 1000
const ALLOWED_EVENT_NAMES = new Set([
  'page_view',
  'product_view',
  'product_dwell',
  'add_to_cart',
  'remove_from_cart',
  'cart_quantity_changed',
  'cart_cleared',
  'checkout_started'
])

let queuedEvents = []
let eligibilityBufferedEntries = []
let flushTimerId
let pageHideListenerRegistered = false
let audienceSubscriptionRegistered = false

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const createStoreAnalyticsId = () => {
  if (import.meta.client && typeof window.crypto?.randomUUID === 'function') {
    return window.crypto.randomUUID()
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const randomValue = Math.floor(Math.random() * 16)
    const value = character === 'x' ? randomValue : ((randomValue & 0x3) | 0x8)
    return value.toString(16)
  })
}

const normalizePath = (value = '') => {
  const path = String(value || '').split(/[?#]/, 1)[0].trim().slice(0, 500)
  const fallbackPath = import.meta.client
    ? String(window.location.pathname || '/').slice(0, 500)
    : '/'
  const normalizedPath = path || fallbackPath

  return normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`
}

const isDashboardPath = (path = '') => {
  const normalizedPath = normalizePath(path)
  return normalizedPath === '/dashboard' || normalizedPath.startsWith('/dashboard/')
}

const isStoreAnalyticsPrivacyAllowed = () => {
  if (!import.meta.client) {
    return false
  }

  const doNotTrackValue = String(
    navigator.doNotTrack
      || window.doNotTrack
      || navigator.msDoNotTrack
      || ''
  ).toLowerCase()

  return navigator.globalPrivacyControl !== true
    && doNotTrackValue !== '1'
    && doNotTrackValue !== 'yes'
}

export const isStoreAnalyticsAllowed = () => {
  return isStoreAnalyticsPrivacyAllowed()
    && getStorefrontAudienceStatus() === STOREFRONT_AUDIENCE_ELIGIBLE
}

const normalizeString = (value, maximumLength) => {
  const normalizedValue = String(value || '').trim()
  return normalizedValue ? normalizedValue.slice(0, maximumLength) : undefined
}

const normalizeUuid = (value) => {
  const normalizedValue = normalizeString(value, 36)
  return normalizedValue && UUID_PATTERN.test(normalizedValue) ? normalizedValue : undefined
}

const normalizeInteger = (value, minimum, maximum) => {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue)) {
    return undefined
  }

  return Math.min(maximum, Math.max(minimum, Math.round(numericValue)))
}

const normalizePositiveInteger = (value, maximum) => {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue) || numericValue < 1) {
    return undefined
  }

  return Math.min(maximum, Math.round(numericValue))
}

const normalizeSource = (value) => {
  const normalizedValue = normalizeString(value, 50)
  return normalizedValue && /^[A-Za-z0-9][A-Za-z0-9_-]{0,49}$/.test(normalizedValue)
    ? normalizedValue
    : undefined
}

const buildAnalyticsEvent = (event = {}) => {
  const eventName = normalizeString(event.eventName, 64)
  const path = normalizePath(event.path)

  if (
    !eventName
    || !ALLOWED_EVENT_NAMES.has(eventName)
    || isDashboardPath(path)
    || !isStoreAnalyticsPrivacyAllowed()
  ) {
    return null
  }

  const normalizedEvent = {
    eventId: normalizeUuid(event.eventId) || createStoreAnalyticsId(),
    eventName,
    path
  }
  const productId = normalizeUuid(event.productId)
  const cartId = normalizeUuid(event.cartId)
  const quantity = normalizePositiveInteger(event.quantity, 999)
  const resultingQuantity = normalizeInteger(event.resultingQuantity, 0, 999)
  const durationMs = normalizeInteger(event.durationMs, 0, MAX_DURATION_MS)
  const source = normalizeSource(event.source)

  if (productId) normalizedEvent.productId = productId
  if (cartId) normalizedEvent.cartId = cartId
  if (quantity !== undefined) normalizedEvent.quantity = quantity
  if (resultingQuantity !== undefined) normalizedEvent.resultingQuantity = resultingQuantity
  if (durationMs !== undefined) normalizedEvent.durationMs = durationMs
  if (source) normalizedEvent.source = source

  return normalizedEvent
}

const sendAnalyticsBatch = async (events, { keepalive = false } = {}) => {
  if (
    !import.meta.client
    || !events.length
    || !isStoreAnalyticsAllowed()
  ) {
    return false
  }

  try {
    const accessToken = getStorefrontAudienceAccessToken()
    const headers = {
      'content-type': 'application/json'
    }

    if (accessToken) {
      headers.authorization = `Bearer ${accessToken}`
    }

    if (getStorefrontAudienceStatus() !== STOREFRONT_AUDIENCE_ELIGIBLE) {
      return false
    }

    const response = await window.fetch(ANALYTICS_ENDPOINT, {
      method: 'POST',
      headers,
      credentials: 'same-origin',
      keepalive,
      body: JSON.stringify({ events })
    })

    return response.ok
  } catch {
    return false
  }
}

export const flushStoreAnalyticsEvents = async ({ keepalive = false } = {}) => {
  if (!import.meta.client) {
    return false
  }

  if (flushTimerId) {
    window.clearTimeout(flushTimerId)
    flushTimerId = undefined
  }

  if (
    !isStoreAnalyticsAllowed()
  ) {
    queuedEvents = []

    if (keepalive) {
      eligibilityBufferedEntries = []
    }

    return false
  }

  const batches = []

  while (queuedEvents.length) {
    batches.push(queuedEvents.splice(0, ANALYTICS_BATCH_SIZE))
  }

  if (!batches.length) {
    return true
  }

  const results = []

  if (keepalive) {
    results.push(...await Promise.all(
      batches.map((batch) => sendAnalyticsBatch(batch, { keepalive: true }))
    ))
  } else {
    // Sequential background batches let the first response establish the
    // server session cookie before a later batch is classified.
    for (const batch of batches) {
      results.push(await sendAnalyticsBatch(batch))
    }
  }

  return results.every(Boolean)
}

const scheduleAnalyticsFlush = () => {
  if (
    !import.meta.client
    || flushTimerId
    || getStorefrontAudienceStatus() !== STOREFRONT_AUDIENCE_ELIGIBLE
  ) {
    return
  }

  flushTimerId = window.setTimeout(() => {
    flushTimerId = undefined
    void flushStoreAnalyticsEvents()
  }, ANALYTICS_FLUSH_DELAY_MS)
}

const ensurePageHideFlush = () => {
  if (!import.meta.client || pageHideListenerRegistered) {
    return
  }

  pageHideListenerRegistered = true
  window.addEventListener('pagehide', () => {
    void flushStoreAnalyticsEvents({ keepalive: true })
  }, { capture: true })
}

const clearScheduledAnalytics = () => {
  if (import.meta.client && flushTimerId) {
    window.clearTimeout(flushTimerId)
  }

  flushTimerId = undefined
  queuedEvents = []
}

const sendImmediateEvents = (events, options = {}) => {
  for (let index = 0; index < events.length; index += ANALYTICS_BATCH_SIZE) {
    void sendAnalyticsBatch(
      events.slice(index, index + ANALYTICS_BATCH_SIZE),
      { keepalive: Boolean(options.keepalive) }
    )
  }
}

const handleAudienceStatusChange = (status) => {
  if (status === STOREFRONT_AUDIENCE_EXCLUDED) {
    clearScheduledAnalytics()
    eligibilityBufferedEntries = []
    return
  }

  if (status === STOREFRONT_AUDIENCE_UNKNOWN) {
    clearScheduledAnalytics()
    eligibilityBufferedEntries = []
    return
  }

  if (status !== STOREFRONT_AUDIENCE_ELIGIBLE || !eligibilityBufferedEntries.length) {
    return
  }

  const pendingEntries = eligibilityBufferedEntries
  eligibilityBufferedEntries = []

  pendingEntries.forEach(({ events, options }) => {
    if (options.immediate) {
      sendImmediateEvents(events, options)
      return
    }

    queuedEvents.push(...events)
  })

  if (queuedEvents.length) {
    scheduleAnalyticsFlush()
  }
}

const ensureAudienceIntegration = () => {
  if (audienceSubscriptionRegistered) {
    return
  }

  audienceSubscriptionRegistered = true
  subscribeStorefrontAudience(handleAudienceStatusChange)
}

const bufferEventsUntilAudienceResolves = (events, options = {}) => {
  if (options.keepalive) {
    return []
  }

  const bufferedEventCount = eligibilityBufferedEntries.reduce((total, entry) => {
    return total + entry.events.length
  }, 0)
  const availableSlots = Math.max(0, ANALYTICS_ELIGIBILITY_BUFFER_SIZE - bufferedEventCount)
  const bufferedEvents = events.slice(0, availableSlots)

  if (bufferedEvents.length) {
    eligibilityBufferedEntries.push({
      events: bufferedEvents,
      options: {
        immediate: Boolean(options.immediate),
        keepalive: false
      }
    })
  }

  return bufferedEvents.map((event) => event.eventId)
}

export const useStoreAnalytics = () => {
  ensureAudienceIntegration()
  useStorefrontAudience()
  ensurePageHideFlush()

  const trackEvents = (events = [], options = {}) => {
    try {
      if (!import.meta.client || !Array.isArray(events) || !isStoreAnalyticsPrivacyAllowed()) {
        return []
      }

      const audienceStatus = getStorefrontAudienceStatus()

      if (audienceStatus === STOREFRONT_AUDIENCE_EXCLUDED) {
        return []
      }

      const normalizedEvents = events
        .map(buildAnalyticsEvent)
        .filter(Boolean)

      if (!normalizedEvents.length) {
        return []
      }

      if (audienceStatus === STOREFRONT_AUDIENCE_UNKNOWN) {
        return bufferEventsUntilAudienceResolves(normalizedEvents, options)
      }

      if (options.immediate || options.keepalive) {
        sendImmediateEvents(normalizedEvents, options)
      } else {
        queuedEvents.push(...normalizedEvents)
        scheduleAnalyticsFlush()
      }

      return normalizedEvents.map((event) => event.eventId)
    } catch {
      return []
    }
  }

  const trackEvent = (eventName, payload = {}, options = {}) => {
    try {
      return trackEvents([{
        ...payload,
        eventName
      }], options)[0] || null
    } catch {
      return null
    }
  }

  return {
    isTrackingAllowed: isStoreAnalyticsAllowed,
    trackEvent,
    trackEvents,
    flushEvents: flushStoreAnalyticsEvents
  }
}
