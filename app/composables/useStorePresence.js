import {
  getStorefrontAudienceAccessToken,
  STOREFRONT_AUDIENCE_ELIGIBLE,
  subscribeStorefrontAudience,
  useStorefrontAudience
} from './useStorefrontAudience'
import { isStoreAnalyticsAllowed } from './useStoreAnalytics'

const PRESENCE_ENDPOINT = '/api/analytics/presence'
const PRESENCE_INITIAL_DELAY_MS = 30 * 1000
const PRESENCE_HEARTBEAT_MS = 60 * 1000
const PRESENCE_REQUEST_TIMEOUT_MS = 5 * 1000

let presenceEnabled = false
let presenceRequestInFlight = false
let presenceTimerId
let presenceListenersRegistered = false
let audienceSubscriptionRegistered = false

const clearPresenceTimer = () => {
  if (import.meta.client && presenceTimerId !== undefined) {
    window.clearTimeout(presenceTimerId)
  }

  presenceTimerId = undefined
}

const canSendPresence = () => {
  return import.meta.client
    && presenceEnabled
    && document.visibilityState === 'visible'
    && isStoreAnalyticsAllowed()
}

const schedulePresenceHeartbeat = (delay = PRESENCE_HEARTBEAT_MS) => {
  clearPresenceTimer()

  if (!canSendPresence()) {
    return
  }

  presenceTimerId = window.setTimeout(() => {
    presenceTimerId = undefined
    void sendPresenceHeartbeat()
  }, delay)
}

const sendPresenceHeartbeat = async () => {
  if (!canSendPresence() || presenceRequestInFlight) {
    schedulePresenceHeartbeat()
    return false
  }

  presenceRequestInFlight = true
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => {
    controller.abort()
  }, PRESENCE_REQUEST_TIMEOUT_MS)

  try {
    const accessToken = getStorefrontAudienceAccessToken()
    const headers = {}

    if (accessToken) {
      headers.authorization = `Bearer ${accessToken}`
    }

    const response = await window.fetch(PRESENCE_ENDPOINT, {
      method: 'POST',
      headers,
      credentials: 'same-origin',
      signal: controller.signal
    })

    return response.ok
  } catch {
    return false
  } finally {
    window.clearTimeout(timeoutId)
    presenceRequestInFlight = false
    schedulePresenceHeartbeat()
  }
}

const handleVisibilityChange = () => {
  if (document.visibilityState !== 'visible') {
    clearPresenceTimer()
    return
  }

  if (canSendPresence()) {
    void sendPresenceHeartbeat()
  }
}

const handleAudienceStatusChange = (status) => {
  if (status !== STOREFRONT_AUDIENCE_ELIGIBLE) {
    clearPresenceTimer()
    return
  }

  if (presenceEnabled) {
    schedulePresenceHeartbeat(PRESENCE_INITIAL_DELAY_MS)
  }
}

const ensurePresenceIntegration = () => {
  if (!import.meta.client) {
    return
  }

  useStorefrontAudience()

  if (!presenceListenersRegistered) {
    presenceListenersRegistered = true
    document.addEventListener('visibilitychange', handleVisibilityChange)
  }

  if (!audienceSubscriptionRegistered) {
    audienceSubscriptionRegistered = true
    subscribeStorefrontAudience(handleAudienceStatusChange)
  }
}

export const startStorePresence = () => {
  if (!import.meta.client) {
    return
  }

  presenceEnabled = true
  ensurePresenceIntegration()

  if (canSendPresence() && presenceTimerId === undefined) {
    schedulePresenceHeartbeat(PRESENCE_INITIAL_DELAY_MS)
  }
}

export const stopStorePresence = () => {
  presenceEnabled = false
  clearPresenceTimer()
}
