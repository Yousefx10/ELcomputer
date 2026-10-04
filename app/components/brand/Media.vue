<script setup>
import { brandVideo } from '~/utils/brandPage'
const props = defineProps({ item: { type: Object, required: true }, brandName: { type: String, default: '' } })
const video = computed(() => props.item.type === 'video' ? brandVideo(props.item.url) : null)
const embedLoaded = ref(false)
watch(() => props.item.url, () => { embedLoaded.value = false })
</script>

<template>
  <figure class="brand-media">
    <a v-if="item.type === 'image' && item.link.startsWith('#')" :href="item.link" class="brand-media-visual">
      <img :src="item.url" :alt="item.alt || brandName" width="1600" height="900" loading="lazy" decoding="async">
    </a>
    <NuxtLinkLocale v-else-if="item.type === 'image' && item.link" :to="item.link" class="brand-media-visual">
      <img :src="item.url" :alt="item.alt || brandName" width="1600" height="900" loading="lazy" decoding="async">
    </NuxtLinkLocale>
    <div v-else class="brand-media-visual">
      <img v-if="item.type === 'image'" :src="item.url" :alt="item.alt || brandName" width="1600" height="900" loading="lazy" decoding="async">
      <video v-else-if="video?.type === 'file'" :src="video.url" :poster="item.poster || undefined" controls playsinline preload="none" :aria-label="item.alt || item.caption || brandName" />
      <button v-else-if="video?.type === 'embed' && item.poster && !embedLoaded" type="button" class="brand-video-poster" :aria-label="`${$t('brandPages.watchVideo')}: ${item.alt || item.caption || brandName}`" @click="embedLoaded = true">
        <img :src="item.poster" alt="" width="1600" height="900" loading="lazy" decoding="async">
        <span>{{ $t('brandPages.watchVideo') }}</span>
      </button>
      <iframe v-else-if="video?.type === 'embed'" :src="video.url" :title="item.alt || item.caption || `${brandName} — ${video.provider}`" loading="lazy" allow="fullscreen; picture-in-picture; encrypted-media" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" />
    </div>
    <figcaption v-if="item.caption" dir="auto">{{ item.caption }}</figcaption>
  </figure>
</template>

<style scoped>
.brand-media { min-width:0; margin:0; }
.brand-media-visual { display:block; overflow:hidden; aspect-ratio:16/9; background:var(--surface-muted); }
.brand-media-visual :is(img,video,iframe) { display:block; width:100%; height:100%; border:0; object-fit:cover; }
.brand-media-visual video { object-fit:contain; background:#101820; }
.brand-video-poster { position:relative; display:block; width:100%; height:100%; border:0; cursor:pointer; }
.brand-video-poster span { position:absolute; inset:0; margin:auto; width:max-content; height:fit-content; padding:14px 24px; color:#fff; background:#101820; font-weight:700; white-space:nowrap; }
figcaption { padding-block:1rem; font-size:.9rem; line-height:1.65; color:var(--text-secondary); }
:is(a,button):focus-visible { outline:3px solid var(--brand); outline-offset:4px; }
</style>
