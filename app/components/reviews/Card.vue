<template>
  <article class="flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <p dir="auto" class="truncate font-bold text-gray-900">
          {{ review.reviewerName || $t('common.customer') }}
        </p>
        <p class="mt-1 text-xs text-gray-400">
          {{ formattedDate }}
        </p>
      </div>

      <div
        class="flex shrink-0 items-center gap-0.5"
        role="img"
        :aria-label="$t('common.valueOutOf5Stars', { value0: (normalizedRating) })"
      >
        <ReviewsStarIcon
          v-for="star in starOptions"
          :key="star"
          :size="18"
          :filled="star <= normalizedRating"
        />
      </div>
    </div>

    <p
      dir="auto"
      class="mt-5 whitespace-pre-wrap break-words text-start leading-7 text-gray-700"
      :class="compact ? 'line-clamp-5 min-h-[8.75rem]' : ''"
    >
      {{ review.reviewText }}
    </p>

    <div v-if="review.productTitle" class="mt-auto border-t border-gray-100 pt-4">
      <NuxtLinkLocale
        v-if="interactive && review.productSlug"
        :to="`/products/${review.productSlug}`"
        class="inline-flex max-w-full items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700"
      >
        <span class="truncate">{{ review.productTitle }}</span>
        <Icon name="lucide:arrow-up-right" size="15" class="shrink-0" />
      </NuxtLinkLocale>

      <p v-else class="truncate text-sm font-semibold text-gray-500">
        {{ review.productTitle }}
      </p>
    </div>
  </article>
</template>

<script setup>
const { uiLabel } = useUiLocale()
const { intlLocale } = useUiLocale()

const props = defineProps({
  review: {
    type: Object,
    required: true
  },
  compact: {
    type: Boolean,
    default: false
  },
  interactive: {
    type: Boolean,
    default: true
  }
})

const starOptions = [1, 2, 3, 4, 5]
const normalizedRating = computed(() => {
  return Math.min(5, Math.max(1, Number(props.review?.rating) || 1))
})
const formattedDate = computed(() => {
  const date = new Date(props.review?.createdAt || '')

  if (Number.isNaN(date.getTime())) {
    return uiLabel('Recently')
  }

  return new Intl.DateTimeFormat(intlLocale.value, {
    dateStyle: 'medium'
  }).format(date)
})
</script>
