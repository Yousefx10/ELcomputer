<template>
  <div class="file-workspace">
    <div class="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <Icon name="lucide:shield-alert" size="20" class="shrink-0" />
      <div><p class="font-semibold">Resets permanently erase data.</p><p class="mt-1 text-xs">Review the scope and export anything you need first.</p></div>
    </div>

    <div v-if="success" role="status" class="file-surface p-5">
      <p class="flex items-center gap-2 font-semibold text-green-700"><Icon name="lucide:circle-check" size="19" /> Reset completed</p>
      <p class="mt-2 text-sm text-gray-500">The completion log records your name and reset scope.</p>
      <NuxtLink to="/dashboard/settings?tab=logs" class="file-button mt-4" @click="clearCachedData">View activity log <Icon name="lucide:arrow-right" size="15" /></NuxtLink>
    </div>
    <div v-if="pending" class="file-surface border-amber-200 p-5" role="status">
      <p class="font-semibold">A reset needs to finish.</p>
      <p class="mt-1 text-sm text-gray-500">Data was erased. Remaining cleanup must finish before another reset.</p>
      <button v-if="pending.canResume" type="button" class="file-button mt-4" @click="reviewScope(scopes.find(item => item.key === pending.scope), pending.id)">Resume cleanup</button>
      <p v-else class="mt-2 text-xs text-gray-500">The owner who started this reset must finish it.</p>
    </div>
    <div v-if="pageError" role="alert" class="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{{ pageError }}</div>
    <div v-if="loading" role="status" class="file-surface p-8 text-center text-sm text-gray-500">Loading reset options…</div>
    <button v-else-if="!scopes.length" type="button" class="file-button" @click="loadOptions">Retry</button>
    <template v-else>
      <div class="flex items-center justify-between gap-3"><h3 class="text-lg font-semibold">Specific resets</h3><span class="inline-flex items-center gap-1.5 text-xs text-gray-500"><Icon name="lucide:lock-keyhole" size="14" /> Owner only</span></div>
      <div class="grid gap-3 md:grid-cols-2">
        <article v-for="scope in specificScopes" :key="scope.key" class="file-surface flex flex-col p-5">
          <div class="flex items-start gap-3"><span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500"><Icon :name="scope.icon" size="20" /></span><div><h4 class="text-sm font-semibold">{{ scope.label }}</h4><p class="mt-1.5 text-sm text-gray-500">{{ scope.description }}</p></div></div>
          <button type="button" class="file-button mt-5 self-start" :disabled="Boolean(pending)" @click="reviewScope(scope)">Review reset <Icon name="lucide:arrow-right" size="14" /></button>
        </article>
      </div>
      <article v-if="fullScope" class="flex flex-col gap-5 rounded-2xl border border-red-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-start gap-3"><span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600"><Icon name="lucide:rotate-ccw" size="22" /></span><div><h3 class="font-semibold">Full system reset</h3><p class="mt-1.5 text-sm text-gray-500">Erase website data and start again.</p><p class="mt-1 text-xs text-gray-500">Your current owner login remains.</p></div></div>
        <button type="button" class="file-button !border-red-200 !text-red-700 hover:!bg-red-50" :disabled="Boolean(pending)" @click="reviewScope(fullScope)">Review full reset</button>
      </article>
    </template>

    <Teleport to="body">
      <dialog ref="dialog" class="reset-dialog m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl bg-white p-0 shadow-xl backdrop:bg-gray-950/60" aria-labelledby="reset-dialog-title" @keydown.esc="handleCancel" @cancel="handleCancel" @close="clearPassword">
        <form v-if="selectedScope" class="p-5 sm:p-6" @submit.prevent="executeReset">
          <div class="flex items-center justify-between gap-3"><h3 id="reset-dialog-title" class="text-xl font-semibold">{{ resuming ? 'Finish reset cleanup' : selectedScope.label }}</h3><button type="button" aria-label="Close reset confirmation" class="file-button !min-h-8 !p-2" :disabled="working" @click="closeDialog"><Icon name="lucide:x" size="18" /></button></div>
          <ul class="mt-4 list-disc space-y-2 ps-5 text-sm text-gray-600"><li v-for="detail in selectedScope.details" :key="detail">{{ detail }}</li></ul>
          <div v-if="planLoading" role="status" class="mt-5 rounded-xl bg-gray-50 p-4 text-sm text-gray-500">Checking affected records…</div>
          <div v-else-if="plan && !resuming" class="mt-5 rounded-xl border border-gray-200">
            <div class="flex items-center justify-between border-b border-gray-100 px-4 py-3 text-xs"><span class="font-semibold">Records to erase</span><span class="tabular-nums text-gray-500">{{ recordTotal.toLocaleString() }} total</span></div>
            <dl class="max-h-40 overflow-y-auto px-4 py-2"><div v-for="entry in affectedCounts" :key="entry.table" class="flex justify-between gap-3 py-1.5 text-xs"><dt class="text-gray-500">{{ tableLabel(entry.table) }}</dt><dd class="font-medium tabular-nums">{{ entry.count.toLocaleString() }}</dd></div><div v-if="plan.mediaFiles !== undefined" class="flex justify-between gap-3 py-1.5 text-xs"><dt class="text-gray-500">Uploaded images</dt><dd class="font-medium">{{ plan.mediaFiles }}</dd></div></dl>
          </div>
          <div v-if="plan?.blockers?.length && !resuming" role="alert" class="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900"><p class="font-semibold">Linked records prevent this reset.</p><p class="mt-1 text-xs">Review a commerce or full reset to include linked data.</p><ul class="mt-2 space-y-1 text-xs"><li v-for="blocker in uniqueBlockers" :key="blocker.table">{{ tableLabel(blocker.table) }}: {{ blocker.count }}</li></ul></div>
          <div v-if="error" role="alert" class="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{{ error }}</div>
          <fieldset :disabled="working || planLoading || !canConfirm" class="mt-5 space-y-4 disabled:opacity-50">
            <label class="block"><span class="mb-1.5 block text-sm font-medium">Type <strong>{{ selectedScope.confirmation }}</strong> to confirm</span><input v-model="confirmation" type="text" autocomplete="off" spellcheck="false" required class="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-gray-700" /></label>
            <label class="block"><span class="mb-1.5 block text-sm font-medium">Your current owner password</span><input v-model="password" type="password" autocomplete="current-password" maxlength="1024" required class="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-gray-700" /></label>
          </fieldset>
          <p class="mt-4 text-xs text-gray-500">{{ working ? 'Keep this page open while the reset finishes.' : 'This action cannot be undone.' }}</p>
          <div class="mt-5 flex justify-end gap-2"><button type="button" class="file-button" :disabled="working" @click="closeDialog">Cancel</button><button type="submit" :disabled="!canConfirm || working || planLoading || confirmation !== selectedScope.confirmation || !password" class="file-button !border-red-600 !bg-red-600 !text-white hover:!bg-red-700"><Icon v-if="working" name="lucide:loader-circle" size="16" class="motion-safe:animate-spin" />{{ working ? 'Resetting…' : resuming ? 'Finish cleanup' : 'Permanently reset' }}</button></div>
        </form>
      </dialog>
    </Teleport>
  </div>
</template>

<script setup>
const emit = defineEmits(['changed'])
const supabase = useSupabaseClient()
const { invalidate } = useDashboardCache()
const scopes = ref([])
const pending = ref(null)
const loading = ref(true)
const pageError = ref('')
const success = ref(false)
const dialog = ref(null)
const selectedScope = ref(null)
const plan = ref(null)
const planLoading = ref(false)
const operationId = ref('')
const resuming = ref(false)
const confirmation = ref('')
const password = ref('')
const error = ref('')
const working = ref(false)
const storageKey = 'elcomputer-system-reset-request'
let planRequest = 0

const specificScopes = computed(() => scopes.value.filter(scope => scope.key !== 'full'))
const fullScope = computed(() => scopes.value.find(scope => scope.key === 'full'))
const affectedCounts = computed(() => Object.entries(plan.value?.counts || {}).filter(([, count]) => count > 0).map(([table, count]) => ({ table, count })))
const recordTotal = computed(() => affectedCounts.value.reduce((sum, entry) => sum + entry.count, 0))
const uniqueBlockers = computed(() => [...new Map((plan.value?.blockers || []).map(entry => [entry.table, entry])).values()])
const canConfirm = computed(() => resuming.value || Boolean(plan.value && !plan.value.blockers?.length))
const tableLabel = (table) => table.replace(/^(commerce_|store_|site_)/, '').replaceAll('_', ' ').replace(/^./, character => character.toUpperCase())
const getHeaders = async () => {
  const { data } = await supabase.auth.getSession()
  if (!data.session?.access_token) throw new Error('Your session expired. Sign in again.')
  return { authorization: `Bearer ${data.session.access_token}` }
}
const clearCachedData = () => {
  invalidate()
  emit('changed')
  refreshNuxtData('site-content').catch(() => {})
}
const loadOptions = async () => {
  loading.value = true
  pageError.value = ''
  try {
    let saved
    try { saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null') } catch { /* Storage is optional. */ }
    const response = await $fetch('/api/admin-system-reset', { headers: await getHeaders(), query: saved?.id ? { operationId: saved.id } : undefined })
    scopes.value = response.scopes
    pending.value = response.pending
    if (pending.value) clearCachedData()
    if (response.operation?.status === 'completed') {
      success.value = true
      clearCachedData()
      try { sessionStorage.removeItem(storageKey) } catch { /* Storage is optional. */ }
    }
  } catch (err) {
    pageError.value = err?.data?.statusMessage || err.message || 'Could not load reset options.'
  } finally { loading.value = false }
}
const reviewScope = async (scope, resumeId = '') => {
  if (!scope || working.value) return
  selectedScope.value = scope
  operationId.value = resumeId || crypto.randomUUID()
  resuming.value = Boolean(resumeId)
  confirmation.value = ''
  password.value = ''
  error.value = ''
  plan.value = null
  planLoading.value = !resuming.value
  const request = ++planRequest
  await nextTick()
  dialog.value?.showModal()
  if (resuming.value) return
  try {
    const response = await $fetch('/api/admin-system-reset', { headers: await getHeaders(), query: { scope: scope.key } })
    if (request === planRequest) plan.value = response.plan
  } catch (err) {
    if (request === planRequest) error.value = err?.data?.statusMessage || err.message || 'Could not review this reset.'
  } finally { if (request === planRequest) planLoading.value = false }
}
const clearPassword = () => { password.value = '' }
const closeDialog = () => {
  if (working.value) return
  ++planRequest
  clearPassword()
  dialog.value?.close()
}
const handleCancel = (event) => { if (working.value) event.preventDefault() }
const handleResetKeydown = (event) => {
  // Disabling the focused input can move focus to the body while the request runs.
  if (event.key === 'Escape' && working.value && dialog.value?.open) event.preventDefault()
}
const executeReset = async () => {
  if (working.value || !canConfirm.value || confirmation.value !== selectedScope.value?.confirmation || !password.value) return
  working.value = true
  error.value = ''
  const scope = selectedScope.value.key
  try {
    try { sessionStorage.setItem(storageKey, JSON.stringify({ id: operationId.value, scope })) } catch { /* Server also retains pending requests. */ }
    const result = await $fetch('/api/admin-system-reset', {
      method: 'POST', retry: 0, headers: await getHeaders(),
      body: { scope, operationId: operationId.value, confirmation: confirmation.value, password: password.value }
    })
    if (result.status !== 'completed') throw new Error('Cleanup is still pending. Retry to finish.')
    success.value = true
    pending.value = null
    clearCachedData()
    try { sessionStorage.removeItem(storageKey) } catch { /* Storage is optional. */ }
    dialog.value?.close()
  } catch (err) {
    error.value = err?.data?.statusMessage || err.message || 'The reset could not finish. Retry this request.'
    await loadOptions()
    if (pending.value?.id === operationId.value) resuming.value = true
  } finally {
    password.value = ''
    working.value = false
  }
}
onMounted(() => {
  loadOptions()
  window.addEventListener('keydown', handleResetKeydown, true)
})
onBeforeUnmount(() => {
  clearPassword()
  window.removeEventListener('keydown', handleResetKeydown, true)
})
</script>
