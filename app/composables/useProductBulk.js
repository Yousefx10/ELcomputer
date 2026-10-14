import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router'
import { productBulkCommand, productBulkResult } from '~/utils/productBulk'

export function useProductBulk({ result, loading, context, canEdit, canSelect = canEdit, externalLocked = ref(false), load }) {
  const { adminUser } = useAdminAccess()
  const { getAdminAuthHeaders } = useAdminLogs()
  const { invalidate } = useDashboardCache()
  const selected = ref([]), operation = ref('publish'), reference = ref(''), referenceName = ref('')
  const reviewing = ref(false), pending = ref(null), busy = ref(false), outcome = ref(null), error = ref('')
  const actor = computed(() => adminUser.value?.id || '')
  const locked = computed(() => reviewing.value || Boolean(pending.value) || busy.value)
  const count = computed(() => selected.value.length)
  const selectable = product => Number.isSafeInteger(product.revision) && product.revision >= 0
  const pageItems = computed(() => (result.value?.items || []).filter(selectable))
  const allSelected = computed(() => pageItems.value.length > 0 && selected.value.length === pageItems.value.length)
  const isSelected = id => selected.value.some(item => item.id === id)
  const toggle = product => {
    if (locked.value || externalLocked.value || loading.value || !canSelect.value || !selectable(product)) return
    selected.value = isSelected(product.id) ? selected.value.filter(item => item.id !== product.id) :
      [...selected.value, { id: product.id, expected_revision: product.revision, title: product.title }]
  }
  const togglePage = () => {
    if (locked.value || externalLocked.value || loading.value || !canSelect.value) return
    selected.value = allSelected.value ? [] : pageItems.value.map(product => ({ id: product.id, expected_revision: product.revision, title: product.title }))
  }
  const ready = computed(() => canEdit.value && !externalLocked.value && !loading.value && count.value > 0 &&
    (!['category','brand'].includes(operation.value) || Boolean(reference.value && referenceName.value)))
  const review = () => { if (ready.value && !locked.value) { reviewing.value = true; error.value = ''; outcome.value = null } }
  const cancel = () => { if (!pending.value && !busy.value) reviewing.value = false }
  const choice = item => { referenceName.value = item?.id === reference.value ? item.name : '' }
  const key = id => 'elcomputer:product-bulk:' + id
  let generation = 0, mounted = false
  const persist = (id, command) => {
    // Only command IDs, revisions and the operation are retained. No authored
    // product fields, price, cost, stock, supplier or warehouse are persisted.
    if (command) sessionStorage.setItem(key(id), JSON.stringify(command))
    else sessionStorage.removeItem(key(id))
  }
  const restore = () => {
    if (!actor.value) return
    try { const stored = sessionStorage.getItem(key(actor.value)); if (stored) { pending.value = productBulkCommand(JSON.parse(stored)); operation.value = pending.value.operation; reference.value = pending.value.reference_id || ''; error.value = 'unknown' } }
    catch { error.value = 'storage' }
  }
  const acknowledge = async (data, command, id, current) => {
    const validated = productBulkResult(data, command)
    if (generation !== current || actor.value !== id) return
    persist(id, null)
    pending.value = null; reviewing.value = false; selected.value = []; outcome.value = validated; error.value = ''; busy.value = false
    if (validated.succeeded > 0) { invalidate('dashboard:products:'); invalidate('dashboard:home') }
    await load()
  }
  const send = async (check = false) => {
    if (busy.value || !pending.value || !canEdit.value) return
    const command = pending.value, id = actor.value, current = generation
    busy.value = true; error.value = ''
    try {
      const headers = await getAdminAuthHeaders()
      if (generation !== current || actor.value !== id) return
      const data = await $fetch('/api/admin-products/bulk', { headers, retry: 0, timeout: check ? 15000 : 65000,
        ...(check ? { query: { request_id: command.request_id } } : { method: 'POST', body: command }) })
      if (generation !== current || actor.value !== id) return
      if (check && !data?.result) { error.value = 'unknown'; return }
      await acknowledge(check ? data.result : data, command, id, current)
    } catch (failure) {
      if (generation !== current || actor.value !== id) return
      // Only an exact terminal receipt unlocks submission. A rejection without
      // one cannot prove that an earlier delayed request will never commit.
      error.value = [401,403].includes(failure?.statusCode || failure?.response?.status) ? 'permission' : 'unknown'
    } finally { if (generation === current && actor.value === id) busy.value = false }
  }
  const confirm = () => {
    if (!reviewing.value || !ready.value || pending.value || busy.value) return
    try {
      const command = productBulkCommand({ request_id: crypto.randomUUID(), operation: operation.value, reference_id: reference.value || null,
        items: selected.value.map(({ id, expected_revision }) => ({ id, expected_revision })) })
      persist(actor.value, command); pending.value = command; reviewing.value = false
    } catch { error.value = 'storage'; return }
    return send()
  }
  watch([context,loading,result], () => { selected.value = []; if (!pending.value && !busy.value) reviewing.value = false }, { flush: 'sync' })
  watch(operation, () => { reference.value = ''; referenceName.value = '' }, { flush: 'sync' })
  watch(reference, () => { referenceName.value = '' }, { flush: 'sync' })
  watch(() => JSON.stringify([actor.value,adminUser.value?.is_active,adminUser.value?.role,adminUser.value?.permissions]), () => {
    generation++; selected.value = []; pending.value = null; outcome.value = null; reviewing.value = false; busy.value = false; error.value = ''; reference.value = ''
    if (mounted) restore()
  })
  const leave = () => { if (pending.value || busy.value) { error.value = 'leave'; return false } cancel() }
  onBeforeRouteLeave(leave); onBeforeRouteUpdate(leave)
  const unload = event => { if (pending.value || busy.value) { event.preventDefault(); event.returnValue = '' } }
  onMounted(() => { mounted = true; restore(); window.addEventListener('beforeunload',unload) })
  onBeforeUnmount(() => { mounted = false; generation++; window.removeEventListener('beforeunload',unload) })
  return { selected, operation, reference, referenceName, reviewing, pending, busy, outcome, error, locked, count,
    allSelected, isSelected, selectable, pageItems, toggle, togglePage, ready, review, cancel, choice, confirm,
    retry: () => send(), check: () => send(true) }
}
