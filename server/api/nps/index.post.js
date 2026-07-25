import { createError, getHeader, readBody, setHeader } from 'h3'
import {
  NPS_FEEDBACK_MAX_LENGTH,
  NPS_MAX_SCORE,
  NPS_MIN_SCORE,
  NPS_PERIOD_DAYS
} from '../../utils/nps'
import { getSupabaseAdminClient } from '../../utils/supabaseAdmin'
import {
  ensureStoreAnalyticsSession,
  getOptionalStoreAnalyticsUserId,
  isStoreAnalyticsUuid
} from '../../utils/storeAnalytics'

const MAX_REQUEST_BYTES = 8192
const SOURCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,49}$/
const NPS_FIELDS = new Set([
  'responseId',
  'score',
  'feedback',
  'source'
])

const invalidPayload = () => {
  return createError({
    statusCode: 400,
    statusMessage: 'Invalid NPS response.'
  })
}

const normalizeFeedback = (value) => {
  if (value === undefined || value === null || value === '') {
    return null
  }

  if (typeof value !== 'string') {
    throw invalidPayload()
  }

  const feedback = value.trim()

  if (
    !feedback
    || Array.from(feedback).length > NPS_FEEDBACK_MAX_LENGTH
  ) {
    throw invalidPayload()
  }

  return feedback
}

const normalizeSource = (value) => {
  if (value === undefined || value === null || value === '') {
    return 'store'
  }

  if (typeof value !== 'string') {
    throw invalidPayload()
  }

  const source = value.trim()

  if (!SOURCE_PATTERN.test(source)) {
    throw invalidPayload()
  }

  return source
}

export default defineEventHandler(async (event) => {
  const contentLength = Number(getHeader(event, 'content-length'))

  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    throw createError({
      statusCode: 413,
      statusMessage: 'NPS response is too large.'
    })
  }

  let body

  try {
    body = await readBody(event)
  } catch {
    throw invalidPayload()
  }

  if (
    !body
    || typeof body !== 'object'
    || Array.isArray(body)
    || Object.keys(body).some((key) => !NPS_FIELDS.has(key))
    || !isStoreAnalyticsUuid(body.responseId)
  ) {
    throw invalidPayload()
  }

  const score = body.score

  if (
    typeof score !== 'number'
    || !Number.isSafeInteger(score)
    || score < NPS_MIN_SCORE
    || score > NPS_MAX_SCORE
  ) {
    throw invalidPayload()
  }

  const responseId = String(body.responseId).toLowerCase()
  const feedback = normalizeFeedback(body.feedback)
  const source = normalizeSource(body.source)
  let supabaseAdmin

  try {
    supabaseAdmin = getSupabaseAdminClient()
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: 'The NPS response could not be saved.'
    })
  }

  const userId = await getOptionalStoreAnalyticsUserId(event, supabaseAdmin)

  let identity

  try {
    identity = await ensureStoreAnalyticsSession({
      event,
      supabaseAdmin,
      userId
    })
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: 'The NPS response could not be saved.'
    })
  }

  if (identity.isInternal) {
    setHeader(event, 'Cache-Control', 'no-store')

    return {
      success: true,
      recorded: false,
      excluded: true
    }
  }

  const { data: existingResponse, error: existingResponseError } = await supabaseAdmin
    .from('nps_responses')
    .select('id')
    .eq('response_id', responseId)
    .maybeSingle()

  if (existingResponseError) {
    throw createError({
      statusCode: 500,
      statusMessage: 'The NPS response could not be saved.'
    })
  }

  if (existingResponse) {
    setHeader(event, 'Cache-Control', 'no-store')

    return {
      success: true,
      alreadySubmitted: true
    }
  }

  const cooldownStart = new Date(
    Date.now() - (NPS_PERIOD_DAYS * 24 * 60 * 60 * 1000)
  ).toISOString()
  let cooldownQuery = supabaseAdmin
    .from('nps_responses')
    .select('id')
    .eq('is_internal', false)
    .gte('created_at', cooldownStart)
    .limit(1)

  cooldownQuery = userId
    ? cooldownQuery.or(
        `user_id.eq.${userId},visitor_id.eq.${identity.visitorId}`
      )
    : cooldownQuery
        .is('user_id', null)
        .eq('visitor_id', identity.visitorId)

  const { data: recentResponses, error: recentResponseError } = await cooldownQuery

  if (recentResponseError) {
    throw createError({
      statusCode: 500,
      statusMessage: 'The NPS response could not be saved.'
    })
  }

  if (recentResponses?.length) {
    throw createError({
      statusCode: 409,
      statusMessage: 'An NPS response has already been submitted recently.'
    })
  }

  const { error: insertError } = await supabaseAdmin
    .from('nps_responses')
    .insert({
      response_id: responseId,
      user_id: userId,
      visitor_id: identity.visitorId,
      is_internal: false,
      score,
      feedback,
      source
    })

  if (insertError) {
    if (insertError.code === '23505') {
      setHeader(event, 'Cache-Control', 'no-store')

      return {
        success: true,
        alreadySubmitted: true
      }
    }

    if (insertError.code === 'P0001') {
      throw createError({
        statusCode: 409,
        statusMessage: 'An NPS response has already been submitted recently.'
      })
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'The NPS response could not be saved.'
    })
  }

  setHeader(event, 'Cache-Control', 'no-store')

  return {
    success: true,
    alreadySubmitted: false
  }
})
