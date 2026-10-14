import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'

// A tab keeps the original command until its outcome is checked and the
// administrator explicitly starts another payment. Storage failure blocks send.
export function useSalaryPayment({ form, reset, canEdit }) {
  const { adminUser } = useAdminAccess()
  const { getAdminAuthHeaders } = useAdminLogs()
  const actor = computed(() => adminUser.value?.id || '')
  const command = ref(null), outcome = ref(null), busy = ref(false), error = ref('')
  let mounted = false, generation = 0
  const key = id => `elcomputer:salary-command:${id}`
  const restore = () => {
    if (!actor.value) return
    try {
      const raw = sessionStorage.getItem(key(actor.value))
      if (!raw) return
      const value = JSON.parse(raw)
      if (!value?.command_id || !value.employee_id || typeof value.amount !== 'number') throw Error('Invalid command')
      command.value = value
      Object.assign(form, { ...value, salary_period: value.salary_period.slice(0, 7) })
      error.value = 'unknown'
    } catch { error.value = 'storage' }
  }
  const send = async () => {
    if (busy.value || !command.value || outcome.value || !canEdit.value) return
    const current = generation, id = actor.value, submitted = command.value
    busy.value = true; error.value = ''
    try {
      const result = await $fetch('/api/admin-treasury/salary-payment', {
        method: 'POST', headers: await getAdminAuthHeaders(), body: submitted, retry: 0
      })
      if (current !== generation || id !== actor.value) return
      if (result?.status !== 'committed' || result.command_id !== submitted.command_id || !result.transaction_id || !result.audit_id) throw Error('Unknown result')
      outcome.value = result
    } catch (failure) {
      if (current !== generation || id !== actor.value) return
      const reason = failure?.data?.data?.salaryPaymentError
      error.value = ['permission', 'invalid', 'reused', 'reset', 'employee'].includes(reason) ? reason
        : [401, 403].includes(failure?.statusCode || failure?.response?.status) ? 'permission' : 'unknown'
      if (error.value === 'reset') outcome.value = { status: 'reset' }
    } finally { if (current === generation && id === actor.value) busy.value = false }
  }
  const submit = () => {
    if (busy.value || outcome.value || !canEdit.value || !actor.value || error.value === 'storage') return
    if (!command.value) {
      const value = { command_id: crypto.randomUUID(), employee_id: form.employee_id,
        amount: Number(form.amount), salary_period: `${form.salary_period}-01`, paid_at: form.paid_at,
        reference_number: form.reference_number, notes: form.notes }
      try { sessionStorage.setItem(key(actor.value), JSON.stringify(value)) }
      catch { error.value = 'storage'; return }
      command.value = value
    }
    return send()
  }
  const newPayment = () => {
    if (!outcome.value || busy.value || !canEdit.value) return
    try { sessionStorage.removeItem(key(actor.value)) }
    catch { error.value = 'storage'; return }
    command.value = null; outcome.value = null; error.value = ''; reset()
  }
  watch(actor, () => {
    generation++; command.value = null; outcome.value = null; busy.value = false; error.value = ''
    reset(); if (mounted) restore()
  })
  onMounted(() => { mounted = true; restore() })
  onBeforeUnmount(() => { mounted = false; generation++ })
  return { command, outcome, busy, error, submit, newPayment,
    locked: computed(() => Boolean(command.value) || busy.value || error.value === 'storage') }
}
