<template>
  <div class="store-topbar">
    <div class="store-container store-topbar-inner">
      <p>{{ currentMessage }}</p>
      <div class="store-topbar-links">
        <NuxtLink to="/search">Explore the store <Icon name="lucide:arrow-right" size="13" /></NuxtLink>
        <a v-if="supportEmail" :href="`mailto:${supportEmail}`">Need help?</a>
      </div>
    </div>
  </div>
</template>

<script setup>
const { data: siteContent } = await useSiteContent()

const currentMessageIndex = ref(0)
let topBarInterval = null

const messages = computed(() => siteContent.value?.topBarMessages || [])
const supportEmail = computed(() => siteContent.value?.settings?.footer_email || '')
const rotationSeconds = computed(() => {
  return Math.max(1, Number(siteContent.value?.settings?.top_bar_rotation_seconds || 3))
})

const currentMessage = computed(() => {
  const message = messages.value[currentMessageIndex.value]?.text
  return message && message !== 'Pretty Cool Text Around' ? message : 'Your next setup starts here.'
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
