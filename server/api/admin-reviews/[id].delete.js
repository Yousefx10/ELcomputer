import { createError, getRouterParam } from 'h3'
import { recordAdminActivity } from '../../utils/adminLogs'
import { requireAdminRequest } from '../../utils/adminRequest'
import { getRelatedRecord, isUuid } from '../../utils/productReviews'

export default defineEventHandler(async (event) => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event)
  const reviewId = String(getRouterParam(event, 'id') || '').trim()

  if (!isUuid(reviewId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A valid review id is required.'
    })
  }

  const { data: existingReview, error: existingReviewError } = await supabaseAdmin
    .from('product_reviews')
    .select(`
      id,
      product_id,
      user_id,
      rating,
      reviewer:customer_profiles!product_reviews_user_id_fkey (
        full_name,
        email
      ),
      product:products!product_reviews_product_id_fkey (
        title,
        slug
      )
    `)
    .eq('id', reviewId)
    .maybeSingle()

  if (existingReviewError) {
    throw createError({
      statusCode: 500,
      statusMessage: existingReviewError.message
    })
  }

  if (!existingReview) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Review not found.'
    })
  }

  const { error: deleteError } = await supabaseAdmin
    .from('product_reviews')
    .delete()
    .eq('id', reviewId)

  if (deleteError) {
    throw createError({
      statusCode: 400,
      statusMessage: deleteError.message
    })
  }

  const product = getRelatedRecord(existingReview, 'product')
  const reviewer = getRelatedRecord(existingReview, 'reviewer')

  await recordAdminActivity({
    supabaseAdmin,
    adminUser,
    actionKey: 'reviews.delete',
    description: `Deleted ${reviewer?.full_name || 'a customer'}'s review for ${product?.title || 'a product'}.`,
    metadata: {
      review_id: reviewId,
      product_id: existingReview.product_id,
      product_title: product?.title || '',
      reviewer_id: existingReview.user_id,
      reviewer_email: reviewer?.email || '',
      rating: existingReview.rating
    }
  })

  return {
    success: true,
    deletedId: reviewId,
    deletedBy: adminUser.id
  }
})
