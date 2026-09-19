<template>
  <div class="store-topbar">
    <div class="store-container store-topbar-inner">
      <p>{{ currentMessage }}</p>
      <div class="store-topbar-links">
        <NuxtLink to="/search">Shop all products <Icon name="lucide:arrow-right" size="13" /></NuxtLink>
        <NuxtLink to="/help">Need help?</NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup>
const { data: siteContent } = await useSiteContent()

const currentMessageIndex = ref(0)
let topBarInterval = null

const messages = computed(() => siteContent.value?.topBarMessages || [])
const rotationSeconds = computed(() => {
  return Math.max(1, Number(siteContent.value?.settings?.top_bar_rotation_seconds || 3))
})

const currentMessage = computed(() => {
  const message = messages.value[currentMessageIndex.value]?.text
  return message && message !== 'Pretty Cool Text Around' ? message : 'Keyboards, mice, headsets and accessories.'
})

const restartTopBarInterval = () => {
  if (topBarInterval) {
    clearInterval(topBarInterval)
  }

  if (messages.value.length <= 1) {
    return
  }

  topBarInterval = setInterval(() => {
    currentMessageIndex.value = (currentMessageIndex.value + 1) % messages.value.length
  }, rotationSeconds.value * 1000)
}

watch([messages, rotationSeconds], () => {
  currentMessageIndex.value = 0
  restartTopBarInterval()
})

onMounted(() => {
  restartTopBarInterval()
})

onBeforeUnmount(() => {
  if (topBarInterval) {
    clearInterval(topBarInterval)
  }
})
</script>
