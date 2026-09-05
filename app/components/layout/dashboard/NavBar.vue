<template>
  <header class="w-full">
    <nav class="w-full">
      <ul class="flex w-full flex-wrap gap-1 p-2">
        <li
          v-for="group in navigationGroups"
          :key="group.key"
          class="grow"
        >
          <NuxtLink
            :to="group.to"
            class="flex items-center justify-center gap-2 rounded-lg px-3 py-3 text-center text-sm transition"
            :class="activeGroup?.key === group.key
              ? 'bg-black text-white'
              : 'text-gray-700 hover:bg-black hover:text-white'"
          >
            <Icon :name="group.icon" size="18" />
            <span>{{ group.label }}</span>
          </NuxtLink>
        </li>
      </ul>
    </nav>
  </header>
</template>

<script setup>
const {
  loadAdminAccess
} = useAdminAccess()

await loadAdminAccess()

const {
  activeGroup,
  navigationGroups
} = useDashboardNavigation()
</script>
