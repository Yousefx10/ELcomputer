const DEFAULT_DASHBOARD_CACHE_TTL = 60 * 1000

const cloneDashboardCacheValue = (value) => {
  if (value === null || value === undefined) {
    return value
  }

  return JSON.parse(JSON.stringify(value))
}

export const useDashboardCache = () => {
  const cacheEntries = useState('dashboard-cache-entries', () => ({}))

  const getEntry = (key) => {
    return cacheEntries.value[key] || null
  }

  const getSnapshot = (key) => {
    const entry = getEntry(key)

    if (!entry) {
      return null
    }

    return cloneDashboardCacheValue(entry.data)
  }

  const isFresh = (key, ttl = DEFAULT_DASHBOARD_CACHE_TTL) => {
    const entry = getEntry(key)

    if (!entry?.updatedAt) {
      return false
    }

    return (Date.now() - entry.updatedAt) < ttl
  }

  const setSnapshot = (key, data) => {
    cacheEntries.value = {
      ...cacheEntries.value,
      [key]: {
        data: cloneDashboardCacheValue(data),
        updatedAt: Date.now()
      }
    }
  }

  const invalidate = (matcher) => {
    if (!matcher) {
      cacheEntries.value = {}
      return
    }

    const nextEntries = { ...cacheEntries.value }

    Object.keys(nextEntries).forEach((key) => {
      const shouldDelete = typeof matcher === 'function'
        ? matcher(key)
        : key.startsWith(String(matcher))

      if (shouldDelete) {
        delete nextEntries[key]
      }
    })

    cacheEntries.value = nextEntries
  }

  return {
    defaultTtl: DEFAULT_DASHBOARD_CACHE_TTL,
    getSnapshot,
    isFresh,
    setSnapshot,
    invalidate
  }
}
