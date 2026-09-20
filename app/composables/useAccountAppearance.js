export const useAccountAppearance = () => useFetch('/api/storefront/account-appearance', {
  key: 'account-appearance',
  default: () => null
})
