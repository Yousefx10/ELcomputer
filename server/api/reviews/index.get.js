import { createError, getQuery, setHeader } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabaseAdmin'
import { mapPublicReview } from '../../utils/productReviews'

const publicReviewSelection = `
  id,
  rating,
  review_text,
  display_full_name,
  created_at,
  product:products!product_reviews_product_id_fkey!inner (
    title,
    slug,
    is_published
  ),
  reviewer:customer_profiles!product_reviews_user_id_fkey (
    full_name
  )
`

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const requestedPage = Number(query.page)
  const requestedPageSize = Number(query.pageSize)
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0
    ? Math.min(100000, requestedPage)
    : 1
  const pageSize = Number.isSafeInteger(requestedPageSize) && requestedPageSize > 0
    ? Math.min(24, requestedPageSize)
    : 12
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const supabaseAdmin = getSupabaseAdminClient()

  let { data: reviewRecords, count, error } = await supabaseAdmin
    .from('product_reviews')
    .select(publicReviewSelection, { count: 'exact' })
    .eq('product.is_published', true)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, to)

  let resolvedPage = count ? page : 1

  if (!error && count && from >= count) {
    resolvedPage = Math.max(1, Math.ceil(count / pageSize))
    const resolvedFrom = (resolvedPage - 1) * pageSize
    const resolvedTo = resolvedFrom + pageSize - 1
    const resolvedResult = await supabaseAdmin
      .from('product_reviews')
      .select(publicReviewSelection)
      .eq('product.is_published', true)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(resolvedFrom, resolvedTo)

    reviewRecords = resolvedResult.data
    error = resolvedResult.error
  }

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message
    })
  }

  setHeader(event, 'Cache-Control', 'no-store')

  return {
    items: (reviewRecords || []).map(mapPublicReview),
    total: count || 0,
    page: resolvedPage,
    pageSize
  }
})
