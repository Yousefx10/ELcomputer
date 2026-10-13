import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router'
import { useI18n } from 'vue-i18n'

// Draft contents stay in this tab's Nuxt memory, never local/session storage.
export const useProductEditor = (key, fields, { revision, busy, extraDirty } = {}) => {
  const { adminUser } = useAdminAccess()
  const { t } = useI18n()
  const drafts = useState('product-editor-drafts', () => ({}))
  const actor = adminUser.value?.id
  const draftKey = `${actor}:${key}`
  const read = () => JSON.parse(JSON.stringify(Object.fromEntries(
    Object.entries(fields).map(([name, field]) => [name, field.value])
  )))
  const baseline = ref(JSON.stringify(read()))
  const dirty = computed(() => JSON.stringify(read()) !== baseline.value)
  const guarded = computed(() => dirty.value || extraDirty?.value || busy?.value)
  let prerequisite = false
  const forget = () => { delete drafts.value[draftKey] }
  const markSaved = ({ forgetDraft = true } = {}) => {
    baseline.value = JSON.stringify(read())
    if (forgetDraft) forget()
  }
  const restore = () => {
    const draft = drafts.value[draftKey]
    if (!draft || adminUser.value?.id !== actor) return false
    for (const [name, field] of Object.entries(fields)) {
      if (Object.hasOwn(draft.values, name)) field.value = draft.values[name]
    }
    baseline.value = draft.baseline
    if (revision) revision.value = draft.revision
    forget()
    return true
  }
  const visitPrerequisite = async navigate => {
    if (busy?.value || adminUser.value?.id !== actor) return
    if (extraDirty?.value && !window.confirm(t('productEditor.discardSections'))) return
    drafts.value[draftKey] = { values: read(), baseline: baseline.value, revision: revision?.value }
    prerequisite = true
    try { await navigate() } finally { prerequisite = false }
  }
  const allowNavigation = () => {
    if (busy?.value) return false
    if (prerequisite || !guarded.value) return true
    if (!window.confirm(t('productEditor.discard'))) return false
    forget()
    return true
  }
  onBeforeRouteLeave(allowNavigation)
  onBeforeRouteUpdate((to, from) => to.path === from.path || allowNavigation())
  const beforeUnload = event => {
    if (!guarded.value) return
    event.preventDefault()
    event.returnValue = '' // Browsers supply their own warning text.
  }
  onMounted(() => window.addEventListener('beforeunload', beforeUnload))
  onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
  watch(() => adminUser.value?.id, next => {
    if (next !== actor) drafts.value = {}
  })
  return { dirty, guarded, markSaved, restore, visitPrerequisite }
}
