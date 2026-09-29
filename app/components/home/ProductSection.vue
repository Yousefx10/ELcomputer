<template>
  <section class="store-section" :aria-labelledby="headingId">
    <div class="store-section-header">
      <div>
        <h2 :id="headingId" class="store-section-title">{{ title }}</h2>
        <p v-if="description" class="store-section-description">{{ description }}</p>
      </div>
      <div class="store-product-actions">
        <NuxtLinkLocale :to="to" class="store-text-link">{{ $t('common.viewAll') }}</NuxtLinkLocale>
        <button type="button" class="store-round-button" :aria-label="$t('common.previousValue', { value0: (title) })" :disabled="!canScrollLeft" @click="scroll(-1)"><Icon name="lucide:chevron-left" size="17" class="directional-icon" /></button>
        <button type="button" class="store-round-button" :aria-label="$t('common.moreValue', { value0: (title) })" :disabled="!canScrollRight" @click="scroll(1)"><Icon name="lucide:chevron-right" size="17" class="directional-icon" /></button>
      </div>
    </div>
    <div ref="slider" class="store-product-rail no-scrollbar" @scroll.passive="updateScrollState">
      <CardsProductCard v-for="product in products" :key="product.id" :product="product" />
    </div>
  </section>
</template>

<script setup>
const props = defineProps({
  title: String,
  description: String,
  products: { type: Array, default: () => [] },
  to: { type: [String, Object], default: '/search' }
})
const headingId = useId()
const slider = ref(null)
const canScrollLeft = ref(false)
const canScrollRight = ref(false)
let resizeObserver
const updateScrollState = () => {
  if (!slider.value) return
  canScrollLeft.value = Math.abs(slider.value.scrollLeft) > 2
  canScrollRight.value = Math.abs(slider.value.scrollLeft) + slider.value.clientWidth < slider.value.scrollWidth - 2
}
const scroll = (direction) => {
  slider.value?.scrollBy({
    left: direction * slider.value.clientWidth * .85 * (getComputedStyle(slider.value).direction === 'rtl' ? -1 : 1),
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
  })
}
watch(() => props.products, () => nextTick(updateScrollState))
onMounted(() => {
  updateScrollState()
  resizeObserver = new ResizeObserver(updateScrollState)
  if (slider.value) resizeObserver.observe(slider.value)
})
onBeforeUnmount(() => resizeObserver?.disconnect())
</script>
