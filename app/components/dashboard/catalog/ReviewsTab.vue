<template>
  <div class="space-y-6">
    <div class="rounded-2xl bg-gray-200 p-6 shadow">
      <h2 class="text-4xl font-bold">Reviews</h2>
      <p class="mt-2 text-sm text-gray-500">
        Read customer feedback and remove reviews that should no longer be displayed.
      </p>
    </div>

    <div
      v-if="pageError"
      class="rounded-2xl bg-red-50 p-4 text-red-600 shadow"
      role="alert"
    >
      {{ pageError }}
    </div>

    <section class="rounded-2xl bg-white p-5 shadow">
      <div class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 class="text-2xl font-bold">All Reviews</h3>
          <p class="mt-1 text-sm text-gray-500">
            Search by product, reviewer, email, or review text.
          </p>
        </div>

        <p class="shrink-0 text-sm text-gray-500">
          {{ totalReviews }} {{ hasActiveFilters ? 'matching' : 'total' }}
        </p>
      </div>

      <form
        class="mb-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_auto]"
        @submit.prevent="applyFilters"
      >
        <div>
          <label for="review-search" class="mb-2 block text-sm font-semibold text-gray-700">
            Search Reviews
          </label>
          <input
            id="review-search"
            v-model="searchQuery"
            type="search"
            placeholder="Search reviews"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          >
        </div>

        <div>
          <label for="review-rating" class="mb-2 block text-sm font-semibold text-gray-700">
            Rating
          </label>
          <select
            id="review-rating"
            v-model="selectedRating"
            class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500"
          >
            <option value="">All ratings</option>
            <option
              v-for="ratingOption in ratingOptions"
              :key="ratingOption"
              :value="String(ratingOption)"
            >
              {{ ratingOption }} {{ ratingOption === 1 ? 'star' : 'stars' }}
            </option>
          </select>
        </div>

        <div class="flex items-end gap-2">
          <button
            type="submit"
            :disabled="loading"
            class="flex-1 rounded-lg bg-black px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Apply
          </button>

          <button
            v-if="hasActiveFilters"
            type="button"
            :disabled="loading"
            class="flex-1 rounded-lg border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
            @click="clearFilters"
          >
            Clear
          </button>
        </div>
      </form>

      <div
        v-if="loading"
        class="rounded-xl border border-dashed p-8 text-center text-gray-500"
      >
        Loading reviews...
      </div>

      <div
        v-else-if="!reviews.length"
        class="rounded-xl border border-dashed p-8 text-center"
      >
        <h4 class="text-xl font-bold text-gray-900">
          {{ hasActiveFilters ? 'No matching reviews' : 'No reviews yet' }}
        </h4>
        <p class="mt-2 text-sm text-gray-500">
          {{ hasActiveFilters
            ? 'Try a different search term or rating.'
            : 'Submitted product reviews will appear here.' }}
        </p>
      </div>

      <div v-else>
        <div class="mb-4 flex flex-col gap-2 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p class="text-sm text-gray-500">
            Showing {{ pageStart }}-{{ pageEnd }} of {{ totalReviews }}
            {{ hasActiveFilters ? 'matching reviews' : 'reviews' }}
          </p>

          <p class="text-sm font-medium text-gray-600">
            Page {{ currentPage }} of {{ totalPages }}
          </p>
        </div>

        <div class="space-y-4">
          <article
            v-for="review in reviews"
            :key="review.id"
            class="rounded-2xl border p-4 sm:p-5"
          >
            <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div class="min-w-0 space-y-3">
                <div class="flex flex-wrap items-center gap-2">
                  <div
                    class="flex items-center gap-0.5"
                    :aria-label="`${review.rating} out of 5 stars`"
                  >
                    <Icon
                      v-for="star in ratingOptions"
                      :key="star"
                      name="lucide:star"
                      size="18"
                      :class="star <= review.rating
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-gray-300'"
                    />
                  </div>

                  <span class="text-sm font-semibold text-gray-700">
                    {{ review.rating }}/5
                  </span>

                  <span
                    class="rounded-full px-3 py-1 text-xs font-semibold"
                    :class="review.displayFullName
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600'"
                  >
                    {{ review.displayFullName ? 'Full name shown publicly' : 'Name masked publicly' }}
                  </span>
                </div>

                <div>
                  <NuxtLink
                    v-if="review.productSlug"
                    :to="`/products/${review.productSlug}`"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex max-w-full items-center gap-2 font-bold text-gray-900 hover:text-blue-600"
                  >
                    <span class="truncate">{{ review.productTitle }}</span>
                    <Icon name="lucide:external-link" size="15" class="shrink-0" />
                  </NuxtLink>

                  <p v-else class="font-bold text-gray-900">
                    {{ review.productTitle }}
                  </p>

                  <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span class="font-semibold text-gray-700">
                      {{ review.reviewerName }}
                    </span>
                    <span v-if="review.reviewerEmail" class="break-all text-gray-500">
                      {{ review.reviewerEmail }}
                    </span>
                  </div>

                  <p class="mt-1 text-xs text-gray-400">
                    Submitted {{ formatDate(review.createdAt) }}
                  </p>
                </div>
              </div>

              <button
                type="button"
                :disabled="Boolean(deletingReviewId)"
                class="shrink-0 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                @click="deleteReview(review)"
              >
                {{ deletingReviewId === review.id ? 'Deleting...' : 'Delete' }}
              </button>
            </div>

            <div class="mt-4 rounded-xl bg-gray-50 p-4">
              <p
                dir="auto"
                class="whitespace-pre-wrap break-words text-start text-sm leading-7 text-gray-700"
              >
                {{ review.body }}
              </p>
            </div>
          </article>
        </div>

        <div class="mt-5 flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            :disabled="currentPage === 1 || loading || Boolean(deletingReviewId)"
            class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            @click="goToPreviousPage"
          >
            Previous
          </button>

          <p class="text-center text-sm text-gray-500">
            Page {{ currentPage }} of {{ totalPages }}
          </p>

          <button
            type="button"
            :disabled="currentPage === totalPages || loading || Boolean(deletingReviewId)"
            class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            @click="goToNextPage"
          >
            Next
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
defineOptions({
  name: 'DashboardCatalogReviewsTab'
})

const supabase = useSupabaseClient()

const reviews = ref([])
const totalReviews = ref(0)
const currentPage = ref(1)
const pageSize = 10
const loading = ref(true)
const pageError = ref('')
const deletingReviewId = ref('')
const searchQuery = ref('')
const selectedRating = ref('')
const appliedSearch = ref('')
const appliedRating = ref('')
const ratingOptions = [1, 2, 3, 4, 5]

const hasActiveFilters = computed(() => Boolean(appliedSearch.value || appliedRating.value))

const totalPages = computed(() => {
  return Math.max(1, Math.ceil(totalReviews.value / pageSize))
})

const pageStart = computed(() => {
  if (!totalReviews.value) {
    return 0
  }

  return ((currentPage.value - 1) * pageSize) + 1
})

const pageEnd = computed(() => {
  return Math.min(currentPage.value * pageSize, totalReviews.value)
})

const getAdminAuthHeaders = async () => {
  const { data } = await supabase.auth.getSession()

  if (!data.session?.access_token) {
    throw new Error('Your session expired. Please log in again.')
  }

  return {
    authorization: `Bearer ${data.session.access_token}`
  }
}

const formatDate = (value) => {
  if (!value) {
    return 'recently'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'recently'
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date)
}

const getRelatedRecord = (record, keys = []) => {
  for (const key of keys) {
    const value = record?.[key]

    if (Array.isArray(value)) {
      if (value[0]) {
        return value[0]
      }

      continue
    }

    if (value && typeof value === 'object') {
      return value
    }
  }

  return {}
}

const normalizeReview = (record = {}) => {
  const product = getRelatedRecord(record, ['product', 'products'])
  const reviewer = getRelatedRecord(record, [
    'reviewer',
    'customer',
    'customer_profile',
    'customer_profiles'
  ])
  const displayNamePreference = record.display_full_name
    ?? record.show_full_name
    ?? record.display_name
    ?? false

  return {
    id: String(record.id || ''),
    productTitle: String(
      record.product_title
      || product.title
      || 'Deleted or unavailable product'
    ),
    productSlug: String(record.product_slug || product.slug || ''),
    reviewerName: String(
      record.reviewer_full_name
      || record.customer_name
      || reviewer.full_name
      || 'Customer'
    ),
    reviewerEmail: String(
      record.reviewer_email
      || record.customer_email
      || reviewer.email
      || ''
    ),
    displayFullName: displayNamePreference === true,
    rating: Math.min(5, Math.max(1, Number(record.rating) || 1)),
    body: String(record.review_text ?? record.review ?? record.body ?? record.content ?? ''),
    createdAt: String(record.created_at || record.createdAt || '')
  }
}

const loadReviews = async (page = currentPage.value) => {
  currentPage.value = page
  loading.value = true
  pageError.value = ''

  try {
    const response = await $fetch('/api/admin-reviews', {
      query: {
        page,
        pageSize,
        search: appliedSearch.value || undefined,
        rating: appliedRating.value || undefined
      },
      headers: await getAdminAuthHeaders()
    })

    reviews.value = (response.items || []).map(normalizeReview)
    totalReviews.value = Number(response.total ?? response.filteredTotal ?? 0)
    currentPage.value = Number(response.page) || page

    if (currentPage.value > totalPages.value) {
      await loadReviews(totalPages.value)
    }
  } catch (error) {
    reviews.value = []
    totalReviews.value = 0
    pageError.value = error?.data?.statusMessage || error?.message || 'Could not load reviews.'
  } finally {
    loading.value = false
  }
}

const applyFilters = async () => {
  appliedSearch.value = searchQuery.value.trim()
  appliedRating.value = selectedRating.value
  await loadReviews(1)
}

const clearFilters = async () => {
  searchQuery.value = ''
  selectedRating.value = ''
  appliedSearch.value = ''
  appliedRating.value = ''
  await loadReviews(1)
}

const deleteReview = async (review) => {
  if (!review?.id || deletingReviewId.value) {
    return
  }

  const shouldDelete = confirm(
    `Are you sure you want to delete this review for "${review.productTitle}"?`
  )

  if (!shouldDelete) {
    return
  }

  deletingReviewId.value = review.id
  pageError.value = ''

  try {
    await $fetch(`/api/admin-reviews/${review.id}`, {
      method: 'DELETE',
      headers: await getAdminAuthHeaders()
    })

    const remainingTotal = Math.max(0, totalReviews.value - 1)
    const lastRemainingPage = Math.max(1, Math.ceil(remainingTotal / pageSize))
    await loadReviews(Math.min(currentPage.value, lastRemainingPage))
  } catch (error) {
    pageError.value = error?.data?.statusMessage || error?.message || 'Could not delete this review.'
  } finally {
    deletingReviewId.value = ''
  }
}

const goToPreviousPage = async () => {
  if (currentPage.value === 1) {
    return
  }

  await loadReviews(currentPage.value - 1)
}

const goToNextPage = async () => {
  if (currentPage.value === totalPages.value) {
    return
  }

  await loadReviews(currentPage.value + 1)
}

onMounted(async () => {
  await loadReviews()
})
</script>
