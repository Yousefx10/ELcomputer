<template>
  <section
    v-if="offerCards.length"
    class="container mx-auto mt-6 px-4"
  >
    <div class="relative">
      <button
        v-if="offerCards.length > 1"
        type="button"
        class="absolute left-0 top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/75 text-2xl text-white shadow-lg md:flex"
        @click="scrollLeft"
      >
        ‹
      </button>

      <div
        ref="slider"
        class="flex gap-4 overflow-x-auto scroll-smooth pb-4 md:px-14"
      >
        <OfferCard
          v-for="offer in offerCards"
          :key="offer.id"
          :eyebrow-text="offer.eyebrow_text"
          :title="offer.title"
          :image-url="offer.image_url"
          :to="getOfferCardLink(offer)"
        />
      </div>

      <button
        v-if="offerCards.length > 1"
        type="button"
        class="absolute right-0 top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/75 text-2xl text-white shadow-lg md:flex"
        @click="scrollRight"
      >
        ›
      </button>
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
    behavior: 'smooth'
  })
}

const scrollRight = () => {
  slider.value?.scrollBy({
    left: 320,
    behavior: 'smooth'
  })
}
</script>
