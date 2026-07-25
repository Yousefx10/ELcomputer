export const PRODUCT_REVIEW_MAX_LENGTH = 999

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
