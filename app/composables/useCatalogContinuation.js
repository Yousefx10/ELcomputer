import { appendCatalogPage, catalogWindowPages } from '~/utils/catalogContinuation'

// Public catalog snapshots only. Bounded, per-Nuxt-app memory; no browser storage.
export const useCatalogContinuation = ({ key, initial, enabled, fetchPage }) => {
  const cache = useState('catalog-continuation-cache', () => ({}))
  const state = shallowRef(null), loading = ref(false), failed = ref(false)
  let epoch = 0, controller, activeKey = '', basePage = 1, mounted = false
  const save = () => {
    if (!import.meta.client || !activeKey || !state.value || !enabled.value) return
    cache.value[activeKey] = { state: state.value, basePage, scrollY: window.scrollY, savedAt: Date.now() }
    for (const [old] of Object.entries(cache.value).sort((a, b) => b[1].savedAt - a[1].savedAt).slice(4)) delete cache.value[old]
  }
  const restore = row => {
    if (!mounted || !row) return
    nextTick(() => requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, row.scrollY))))
  }
  watch([key, initial, enabled], ([nextKey, page, on]) => {
    if (activeKey && activeKey !== nextKey) save()
    epoch++; controller?.abort(); loading.value = false; failed.value = false
    activeKey = nextKey
    if (!page || page.key && page.key !== nextKey) { state.value = null; return }
    basePage = page.page
    const kept = import.meta.client && on ? cache.value[nextKey] : null
    state.value = kept && kept.basePage === basePage && Date.now() - kept.savedAt < 600000 ? kept.state : page
    restore(kept && state.value === kept.state ? kept : null)
  }, { immediate: true })
  const hasMore = computed(() => !!state.value && state.value.page < state.value.pages)
  const bounded = computed(() => !!state.value && state.value.page - basePage + 1 >= catalogWindowPages)
  const loadMore = async () => {
    if (!import.meta.client || !enabled.value || loading.value || !hasMore.value || bounded.value) return
    const own = epoch, before = state.value
    controller = new AbortController(); loading.value = true; failed.value = false
    try {
      const result = await fetchPage(before.page + 1, controller.signal)
      if (own !== epoch) return
      state.value = appendCatalogPage(before, result); save()
    } catch { if (own === epoch) failed.value = true }
    finally { if (own === epoch) loading.value = false }
  }
  onMounted(() => { mounted = true; const kept = cache.value[activeKey]; if (enabled.value && kept && state.value === kept.state) restore(kept) })
  onBeforeRouteLeave(save)
  onBeforeUnmount(() => { save(); epoch++; controller?.abort() })
  return { products: computed(() => state.value?.products || (initial.value?.key && initial.value.key !== key.value ? [] : initial.value?.products || [])),
    page: computed(() => state.value?.page || initial.value?.page || 1), hasMore, bounded, loading, failed, loadMore }
}
