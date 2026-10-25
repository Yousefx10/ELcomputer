<script setup>
import { loadTurnstile } from '~/utils/turnstile'

const props = defineProps({ modelValue: { type: String, default: '' }, siteKey: { type: String, required: true }, language: { type: String, default: 'en' }, theme: { type: String, default: 'light' }, resetKey: { type: Number, default: 0 }, disabled: Boolean })
const emit = defineEmits(['update:modelValue'])
const container = ref(null), status = ref('loading'), compact = ref(false)
let mounted = false, generation = 0, widget, api, observer
const clear = () => { if (widget !== undefined) { try { api?.remove(widget) } catch {} widget = undefined } }
const render = async () => {
  const current = ++generation
  emit('update:modelValue', ''); status.value = 'loading'; clear()
  try {
    const loaded = await loadTurnstile()
    if (!mounted || current !== generation) return
    api = loaded
    const invalid = () => { if (mounted && current === generation) { emit('update:modelValue', ''); status.value = 'error' } }
    widget = api.render(container.value, {
      sitekey: props.siteKey, language: props.language === 'ar' ? 'ar' : 'en', theme: props.theme === 'dark' ? 'dark' : 'light', size: compact.value ? 'compact' : 'flexible',
      'response-field': false, retry: 'never', 'refresh-expired': 'manual', 'refresh-timeout': 'manual',
      callback: token => {
        if (!mounted || current !== generation) return
        if (typeof token !== 'string' || !token || token.length > 2048) { invalid(); return }
        emit('update:modelValue', token); status.value = 'ready'
      },
      'error-callback': invalid, 'expired-callback': invalid, 'timeout-callback': invalid
    })
  } catch { if (mounted && current === generation) status.value = 'error' }
}
onMounted(() => {
  mounted = true
  compact.value = !!container.value?.clientWidth && container.value.clientWidth < 300
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(([entry]) => { compact.value = entry.contentRect.width < 300 })
    observer.observe(container.value)
  }
  render()
})
watch(() => [props.siteKey, props.language, props.theme, props.resetKey, compact.value], () => { if (mounted) render() })
onBeforeUnmount(() => { mounted = false; generation++; observer?.disconnect(); clear(); emit('update:modelValue', '') })
</script>

<template>
  <div class="auth-security" :aria-label="$t('authPage.securityCheck')">
    <div ref="container" class="auth-security-widget" />
    <p v-if="status === 'loading'" role="status">{{ $t('authPage.securityLoading') }}</p>
    <template v-if="status === 'error'">
      <p role="alert">{{ $t('authPage.securityUnavailable') }}</p>
      <button type="button" :disabled="disabled" @click="render">{{ $t('authPage.securityRetry') }}</button>
    </template>
  </div>
</template>

<style scoped>
.auth-security { min-width: 0; color: var(--text-secondary); font-size: 13px; line-height: 1.5; }
.auth-security-widget { min-height: 65px; }
.auth-security button { margin-top: 8px; color: var(--brand-text); font-weight: 700; text-decoration: underline; text-underline-offset: 3px; }
.auth-security button:focus-visible { outline: 2px solid var(--brand-text); outline-offset: 3px; }
.auth-security button:disabled { opacity: .55; }
</style>
