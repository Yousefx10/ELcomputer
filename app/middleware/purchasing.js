export default defineNuxtRouteMiddleware(async () => {
  const access = usePurchaseAccess()
  if (!access.purchasingEnabled.value) await access.refresh()
  if (!access.purchasingEnabled.value) {
    return abortNavigation(createError({ statusCode: 403, statusMessage: 'Purchasing is currently unavailable.' }))
  }
})
