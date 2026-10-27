import { reviewCheckout } from '../../utils/checkoutReview'

export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  return (await reviewCheckout(event)).review
})
