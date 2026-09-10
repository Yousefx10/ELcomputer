<template>
  <aside class="order-first min-w-0 border-b border-gray-200 bg-gray-50/50 p-5 xl:order-last xl:border-s xl:border-b-0" aria-label="File details" @keydown.esc.stop="$emit('close')">
    <div class="mb-5 flex items-center justify-between gap-3">
      <h4 ref="heading" tabindex="-1" class="text-sm font-semibold outline-none">{{ title }}</h4>
      <button type="button" class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-200 hover:text-gray-900" aria-label="Close details" @click="$emit('close')"><Icon name="lucide:x" size="17" /></button>
    </div>
    <slot />
  </aside>
</template>

<script setup>
defineProps({ title: { type: String, default: 'Details' } })
defineEmits(['close'])
const heading = ref(null)
let previousFocus
onMounted(() => {
  previousFocus = document.activeElement
  heading.value?.focus({ preventScroll: window.innerWidth >= 1280 })
})
onUnmounted(() => {
  if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
})
</script>
