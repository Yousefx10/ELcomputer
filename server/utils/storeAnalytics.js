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

const getStoredSession = async (supabaseAdmin, sessionId) => {
  const { data, error } = await supabaseAdmin
    .from('store_analytics_sessions')
    .select('id, visitor_id, user_id, started_at, last_seen_at')
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
  observedAt
}) => {
  const { error } = await supabaseAdmin
    .from('store_analytics_sessions')
    .insert({
      id: sessionId,
      visitor_id: visitorId,
      user_id: userId,
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
  observedAt
}) => {
  const { error: sessionError } = await supabaseAdmin
    .from('store_analytics_sessions')
    .update({
      user_id: userId,
      last_seen_at: observedAt
    })
    .eq('id', sessionId)
    .eq('visitor_id', visitorId)
    .is('user_id', null)

  if (sessionError) {
    throw new Error('Could not associate the analytics session.')
  }

  await backfillCurrentSessionEvents({
    supabaseAdmin,
    sessionId,
    visitorId,
    userId
  })
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

  const identityMismatch = storedSession
    && String(storedSession.visitor_id) !== visitorId
  const signedInUserMismatch = storedSession
    && userId
    && storedSession.user_id
    && String(storedSession.user_id) !== String(userId)

  if (identityMismatch || signedInUserMismatch) {
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
      observedAt
    })

    storedSession = await getStoredSession(supabaseAdmin, sessionId)
  }

  if (!storedSession) {
    throw new Error('Could not initialize the analytics session.')
  }

  if (userId && !storedSession.user_id) {
    await attachCurrentSessionToUser({
      supabaseAdmin,
      sessionId,
      visitorId,
      userId,
      observedAt
    })
  } else {
    const { error: touchError } = await supabaseAdmin
      .from('store_analytics_sessions')
      .update({
        last_seen_at: observedAt
      })
      .eq('id', sessionId)
      .eq('visitor_id', visitorId)
      .lte('last_seen_at', observedAt)

    if (touchError) {
      throw new Error('Could not update the analytics session.')
    }

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
    userId: userId || null
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
}
