import { createError, getHeader, getQuery } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabaseAdmin'
import { isUuid, mapPublicReview } from '../../utils/productReviews'

const getOptionalUserId = async (event, supabaseAdmin) => {
  const authorizationHeader = getHeader(event, 'authorization')

  if (!authorizationHeader?.startsWith('Bearer ')) {
    return ''
  }

  const accessToken = authorizationHeader.slice('Bearer '.length)
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken)

  if (error || !data.user) {
    return ''
  }

  return data.user.id
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const productId = String(query.productId || '').trim()

  if (!isUuid(productId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A valid product id is required.'
    })
  }

  const requestedPage = Number(query.page)
  const requestedPageSize = Number(query.pageSize)
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0
    ? Math.min(100000, requestedPage)
    : 1
  const pageSize = Number.isSafeInteger(requestedPageSize) && requestedPageSize > 0
    ? Math.min(10, requestedPageSize)
    : 10
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const supabaseAdmin = getSupabaseAdminClient()

  const { data: product, error: productError } = await supabaseAdmin
    .from('products')
    .select('id, average_rating')
    .eq('id', productId)
    .eq('is_published', true)
    .maybeSingle()

  if (productError) {
    throw createError({
      statusCode: 500,
      statusMessage: productError.message
    })
  }

  if (!product) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Product not found.'
    })
  }

  const userId = await getOptionalUserId(event, supabaseAdmin)
  const reviewsPromise = supabaseAdmin
    .from('product_reviews')
    .select(`
      id,
      rating,
      review_text,
      display_full_name,
      created_at,
      reviewer:customer_profiles!product_reviews_user_id_fkey (
        full_name
      )
    `, { count: 'exact' })
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .range(from, to)

  const hasReviewedPromise = userId
    ? supabaseAdmin
        .from('product_reviews')
        .select('id', { count: 'exact', head: true })
        .eq('product_id', productId)
        .eq('user_id', userId)
    : Promise.resolve({ count: 0, error: null })

  const [
    { data: reviewRecords, count, error: reviewsError },
    { count: currentUserReviewCount, error: currentUserReviewError }
  ] = await Promise.all([reviewsPromise, hasReviewedPromise])

  const encounteredError = reviewsError || currentUserReviewError

  if (encounteredError) {
    throw createError({
      statusCode: 500,
      statusMessage: encounteredError.message
    })
  }

  return {
    items: (reviewRecords || []).map(mapPublicReview),
    total: count || 0,
    page,
    pageSize,
    averageRating: Number(product.average_rating || 0),
    hasReviewed: Boolean(currentUserReviewCount)
  }
})
