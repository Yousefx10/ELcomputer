import { FAVORITES_KEY, favoriteIds, setFavorite, accountFavoriteSession, persistAccountFavorites } from '~/utils/productFinishing'

// Favorites are private preferences, never authorization or merchandising facts.
// Guest and account lists stay separate; signing in never uploads guest history.
export const useProductFavorites = productId => {
  const client = useSupabaseClient(), user = useSupabaseUser(), config = useRuntimeConfig()
  const ids = ref([]), ready = ref(false), busy = ref(false), feedback = ref('')
  const actor = computed(() => user.value?.is_anonymous === true ? '' : user.value?.sub || user.value?.id || '')
  const saved = computed(() => ids.value.includes(String(toValue(productId) || '').toLowerCase()))
  let generation = 0, mounted = false
  const guestRead = () => { const raw = localStorage.getItem(FAVORITES_KEY); try { return favoriteIds(JSON.parse(raw || '[]')) } catch { return [] } }
  const account = expected => accountFavoriteSession(client, expected)
  const load = async () => {
    if (!mounted) return
    const version = ++generation, expected = actor.value
    ready.value = false; ids.value = []; feedback.value = ''; busy.value = false
    try {
      const values = expected ? (await account(expected)).ids : guestRead()
      if (version === generation) { ids.value = values; ready.value = true }
    } catch { if (version === generation) feedback.value = 'favoritesUnavailable' }
  }
  const toggle = async () => {
    if (busy.value) return
    if (!ready.value) { await load(); return }
    const version = generation, expected = actor.value, desired = !saved.value
    busy.value = true; feedback.value = ''
    try {
      const current = expected ? await account(expected) : { ids: guestRead() }
      if (version !== generation || expected !== actor.value) return
      const next = setFavorite(current.ids, toValue(productId), desired)
      if (expected) {
        // Freeze this request's bearer. An account switch cannot retarget a write.
        // GoTrue merges this one metadata key; unrelated profile fields survive.
        await persistAccountFavorites($fetch, config.public.supabase, current.token, expected, next)
      } else localStorage.setItem(FAVORITES_KEY, JSON.stringify(next))
      if (version === generation && expected === actor.value) { ids.value = next; feedback.value = desired ? (expected ? 'favoriteSavedAccount' : 'favoriteSavedGuest') : 'favoriteRemoved' }
    } catch (error) {
      if (version === generation) { ready.value = false; feedback.value = error?.message === 'limit' ? 'favoritesLimit' : 'favoritesFailed' }
    } finally { if (version === generation) busy.value = false }
  }
  const onStorage = event => { if (!actor.value && event.key === FAVORITES_KEY) load() }
  onMounted(() => { mounted = true; load(); window.addEventListener('storage', onStorage) })
  watch(actor, load)
  onBeforeUnmount(() => { mounted = false; generation++; window.removeEventListener('storage', onStorage) })
  return { saved, busy, ready, feedback, toggle }
}
