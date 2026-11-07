<script setup>
// Saves the product to the shopper's favorites, then lets the cart remove the line.
// Favorites stay private preferences (guest list or the signed-in account's list).
import { useProductFavorites } from '~/composables/useProductFavorites'
const props = defineProps({ productId: { type: String, required: true }, title: { type: String, default: '' } })
const emit = defineEmits(['moved'])
const { saved, busy, ready, feedback, toggle } = useProductFavorites(() => props.productId)
const move = async () => {
  if (busy.value) return
  if (!saved.value) await toggle()
  if (saved.value) emit('moved')
}
</script>

<template>
  <button type="button" class="cart-favorite" :disabled="busy || !ready" :aria-label="`${$t('cart.moveToFavorites')}: ${title}`" @click="move">
    <Icon name="lucide:heart" size="16" aria-hidden="true" /><span>{{ $t('cart.moveToFavorites') }}</span>
  </button>
  <span v-if="feedback && feedback !== 'favoriteSavedGuest' && feedback !== 'favoriteSavedAccount'" class="cart-favorite-note" role="status">{{ $t(`productFinishing.${feedback}`) }}</span>
</template>
