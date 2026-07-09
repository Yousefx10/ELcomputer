<template>
  <div>
    <div class="my-10 px-4 md:px-10 select-none">
      <h2 class="text-4xl font-black tracking-tight uppercase md:text-6xl">
        {{ title }}
      </h2>
      <p class="mt-2 text-base text-gray-700 md:text-lg">{{ description }}</p>
    </div>

    <div v-if="brands.length" class="overflow-hidden">
      <div class="flex w-max gap-5 animate-scroll">
        <NuxtLink
          v-for="brand in repeatedBrands"
          :key="brand.loopKey"
          :to="{ path: '/search', query: { brand: brand.slug } }"
          class="flex h-[180px] min-w-[150px] items-center justify-center rounded-2xl border border-gray-300 bg-white p-4"
        >
          <img
            v-if="brand.logo_url"
            class="max-h-[120px] max-w-[120px] object-contain"
            :src="brand.logo_url"
            :alt="brand.name"
          />

          <p v-else class="text-center font-bold text-gray-700">
            {{ brand.name }}
          </p>
        </NuxtLink>
      </div>
    </div>

    <p v-else class="px-4 text-gray-500 md:px-10">
      No brands available right now.
    </p>
  </div>
</template>

<script setup>
const props = defineProps({
  title: String,
  description: String,
  brands: {
    type: Array,
    default: () => []
  }
})

const repeatedBrands = computed(() => {
  return [...props.brands, ...props.brands].map((brand, index) => ({
    ...brand,
    loopKey: `${brand.id}-${index}`
  }))
})
</script>

<style scoped>
@keyframes scroll {
  from {
    transform: translateX(0);
  }

  to {
    transform: translateX(-50%);
  }
}

.animate-scroll {
  animation: scroll 30s linear infinite;
}

.animate-scroll:hover {
  animation-play-state: paused;
}
</style>
