<template>
  <section v-if="brands.length" class="store-section" aria-labelledby="store-brands-title">
    <div class="store-section-header">
      <div>
        <h2 id="store-brands-title" class="store-section-title">{{ title }}</h2>
        <p v-if="description" class="store-section-description">{{ description }}</p>
      </div>
    </div>
    <div class="store-brand-grid">
      <NuxtLink v-for="brand in brands" :key="brand.id" :to="{ path: '/search', query: { brand: brand.slug } }" class="store-brand-link">
        <img v-if="getStoreImageUrl(brand.logo_url)" :src="brand.logo_url" :alt="brand.name" loading="lazy" />
        <span v-else>{{ brand.name }}</span>
      </NuxtLink>
    </div>
  </section>
</template>

<script setup>
import { getStoreImageUrl } from '~/utils/storefront'
defineProps({ title: String, description: String, brands: { type: Array, default: () => [] } })
</script>
