<template>
  <section v-if="categories.length" class="store-section" aria-labelledby="store-categories-title">
    <div class="store-section-header">
      <h2 id="store-categories-title" class="store-section-title">Shop by category</h2>
      <NuxtLink to="/search" class="store-text-link">Shop all <Icon name="lucide:arrow-right" size="15" /></NuxtLink>
    </div>
    <div class="store-category-grid">
      <NuxtLink v-for="category in categories" :key="category.id" :to="{ path: '/search', query: { category: category.slug } }" class="store-category-link">
        <div class="store-category-image">
          <img v-if="getStoreImageUrl(category.displayImageUrl)" :src="category.displayImageUrl" :alt="category.name" loading="lazy" />
          <Icon v-else :name="getStoreCategoryIcon(category.name)" size="48" />
        </div>
        <span>{{ category.name }}</span>
      </NuxtLink>
    </div>
  </section>
</template>

<script setup>
import { getStoreCategoryIcon, getStoreImageUrl } from '~/utils/storefront'
defineProps({ categories: { type: Array, default: () => [] } })
</script>
