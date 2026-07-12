<template>
  <article
    class="relative h-[360px] w-[280px] flex-shrink-0 overflow-hidden rounded-[28px] bg-black shadow-sm md:w-[320px]"
  >
    <img
      v-if="imageUrl"
      :src="imageUrl"
      :alt="title || 'Offer card image'"
      class="absolute inset-0 h-full w-full object-cover"
    >

    <div class="absolute inset-0 bg-gradient-to-b from-black/85 via-black/25 to-black/80" />

    <div class="relative z-10 flex h-full flex-col justify-between p-5 text-white md:p-6">
      <div>
        <p
          v-if="eyebrowText"
          class="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/80"
        >
          {{ eyebrowText }}
        </p>

        <h3 class="mt-3 max-w-[85%] text-3xl font-black leading-none md:text-[2.8rem]">
          {{ title || 'Offer' }}
        </h3>
      </div>

      <div>
        <NuxtLink
          v-if="to"
          :to="to"
          class="inline-flex items-center rounded-full border border-white/45 bg-white/15 px-5 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
        >
          View Offer
        </NuxtLink>

        <span
          v-else
          class="inline-flex items-center rounded-full border border-white/25 bg-white/10 px-5 py-3 text-sm font-semibold text-white/70"
        >
          View Offer
        </span>
      </div>
    </div>
  </article>
</template>

<script setup>
defineProps({
  eyebrowText: {
    type: String,
    default: ''
  },
  title: {
    type: String,
    default: ''
  },
  imageUrl: {
    type: String,
    default: ''
  },
  to: {
    type: [String, Object],
    default: null
  }
})
</script>
