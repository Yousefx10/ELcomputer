<template>
  <div class="max-w-full">
    <p class="pb-5 text-center text-4xl font-bold">TOP CATEGORIES</p>

    <section v-if="categories.length" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
      <div
        v-for="category in categories"
        :key="category.id"
        class="rounded-2xl bg-white p-5 text-center shadow-sm"
      >
        <div class="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gray-100 text-2xl font-bold text-gray-700">
          {{ category.name.charAt(0) }}
        </div>

        <p class="font-bold text-gray-900">
          {{ category.name }}
        </p>

        <p class="mt-1 text-sm text-gray-500">
          {{ category.productCount || 0 }} products
        </p>
      </div>
    </section>

    <p v-else class="text-center text-gray-500">
      No categories available right now.
    </p>
  </div>
</template>

<script setup>
defineProps({
  categories: {
    type: Array,
    default: () => []
  }
})
</script>
