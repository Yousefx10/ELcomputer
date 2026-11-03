<template>
  <div class="min-w-0">
    <p v-if="loading" role="status" class="py-4 text-sm text-slate-600">{{ $t('paymob.loading') }}</p>
    <p v-if="error" role="alert" class="rounded-xl bg-red-50 p-4 text-sm text-red-700">{{ $t('paymob.unavailable') }}</p>
    <iframe v-if="frameSrc" ref="frame" :src="frameSrc" :title="$t('paymob.frameTitle')"
      :style="{ height: `${height}px` }" class="w-full min-w-0 border-0" referrerpolicy="no-referrer"
      sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-top-navigation-by-user-activation"
      allow="payment" />
  </div>
</template>
<script setup>
import { paymobPixelOptions } from '~/utils/paymobPixel'
const props = defineProps({ session: { type: Object, required: true } })
const emit = defineEmits(['complete', 'cancel'])
const { locale } = useI18n()
const colorMode = useColorMode()
const frame = ref(null), frameSrc = ref(''), height = ref(600)
const loading = ref(true), error = ref(false)
let disposed = false, timeout, expiryTimer, channel = '', mounted = false, completed = false
const receive = event => {
  if (disposed || event.origin !== window.location.origin || event.source !== frame.value?.contentWindow) return
  const data = event.data
  if (!data || data.source !== 'paymob-frame-v1') return
  if (data.type === 'ready' && !mounted) {
    const options = paymobPixelOptions({ ...props.session, elementId: 'paymob-card', locale: locale.value, dark: colorMode.value === 'dark' })
    frame.value.contentWindow.postMessage({ source: 'storefront-pixel-v1', type: 'initialize', channel, locale: locale.value, expiresAt: props.session.expiresAt, options }, window.location.origin)
    return
  }
  if (data.channel !== channel) return
  if (data.type === 'mounted') { mounted = true; clearTimeout(timeout); loading.value = false }
  else if (data.type === 'unavailable') { clearTimeout(timeout); clearTimeout(expiryTimer); error.value = true; loading.value = false; frameSrc.value = '' }
  else if (data.type === 'height' && Number.isInteger(data.height) && data.height >= 360 && data.height <= 1600) height.value = data.height
  else if (data.type === 'complete' && !completed) { completed = true; emit('complete') }
  else if (data.type === 'cancel') emit('cancel')
}
onMounted(() => {
  if (typeof globalThis.crypto?.randomUUID !== 'function') { loading.value = false; error.value = true; return }
  const expiry = Date.parse(props.session.expiresAt)
  if (!Number.isFinite(expiry) || expiry <= Date.now()) { loading.value = false; error.value = true; return }
  expiryTimer = setTimeout(() => { if (!disposed) { loading.value = false; error.value = true; frameSrc.value = '' } }, Math.min(expiry - Date.now(), 3600000))
  channel = crypto.randomUUID()
  window.addEventListener('message', receive)
  timeout = setTimeout(() => { if (!disposed && !mounted) { loading.value = false; error.value = true; frameSrc.value = '' } }, 15000)
  // Same-origin, integrity-pinned package. No secret enters a URL, log or storage.
  frameSrc.value = '/paymob-pixel/1.2.8/host.html'
})
onBeforeUnmount(() => {
  disposed = true; clearTimeout(timeout); clearTimeout(expiryTimer); window.removeEventListener('message', receive)
  frameSrc.value = ''
})
</script>
