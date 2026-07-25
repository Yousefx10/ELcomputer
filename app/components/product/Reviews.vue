<template>
  <section class="mt-8 overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
    <button
      type="button"
      class="flex w-full items-center justify-between gap-4 p-6 text-left"
      :aria-expanded="reviewsOpen"
      aria-controls="product-reviews-panel"
      @click="toggleReviews"
    >
      <div>
        <div class="flex flex-wrap items-center gap-3">
          <h2 class="text-2xl font-bold text-gray-900">Reviews</h2>
          <span
            v-if="reviewsLoaded"
            class="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-600"
          >
            {{ totalReviews }} {{ totalReviews === 1 ? 'review' : 'reviews' }}
          </span>
        </div>

        <p class="mt-1 text-sm text-gray-500">
          {{ reviewsOpen ? 'Hide customer feedback' : 'Read reviews or write your own' }}
        </p>
      </div>

      <Icon
        name="lucide:chevron-down"
        size="24"
        class="shrink-0 transition-transform"
        :class="reviewsOpen ? 'rotate-180' : ''"
      />
    </button>

    <div
      v-if="reviewsOpen"
      id="product-reviews-panel"
      class="border-t border-gray-200 p-6"
    >
      <div
        v-if="reviewsLoading && !reviewsLoaded"
        class="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-gray-500"
        aria-live="polite"
      >
        Loading reviews...
      </div>

      <div
        v-else-if="loadError && !reviewsLoaded"
        class="rounded-xl border border-red-200 bg-red-50 p-6 text-center"
        role="alert"
      >
        <p class="text-red-600">{{ loadError }}</p>
        <button
          type="button"
          class="mt-4 rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
          @click="loadReviews({ page: 1 })"
        >
          Try Again
        </button>
      </div>

      <div v-else class="grid gap-10 lg:grid-cols-2">
        <div ref="reviewsList">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 class="text-2xl font-bold text-gray-900">Current reviews</h3>
              <p v-if="totalReviews" class="mt-2 text-sm text-gray-500">
                {{ formattedAverageRating }} out of 5 from
                {{ totalReviews }} {{ totalReviews === 1 ? 'review' : 'reviews' }}
              </p>
            </div>

            <div
              v-if="totalReviews"
              class="flex items-center gap-1"
              :aria-label="`${formattedAverageRating} out of 5 stars`"
            >
              <Icon
                v-for="star in starOptions"
                :key="star"
                name="lucide:star"
                size="18"
                :class="star <= Math.round(averageRating)
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-gray-300'"
              />
            </div>
          </div>

          <div
            v-if="!reviews.length"
            class="mt-6 rounded-xl border border-dashed border-gray-300 bg-white p-6 text-gray-500"
          >
            There are no reviews yet.
          </div>

          <div v-else class="mt-6 space-y-4">
            <article
              v-for="review in reviews"
              :key="review.id"
              class="rounded-xl border border-gray-200 bg-white p-5"
            >
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p class="font-bold text-gray-900">{{ review.reviewerName }}</p>
                  <p class="mt-1 text-xs text-gray-400">
                    {{ formatReviewDate(review.createdAt) }}
                  </p>
                </div>

                <div
                  class="flex items-center gap-0.5"
                  :aria-label="`${review.rating} out of 5 stars`"
                >
                  <Icon
                    v-for="star in starOptions"
                    :key="star"
                    name="lucide:star"
                    size="17"
                    :class="star <= review.rating
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-gray-300'"
                  />
                </div>
              </div>

              <p
                dir="auto"
                class="mt-4 whitespace-pre-wrap break-words text-start leading-7 text-gray-700"
              >
                {{ review.reviewText }}
              </p>
            </article>

            <nav
              v-if="totalPages > 1"
              class="flex flex-wrap items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white p-3"
              aria-label="Review pages"
            >
              <button
                type="button"
                :disabled="currentPage <= 1 || reviewsLoading"
                class="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                @click="goToReviewPage(currentPage - 1)"
              >
                Previous
              </button>

              <button
                v-for="pageNumber in visiblePageNumbers"
                :key="pageNumber"
                type="button"
                :aria-current="pageNumber === currentPage ? 'page' : undefined"
                :disabled="reviewsLoading"
                class="min-w-10 rounded-lg border px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                :class="pageNumber === currentPage
                  ? 'border-black bg-black text-white'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-100'"
                @click="goToReviewPage(pageNumber)"
              >
                {{ pageNumber }}
              </button>

              <button
                type="button"
                :disabled="currentPage >= totalPages || reviewsLoading"
                class="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                @click="goToReviewPage(currentPage + 1)"
              >
                Next
              </button>
            </nav>
          </div>

          <p
            v-if="loadError && reviewsLoaded"
            class="mt-4 text-sm text-red-600"
            role="alert"
          >
            {{ loadError }}
          </p>
        </div>

        <div>
          <h3 class="text-2xl font-bold leading-tight text-gray-900 md:text-3xl">
            {{ reviewFormHeading }}
          </h3>

          <div
            v-if="!user"
            class="mt-6 rounded-xl border border-blue-100 bg-blue-50 p-6"
          >
            <p class="font-semibold text-gray-900">
              Please log in to write a review on this product.
            </p>
            <p class="mt-2 text-sm text-gray-600">
              Sign in with your customer account to continue.
            </p>
            <NuxtLink
              :to="loginDestination"
              class="mt-5 inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700"
            >
              Login to Review
            </NuxtLink>
          </div>

          <div
            v-else-if="hasReviewed"
            class="mt-6 rounded-xl border border-green-200 bg-green-50 p-6 text-green-800"
          >
            <div class="flex items-start gap-3">
              <Icon name="lucide:circle-check" size="22" class="mt-0.5 shrink-0" />
              <div>
                <p class="font-bold">Thank you for your feedback.</p>
                <p class="mt-1 text-sm">
                  You have already reviewed this product.
                </p>
              </div>
            </div>
          </div>

          <form v-else class="mt-6 space-y-6" @submit.prevent="submitReview">
            <fieldset>
              <legend class="text-base font-bold text-gray-900">Your rating *</legend>

              <div
                class="mt-3 flex w-fit items-center gap-1"
                dir="ltr"
                role="radiogroup"
                aria-label="Your rating"
                @mouseleave="hoveredRating = 0"
              >
                <button
                  v-for="star in starOptions"
                  :key="star"
                  type="button"
                  role="radio"
                  :aria-checked="selectedRating === star"
                  :aria-label="`${star} ${star === 1 ? 'star' : 'stars'}`"
                  class="rounded p-1 text-gray-300 transition hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  :class="star <= (hoveredRating || selectedRating)
                    ? 'text-amber-400'
                    : 'text-gray-300'"
                  @mouseenter="hoveredRating = star"
                  @focus="hoveredRating = star"
                  @blur="hoveredRating = 0"
                  @click="selectedRating = star"
                >
                  <Icon
                    name="lucide:star"
                    size="30"
                    :class="star <= (hoveredRating || selectedRating)
                      ? 'fill-amber-400 text-amber-400'
                      : 'fill-transparent text-gray-300'"
                  />
                </button>
              </div>

              <p v-if="selectedRating" class="mt-2 text-sm text-gray-500">
                {{ selectedRating }} out of 5 stars
              </p>
            </fieldset>

            <div>
              <div class="mb-2 flex items-center justify-between gap-3">
                <label for="product-review-text" class="font-bold text-gray-900">
                  Your review *
                </label>
                <span
                  class="text-xs"
                  :class="reviewCharacterCount >= maximumReviewLength
                    ? 'font-semibold text-red-600'
                    : 'text-gray-400'"
                >
                  {{ reviewCharacterCount }} / {{ maximumReviewLength }}
                </span>
              </div>

              <textarea
                id="product-review-text"
                v-model="reviewText"
                :maxlength="maximumReviewLength"
                rows="9"
                dir="auto"
                placeholder="Share your experience with this product..."
                class="w-full resize-y rounded-xl border border-gray-300 bg-white p-4 text-start leading-7 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
              <p class="mt-2 text-xs text-gray-500">
                Arabic and English text are supported. Maximum 999 characters.
              </p>
            </div>

            <label class="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 bg-white p-4">
              <input
                v-model="displayFullName"
                type="checkbox"
                class="mt-1 h-4 w-4 rounded border-gray-300"
              >
              <span>
                <span class="block font-semibold text-gray-900">Display my full name</span>
                <span class="mt-1 block text-sm text-gray-500">
                  If unchecked, only the first letter of your name will be shown.
                </span>
              </span>
            </label>

            <p v-if="submitError" class="text-sm text-red-600" role="alert">
              {{ submitError }}
            </p>

            <p v-if="submitSuccess" class="text-sm text-green-700" role="status">
              {{ submitSuccess }}
            </p>

            <button
              type="submit"
              :disabled="submitting"
              class="rounded-xl bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {{ submitting ? 'Submitting...' : 'Submit Review' }}
            </button>
          </form>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
const props = defineProps({
  productId: {
    type: String,
    required: true
  },
  productName: {
    type: String,
    required: true
  }
})

const route = useRoute()
const router = useRouter()
const supabase = useSupabaseClient()
const user = useSupabaseUser()

const reviewsList = ref(null)
const reviewsOpen = ref(false)
const reviewsLoaded = ref(false)
const reviewsLoading = ref(false)
const reviews = ref([])
const totalReviews = ref(0)
const currentPage = ref(1)
const pageSize = 10
const averageRating = ref(0)
const hasReviewed = ref(false)
const loadError = ref('')
const selectedRating = ref(0)
const hoveredRating = ref(0)
const reviewText = ref('')
const displayFullName = ref(false)
const submitting = ref(false)
const submitError = ref('')
const submitSuccess = ref('')
const maximumReviewLength = 999
const starOptions = [1, 2, 3, 4, 5]

const reviewCharacterCount = computed(() => Array.from(reviewText.value).length)
const formattedAverageRating = computed(() => Number(averageRating.value || 0).toFixed(1))
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
const reviewFormHeading = computed(() => {
  if (!totalReviews.value) {
    return `Be the first to review “${props.productName}”`
  }

  return `Review “${props.productName}”`
})

const reviewReturnPath = computed(() => {
  return router.resolve({
    path: route.path,
    query: {
      ...route.query,
      reviews: 'open'
    }
  }).fullPath
})

const loginDestination = computed(() => ({
  path: '/login',
  query: {
    redirect: reviewReturnPath.value
  }
}))

const normalizeReview = (record = {}) => ({
  id: String(record.id || ''),
  rating: Math.min(5, Math.max(1, Number(record.rating) || 1)),
  reviewText: String(record.reviewText ?? record.review_text ?? ''),
  reviewerName: String(record.reviewerName ?? record.reviewer_name ?? 'Customer'),
  createdAt: String(record.createdAt ?? record.created_at ?? '')
})

const getOptionalAuthHeaders = async () => {
  const { data } = await supabase.auth.getSession()

  if (!data.session?.access_token) {
    return {}
  }

  return {
    authorization: `Bearer ${data.session.access_token}`
  }
}

const loadReviews = async ({ page = 1 } = {}) => {
  if (reviewsLoading.value) {
    return false
  }

  reviewsLoading.value = true
  loadError.value = ''

  try {
    const response = await $fetch('/api/product-reviews', {
      query: {
        productId: props.productId,
        page,
        pageSize
      },
      headers: await getOptionalAuthHeaders()
    })
    const nextReviews = (response.items || []).map(normalizeReview)

    reviews.value = nextReviews
    totalReviews.value = Number(response.total || 0)
    currentPage.value = Number(response.page) || page
    averageRating.value = Number(response.averageRating || 0)
    hasReviewed.value = Boolean(response.hasReviewed)
    reviewsLoaded.value = true
    return true
  } catch (error) {
    loadError.value = error?.data?.statusMessage || error?.message || 'Could not load reviews.'
    return false
  } finally {
    reviewsLoading.value = false
  }
}

const toggleReviews = async () => {
  reviewsOpen.value = !reviewsOpen.value

  if (reviewsOpen.value && !reviewsLoaded.value) {
    await loadReviews({ page: 1 })
  }
}

const goToReviewPage = async (page) => {
  const requestedPage = Number(page)

  if (
    !Number.isInteger(requestedPage)
    || requestedPage < 1
    || requestedPage > totalPages.value
    || requestedPage === currentPage.value
    || reviewsLoading.value
  ) {
    return
  }

  const loaded = await loadReviews({ page: requestedPage })

  if (loaded && import.meta.client) {
    await nextTick()
    reviewsList.value?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    })
  }
}

const submitReview = async () => {
  submitError.value = ''
  submitSuccess.value = ''
  const trimmedReview = reviewText.value.trim()

  if (!selectedRating.value) {
    submitError.value = 'Choose a rating from 1 to 5 stars.'
    return
  }

  if (!trimmedReview) {
    submitError.value = 'Your review is required.'
    return
  }

  if (Array.from(trimmedReview).length > maximumReviewLength) {
    submitError.value = `Your review cannot exceed ${maximumReviewLength} characters.`
    return
  }

  submitting.value = true

  try {
    const { data } = await supabase.auth.getSession()

    if (!data.session?.access_token) {
      throw new Error('Your session expired. Please log in again.')
    }

    const response = await $fetch('/api/product-reviews', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${data.session.access_token}`
      },
      body: {
        productId: props.productId,
        rating: selectedRating.value,
        reviewText: trimmedReview,
        displayFullName: displayFullName.value
      }
    })

    hasReviewed.value = Boolean(response.hasReviewed ?? true)
    selectedRating.value = 0
    hoveredRating.value = 0
    reviewText.value = ''
    displayFullName.value = false
    submitSuccess.value = 'Your review was submitted successfully.'
    await loadReviews({ page: 1 })
  } catch (error) {
    const errorMessage = error?.data?.statusMessage || error?.message || 'Could not submit your review.'
    submitError.value = errorMessage

    if (error?.statusCode === 409 || /already reviewed/i.test(errorMessage)) {
      hasReviewed.value = true
    }
  } finally {
    submitting.value = false
  }
}

const formatReviewDate = (value) => {
  if (!value) {
    return 'Recently'
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium'
  }).format(new Date(value))
}

watch(
  () => user.value?.id,
  async (currentUserId, previousUserId) => {
    if (
      reviewsOpen.value
      && reviewsLoaded.value
      && currentUserId !== previousUserId
    ) {
      await loadReviews({ page: 1 })
    }
  }
)

onMounted(async () => {
  if (route.query.reviews !== 'open') {
    return
  }

  reviewsOpen.value = true
  await loadReviews({ page: 1 })
})
</script>
