import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'

// Keep the exact command across reloads until its outcome is resolved.
export function useCodCash({ orderId, form, canSubmit, onCommitted }) {
  const { adminUser } = useAdminAccess()
  const { getAdminAuthHeaders } = useAdminLogs()
  const identity = computed(() => `${adminUser.value?.id || ''}:${orderId.value}`)
  const command = ref(null), outcome = ref(null), busy = ref(false), error = ref('')
  let mounted = false, generation = 0
  const key = () => `cod-cash-command:${identity.value}`
  const restore = () => {
    try {
      const saved = sessionStorage.getItem(key())
      if (!saved) return
      const value = JSON.parse(saved)
      if (!value?.command_id || !['receive', 'reconcile'].includes(value.action)) throw Error('Invalid command')
      command.value = value; Object.assign(form, value); error.value = 'unknown'
    } catch { error.value = 'storage' }
  }
  const submit = async () => {
    if (busy.value || outcome.value || !canSubmit.value || error.value === 'storage') return
    if (!command.value) {
      const value = { command_id: crypto.randomUUID(), action: form.action,
        collection_id: form.action === 'receive' ? null : form.collection_id,
        amount: form.amount, reference: form.reference, received_on: form.received_on, confirmed: form.confirmed }
      try { sessionStorage.setItem(key(), JSON.stringify(value)) }
      catch { error.value = 'storage'; return }
      command.value = value
    }
    const current = generation, submitted = command.value
    busy.value = true; error.value = ''
    try {
      const result = await $fetch(`/api/admin-orders/${orderId.value}/cod-cash`, {
        method: 'POST', headers: await getAdminAuthHeaders(), body: submitted, retry: 0
      })
      if (current !== generation) return
      if (result?.status !== 'committed' || result.command_id !== submitted.command_id || !result.entry_id || !result.audit_id) throw Error('Unknown result')
      outcome.value = result
      await onCommitted()
    } catch (failure) {
      if (current !== generation) return
      const reason = failure?.data?.data?.codCashError
      error.value = reason || 'unknown'
    } finally { if (current === generation) busy.value = false }
  }
  const clear = () => {
    if (busy.value || !outcome.value && (!error.value || ['unknown', 'storage'].includes(error.value))) return
    try { sessionStorage.removeItem(key()) }
    catch { error.value = 'storage'; return }
    command.value = null; outcome.value = null; error.value = ''; form.confirmed = false; form.reference = ''; form.amount = ''; form.collection_id = ''; form.action = 'receive'
  }
  watch(identity, () => {
    generation++; command.value = null; outcome.value = null; busy.value = false; error.value = ''
    form.confirmed = false; if (mounted) restore()
  })
  onMounted(() => { mounted = true; restore() })
  onBeforeUnmount(() => { generation++ })
  return { command, outcome, busy, error, submit, clear,
    locked: computed(() => Boolean(command.value) || busy.value || error.value === 'storage') }
}
