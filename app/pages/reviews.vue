<template>
  <main class="container mx-auto px-4 py-12">
    <div ref="pageHeading" class="mx-auto max-w-6xl">
      <div class="rounded-3xl bg-white p-6 shadow-sm md:p-9">
        <p class="text-sm font-bold uppercase tracking-[0.22em] text-amber-600">
          Customer feedback
        </p>
        <h1 class="mt-3 text-4xl font-black tracking-tight text-gray-950 md:text-6xl">
          All Reviews
        </h1>
        <p class="mt-3 max-w-2xl text-gray-600">
          Read feedback shared by signed-in customers about products from our store.
        </p>
      </div>

      <section class="mt-8 rounded-3xl bg-white p-4 shadow-sm md:p-6" aria-labelledby="reviews-list-title">
        <div class="mb-5 flex flex-wrap items-end justify-between gap-3 px-1">
          <div>
            <h2 id="reviews-list-title" class="text-2xl font-black text-gray-950">
              Customer reviews
            </h2>
            <p class="mt-1 text-sm text-gray-500">
              {{ totalReviews }} {{ totalReviews === 1 ? 'review' : 'reviews' }}
            </p>
          </div>

          <p v-if="totalReviews" class="text-sm font-semibold text-gray-500">
            Page {{ currentPage }} of {{ totalPages }}
          </p>
        </div>

        <div
          v-if="status === 'pending'"
          class="rounded-2xl border border-dashed border-gray-300 p-12 text-center text-gray-500"
          aria-live="polite"
        >
          Loading reviews...
        </div>

        <div
          v-else-if="loadError"
          class="rounded-2xl border border-red-200 bg-red-50 p-8 text-center"
          role="alert"
        >
          <p class="text-red-600">{{ loadError }}</p>
          <button
            type="button"
            class="mt-4 rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
            @click="refresh"
          >
            Try Again
          </button>
        </div>

        <div
          v-else-if="!reviews.length"
          class="rounded-2xl border border-dashed border-gray-300 p-12 text-center"
        >
          <h2 class="text-2xl font-bold text-gray-900">No reviews yet</h2>
          <p class="mt-2 text-gray-500">
            Customer reviews will appear here after they are submitted.
          </p>
        </div>

        <div
          v-else
          ref="reviewsScroller"
          class="reviews-scrollbar max-h-[70vh] overflow-y-auto overscroll-contain pr-2"
        >
          <div class="grid gap-5 lg:grid-cols-2">
            <ReviewsCard
              v-for="review in reviews"
              :key="review.id"
              :review="review"
            />
          </div>
        </div>

        <nav
          v-if="totalPages > 1"
          class="mt-6 flex flex-wrap items-center justify-center gap-2 border-t border-gray-100 pt-5"
          aria-label="All reviews pages"
        >
          <button
            type="button"
            :disabled="currentPage <= 1 || status === 'pending'"
            class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
            @click="goToPage(currentPage - 1)"
          >
            Previous
          </button>

          <button
            v-for="pageNumber in visiblePageNumbers"
            :key="pageNumber"
            type="button"
            :aria-current="pageNumber === currentPage ? 'page' : undefined"
            :disabled="status === 'pending'"
            class="min-w-10 rounded-lg border px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            :class="pageNumber === currentPage
              ? 'border-black bg-black text-white'
              : 'border-gray-300 text-gray-700 hover:bg-gray-100'"
            @click="goToPage(pageNumber)"
          >
            {{ pageNumber }}
          </button>

          <button
            type="button"
            :disabled="currentPage >= totalPages || status === 'pending'"
            class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
            @click="goToPage(currentPage + 1)"
          >
            Next
          </button>
        </nav>
      </section>
    </div>
  </main>
</template>

<script setup>
const route = useRoute()
const router = useRouter()
const { data: siteContent } = await useSiteContent()
const reviewsScroller = ref(null)
const pageHeading = ref(null)
const shouldResetResultsPosition = ref(false)
const pageSize = 12

const requestedPage = computed(() => {
  const queryValue = Array.isArray(route.query.page)
    ? route.query.page[0]
    : route.query.page

  const parsedPage = Number(queryValue)

  return Number.isSafeInteger(parsedPage) && parsedPage > 0
    ? Math.min(100000, parsedPage)
    : 1
})

const {
  data: reviewsResponse,
  status,
  error,
  refresh
} = await useAsyncData(
  'public-reviews-page',
  () => $fetch('/api/reviews', {
    query: {
      page: requestedPage.value,
      pageSize
    }
  }),
  {
    watch: [requestedPage]
  }
)

const reviews = computed(() => reviewsResponse.value?.items || [])
const totalReviews = computed(() => Math.max(0, Number(reviewsResponse.value?.total || 0)))
const currentPage = computed(() => Math.max(1, Number(reviewsResponse.value?.page || requestedPage.value)))
const totalPages = computed(() => {
  return Math.max(1, Math.ceil(totalReviews.value / pageSize))
})
const visiblePageNumbers = computed(() => {
  const maximumVisiblePages = 5
  let firstPage = Math.max(1, currentPage.value - Math.floor(maximumVisiblePages / 2))
  const lastPage = Math.min(totalPages.value, firstPage + maximumVisiblePages - 1)

  firstPage = Math.max(1, lastPage - maximumVisiblePages + 1)

  return Array.from(
    { length: lastPage - firstPage + 1 },
    (_, index) => firstPage + index
  )
})
const loadError = computed(() => {
  return error.value?.data?.statusMessage
    || error.value?.statusMessage
    || error.value?.message
    || ''
})

const goToPage = async (page) => {
  const nextPage = Number(page)

  if (
    !Number.isInteger(nextPage)
    || nextPage < 1
    || nextPage > totalPages.value
    || nextPage === currentPage.value
    || status.value === 'pending'
  ) {
    return
  }

  shouldResetResultsPosition.value = true

  await router.push({
    path: '/reviews',
    query: nextPage === 1 ? {} : { page: String(nextPage) }
  })
}

watch(reviewsResponse, async () => {
  if (!shouldResetResultsPosition.value || !import.meta.client) {
    return
  }

  await nextTick()
  reviewsScroller.value?.scrollTo({
    top: 0,
    behavior: 'smooth'
  })
  pageHeading.value?.scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  })
  shouldResetResultsPosition.value = false
})

watch(
  [requestedPage, totalPages, status],
  async ([requested, availablePages, currentStatus]) => {
    if (!import.meta.client) {
      return
    }

    if (
      currentStatus !== 'success'
      || requested <= availablePages
      || !totalReviews.value
    ) {
      return
    }

    await router.replace({
      path: '/reviews',
      query: availablePages === 1 ? {} : { page: String(availablePages) }
    })
  },
  {
    immediate: true
  }
)

useHead(() => ({
  title: `Customer Reviews - ${siteContent.value?.settings?.site_name || 'ELcomputer'}`
}))
</script>

<style scoped>
.reviews-scrollbar {
  scrollbar-gutter: stable;
  scrollbar-color: #9ca3af #f3f4f6;
  scrollbar-width: thin;
}

.reviews-scrollbar::-webkit-scrollbar {
  width: 10px;
}

.reviews-scrollbar::-webkit-scrollbar-track {
  border-radius: 999px;
  background: #f3f4f6;
}

.reviews-scrollbar::-webkit-scrollbar-thumb {
  border: 2px solid #f3f4f6;
  border-radius: 999px;
  background: #9ca3af;
}
</style>
