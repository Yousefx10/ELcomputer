<template>
  <article class="store-offer-card">
    <img v-if="getStoreImageUrl(imageUrl)" :src="imageUrl" :alt="title || $t('common.storeOffer')" loading="lazy" />
    <div class="store-offer-copy">
      <p v-if="eyebrowText">{{ eyebrowText }}</p>
      <h3>{{ title || $t('common.storeOffer') }}</h3>
      <NuxtLinkLocale v-if="to" :to="to" class="store-button store-button-white">{{ $t('common.viewOffer') }} <Icon name="lucide:arrow-right" size="14" class="directional-icon" /></NuxtLinkLocale>
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
