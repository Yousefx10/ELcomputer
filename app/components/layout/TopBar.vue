<template>
  <div class="bg-blue-500">
    <p class="p-2 text-center text-xs font-bold text-white">
      {{ currentMessage }}
    </p>
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
  return messages.value[currentMessageIndex.value]?.text || 'Pretty Cool Text Around'
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
