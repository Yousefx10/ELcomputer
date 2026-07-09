<template>
  <NuxtLink
    :to="product.slug ? `/products/${product.slug}` : '/'"
    class="block w-[280px] flex-shrink-0 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:shadow-lg md:w-[300px]"
  >
    <div class="flex h-[220px] items-center justify-center bg-gray-100 p-4">
      <img
        v-if="product.image_url"
        class="h-full w-full object-contain"
        :src="product.image_url"
        :alt="product.title"
      />

      <p v-else class="text-sm text-gray-400">
        No image available
      </p>
    </div>

    <div class="p-5">
      <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {{ product.brand?.name || product.category?.name || 'Product' }}
      </p>

      <h3 class="mt-2 line-clamp-2 min-h-[56px] text-lg font-bold text-gray-900">
        {{ product.title }}
      </h3>

      <div class="mt-4">
        <p class="text-2xl font-bold text-blue-700">
          {{ product.price }} EGP
        </p>

        <p
          v-if="product.old_price"
          class="mt-1 text-sm text-gray-400 line-through"
        >
          {{ product.old_price }} EGP
        </p>
      </div>

      <div class="mt-4 flex items-center justify-between">
        <span class="text-sm text-gray-500">
          {{ product.category?.name || 'No Category' }}
        </span>

        <span class="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white">
          View
        </span>
      </div>
    </div>
  </NuxtLink>
</template>

<script setup>
defineProps({
  product: {
    type: Object,
    required: true
  }
})
</script>
