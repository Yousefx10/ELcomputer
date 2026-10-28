import { readProductCardVariants } from '~/utils/productCardPurchase'

// Share only simultaneous public catalog reads within this Nuxt app. Settled
// results and failures are not cached across routes, sessions or SSR requests.
const requests = new WeakMap()
export const useProductCardVariants = (product) => {
  const nuxt = useNuxtApp(), client = useSupabaseClient()
  const variants = shallowRef(null), status = ref('idle')
  let generation = 0
  const load = async () => {
    const version = ++generation, id = product.value?.id
    variants.value = null
    if (product.value?.is_serialized !== true) { status.value = 'resolved'; return }
    status.value = 'pending'
    let jobs = requests.get(nuxt)
    if (!jobs) { jobs = new Map(); requests.set(nuxt, jobs) }
    let job = jobs.get(id)
    if (!job) {
      job = readProductCardVariants(client, id).finally(() => { if (jobs.get(id) === job) jobs.delete(id) })
      jobs.set(id, job)
    }
    try {
      const result = await job
      if (version === generation) { variants.value = result; status.value = 'resolved' }
    } catch {
      if (version === generation) status.value = 'error'
    }
  }
  watch(() => [product.value?.id, product.value?.is_serialized], () => { if (import.meta.client) load() }, { immediate: true, flush: 'sync' })
  onScopeDispose(() => { generation++ })
  return { variants, pending: computed(() => product.value?.is_serialized === true && ['idle','pending'].includes(status.value)), error: computed(() => status.value === 'error') }
}
