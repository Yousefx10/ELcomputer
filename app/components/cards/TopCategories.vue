<template>
  <section v-if="categories.length" class="store-section" aria-labelledby="store-categories-title">
    <div class="store-section-header">
      <h2 id="store-categories-title" class="store-section-title">{{ $t('common.shopByCategory') }}</h2>
      <NuxtLinkLocale to="/search" class="store-text-link">{{ $t('common.shopAll') }} <Icon name="lucide:arrow-right" size="15" class="directional-icon" /></NuxtLinkLocale>
    </div>
    <div class="store-category-grid">
      <NuxtLinkLocale v-for="category in categories" :key="category.id" :to="{ path: '/search', query: { category: category.slug } }" class="store-category-link">
        <div class="store-category-image">
          <img v-if="getStoreImageUrl(category.displayImageUrl)" :src="publicImage(category.displayImageUrl)" :alt="categoryName(category)" loading="lazy" decoding="async" width="160" height="160" />
          <Icon v-else :name="getStoreCategoryIcon(category.name)" size="48" />
        </div>
        <span>{{ categoryName(category) }}</span>
      </NuxtLinkLocale>
    </div>
  </section>
</template>

<script setup>
import {usePublicImageUrl} from '~/composables/usePublicImageUrl'
const publicImage=usePublicImageUrl()
const { categoryName } = useCategoryLocale()

import { getStoreCategoryIcon, getStoreImageUrl } from '~/utils/storefront'
defineProps({ categories: { type: Array, default: () => [] } })
</script>
