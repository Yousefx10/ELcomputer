<script setup>
const props = defineProps({ productId: { type: String, required: true }, items: { type: Array, default: () => [] } })
const opened = ref(false)
const visible = computed(() => {
  const ids = new Set([props.productId])
  return props.items.filter(item => {
    if (!item?.id || !item.slug || !item.title || item.is_published !== true || ids.has(item.id)
      || !Number.isFinite(Number(item.price)) || Number(item.price) < 0 || item.selling_mode === 'coming_soon') return false
    ids.add(item.id); return true
  }).slice(0, 8)
})
</script>

<template>
  <details v-if="visible.length" class="pdp-buy-with-it" @toggle="event => { if (event.target.open) opened = true }">
    <summary><span>{{ $t('modernProduct.buyWithIt') }}</span><Icon name="lucide:chevron-down" size="17" aria-hidden="true" /></summary>
    <div v-if="opened" class="pdp-accessory-list"><CardsProductCard v-for="item in visible" :key="item.id" :product="item" /></div>
  </details>
</template>
