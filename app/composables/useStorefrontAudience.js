import { readonly, ref } from 'vue'

export const STOREFRONT_AUDIENCE_UNKNOWN = 'unknown'
export const STOREFRONT_AUDIENCE_ELIGIBLE = 'eligible'
export const STOREFRONT_AUDIENCE_EXCLUDED = 'excluded'

const audienceStatus = ref(STOREFRONT_AUDIENCE_UNKNOWN)
const audienceAccessToken = ref('')
const audienceListeners = new Set()
const INTERNAL_SESSION_CLAIM_RETRY_DELAYS_MS = [750, 2500]

let audienceClient
let authSubscription
let initializationStarted = false
let currentUserId = ''
let currentLookupPromise
let lookupGeneration = 0
let internalSessionClaimTimerId

const clearInternalSessionClaimRetry = () => {
  if (!import.meta.client || internalSessionClaimTimerId === undefined) {
    return
  }

  window.clearTimeout(internalSessionClaimTimerId)
  internalSessionClaimTimerId = undefined
}

const claimInternalStorefrontSession = async (accessToken) => {
  if (!import.meta.client || !accessToken) {
    return false
  }

  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => {
    controller.abort()
  }, 2000)

  try {
    const response = await window.fetch('/api/analytics/identity', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`
      },
      credentials: 'same-origin',
      signal: controller.signal
    })

    if (!response.ok) {
      return false
    }

    const payload = await response.json()
    return payload?.excluded === true
  } catch {
    return false
  } finally {
    window.clearTimeout(timeoutId)
  }
}

const claimInternalStorefrontSessionWithRetry = async ({
  userId,
  generation,
  attempt = 0
}) => {
  if (
    !import.meta.client
    || generation !== lookupGeneration
    || userId !== currentUserId
    || audienceStatus.value !== STOREFRONT_AUDIENCE_EXCLUDED
  ) {
    return
  }

  const claimed = await claimInternalStorefrontSession(
    audienceAccessToken.value
  )

  if (
    claimed
    || generation !== lookupGeneration
    || userId !== currentUserId
  ) {
    return
  }

  const retryDelay = INTERNAL_SESSION_CLAIM_RETRY_DELAYS_MS[attempt]

  if (retryDelay === undefined) {
    return
  }

  internalSessionClaimTimerId = window.setTimeout(() => {
    internalSessionClaimTimerId = undefined
    void claimInternalStorefrontSessionWithRetry({
      userId,
      generation,
      attempt: attempt + 1
    })
  }, retryDelay)
}

const notifyAudienceListeners = () => {
  audienceListeners.forEach((listener) => {
    try {
      listener(audienceStatus.value)
    } catch {
      // Eligibility listeners must not affect authentication.
    }
  })
}

const setAudienceStatus = (status) => {
  if (audienceStatus.value === status) {
    return
  }

  audienceStatus.value = status
  notifyAudienceListeners()
}

const resolveAudienceForSession = async (session) => {
  const nextUserId = String(session?.user?.id || '').trim()
  audienceAccessToken.value = String(session?.access_token || '')

  if (!nextUserId) {
    clearInternalSessionClaimRetry()
    lookupGeneration += 1
    currentUserId = ''
    currentLookupPromise = undefined
    setAudienceStatus(STOREFRONT_AUDIENCE_ELIGIBLE)
    return STOREFRONT_AUDIENCE_ELIGIBLE
  }

  if (nextUserId === currentUserId) {
    if (currentLookupPromise) {
      return currentLookupPromise
    }

    if (audienceStatus.value !== STOREFRONT_AUDIENCE_UNKNOWN) {
      return audienceStatus.value
    }
  }

  clearInternalSessionClaimRetry()
  currentUserId = nextUserId
  const currentGeneration = ++lookupGeneration
  setAudienceStatus(STOREFRONT_AUDIENCE_UNKNOWN)

  currentLookupPromise = (async () => {
    try {
      const { data, error } = await audienceClient
        .from('admin_users')
        .select('id')
        .eq('id', nextUserId)
        .maybeSingle()

      if (currentGeneration !== lookupGeneration || nextUserId !== currentUserId) {
        return audienceStatus.value
      }

      if (error) {
        setAudienceStatus(STOREFRONT_AUDIENCE_EXCLUDED)
        return STOREFRONT_AUDIENCE_EXCLUDED
      }

      const nextStatus = data?.id
        ? STOREFRONT_AUDIENCE_EXCLUDED
        : STOREFRONT_AUDIENCE_ELIGIBLE
      setAudienceStatus(nextStatus)

      if (data?.id) {
        // Tracking stops immediately. This no-event claim runs in the
        // background and retries only twice after transient failures.
        void claimInternalStorefrontSessionWithRetry({
          userId: nextUserId,
          generation: currentGeneration
        })
      }

      return nextStatus
    } catch {
      if (currentGeneration === lookupGeneration && nextUserId === currentUserId) {
        setAudienceStatus(STOREFRONT_AUDIENCE_EXCLUDED)
      }

      return STOREFRONT_AUDIENCE_EXCLUDED
    } finally {
      if (currentGeneration === lookupGeneration) {
        currentLookupPromise = undefined
      }
    }
  })()

  return currentLookupPromise
}

const initializeStorefrontAudience = () => {
  if (!import.meta.client || initializationStarted) {
    return
  }

  initializationStarted = true

  try {
    audienceClient = useSupabaseClient()

    const { data } = audienceClient.auth.onAuthStateChange((_event, session) => {
      audienceAccessToken.value = String(session?.access_token || '')
      const nextUserId = String(session?.user?.id || '').trim()

      if (nextUserId !== currentUserId) {
        setAudienceStatus(STOREFRONT_AUDIENCE_UNKNOWN)
      }

      window.setTimeout(() => {
        void resolveAudienceForSession(session)
      }, 0)
    })

    authSubscription = data.subscription

    void audienceClient.auth.getSession()
      .then(({ data: sessionData, error }) => {
        if (error) {
          setAudienceStatus(STOREFRONT_AUDIENCE_EXCLUDED)
          return
        }

        return resolveAudienceForSession(sessionData.session)
      })
      .catch(() => {
        setAudienceStatus(STOREFRONT_AUDIENCE_EXCLUDED)
      })
  } catch {
    setAudienceStatus(STOREFRONT_AUDIENCE_EXCLUDED)
  }
}

export const getStorefrontAudienceStatus = () => audienceStatus.value

export const getStorefrontAudienceAccessToken = () => audienceAccessToken.value

export const subscribeStorefrontAudience = (listener) => {
  if (typeof listener !== 'function') {
    return () => {}
  }

  audienceListeners.add(listener)
  listener(audienceStatus.value)

  return () => {
    audienceListeners.delete(listener)
  }
}

export const useStorefrontAudience = () => {
  initializeStorefrontAudience()

  return {
    status: readonly(audienceStatus),
    accessToken: readonly(audienceAccessToken)
  }
}
