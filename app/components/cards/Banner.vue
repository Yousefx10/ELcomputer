<template>
  <div v-if="resolvedImageUrl" class="store-banner-ad">
    <component :is="bannerComponent" v-bind="bannerAttributes" class="store-banner-ad-link">
      <div class="store-banner-ad-media">
        <img :src="resolvedImageUrl" :alt="altText" loading="lazy">
      </div>
    </component>
  </div>
</template>

<script setup>
import { getConfiguredStoreImageUrl, getStoreLinkUrl, isExternalStoreLink } from '~/utils/storefront'

const props = defineProps({
  imageUrl: {
    type: String,
    default: ''
  },
  linkUrl: {
    type: String,
    default: ''
  },
  altText: {
    type: String,
    default: 'Banner Ad'
  }
})

const nuxtLink = resolveComponent('NuxtLink')
const resolvedImageUrl = computed(() => getConfiguredStoreImageUrl(props.imageUrl))
const resolvedLinkUrl = computed(() => getStoreLinkUrl(props.linkUrl))
const externalLink = computed(() => isExternalStoreLink(resolvedLinkUrl.value))
const bannerComponent = computed(() => {
  if (!resolvedLinkUrl.value) return 'div'
  return externalLink.value ? 'a' : nuxtLink
})
const bannerAttributes = computed(() => {
  if (!resolvedLinkUrl.value) return {}
  if (externalLink.value) {
    return { href: resolvedLinkUrl.value, target: '_blank', rel: 'noopener noreferrer' }
  }
  return { to: resolvedLinkUrl.value }
})
</script>
