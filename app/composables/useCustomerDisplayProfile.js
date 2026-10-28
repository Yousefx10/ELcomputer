const profiles = new WeakMap()

// Private to this Nuxt app/session lifetime. Never serialized or stored locally.
export const useCustomerDisplayProfile = () => {
  const app = useNuxtApp()
  if (!profiles.has(app)) {
    const identity = useCustomerIdentity()
    const supabase = useSupabaseClient()
    const value = shallowRef(null)
    const resolvedKey = ref('')
    let started = false, version = 0, controller, request = null, requestKey = ''
    const ready = computed(() => Boolean(identity.accountId.value) && resolvedKey.value === identity.key.value)
    const profile = computed(() => ready.value ? value.value : null)
    const invalidate = () => {
      ++version; controller?.abort(); controller = null
      value.value = null; resolvedKey.value = ''; request = null; requestKey = ''
    }
    const load = (refresh = false) => {
      if (!import.meta.client || !identity.accountId.value) return Promise.resolve()
      const key = identity.key.value, accountId = identity.accountId.value
      if (!refresh && ready.value) return Promise.resolve()
      if (!refresh && request && requestKey === key) return request
      controller?.abort()
      const sequence = ++version
      controller = new AbortController()
      const activeController = controller
      const timeout = setTimeout(() => activeController.abort(), 20000)
      requestKey = key
      request = (async () => {
        try {
          const result = await supabase.from('customer_profiles').select('id, full_name, created_at, is_active')
            .eq('id', accountId).maybeSingle().abortSignal(controller.signal)
          if (sequence !== version || identity.key.value !== key) return
          if (result.error) throw result.error
          value.value = result.data?.id === accountId && result.data.is_active !== false ? result.data : null
        } catch {
          if (sequence !== version || identity.key.value !== key) return
          // A same-account refresh may retain its last successful name.
        } finally {
          clearTimeout(timeout)
          if (sequence === version && identity.key.value === key) {
            resolvedKey.value = key; request = null; requestKey = ''
          }
        }
      })()
      return request
    }
    if (import.meta.client) {
      const scope = effectScope(true)
      const updated = () => { void load(true) }
      scope.run(() => watch(identity.key, () => {
        invalidate()
        if (started) void Promise.resolve().then(() => load())
      }, { flush: 'sync' }))
      const start = () => {
        if (!started) { started = true; window.addEventListener('account:profile-updated', updated) }
        return load()
      }
      app.vueApp?.onUnmount(() => { invalidate(); scope.stop(); window.removeEventListener('account:profile-updated', updated) })
      profiles.set(app, { profile, ready, start })
    } else profiles.set(app, { profile, ready, start: () => Promise.resolve() })
  }
  const shared = profiles.get(app)
  onMounted(shared.start)
  return shared
}
