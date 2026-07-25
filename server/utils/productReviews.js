export const PRODUCT_REVIEW_MAX_LENGTH = 999
export const PRODUCT_REVIEW_ACCOUNT_WAIT_SECONDS = 60 * 60
export const PRODUCT_REVIEW_ACCOUNT_TOO_NEW_CODE = 'account_too_new'
export const PRODUCT_REVIEW_ACCOUNT_TOO_NEW_DB_MESSAGE = 'PRODUCT_REVIEW_ACCOUNT_TOO_NEW'
export const PRODUCT_REVIEW_COMPLETED_ORDER_STATUSES = ['completed', 'delivered']

export const isUuid = (value) => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || '').trim()
  )
}

export const normalizeReviewText = (value) => {
  return String(value || '').trim()
}

export const getReviewCharacterCount = (value) => {
  return Array.from(String(value || '')).length
}

export const getProductReviewWaitMessage = (remainingSeconds) => {
  const minutes = Math.max(1, Math.ceil(Number(remainingSeconds || 0) / 60))
  const minuteLabel = minutes === 1 ? 'minute' : 'minutes'

  return `New customer accounts must wait 1 hour before writing a review. Customers with at least one completed purchase can review immediately. Please try again in about ${minutes} ${minuteLabel}.`
}

export const getProductReviewEligibility = async ({
  supabaseAdmin,
  authUser,
  now = new Date()
}) => {
  if (!supabaseAdmin || !authUser?.id) {
    throw new Error('A verified customer account is required to check review eligibility.')
  }

  const accountCreatedAtMs = Date.parse(String(authUser.created_at || ''))
  const nowMs = now instanceof Date
    ? now.getTime()
    : Date.parse(String(now || ''))

  if (!Number.isFinite(accountCreatedAtMs) || !Number.isFinite(nowMs)) {
    throw new Error('Could not verify when this customer account was created.')
  }

  const eligibleAtMs = accountCreatedAtMs + (PRODUCT_REVIEW_ACCOUNT_WAIT_SECONDS * 1000)
  const eligibleAt = new Date(eligibleAtMs).toISOString()

  if (nowMs >= eligibleAtMs) {
    return {
      canReview: true,
      code: null,
      eligibleAt,
      remainingSeconds: 0,
      hasCompletedPurchase: null,
      message: ''
    }
  }

  const remainingSeconds = Math.max(1, Math.ceil((eligibleAtMs - nowMs) / 1000))
  const { data: completedOrders, error: completedOrdersError } = await supabaseAdmin
    .from('customer_orders')
    .select('id')
    .eq('user_id', authUser.id)
    .in('status', PRODUCT_REVIEW_COMPLETED_ORDER_STATUSES)
    .limit(1)

  if (completedOrdersError) {
    throw new Error(completedOrdersError.message)
  }

  const hasCompletedPurchase = Boolean(completedOrders?.length)

  if (hasCompletedPurchase) {
    return {
      canReview: true,
      code: null,
      eligibleAt,
      remainingSeconds,
      hasCompletedPurchase: true,
      message: ''
    }
  }

  return {
    canReview: false,
    code: PRODUCT_REVIEW_ACCOUNT_TOO_NEW_CODE,
    eligibleAt,
    remainingSeconds,
    hasCompletedPurchase: false,
    message: getProductReviewWaitMessage(remainingSeconds)
  }
}

export const normalizeReviewSearch = (value) => {
  return String(value || '')
    .slice(0, 100)
    .replace(/[,%()"'\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export const getRelatedRecord = (record, key) => {
  const value = record?.[key]

  if (Array.isArray(value)) {
    return value[0] || null
  }

  return value && typeof value === 'object' ? value : null
}

export const getReviewerFullName = (profile, authUser) => {
  return String(
    profile?.full_name
    || authUser?.user_metadata?.full_name
    || authUser?.user_metadata?.name
    || authUser?.email?.split('@')[0]
    || 'Customer'
  ).trim() || 'Customer'
}

export const maskReviewerName = (value) => {
  const characters = Array.from(String(value || '').trim() || 'Customer')
  const visibleCharacter = characters[0] || 'C'

  return `${visibleCharacter}***`
}

export const mapPublicReview = (record) => {
  const reviewer = getRelatedRecord(record, 'reviewer')
  const product = getRelatedRecord(record, 'product')
  const fullName = String(reviewer?.full_name || 'Customer').trim() || 'Customer'

  const publicReview = {
    id: record.id,
    rating: Number(record.rating) || 0,
    reviewText: String(record.review_text || ''),
    reviewerName: record.display_full_name ? fullName : maskReviewerName(fullName),
    createdAt: record.created_at
  }

  if (product) {
    publicReview.productTitle = String(product.title || 'Product')
    publicReview.productSlug = String(product.slug || '')
  }

  return publicReview
}

export const mapAdminReview = (record) => {
  const product = getRelatedRecord(record, 'product')
  const reviewer = getRelatedRecord(record, 'reviewer')

  return {
    id: record.id,
    product_id: record.product_id,
    product_title: product?.title || 'Unavailable product',
    product_slug: product?.slug || '',
    reviewer_full_name: reviewer?.full_name || 'Customer',
    reviewer_email: reviewer?.email || '',
    display_full_name: Boolean(record.display_full_name),
    rating: Number(record.rating) || 0,
    review_text: String(record.review_text || ''),
    created_at: record.created_at
  }
}
