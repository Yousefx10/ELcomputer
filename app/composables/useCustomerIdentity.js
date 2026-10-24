const identities = new WeakMap()

// Session changes precede the asynchronous JWT-claims refresh in the Auth plugin.
// Browser identity therefore comes from its current session, never stale claims.
export const useCustomerIdentity = () => {
  const app = useNuxtApp()
  if (identities.has(app)) return identities.get(app)
  const session = useSupabaseSession()
  const claims = useSupabaseUser()
  const user = computed(() => import.meta.client ? session.value?.user || null : claims.value)
  const accountId = computed(() => user.value?.is_anonymous === true ? '' : String(user.value?.id || user.value?.sub || ''))
  const epoch = useState('customer-session-epoch', () => 0)
  if (import.meta.client) {
    // One observer per Nuxt app; page/layout remounts must not stop it.
    const scope = effectScope(true)
    scope.run(() => watch(accountId, () => { epoch.value++ }, { flush: 'sync' }))
    app.vueApp?.onUnmount(() => scope.stop())
  }
  const key = computed(() => `${accountId.value || 'guest'}:${epoch.value}`)
  const identity = { accountId, key, user }
  identities.set(app, identity)
  return identity
}
