<template>
  <section v-if="offerCards.length" class="store-section" aria-labelledby="store-offers-title">
    <div class="store-section-header">
      <h2 id="store-offers-title" class="store-section-title">Discover more</h2>
      <div v-if="offerCards.length > 3" class="store-product-actions">
        <button type="button" class="store-round-button" aria-label="Previous offers" @click="scrollLeft"><Icon name="lucide:chevron-left" size="17" /></button>
        <button type="button" class="store-round-button" aria-label="More offers" @click="scrollRight"><Icon name="lucide:chevron-right" size="17" /></button>
      </div>
    </div>
    <div ref="slider" class="store-offer-rail no-scrollbar">
      <OfferCard v-for="offer in offerCards" :key="offer.id" :eyebrow-text="offer.eyebrow_text" :title="offer.title" :image-url="offer.image_url" :to="getOfferCardLink(offer)" />
    </div>
  </section>
</template>

<script setup>
import OfferCard from '../cards/OfferCard.vue'

const { data: siteContent } = await useSiteContent()

const slider = ref(null)
const offerCards = computed(() => siteContent.value?.offerCards || [])

const getOfferCardLink = (offer) => {
  if (offer?.target_type === 'product') {
    return offer.product_slug
      ? `/products/${offer.product_slug}`
      : null
  }

  if (offer?.target_type === 'search') {
    return {
      path: '/search',
      query: offer.search_query
        ? { q: offer.search_query }
        : {}
    }
  }

  return null
}

const scrollLeft = () => {
  slider.value?.scrollBy({
    left: -320,
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
  })
}

const scrollRight = () => {
  slider.value?.scrollBy({
    left: 320,
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
  })
}
</script>
