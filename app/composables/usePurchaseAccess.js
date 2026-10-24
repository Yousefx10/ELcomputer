// In-flight requests belong to a Nuxt application/request, never another SSR user.
const requests = new WeakMap()
const closed = () => ({ card: { available: false }, express: [], purchase: { available: false } })

export const usePurchaseAccess = () => {
  const runtime = useRuntimeConfig()
  const nuxt = useNuxtApp()
  const supabase = useSupabaseClient()
  const identity = useCustomerIdentity()
  const snapshot = useState('normal-purchase-access', () => ({ accountId: '', data: /** @type {any} */ (closed()) }))
  const now = ref(Date.now())
  const publicAccess = computed(() => runtime.public.purchasingEnabled === true || runtime.public.purchasingEnabled === 'true')
  const accountId = identity.accountId
  const capabilities = computed(() => snapshot.value.accountId === accountId.value ? snapshot.value.data : closed())
  const scope = computed(() => {
    const access = capabilities.value.purchase
    return !publicAccess.value && access?.available === true && access.restricted === true
      && Date.parse(access.expiresAt) > now.value ? access : null
  })
  const purchasingEnabled = computed(() => publicAccess.value || Boolean(scope.value))
  const allowsProduct = (productId, variantId = undefined) => publicAccess.value || Boolean(scope.value
    && scope.value.productId === productId && (variantId === undefined || scope.value.variantId === variantId))

  const refresh = async () => {
    now.value = Date.now()
    const generation = identity.key.value
    let requestedAccountId
    try {
      const session = (await supabase.auth.getSession()).data.session
      const id = session?.user?.id || ''
      requestedAccountId = id
      if (generation !== identity.key.value || id !== accountId.value) return closed()
      if (!publicAccess.value && !session?.access_token) {
        snapshot.value = { accountId: id, data: closed() }
        return capabilities.value
      }
      let job = requests.get(nuxt)
      if (!job || job.accountId !== id || job.token !== session?.access_token) {
        job = { accountId: id, token: session?.access_token, promise: $fetch('/api/payments/capabilities', {
          headers: session?.access_token ? { authorization: 'Bearer ' + session.access_token } : {},
          retry: 0
        }) }
        requests.set(nuxt, job)
      }
      try {
        const data = await job.promise
        const current = (await supabase.auth.getSession()).data.session
        if (generation !== identity.key.value || (current?.user?.id || '') !== id || current?.access_token !== session?.access_token) return closed()
        snapshot.value = { accountId: id, data }
        return data
      } finally { if (requests.get(nuxt) === job) requests.delete(nuxt) }
    } catch {
      if (generation === identity.key.value && (requestedAccountId === undefined || requestedAccountId === accountId.value)) {
        snapshot.value = { accountId: accountId.value, data: closed() }
      }
      return closed()
    }
  }
  // Route middleware also uses this composable; it refreshes explicitly and
  // must not register component hooks or leave a watcher behind.
  if (getCurrentInstance()) {
    watch(identity.key, () => {
      snapshot.value = { accountId: '', data: closed() }
      if (import.meta.client) refresh()
    }, { flush: 'sync' })
    let timer
    onMounted(() => {
      if (!publicAccess.value) refresh()
      timer = setInterval(() => { now.value = Date.now() }, 1000)
    })
    onScopeDispose(() => clearInterval(timer))
  }
  return { capabilities, scope, purchasingEnabled, allowsProduct, refresh }
}
