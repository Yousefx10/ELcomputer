<script setup>
const props = defineProps({ items: { type: Array, default: () => [] }, modelValue: { type: String, default: '' }, title: { type: String, default: '' } })
const emit = defineEmits(['update:modelValue', 'image-error'])
const { locale } = useI18n()
const rtl = computed(() => locale.value === 'ar')
const failed = ref([]), loading = ref(true), expanded = ref(false), zoomed = ref(false), dialog = ref(null), closeButton = ref(null)
const thumbnails = ref([])
const media = computed(() => props.items.filter(item => !failed.value.includes(item.url)))
const index = computed(() => Math.max(0, media.value.findIndex(item => item.url === props.modelValue)))
const active = computed(() => media.value[index.value] || null)
let priorFocus, priorOverflow = '', gesture = null, lastSwipe = 0

const select = item => { if (item) emit('update:modelValue', item.url) }
const step = direction => { if (media.value.length > 1) select(media.value[(index.value + direction + media.value.length) % media.value.length]) }
const mediaError = item => {
  if (!failed.value.includes(item.url)) failed.value = [...failed.value, item.url]
  if (item.type !== 'video') emit('image-error', item.url)
  if (!media.value.length) close()
}
const close = () => {
  if (!expanded.value) return
  dialog.value?.close()
  expanded.value = false; zoomed.value = false
  if (import.meta.client) document.body.style.overflow = priorOverflow
  nextTick(() => { if (priorFocus?.isConnected) priorFocus.focus() })
}
const open = async event => {
  if (event?.detail && Date.now() - lastSwipe < 400) return
  if (!active.value || !import.meta.client) return
  priorFocus = document.activeElement; priorOverflow = document.body.style.overflow
  expanded.value = true
  await nextTick()
  dialog.value.showModal(); document.body.style.overflow = 'hidden'; closeButton.value?.focus()
}
const keydown = event => {
  if (event.target.closest('video,input,textarea')) return
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault(); step((event.key === 'ArrowRight' ? 1 : -1) * (rtl.value ? -1 : 1))
  }
  if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); select(media.value[event.key === 'Home' ? 0 : media.value.length - 1]) }
  if (expanded.value && active.value?.type !== 'video' && ['+', '=', '-', '0'].includes(event.key)) { event.preventDefault(); zoomed.value = !['-', '0'].includes(event.key) }
}
const thumbnailKeydown = async event => {
  keydown(event)
  if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { await nextTick(); thumbnails.value[index.value]?.focus() }
}
const pointerDown = event => {
  if (event.isPrimary && event.pointerType !== 'mouse' && !zoomed.value && active.value?.type !== 'video') gesture = { x: event.clientX, y: event.clientY }
}
const pointerUp = event => {
  if (!gesture) return
  const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y; gesture = null
  if (Math.abs(dx) >= 45 && Math.abs(dx) > Math.abs(dy) * 1.5) { lastSwipe = Date.now(); step((dx < 0 ? 1 : -1) * (rtl.value ? -1 : 1)) }
}
watch(() => active.value?.url, () => { loading.value = true; zoomed.value = false })
watch(() => props.items, () => { if (!active.value) close() })
onBeforeUnmount(close)
</script>

<template>
  <section class="pdp-gallery" :aria-label="$t('productPage.gallery')">
    <div class="pdp-gallery-stage" :aria-busy="!!active && loading" @keydown="keydown" @pointerdown="pointerDown" @pointerup="pointerUp" @pointercancel="gesture = null">
      <template v-if="active">
        <video v-if="active.type === 'video'" :key="active.url" :src="active.url" controls playsinline preload="metadata" :aria-label="active.alt || $t('productPage.video')" @loadedmetadata="loading = false" @error="mediaError(active)" />
        <button v-if="active.type === 'video'" type="button" class="pdp-gallery-expand" :aria-label="$t('productPage.openGallery')" aria-haspopup="dialog" @click="open"><Icon name="lucide:expand" size="18" aria-hidden="true" /></button>
        <button v-else class="pdp-gallery-open" type="button" :aria-label="$t('productPage.openGallery')" aria-haspopup="dialog" @click="open">
          <img :key="active.url" :src="active.url" :alt="active.alt || title" width="900" height="900" loading="eager" fetchpriority="high" decoding="async" @load="loading = false" @error="mediaError(active)">
          <span class="pdp-gallery-expand" aria-hidden="true"><Icon name="lucide:expand" size="18" /></span>
        </button>
        <span v-if="loading" class="pdp-gallery-loading" role="status"><span class="sr-only">{{ $t('productPage.loadingImage') }}</span></span>
        <div v-if="media.length > 1" class="pdp-gallery-controls">
          <button type="button" :aria-label="$t('productPage.previousMedia')" @click="step(-1)"><Icon name="lucide:chevron-left" class="directional-icon" size="18" /></button>
          <span aria-live="polite"><bdi dir="ltr">{{ index + 1 }} <span aria-hidden="true">/</span> {{ media.length }}</bdi></span>
          <button type="button" :aria-label="$t('productPage.nextMedia')" @click="step(1)"><Icon name="lucide:chevron-right" class="directional-icon" size="18" /></button>
        </div>
      </template>
      <div v-else class="pdp-gallery-empty"><Icon name="lucide:image-off" size="40" aria-hidden="true" /><p>{{ $t('productPage.noMedia') }}</p></div>
    </div>
    <div v-if="media.length > 1" class="pdp-thumbnails" :aria-label="$t('common.galleryThumbnails')" @keydown="thumbnailKeydown">
      <button v-for="(item, position) in media" :key="item.url" :ref="el => { thumbnails[position] = el }" type="button" :tabindex="position === index ? 0 : -1" :aria-current="position === index ? 'true' : undefined" :aria-label="$t('productPage.mediaNumber', { number: position + 1, total: media.length })" @click="select(item)">
        <Icon v-if="item.type === 'video'" name="lucide:play" size="23" aria-hidden="true" />
        <img v-else :src="item.url" :alt="''" width="64" height="64" loading="lazy" decoding="async" @error="mediaError(item)">
      </button>
    </div>
    <Teleport to="body">
      <dialog v-if="expanded" ref="dialog" class="pdp-media-dialog" :aria-label="$t('productPage.gallery')" aria-describedby="pdp-gallery-help" @cancel.prevent="close" @click.self="close" @keydown="keydown">
        <div class="pdp-dialog-inner">
          <div class="pdp-dialog-toolbar"><span>{{ title }}</span><div><button v-if="active?.type !== 'video'" type="button" :aria-label="$t(zoomed ? 'productPage.zoomOut' : 'productPage.zoomIn')" :aria-pressed="zoomed" @click="zoomed = !zoomed"><Icon :name="zoomed ? 'lucide:zoom-out' : 'lucide:zoom-in'" size="21" /></button><button ref="closeButton" type="button" :aria-label="$t('productPage.closeGallery')" @click="close"><Icon name="lucide:x" size="23" /></button></div></div>
          <div v-if="active" class="pdp-dialog-stage" :data-zoomed="zoomed" @pointerdown="pointerDown" @pointerup="pointerUp" @pointercancel="gesture = null">
            <video v-if="active.type === 'video'" :key="active.url" :src="active.url" controls playsinline preload="metadata" :aria-label="active.alt || $t('productPage.video')" @error="mediaError(active)" />
            <button v-else type="button" :aria-label="$t(zoomed ? 'productPage.zoomOut' : 'productPage.zoomIn')" @click="zoomed = !zoomed"><img :src="active.url" :alt="active.alt || title" @error="mediaError(active)"></button>
          </div>
          <div class="pdp-dialog-navigation"><button type="button" :disabled="media.length < 2" :aria-label="$t('productPage.previousMedia')" @click="step(-1)"><Icon name="lucide:chevron-left" class="directional-icon" size="22" /></button><p aria-live="polite">{{ $t('productPage.mediaNumber', { number: index + 1, total: media.length }) }}</p><button type="button" :disabled="media.length < 2" :aria-label="$t('productPage.nextMedia')" @click="step(1)"><Icon name="lucide:chevron-right" class="directional-icon" size="22" /></button></div>
          <p id="pdp-gallery-help" class="pdp-dialog-help">{{ $t('productPage.galleryHelp') }}</p>
        </div>
      </dialog>
    </Teleport>
  </section>
</template>
