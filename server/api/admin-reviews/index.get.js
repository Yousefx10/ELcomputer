import { createError, getQuery } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import { mapAdminReview, normalizeReviewSearch } from '../../utils/productReviews'

const applyReviewFilters = (queryBuilder, { rating, matchingProductIds, matchingUserIds, searchTerm }) => {
  let nextQueryBuilder = queryBuilder

  if (rating) {
    nextQueryBuilder = nextQueryBuilder.eq('rating', rating)
  }

  if (searchTerm) {
    const filters = [`review_text.ilike.%${searchTerm}%`]

    if (matchingProductIds.length) {
      filters.push(`product_id.in.(${matchingProductIds.join(',')})`)
    }

    if (matchingUserIds.length) {
      filters.push(`user_id.in.(${matchingUserIds.join(',')})`)
    }

    nextQueryBuilder = nextQueryBuilder.or(filters.join(','))
  }

  return nextQueryBuilder
}

export default defineEventHandler(async (event) => {
  const { supabaseAdmin } = await requireAdminRequest(event)
  const query = getQuery(event)
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(20, Math.max(1, Number(query.pageSize) || 10))
  const searchTerm = normalizeReviewSearch(query.search)
  const requestedRating = Number(query.rating)
  const rating = Number.isInteger(requestedRating) && requestedRating >= 1 && requestedRating <= 5
    ? requestedRating
    : 0
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let matchingProductIds = []
  let matchingUserIds = []

  if (searchTerm) {
    const [
      { data: matchingProducts, error: matchingProductsError },
      { data: matchingUsers, error: matchingUsersError }
    ] = await Promise.all([
      supabaseAdmin
        .from('products')
        .select('id')
        .ilike('title', `%${searchTerm}%`)
        .limit(500),
      supabaseAdmin
        .from('customer_profiles')
        .select('id')
        .or(`full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
        .limit(500)
    ])

    const encounteredSearchError = matchingProductsError || matchingUsersError

    if (encounteredSearchError) {
      throw createError({
        statusCode: 500,
        statusMessage: encounteredSearchError.message
      })
    }

    matchingProductIds = (matchingProducts || []).map((product) => product.id)
    matchingUserIds = (matchingUsers || []).map((profile) => profile.id)
  }

  const filterOptions = {
    rating,
    matchingProductIds,
    matchingUserIds,
    searchTerm
  }

  const countQuery = applyReviewFilters(
    supabaseAdmin
      .from('product_reviews')
      .select('id', { count: 'exact', head: true }),
    filterOptions
  )

  const dataQuery = applyReviewFilters(
    supabaseAdmin
      .from('product_reviews')
      .select(`
        id,
        product_id,
        user_id,
        rating,
        review_text,
        display_full_name,
        created_at,
        product:products!product_reviews_product_id_fkey (
          title,
          slug
        ),
        reviewer:customer_profiles!product_reviews_user_id_fkey (
          full_name,
          email
        )
      `),
    filterOptions
  )

  const [
    { count, error: countError },
    { data: reviewRecords, error: reviewsError }
  ] = await Promise.all([
    countQuery,
    dataQuery
      .order('created_at', { ascending: false })
      .range(from, to)
  ])

  const encounteredError = countError || reviewsError

  if (encounteredError) {
    throw createError({
      statusCode: 500,
      statusMessage: encounteredError.message
    })
  }

  return {
    items: (reviewRecords || []).map(mapAdminReview),
    total: count || 0,
    page,
    pageSize
  }
})
