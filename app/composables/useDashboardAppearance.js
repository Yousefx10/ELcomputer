export const useDashboardAppearance = () => {
  return useFetch('/api/storefront/dashboard-appearance', {
    key: 'dashboard-appearance',
    default: () => null
  })
}
