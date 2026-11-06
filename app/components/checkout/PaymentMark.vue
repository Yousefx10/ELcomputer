<template>
  <svg v-if="mark" :viewBox="mark.viewBox" :class="sizeClass" role="img" :aria-label="label" xmlns="http://www.w3.org/2000/svg" v-html="mark.body" />
</template>

<script setup>
import { paymentMarks } from '~/utils/paymentMarks'
const props = defineProps({ name: { type: String, required: true }, label: { type: String, default: '' }, size: { type: String, default: 'md' } })
const mark = computed(() => paymentMarks[props.name])
const sizeClass = computed(() => props.size === 'sm' ? 'h-3.5 w-auto' : props.size === 'lg' ? 'h-6 w-auto' : 'h-5 w-auto')
</script>
