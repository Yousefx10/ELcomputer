import { randomUUID } from 'node:crypto'
import { getCookie, getHeader, setCookie } from 'h3'

export const STORE_ANALYTICS_VISITOR_COOKIE = 'elcomputer_visitor_id'
export const STORE_ANALYTICS_SESSION_COOKIE = 'elcomputer_session_id'
export const STORE_ANALYTICS_VISITOR_MAX_AGE = 60 * 60 * 24 * 365
export const STORE_ANALYTICS_SESSION_MAX_AGE = 60 * 30

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const isStoreAnalyticsUuid = (value) => {
  return UUID_PATTERN.test(String(value || '').trim())
}

export const markStoreAnalyticsInternalCarts = async ({
  supabaseAdmin,
  cartIds = []
}) => {
  const normalizedCartIds = [
    ...new Set(
      cartIds
        .filter(isStoreAnalyticsUuid)
        .map((cartId) => String(cartId).toLowerCase())
    )
  ]

  if (!normalizedCartIds.length) {
    return 0
  }

  const { error } = await supabaseAdmin
    .from('store_analytics_internal_carts')
    .upsert(
      normalizedCartIds.map((cartId) => ({
        cart_id: cartId
      })),
      {
        onConflict: 'cart_id',
        ignoreDuplicates: true
      }
    )

  if (error) {
    throw new Error('Could not exclude an internal cart from analytics.')
  }

  return normalizedCartIds.length
}

const buildCookieOptions = (maxAge) => {
  return {
    httpOnly: true,
    maxAge,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  }
}

const setVisitorCookie = (event, visitorId) => {
  setCookie(
    event,
    STORE_ANALYTICS_VISITOR_COOKIE,
    visitorId,
    buildCookieOptions(STORE_ANALYTICS_VISITOR_MAX_AGE)
  )
}

const setSessionCookie = (event, sessionId) => {
  setCookie(
    event,
    STORE_ANALYTICS_SESSION_COOKIE,
    sessionId,
    buildCookieOptions(STORE_ANALYTICS_SESSION_MAX_AGE)
  )
}

const issueStoreAnalyticsIdentity = (event) => {
  const currentVisitorId = getCookie(event, STORE_ANALYTICS_VISITOR_COOKIE)
  const currentSessionId = getCookie(event, STORE_ANALYTICS_SESSION_COOKIE)
  const visitorId = isStoreAnalyticsUuid(currentVisitorId)
    ? currentVisitorId
    : randomUUID()
  const sessionId = isStoreAnalyticsUuid(currentSessionId)
    ? currentSessionId
    : randomUUID()

  setVisitorCookie(event, visitorId)
  setSessionCookie(event, sessionId)

  return {
    visitorId,
    sessionId
  }
}

export const getOptionalStoreAnalyticsUserId = async (event, supabaseAdmin) => {
  const authorizationHeader = getHeader(event, 'authorization')

  if (
    !authorizationHeader?.startsWith('Bearer ')
    || authorizationHeader.length > 8192
  ) {
    return null
  }

  const accessToken = authorizationHeader.slice('Bearer '.length).trim()

  if (!accessToken) {
    return null
  }

  let authResult

  try {
    authResult = await supabaseAdmin.auth.getUser(accessToken)
  } catch {
    return null
  }

  if (authResult.error || !authResult.data.user) {
    return null
  }

  return authResult.data.user.id
}

const isInternalStoreAnalyticsUser = async (supabaseAdmin, userId) => {
  if (!userId) {
    return false
  }

  const { data, error } = await supabaseAdmin.rpc(
    'store_analytics_is_internal_user',
    {
      p_user_id: userId
    }
  )

  if (error) {
    throw new Error('Could not classify the analytics identity.')
  }

  return data === true
}

const getStoredSession = async (supabaseAdmin, sessionId) => {
  const { data, error } = await supabaseAdmin
    .from('store_analytics_sessions')
    .select('id, visitor_id, user_id, is_internal, started_at, last_seen_at')
    .eq('id', sessionId)
    .maybeSingle()

  if (error) {
    throw new Error('Could not load the analytics session.')
  }

  return data
}

const createStoredSession = async ({
  supabaseAdmin,
  sessionId,
  visitorId,
  userId,
  isInternal,
  observedAt
}) => {
  const { error } = await supabaseAdmin
    .from('store_analytics_sessions')
    .insert({
      id: sessionId,
      visitor_id: visitorId,
      user_id: userId,
      is_internal: Boolean(isInternal),
      started_at: observedAt,
      last_seen_at: observedAt
    })

  if (error && error.code !== '23505') {
    throw new Error('Could not create the analytics session.')
  }
}

const backfillCurrentSessionEvents = async ({
  supabaseAdmin,
  sessionId,
  visitorId,
  userId
}) => {
  const { error: eventsError } = await supabaseAdmin
    .from('store_analytics_events')
    .update({
      user_id: userId
    })
    .eq('session_id', sessionId)
    .eq('visitor_id', visitorId)
    .is('user_id', null)

  if (eventsError) {
    throw new Error('Could not associate the analytics events.')
  }
}

const attachCurrentSessionToUser = async ({
  supabaseAdmin,
  sessionId,
  visitorId,
  userId,
  isInternal,
  observedAt
}) => {
  const { data: attachedSession, error: sessionError } = await supabaseAdmin
    .from('store_analytics_sessions')
    .update({
      user_id: userId,
      is_internal: Boolean(isInternal),
      last_seen_at: observedAt
    })
    .eq('id', sessionId)
    .eq('visitor_id', visitorId)
    .is('user_id', null)
    .select('id, visitor_id, user_id, is_internal, started_at, last_seen_at')
    .maybeSingle()

  if (sessionError) {
    throw new Error('Could not associate the analytics session.')
  }

  if (!attachedSession) {
    return null
  }

  await backfillCurrentSessionEvents({
    supabaseAdmin,
    sessionId,
    visitorId,
    userId
  })

  return attachedSession
}

const storedSessionConflictsWithIdentity = ({
  storedSession,
  visitorId,
  userId
}) => {
  if (!storedSession) {
    return false
  }

  if (String(storedSession.visitor_id) !== String(visitorId)) {
    return true
  }

  if (
    userId
    && storedSession.user_id
    && String(storedSession.user_id) !== String(userId)
  ) {
    return true
  }

  // A request without an authenticated identity starts a new anonymous
  // session. This prevents a real sign-out from keeping the staff flag alive
  // indefinitely through the rolling session cookie.
  return Boolean(!userId && storedSession.user_id)
}

export const ensureStoreAnalyticsSession = async ({
  event,
  supabaseAdmin,
  userId = null
}) => {
  const observedAt = new Date().toISOString()
  const issuedIdentity = issueStoreAnalyticsIdentity(event)
  const visitorId = issuedIdentity.visitorId
  let sessionId = issuedIdentity.sessionId
  let storedSession = await getStoredSession(supabaseAdmin, sessionId)
  let classification
  let sessionWasAttached = false
  let identityEstablished = false

  const getClassification = async () => {
    if (classification === undefined) {
      classification = await isInternalStoreAnalyticsUser(
        supabaseAdmin,
        userId
      )
    }

    return classification
  }

  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (storedSessionConflictsWithIdentity({
      storedSession,
      visitorId,
      userId
    })) {
      sessionId = randomUUID()
      setSessionCookie(event, sessionId)
      storedSession = null
    }

    if (!storedSession) {
      await createStoredSession({
        supabaseAdmin,
        sessionId,
        visitorId,
        userId,
        isInternal: await getClassification(),
        observedAt
      })

      storedSession = await getStoredSession(supabaseAdmin, sessionId)
      continue
    }

    if (userId && !storedSession.user_id) {
      const attachedSession = await attachCurrentSessionToUser({
        supabaseAdmin,
        sessionId,
        visitorId,
        userId,
        isInternal: await getClassification(),
        observedAt
      })

      if (attachedSession) {
        storedSession = attachedSession
        sessionWasAttached = true
        identityEstablished = true
        break
      }

      // Another request claimed the anonymous session first. Reload it so the
      // next iteration can either accept that identity or rotate safely.
      storedSession = await getStoredSession(supabaseAdmin, sessionId)
      continue
    }

    identityEstablished = true
    break
  }

  if (!identityEstablished || !storedSession) {
    throw new Error('Could not initialize the analytics session.')
  }

  if (!sessionWasAttached) {
    let touchQuery = supabaseAdmin
      .from('store_analytics_sessions')
      .update({
        last_seen_at: observedAt
      })
      .eq('id', sessionId)
      .eq('visitor_id', visitorId)
      .lte('last_seen_at', observedAt)

    touchQuery = storedSession.user_id
      ? touchQuery.eq('user_id', storedSession.user_id)
      : touchQuery.is('user_id', null)

    const { data: touchedSession, error: touchError } = await touchQuery
      .select('id, visitor_id, user_id, is_internal, started_at, last_seen_at')
      .maybeSingle()

    if (touchError) {
      throw new Error('Could not update the analytics session.')
    }

    if (!touchedSession) {
      throw new Error('The analytics session identity changed concurrently.')
    }

    storedSession = touchedSession

    if (userId) {
      await backfillCurrentSessionEvents({
        supabaseAdmin,
        sessionId,
        visitorId,
        userId
      })
    }
  }

  return {
    visitorId,
    sessionId,
    userId: userId || null,
    isInternal: Boolean(storedSession.is_internal)
  }
}

export const touchExistingStoreAnalyticsPresence = async ({
  event,
  supabaseAdmin,
  userId = null,
  minimumIntervalSeconds = 45
}) => {
  const visitorId = getCookie(event, STORE_ANALYTICS_VISITOR_COOKIE)
  const sessionId = getCookie(event, STORE_ANALYTICS_SESSION_COOKIE)

  if (!isStoreAnalyticsUuid(visitorId) || !isStoreAnalyticsUuid(sessionId)) {
    return {
      touched: false,
      excluded: false
    }
  }

  const storedSession = await getStoredSession(supabaseAdmin, sessionId)

  if (!storedSession || String(storedSession.visitor_id) !== String(visitorId)) {
    return {
      touched: false,
      excluded: false
    }
  }

  if (storedSession.is_internal) {
    return {
      touched: false,
      excluded: true
    }
  }

  const storedUserId = storedSession.user_id
    ? String(storedSession.user_id)
    : null

  if (storedUserId && storedUserId !== String(userId || '')) {
    return {
      touched: false,
      excluded: false
    }
  }

  if (!storedUserId && userId) {
    const identity = await ensureStoreAnalyticsSession({
      event,
      supabaseAdmin,
      userId
    })

    return {
      touched: !identity.isInternal,
      excluded: identity.isInternal
    }
  }

  // A presence request may refresh an existing server-issued session, but it
  // never creates a session. Store analytics events remain the admission step.
  setSessionCookie(event, sessionId)

  const boundedMinimumIntervalSeconds = Math.max(
    30,
    Math.min(300, Number(minimumIntervalSeconds) || 45)
  )
  const touchCutoff = new Date(
    Date.now() - (boundedMinimumIntervalSeconds * 1000)
  ).toISOString()

  if (Date.parse(storedSession.last_seen_at) > Date.parse(touchCutoff)) {
    return {
      touched: false,
      excluded: false
    }
  }

  const observedAt = new Date().toISOString()
  let touchQuery = supabaseAdmin
    .from('store_analytics_sessions')
    .update({
      last_seen_at: observedAt
    })
    .eq('id', sessionId)
    .eq('visitor_id', visitorId)
    .eq('is_internal', false)
    .lte('last_seen_at', touchCutoff)

  touchQuery = storedUserId
    ? touchQuery.eq('user_id', storedUserId)
    : touchQuery.is('user_id', null)

  const { data: touchedSession, error } = await touchQuery
    .select('id')
    .maybeSingle()

  if (error) {
    throw new Error('Could not update store presence.')
  }

  return {
    touched: Boolean(touchedSession),
    excluded: false
  }
}

export const recordStoreOrderCreated = async ({
  event,
  supabaseAdmin,
  userId,
  orderId,
  cartId = null
}) => {
  if (!isStoreAnalyticsUuid(orderId)) {
    throw new Error('A valid order id is required for analytics.')
  }

  const validatedCartId = isStoreAnalyticsUuid(cartId) ? String(cartId) : null
  const identity = await ensureStoreAnalyticsSession({
    event,
    supabaseAdmin,
    userId
  })

  if (identity.isInternal) {
    if (validatedCartId) {
      await markStoreAnalyticsInternalCarts({
        supabaseAdmin,
        cartIds: [validatedCartId]
      })
    }

    return {
      recorded: false,
      excluded: true
    }
  }

  const { error } = await supabaseAdmin
    .from('store_analytics_events')
    .insert({
      event_id: randomUUID(),
      session_id: identity.sessionId,
      visitor_id: identity.visitorId,
      user_id: identity.userId,
      event_name: 'order_created',
      path: '/checkout',
      cart_id: validatedCartId,
      order_id: orderId,
      source: 'checkout'
    })

  if (error && error.code !== '23505') {
    throw new Error('Could not record the order analytics event.')
  }

  return {
    recorded: !error,
    excluded: false
  }
}
