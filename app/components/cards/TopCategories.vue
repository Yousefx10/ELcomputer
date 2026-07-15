<template>
  <div class="max-w-full">
    <p class="mb-8 text-center text-3xl font-black uppercase tracking-[0.08em] text-slate-900 md:text-5xl">
      Top Categories
    </p>

    <section v-if="categories.length" class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <NuxtLink
        v-for="category in categories"
        :key="category.id"
        :to="{ path: '/search', query: { category: category.slug } }"
        class="group block"
      >
        <div class="relative overflow-hidden rounded-[2rem] bg-[linear-gradient(180deg,#1f5bff_0%,#1239d7_58%,#0b1d72_100%)] p-4 shadow-sm transition-transform duration-200 group-hover:-translate-y-1">
          <div class="absolute inset-0 opacity-20">
            <span class="absolute left-6 top-10 h-16 w-16 rounded-full border border-white/50" />
            <span class="absolute right-6 top-8 h-24 w-24 rounded-[2rem] border border-white/40 rotate-12" />
            <span class="absolute bottom-6 left-1/2 h-28 w-16 -translate-x-1/2 rounded-full border border-white/35" />
          </div>

          <div class="relative flex h-44 items-center justify-center md:h-48">
            <img
              v-if="category.displayImageUrl"
              :src="category.displayImageUrl"
              :alt="category.name"
              class="h-full w-full object-contain drop-shadow-[0_18px_22px_rgba(0,0,0,0.28)] transition-transform duration-200 group-hover:scale-105"
            >

            <div
              v-else
              class="flex h-24 w-24 items-center justify-center rounded-full bg-white/15 text-4xl font-bold text-white"
            >
              {{ category.name.charAt(0) }}
            </div>
          </div>
        </div>

        <p class="mt-4 text-center text-xl font-semibold tracking-tight text-slate-900 md:text-2xl">
          {{ category.name }}
        </p>
      </NuxtLink>
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
