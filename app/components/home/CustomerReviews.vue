<template>
  <section ref="sectionRoot" class="my-14" aria-labelledby="customer-reviews-title">
    <div class="mb-7 flex flex-col gap-4 px-4 md:flex-row md:items-end md:justify-between md:px-10">
      <div>
        <h2
          id="customer-reviews-title"
          class="text-4xl font-black uppercase tracking-tight md:text-6xl"
        >
          Customer Reviews
        </h2>
        <p class="mt-2 text-base text-gray-700 md:text-lg">
          What customers are saying about products from our store.
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <button
          v-if="reviews.length"
          type="button"
          :aria-pressed="carouselPaused"
          class="review-motion-toggle inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
          @click="carouselPaused = !carouselPaused"
        >
          <Icon :name="carouselPaused ? 'lucide:play' : 'lucide:pause'" size="16" />
          {{ carouselPaused ? 'Play' : 'Pause' }}
        </button>

        <NuxtLink
          v-if="showViewAll && reviews.length"
          to="/reviews"
          class="inline-flex items-center gap-2 rounded-xl bg-black px-5 py-3 text-sm font-bold text-white hover:bg-gray-800 hover:text-white"
        >
          View all reviews
          <Icon name="lucide:arrow-right" size="17" />
        </NuxtLink>
      </div>
    </div>

    <div
      v-if="loading"
      class="flex gap-5 overflow-hidden px-4 md:px-10"
      aria-live="polite"
      aria-label="Loading customer reviews"
    >
      <div
        v-for="placeholder in 3"
        :key="placeholder"
        class="h-72 w-[calc(100vw-2rem)] max-w-[340px] shrink-0 animate-pulse rounded-2xl border border-gray-200 bg-white/70"
      />
    </div>

    <div v-else-if="loadError" class="mx-4 rounded-2xl border border-red-200 bg-red-50 p-6 text-center md:mx-10">
      <p class="text-sm text-red-600">{{ loadError }}</p>
      <button
        type="button"
        class="mt-4 rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
        @click="loadReviews"
      >
        Try Again
      </button>
    </div>

    <p v-else-if="!reviews.length" class="px-4 text-gray-500 md:px-10">
      No customer reviews are available yet.
    </p>

    <div
      v-else
      class="review-carousel overflow-hidden"
      @mouseenter="hoverPaused = true"
      @mouseleave="hoverPaused = false"
      @focusin="focusPaused = true"
      @focusout="focusPaused = false"
    >
      <div
        class="review-track flex w-max"
        :class="{ 'review-track-paused': carouselPaused || hoverPaused || focusPaused }"
      >
        <div class="review-group flex shrink-0 gap-5 pr-5">
          <ReviewsCard
            v-for="review in carouselReviews"
            :key="`primary-${review.carouselKey}`"
            :review="review"
            compact
            :interactive="!review.isRepeat"
            :aria-hidden="review.isRepeat ? 'true' : undefined"
            :inert="review.isRepeat"
            class="w-[calc(100vw-2rem)] max-w-[340px] shrink-0"
          />
        </div>

        <div class="review-group flex shrink-0 gap-5 pr-5" aria-hidden="true" inert>
          <ReviewsCard
            v-for="review in carouselReviews"
            :key="`duplicate-${review.carouselKey}`"
            :review="review"
            compact
            :interactive="false"
            class="w-[calc(100vw-2rem)] max-w-[340px] shrink-0"
          />
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
defineProps({
  showViewAll: {
    type: Boolean,
    default: true
  }
})

const sectionRoot = ref(null)
const reviews = ref([])
const loading = ref(true)
const reviewsRequestPending = ref(false)
const reviewsLoaded = ref(false)
const loadError = ref('')
const carouselPaused = ref(false)
const hoverPaused = ref(false)
const focusPaused = ref(false)
const carouselReviews = computed(() => {
  if (!reviews.value.length) {
    return []
  }

  const minimumCardsPerGroup = 6
  const copies = Math.max(1, Math.ceil(minimumCardsPerGroup / reviews.value.length))

  return Array.from({ length: copies }, (_, copyIndex) => {
    return reviews.value.map((review) => ({
      ...review,
      carouselKey: `${review.id}-${copyIndex}`,
      isRepeat: copyIndex > 0
    }))
  }).flat()
})

let reviewsObserver

const normalizeReview = (review = {}) => ({
  id: String(review.id || ''),
  rating: Math.min(5, Math.max(1, Number(review.rating) || 1)),
  reviewText: String(review.reviewText ?? ''),
  reviewerName: String(review.reviewerName || 'Customer'),
  createdAt: String(review.createdAt || ''),
  productTitle: String(review.productTitle || ''),
  productSlug: String(review.productSlug || '')
})

const loadReviews = async () => {
  if (reviewsLoaded.value || reviewsRequestPending.value) {
    return
  }

  reviewsRequestPending.value = true
  loading.value = true
  loadError.value = ''

  try {
    const response = await $fetch('/api/reviews', {
      query: {
        page: 1,
        pageSize: 12
      }
    })

    reviews.value = (response.items || []).map(normalizeReview)
    reviewsLoaded.value = true
  } catch (error) {
    loadError.value = error?.data?.statusMessage || error?.message || 'Could not load customer reviews.'
  } finally {
    reviewsRequestPending.value = false
    loading.value = false
  }
}

onMounted(() => {
  loading.value = true

  if (!('IntersectionObserver' in window)) {
    loadReviews()
    return
  }

  reviewsObserver = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) {
      return
    }

    reviewsObserver?.disconnect()
    loadReviews()
  }, {
    rootMargin: '300px 0px'
  })

  if (sectionRoot.value) {
    reviewsObserver.observe(sectionRoot.value)
  } else {
    loadReviews()
  }
})

onUnmounted(() => {
  reviewsObserver?.disconnect()
})
</script>

<style scoped>
@keyframes review-scroll {
  from {
    transform: translateX(0);
  }

  to {
    transform: translateX(-50%);
  }
}

.review-track {
  animation: review-scroll 45s linear infinite;
}

.review-track-paused {
  animation-play-state: paused;
}

@media (prefers-reduced-motion: reduce) {
  .review-carousel {
    overflow-x: auto;
    scroll-snap-type: x mandatory;
  }

  .review-track {
    animation: none;
    transform: none;
  }

  .review-group > * {
    scroll-snap-align: start;
  }

  .review-group[aria-hidden='true'] {
    display: none;
  }

  .review-motion-toggle {
    display: none;
  }
}
</style>
