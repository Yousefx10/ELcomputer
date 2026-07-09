<template>
  <div v-if="currentBanner" class="relative">
    <a
      :href="currentBanner.link_url || '#'"
      class="block"
    >
      <img
        class="w-full object-cover"
        alt="Hero Banner"
        :src="currentBanner.image_url"
      >
    </a>

    <div v-if="heroBanners.length > 1" class="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-4">
      <button
        v-for="(banner, index) in heroBanners"
        :key="banner.id"
        type="button"
        class="inline-block h-2 w-12 rounded-full"
        :class="index === currentBannerIndex ? 'bg-white' : 'bg-white/50'"
        @click="currentBannerIndex = index"
      />
    </div>
  </div>
</template>

<script setup>
const { data: siteContent } = await useSiteContent()

const currentBannerIndex = ref(0)
let heroInterval = null

const heroBanners = computed(() => {
  if (!(siteContent.value?.settings?.hero_enabled ?? true)) {
    return []
  }

  return siteContent.value?.heroBanners || []
})

const currentBanner = computed(() => {
  return heroBanners.value[currentBannerIndex.value] || null
})

const restartHeroInterval = () => {
  if (heroInterval) {
    clearInterval(heroInterval)
  }

  if (heroBanners.value.length <= 1) {
    return
  }

  heroInterval = setInterval(() => {
    currentBannerIndex.value = (currentBannerIndex.value + 1) % heroBanners.value.length
  }, 5000)
}

watch(heroBanners, () => {
  currentBannerIndex.value = 0
  restartHeroInterval()
})

onMounted(() => {
  restartHeroInterval()
})

onBeforeUnmount(() => {
  if (heroInterval) {
    clearInterval(heroInterval)
  }
})
</script>
