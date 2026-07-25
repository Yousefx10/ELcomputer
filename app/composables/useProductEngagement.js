const MAX_PRODUCT_DWELL_MS = 30 * 60 * 1000

export const useProductEngagement = (product) => {
  if (!import.meta.client) {
    return
  }

  const { trackEvent } = useStoreAnalytics()
  let activeProductId = ''
  let activeProductPath = ''
  let visibleStartedAt = null
  let pendingDurationMs = 0
  let sentDurationMs = 0
  let stopProductWatch

  const getNow = () => window.performance.now()

  const pauseVisibleTimer = () => {
    if (visibleStartedAt === null) {
      return
    }

    const remainingDuration = Math.max(
      0,
      MAX_PRODUCT_DWELL_MS - sentDurationMs - pendingDurationMs
    )
    const elapsedDuration = Math.max(0, getNow() - visibleStartedAt)

    pendingDurationMs += Math.min(elapsedDuration, remainingDuration)
    visibleStartedAt = null
  }

  const resumeVisibleTimer = () => {
    if (
      !activeProductId
      || document.visibilityState !== 'visible'
      || visibleStartedAt !== null
      || (sentDurationMs + pendingDurationMs) >= MAX_PRODUCT_DWELL_MS
    ) {
      return
    }

    visibleStartedAt = getNow()
  }

  const flushDwell = ({ keepalive = false, resume = false } = {}) => {
    pauseVisibleTimer()

    if (!activeProductId) {
      pendingDurationMs = 0
      return
    }

    const remainingDuration = Math.max(0, MAX_PRODUCT_DWELL_MS - sentDurationMs)
    const durationMs = Math.min(remainingDuration, Math.round(pendingDurationMs))
    pendingDurationMs = 0

    if (durationMs > 0) {
      sentDurationMs += durationMs
      trackEvent('product_dwell', {
        productId: activeProductId,
        path: activeProductPath,
        durationMs,
        source: 'product_detail'
      }, {
        immediate: true,
        keepalive
      })
    }

    if (resume) {
      resumeVisibleTimer()
    }
  }

  const beginProductView = (productId) => {
    const normalizedProductId = String(productId || '').trim()

    if (normalizedProductId === activeProductId) {
      return
    }

    flushDwell()
    activeProductId = normalizedProductId
    activeProductPath = activeProductId ? window.location.pathname : ''
    pendingDurationMs = 0
    sentDurationMs = 0

    if (!activeProductId) {
      return
    }

    trackEvent('product_view', {
      productId: activeProductId,
      path: activeProductPath,
      source: 'product_detail'
    })
    resumeVisibleTimer()
  }

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      flushDwell()
      return
    }

    resumeVisibleTimer()
  }

  const handlePageHide = () => {
    flushDwell({ keepalive: true })
  }

  const handlePageShow = () => {
    resumeVisibleTimer()
  }

  onMounted(() => {
    stopProductWatch = watch(
      () => unref(product)?.id,
      beginProductView,
      { immediate: true }
    )

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pagehide', handlePageHide)
    window.addEventListener('pageshow', handlePageShow)
  })

  onBeforeUnmount(() => {
    flushDwell({ keepalive: true })
    stopProductWatch?.()
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    window.removeEventListener('pagehide', handlePageHide)
    window.removeEventListener('pageshow', handlePageShow)
  })
}
