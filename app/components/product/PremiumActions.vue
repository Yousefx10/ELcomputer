<script setup>
import { canonicalUrl, publicSiteUrl } from '~/utils/seo'
import { shareProduct } from '~/utils/productFinishing'
const props = defineProps({ product: { type: Object, required: true }, mode: { type: String, default: 'both' } })
const { locale } = useI18n(), config = useRuntimeConfig()
const { data: siteContent } = await useSiteContent()
const { saved, busy, ready, feedback, toggle } = props.mode === 'share'
  ? { saved: ref(false), busy: ref(false), ready: ref(false), feedback: ref(''), toggle: () => {} }
  : useProductFavorites(() => props.product.id)
const shareBusy = ref(false), shareFeedback = ref('')
const share = async () => {
  if (shareBusy.value) return
  shareBusy.value = true; shareFeedback.value = ''
  try {
    const url = canonicalUrl(publicSiteUrl(siteContent.value?.settings, config.public.siteUrl), `/products/${props.product.slug}`, locale.value)
    // The catalog has one authored title, also used by the localized page and SEO.
    const result = await shareProduct({ title: props.product.title, url }, navigator)
    shareFeedback.value = result === 'cancelled' ? '' : result === 'copied' ? 'linkCopied' : 'productShared'
  } catch { shareFeedback.value = 'shareFailed' }
  finally { shareBusy.value = false }
}
</script>

<template>
  <div :class="mode === 'both' ? 'pdp-gallery-actions' : `pdp-${mode}-action`">
    <div class="pdp-action-buttons">
      <button v-if="mode !== 'share'" type="button" :aria-pressed="saved" :aria-busy="busy" :data-ready="ready" :disabled="busy" @click="toggle"><Icon name="lucide:heart" size="17" :class="{ 'fill-current': saved }" aria-hidden="true" />{{ $t(saved ? 'productFinishing.saved' : 'productFinishing.favorite') }}</button>
      <button v-if="mode !== 'favorite'" type="button" :disabled="shareBusy" @click="share"><Icon name="lucide:share-2" size="17" aria-hidden="true" />{{ $t('productFinishing.share') }}</button>
    </div>
    <p v-if="feedback" class="pdp-action-feedback" role="status">{{ $t(`productFinishing.${feedback}`) }}</p>
    <p v-if="shareFeedback" class="pdp-action-feedback" role="status">{{ $t(`productFinishing.${shareFeedback}`) }}</p>
  </div>
</template>
