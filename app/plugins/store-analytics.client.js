import {
  startStorePresence,
  stopStorePresence
} from '~/composables/useStorePresence'

export default defineNuxtPlugin((nuxtApp) => {
  const router = useRouter()
  const { trackEvent } = useStoreAnalytics()
  let lastTrackedRoute = ''

  const trackRoute = (route) => {
    const routeIdentity = String(route?.fullPath || route?.path || '').split('#', 1)[0]
    const path = String(route?.path || '').split(/[?#]/, 1)[0]
    const isDashboardRoute = path === '/dashboard' || path.startsWith('/dashboard/')

    if (isDashboardRoute) {
      stopStorePresence()
    } else {
      startStorePresence()
    }

    if (!routeIdentity || routeIdentity === lastTrackedRoute) {
      return
    }

    lastTrackedRoute = routeIdentity
    trackEvent('page_view', {
      path,
      source: 'storefront'
    })
  }

  router.afterEach((to) => {
    trackRoute(to)
  })

  nuxtApp.hook('app:mounted', () => {
    trackRoute(router.currentRoute.value)
  })
})
