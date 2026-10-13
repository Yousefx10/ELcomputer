import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

export const useProductSection = () => {
  const { t } = useI18n()
  const running = ref(false)
  const status = ref('ready')
  const error = computed(() => status.value === 'unknown' ? t('productEditor.sectionUnknown')
    : status.value === 'conflict' ? t('productEditor.sectionConflict')
    : status.value === 'refresh_failed' ? t('productEditor.sectionRefreshFailed')
    : status.value === 'failed' ? t('productEditor.sectionFailed') : '')
  const run = async operation => {
    if (running.value || status.value === 'unknown') return
    const previous = status.value
    running.value = true
    status.value = 'saving'
    try { await operation(); if (status.value === 'saving') status.value = previous }
    catch (failure) {
      status.value = status.value === 'saved' ? 'refresh_failed' : failure?.editorConflict ? 'conflict'
        : failure?.code || failure?.status && failure.status < 500 ? 'failed' : 'unknown'
    } finally { running.value = false }
  }
  const reset = () => { status.value = 'ready' }
  const markSaved = () => { status.value = 'saved' }
  return { running, status, error, run, reset, markSaved }
}
