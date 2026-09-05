<template>
  <div v-if="getStoreImageUrl(imageUrl)" class="my-10">
    <component :is="linkUrl ? 'a' : 'div'" :href="linkUrl || undefined" class="block overflow-hidden rounded-xl bg-gray-100">
      <div class="h-[180px] md:h-[220px]">
        <img class="h-full w-full object-cover" :src="imageUrl" :alt="altText" loading="lazy">
      </div>
    </component>
  </div>
</template>

<script setup>
import { getStoreImageUrl } from '~/utils/storefront'
defineProps({
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
</script>
