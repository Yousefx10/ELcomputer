<template>
  <div
    v-if="dashboardLayout === 'standard' && resolvedItems.length"
    class="rounded-2xl bg-white p-2 shadow"
  >
    <nav class="flex flex-wrap gap-2">
      <NuxtLink
        v-for="item in resolvedItems"
        :key="item.to"
        :to="item.to"
        class="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition"
        :class="item.active
          ? 'bg-black text-white'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
      >
        <Icon v-if="item.icon" :name="item.icon" size="16" />
        {{ item.label }}
      </NuxtLink>
    </nav>
  </div>
</template>

<script setup>
const props = defineProps({
  items: {
    type: Array,
    default: () => []
  }
})

const {
  secondaryItems
} = useDashboardNavigation()
const {
  dashboardLayout
} = useDashboardLayout()

const resolvedItems = computed(() => {
  return secondaryItems.value.length
    ? secondaryItems.value
    : props.items
})
</script>
