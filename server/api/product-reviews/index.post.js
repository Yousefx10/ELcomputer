import { createError, readBody } from 'h3'
import { requireCustomerRequest } from '../../utils/customerRequest'
import {
  PRODUCT_REVIEW_ACCOUNT_TOO_NEW_CODE,
  PRODUCT_REVIEW_ACCOUNT_TOO_NEW_DB_MESSAGE,
  PRODUCT_REVIEW_MAX_LENGTH,
  getProductReviewEligibility,
  getProductReviewWaitMessage,
  getReviewCharacterCount,
  getReviewerFullName,
  isUuid,
  mapPublicReview,
  normalizeReviewText
} from '../../utils/productReviews'

export default defineEventHandler(async (event) => {
  const {
    authUser,
    customerProfile,
    supabaseAdmin
  } = await requireCustomerRequest(event)

  if (!customerProfile) {
    throw createError({
      statusCode: 403,
      statusMessage: 'A customer profile is required to write a review.'
    })
  }

  const body = await readBody(event)
  const productId = String(body?.productId || '').trim()
  const rating = Number(body?.rating)
  const reviewText = normalizeReviewText(body?.reviewText)
  const reviewCharacterCount = getReviewCharacterCount(reviewText)
  const displayFullName = body?.displayFullName === true

  if (!isUuid(productId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A valid product id is required.'
    })
  }

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Choose a rating from 1 to 5 stars.'
    })
  }

  if (!reviewCharacterCount) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Your review is required.'
    })
  }

  if (reviewCharacterCount > PRODUCT_REVIEW_MAX_LENGTH) {
    throw createError({
      statusCode: 400,
      statusMessage: `Your review cannot exceed ${PRODUCT_REVIEW_MAX_LENGTH} characters.`
    })
  }

  const { data: product, error: productError } = await supabaseAdmin
    .from('products')
    .select('id')
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

  let reviewEligibility

  try {
    reviewEligibility = await getProductReviewEligibility({
      supabaseAdmin,
      authUser
    })
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error?.message || 'Could not check review eligibility.'
    })
  }

  if (!reviewEligibility.canReview) {
    throw createError({
      statusCode: 403,
      statusMessage: reviewEligibility.message,
      data: {
        code: PRODUCT_REVIEW_ACCOUNT_TOO_NEW_CODE,
        reviewEligibility
      }
    })
  }

  const reviewerFullName = getReviewerFullName(customerProfile, authUser)

  if (reviewerFullName !== customerProfile.full_name) {
    const { error: profileUpdateError } = await supabaseAdmin
      .from('customer_profiles')
      .update({
        full_name: reviewerFullName,
        updated_at: new Date().toISOString()
      })
      .eq('id', authUser.id)

    if (profileUpdateError) {
      throw createError({
        statusCode: 500,
        statusMessage: profileUpdateError.message
      })
    }
  }

  const { data: reviewRecord, error: reviewError } = await supabaseAdmin
    .from('product_reviews')
    .insert({
      product_id: productId,
      user_id: authUser.id,
      rating,
      review_text: reviewText,
      display_full_name: displayFullName
    })
    .select('id, rating, review_text, display_full_name, created_at')
    .single()

  if (reviewError) {
    if (
      reviewError.code === 'P0001'
      && String(reviewError.message || '').includes(PRODUCT_REVIEW_ACCOUNT_TOO_NEW_DB_MESSAGE)
    ) {
      const triggerEligibility = {
        ...reviewEligibility,
        canReview: false,
        code: PRODUCT_REVIEW_ACCOUNT_TOO_NEW_CODE,
        hasCompletedPurchase: false,
        message: getProductReviewWaitMessage(reviewEligibility.remainingSeconds)
      }

      throw createError({
        statusCode: 403,
        statusMessage: triggerEligibility.message,
        data: {
          code: PRODUCT_REVIEW_ACCOUNT_TOO_NEW_CODE,
          reviewEligibility: triggerEligibility
        }
      })
    }

    if (reviewError.code === '23505') {
      throw createError({
        statusCode: 409,
        statusMessage: 'You have already reviewed this product.'
      })
    }

    throw createError({
      statusCode: 400,
      statusMessage: reviewError.message
    })
  }

  const [
    { count: totalReviews, error: countError },
    { data: updatedProduct, error: updatedProductError }
  ] = await Promise.all([
    supabaseAdmin
      .from('product_reviews')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', productId),
    supabaseAdmin
      .from('products')
      .select('average_rating')
      .eq('id', productId)
      .single()
  ])

  return {
    success: true,
    review: mapPublicReview({
      ...reviewRecord,
      reviewer: {
        full_name: reviewerFullName
      }
    }),
    total: countError ? null : (totalReviews || 0),
    averageRating: updatedProductError
      ? null
      : Number(updatedProduct.average_rating || 0),
    hasReviewed: true
  }
})
