import {
  createError,
  getRequestIP,
  setHeader
} from 'h3'

const STORE_ANALYTICS_RATE_WINDOW_MS = 60 * 1000
const STORE_ANALYTICS_RATE_BUCKET_LIMIT = 10000
const storeAnalyticsRateBuckets = new Map()

const cleanupStoreAnalyticsRateBuckets = (now) => {
  for (const [key, bucket] of storeAnalyticsRateBuckets) {
    if (bucket.resetAt <= now) {
      storeAnalyticsRateBuckets.delete(key)
    }
  }

  while (storeAnalyticsRateBuckets.size >= STORE_ANALYTICS_RATE_BUCKET_LIMIT) {
    const oldestKey = storeAnalyticsRateBuckets.keys().next().value

    if (oldestKey === undefined) {
      break
    }

    storeAnalyticsRateBuckets.delete(oldestKey)
  }
}

export const assertStoreAnalyticsRateLimit = (
  event,
  {
    scope,
    limit
  }
) => {
  const now = Date.now()
  const trustProxy = process.env.NUXT_TRUST_PROXY === 'true'
  const requestAddress = getRequestIP(event, {
    xForwardedFor: trustProxy
  }) || 'unknown'
  const bucketKey = `${scope}:${requestAddress}`
  let bucket = storeAnalyticsRateBuckets.get(bucketKey)

  if (!bucket || bucket.resetAt <= now) {
    if (storeAnalyticsRateBuckets.size >= STORE_ANALYTICS_RATE_BUCKET_LIMIT) {
      cleanupStoreAnalyticsRateBuckets(now)
    }

    bucket = {
      count: 0,
      resetAt: now + STORE_ANALYTICS_RATE_WINDOW_MS
    }
    storeAnalyticsRateBuckets.set(bucketKey, bucket)
  }

  bucket.count += 1

  if (bucket.count > limit) {
    setHeader(
      event,
      'Retry-After',
      String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)))
    )
    throw createError({
      statusCode: 429,
      statusMessage: 'Too many analytics requests.'
    })
  }
}
