<template>
  <section v-if="payments.length" class="store-footer-modern-payments footer-payment-marks" :aria-label="title">
    <h2>{{ title }}</h2>
    <ul><li v-for="item in payments" :key="item.id"><img :src="footerUrl(item.image_url)" :alt="item.label" loading="lazy" width="64" height="32"></li></ul>
  </section>
</template>
<script setup>
import { resolveModernFooter, visibleFooterPayments, footerText, footerUrl } from '~/utils/modernFooter'
const props = defineProps({ settings: { type: Object, required: true } })
const { locale, t } = useI18n()
const { capabilities, purchasingEnabled } = usePurchaseAccess()
const config = computed(() => resolveModernFooter(props.settings))
const title = computed(() => footerText(config.value.payments, 'title', locale.value) || t('modernFooter.paymentMethods'))
const payments = computed(() => purchasingEnabled.value ? visibleFooterPayments(config.value, props.settings, capabilities.value) : [])
</script>
