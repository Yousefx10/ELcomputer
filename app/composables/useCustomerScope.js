import { useCustomerIdentity } from './useCustomerIdentity'

// A component's private requests belong to its original session lifetime.
// Switching A -> B -> A cannot revive an old request or queued action.
export const useCustomerScope = () => {
  const identity = useCustomerIdentity()
  const accountId = identity.accountId.value
  const key = identity.key.value
  const supabase = useSupabaseClient()
  const controller = new AbortController()
  const invalidated = new Set()
  let disposed = false
  const isCurrent = () => !disposed && Boolean(accountId) && identity.key.value === key
  const assertCurrent = () => {
    if (!isCurrent()) throw new Error('Your session changed. Please sign in again.')
  }
  const invalidate = () => {
    if (disposed) return
    disposed = true
    controller.abort()
    for (const callback of invalidated) callback()
    invalidated.clear()
  }
  const stop = watch(identity.key, invalidate, { flush: 'sync' })
  onScopeDispose(() => { stop(); invalidate() })
  const headers = async () => {
    assertCurrent()
    const { data, error } = await supabase.auth.getSession()
    assertCurrent()
    if (error || !data.session?.access_token || data.session.user?.id !== accountId
      || data.session.user?.is_anonymous === true) throw new Error('Please sign in again.')
    return { authorization: `Bearer ${data.session.access_token}` }
  }
  const request = async (path, options = {}) => {
    const requestController = new AbortController()
    const signals = [controller.signal, options.signal].filter(Boolean)
    const abort = event => requestController.abort(event.target.reason)
    for (const signal of signals) {
      if (signal.aborted) requestController.abort(signal.reason)
      else signal.addEventListener('abort', abort, { once: true })
    }
    let timer
    try {
      const authorization = await headers()
      assertCurrent()
      if (options.timeout > 0) timer = setTimeout(() => {
        const error = new Error('Request timed out.'); error.name = 'TimeoutError'
        requestController.abort(error)
      }, options.timeout)
      const result = await $fetch(path, { ...options, signal: requestController.signal,
        headers: { ...options.headers, ...authorization } })
      assertCurrent()
      return result
    } catch (error) { assertCurrent(); throw error }
    finally { clearTimeout(timer); for (const signal of signals) signal.removeEventListener('abort', abort) }
  }
  const onInvalidate = callback => {
    if (disposed) callback()
    else invalidated.add(callback)
  }
  return { accountId, key, isCurrent, assertCurrent, headers, request, onInvalidate }
}
