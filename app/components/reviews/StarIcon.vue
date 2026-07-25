<template>
  <svg
    viewBox="0 0 24 24"
    :width="size"
    :height="size"
    role="presentation"
    aria-hidden="true"
    class="block shrink-0"
  >
    <polygon
      points="12 2.25 15.02 8.36 21.76 9.34 16.88 14.09 18.03 20.81 12 17.64 5.97 20.81 7.12 14.09 2.24 9.34 8.98 8.36 12 2.25"
      :fill="filled ? '#facc15' : 'transparent'"
      :stroke="filled ? '#eab308' : '#d1d5db'"
      stroke-width="1.7"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>

<script setup>
defineProps({
  filled: {
    type: Boolean,
    default: false
  },
  size: {
    type: [Number, String],
    default: 20
  }
})
</script>
