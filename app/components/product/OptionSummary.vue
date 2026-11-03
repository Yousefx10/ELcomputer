<script setup>
import { variantOptionSummary } from '~/utils/productOptions'
const props = defineProps({ values: { type: Object, default: () => ({}) } })
const summary = computed(() => variantOptionSummary(props.values))
</script>
<template><p v-if="summary" class="mt-1 text-xs text-[var(--text-secondary)]"><bdi>{{ summary }}</bdi></p></template>
