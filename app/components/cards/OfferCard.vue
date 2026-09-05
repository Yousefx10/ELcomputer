<template>
  <article class="store-offer-card">
    <img v-if="getStoreImageUrl(imageUrl)" :src="imageUrl" :alt="title || 'Store offer'" loading="lazy" />
    <div class="store-offer-copy">
      <p v-if="eyebrowText">{{ eyebrowText }}</p>
      <h3>{{ title || 'Explore the store' }}</h3>
      <NuxtLink v-if="to" :to="to" class="store-button store-button-white">View offer <Icon name="lucide:arrow-right" size="14" /></NuxtLink>
    </div>
  </article>
</template>

<script setup>
import { getStoreImageUrl } from '~/utils/storefront'
defineProps({
  eyebrowText: { type: String, default: '' },
  title: { type: String, default: '' },
  imageUrl: { type: String, default: '' },
  to: { type: [String, Object], default: null }
})
</script>
