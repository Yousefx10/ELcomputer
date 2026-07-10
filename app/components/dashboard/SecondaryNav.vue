<template>
  <div class="rounded-2xl bg-white p-2 shadow">
    <nav class="flex flex-wrap gap-2">
      <NuxtLink
        v-for="item in items"
        :key="item.to"
        :to="item.to"
        class="rounded-xl px-4 py-2 text-sm font-semibold transition"
        :class="item.active
          ? 'bg-black text-white'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
      >
        {{ item.label }}
      </NuxtLink>
    </nav>
  </div>
</template>

<script setup>
defineProps({
  items: {
    type: Array,
    default: () => []
  }
})
</script>
