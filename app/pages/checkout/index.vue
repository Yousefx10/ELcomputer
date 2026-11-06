<template>
  <CheckoutModern v-if="checkoutStyle === 'modern'" :flow="flow" />
  <CheckoutClassic v-else :flow="flow" />
</template>

<script setup>
import CheckoutClassic from '~/components/checkout/Classic.vue'
import CheckoutModern from '~/components/checkout/Modern.vue'
import { useCheckoutFlow } from '~/composables/useCheckoutFlow'

definePageMeta({ middleware: ['customer-auth', 'purchasing'] })

const { uiLabel } = useUiLocale()
const { data: siteContent } = await useSiteContent()
const { data: appearance } = await useCheckoutAppearance()
// One flow for both layouts; the Dashboard setting only changes presentation.
const flow = useCheckoutFlow({ siteContent })
const checkoutStyle = computed(() => appearance.value?.checkout_style === 'modern' ? 'modern' : 'classic')

useHead(() => ({ title: uiLabel('Checkout') }))
</script>
