<template>
  <div class="rounded-xl border border-gray-200 bg-white p-5" role="status" aria-live="polite" aria-busy="true">
    <p class="text-sm text-gray-500">{{ label }}</p>
    <div class="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4" aria-hidden="true">
      <div v-for="item in 4" :key="item" class="space-y-3 motion-safe:animate-pulse">
        <div class="aspect-square rounded-lg bg-gray-100" />
        <div class="h-3 w-3/4 rounded bg-gray-100" />
        <div class="h-3 w-1/2 rounded bg-gray-100" />
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({ label: { type: String, default: 'Loading…' } })
</script>
