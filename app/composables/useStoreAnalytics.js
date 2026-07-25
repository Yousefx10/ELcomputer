const ANALYTICS_ENDPOINT = '/api/analytics/events'
const ANALYTICS_BATCH_SIZE = 20
const ANALYTICS_FLUSH_DELAY_MS = 250
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

let analyticsClient
let cachedAccessToken = ''
let accessTokenLoaded = false
let queuedEvents = []
let flushTimerId
let pageHideListenerRegistered = false

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

export const isStoreAnalyticsAllowed = () => {
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
    || !isStoreAnalyticsAllowed()
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

const refreshAccessToken = async () => {
  if (!analyticsClient) {
    accessTokenLoaded = true
    cachedAccessToken = ''
    return ''
  }

  try {
    const { data } = await analyticsClient.auth.getSession()
    cachedAccessToken = data.session?.access_token || ''
  } catch {
    cachedAccessToken = ''
  }

  accessTokenLoaded = true
  return cachedAccessToken
}

const sendAnalyticsBatch = async (events, { keepalive = false } = {}) => {
  if (!import.meta.client || !events.length || !isStoreAnalyticsAllowed()) {
    return false
  }

  try {
    const accessToken = keepalive
      ? cachedAccessToken
      : await refreshAccessToken()
    const headers = {
      'content-type': 'application/json'
    }

    if (accessToken) {
      headers.authorization = `Bearer ${accessToken}`
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

  if (!isStoreAnalyticsAllowed()) {
    queuedEvents = []
    return false
  }

  const batches = []

  while (queuedEvents.length) {
    batches.push(queuedEvents.splice(0, ANALYTICS_BATCH_SIZE))
  }

  if (!batches.length) {
    return true
  }

  const results = await Promise.all(
    batches.map((batch) => sendAnalyticsBatch(batch, { keepalive }))
  )

  return results.every(Boolean)
}

const scheduleAnalyticsFlush = () => {
  if (!import.meta.client || flushTimerId) {
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

export const useStoreAnalytics = () => {
  if (import.meta.client && !analyticsClient) {
    try {
      analyticsClient = useSupabaseClient()
      void refreshAccessToken()
    } catch {
      analyticsClient = undefined
      accessTokenLoaded = true
    }
  }

  ensurePageHideFlush()

  const trackEvents = (events = [], options = {}) => {
    try {
      if (!import.meta.client || !Array.isArray(events) || !isStoreAnalyticsAllowed()) {
        return []
      }

      const normalizedEvents = events
        .map(buildAnalyticsEvent)
        .filter(Boolean)

      if (!normalizedEvents.length) {
        return []
      }

      if (options.immediate || options.keepalive) {
        if (!accessTokenLoaded && !options.keepalive) {
          void refreshAccessToken()
        }

        for (let index = 0; index < normalizedEvents.length; index += ANALYTICS_BATCH_SIZE) {
          void sendAnalyticsBatch(
            normalizedEvents.slice(index, index + ANALYTICS_BATCH_SIZE),
            { keepalive: Boolean(options.keepalive) }
          )
        }
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
