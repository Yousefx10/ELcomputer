import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

// Keep an unresolved command immutable. Its receipt survives lost responses;
// session storage retains only its UUID, scoped to the signed-in administrator.
export const useProductSave = (url, method) => {
  const { adminUser } = useAdminAccess()
  const { getAdminAuthHeaders } = useAdminLogs()
  const { invalidate } = useDashboardCache()
  const { t, te } = useI18n()
  const saving = ref(false)
  const error = ref('')
  const errorKey = ref('')
  const errorField = ref('')
  const conflict = ref(false)
  const unconfirmed = ref(false)
  let pending = null
  const storageKey = () => `product-save:${adminUser?.value?.id || 'session'}:${method}:${url}`
  const readRequest = () => {
    try { return sessionStorage.getItem(storageKey()) } catch { return null }
  }
  const storeRequest = id => {
    try { sessionStorage.setItem(storageKey(), id) } catch { /* The in-memory command still supports retries. */ }
  }
  const clearRequest = () => {
    pending = null
    try { sessionStorage.removeItem(storageKey()) } catch { /* Storage may be unavailable. */ }
  }
  const fail = failure => {
    const wasUnconfirmed = unconfirmed.value
    const reason = failure?.data?.data?.productSaveError || failure?.data?.productSaveError || ''
    errorKey.value = reason
    conflict.value = ['conflict', 'request_reused', 'unavailable'].includes(reason)
    const status = failure?.statusCode || failure?.status || failure?.response?.status
    const field = failure?.data?.data?.field || failure?.data?.field
    errorField.value = field || ''
    const warranty = failure?.data?.data?.warrantyErrorKey || failure?.data?.warrantyErrorKey
    const messageKey = warranty && te(`warranty.${warranty}`) ? `warranty.${warranty}`
      : reason === 'validation' && ['price', 'old_price', 'sku', 'stock_quantity'].includes(field) ? `productSave.${field}`
      : te(`productSave.errors.${reason}`) ? `productSave.errors.${reason}`
      : status === 401 ? 'productSave.errors.session' : status === 403 ? 'productSave.errors.permission'
      : status && status < 500 ? 'productSave.errors.validation' : 'productSave.errors.unconfirmed'
    error.value = t(messageKey)
    unconfirmed.value = reason === 'unconfirmed' || !status || status >= 500
      || wasUnconfirmed && !conflict.value
    // A rejection of this attempt cannot prove that an earlier attempt failed.
    // Keep its UUID through validation/auth errors; corrected details can use
    // that same UUID until a completed receipt is confirmed.
    if (!unconfirmed.value) pending = null
  }
  const submit = async body => {
    if (saving.value || conflict.value) return null
    saving.value = true
    error.value = ''; errorKey.value = ''; errorField.value = ''
    try {
      if (!pending) {
        const request = readRequest() || crypto.randomUUID()
        pending = { ...JSON.parse(JSON.stringify(body)), request_id: request }
        storeRequest(request)
      }
      const result = await $fetch(url, {
        method, headers: await getAdminAuthHeaders(), body: pending, retry: 0, timeout: 30000
      })
      if (!result?.id || !Number.isSafeInteger(result.revision)) throw new Error('Unconfirmed save response')
      clearRequest(); unconfirmed.value = false
      return result
    } catch (failure) { fail(failure); return null }
    finally { saving.value = false }
  }
  const recover = async () => {
    const request = readRequest()
    if (!request || saving.value) return null
    saving.value = true
    try {
      const { result } = await $fetch('/api/admin-products', {
        query: { request_id: request }, headers: await getAdminAuthHeaders(), retry: 0, timeout: 30000
      })
      if (result?.id && Number.isSafeInteger(result.revision)) {
        clearRequest(); unconfirmed.value = false; conflict.value = false; error.value = ''
        invalidate('dashboard:products:')
        invalidate('dashboard:home')
        return result
      }
      // No completed receipt yet. Permit correction without starting a new
      // request; an earlier in-flight command still shares this UUID.
      pending = null; unconfirmed.value = false
      return null
    } catch (failure) { fail(failure); return null }
    finally { saving.value = false }
  }
  const resetConflict = () => {
    clearRequest()
    conflict.value = false; error.value = ''; errorKey.value = ''; errorField.value = ''; unconfirmed.value = false
  }
  return { saving, error, errorKey, errorField, conflict, unconfirmed, submit, recover, resetConflict }
}
