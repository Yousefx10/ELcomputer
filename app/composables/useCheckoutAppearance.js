export const useCheckoutAppearance = () => useFetch('/api/storefront/checkout-appearance', {
  key: 'checkout-appearance',
  default: () => ({ checkout_style: 'classic' })
})
