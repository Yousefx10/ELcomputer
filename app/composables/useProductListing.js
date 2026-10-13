import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { productListState, productListParams, productListPath } from '~/utils/productList'

export const useProductListing = () => {
  const route = useUiRoute()
  const { uiRouterPush, uiRouterReplace } = useUiNavigation()
  const { adminUser, hasPermission } = useAdminAccess()
  const { getAdminAuthHeaders } = useAdminLogs()
  const state = computed(() => productListState(route.query))
  const search = ref(state.value.q)
  const result = ref(null)
  const loading = ref(true)
  const error = ref('')
  const context = computed(() => productListPath(state.value))
  const canAdd = computed(() => hasPermission('products.add'))
  const canEdit = computed(() => hasPermission('products.edit'))
  let requestId = 0, controller, timer, synchronizing = false, mounted = false
  const cancel = () => { requestId++; controller?.abort(); clearTimeout(timer) }
  const update = (changes, { replace = false } = {}) => {
    clearTimeout(timer)
    const next = { ...state.value, q: search.value.trim(), page: 1, ...changes }
    return (replace ? uiRouterReplace : uiRouterPush)({ path: '/dashboard/products', query: productListParams(next) })
  }
  const load = async () => {
    const id = ++requestId
    controller?.abort(); controller = new AbortController()
    const signal = controller.signal
    loading.value = true; error.value = ''; result.value = null
    try {
      const headers = await getAdminAuthHeaders()
      if (id !== requestId) return
      const data = await $fetch('/api/admin-products/list', {
        headers, query: productListParams(state.value), signal, retry: 0, timeout: 15000
      })
      if (id !== requestId) return
      if (!data || !Array.isArray(data.items) || data.items.length > 25 ||
        !Number.isSafeInteger(data.total) || data.total < 0 || !Number.isSafeInteger(data.catalog_total) || data.catalog_total < data.total ||
        !Number.isInteger(data.page) || data.page < 1 || data.page_size !== 25 || data.items.length > data.total) throw Error('Invalid listing response')
      if (data.page !== state.value.page) {
        await update({ page: data.page }, { replace: true })
        return
      }
      result.value = data
    } catch (failure) {
      if (id !== requestId || signal.aborted) return
      error.value = [401,403].includes(failure?.statusCode || failure?.response?.status) ? 'permission' : 'loadFailed'
    } finally { if (id === requestId) loading.value = false }
  }
  watch(search, () => {
    if (synchronizing || !mounted) return
    cancel(); loading.value = true; result.value = null
    timer = setTimeout(async () => {
      if (search.value.trim() === state.value.q && state.value.page === 1) await load()
      else await update({ q: search.value.trim() })
    }, 300)
  }, { flush: 'sync' })
  watch(() => JSON.stringify(state.value), () => {
    clearTimeout(timer)
    synchronizing = true; search.value = state.value.q; synchronizing = false
    if (mounted) load()
  })
  watch(() => JSON.stringify([adminUser.value?.id, adminUser.value?.is_active, adminUser.value?.role, adminUser.value?.permissions]), () => {
    cancel(); result.value = null
    if (mounted) load()
  })
  onMounted(() => { mounted = true; load() })
  onBeforeRouteLeave(() => { cancel() })
  onBeforeUnmount(() => { mounted = false; cancel() })
  const editorLink = id => ({ path: id ? `/dashboard/products/edit/${id}` : '/dashboard/products/add', query: { returnTo: context.value } })
  const hasFilters = computed(() => ['status','mode','stock'].some(key => state.value[key] !== 'all') || Boolean(state.value.category || state.value.brand))
  const reset = () => { synchronizing = true; search.value = ''; synchronizing = false; return update({ ...productListState(), q: '' }) }
  return { state, search, result, loading, error, context, canAdd, canEdit, update, load, reset, editorLink, hasFilters }
}
