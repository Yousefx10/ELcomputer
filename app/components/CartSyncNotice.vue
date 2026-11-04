<template>
  <div v-if="syncNotice || ['loading','saving','error','conflict'].includes(syncState)" class="store-container py-2 text-sm" role="status" aria-live="polite" data-testid="cart-sync-notice">
    <span>{{ $t(syncNotice || `cartSync.${syncState}`) }}</span>
    <button v-if="syncState === 'error'" type="button" class="ms-3 min-h-10 font-semibold underline" @click="retrySync">{{ $t('embeddedCheckout.tryAgain') }}</button>
    <button v-if="syncState === 'conflict' || syncState === 'error'" type="button" class="ms-3 min-h-10 font-semibold underline" @click="reviewServerCart">{{ $t('cartSync.review') }}</button>
  </div>
</template>
<script setup>
const {syncState,syncNotice,retrySync,reviewServerCart} = useCart()
</script>
