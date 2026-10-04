<template>
  <div class="min-w-0">
    <p v-if="loading" role="status" class="py-4 text-sm text-slate-600">{{ $t('paymob.loading') }}</p>
    <p v-if="error" role="alert" class="rounded-xl bg-red-50 p-4 text-sm text-red-700">{{ $t('paymob.unavailable') }}</p>
    <div :id="elementId" class="w-full min-w-0" />
  </div>
</template>
<script setup>
import { paymobPixelOptions } from '~/utils/paymobPixel'
const props = defineProps({ session: { type: Object, required: true } })
const emit = defineEmits(['complete', 'cancel'])
const { locale } = useI18n()
const colorMode = useColorMode()
const elementId = `paymob-${useId().replace(/[^a-z0-9-]/gi, '')}`
const loading = ref(true)
const error = ref(false)
let disposed = false
// Version pinned for review. SDK is loaded only after authenticated intention creation.
const sdkBase = 'https://cdn.jsdelivr.net/npm/paymob-pixel@1.2.8/'
const loadSdk = () => new Promise((resolve, reject) => {
  if (window.Pixel) return resolve()
  let script = document.querySelector('script[data-paymob-sdk]')
  const cleanup = () => {
    clearTimeout(timeout)
    script?.removeEventListener('load', ready)
    script?.removeEventListener('error', failed)
  }
  const ready = () => { cleanup(); window.Pixel ? resolve() : failed() }
  const failed = () => { cleanup(); script?.remove(); reject(new Error('SDK unavailable')) }
  const timeout = setTimeout(failed, 15000)
  if (!script) {
    for (const file of ['styles.css', 'main.css']) {
      if (!document.querySelector(`link[href="${sdkBase + file}"]`)) {
        const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = sdkBase + file; document.head.appendChild(link)
      }
    }
    script = document.createElement('script'); script.type = 'module'; script.src = sdkBase + 'main.js'; script.dataset.paymobSdk = 'true'
    script.addEventListener('load', ready, { once: true }); script.addEventListener('error', failed, { once: true })
    document.head.appendChild(script)
  } else {
    script.addEventListener('load', ready, { once: true }); script.addEventListener('error', failed, { once: true })
  }
})
onMounted(async () => {
  try {
    await loadSdk()
    if (disposed) return
    // Paymob owns payment fields. Never inspect, bind, log or forward SDK/card payloads.
    new window.Pixel(paymobPixelOptions({ ...props.session, elementId, locale: locale.value, dark: colorMode.value === 'dark',
      afterPaymentComplete: () => { if (!disposed) emit('complete') },
      onPaymentCancel: () => { if (!disposed) emit('cancel') }
    }))
  } catch { if (!disposed) error.value = true }
  finally { loading.value = false }
})
onBeforeUnmount(() => { disposed = true })
</script>
