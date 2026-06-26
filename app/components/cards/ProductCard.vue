<template>
  <div class="flex-shrink-0 w-[280px] md:w-[300px] bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-lg transition">
    
    <!-- Title -->
    <div class="h-[70px] flex items-center justify-center px-4">
      <p class="text-center font-bold line-clamp-2">
        {{ product.title }}
      </p>
    </div>

    <!-- Image -->
    <div class="relative h-[220px] bg-gray-100">
      <img
        class="h-full w-full object-contain p-4"
        :src="product.image_url"
        :alt="product.title"
      />

      <span class="absolute top-4 left-4 px-4 py-2 bg-green-500/90 rounded-full text-white font-bold text-xs">
        25% OFF
      </span>
    </div>

    <!-- Price -->
    <div class="flex justify-between p-5 items-center">
      <div class="flex flex-col">
        <span class="text-gray-500 text-sm font-semibold">Buy For</span>

        <span
          class="line-through text-sm text-blue-600"
          v-if="product.old_price"
        >
          {{ product.old_price }} EGP
        </span>

        <span class="text-blue-800 font-black text-2xl">
          {{ product.price }} EGP
        </span>
      </div>

      <button class="bg-blue-600 rounded-2xl h-[56px] w-[56px] font-bold text-white text-2xl">
        +
      </button>
    </div>

  </div>
</template>

<script setup>
defineProps({
  product: {
    type: Object,
    required: true
  }
})
</script>