<template>
  <nav
    v-if="totalPages > 1"
    class="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3"
    :aria-label="label"
  >
    <button
      type="button"
      :disabled="loading || page <= 1"
      class="min-h-11 rounded-lg border px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
      @click="$emit('change', page - 1)"
    >
      Previous
    </button>

    <div class="flex flex-wrap items-center justify-center gap-1">
      <template v-for="item in paginationItems" :key="item.key">
        <span
          v-if="item.type === 'ellipsis'"
          class="px-2 text-sm text-gray-400"
          aria-hidden="true"
        >
          …
        </span>

        <button
          v-else
          type="button"
          :disabled="loading || item.page === page"
          class="inline-flex h-10 min-w-10 items-center justify-center rounded-lg px-3 text-sm font-semibold transition"
          :class="item.page === page
            ? 'bg-blue-600 text-white'
            : 'border text-gray-700 hover:bg-gray-50'"
          :aria-current="item.page === page ? 'page' : undefined"
          :aria-label="`Page ${item.page}`"
          @click="$emit('change', item.page)"
        >
          {{ item.page }}
        </button>
      </template>
    </div>

    <button
      type="button"
      :disabled="loading || page >= totalPages"
      class="min-h-11 rounded-lg border px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
      @click="$emit('change', page + 1)"
    >
      Next
    </button>
  </nav>
</template>

<script setup>
const props = defineProps({
  label: {
    type: String,
    default: 'Pagination'
  },
  loading: {
    type: Boolean,
    default: false
  },
  page: {
    type: Number,
    required: true
  },
  totalPages: {
    type: Number,
    required: true
  }
})

defineEmits(['change'])

const paginationItems = computed(() => {
  const pages = new Set([
    1,
    props.totalPages,
    props.page - 2,
    props.page - 1,
    props.page,
    props.page + 1,
    props.page + 2
  ])
  const visiblePages = [...pages]
    .filter((page) => page >= 1 && page <= props.totalPages)
    .sort((left, right) => left - right)
  const items = []

  visiblePages.forEach((page, index) => {
    const previousPage = visiblePages[index - 1]

    if (previousPage && page - previousPage > 1) {
      items.push({
        key: `ellipsis-${previousPage}-${page}`,
        type: 'ellipsis'
      })
    }

    items.push({
      key: `page-${page}`,
      type: 'page',
      page
    })
  })

  return items
})
</script>
